import { Lot, CrateAllocation, LotCharge, Party } from './types';

// ─── Page Size Types ─────────────────────────────────────────────────────────
// Supported print page sizes across the entire application.
export type PrintPageSize = 'a4' | 'a5' | 'letter' | 'receipt';

/** Returns the CSS @page size string and margins for a given PrintPageSize */
export function getPageCss(size: PrintPageSize): { pageSize: string; margin: string } {
  switch (size) {
    case 'a5':      return { pageSize: 'A5',        margin: '10mm' };
    case 'letter':  return { pageSize: 'Letter',    margin: '15mm' };
    case 'receipt': return { pageSize: '80mm auto', margin: '2mm'  };
    case 'a4':
    default:        return { pageSize: 'A4',        margin: '12mm' };
  }
}

// Browser-based system printing helper
// Mobile browsers (iOS Safari, Android Chrome) block iframe.contentWindow.print().
// We detect mobile and inject HTML directly into the main document instead.
const isMobileBrowser = (): boolean =>
  /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
  ('ontouchstart' in window);

function printViaMobileDom(html: string, size: PrintPageSize): void {
  // Remove any stale mount point
  const existing = document.getElementById('print-mount-point');
  if (existing) existing.remove();

  const { pageSize, margin } = getPageCss(size);
  const formatClass = size === 'receipt' ? 'print-receipt' : 'print-a4';

  // Build a wrapper with all parent styles copied inline
  let stylesHtml = '';
  for (const el of Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))) {
    stylesHtml += el.outerHTML;
  }

  const mount = document.createElement('div');
  mount.id = 'print-mount-point';
  mount.innerHTML = `
    <style>
      ${stylesHtml}
      @page { size: ${pageSize}; margin: ${margin}; }
      body { background: white !important; color: black !important; }
    </style>
    <div class="${formatClass}">
      ${html}
    </div>
  `;
  document.body.appendChild(mount);
  document.body.classList.add('is-printing', formatClass);

  // Force synchronous layout reflow so mobile browser paints the mount point before print dialog
  void mount.offsetHeight;

  let cleaned = false;
  const cleanup = (delay = 1000) => {
    if (cleaned) return;
    cleaned = true;

    window.removeEventListener('afterprint', handleAfterPrint);
    window.removeEventListener('focus', handleFocus);

    setTimeout(() => {
      const el = document.getElementById('print-mount-point');
      if (el) el.remove();
      document.body.classList.remove('is-printing', 'print-a4', 'print-receipt');
    }, delay);
  };

  const handleAfterPrint = () => {
    cleanup(3000);
  };

  const handleFocus = () => {
    cleanup(1000);
  };

  window.addEventListener('afterprint', handleAfterPrint);
  window.addEventListener('focus', handleFocus);

  setTimeout(() => { cleanup(500); }, 10000);
  setTimeout(() => { window.print(); }, 500);
}

export function printViaBrowser(html: string, size: PrintPageSize): void;
export function printViaBrowser(size: PrintPageSize): void;
export function printViaBrowser(htmlOrSize: string | PrintPageSize, size?: PrintPageSize): void {
  if (typeof htmlOrSize === 'string' && size) {
    // Mobile: use direct DOM injection so the native print dialog fires correctly
    if (isMobileBrowser()) {
      printViaMobileDom(htmlOrSize, size);
      return;
    }

    const { pageSize, margin } = getPageCss(size);
    const formatClass = size === 'receipt' ? 'print-receipt' : 'print-a4';

    // Desktop: use hidden iframe for flicker-free background printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.left = '-9999px';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      let stylesHtml = '';
      // Copy all style and stylesheet links from parent head to preserve formatting and theme styles
      for (const el of Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))) {
        stylesHtml += el.outerHTML;
      }

      doc.write(`
        <html>
          <head>
            <title>Print</title>
            ${stylesHtml}
            <style>
              body {
                background: white !important;
                color: black !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              @page {
                size: ${pageSize};
                margin: ${margin};
              }
            </style>
          </head>
          <body class="${formatClass}">
            ${htmlOrSize}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.focus();
                  window.print();
                  window.parent.document.body.removeChild(window.frameElement);
                }, 200);
              };
            <\/script>
          </body>
        </html>
      `);
      doc.close();
    }
  } else {
    const actualSize = (htmlOrSize as PrintPageSize) || 'a4';
    const formatClass = actualSize === 'receipt' ? 'print-receipt' : 'print-a4';
    const originalClassName = document.body.className;

    document.body.classList.remove('print-a4', 'print-receipt');
    document.body.classList.add(formatClass);

    setTimeout(() => {
      window.print();
      document.body.className = originalClassName;
    }, 150);
  }
}

