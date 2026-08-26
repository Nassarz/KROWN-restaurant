#!/usr/bin/env node
/**
 * KROWN POS - Network Thermal Printer Bridge
 * -------------------------------------------
 * Run this on the POS computer (or any computer on the same LAN as the
 * kitchen printer). It exposes a tiny HTTP server on port 9101 and forwards
 * print jobs over a raw TCP socket (port 9100) to an ethernet thermal printer.
 *
 * Usage:
 *   node krown-print-bridge.mjs
 *   node krown-print-bridge.mjs --port 9101
 *
 * Then in the app: Settings -> Printer Setup -> enable bridge (127.0.0.1:9101)
 * and enter the kitchen printer IP (e.g. 192.168.1.100).
 */

import http from 'node:http';
import net from 'node:net';

const HTTP_PORT = parseInt(process.argv[2] === '--port' ? process.argv[3] : '9101', 10);

function escposText(text) {
  const trimmed = text.trimEnd();
  const buf = Buffer.from(trimmed + '\n', 'utf8');
  const chunks = [];
  chunks.push(Buffer.from([0x1b, 0x40]));                    // ESC @ init
  chunks.push(Buffer.from([0x1b, 0x74, 0x0b]));              // encoding CP437-ish (default ok)
  chunks.push(buf);
  // GS V B 0 (0x1d, 0x56, 0x42, 0x00) feeds paper by cutting position and cuts
  chunks.push(Buffer.from([0x1d, 0x56, 0x42, 0x00]));        // partial cut
  return Buffer.concat(chunks);
}

function printToPrinter(ip, port, text) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: ip, port }, () => {
      socket.write(escposText(text));
      socket.end();
    });
    socket.setTimeout(8000, () => {
      socket.destroy();
      reject(new Error(`TIMEOUT connecting to ${ip}:${port}`));
    });
    socket.on('error', (err) => reject(err));
    socket.on('close', () => resolve(true));
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'krown-print-bridge' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const { text, ip, port } = JSON.parse(body);
        if (!text || !ip || !port) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'text, ip, port required' }));
          return;
        }
        console.log(`[Bridge] Printing ${text.length} chars -> ${ip}:${port}`);
        await printToPrinter(ip, Number(port), text);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        console.error('[Bridge] Print failed:', e.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`KROWN Print Bridge listening on http://0.0.0.0:${HTTP_PORT}`);
  console.log('Configure the app: Settings -> Printer Setup -> bridge enabled, kitchen printer IP:port (9100)');
});
