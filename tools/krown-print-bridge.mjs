#!/usr/bin/env node
/**
 * KROWN POS - Network Thermal Printer Bridge (Secure Local Print Agent)
 * ---------------------------------------------------------------------
 * Runs on the Cashier computer. Binds strictly to 127.0.0.1:9101 for safety.
 * Handles print queuing, Supabase database queue syncing, ESC/POS compiling,
 * and direct TCP socket communication to ethernet printers on port 9100.
 */

import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';

// Parse command line arguments
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

// In-memory print job queue for HTTP client requests
const jobs = [];

// In-memory set of job IDs currently being processed to prevent duplicates
const processingLock = new Set();

// ── ENV LOADER (Zero-dependency .env.local parser) ───────────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.warn('[PRINT_AGENT] Warning: .env.local not found. Running in standalone mode.');
    return {};
  }
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

const KITCHEN_PRINTER_IP = args['kitchen-ip'] || env.KITCHEN_PRINTER_IP || '192.168.1.100';
const KITCHEN_PRINTER_PORT = parseInt(args['kitchen-port'] || env.KITCHEN_PRINTER_PORT || '9100', 10);
const RECEIPT_PRINTER_IP = args['receipt-ip'] || env.RECEIPT_PRINTER_IP || '192.168.1.101';
const RECEIPT_PRINTER_PORT = parseInt(args['receipt-port'] || env.RECEIPT_PRINTER_PORT || '9100', 10);

const IS_RECEIPT_USB = args['receipt-usb'] === true || env.RECEIPT_USB === 'true';
const IS_WINDOWS = process.platform === 'win32';
// On Windows: USB printers appear as \\.\USB001 or LPT1. On Linux: /dev/usb/lp0
const DEFAULT_USB_PATH = IS_WINDOWS ? '\\\\.\\USB001' : '/dev/usb/lp0';
const USB_PRINTER_PATH = args['usb-path'] || env.USB_PRINTER_PATH || DEFAULT_USB_PATH;

// ── SUPABASE CLIENT INITIALIZATION ──────────────────────────────────────────
let supabase = null;

if (supabaseUrl && supabaseKey) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
    console.log('[PRINT_AGENT] Supabase Realtime WebSocket client initialized.');
  } catch (err) {
    console.log('[PRINT_AGENT] Running in Zero-Dependency REST polling mode (Native Node Fetch).');
  }
} else {
  console.warn('[PRINT_AGENT] Supabase credentials missing. Running in local HTTP mode.');
}

// Zero-dependency REST API helpers using native Node fetch
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
  } catch (e) {
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
  } catch (e) { /* ignore */ }
}

