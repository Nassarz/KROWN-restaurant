#!/usr/bin/env node
/**
 * INTCORE POS - Windows Production Print Agent (Zero-Dependency)
 * ---------------------------------------------------------------
 * Runs on the Cashier Windows PC. Listens on http://127.0.0.1:9101
 * Consumes print_jobs from Supabase & local HTTP triggers.
 * Compiles raw ESC/POS byte buffers for Network Xprinters (TCP/IP port 9100)
 * and Cashier USB printers.
 */

import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';

// Parse CLI flags
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const val = process.argv[i + 1];
    if (val && !val.startsWith('--')) {
      args[key] = val;
      i++;
    } else {
      args[key] = true;
    }
  }
}

const HTTP_PORT = parseInt(args.port || '9101', 10);
const jobs = [];
const processingLock = new Set();

// ── ENV LOADER ────────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const config = {};
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        config[key] = val;
      }
    });
  } catch (err) {
    console.error('[PRINT_AGENT] Failed to read .env.local:', err.message);
  }
  return config;
}

const env = loadEnv();
const supabaseUrl = args.url || env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = args.key || env.SUPABASE_SERVICE_ROLE_KEY;

const KITCHEN_PRINTER_IP = args['kitchen-ip'] || env.KITCHEN_PRINTER_IP || '192.168.1.34';
const KITCHEN_PRINTER_PORT = parseInt(args['kitchen-port'] || env.KITCHEN_PRINTER_PORT || '9100', 10);
const IS_RECEIPT_USB = args['receipt-usb'] === true || env.RECEIPT_USB === 'true';
const IS_WINDOWS = process.platform === 'win32';
const USB_PRINTER_PATH = args['usb-path'] || env.USB_PRINTER_PATH || (IS_WINDOWS ? '\\\\127.0.0.1\\Receiptprinter' : '/dev/usb/lp0');

// ── SUPABASE CLIENT ────────────────────────────────────────────────────────────
let supabase = null;
if (supabaseUrl && supabaseKey) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    console.log('[PRINT_AGENT] Supabase client active.');
  } catch {
    console.log('[PRINT_AGENT] Zero-Dependency REST polling mode active.');
  }
}

async function fetchQueuedJobsFromRest() {
  if (!supabaseUrl || !supabaseKey) return [];
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/print_jobs?status=in.(QUEUED,pending)&order=created_at.asc`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function updateJobInRest(id, updates) {
  if (!supabaseUrl || !supabaseKey) return;
  try {
    await fetch(`${supabaseUrl}/rest/v1/print_jobs?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(updates)
    });
  } catch { /* ignore */ }
}

// ── PAYLOAD NORMALIZATION & SAFETY CHECK ──────────────────────────────────────
function normalizePayload(payload) {
  if (payload === null || payload === undefined) {
    throw new Error('EMPTY_PAYLOAD: Payload is null or undefined');
  }

  let text = '';
  let orderObj = null;

  if (typeof payload === 'object') {
    orderObj = payload;
  } else if (typeof payload === 'string') {
    if (payload.startsWith('%PDF')) {
      throw new Error('INVALID_PAYLOAD: Received PDF payload (%PDF). Thermal printers only support ESC/POS.');
    }
    if (payload.includes('<!DOCTYPE') || payload.includes('<html') || payload.includes('<svg')) {
      throw new Error('INVALID_PAYLOAD: Received HTML/SVG payload. Thermal printers only support ESC/POS.');
    }

    try {
      if (payload.trim().startsWith('{')) {
        orderObj = JSON.parse(payload);
      } else {
        text = payload;
      }
    } catch {
      text = payload;
    }
  } else {
    throw new Error('INVALID_PAYLOAD: Payload must be string or JSON object');
  }

  return { text, orderObj };
}

