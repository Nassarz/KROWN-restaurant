#!/usr/bin/env node
/**
 * KROWN Print Bridge - Windows Production Print Agent
 * Listens on http://127.0.0.1:9101
 * Handles: USB Cashier Receipt Printer + Network Kitchen Printer (TCP/IP)
 *
 * FIX 1: usbPrint() now tries Windows LPT/raw port, then share, then TCP receipt fallback
 * FIX 2: Added POST /print/test endpoint for test prints
 * FIX 3: Receipt IP/port fallback uses job data, not kitchen defaults
 * FIX 5: printed_at uses epoch ms (BIGINT) instead of ISO string
 * FIX 6: paperWidth passed through HTTP/polling paths
 */
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec, execSync } from 'node:child_process';

// ── ARGS ───────────────────────────────────────────────────────────────────────
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2), v = process.argv[i + 1];
    if (v && !v.startsWith('--')) { args[k] = v; i++; } else args[k] = true;
  }
}

const HTTP_PORT       = parseInt(args['port'] || '9101', 10);
const KITCHEN_IP      = args['kitchen-ip']   || '192.168.1.34';
const KITCHEN_PORT    = parseInt(args['kitchen-port'] || '9100', 10);
const RECEIPT_USB     = args['receipt-usb'] === true || args['receipt-usb'] === 'true';
const RECEIPT_SHARE   = args['receipt-share'] || '';   // Custom Windows share name
const RECEIPT_TCP_IP  = args['receipt-ip'] || '';      // TCP fallback for receipt printer
const RECEIPT_TCP_PORT= parseInt(args['receipt-port'] || '9100', 10);
const IS_WIN          = process.platform === 'win32';
const SUPA_URL        = args['url']  || '';
const SUPA_KEY        = args['key']  || '';

// USB share candidates — try in order
const USB_SHARES = [];
if (RECEIPT_SHARE) USB_SHARES.push(`\\\\127.0.0.1\\${RECEIPT_SHARE}`);
USB_SHARES.push(
  '\\\\127.0.0.1\\Receipt',
  '\\\\127.0.0.1\\Cashierr_01',
  '\\\\127.0.0.1\\Receiptprinter',
  '\\\\127.0.0.1\\ReceiptPrinter',
  '\\\\127.0.0.1\\receipt',
);

const processing = new Set();

console.log('[KROWN] Print Bridge starting...');
console.log(`[KROWN] Kitchen Printer  : ${KITCHEN_IP}:${KITCHEN_PORT}`);
if (RECEIPT_USB) {
  console.log(`[KROWN] Receipt Printer  : USB (Windows Share${RECEIPT_SHARE ? ': ' + RECEIPT_SHARE : ''})`);
} else if (RECEIPT_TCP_IP) {
  console.log(`[KROWN] Receipt Printer  : TCP ${RECEIPT_TCP_IP}:${RECEIPT_TCP_PORT}`);
} else {
  console.log(`[KROWN] Receipt Printer  : Not configured`);
}
console.log(`[KROWN] Supabase polling : ${SUPA_URL ? 'ENABLED' : 'DISABLED'}`);

