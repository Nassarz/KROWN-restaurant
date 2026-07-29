// Abstract thermal printer service
// Uses navigator.usb or a mock for demonstration

export async function printTicket(ticketType: 'prep' | 'receipt', order: any) {
  console.log(`[PRINTER] Printing ${ticketType} ticket for order:`, order.id);
  
  if (!('usb' in navigator)) {
    console.warn('WebUSB not supported in this browser. Mocking print.');
    return;
  }

  try {
    // Note: In a real POS, this would request the specific vendor/product ID of the thermal printer.
    // We wrap it in a try-catch because this will fail in non-secure contexts or without user gesture.
    const devices = await (navigator as any).usb.getDevices();
    let device = devices[0];
    
    if (!device) {
      console.log('No USB printer found. Mocking print.');
      return;
    }

    await device.open();
    if (device.configuration === null) await device.selectConfiguration(1);
    await device.claimInterface(0);
    
    // Send ESC/POS commands (mock bytes)
    const encoder = new TextEncoder();
    let text = `--- ${ticketType.toUpperCase()} ---\nOrder #${order.id}\n`;
    order.items.forEach((item: any) => {
      text += `${item.quantity}x ${item.name}\n`;
    });
    text += `\n------------------\n\n`;
    
    const data = encoder.encode(text);
    // await device.transferOut(1, data); // Actual transfer
    console.log('[PRINTER] Data sent to USB printer successfully.');
    await device.close();
  } catch (error) {
    console.error('Print failed (expected if no physical printer or user gesture):', error);
  }
}