// ── RAW ESC/POS COMPILER ──────────────────────────────────────────────────────
function compileEscpos(payload, paperWidth = '80mm') {
  const norm = normalizePayload(payload);
  const chunks = [];
  const lineLength = paperWidth === '58mm' ? 32 : 48;

  const ESC = 0x1B;
  const GS = 0x1D;

  const INIT = Buffer.from([ESC, 0x40]);
  const CODE_PAGE = Buffer.from([ESC, 0x74, 0x00]); // CP437
  const ALIGN_LEFT = Buffer.from([ESC, 0x61, 0x00]);
  const ALIGN_CENTER = Buffer.from([ESC, 0x61, 0x01]);
  const BOLD_ON = Buffer.from([ESC, 0x45, 0x01]);
  const BOLD_OFF = Buffer.from([ESC, 0x45, 0x00]);
  const SIZE_NORMAL = Buffer.from([GS, 0x21, 0x00]);
  const SIZE_DOUBLE_HW = Buffer.from([GS, 0x21, 0x11]);
  const FEED_PAPER = Buffer.from([ESC, 0x64, 0x04]);
  const CUT_PAPER = Buffer.from([GS, 0x56, 0x01]);

  chunks.push(INIT);
  chunks.push(CODE_PAGE);

  if (norm.orderObj) {
    const order = norm.orderObj;
    const center = (txt) => {
      chunks.push(ALIGN_CENTER);
      chunks.push(Buffer.from(txt + '\n', 'ascii'));
    };

    const leftRight = (left, right) => {
      chunks.push(ALIGN_LEFT);
      const space = lineLength - right.length;
      let leftPart = left;
      if (leftPart.length > space - 1) {
        leftPart = leftPart.slice(0, space - 1);
      }
      const padding = space - leftPart.length;
      chunks.push(Buffer.from(leftPart + ' '.repeat(Math.max(1, padding)) + right + '\n', 'ascii'));
    };

    chunks.push(SIZE_DOUBLE_HW, BOLD_ON);
    center('INTCORE POS');
    chunks.push(SIZE_NORMAL, BOLD_OFF);

    center((order.branchName || 'INTCORE RESTAURANT').toUpperCase());
    center(order.branchAddress || order.branchLocation || 'Kampala, Uganda');
    if (order.branchPhone) center(`TEL: ${order.branchPhone}`);

    chunks.push(ALIGN_LEFT);
    chunks.push(Buffer.from('='.repeat(lineLength) + '\n', 'ascii'));

    chunks.push(BOLD_ON, ALIGN_CENTER);
    if (order.ticketType === 'prep' || order.isPrep || order.type === 'KITCHEN_TICKET') {
      center('*** KITCHEN ORDER TICKET ***');
    } else if (order.ticketType === 'cashier_order' || order.type === 'BILL') {
      center('*** CUSTOMER BILL - UNPAID ***');
    } else {
      center('*** OFFICIAL PAYMENT RECEIPT ***');
    }
    chunks.push(BOLD_OFF, ALIGN_LEFT);

    leftRight('ORDER NUMBER:', `#${(order.id || '').toUpperCase().slice(-8)}`);
    leftRight('TABLE:', `${order.table || 'T1'}`);
    leftRight('TYPE:', `${order.type || 'Dine In'}`);
    leftRight('DATE / TIME:', new Date(order.createdAt || Date.now()).toLocaleString());
    if (order.paymentMethod) leftRight('PAYMENT METHOD:', order.paymentMethod);

    chunks.push(Buffer.from('-'.repeat(lineLength) + '\n', 'ascii'));
    leftRight('ITEM DESCRIPTION', order.type === 'KITCHEN_TICKET' ? 'QTY' : 'PRICE');
    chunks.push(Buffer.from('-'.repeat(lineLength) + '\n', 'ascii'));

    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        const itemTitle = `${item.quantity}x ${item.name}`;
        const priceVal = ((item.price || 0) * item.quantity);
        const priceStr = order.type === 'KITCHEN_TICKET' ? `x${item.quantity}` : `USh ${priceVal.toLocaleString()}`;
        leftRight(itemTitle, priceStr);
        if (item.note || item.notes) {
          const noteText = item.note || item.notes;
          chunks.push(ALIGN_LEFT);
          chunks.push(Buffer.from(`   NOTE: ${noteText.toUpperCase()}\n`, 'ascii'));
        }
      });
    }

    chunks.push(Buffer.from('='.repeat(lineLength) + '\n', 'ascii'));
    if (order.type !== 'KITCHEN_TICKET') {
      leftRight('TOTAL AMOUNT:', `USh ${(order.total || 0).toLocaleString()}`);
      if (order.amountReceived) leftRight('CASH RECEIVED:', `USh ${Number(order.amountReceived).toLocaleString()}`);
      if (order.changeAmount !== undefined) leftRight('CHANGE DUE:', `USh ${Number(order.changeAmount).toLocaleString()}`);
      chunks.push(Buffer.from('='.repeat(lineLength) + '\n', 'ascii'));
    }
    center('Powered by INTCORE POS');
    chunks.push(Buffer.from('\n\n\n', 'ascii'));
  } else {
    // Plain text compilation
    const cleanedText = norm.text
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2013\u2014]/g, '-');

    const lines = cleanedText.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) {
        chunks.push(Buffer.from('\n', 'ascii'));
        return;
      }

      if (trimmed.startsWith('-') || trimmed.startsWith('=')) {
        chunks.push(ALIGN_LEFT, SIZE_NORMAL, BOLD_OFF);
        const char = trimmed[0];
        chunks.push(Buffer.from(char.repeat(lineLength) + '\n', 'ascii'));
        return;
      }

      if (trimmed === 'INTCORE POS' || trimmed === 'KROWN ERP') {
        chunks.push(ALIGN_CENTER, SIZE_DOUBLE_HW, BOLD_ON);
        chunks.push(Buffer.from(trimmed + '\n', 'ascii'));
        chunks.push(SIZE_NORMAL, BOLD_OFF);
        return;
      }

      if (trimmed.startsWith('***') && trimmed.endsWith('***')) {
        chunks.push(ALIGN_CENTER, SIZE_NORMAL, BOLD_ON);
        chunks.push(Buffer.from(trimmed + '\n', 'ascii'));
        chunks.push(BOLD_OFF);
        return;
      }

      chunks.push(ALIGN_LEFT, SIZE_NORMAL);
      const shouldBold = trimmed.includes('TOTAL:') || trimmed.includes('TOTAL AMOUNT:');
      if (shouldBold) chunks.push(BOLD_ON);
      chunks.push(Buffer.from(line + '\n', 'ascii'));
      if (shouldBold) chunks.push(BOLD_OFF);
    });
  }

  chunks.push(FEED_PAPER);
  chunks.push(CUT_PAPER);

  const finalBuffer = Buffer.concat(chunks);

  if (!finalBuffer || finalBuffer.length < 20) {
    throw new Error('EMPTY_PAYLOAD: ESC/POS buffer length is less than minimum 20 bytes threshold');
  }

  return finalBuffer;
}

