import { formatUGX } from './mockData';
import { sendToNetworkPrinter } from './printBridge';
import { jsPDF } from 'jspdf';

export function generateFormattedThermalReceipt(
  order: any,
  paperWidth: '80mm' | '58mm' = '80mm',
  ticketType: 'receipt' | 'prep' | 'cashier_order' | 'split' = 'receipt',
  splitData?: { splitIndex: number; totalSplits: number; amount: number; paymentMethod: string; seatCovered?: string; guestLabel?: string; guestItems?: { name: string; price: number; quantity: number; amount: number }[] }
): string {
  const lineCharLength = paperWidth === '58mm' ? 32 : 48;
  const divider = '-'.repeat(lineCharLength);
  const doubleDivider = '='.repeat(lineCharLength);

  const centerText = (text: string) => {
    if (text.length >= lineCharLength) return text.slice(0, lineCharLength);
    const leftPadding = Math.floor((lineCharLength - text.length) / 2);
    return ' '.repeat(leftPadding) + text;
  };

  const formatLine = (left: string, right: string) => {
    const spaceAvailable = lineCharLength - right.length;
    if (left.length > spaceAvailable - 1) {
      left = left.slice(0, spaceAvailable - 1);
    }
    const padding = spaceAvailable - left.length;
    return left + ' '.repeat(Math.max(1, padding)) + right;
  };

  const dateStr = new Date(order.createdAt || Date.now()).toLocaleString();
  const branchName = order.branchName || 'Krown Kampala Central (HQ)';
  const branchAddress = order.branchAddress || order.location || 'Kampala, Uganda';
  const branchPhone = order.branchPhone || '+256 772 100 200';
  const branchTaxId = order.branchTaxId || 'TIN: 100293481';
  const subtotal = order.subtotal || (order.total ? order.total / 1.18 : 0);
  const tax = order.tax || (order.total ? order.total - subtotal : 0);
  const total = order.total || 0;

  let text = '';
  text += centerText('KROWN ERP') + '\n';
  text += centerText(branchName.toUpperCase()) + '\n';
  text += centerText(branchAddress) + '\n';
  text += centerText(`TEL: ${branchPhone} | ${branchTaxId}`) + '\n';
  text += doubleDivider + '\n';

  if (ticketType === 'prep') {
    text += centerText('*** KITCHEN ORDER TICKET ***') + '\n';
  } else if (ticketType === 'cashier_order') {
    text += centerText('*** CASHIER ORDER TICKET (UNPAID) ***') + '\n';
  } else if (ticketType === 'split' && splitData) {
    text += centerText(`*** SPLIT RECEIPT (${splitData.splitIndex}/${splitData.totalSplits}) ***`) + '\n';
  } else {
    text += centerText('*** OFFICIAL PAYMENT RECEIPT ***') + '\n';
  }

  text += formatLine('ORDER NUMBER:', `#${(order.id || '').toUpperCase()}`) + '\n';
  text += formatLine('TABLE ID:', `${order.table || 'T1'}`) + '\n';
  text += formatLine('SEATING AREA:', `${order.place || 'Main Dining'}`) + '\n';
  text += formatLine('SEAT / COVER:', `${order.seat || 'Whole Table'}`) + '\n';
  text += formatLine('ORDER TYPE:', `${order.type || 'Dine In'}`) + '\n';
  text += formatLine('DATE / TIME:', dateStr) + '\n';

  if (ticketType === 'split' && splitData) {
    if (splitData.guestLabel) {
      text += formatLine('GUEST:', splitData.guestLabel) + '\n';
    }
    text += formatLine('PAYMENT METHOD:', splitData.paymentMethod) + '\n';
    if (splitData.seatCovered) {
      text += formatLine('SPLIT SEAT:', splitData.seatCovered) + '\n';
    }
  } else if (ticketType === 'receipt') {
    text += formatLine('PAYMENT METHOD:', order.paymentMethod || 'Paid') + '\n';
  }

  // Customer TIN (if provided)
  if (order.tinNumber && ticketType === 'receipt') {
    text += formatLine('CUSTOMER TIN:', order.tinNumber) + '\n';
  }

  if (order.isCorporateCredit || order.paymentMethod === 'Corporate Credit') {
    text += divider + '\n';
    text += centerText('*** CORPORATE CREDIT ACCOUNT ***') + '\n';
    text += formatLine('Company:', order.companyName || 'Corporate Client') + '\n';
    if (order.companyStaffName) {
      text += formatLine('Billed Staff:', order.companyStaffName) + '\n';
    }
    if (order.workId) {
      text += formatLine('Staff Work ID:', order.workId) + '\n';
    }
  }

  text += divider + '\n';
  if (ticketType === 'prep') {
    text += formatLine('QTY  ITEM DESCRIPTION', 'NOTE/STATUS') + '\n';
  } else {
    text += formatLine('ITEM DESCRIPTION', 'QTY x PRICE') + '\n';
  }
  text += divider + '\n';

  if (ticketType === 'split' && splitData?.guestItems && splitData.guestItems.length > 0) {
    splitData.guestItems.forEach((it: any) => {
      text += formatLine(`${it.quantity}x ${it.name}`, formatUGX(it.amount)) + '\n';
    });
  } else if (order.items && Array.isArray(order.items)) {
    order.items.forEach((item: any) => {
      if (ticketType === 'prep') {
        const itemTitle = `${item.quantity}x ${item.name}`;
        const noteStr = item.note ? item.note.slice(0, 15) : (item.addOns?.length ? `+${item.addOns.length} add-on${item.addOns.length > 1 ? 's' : ''}` : 'Standard');
        text += formatLine(itemTitle, noteStr) + '\n';
        if (item.addOns?.length) {
          item.addOns.forEach((a: any) => {
            text += formatLine(`   + ${a.name}`, `${formatUGX(a.price)}`) + '\n';
          });
        }
      } else {
        const itemTitle = `${item.quantity}x ${item.name}`;
        const addOnsTotal = (item.addOns || []).reduce((s: number, a: any) => s + (a.price * (item.quantity || 1)), 0);
        const itemPriceStr = formatUGX(((item.price || 0) * item.quantity) + addOnsTotal);
        text += formatLine(itemTitle, itemPriceStr) + '\n';
        if (item.addOns?.length) {
          item.addOns.forEach((a: any) => {
            text += formatLine(`   + ${a.name}`, formatUGX(a.price * (item.quantity || 1))) + '\n';
          });
        }
      }
    });
  }

  text += divider + '\n';

  if (ticketType === 'prep') {
    text += centerText(`ESTIMATED PREP TIME: ~${order.prepEstimatedMinutes || 15} MINS`) + '\n';
    text += doubleDivider + '\n\n';
    return text;
  }

  if (ticketType === 'split' && splitData) {
    text += formatLine('Full Order Total:', formatUGX(total)) + '\n';
    text += doubleDivider + '\n';
    text += formatLine(`THIS SPLIT (${splitData.splitIndex}/${splitData.totalSplits}):`, formatUGX(splitData.amount)) + '\n';
    text += doubleDivider + '\n';
    text += centerText('Thank you for dining with us!') + '\n';
    text += centerText('Powered by Krown Enterprise POS') + '\n\n\n';
    return text;
  }

  // Subtotal and tax lines removed per user request (menu is tax-inclusive)
  text += doubleDivider + '\n';
  if (ticketType === 'cashier_order') {
    text += formatLine('TOTAL DUE AT CASHIER:', formatUGX(total)) + '\n';
    text += centerText('*** UNPAID - AWAITING CASHIER SETTLEMENT ***') + '\n';
  } else {
    text += formatLine('TOTAL AMOUNT PAID:', formatUGX(total)) + '\n';
    text += centerText('Thank you for dining with us!') + '\n';
  }
  text += centerText('Powered by Krown Enterprise POS') + '\n\n\n';

  return text;
}

