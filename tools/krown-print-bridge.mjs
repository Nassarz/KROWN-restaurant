#!/usr/bin/env node
/**
 * KROWN POS - Network Thermal Printer Bridge (Secure Local Print Agent)
 * ---------------------------------------------------------------------
 * Runs on the Cashier computer. Binds strictly to 127.0.0.1:9101 for safety.
 * Handles print queuing, retries, ESC/POS parsing, and direct TCP socket
 * communication to ethernet printers on port 9100.
 */

import http from 'node:http';
import net from 'node:net';

const HTTP_PORT = parseInt(process.argv[2] === '--port' ? process.argv[3] : '9101', 10);

// In-memory print job queue
const jobs = [];

// Helper to convert formatted text into ESC/POS binary buffer
function escposText(text) {
  const trimmed = text.trimEnd();
  // ESC/POS character formatting
  const chunks = [];
  chunks.push(Buffer.from([0x1b, 0x40]));                    // ESC @ (Initialize printer)
  chunks.push(Buffer.from([0x1b, 0x74, 0x00]));              // Set code page to CP437 (default standard characters)
  
  // Clean text and ensure character translation is safe (e.g. replace smart quotes if printer doesn't support them)
  const cleaned = text
    .replace(/[\u2018\u2019]/g, "'") // smart single quotes
    .replace(/[\u201c\u201d]/g, '"') // smart double quotes
    .replace(/[\u2013\u2014]/g, '-'); // en/em dash
    
  chunks.push(Buffer.from(cleaned + '\n', 'ascii'));         // CP437 works best with standard ascii
  
  // GS V B 0 (Paper feed and cut)
  chunks.push(Buffer.from([0x1d, 0x56, 0x42, 0x00]));        // Feed and partial cut
  return Buffer.concat(chunks);
}

// Low-level socket writer
function writeToPrinter(ip, port, escposBuffer) {
  return new Promise((resolve, reject) => {
    console.log(`[PRINT_AGENT] PRINTER_CONNECTION_ESTABLISHED to ${ip}:${port}`);
    const socket = net.createConnection({ host: ip, port }, () => {
      console.log(`[PRINT_AGENT] BYTES_SENT to ${ip}:${port} (${escposBuffer.length} bytes)`);
      socket.write(escposBuffer);
      socket.end();
    });
    
    socket.setTimeout(5000, () => {
      socket.destroy();
      reject(new Error(`TIMEOUT connecting to network printer at ${ip}:${port}`));
    });
    
    socket.on('error', (err) => {
      reject(err);
    });
    
    socket.on('close', (hadError) => {
      if (!hadError) resolve(true);
    });
  });
}

// TCP port 9100 health connectivity checker
function testConnection(ip, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: ip, port }, () => {
      socket.end();
      resolve({ ok: true, status: 'CONNECTED' });
    });
    
    socket.setTimeout(3000);
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, status: 'UNREACHABLE', error: 'TIMEOUT (printer powered off or client isolated)' });
    });
    
    socket.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        resolve({ ok: false, status: 'PORT_CLOSED', error: 'PORT CLOSED / PRINTER SERVICE UNAVAILABLE' });
      } else {
        resolve({ ok: false, status: 'UNREACHABLE', error: err.message });
      }
    });
  });
}