// ── PRINTER TRANSMISSION ENGINE (TCP FOR NETWORK / USB FOR CASHIER) ───────────
function writeToPrinter(ip, port, escposBuffer, isUsb = false) {
  if (!escposBuffer || !(escposBuffer instanceof Buffer) || escposBuffer.length < 20) {
    return Promise.reject(new Error('EMPTY_PAYLOAD: Refusing to write empty buffer to printer'));
  }

  if (isUsb) {
    return new Promise((resolve, reject) => {
      console.log(`[PRINT_AGENT] USB_WRITE_INITIATED for path: ${USB_PRINTER_PATH}`);
      const candidateShares = USB_PRINTER_PATH.startsWith('\\')
        ? [USB_PRINTER_PATH, '\\\\127.0.0.1\\Receipt', '\\\\127.0.0.1\\Cashierr_01', '\\\\127.0.0.1\\Receiptprinter']
        : ['\\\\127.0.0.1\\Receipt', '\\\\127.0.0.1\\Cashierr_01', '\\\\127.0.0.1\\Receiptprinter', '\\\\127.0.0.1\\ReceiptPrinter'];

      const tryShare = (index) => {
        if (index >= candidateShares.length) {
          return reject(new Error(`All USB printer shares failed (${candidateShares.join(', ')}). Check printer sharing.`));
        }

        const targetShare = candidateShares[index];
        fs.writeFile(targetShare, escposBuffer, (err) => {
          if (!err) {
            console.log(`[PRINT_AGENT] ✓ Direct write to USB printer ${targetShare} successful.`);
            return resolve(true);
          }

          if (IS_WINDOWS) {
            const tmpBin = path.join(os.tmpdir(), `intcore_bin_${Date.now()}.raw`);
            fs.writeFileSync(tmpBin, escposBuffer);
            const cmdBin = `copy /b "${tmpBin}" "${targetShare}"`;
            exec(cmdBin, (execErr) => {
              fs.unlink(tmpBin, () => {});
              if (!execErr) {
                console.log(`[PRINT_AGENT] ✓ Windows copy /b print successful to ${targetShare}.`);
                return resolve(true);
              }
              tryShare(index + 1);
            });
          } else {
            tryShare(index + 1);
          }
        });
      };
      tryShare(0);
    });
  }

  // Pure TCP Socket for Network Ethernet Printer (Section 2 & 3 & 4)
  return new Promise((resolve, reject) => {
    console.log(`[PRINT_AGENT] TCP_SOCKET_CONNECTING to Network Xprinter at ${ip}:${port}`);
    const socket = net.createConnection({ host: ip, port: Number(port) }, () => {
      console.log(`[PRINT_AGENT] TCP connected to ${ip}:${port}. Writing ${escposBuffer.length} ESC/POS bytes.`);
      socket.write(escposBuffer, () => {
        socket.end();
      });
    });

    socket.setTimeout(8000, () => {
      socket.destroy();
      reject(new Error(`PRINTER_UNREACHABLE: Connection timeout reaching Network Xprinter at ${ip}:${port}`));
    });

    socket.on('error', (err) => {
      reject(new Error(`PRINTER_UNREACHABLE: Socket error at ${ip}:${port} (${err.message})`));
    });

    socket.on('close', (hadError) => {
      if (!hadError) {
        console.log('[PRINT_AGENT] Network TCP print completed cleanly.');
        resolve(true);
      }
    });
  });
}