// ESC/POS Binary Command Encoder for direct Bluetooth/USB thermal printing
export class EscPosEncoder {
  private buffer: Uint8Array[] = [];

  initialize() {
    this.buffer.push(new Uint8Array([0x1b, 0x40])); // ESC @ - Initialize
    return this;
  }

  alignCenter() {
    this.buffer.push(new Uint8Array([0x1b, 0x61, 0x01])); // ESC a 1 - Center
    return this;
  }

  alignLeft() {
    this.buffer.push(new Uint8Array([0x1b, 0x61, 0x00])); // ESC a 0 - Left
    return this;
  }

  alignRight() {
    this.buffer.push(new Uint8Array([0x1b, 0x61, 0x02])); // ESC a 2 - Right
    return this;
  }

  bold(enable: boolean) {
    this.buffer.push(new Uint8Array([0x1b, 0x45, enable ? 1 : 0])); // ESC E n - Bold
    return this;
  }

  doubleSize(enable: boolean) {
    this.buffer.push(new Uint8Array([0x1b, 0x21, enable ? 0x30 : 0x00])); // ESC ! n - Double height/width
    return this;
  }

  text(str: string) {
    this.buffer.push(new TextEncoder().encode(str + "\n"));
    return this;
  }

  feedLines(n: number) {
    this.buffer.push(new Uint8Array([0x1b, 0x64, n])); // ESC d n - Feed lines
    return this;
  }

  cut() {
    this.buffer.push(new Uint8Array([0x1d, 0x56, 0x41, 0x03])); // GS V 65 3 - Paper cut
    return this;
  }

  line(width: number = 48) {
    this.text('-'.repeat(width));
    return this;
  }

  getBuffer(): Uint8Array {
    let totalLength = this.buffer.reduce((acc, b) => acc + b.length, 0);
    let out = new Uint8Array(totalLength);
    let offset = 0;
    for (let b of this.buffer) {
      out.set(b, offset);
      offset += b.length;
    }
    return out;
  }
}