export function downloadReceiptFile(order: any) {
  const paperWidth = '80mm';
  const ticketType = 'receipt';
  const text = generateFormattedThermalReceipt(order, paperWidth, ticketType);

  // Split text into lines
  const lines = text.split('\n');

  // Configure jsPDF
  // 1 pt = 1/72 inch, 1 mm = 72 / 25.4 = ~2.83 points. 80 mm = ~226.8 points.
  const pdfWidthPts = 226.8; 
  const pdfHeightPts = Math.max(300, (lines.length * 11) + 40);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [pdfWidthPts, pdfHeightPts]
  });

  // Set monospace font (Courier)
  doc.setFont('Courier', 'normal');
  doc.setFontSize(8.5); // Fits perfectly on 80mm wide page (48 chars max)

  // Write line by line
  let y = 20;
  lines.forEach((line) => {
    doc.text(line, 10, y);
    y += 11;
  });

  doc.save(`Receipt_${(order.id || 'order').toUpperCase()}.pdf`);
}

export async function printTicket(
  ticketType: 'receipt' | 'prep' | 'cashier_order' | 'split' = 'receipt',
  order: any,
  paperWidth: '80mm' | '58mm' = '80mm',
  splitData?: any
) {
  console.log(`[PRINTER] Printing ${ticketType} ticket for order:`, order.id);
  const formattedText = generateFormattedThermalReceipt(order, paperWidth, ticketType, splitData);

  // Network-first: send silently to the ethernet thermal printer via bridge
  const kind: 'kitchen' | 'receipt' = ticketType === 'prep' ? 'kitchen' : 'receipt';
  const sent = await sendToNetworkPrinter(formattedText, kind);
  if (sent) {
    console.log(`[PRINTER] Sent ${ticketType} to network printer via bridge.`);
    return true;
  }

  // Fallback: Web-based printing using dynamic hidden iframe (never blocked by popup blockers!)
  if (typeof window !== 'undefined') {
    // Check if there is an existing print iframe and remove it
    const existing = document.getElementById('krown-print-iframe');
    if (existing) {
      document.body.removeChild(existing);
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'krown-print-iframe';
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = '0px';
    iframe.style.left = '-9999px';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(`
        <html>
          <head>
            <title>Thermal Receipt - #${order.id} [${ticketType.toUpperCase()}]</title>
            <style>
              @page { size: ${paperWidth} auto; margin: 0; }
              body {
                font-family: 'Courier New', Courier, monospace;
                width: ${paperWidth === '58mm' ? '58mm' : '80mm'};
                padding: 10px;
                margin: 0 auto;
                font-size: ${paperWidth === '58mm' ? '11px' : '13px'};
                line-height: 1.3;
                color: #000;
                white-space: pre-wrap;
              }
            </style>
          </head>
          <body>${formattedText.trimEnd() + '\n'}</body>
        </html>
      `);
      doc.close();
    }

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.warn('[PRINTER] Iframe print error:', e);
      } finally {
        // Wait a bit before removing to allow print command handover in some browsers
        setTimeout(() => {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }
    }, 250);

    return true;
  }
  return false;
}

/**
 * Kitchen-only auto-print: called when POS/Waiter places an order.
 * ONLY prints a Kitchen Order Ticket. NO customer receipt is generated.
 */
export async function autoPrintKitchenTicket(order: any) {
  console.log('[PRINTER] Sending Kitchen Order Ticket for order:', order.id);
  await printTicket('prep', order, '80mm');
}

/**
 * Legacy: Simultaneous multi-printer dispatch.
 * @deprecated Use autoPrintKitchenTicket for POS orders, printTicket('receipt') for cashier
 */
export async function autoPrintOrderTickets(order: any) {
  console.log('[PRINTER MULTI-DISPATCH] Dispatching tickets for order:', order.id);
  await printTicket('prep', order, '80mm');
  await printTicket('cashier_order', order, '80mm');
}