// ── ADVANCED ESC/POS COMPILER ────────────────────────────────────────────────
function compileEscpos(payload, paperWidth = '80mm') {
  let order = null;
  try {
    if (payload.trim().startsWith('{')) {
      order = JSON.parse(payload);
    }
  } catch (e) {
    // Not JSON, fallback to plain text compile
  }

  const chunks = [];
  const lineLength = paperWidth === '58mm' ? 32 : 48;

  // ESC/POS Command Constants
  const ESC = 0x1B;
  const GS = 0x1D;

  const INIT = Buffer.from([ESC, 0x40]);                     // Initialize printer
  const CODE_PAGE = Buffer.from([ESC, 0x74, 0x00]);           // CP437 Character Set
  const ALIGN_LEFT = Buffer.from([ESC, 0x61, 0x00]);          // Left align
  const ALIGN_CENTER = Buffer.from([ESC, 0x61, 0x01]);        // Center align
  const ALIGN_RIGHT = Buffer.from([ESC, 0x61, 0x02]);         // Right align
  const BOLD_ON = Buffer.from([ESC, 0x45, 0x01]);             // Bold text on
  const BOLD_OFF = Buffer.from([ESC, 0x45, 0x00]);            // Bold text off
  const SIZE_NORMAL = Buffer.from([GS, 0x21, 0x00]);          // Normal text size
  const SIZE_DOUBLE_HW = Buffer.from([GS, 0x21, 0x11]);       // Double width & height
  const FEED_PAPER = Buffer.from([ESC, 0x64, 0x04]);          // Feed 4 lines before cut
  const CUT_PAPER = Buffer.from([GS, 0x56, 0x01]);            // Partial cut command

  chunks.push(INIT);
  chunks.push(CODE_PAGE);

  if (order) {
    // ── JSON ORDER OBJECT COMPILE ──
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

    // Header Title
    chunks.push(SIZE_DOUBLE_HW, BOLD_ON);
    center('KROWN ERP');
    chunks.push(SIZE_NORMAL, BOLD_OFF);

    center((order.branchName || 'Krown Kampala').toUpperCase());
    center(order.branchAddress || order.branchLocation || order.location || 'Kampala, Uganda');
    const branchPhone = order.branchPhone || '';
    const branchTaxId = order.branchTaxId || '';
    if (branchPhone) {
      const telLine = branchTaxId ? `TEL: ${branchPhone} | TIN: ${branchTaxId}` : `TEL: ${branchPhone}`;
      center(telLine);
    } else if (branchTaxId) {
      center(`TIN: ${branchTaxId}`);
    }
    
    chunks.push(ALIGN_LEFT);
    chunks.push(Buffer.from('='.repeat(lineLength) + '\n', 'ascii'));

    // Ticket Type Header
    chunks.push(BOLD_ON, ALIGN_CENTER);
    if (order.ticketType === 'prep' || order.isPrep) {
      center('*** KITCHEN ORDER TICKET ***');
    } else if (order.ticketType === 'cashier_order') {
      center('*** CUSTOMER BILL - UNPAID ***');
    } else {
      center('*** OFFICIAL PAYMENT RECEIPT ***');
    }
    chunks.push(BOLD_OFF, ALIGN_LEFT);

    // Metadata details
    leftRight('ORDER NUMBER:', `#${(order.id || '').toUpperCase()}`);
    leftRight('TABLE ID:', `${order.table || 'T1'}`);
    leftRight('SEATING AREA:', `${order.place || 'Main Dining'}`);
    leftRight('ORDER TYPE:', `${order.type || 'Dine In'}`);
    leftRight('DATE / TIME:', new Date(order.createdAt || Date.now()).toLocaleString());
    if (order.tinNumber) {
      leftRight('CUSTOMER TIN:', order.tinNumber);
    }
    if (order.paymentMethod) {
      leftRight('PAYMENT METHOD:', order.paymentMethod);
    }

    chunks.push(Buffer.from('-'.repeat(lineLength) + '\n', 'ascii'));
    leftRight('ITEM DESCRIPTION', 'PRICE');
    chunks.push(Buffer.from('-'.repeat(lineLength) + '\n', 'ascii'));

    // Cart Items loop
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        const itemTitle = `${item.quantity}x ${item.name}`;
        const priceVal = ((item.price || 0) * item.quantity);
        const priceStr = `USh ${priceVal.toLocaleString()}`;
        leftRight(itemTitle, priceStr);
        if (item.note) {
          chunks.push(ALIGN_LEFT);
          chunks.push(Buffer.from(`  * NOTE: ${item.note}\n`, 'ascii'));
        }
      });
    }

    chunks.push(Buffer.from('='.repeat(lineLength) + '\n', 'ascii'));
    leftRight('TOTAL AMOUNT:', `USh ${(order.total || 0).toLocaleString()}`);
    if (order.amountReceived) {
      leftRight('CASH RECEIVED:', `USh ${Number(order.amountReceived).toLocaleString()}`);
    }
    if (order.changeAmount !== undefined) {
      leftRight('CHANGE DUE:', `USh ${Number(order.changeAmount).toLocaleString()}`);
    }
    chunks.push(Buffer.from('='.repeat(lineLength) + '\n', 'ascii'));
    center('Powered by KROWN ERP');
    chunks.push(Buffer.from('\n\n\n', 'ascii'));
  } else {
    // ── PLAIN TEXT RECEIPT COMPILE ──
    const cleanedText = payload
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

      // 1. Dividers
      if (trimmed.startsWith('-') || trimmed.startsWith('=')) {
        chunks.push(ALIGN_LEFT, SIZE_NORMAL, BOLD_OFF);
        const char = trimmed[0];
        chunks.push(Buffer.from(char.repeat(lineLength) + '\n', 'ascii'));
        return;
      }

      // 2. Main Title (Double Size / Bold)
      if (trimmed === 'KROWN ERP' || trimmed === 'INTCORE POS') {
        chunks.push(ALIGN_CENTER, SIZE_DOUBLE_HW, BOLD_ON);
        chunks.push(Buffer.from(trimmed + '\n', 'ascii'));
        chunks.push(SIZE_NORMAL, BOLD_OFF);
        return;
      }

      // 3. Section Titles (Bold / Center)
      if (trimmed.startsWith('***') && trimmed.endsWith('***')) {
        chunks.push(ALIGN_CENTER, SIZE_NORMAL, BOLD_ON);
        chunks.push(Buffer.from(trimmed + '\n', 'ascii'));
        chunks.push(BOLD_OFF);
        return;
      }

      // 4. Center-aligned Text checks
      const leadingSpaces = line.length - line.trimStart().length;
      const expectedPadding = Math.floor((lineLength - trimmed.length) / 2);

      if (leadingSpaces > 0 && Math.abs(leadingSpaces - expectedPadding) <= 2) {
        chunks.push(ALIGN_CENTER, SIZE_NORMAL);
        const shouldBold = trimmed.includes('TOTAL DUE:') || trimmed.includes('TOTAL AMOUNT PAID:') || trimmed.includes('*** PAID') || trimmed.includes('*** CUSTOMER BILL');
        if (shouldBold) chunks.push(BOLD_ON);
        chunks.push(Buffer.from(trimmed + '\n', 'ascii'));
        if (shouldBold) chunks.push(BOLD_OFF);
      } else {
        // 5. Left-aligned text
        chunks.push(ALIGN_LEFT, SIZE_NORMAL);
        const shouldBold = trimmed.includes('TOTAL DUE:') || trimmed.includes('TOTAL AMOUNT PAID:');
        if (shouldBold) chunks.push(BOLD_ON);
        chunks.push(Buffer.from(line + '\n', 'ascii'));
        if (shouldBold) chunks.push(BOLD_OFF);
      }
    });
  }

  // Paper cut sequence
  chunks.push(FEED_PAPER);
  chunks.push(CUT_PAPER);
  return Buffer.concat(chunks);
}