// Generate ESC/POS raw bytes for a Lot receipt (seller receipt or buyer receipt)
export function compileLotThermalSlip(
  lot: Lot,
  crates: CrateAllocation[],
  charges: LotCharge[],
  settings: { business_name: string; phone: string; address: string },
  buyerFilterId?: string
): Uint8Array {
  const encoder = new EscPosEncoder();
  encoder.initialize();

  // Print Header
  encoder.alignCenter().doubleSize(true).bold(true).text(settings.business_name);
  encoder.doubleSize(false).bold(false).text(settings.address);
  encoder.text(`Phone: ${settings.phone}`);
  encoder.line();

  if (buyerFilterId) {
    // Buyer Slip
    const buyerName = crates.find(c => c.buyer_id === buyerFilterId)?.buyer_name || 'Buyer';
    encoder.bold(true).text(`BUYER MEMO: ${buyerName.toUpperCase()}`);
    encoder.bold(false).text(`Lot ID: ${lot.id}`);
  } else {
    // Seller Slip
    encoder.bold(true).text(`SELLER MEMO: ${lot.seller_name.toUpperCase()}`);
    encoder.bold(false).text(`Lot ID: ${lot.id}`);
  }
  
  encoder.text(`Date: ${new Date(lot.arrival_date).toLocaleDateString()}`);
  encoder.line();

  // Columns: Fruit/Grade | Weight | Rate | Amount
  encoder.alignLeft();
  encoder.bold(true).text('ITEMS');
  encoder.bold(false);
  
  const filteredCrates = buyerFilterId 
    ? crates.filter(c => c.buyer_id === buyerFilterId)
    : crates;
    
  filteredCrates.forEach(c => {
    const itemLabel = `${c.fruit_type} (${c.quality_grade})`;
    const detailLabel = `${c.qty} Cr. | ${c.net_weight_kg.toFixed(1)} kg @ ${c.rate_per_kg}/kg`;
    const amtLabel = `Rs. ${c.sale_amount.toFixed(0)}`;
    
    // Left align item and right align amount
    const spaces = 48 - itemLabel.length - amtLabel.length;
    const padding = spaces > 0 ? ' '.repeat(spaces) : ' ';
    encoder.text(`${itemLabel}${padding}${amtLabel}`);
    encoder.text(`  ${detailLabel}`);
  });
  
  encoder.line();

  // Charges / Deductions
  if (!buyerFilterId) {
    // Seller Charges
    encoder.bold(true).text('CHARGES & DEDUCTIONS');
    encoder.bold(false);
    let totalCharges = 0;
    charges.filter(ch => !ch.buyer_id).forEach(ch => {
      const label = ch.notes;
      const val = `Rs. ${ch.amount.toFixed(0)}`;
      const spaces = 48 - label.length - val.length;
      encoder.text(`${label}${' '.repeat(spaces > 0 ? spaces : 1)}${val}`);
      totalCharges += ch.amount;
    });
    encoder.line();
    
    // Summary
    const grossVal = `Rs. ${lot.gross_sale_amount.toFixed(0)}`;
    const spaces1 = 48 - 'Gross Sale:'.length - grossVal.length;
    encoder.bold(true).text(`Gross Sale:${' '.repeat(spaces1 > 0 ? spaces1 : 1)}${grossVal}`);
    
    const chargesVal = `Rs. ${totalCharges.toFixed(0)}`;
    const spaces2 = 48 - 'Total Charges:'.length - chargesVal.length;
    encoder.text(`Total Charges:${' '.repeat(spaces2 > 0 ? spaces2 : 1)}${chargesVal}`);
    
    const netVal = `Rs. ${lot.net_payable_to_seller.toFixed(0)}`;
    const spaces3 = 48 - 'Net Payable:'.length - netVal.length;
    encoder.doubleSize(true).text(`Net Payable:${' '.repeat(spaces3 > 0 ? spaces3 : 1)}${netVal}`);
  } else {
    // Buyer Charges and Total
    const buyerCharges = charges.filter(ch => ch.buyer_id === buyerFilterId);
    let crateSum = filteredCrates.reduce((s, c) => s + c.sale_amount, 0);
    let chargesSum = buyerCharges.reduce((s, c) => s + c.amount, 0);
    
    if (buyerCharges.length > 0) {
      encoder.bold(true).text('BUYER CHARGES');
      encoder.bold(false);
      buyerCharges.forEach(ch => {
        const label = ch.notes;
        const val = `Rs. ${ch.amount.toFixed(0)}`;
        const spaces = 48 - label.length - val.length;
        encoder.text(`${label}${' '.repeat(spaces > 0 ? spaces : 1)}${val}`);
      });
      encoder.line();
    }
    
    const totalVal = `Rs. ${(crateSum + chargesSum).toFixed(0)}`;
    const spaces = 48 - 'Total Invoice:'.length - totalVal.length;
    encoder.doubleSize(true).text(`Total Invoice:${' '.repeat(spaces > 0 ? spaces : 1)}${totalVal}`);
  }

  encoder.doubleSize(false).bold(false);
  encoder.feedLines(3);
  encoder.alignCenter().text('Thank you for your business!');
  encoder.text('Powered by Kisan Mitra');
  encoder.feedLines(4);
  encoder.cut();

  return encoder.getBuffer();
}