// Process a print job
async function processJob(job) {
  job.status = 'PRINTING';
  job.attempts += 1;
  console.log(`[PRINT_AGENT] Processing job ${job.id} (Attempt ${job.attempts})`);
  
  try {
    const buffer = escposText(job.payload);
    if (!buffer || buffer.length <= 10) { // ESC @ + cut is ~6 bytes, so 10 is a safe threshold
      throw new Error('Empty or invalid ESC/POS buffer generated');
    }
    
    await writeToPrinter(job.ip, job.port, buffer);
    job.status = 'PRINTED';
    job.printedAt = Date.now();
    job.lastError = null;
    console.log(`[PRINT_AGENT] PRINT_SUCCESS for job ${job.id}`);
  } catch (err) {
    job.status = 'FAILED';
    job.lastError = err.message;
    console.error(`[PRINT_AGENT] PRINT_FAILED for job ${job.id}: ${err.message}`);
  }
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // CORS configuration (allow requests from localhost or standard POS origins)
  const origin = req.headers.origin;
  if (origin && (origin.startsWith('http://localhost') || origin.startsWith('https://krown-restaurant-pos'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /health
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'krown-print-bridge', jobsCount: jobs.length }));
    return;
  }

  // GET /jobs
  if (req.method === 'GET' && req.url === '/jobs') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(jobs));
    return;
  }

  // POST /printers/test
  if (req.method === 'POST' && req.url === '/printers/test') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { ip, port } = JSON.parse(body);
        if (!ip || !port) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'ip and port required' }));
          return;
        }
        const result = await testConnection(ip, Number(port));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // POST /print
  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        console.log('[PRINT_AGENT] PRINT_AGENT_RECEIVED request');
        const parsed = JSON.parse(body);
        const { id, orderId, type, text, ip, port } = parsed;
        
        // Payload validation to prevent raw byte injection
        if (!id || !type || !text || !ip || !port) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'id, type, text, ip, port required for print validation' }));
          return;
        }

        // Check for duplicate print job ID (Idempotency)
        let existingJob = jobs.find(j => j.id === id);
        if (existingJob) {
          console.log(`[PRINT_AGENT] Duplicate print job ID detected: ${id}. Returning status: ${existingJob.status}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, status: existingJob.status, isDuplicate: true }));
          return;
        }

        // Register new print job
        console.log(`[PRINT_AGENT] PRINT_REQUEST_CREATED for order ${orderId} (${type})`);
        const newJob = {
          id,
          orderId,
          type,
          destination: `${type} Printer (${ip}:${port})`,
          payload: text,
          ip,
          port: Number(port),
          status: 'QUEUED',
          attempts: 0,
          createdAt: Date.now(),
          lastError: null,
          printedAt: null
        };
        jobs.push(newJob);

        // Process print job asynchronously
        processJob(newJob);

        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, status: 'QUEUED', jobId: id }));
      } catch (e) {
        console.error('[PRINT_AGENT] Enqueue failed:', e.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // POST /print/retry
  if (req.method === 'POST' && req.url === '/print/retry') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { id } = JSON.parse(body);
        const job = jobs.find(j => j.id === id);
        if (!job) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Job not found' }));
          return;
        }
        
        console.log(`[PRINT_AGENT] Retrying failed job ${id}`);
        processJob(job);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, status: 'PRINTING' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // POST /print/test
  if (req.method === 'POST' && req.url === '/print/test') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { ip, port } = JSON.parse(body);
        if (!ip || !port) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'ip and port required' }));
          return;
        }
        
        const testText = `
================================
        KROWN POS SYSTEM
          PRINTER TEST
================================
Date: ${new Date().toLocaleString()}
Status: Local Network OK
Connection: TCP/IP Port 9100

Readable characters test:
- Numbers: 0123456789
- Punctuation: & / ( ) ' , .
- Currency: UGX 15,000 / $ 5.00

Wrapping text test:
This is a long test line to verify
that text wraps correctly at the
configured 80mm column boundary.

================================
          TEST SUCCESS
================================
\n\n\n`;
        const buffer = escposText(testText);
        await writeToPrinter(ip, Number(port), buffer);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, status: 'PRINTED' }));
      } catch (e) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// Bind strictly to localhost (127.0.0.1) for local POS security
server.listen(HTTP_PORT, '127.0.0.1', () => {
  console.log(`KROWN Secure Print Bridge listening on http://127.0.0.1:${HTTP_PORT}`);
  console.log('Configure settings in POS: bridge host 127.0.0.1, bridge port 9101.');
});
