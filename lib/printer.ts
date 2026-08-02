import { formatUGX } from './mockData';

export function generateFormattedThermalReceipt(
  order: any,
  paperWidth: '80mm' | '58mm' = '80mm',
  ticketType: 'receipt' | 'prep' | 'cashier_order' | 'split' = 'receipt',
  splitData?: { splitIndex: number; totalSplits: number; amount: number; paymentMethod: string; seatCovered?: string }
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
    text += centerText('*** KITCHEN PREP TICKET ***') + '\n';
  } else if (ticketType === 'cashier_order') {
    text += centerText('*** CASHIER ORDER TICKET (UNPAID) ***') + '\n';
  } else if (ticketType === 'split' && splitData) {
    text += centerText(`*** SPLIT RECEIPT (${splitData.splitIndex}/${splitData.totalSplits}) ***`) + '\n';
  } else {
    text += centerText('*** OFFICIAL TAX PAYMENT RECEIPT ***') + '\n';
  }

  text += formatLine('ORDER NUMBER:', `#${(order.id || '').toUpperCase()}`) + '\n';
  text += formatLine('TABLE ID:', `${order.table || 'T1'}`) + '\n';
  text += formatLine('SEATING AREA:', `${order.place || 'Main Dining'}`) + '\n';
  text += formatLine('SEAT / COVER:', `${order.seat || 'Whole Table'}`) + '\n';
  text += formatLine('ORDER TYPE:', `${order.type || 'Dine In'}`) + '\n';
  text += formatLine('DATE / TIME:', dateStr) + '\n';

  if (ticketType === 'split' && splitData) {
    text += formatLine('PAYMENT METHOD:', splitData.paymentMethod) + '\n';
    if (splitData.seatCovered) {
      text += formatLine('SPLIT SEAT:', splitData.seatCovered) + '\n';
    }
  } else if (ticketType === 'receipt') {
    text += formatLine('PAYMENT METHOD:', order.paymentMethod || 'Paid') + '\n';
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

  if (order.items && Array.isArray(order.items)) {
    order.items.forEach((item: any) => {
      if (ticketType === 'prep') {
        const itemTitle = `${item.quantity}x ${item.name}`;
        const noteStr = item.note ? item.note.slice(0, 15) : 'Standard';
        text += formatLine(itemTitle, noteStr) + '\n';
      } else {
        const itemTitle = `${item.quantity}x ${item.name}`;
        const itemPriceStr = formatUGX((item.price || 0) * item.quantity);
        text += formatLine(itemTitle, itemPriceStr) + '\n';
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

  text += formatLine('Subtotal:', formatUGX(subtotal)) + '\n';
  text += formatLine('URA VAT (18%):', formatUGX(tax)) + '\n';
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
  const receiptContent = generateFormattedThermalReceipt(order, '80mm', 'receipt');
  const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Receipt_${(order.id || 'order').toUpperCase()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function printTicket(
  ticketType: 'receipt' | 'prep' | 'cashier_order' | 'split' = 'receipt',
  order: any,
  paperWidth: '80mm' | '58mm' = '80mm',
  splitData?: any
) {
  console.log(`[PRINTER] Printing ${ticketType} ticket for order:`, order.id);
  const formattedText = generateFormattedThermalReceipt(order, paperWidth, ticketType, splitData);

  if (typeof window !== 'undefined') {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(`
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
          <body>${formattedText}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        try {
          printWindow.print();
          printWindow.close();
        } catch (e) {
          console.warn('[PRINTER] Thermal print execution note:', e);
        }
      }, 250);
      return;
    }
  }
}

export async function autoPrintOrderTickets(order: any) {
  // Simultaneous Multi-Printer Network Dispatch:
  // 1. Kitchen Thermal Printer (Screenless kitchen operation) -> Prep Ticket
  // 2. Cashier Thermal Printer -> Pre-payment Order Ticket
  console.log('[PRINTER MULTI-DISPATCH] Dispatching tickets to POS, Kitchen, and Cashier printers for order:', order.id);
  await printTicket('prep', order, '80mm');
  await printTicket('cashier_order', order, '80mm');
}
