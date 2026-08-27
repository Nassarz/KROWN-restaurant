// Network Thermal Printer Bridge
// Sends ESC/POS text to a local print bridge (tools/krown-print-bridge.mjs) which
// opens a raw TCP socket to the ethernet thermal printer (IP:9100).

import { dataStore } from './dataStore';

export interface PrinterBridgeConfig {
  enabled: boolean;
  bridgeHost: string;        // Local bridge IP (usually 127.0.0.1)
  bridgePort: number;        // Local bridge HTTP port (9101)
  kitchenIp: string;         // Kitchen thermal printer IP (ethernet)
  kitchenPort: number;       // 9100 default for ESC/POS
  receiptIp: string;         // Receipt printer IP
  receiptPort: number;       // 9100 default
  paperWidth: '80mm' | '58mm';
}

const CONFIG_KEY = 'krown_printer_bridge_config';

export function getPrinterConfig(): PrinterBridgeConfig {
  const defaultConfig: PrinterBridgeConfig = {
    enabled: true,
    bridgeHost: '127.0.0.1',
    bridgePort: 9101,
    kitchenIp: '192.168.1.34',
    kitchenPort: 9100,
    receiptIp: '127.0.0.1',
    receiptPort: 9100,
    paperWidth: '80mm',
  };

  if (typeof window === 'undefined') {
    return defaultConfig;
  }
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...defaultConfig, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultConfig;
}

export function setPrinterConfig(cfg: Partial<PrinterBridgeConfig>) {
  const merged = { ...getPrinterConfig(), ...cfg };
  if (typeof window !== 'undefined') {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
  }
  return merged;
}

async function pollJobStatus(jobId: string) {
  const cfg = getPrinterConfig();
  try {
    const res = await fetch(`http://${cfg.bridgeHost}:${cfg.bridgePort}/jobs`);
    if (!res.ok) return;
    const jobsList = await res.json();
    const job = jobsList.find((j: any) => j.id === jobId);
    if (job) {
      if (job.status === 'PRINTED') {
        dataStore.updatePrintJobStatus(jobId, 'PRINTED', { printedAt: job.printedAt || Date.now(), attempts: job.attempts });
      } else if (job.status === 'FAILED') {
        dataStore.updatePrintJobStatus(jobId, 'FAILED', { lastError: job.lastError, attempts: job.attempts });
      } else if (job.status === 'PRINTING' || job.status === 'QUEUED') {
        setTimeout(() => pollJobStatus(jobId), 1500);
      }
    }
  } catch (err) {
    console.warn('[PrintBridge] Error polling job status:', err);
  }
}

/**
 * Send plain text (already formatted as a thermal ticket) to a network printer
 * via the local bridge. Registers job in local database/store first.
 */
export async function sendToNetworkPrinter(
  text: string,
  kind: 'kitchen' | 'receipt',
  jobId: string,
  orderId: string,
  type: 'KITCHEN_TICKET' | 'BILL' | 'CUSTOMER_RECEIPT',
  paperWidth: '80mm' | '58mm' = '80mm'
): Promise<boolean> {
  const cfg = getPrinterConfig();
  const host = cfg.bridgeHost || '127.0.0.1';
  const port = cfg.bridgePort || 9101;
  const ip = kind === 'kitchen' ? (cfg.kitchenIp || '192.168.1.34') : (cfg.receiptIp || '127.0.0.1');
  const printerPort = Number(kind === 'kitchen' ? (cfg.kitchenPort || 9100) : (cfg.receiptPort || 9100));

  try {
    const res = await fetch(`http://${host}:${port}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: jobId,
        type,
        destination: `${kind === 'kitchen' ? 'Kitchen' : 'Receipt'} Printer`,
        printer_id: kind,
        payload: text,
        ip,
        port: printerPort,
        paperWidth,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[PrintBridge] Job ${jobId} bridge returned ${res.status}: ${errBody}`);
      dataStore.updatePrintJobStatus(jobId, 'FAILED', { lastError: `Bridge returned ${res.status}`, attempts: 1 });
      return false;
    }
    console.log(`[PrintBridge] Job ${jobId} (${type}) sent to bridge.`);
    return true;
  } catch (err: any) {
    console.error(`[PrintBridge] Job ${jobId} bridge unreachable: ${err.message}`);
    dataStore.updatePrintJobStatus(jobId, 'FAILED', { lastError: `Bridge offline: ${err.message}`, attempts: 1 });
    return false;
  }
}

export async function retryNetworkPrintJob(jobId: string): Promise<boolean> {
  dataStore.updatePrintJobStatus(jobId, 'QUEUED', { lastError: null, attempts: 0 });
  const cfg = getPrinterConfig();
  try {
    fetch(`http://${cfg.bridgeHost}:${cfg.bridgePort}/print/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: jobId }),
    }).catch(() => {});
  } catch { /* ignore */ }
  return true;
}

export async function testNetworkPrinter(target: string = 'kitchen', port: number = 9100): Promise<boolean> {
  const cfg = getPrinterConfig();
  const host = cfg.bridgeHost || '127.0.0.1';
  const bridgePort = cfg.bridgePort || 9101;

  if (target === 'receipt') {
    // Cashier USB Receipt Printer: check local agent health
    try {
      const res = await fetch(`http://${host}:${bridgePort}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  // Kitchen Printer: test TCP socket to 192.168.1.34:9100
  const targetIp = target === 'kitchen' ? (cfg.kitchenIp || '192.168.1.34') : target;
  const targetPort = target === 'kitchen' ? (cfg.kitchenPort || 9100) : port;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`http://${host}:${bridgePort}/printers/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ ip: targetIp, port: targetPort })
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      return data.ok === true || data.status === 'CONNECTED';
    }
  } catch {
    return false;
  }
  return false;
}

export async function sendTestPrintTicket(ip: string, port: number = 9100, target?: 'kitchen' | 'receipt'): Promise<{ ok: boolean; status: string; error?: string }> {
  const cfg = getPrinterConfig();
  const host = cfg.bridgeHost || '127.0.0.1';
  const bridgePort = cfg.bridgePort || 9101;

  try {
    const res = await fetch(`http://${host}:${bridgePort}/print/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, target })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err: any) {
    return { ok: false, status: 'FAILED', error: err.message };
  }
  return { ok: false, status: 'FAILED', error: 'Test print request failed' };
}