// ── CONNECTION TESTER ──────────────────────────────────────────────────────────
function testConnection(ip, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: ip, port: Number(port) }, () => {
      socket.end();
      resolve({ ok: true, status: 'CONNECTED' });
    });

    socket.setTimeout(3000);

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, status: 'UNREACHABLE', error: 'TIMEOUT (Printer offline or router unreachable)' });
    });

    socket.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        resolve({ ok: false, status: 'PORT_CLOSED', error: 'TCP Port 9100 Refused Connection' });
      } else {
        resolve({ ok: false, status: 'UNREACHABLE', error: err.message });
      }
    });
  });
}

// ── ATOMIC JOB CLAIM & PROCESSING ─────────────────────────────────────────────
async function claimJob(jobId) {
  if (processingLock.has(jobId)) return false;
  processingLock.add(jobId);

  if (supabase) {
    const { data, error } = await supabase
      .from('print_jobs')
      .update({ status: 'PRINTING', attempts: 1 })
      .eq('id', jobId)
      .in('status', ['QUEUED', 'pending'])
      .select();

    if (error || !data || data.length === 0) {
      processingLock.delete(jobId);
      return false;
    }
  } else {
    await updateJobInRest(jobId, { status: 'PRINTING' });
  }

  return true;
}

async function processDatabaseJob(job) {
  const claimed = await claimJob(job.id);
  if (!claimed) return;

  console.log(`[PRINT_AGENT] Claimed job ${job.id} from database. Type: ${job.type}`);

  let isUsb = false;
  let ip = KITCHEN_PRINTER_IP;
  let port = KITCHEN_PRINTER_PORT;

  if (job.printer_id === 'receipt' || (job.destination && job.destination.toLowerCase().includes('receipt'))) {
    if (IS_RECEIPT_USB) {
      isUsb = true;
    }
  }

  try {
    const escposBuffer = compileEscpos(job.payload);
    await writeToPrinter(ip, port, escposBuffer, isUsb);

    if (supabase) {
      await supabase.from('print_jobs').update({ status: 'PRINTED', printed_at: Date.now(), last_error: null }).eq('id', job.id);
    } else {
      await updateJobInRest(job.id, { status: 'PRINTED', printed_at: Date.now(), last_error: null });
    }

    console.log(`[PRINT_AGENT] ✓ Job ${job.id} printed successfully.`);
  } catch (err) {
    console.error(`[PRINT_AGENT] ✗ Job ${job.id} failed:`, err.message);

    if (supabase) {
      await supabase.from('print_jobs').update({ status: 'FAILED', last_error: err.message }).eq('id', job.id);
    } else {
      await updateJobInRest(job.id, { status: 'FAILED', last_error: err.message });
    }
  } finally {
    processingLock.delete(job.id);
  }
}