// ── ESC/POS COMPILER ───────────────────────────────────────────────────────────
function buildEscPos(rawPayload, paperWidth) {
  const ESC = 0x1B, GS = 0x1D;
  const LINE = paperWidth === '58mm' ? 32 : 48;
  const chunks = [];

  const INIT         = Buffer.from([ESC, 0x40]);
  const CODEPAGE     = Buffer.from([ESC, 0x74, 0x00]);
  const ALIGN_LEFT   = Buffer.from([ESC, 0x61, 0x00]);
  const ALIGN_CENTER = Buffer.from([ESC, 0x61, 0x01]);
  const BOLD_ON      = Buffer.from([ESC, 0x45, 0x01]);
  const BOLD_OFF     = Buffer.from([ESC, 0x45, 0x00]);
  const SIZE_NORMAL  = Buffer.from([GS,  0x21, 0x00]);
  const SIZE_DOUBLE  = Buffer.from([GS,  0x21, 0x11]);
  const FEED         = Buffer.from([ESC, 0x64, 0x04]);
  const CUT          = Buffer.from([GS,  0x56, 0x01]);

  const txt = s => Buffer.from(String(s || '').replace(/[^\x00-\x7F]/g, '?') + '\n', 'ascii');
  const center = s => { chunks.push(ALIGN_CENTER); chunks.push(txt(s)); };
  const left   = s => { chunks.push(ALIGN_LEFT);   chunks.push(txt(s)); };
  const lr     = (l, r) => {
    chunks.push(ALIGN_LEFT);
    const sp = LINE - String(r).length;
    const lp = String(l).slice(0, sp - 1);
    chunks.push(txt(lp + ' '.repeat(Math.max(1, sp - lp.length)) + r));
  };
  const divider = c => left(c.repeat(LINE));

  chunks.push(INIT, CODEPAGE);

  // Detect if payload is a JSON order object
  let order = null;
  let plainText = '';
  if (typeof rawPayload === 'object' && rawPayload !== null) {
    order = rawPayload;
  } else if (typeof rawPayload === 'string') {
    if (rawPayload.startsWith('%PDF') || rawPayload.includes('<!DOCTYPE') || rawPayload.includes('<html')) {
      throw new Error('INVALID_PAYLOAD: HTML/PDF not supported by thermal printer');
    }
    try {
      if (rawPayload.trim().startsWith('{')) {
        order = JSON.parse(rawPayload);
      } else {
        plainText = rawPayload;
      }
    } catch { plainText = rawPayload; }
  }

  if (order) {
    const isKitchen = order.type === 'KITCHEN_TICKET' || order.ticketType === 'prep';
    const isBill    = order.type === 'BILL' || order.ticketType === 'cashier_order';

    chunks.push(SIZE_DOUBLE, BOLD_ON);
    center('KROWN POS');
    chunks.push(SIZE_NORMAL, BOLD_OFF);
    center((order.branchName || 'KROWN RESTAURANT').toUpperCase());
    if (order.branchAddress) center(order.branchAddress);
    if (order.branchPhone)   center('TEL: ' + order.branchPhone);
    divider('=');

    chunks.push(BOLD_ON);
    if (isKitchen) center('*** KITCHEN ORDER TICKET ***');
    else if (isBill) center('*** CUSTOMER BILL - UNPAID ***');
    else center('*** PAYMENT RECEIPT ***');
    chunks.push(BOLD_OFF);

    divider('-');
    lr('ORDER:', '#' + String(order.id || '').slice(-8).toUpperCase());
    lr('TABLE:', String(order.table || 'T1'));
    lr('TYPE:', String(order.orderType || order.type || 'Dine In'));
    lr('TIME:', new Date(order.createdAt || Date.now()).toLocaleString());
    if (order.paymentMethod) lr('PAYMENT:', order.paymentMethod);
    divider('-');
    lr('ITEM', isKitchen ? 'QTY' : 'PRICE');
    divider('-');

    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        const qty  = item.quantity || 1;
        const name = `${qty}x ${item.name || 'Item'}`;
        const val  = isKitchen ? `x${qty}` : `UGX ${((item.price || 0) * qty).toLocaleString()}`;
        lr(name, val);
        if (item.note || item.notes) {
          left(`   NOTE: ${(item.note || item.notes).toUpperCase()}`);
        }
      }
    }

    divider('=');
    if (!isKitchen) {
      chunks.push(BOLD_ON);
      lr('TOTAL:', `UGX ${(order.total || 0).toLocaleString()}`);
      chunks.push(BOLD_OFF);
      if (order.amountReceived) lr('CASH:', `UGX ${Number(order.amountReceived).toLocaleString()}`);
      if (order.changeAmount != null) lr('CHANGE:', `UGX ${Number(order.changeAmount).toLocaleString()}`);
      divider('=');
    }
    center('Thank you!');
    center('Powered by KROWN POS');
  } else {
    // Plain text: compile line by line
    for (const line of plainText.replace(/[^\x00-\x7F]/g, '?').split('\n')) {
      const t = line.trim();
      if (!t) { chunks.push(txt('')); continue; }
      if (t.startsWith('=') || t.startsWith('-')) { divider(t[0]); continue; }
      if (t === 'KROWN POS' || t === 'INTCORE POS') {
        chunks.push(ALIGN_CENTER, SIZE_DOUBLE, BOLD_ON); chunks.push(txt(t));
        chunks.push(SIZE_NORMAL, BOLD_OFF); continue;
      }
      if (t.startsWith('***') && t.endsWith('***')) {
        chunks.push(ALIGN_CENTER, BOLD_ON); chunks.push(txt(t)); chunks.push(BOLD_OFF); continue;
      }
      const isBold = t.includes('TOTAL') || t.includes('AMOUNT');
      chunks.push(ALIGN_LEFT);
      if (isBold) chunks.push(BOLD_ON);
      chunks.push(txt(line));
      if (isBold) chunks.push(BOLD_OFF);
    }
  }

  chunks.push(FEED, CUT);
  const buf = Buffer.concat(chunks);
  if (buf.length < 20) throw new Error('EMPTY_PAYLOAD: buffer too small');
  return buf;
}