// ── LOW-LEVEL PRINTER WRITER (TCP OR USB) ────────────────────────────────────
function writeToPrinter(ip, port, escposBuffer, isUsb = false, rawTextPayload = '') {
  if (isUsb) {
    return new Promise((resolve, reject) => {
      console.log(`[PRINT_AGENT] USB_WRITE_INITIATED to ${USB_PRINTER_PATH}`);
      
      const targetShare = USB_PRINTER_PATH.startsWith('\\') ? USB_PRINTER_PATH : '\\\\127.0.0.1\\ReceiptPrinter';

      // 1. Attempt direct Node write to Windows Shared Printer path \\127.0.0.1\ReceiptPrinter
      fs.writeFile(targetShare, escposBuffer, (err) => {
        if (!err) {
          console.log(`[PRINT_AGENT] Direct write to shared printer ${targetShare} successful.`);
          return resolve(true);
        }

        console.warn(`[PRINT_AGENT] Direct write to ${targetShare} notice: ${err.message}. Running Windows spooler fallback...`);

        if (IS_WINDOWS) {
          // 2. Windows Fallback: Write both binary ESC/POS & plain text version to temp files
          const timeId = Date.now();
          const tmpBin = path.join(os.tmpdir(), `krown_bin_${timeId}.raw`);
          const tmpTxt = path.join(os.tmpdir(), `krown_txt_${timeId}.txt`);

          const textContent = (rawTextPayload || escposBuffer.toString('ascii')).replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, '');

          fs.writeFileSync(tmpBin, escposBuffer);
          fs.writeFileSync(tmpTxt, textContent + '\n\n\n\n');

          // Attempt binary copy first
          const cmdBin = `copy /b "${tmpBin}" "${targetShare}"`;
          exec(cmdBin, (execErr) => {
            fs.unlink(tmpBin, () => {});

            if (!execErr) {
              fs.unlink(tmpTxt, () => {});
              console.log(`[PRINT_AGENT] Windows copy /b binary print successful.`);
              return resolve(true);
            }

            console.warn(`[PRINT_AGENT] Binary copy failed (${execErr.message}). Fallback to plain text print...`);

            // Fallback: Copy plain text to shared printer
            const cmdTxt = `copy /b "${tmpTxt}" "${targetShare}"`;
            exec(cmdTxt, (txtErr) => {
              fs.unlink(tmpTxt, () => {});
              if (txtErr) {
                // Second Fallback: print /d command
                const printCmd = `print /d:"${targetShare}" "${tmpTxt}"`;
                exec(printCmd, (printErr) => {
                  if (printErr) {
                    reject(new Error(`Windows USB print failed. Ensure receipt printer is shared as 'ReceiptPrinter'. Error: ${execErr.message}`));
                  } else {
                    console.log(`[PRINT_AGENT] Windows print /d text print successful.`);
                    resolve(true);
                  }
                });
              } else {
                console.log(`[PRINT_AGENT] Windows plain text print successful.`);
                resolve(true);
              }
            });
          });
        } else {
          reject(new Error(`USB write error: ${err.message}`));
        }
      });
    });
  }

  return new Promise((resolve, reject) => {
    console.log(`[PRINT_AGENT] TCP_CONNECTION_INITIATED to ${ip}:${port}`);
    const socket = net.createConnection({ host: ip, port }, () => {
      console.log(`[PRINT_AGENT] Connection established. Sending ${escposBuffer.length} bytes.`);
      socket.write(escposBuffer);
      socket.end();
    });
    
    socket.setTimeout(8000, () => {
      socket.destroy();
      reject(new Error(`Connection timeout reaching printer at ${ip}:${port}`));
    });
    
    socket.on('error', (err) => {
      reject(new Error(`Socket error: ${err.message}`));
    });
    
    socket.on('close', (hadError) => {
      if (!hadError) {
        console.log('[PRINT_AGENT] Socket connection closed cleanly.');
        resolve(true);
      }
    });
  });
}

