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
  if (typeof window === 'undefined') {
    return {
      enabled: false, bridgeHost: '127.0.0.1', bridgePort: 9101,
      kitchenIp: '192.168.1.100', kitchenPort: 9100,
      receiptIp: '192.168.1.101', receiptPort: 9100, paperWidth: '80mm',
    };
  }
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...getPrinterConfig(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return {
    enabled: false, bridgeHost: '127.0.0.1', bridgePort: 9101,
    kitchenIp: '192.168.1.100', kitchenPort: 9100,
    receiptIp: '192.168.1.101', receiptPort: 9100, paperWidth: '80mm',
  };
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
  type: 'KITCHEN_TICKET' | 'BILL' | 'CUSTOMER_RECEIPT'
): Promise<boolean> {
  const cfg = getPrinterConfig();
  const host = cfg.bridgeHost || '127.0.0.1';
  const port = cfg.bridgePort || 9101;
  const ip = kind === 'kitchen' ? cfg.kitchenIp : (cfg.receiptIp || cfg.kitchenIp);
  const printerPort = Number(kind === 'kitchen' ? cfg.kitchenPort : (cfg.receiptPort || cfg.kitchenPort || 9100));

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`http://${host}:${port}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        id: jobId,
        type,
        destination: `${kind === 'kitchen' ? 'Kitchen' : 'Receipt'} Printer`,
        printer_id: kind,
        payload: text,
        ip,
        port: printerPort,
      }),
    });
    clearTimeout(timer);

    if (res.ok) {
      console.log(`[PrintBridge] Direct HTTP fast-path print delivered to bridge on port ${port}.`);
      return true;
    }
  } catch (err) {
    console.log(`[PrintBridge] Local bridge http://${host}:${port} unreachable. Enqueued in DB.`);
  }

  // If local daemon is not running on 9101, return false so printer.ts triggers browser print dialog fallback
  return false;
}


export async function retryNetworkPrintJob(jobId: string): Promise<boolean> {
  // Set print job status back to QUEUED in Supabase so the background print bridge daemon processes it
  dataStore.updatePrintJobStatus(jobId, 'QUEUED', { lastError: null, attempts: 0 });

  const cfg = getPrinterConfig();
  try {
    // Fire-and-forget attempt on local HTTP bridge
    fetch(`http://${cfg.bridgeHost}:${cfg.bridgePort}/print/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: jobId }),
    }).catch(() => {});
  } catch (e) {
    // Ignored, database sync will process it
  }
  return true;
}

export async function testNetworkPrinter(kind: 'kitchen' | 'receipt'): Promise<boolean> {
  const cfg = getPrinterConfig();
  const targetIp = kind === 'kitchen' ? cfg.kitchenIp : (cfg.receiptIp || cfg.kitchenIp);
  const targetPort = Number(kind === 'kitchen' ? cfg.kitchenPort : (cfg.receiptPort || cfg.kitchenPort || 9100));

  try {
    const res = await fetch(`http://${cfg.bridgeHost}:${cfg.bridgePort}/print/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: targetIp, port: targetPort }),
    });
    return res.ok;
  } catch (e) {
    console.error('Test network printer failed:', e);
    return false;
  }
}