function tcpPrint(ip, port, buf) {
  return new Promise((resolve, reject) => {
    console.log(`[KROWN] TCP connecting to ${ip}:${port} (${buf.length} bytes)`);
    let done = false;
    const s = net.createConnection({ host: ip, port: Number(port) }, () => {
      console.log(`[KROWN] TCP connected to ${ip}:${port}, writing payload...`);
      s.write(buf, err => {
        if (err) {
          if (!done) { done = true; s.destroy(); reject(err); }
          return;
        }
        setTimeout(() => {
          if (!done) {
            done = true;
            s.end();
            s.destroy();
            console.log(`[KROWN] TCP print OK to ${ip}:${port}`);
            resolve(true);
          }
        }, 250);
      });
    });
    s.setTimeout(5000, () => {
      if (!done) {
        done = true;
        s.destroy();
        reject(new Error(`TIMEOUT: ${ip}:${port}`));
      }
    });
    s.on('error', err => {
      if (!done) {
        done = true;
        s.destroy();
        reject(err);
      }
    });
  });
}

// ── USB PRINT (CASHIER RECEIPT PRINTER) ───────────────────────────────────────
// Strategies:
//   Linux:  CUPS lp command → /dev/usb/lp0 raw → TCP fallback
//   Windows: LPT1 raw → Windows share (fs.writeFile + copy /b) → TCP fallback
function usbPrint(buf) {
  return new Promise((resolve, reject) => {
    const tcpFallback = () => {
      if (RECEIPT_TCP_IP) {
        console.log(`[KROWN] USB failed, falling back to TCP receipt: ${RECEIPT_TCP_IP}:${RECEIPT_TCP_PORT}`);
        return tcpPrint(RECEIPT_TCP_IP, RECEIPT_TCP_PORT, buf).then(resolve).catch(reject);
      }
      return reject(new Error(
        'USB print failed and no TCP receipt fallback configured. ' +
        'Options: (1) Use --receipt-ip <IP> for a network receipt printer, ' +
        '(2) On Windows: share the printer and use --receipt-share <Name>, ' +
        '(3) On Linux: ensure CUPS printer is enabled (lpadmin -e <printer>)'
      ));
    };

    // ── LINUX STRATEGY ──────────────────────────────────────────────────────
    if (!IS_WIN) {
      // Step 1: Try CUPS lp command with any available printer
      const cupsPrint = (printerName) => {
        const tmp = path.join(os.tmpdir(), `krown_${Date.now()}.raw`);
        try {
          fs.writeFileSync(tmp, buf);
          exec(`lp -d "${printerName}" -o raw "${tmp}" 2>&1`, (execErr, stdout) => {
            fs.unlink(tmp, () => {});
            if (!execErr) {
              console.log(`[KROWN] USB print OK via CUPS: ${printerName}`);
              return resolve(true);
            }
            console.error(`[KROWN] CUPS lp failed: ${(stdout || '').trim()}`);
            tryRawDevices();
          });
        } catch (e) {
          console.error(`[KROWN] CUPS write error: ${e.message}`);
          tryRawDevices();
        }
      };

      const tryCups = () => {
        console.log('[KROWN] Trying CUPS lp command...');
        exec('lpstat -p 2>/dev/null | awk \'$2=="enabled" {print $2}\' | head -1', (err, stdout) => {
          let printerName = (stdout || '').trim();
          if (!printerName) {
            // Fallback: get any configured printer name (field after "printer" keyword)
            exec('lpstat -p 2>/dev/null | awk \'$1=="printer" {print $2}\' | head -1', (err2, stdout2) => {
              printerName = (stdout2 || '').trim();
              if (!printerName) {
                console.log('[KROWN] No CUPS printers found');
                return tryRawDevices();
              }
              cupsPrint(printerName);
            });
            return;
          }
          cupsPrint(printerName);
        });
      };

      // Step 2: Try direct raw device /dev/usb/lp0
      const tryRawDevices = () => {
        const devices = ['/dev/usb/lp0', '/dev/usb/lp1', '/dev/lp0'];
        const tryDev = i => {
          if (i >= devices.length) return tcpFallback();
          const dev = devices[i];
          if (!fs.existsSync(dev)) return tryDev(i + 1);
          console.log(`[KROWN] Trying Linux raw device: ${dev}`);
          try {
            fs.writeFileSync(dev, buf);
            console.log(`[KROWN] USB print OK via ${dev}`);
            return resolve(true);
          } catch { tryDev(i + 1); }
        };
        tryDev(0);
      };

      tryCups();
      return;
    }

    // ── WINDOWS STRATEGY ────────────────────────────────────────────────────
    // Strategy W1: LPT1 raw port
    console.log('[KROWN] Trying LPT1 raw port...');
    const tmpLpt = path.join(os.tmpdir(), `krown_${Date.now()}.raw`);
    try {
      fs.writeFileSync(tmpLpt, buf);
      exec(`copy /b "${tmpLpt}" LPT1:`, execErr => {
        fs.unlink(tmpLpt, () => {});
        if (!execErr) { console.log('[KROWN] USB print OK via LPT1:'); return resolve(true); }
        tryWindowsShares(0);
      });
    } catch { tryWindowsShares(0); }

    // Strategy W2: Windows printer shares
    function tryWindowsShares(i) {
      if (i >= USB_SHARES.length) return tcpFallback();
      const share = USB_SHARES[i];
      console.log(`[KROWN] Trying Windows share: ${share}`);
      fs.writeFile(share, buf, err => {
        if (!err) { console.log(`[KROWN] USB print OK via ${share}`); return resolve(true); }
        const tmp = path.join(os.tmpdir(), `krown_${Date.now()}.raw`);
        try {
          fs.writeFileSync(tmp, buf);
          exec(`copy /b "${tmp}" "${share}"`, execErr => {
            fs.unlink(tmp, () => {});
            if (!execErr) { console.log(`[KROWN] USB copy/b OK via ${share}`); return resolve(true); }
            tryWindowsShares(i + 1);
          });
        } catch { tryWindowsShares(i + 1); }
      });
    }
  });
}