// ── CONNECTION CONNECTIVITY CHECKER ──────────────────────────────────────────
function testConnection(ip, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: ip, port }, () => {
      socket.end();
      resolve({ ok: true, status: 'CONNECTED' });
    });
    
    socket.setTimeout(3000);
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, status: 'UNREACHABLE', error: 'TIMEOUT (Printer offline or bridge isolated)' });
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

// ── SUPABASE DATABASE QUEUE POLLER & LISTENER ─────────────────────────────────
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
      console.log(`[PRINT_AGENT] Found ${queuedJobs.length} queued jobs in database.`);
      for (const job of queuedJobs) {
        await processDatabaseJob(job);
      }
    }
  } catch (err) {
    console.error('[PRINT_AGENT] Database polling exception:', err.message);
  }
}

async function processDatabaseJob(job) {
  // Deduplication: skip if already being processed
  if (processingLock.has(job.id)) {
    console.log(`[PRINT_AGENT] Job ${job.id} already in progress, skipping duplicate.`);
    return;
  }
  processingLock.add(job.id);
  const attempts = (job.attempts || 0) + 1;
  
  // Set printing state in Supabase to lock against other daemon instances
  if (supabase) {
    await supabase.from('print_jobs').update({ status: 'PRINTING', attempts }).eq('id', job.id);
  } else {
    await updateJobInRest(job.id, { status: 'PRINTING', attempts });
  }

  console.log(`[PRINT_AGENT] Processing job ${job.id} from database. attempts: ${attempts}`);

  // Resolve target static IP & Port, or USB connection
  let isUsb = false;
  let ip = KITCHEN_PRINTER_IP;
  let port = KITCHEN_PRINTER_PORT;

  if (job.printer_id === 'receipt' || (job.destination && job.destination.toLowerCase().includes('receipt'))) {
    if (IS_RECEIPT_USB) {
      isUsb = true;
    } else {
      ip = RECEIPT_PRINTER_IP;
      port = RECEIPT_PRINTER_PORT;
    }
  }

  try {
    const escposBuffer = compileEscpos(job.payload);
    await writeToPrinter(ip, port, escposBuffer, isUsb, job.payload);

    // Success Status
    if (supabase) {
      await supabase.from('print_jobs').update({ status: 'PRINTED', printed_at: Date.now(), last_error: null }).eq('id', job.id);
    } else {
      await updateJobInRest(job.id, { status: 'PRINTED', printed_at: Date.now(), last_error: null });
    }

    console.log(`[PRINT_AGENT] ✓ Job ${job.id} printed and updated to printed.`);
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

function startDatabaseQueueListener() {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[PRINT_AGENT] No Supabase credentials provided. Database queue listener skipped.');
    return;
  }

  console.log('[PRINT_AGENT] Initializing database queue polling (every 2 seconds)...');
  setInterval(pollDatabaseQueue, 2000);
  pollDatabaseQueue(); // Initial check

  if (supabase) {
    console.log('[PRINT_AGENT] Subscribing to Supabase Realtime print_jobs...');
    try {
      supabase
        .channel('print_jobs_sync')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'print_jobs' }, async (payload) => {
          const job = payload.new;
          if (job && (job.status === 'QUEUED' || job.status === 'pending')) {
            console.log(`[PRINT_AGENT] Realtime insert captured for job ${job.id}`);
            processDatabaseJob(job).catch(e => console.error('[PRINT_AGENT] Realtime handling error:', e.message));
          }
        })
        .subscribe((status) => {
          console.log(`[PRINT_AGENT] Supabase realtime connection status: ${status}`);
        });
    } catch (err) {
      console.warn('[PRINT_AGENT] Realtime exception:', err.message);
    }
  }
}