async function pollDatabaseQueue() {
  if (!supabaseUrl || !supabaseKey) return;
  try {
    let queuedJobs = [];
    if (supabase) {
      const { data, error } = await supabase
        .from('print_jobs')
        .select('*')
        .in('status', ['QUEUED', 'pending'])
        .order('created_at', { ascending: true });
      if (!error && data) queuedJobs = data;
    } else {
      queuedJobs = await fetchQueuedJobsFromRest();
    }

    if (queuedJobs && queuedJobs.length > 0) {
      for (const job of queuedJobs) {
        await processDatabaseJob(job);
      }
    }
  } catch (err) {
    console.error('[PRINT_AGENT] Database polling exception:', err.message);
  }
}

function startDatabaseQueueListener() {
  if (!supabaseUrl || !supabaseKey) return;

  console.log('[PRINT_AGENT] Database queue polling started (every 2s)...');
  setInterval(pollDatabaseQueue, 2000);
  pollDatabaseQueue();
}

// ── LOCAL HTTP SERVER ──────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, agent: 'INTCORE Print Agent', kitchenIp: KITCHEN_PRINTER_IP, kitchenPort: KITCHEN_PRINTER_PORT }));
    return;
  }

  // POST /printers/test
  if (req.method === 'POST' && req.url === '/printers/test') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { ip, port } = JSON.parse(body);
        const result = await testConnection(ip || KITCHEN_PRINTER_IP, Number(port || KITCHEN_PRINTER_PORT));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
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
        const targetIp = ip || KITCHEN_PRINTER_IP;
        const targetPort = Number(port || KITCHEN_PRINTER_PORT);

        const testPayload = {
          type: 'KITCHEN_TICKET',
          branchName: 'INTCORE POS',
          branchAddress: 'Kampala, Uganda',
          id: 'TEST-001',
          table: 'TEST',
          createdAt: Date.now(),
          items: [
            { name: 'PRINTER TEST', quantity: 1, price: 0, note: 'CONNECTION VERIFIED SUCCESSFUL' }
          ]
        };

        const escposBuffer = compileEscpos(testPayload);
        await writeToPrinter(targetIp, targetPort, escposBuffer, false);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, status: 'PRINTED' }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
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
        const parsed = JSON.parse(body);
        const { id, type, payload, text, ip, port } = parsed;
        const printPayload = payload || text;

        if (!id || !type || !printPayload) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'id, type, and payload are required' }));
          return;
        }

        const claimed = await claimJob(id);
        if (!claimed) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, status: 'PRINTING', isDuplicate: true }));
          return;
        }

        const targetIp = ip || KITCHEN_PRINTER_IP;
        const targetPort = Number(port || KITCHEN_PRINTER_PORT);
        const isUsb = IS_RECEIPT_USB && (type === 'CUSTOMER_RECEIPT' || type === 'BILL');

        const escposBuffer = compileEscpos(printPayload);
        await writeToPrinter(targetIp, targetPort, escposBuffer, isUsb);

        if (supabase) {
          await supabase.from('print_jobs').update({ status: 'PRINTED', printed_at: Date.now() }).eq('id', id);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, status: 'PRINTED' }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      } finally {
        if (parsed?.id) processingLock.delete(parsed.id);
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(HTTP_PORT, '127.0.0.1', () => {
  console.log(`INTCORE Production Print Agent listening on http://127.0.0.1:${HTTP_PORT}`);
  startDatabaseQueueListener();
});