// ── TCP TEST (PRINTER STATUS CHECK) ───────────────────────────────────────────
function tcpTest(ip, port) {
  return new Promise(resolve => {
    const s = net.createConnection({ host: ip, port: Number(port) }, () => {
      s.end();
      resolve({ ok: true, status: 'CONNECTED' });
    });
    s.setTimeout(3000, () => { s.destroy(); resolve({ ok: false, status: 'TIMEOUT' }); });
    s.on('error', e => resolve({ ok: false, status: 'UNREACHABLE', error: e.message }));
  });
}

// ── SUPABASE REST ──────────────────────────────────────────────────────────────
async function supaFetch(path, method = 'GET', body = null) {
  if (!SUPA_URL || !SUPA_KEY) return null;
  const opts = {
    method,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, opts);
    if (method === 'GET' && r.ok) return await r.json();
  } catch { /* ignore */ }
  return null;
}

// ── DISPATCH PRINTER (routes to USB or TCP based on job + config) ──────────────
// FIX 3: Uses job's ip/port fields for receipt, not kitchen defaults
async function dispatchToPrinter(isReceipt, jobIp, jobPort, buf) {
  if (isReceipt && RECEIPT_USB) {
    return usbPrint(buf);
  }
  // Use job-provided IP/port first, then fall back to kitchen defaults
  const ip   = jobIp   || KITCHEN_IP;
  const port = jobPort || KITCHEN_PORT;
  return tcpPrint(ip, port, buf);
}

// ── SUPABASE QUEUE POLLING ─────────────────────────────────────────────────────
async function pollQueue() {
  // FIX 5: Query only QUEUED status (removed unused 'pending')
  const jobs = await supaFetch("print_jobs?status=eq.QUEUED&order=created_at.asc");
  if (!Array.isArray(jobs) || !jobs.length) return;
  for (const job of jobs) {
    if (processing.has(job.id)) continue;
    processing.add(job.id);
    await supaFetch(`print_jobs?id=eq.${job.id}`, 'PATCH', { status: 'PRINTING' });
    console.log(`[KROWN] Claimed DB job ${job.id} (${job.type})`);
    try {
      // FIX 6: Pass paperWidth from job metadata (fallback to '80mm')
      const paperWidth = job.paper_width || '80mm';
      const buf = buildEscPos(job.payload || job.content || job.data || '', paperWidth);
      const isReceipt = job.printer_id === 'receipt' || String(job.destination || '').toLowerCase().includes('receipt');
      // FIX 3: Pass job's ip/port to dispatchToPrinter
      await dispatchToPrinter(isReceipt, job.ip, job.port, buf);
      // FIX 5: Use epoch ms instead of ISO string for BIGINT column
      await supaFetch(`print_jobs?id=eq.${job.id}`, 'PATCH', { status: 'PRINTED', printed_at: Date.now() });
      console.log(`[KROWN] DB job ${job.id} PRINTED OK`);
    } catch (e) {
      console.error(`[KROWN] DB job ${job.id} FAILED:`, e.message);
      await supaFetch(`print_jobs?id=eq.${job.id}`, 'PATCH', { status: 'FAILED', last_error: e.message });
    } finally { processing.delete(job.id); }
  }
}