// ── HTTP CLIENT SERVER REQUEST HANDLER ───────────────────────────────────────
async function processHttpClientJob(job) {
  // Deduplication: if Supabase realtime also fires, skip it
  if (processingLock.has(job.id)) {
    console.log(`[PRINT_AGENT] HTTP job ${job.id} already being processed via DB queue, skipping.`);
    return;
  }
  processingLock.add(job.id);
  job.status = 'PRINTING';
  job.attempts += 1;
  console.log(`[PRINT_AGENT] Processing HTTP client job ${job.id} (Attempt ${job.attempts})`);

  // Immediately mark as PRINTING in Supabase so DB queue poller skips it
  if (supabase) {
    supabase.from('print_jobs').update({ status: 'PRINTING' }).eq('id', job.id).then(() => {}).catch(() => {});
  }
  
  const isUsb = IS_RECEIPT_USB && (job.type === 'CUSTOMER_RECEIPT' || job.type === 'BILL' || job.destination.toLowerCase().includes('receipt'));
  
  try {
    const buffer = compileEscpos(job.payload);
    if (!buffer || buffer.length <= 10) {
      throw new Error('Invalid ESC/POS payload compiled.');
    }
    
    await writeToPrinter(job.ip, job.port, buffer, isUsb, job.payload);
    job.status = 'PRINTED';
    job.printedAt = Date.now();
    job.lastError = null;
    console.log(`[PRINT_AGENT] HTTP client job ${job.id} printed successfully.`);
    // Update Supabase to PRINTED so UI reflects success
    if (supabase) {
      supabase.from('print_jobs').update({ status: 'PRINTED', printed_at: Date.now() }).eq('id', job.id).then(() => {}).catch(() => {});
    }
  } catch (err) {
    job.status = 'FAILED';
    job.lastError = err.message;
    console.error(`[PRINT_AGENT] HTTP client job ${job.id} failed: ${err.message}`);
    // Leave as QUEUED so DB queue poller retries via Supabase
    if (supabase) {
      supabase.from('print_jobs').update({ status: 'QUEUED', last_error: err.message }).eq('id', job.id).then(() => {}).catch(() => {});
    }
  } finally {
    processingLock.delete(job.id);
  }
}

const server = http.createServer((req, res) => {
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
    res.end(JSON.stringify({ ok: true, service: 'krown-print-bridge', localJobs: jobs.length, databaseConnected: !!supabase }));
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
          res.end(JSON.stringify({ ok: false, error: 'ip and port fields are required' }));
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
        const parsed = JSON.parse(body);
        const { id, orderId, type, text, ip, port } = parsed;
        
        if (!id || !type || !text || !ip || !port) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'id, type, text, ip, and port are required' }));
          return;
        }

        let existingJob = jobs.find(j => j.id === id);
        if (existingJob) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, status: existingJob.status, isDuplicate: true }));
          return;
        }

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

        processHttpClientJob(newJob);

        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, status: 'QUEUED', jobId: id }));
      } catch (e) {
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
        
        processHttpClientJob(job);
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
          res.end(JSON.stringify({ ok: false, error: 'ip and port fields are required' }));
          return;
        }
        
        const testText = `
================================
        KROWN POS SYSTEM
          PRINTER TEST
================================
Date: ${new Date().toLocaleString()}
Status: Connection Verified
Port: ${IS_RECEIPT_USB ? 'USB Raw /dev/usb/lp0' : `Raw TCP Socket ${port}`}

Format Verification:
- Center alignments: Successful
- Bold text alignments: Successful
- Standard double size titles: Yes

================================
          TEST SUCCESS
================================
\n\n\n`;
        const buffer = compileEscpos(testText);
        const isUsb = IS_RECEIPT_USB && (ip.toLowerCase() === 'usb' || ip === '127.0.0.1' || Number(port) === 9101 || ip.includes('usb'));
        await writeToPrinter(ip, Number(port), buffer, isUsb);
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

// Start TCP listener
server.listen(HTTP_PORT, '127.0.0.1', () => {
  console.log(`KROWN Secure Print Bridge listening on http://127.0.0.1:${HTTP_PORT}`);
  startDatabaseQueueListener();
});
