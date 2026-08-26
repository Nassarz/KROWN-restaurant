// Network Thermal Printer Bridge
// Sends ESC/POS text to a local print bridge (tools/krown-print-bridge.mjs) which
// opens a raw TCP socket to the ethernet thermal printer (IP:9100). This is what
// allows the kitchen printer to print automatically over ethernet while the
// POS computer stays connected via cable to the router/switch.

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

/**
 * Send plain text (already formatted as a thermal ticket) to a network printer
 * via the local bridge. Returns true when the bridge accepted it.
 */
export async function sendToNetworkPrinter(text: string, kind: 'kitchen' | 'receipt'): Promise<boolean> {
  const cfg = getPrinterConfig();
  if (!cfg.enabled) return false;

  const targetIp = kind === 'kitchen' ? cfg.kitchenIp : cfg.receiptIp;
  const targetPort = kind === 'kitchen' ? cfg.kitchenPort : cfg.receiptPort;

  try {
    const res = await fetch(`http://${cfg.bridgeHost}:${cfg.bridgePort}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, ip: targetIp, port: targetPort, paperWidth: cfg.paperWidth }),
    });
    if (!res.ok) return false;
    const body = await res.json().catch(() => null);
    return body?.ok === true;
  } catch (e) {
    console.warn('[PrintBridge] Bridge unreachable:', e);
    return false;
  }
}

export async function testNetworkPrinter(kind: 'kitchen' | 'receipt'): Promise<boolean> {
  return sendToNetworkPrinter(
    'KROWN ENTERPRISE POS\n\nPRINTER TEST OK\n' + new Date().toLocaleString() + '\n\n\n',
    kind
  );
}