if (SUPA_URL && SUPA_KEY) {
  console.log('[KROWN] Supabase polling every 2s...');
  setInterval(pollQueue, 2000);
  pollQueue();
}

// ── HTTP SERVER ────────────────────────────────────────────────────────────────
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // GET /health
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      agent: 'KROWN Print Bridge',
      kitchenIp: KITCHEN_IP,
      kitchenPort: KITCHEN_PORT,
      usbReceipt: RECEIPT_USB,
      receiptShare: RECEIPT_SHARE || null,
      receiptTcpIp: RECEIPT_TCP_IP || null,
      receiptTcpPort: RECEIPT_TCP_PORT,
    }));
    return;
  }

  // POST /printers/test  — test network TCP connectivity
  if (req.method === 'POST' && req.url === '/printers/test') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { ip, port } = JSON.parse(body || '{}');
        const result = await tcpTest(ip || KITCHEN_IP, Number(port || KITCHEN_PORT));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, status: 'ERROR', error: e.message }));
      }
    });
    return;
  }

  // POST /print  — direct HTTP print (from browser frontend)
  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      let parsed = {};
      try { parsed = JSON.parse(body); } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
        return;
      }

      const id      = parsed.id || parsed.jobId || `http-${Date.now()}`;
      const type    = parsed.type || 'CUSTOMER_RECEIPT';
      const rawData = parsed.payload || parsed.text || parsed.content || parsed.data;
      const paperWidth = parsed.paperWidth || '80mm';

      if (!rawData) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing payload / text / content field' }));
        return;
      }

      if (processing.has(id)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, status: 'ALREADY_PROCESSING' }));
        return;
      }

      processing.add(id);
      console.log(`[KROWN] HTTP print job ${id} (${type})`);

      try {
        const buf = buildEscPos(rawData, paperWidth);
        const isReceipt = type === 'CUSTOMER_RECEIPT' || type === 'BILL' ||
                          String(parsed.printer_id || '').includes('receipt');

        // FIX 3: Pass job's ip/port for receipt, not kitchen defaults
        if (isReceipt && RECEIPT_USB) {
          await usbPrint(buf);
        } else {
          const ip   = parsed.ip   || KITCHEN_IP;
          const port = Number(parsed.port || KITCHEN_PORT);
          await tcpPrint(ip, port, buf);
        }

        // Update Supabase if job exists there
        if (SUPA_URL && SUPA_KEY) {
          // FIX 5: Use epoch ms for BIGINT column
          supaFetch(`print_jobs?id=eq.${id}`, 'PATCH', { status: 'PRINTED', printed_at: Date.now() }).catch(() => {});
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, status: 'PRINTED' }));
        console.log(`[KROWN] HTTP job ${id} PRINTED OK`);
      } catch (e) {
        console.error(`[KROWN] HTTP job ${id} FAILED:`, e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      } finally {
        processing.delete(id);
      }
    });
    return;
  }

  // FIX 2: POST /print/test — send a test print to a printer
  if (req.method === 'POST' && req.url === '/print/test') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { ip, port, target } = JSON.parse(body || '{}');
        const testPayload =
          '================================\n' +
          '      KROWN POS - TEST\n' +
          '================================\n' +
          `  ${new Date().toLocaleString()}\n` +
          '  Bridge: ONLINE\n' +
          '  Printer: CONNECTED\n' +
          '================================\n' +
          '  If you see this, printing\n' +
          '  is working correctly!\n' +
          '================================\n\n\n';

        const buf = buildEscPos(testPayload, '80mm');

        if (target === 'receipt' || (!target && RECEIPT_USB)) {
          await usbPrint(buf);
        } else {
          const targetIp   = ip   || KITCHEN_IP;
          const targetPort = Number(port || KITCHEN_PORT);
          await tcpPrint(targetIp, targetPort, buf);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, status: 'TEST_PRINT_SENT' }));
        console.log(`[KROWN] Test print sent to ${target || 'receipt'}`);
      } catch (e) {
        console.error('[KROWN] Test print FAILED:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, status: 'FAILED', error: e.message }));
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
        const { id } = JSON.parse(body || '{}');
        if (SUPA_URL && SUPA_KEY && id) {
          await supaFetch(`print_jobs?id=eq.${id}`, 'PATCH', { status: 'QUEUED' });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');

}).listen(HTTP_PORT, '127.0.0.1', () => {
  console.log(`[KROWN] Bridge ready on http://127.0.0.1:${HTTP_PORT}`);
});
