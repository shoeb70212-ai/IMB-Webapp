import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateId } from '../db';
import { Lot } from '../types';
import { 
  ArrowLeft, Search, Package, TrendingUp
} from 'lucide-react';
import { printViaBrowser } from '../printing';

const ALL_COPIES_KEY = '__ALL_COPIES__';

export default function Lots() {
  // Database Queries
  const lots = useLiveQuery(() => db.lots.toArray()) || [];
  const crates = useLiveQuery(() => db.crates.toArray()) || [];
  const charges = useLiveQuery(() => db.charges.toArray()) || [];
  const settings = JSON.parse(localStorage.getItem('ca_settings') || '{}');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  
  // Detail Views Configuration
  const [selectedBuyerFilter, setSelectedBuyerFilter] = useState('');
  const [groupSimilar, setGroupSimilar] = useState(true);

  // Selected Lot Details
  const selectedLot = lots.find(l => l.id === selectedLotId) || null;

  // Filter Lots list
  const filteredLots = lots
    .filter(l => 
      l.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.seller_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.status.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => new Date(b.arrival_date).getTime() - new Date(a.arrival_date).getTime());

  // Data queries for active lot
  const activeCrates = selectedLotId ? crates.filter(c => c.lot_id === selectedLotId) : [];
  const activeCharges = selectedLotId ? charges.filter(c => c.lot_id === selectedLotId) : [];

  // Mark Lot Paid (Settles seller dues, records cashbook payout)
  const handleMarkPaid = async () => {
    if (!selectedLot) return;
    if (!window.confirm(`Are you sure you want to mark Lot #${selectedLot.id} as paid? This records a seller payment outflow of ₹${selectedLot.net_payable_to_seller.toLocaleString('en-IN')} in the Cashbook.`)) {
      return;
    }

    try {
      const dateIso = new Date().toISOString();
      const cashbookId = 'cb_' + generateId();

      await db.transaction('rw', [db.lots, db.cashbook], async () => {
        await db.lots.update(selectedLot.id, { status: 'paid' });
        await db.cashbook.add({
          id: cashbookId,
          date: dateIso,
          entry_type: 'payment',
          party_id: selectedLot.seller_id,
          party_name: selectedLot.seller_name,
          description: `Settle Lot #${selectedLot.id} (Gross: ₹${selectedLot.gross_sale_amount.toLocaleString('en-IN')})`,
          amount: selectedLot.net_payable_to_seller,
          mode: 'bank', // Default bank outflow for lots settlement
          lot_id: selectedLot.id
        });
      });
    } catch (err: any) {
      alert(err.message || 'Error updating lot payment status');
    }
  };

  // Get grouped or flat rows for printing/display
  const getDisplayRows = () => {
    const raw = activeCrates.filter(c => !selectedBuyerFilter || c.buyer_name === selectedBuyerFilter);
    
    if (!groupSimilar) {
      return raw.map((c, i) => ({
        id: `flat_${c.id}_${i}`,
        type: 'flat',
        fruit_type: c.fruit_type,
        quality_grade: c.quality_grade,
        qty: c.qty || 1,
        net_weight_kg: c.net_weight_kg,
        gross_weight_kg: c.gross_weight_kg,
        rate_per_kg: c.rate_per_kg,
        buyer_name: c.buyer_name,
        sale_amount: c.sale_amount
      }));
    }

    // Grouping logic
    const groups: Record<string, any> = {};
    raw.forEach(c => {
      const key = `${c.fruit_type}_${c.quality_grade}_${c.rate_per_kg}_${c.buyer_name || ''}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          fruit_type: c.fruit_type,
          quality_grade: c.quality_grade,
          rate_per_kg: c.rate_per_kg,
          buyer_name: c.buyer_name,
          total_qty: 0,
          total_net: 0,
          total_gross: 0,
          total_amount: 0
        };
      }
      groups[key].total_qty += (c.qty || 1);
      groups[key].total_net += (c.net_weight_kg || 0);
      groups[key].total_gross += (c.gross_weight_kg || 0);
      groups[key].total_amount += (c.sale_amount || 0);
    });

    return Object.values(groups).map(g => ({
      id: `group_${g.key}`,
      type: 'flat', // Render standard grouped format
      fruit_type: g.fruit_type,
      quality_grade: g.quality_grade,
      qty: g.total_qty,
      net_weight_kg: g.total_net,
      gross_weight_kg: g.total_gross,
      rate_per_kg: g.rate_per_kg,
      buyer_name: g.buyer_name,
      sale_amount: g.total_amount
    }));
  };

  // Commission made on this lot (charges with charge_type === 'commission')
  const totalCommission = activeCharges
    .filter(ch => (ch as any).charge_type === 'commission' || ch.notes?.toLowerCase().includes('commission'))
    .reduce((sum, ch) => sum + ch.amount, 0);

  // All unique buyers in this lot
  const uniqueBuyers = [...new Set(activeCrates.map(c => c.buyer_name).filter(Boolean))];

  // Helper: build A4 print HTML for seller copy
  const buildSellerPrintHtml = () => {
    const allRows = (() => {
      const raw = activeCrates;
      if (!groupSimilar) return raw.map((c, i) => ({ id: `flat_${c.id}_${i}`, fruit_type: c.fruit_type, quality_grade: c.quality_grade, qty: c.qty || 1, net_weight_kg: c.net_weight_kg, gross_weight_kg: c.gross_weight_kg, rate_per_kg: c.rate_per_kg, buyer_name: c.buyer_name, sale_amount: c.sale_amount }));
      const groups: Record<string, any> = {};
      raw.forEach(c => {
        const key = `${c.fruit_type}_${c.quality_grade}_${c.rate_per_kg}_${c.buyer_name || ''}`;
        if (!groups[key]) groups[key] = { key, fruit_type: c.fruit_type, quality_grade: c.quality_grade, rate_per_kg: c.rate_per_kg, buyer_name: c.buyer_name, total_qty: 0, total_net: 0, total_gross: 0, total_amount: 0 };
        groups[key].total_qty += (c.qty || 1); groups[key].total_net += (c.net_weight_kg || 0); groups[key].total_gross += (c.gross_weight_kg || 0); groups[key].total_amount += (c.sale_amount || 0);
      });
      return Object.values(groups).map(g => ({ id: `group_${g.key}`, fruit_type: g.fruit_type, quality_grade: g.quality_grade, qty: g.total_qty, net_weight_kg: g.total_net, gross_weight_kg: g.total_gross, rate_per_kg: g.rate_per_kg, buyer_name: g.buyer_name, sale_amount: g.total_amount }));
    })();
    const subtotal = allRows.reduce((s, r) => s + r.sale_amount, 0);
    const deductions = activeCharges.filter(ch => !ch.buyer_id);
    const totalDed = deductions.reduce((s, ch) => s + ch.amount, 0);
    const netSeller = subtotal - totalDed;
    return buildA4Html(allRows, deductions, [], subtotal, totalDed, netSeller, null);
  };

  // Helper: build A4 print HTML for a specific buyer
  const buildBuyerPrintHtml = (buyerName: string) => {
    const raw = activeCrates.filter(c => c.buyer_name === buyerName);
    const rows = (() => {
      if (!groupSimilar) return raw.map((c, i) => ({ id: `flat_${c.id}_${i}`, fruit_type: c.fruit_type, quality_grade: c.quality_grade, qty: c.qty || 1, net_weight_kg: c.net_weight_kg, gross_weight_kg: c.gross_weight_kg, rate_per_kg: c.rate_per_kg, buyer_name: c.buyer_name, sale_amount: c.sale_amount }));
      const groups: Record<string, any> = {};
      raw.forEach(c => {
        const key = `${c.fruit_type}_${c.quality_grade}_${c.rate_per_kg}`;
        if (!groups[key]) groups[key] = { key, fruit_type: c.fruit_type, quality_grade: c.quality_grade, rate_per_kg: c.rate_per_kg, buyer_name: buyerName, total_qty: 0, total_net: 0, total_gross: 0, total_amount: 0 };
        groups[key].total_qty += (c.qty || 1); groups[key].total_net += (c.net_weight_kg || 0); groups[key].total_gross += (c.gross_weight_kg || 0); groups[key].total_amount += (c.sale_amount || 0);
      });
      return Object.values(groups).map(g => ({ id: `group_${g.key}`, fruit_type: g.fruit_type, quality_grade: g.quality_grade, qty: g.total_qty, net_weight_kg: g.total_net, gross_weight_kg: g.total_gross, rate_per_kg: g.rate_per_kg, buyer_name: g.buyer_name, sale_amount: g.total_amount }));
    })();
    const subtotal = rows.reduce((s, r) => s + r.sale_amount, 0);
    const buyerCharges = activeCharges.filter(ch => ch.buyer_id && ch.buyer_name === buyerName);
    return buildA4Html(rows, [], buyerCharges, subtotal, 0, 0, buyerName);
  };

  // Core A4 HTML builder (shared by seller/buyer/combined)
  const buildA4Html = (rows: any[], deductions: any[], buyerCharges: any[], subtotal: number, totalDed: number, netSeller: number, buyerFilter: string | null) => {
    const totalBuyerAdd = buyerCharges.reduce((s: number, ch: any) => s + ch.amount, 0);
    return `
      <div class="print-container">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1e293b;padding-bottom:15px;margin-bottom:20px;">
          <div style="display:flex;align-items:center;gap:15px;">
            ${settings.business_logo ? `<img src="${settings.business_logo}" style="max-height:70px;max-width:120px;object-fit:contain;" />` : ''}
            <div>
              <h1 style="margin:0;font-family:'Outfit',sans-serif;font-size:22px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:-0.5px;">${settings.business_name || 'Kisan Trading Co.'}</h1>
              <p style="margin:4px 0 2px 0;font-size:13px;color:#475569;font-weight:500;">Prop: ${settings.owner_name || 'Mandi Agent'}</p>
              <p style="margin:2px 0;font-size:12px;color:#64748b;">${settings.address || 'Mandi Yard'}</p>
              <p style="margin:2px 0;font-size:12px;color:#64748b;"><strong>Phone:</strong> ${settings.phone || ''}</p>
            </div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 18px;min-width:250px;text-align:right;">
            <h2 style="margin:0 0 8px 0;font-family:'Outfit',sans-serif;font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;">${buyerFilter ? 'Buyer Invoice Slip' : 'Seller Settlement Memo'}</h2>
            <div style="font-size:12px;color:#475569;line-height:1.5;">
              <div><strong>Slip ID:</strong> <span class="print-monospace">${selectedLot!.id}</span></div>
              <div><strong>Date:</strong> <span class="print-monospace">${new Date(selectedLot!.arrival_date).toLocaleDateString()}</span></div>
              <div><strong>Status:</strong> <span style="text-transform:uppercase;font-weight:700;color:${selectedLot!.status === 'paid' ? '#16a34a' : '#ea580c'}">${selectedLot!.status}</span></div>
              <div><strong>Printed:</strong> <span class="print-monospace">${new Date().toLocaleDateString()}</span></div>
            </div>
          </div>
        </div>
        <div style="background:#f1f5f9;border-radius:6px;padding:10px 14px;margin-bottom:20px;font-size:13px;">
          ${buyerFilter ? `<strong>Buyer Client:</strong> ${buyerFilter}` : `<strong>Seller Client:</strong> ${selectedLot!.seller_name}`}
        </div>
        <table class="print-table" style="margin-bottom:20px;">
          <thead><tr>
            <th style="text-align:left;">Fruit/Grade</th>
            <th style="text-align:center;">Crates</th>
            <th style="text-align:center;">Weights (Net/Gross)</th>
            <th style="text-align:center;">Rate (/kg)</th>
            ${!buyerFilter ? '<th style="text-align:left;">Buyer</th>' : ''}
            <th style="text-align:right;">Amount</th>
          </tr></thead>
          <tbody>
            ${rows.map(r => `<tr>
              <td style="font-weight:600;color:#1e293b;">${r.fruit_type} <span style="color:#64748b;font-size:11px;">[${r.quality_grade}]</span></td>
              <td class="print-monospace" style="text-align:center;">${r.qty}</td>
              <td class="print-monospace" style="text-align:center;">${r.net_weight_kg.toFixed(1)} kg / ${r.gross_weight_kg.toFixed(1)} kg</td>
              <td class="print-monospace" style="text-align:center;">₹${r.rate_per_kg}</td>
              ${!buyerFilter ? `<td style="color:#475569;">${r.buyer_name || '—'}</td>` : ''}
              <td class="print-monospace" style="text-align:right;font-weight:700;color:#0f172a;">₹${r.sale_amount.toLocaleString('en-IN')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div style="display:flex;justify-content:flex-end;margin-bottom:30px;">
          <div style="width:320px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
            <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;border-bottom:1px dashed #cbd5e1;">
              <span style="color:#475569;">Gross Sale:</span>
              <strong class="print-monospace">₹${subtotal.toLocaleString('en-IN')}</strong>
            </div>
            ${!buyerFilter ? `
              <h4 style="margin:12px 0 6px 0;font-size:11px;color:#64748b;text-transform:uppercase;font-family:'Outfit',sans-serif;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">Deductions &amp; Commission</h4>
              ${deductions.map(ch => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;"><span style="color:#475569;">${ch.notes}:</span><span class="print-monospace" style="color:#dc2626;font-weight:500;">-₹${ch.amount.toLocaleString('en-IN')}</span></div>`).join('')}
              <div style="display:flex;justify-content:space-between;padding:8px 0;margin-top:8px;border-top:2px solid #0f172a;font-size:14px;font-weight:bold;">
                <span style="color:#0f172a;">Net Seller Payable:</span>
                <span class="print-monospace" style="color:#15803d;font-size:16px;">₹${netSeller.toLocaleString('en-IN')}</span>
              </div>
            ` : `
              <h4 style="margin:12px 0 6px 0;font-size:11px;color:#64748b;text-transform:uppercase;font-family:'Outfit',sans-serif;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">Charges &amp; Additions</h4>
              ${buyerCharges.map(ch => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;"><span style="color:#475569;">${ch.notes}:</span><span class="print-monospace" style="color:#0f172a;font-weight:500;">+₹${ch.amount.toLocaleString('en-IN')}</span></div>`).join('')}
              <div style="display:flex;justify-content:space-between;padding:8px 0;margin-top:8px;border-top:2px solid #0f172a;font-size:14px;font-weight:bold;">
                <span style="color:#0f172a;">Total Invoice Due:</span>
                <span class="print-monospace" style="color:#0f172a;font-size:16px;">₹${(subtotal + totalBuyerAdd).toLocaleString('en-IN')}</span>
              </div>
            `}
          </div>
        </div>
        <div class="print-signature-row">
          <div class="print-signature-box">Receiver Signature</div>
          <div class="print-signature-box">Authorized Agent</div>
        </div>
      </div>
    `;
  };

  // Compile print layout HTML
  const handlePrint = (type: 'a4' | 'receipt') => {
    if (!selectedLot) return;

    const displayRows = getDisplayRows();
    const subtotal = displayRows.reduce((sum, r) => sum + r.sale_amount, 0);

    // Filter charges
    const lotDeductions = activeCharges.filter(ch => !ch.buyer_id);
    const totalDeductions = lotDeductions.reduce((sum, ch) => sum + ch.amount, 0);
    const netSeller = subtotal - totalDeductions;

    const buyerAdditions = activeCharges.filter(ch => ch.buyer_id && (!selectedBuyerFilter || ch.buyer_name === selectedBuyerFilter));
    const totalBuyerAdditions = buyerAdditions.reduce((sum, ch) => sum + ch.amount, 0);

    // Combined view: print seller + all buyer copies with page breaks
    if (selectedBuyerFilter === ALL_COPIES_KEY && type === 'a4') {
      const sellerHtml = buildSellerPrintHtml();
      const buyerHtmls = uniqueBuyers.map(b => `<div class="print-page-break">${buildBuyerPrintHtml(b)}</div>`);
      const combined = [sellerHtml, ...buyerHtmls].join('\n');
      printViaBrowser(combined, 'a4');
      return;
    }

    let printHtml = '';

    if (type === 'a4') {
      printHtml = `
        <div class="print-container">
          <!-- Top section: Two-column layout -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e293b; padding-bottom: 15px; margin-bottom: 20px;">
            <!-- Left column: Company info -->
            <div style="display: flex; align-items: center; gap: 15px;">
              ${settings.business_logo ? `<img src="${settings.business_logo}" style="max-height: 70px; max-width: 120px; object-fit: contain;" />` : ''}
              <div>
                <h1 style="margin: 0; font-family: 'Outfit', sans-serif; font-size: 22px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">${settings.business_name || 'Kisan Trading Co.'}</h1>
                <p style="margin: 4px 0 2px 0; font-size: 13px; color: #475569; font-weight: 500;">Prop: ${settings.owner_name || 'Mandi Agent'}</p>
                <p style="margin: 2px 0; font-size: 12px; color: #64748b;">${settings.address || 'Mandi Yard'}</p>
                <p style="margin: 2px 0; font-size: 12px; color: #64748b;"><strong>Phone:</strong> ${settings.phone || ''}</p>
              </div>
            </div>
            <!-- Right column: Document details card -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 18px; min-width: 250px; text-align: right;">
              <h2 style="margin: 0 0 8px 0; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">
                ${selectedBuyerFilter ? 'Buyer Invoice Slip' : 'Seller Settlement Memo'}
              </h2>
              <div style="font-size: 12px; color: #475569; line-height: 1.5;">
                <div><strong>Slip ID:</strong> <span class="print-monospace">${selectedLot.id}</span></div>
                <div><strong>Date:</strong> <span class="print-monospace">${new Date(selectedLot.arrival_date).toLocaleDateString()}</span></div>
                <div><strong>Status:</strong> <span style="text-transform: uppercase; font-weight: 700; color: ${selectedLot.status === 'settled' ? '#16a34a' : '#ea580c'};">${selectedLot.status}</span></div>
                <div><strong>Printed:</strong> <span class="print-monospace">${new Date().toLocaleDateString()}</span></div>
              </div>
            </div>
          </div>

          <!-- Entity info (Seller or Buyer details) -->
          <div style="background: #f1f5f9; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; font-size: 13px;">
            ${selectedBuyerFilter ? `
              <strong>Buyer Client:</strong> ${selectedBuyerFilter}
            ` : `
              <strong>Seller Client:</strong> ${selectedLot.seller_name}
            `}
          </div>

          <!-- Items Table -->
          <table class="print-table" style="margin-bottom: 20px;">
            <thead>
              <tr>
                <th style="text-align: left;">Fruit/Grade</th>
                <th style="text-align: center;">Crates</th>
                <th style="text-align: center;">Weights (Net / Gross)</th>
                <th style="text-align: center;">Rate (/kg)</th>
                <th style="text-align: right;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${displayRows.map(r => `
                <tr>
                  <td style="font-weight: 600; color: #1e293b;">${r.fruit_type} <span style="color: #64748b; font-size: 11px;">[${r.quality_grade}]</span></td>
                  <td class="print-monospace" style="text-align: center;">${r.qty}</td>
                  <td class="print-monospace" style="text-align: center;">${r.net_weight_kg.toFixed(1)} kg / ${r.gross_weight_kg.toFixed(1)} kg</td>
                  <td class="print-monospace" style="text-align: center;">₹${r.rate_per_kg}</td>
                  <td class="print-monospace" style="text-align: right; font-weight: 700; color: #0f172a;">₹${r.sale_amount.toLocaleString('en-IN')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Summary block -->
          <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
            <div style="width: 320px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
              <div style="display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; border-bottom: 1px dashed #cbd5e1;">
                <span style="color: #475569;">Gross Sale:</span>
                <strong class="print-monospace">₹${subtotal.toLocaleString('en-IN')}</strong>
              </div>

              ${!selectedBuyerFilter ? `
                <!-- Seller Deductions -->
                <h4 style="margin: 12px 0 6px 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-family: 'Outfit', sans-serif; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Deductions & Commission</h4>
                ${lotDeductions.map(ch => `
                  <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px;">
                    <span style="color: #475569;">${ch.notes}:</span>
                    <span class="print-monospace" style="color: #dc2626; font-weight: 500;">-₹${ch.amount.toLocaleString('en-IN')}</span>
                  </div>
                `).join('')}
                <div style="display: flex; justify-content: space-between; padding: 8px 0; margin-top: 8px; border-top: 2px solid #0f172a; font-size: 14px; font-weight: bold;">
                  <span style="color: #0f172a;">Net Seller Payable:</span>
                  <span class="print-monospace" style="color: #15803d; font-size: 16px;">₹${netSeller.toLocaleString('en-IN')}</span>
                </div>
              ` : `
                <!-- Buyer Additions -->
                <h4 style="margin: 12px 0 6px 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-family: 'Outfit', sans-serif; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Charges & Additions</h4>
                ${buyerAdditions.map(ch => `
                  <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px;">
                    <span style="color: #475569;">${ch.notes}:</span>
                    <span class="print-monospace" style="color: #0f172a; font-weight: 500;">+₹${ch.amount.toLocaleString('en-IN')}</span>
                  </div>
                `).join('')}
                <div style="display: flex; justify-content: space-between; padding: 8px 0; margin-top: 8px; border-top: 2px solid #0f172a; font-size: 14px; font-weight: bold;">
                  <span style="color: #0f172a;">Total Invoice Due:</span>
                  <span class="print-monospace" style="color: #0f172a; font-size: 16px;">₹${(subtotal + totalBuyerAdditions).toLocaleString('en-IN')}</span>
                </div>
              `}
            </div>
          </div>

          <!-- Signatures -->
          <div class="print-signature-row" style="margin-top: 60px;">
            <div class="print-signature-box">Receiver Signature</div>
            <div class="print-signature-box">Authorized Agent</div>
          </div>
        </div>
      `;
    } else {
      // 80mm receipt
      printHtml = `
        <div class="print-container">
          <div style="text-align: center; border-bottom: 1px dashed #333; padding-bottom: 6px; margin-bottom: 10px;">
            ${settings.business_logo ? `<img src="${settings.business_logo}" style="display: block; margin: 0 auto 4px auto; max-height: 45px; object-fit: contain;" />` : ''}
            <h3 style="margin: 0; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 800; text-transform: uppercase;">${settings.business_name || 'Kisan Trading Co.'}</h3>
            <p style="margin: 2px 0; font-size: 9px; color: #555;">${settings.address || 'Mandi Yard'}</p>
            <p style="margin: 2px 0; font-size: 9px; color: #555;">Phone: ${settings.phone || ''}</p>
            <h4 style="margin: 6px 0 0 0; text-transform: uppercase; font-size: 10px; background: #eee; padding: 3px; font-weight: 700;">
              ${selectedBuyerFilter ? `BUYER INVOICE: ${selectedBuyerFilter}` : 'SELLER SETTLEMENT'}
            </h4>
          </div>

          <div style="font-size: 9px; line-height: 1.4; margin-bottom: 8px; display: flex; justify-content: space-between;">
            <div>
              ${selectedBuyerFilter ? `<strong>Buyer:</strong> ${selectedBuyerFilter}` : `<strong>Seller:</strong> ${selectedLot.seller_name}`}
              <br/><strong>Arrival:</strong> ${new Date(selectedLot.arrival_date).toLocaleDateString()}
            </div>
            <div style="text-align: right;">
              <strong>Slip:</strong> ${selectedLot.id}
              <br/><strong>Date:</strong> ${new Date().toLocaleDateString()}
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 8px; border-bottom: 1px dashed #333;">
            <thead>
              <tr style="border-bottom: 1px solid #333; font-weight: bold;">
                <th style="text-align: left; padding: 3px 0;">Item</th>
                <th style="text-align: center; padding: 3px 0;">Qty</th>
                <th style="text-align: center; padding: 3px 0;">Rate</th>
                <th style="text-align: right; padding: 3px 0;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${displayRows.map(r => `
                <tr style="border-bottom: 1px dotted #ddd;">
                  <td style="padding: 3px 0;">${r.fruit_type} [${r.quality_grade}]</td>
                  <td class="print-monospace" style="text-align: center; padding: 3px 0;">${r.qty} (${r.net_weight_kg.toFixed(0)}k)</td>
                  <td class="print-monospace" style="text-align: center; padding: 3px 0;">₹${r.rate_per_kg}</td>
                  <td class="print-monospace" style="text-align: right; padding: 3px 0; font-weight: bold;">₹${r.sale_amount.toFixed(0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="font-size: 9px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; padding: 2px 0;">
              <span>Gross Sale:</span>
              <span class="print-monospace" style="font-weight: bold;">₹${subtotal.toLocaleString('en-IN')}</span>
            </div>

            ${!selectedBuyerFilter ? `
              <!-- Seller Deductions -->
              ${lotDeductions.map(ch => `
                <div style="display: flex; justify-content: space-between; padding: 2px 0; color: #555;">
                  <span>${ch.notes}:</span>
                  <span class="print-monospace">-₹${ch.amount.toLocaleString('en-IN')}</span>
                </div>
              `).join('')}
              <div style="display: flex; justify-content: space-between; padding: 4px 0; margin-top: 3px; border-top: 1px solid #333; font-size: 11px; font-weight: bold;">
                <span>Net Payable:</span>
                <span class="print-monospace">₹${netSeller.toLocaleString('en-IN')}</span>
              </div>
            ` : `
              <!-- Buyer Additions -->
              ${buyerAdditions.map(ch => `
                <div style="display: flex; justify-content: space-between; padding: 2px 0; color: #555;">
                  <span>${ch.notes}:</span>
                  <span class="print-monospace">+₹${ch.amount.toLocaleString('en-IN')}</span>
                </div>
              `).join('')}
              <div style="display: flex; justify-content: space-between; padding: 4px 0; margin-top: 3px; border-top: 1px solid #333; font-size: 11px; font-weight: bold;">
                <span>Invoice Due:</span>
                <span class="print-monospace">₹${(subtotal + totalBuyerAdditions).toLocaleString('en-IN')}</span>
              </div>
            `}
          </div>

          <div style="margin-top: 25px; display: flex; justify-content: space-between; font-size: 8px;">
            <div style="border-top: 1px solid #333; width: 45%; text-align: center; padding-top: 3px;">Receiver Sign</div>
            <div style="border-top: 1px solid #333; width: 45%; text-align: center; padding-top: 3px;">Auth Agent</div>
          </div>
          
          <div style="text-align: center; margin-top: 15px; font-size: 7px; color: #777;">
            Thank you for your business!
            <br/>Powered by Kisan Mitra
          </div>
        </div>
      `;
    }

    printViaBrowser(printHtml, type);
  };

  return (
    <div className="flex-grow overflow-y-auto px-3.5 py-4 lg:p-6 pb-28 lg:pb-6 space-y-4 lg:space-y-6 animate-fade-in bg-slate-950 text-slate-200">
      {!selectedLotId ? (
        // LIST VIEW OF LOTS
        <>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 lg:gap-4">
            <div>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold tracking-tight text-white font-display">Arrival Lots</h1>
              <p className="text-slate-400 text-[11px] md:text-xs lg:text-sm mt-0.5 lg:mt-1">Browse, view settled auction details, pay sellers, and print memos.</p>
            </div>
            
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search lot, seller name or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-600 placeholder-slate-600"
              />
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            {filteredLots.length === 0 ? (
              <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center">
                <Package className="w-16 h-16 opacity-25 mb-4 text-blue-500" />
                <span className="font-bold text-slate-400">No arrival lots recorded</span>
                <p className="text-slate-500 text-xs mt-1">Add details inside the "New Lot" wizard tab.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-3.5 px-4">Lot ID</th>
                    <th className="py-3.5 px-4">Arrival Date</th>
                    <th className="py-3.5 px-4">Seller Name</th>
                    <th className="py-3.5 px-4 text-center">Crates</th>
                    <th className="py-3.5 px-4 text-right">Net Payable</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/50">
                  {filteredLots.map(l => (
                    <tr 
                      key={l.id} 
                      onClick={() => { setSelectedLotId(l.id); setSelectedBuyerFilter(''); }}
                      className="hover:bg-slate-800/15 transition duration-150 cursor-pointer"
                    >
                      <td className="py-4 px-4 font-mono font-bold text-blue-400 text-sm">{l.id}</td>
                      <td className="py-4 px-4 text-slate-350">
                        {new Date(l.arrival_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </td>
                      <td className="py-4 px-4 font-bold text-white text-sm">{l.seller_name}</td>
                      <td className="py-4 px-4 text-center font-bold font-mono text-emerald-400">{l.total_crates}</td>
                      <td className="py-4 px-4 text-right font-black font-mono text-sm text-white">
                        ₹{l.net_payable_to_seller.toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          l.status === 'paid' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' 
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/10'
                        }`}>
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Mobile Card Listing View */}
          <div className="md:hidden space-y-3">
            {filteredLots.length === 0 ? (
              <div className="py-12 glass-panel rounded-3xl text-center text-slate-500 flex flex-col items-center justify-center p-6">
                <Package className="w-12 h-12 opacity-25 mb-3 text-blue-500" />
                <span className="font-bold text-slate-400 text-sm">No arrival lots recorded</span>
                <p className="text-slate-500 text-xs mt-1">Add details inside the "New Lot" wizard tab.</p>
              </div>
            ) : (
              filteredLots.map(l => (
                <div 
                  key={l.id} 
                  onClick={() => { setSelectedLotId(l.id); setSelectedBuyerFilter(''); }}
                  className="glass-panel rounded-2xl p-3 lg:p-4 flex flex-col gap-2.5 cursor-pointer hover:border-blue-500/30 transition duration-200"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-blue-450 text-sm">{l.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      l.status === 'paid' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {l.status}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-end mt-1">
                    <div>
                      <h3 className="font-bold text-white text-sm">{l.seller_name}</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(l.arrival_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-450 font-mono">{l.total_crates} Crates</p>
                      <p className="text-sm font-black font-mono text-white mt-0.5">₹{l.net_payable_to_seller.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        // DETAILS VIEW
        <div className="max-w-5xl mx-auto glass-panel rounded-3xl p-4 sm:p-6 lg:p-8 shadow-2xl relative">
          {/* Back & Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800/80 pb-5 mb-6 gap-4">
            <button
              onClick={() => setSelectedLotId(null)}
              className="w-full sm:w-auto px-4 py-2 bg-slate-950 border border-slate-800 hover:bg-slate-900 hover:border-slate-700 text-slate-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to list</span>
            </button>

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {selectedLot && selectedLot.status === 'auctioned' && (
                <button
                  onClick={handleMarkPaid}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-lg transition"
                >
                  Mark Seller Paid
                </button>
              )}
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handlePrint('a4')}
                  className="px-4 py-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 text-xs font-bold rounded-xl cursor-pointer transition text-center"
                >
                  🖨️ A4 Statement
                </button>
                <button
                  onClick={() => handlePrint('receipt')}
                  className="px-4 py-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 text-xs font-bold rounded-xl cursor-pointer transition text-center"
                >
                  🖨️ Thermal Slip
                </button>
              </div>
            </div>
          </div>

          {selectedLot && (
            <div className="space-y-6">
              {/* Header profile (2x2 grid on mobile, 5 columns on desktop including commission) */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-slate-950/40 p-4 border border-slate-800/80 rounded-2xl">
                <div>
                  <span className="text-[9px] lg:text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block">Seller Name</span>
                  <span className="text-sm lg:text-base font-bold text-white mt-0.5 block truncate">{selectedLot.seller_name}</span>
                </div>
                <div>
                  <span className="text-[9px] lg:text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block">Arrival Date</span>
                  <span className="text-[11px] lg:text-xs text-slate-350 mt-0.5 block truncate">
                    {new Date(selectedLot.arrival_date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] lg:text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block">Lot Ref ID</span>
                  <span className="text-[11px] lg:text-xs font-mono font-bold text-blue-450 mt-0.5 block truncate">{selectedLot.id}</span>
                </div>
                <div>
                  <span className="text-[9px] lg:text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block">Payment Status</span>
                  <span className={`px-2 py-0.5 mt-1 inline-block rounded text-[9px] font-bold uppercase tracking-wider ${
                    selectedLot.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {selectedLot.status}
                  </span>
                </div>
                {/* Commission earned on this lot */}
                <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-2.5">
                  <span className="text-[9px] lg:text-[10px] text-amber-400/80 font-extrabold uppercase tracking-widest block">Commission Made</span>
                  <span className="text-sm lg:text-base font-black font-mono text-amber-400 mt-0.5 block">
                    {totalCommission > 0 ? `₹${totalCommission.toLocaleString('en-IN')}` : '—'}
                  </span>
                </div>
              </div>

              {/* Sub-Filters and Crate Summary Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <h3 className="font-bold text-white font-display text-sm">Crate Allocations</h3>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none bg-slate-950 border border-slate-800 px-2 py-1 rounded-lg">
                    <input 
                      type="checkbox" 
                      checked={groupSimilar} 
                      onChange={(e) => setGroupSimilar(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-850 text-blue-600 focus:ring-0 w-3 h-3" 
                    />
                    <span>Group Grades</span>
                  </label>
                </div>

                <select
                  value={selectedBuyerFilter}
                  onChange={(e) => setSelectedBuyerFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-350 outline-none w-full sm:w-auto"
                >
                  <option value="">All Buyers (Seller copy)</option>
                  <option value={ALL_COPIES_KEY}>✦ All Copies (Combined View)</option>
                  {[...new Set(activeCrates.map(c => c.buyer_name))].map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Desktop Crates Allocation Table — hidden in combined view */}
              {selectedBuyerFilter !== ALL_COPIES_KEY && (
              <>
              <div className="hidden md:block bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-450 border-b border-slate-850/60 font-bold uppercase text-[9px]">
                      <th className="py-2.5 px-4">Item Details</th>
                      <th className="py-2.5 px-4 text-center">Crates</th>
                      <th className="py-2.5 px-4 text-center">Weights (Net/Gross)</th>
                      <th className="py-2.5 px-4 text-center">Price Rate</th>
                      <th className="py-2.5 px-4" style={{ display: selectedBuyerFilter ? 'none' : 'table-cell' }}>Allocated Buyer</th>
                      <th className="py-2.5 px-4 text-right">Gross Sale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getDisplayRows().map((row) => (
                      <tr key={row.id} className="border-b border-slate-850/60 hover:bg-slate-850/15">
                        <td className="py-3 px-4 font-bold text-white flex items-center gap-1.5">
                          <span>{row.fruit_type}</span>
                          <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[9px] uppercase tracking-wide font-sans">{row.quality_grade}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-300">{row.qty}</td>
                        <td className="py-3 px-4 text-center text-slate-400 font-mono">
                          {row.net_weight_kg.toFixed(1)}kg <span className="text-slate-600">/</span> {row.gross_weight_kg.toFixed(1)}kg
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-300">₹{row.rate_per_kg}/kg</td>
                        <td className="py-3 px-4 font-semibold text-slate-200" style={{ display: selectedBuyerFilter ? 'none' : 'table-cell' }}>
                          {row.buyer_name}
                        </td>
                        <td className="py-3 px-4 text-right font-black font-mono text-white text-sm">
                          ₹{row.sale_amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Crates Allocation Cards */}
              <div className="md:hidden space-y-3">
                {getDisplayRows().map((row) => (
                  <div key={row.id} className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-sm">{row.fruit_type}</span>
                        <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[9px] uppercase tracking-wide font-sans">{row.quality_grade}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-350">{row.qty} Crates</span>
                    </div>
                    
                    <div className="flex justify-between items-end mt-1 text-xs">
                      <div>
                        {selectedBuyerFilter ? null : (
                          <div className="text-slate-400">
                            Buyer: <span className="font-semibold text-slate-200">{row.buyer_name}</span>
                          </div>
                        )}
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Rate: ₹{row.rate_per_kg}/kg ({row.net_weight_kg.toFixed(1)}kg Net)
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-black font-mono text-white">₹{row.sale_amount.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              </>
              )}

              {/* Combined View: Commission banner + all copies stacked */}
              {selectedBuyerFilter === ALL_COPIES_KEY && (
                <div className="space-y-6">
                  {/* Agent Commission Banner */}
                  <div className="flex items-center gap-3 bg-amber-500/8 border border-amber-500/25 rounded-2xl p-4">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-amber-400/70 font-bold uppercase tracking-widest">Agent Commission — This Lot</p>
                      <p className="text-xl font-black font-mono text-amber-400 mt-0.5">
                        {totalCommission > 0 ? `₹${totalCommission.toLocaleString('en-IN')}` : '₹0'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Gross Sale</p>
                      <p className="text-sm font-black font-mono text-white mt-0.5">₹{activeCrates.reduce((s, c) => s + c.sale_amount, 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  {/* Seller Copy Block */}
                  <div className="border border-slate-800/80 rounded-2xl overflow-hidden">
                    <div className="bg-slate-900 px-4 py-2.5 flex items-center gap-2 border-b border-slate-800/80">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Seller Copy — {selectedLot.seller_name}</span>
                    </div>
                    <div className="p-4">
                      <div className="hidden md:block bg-slate-900 border border-slate-850 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead><tr className="bg-slate-950 text-slate-450 border-b border-slate-850/60 font-bold uppercase text-[9px]">
                            <th className="py-2.5 px-4">Item</th><th className="py-2.5 px-4 text-center">Crates</th>
                            <th className="py-2.5 px-4 text-center">Weights</th><th className="py-2.5 px-4 text-center">Rate</th>
                            <th className="py-2.5 px-4">Buyer</th><th className="py-2.5 px-4 text-right">Sale</th>
                          </tr></thead>
                          <tbody>
                            {(() => {
                              const raw = activeCrates;
                              if (!groupSimilar) return raw.map((c, i) => (
                                <tr key={i} className="border-b border-slate-850/60">
                                  <td className="py-2.5 px-4 font-bold text-white">{c.fruit_type} <span className="text-blue-400 text-[9px]">{c.quality_grade}</span></td>
                                  <td className="py-2.5 px-4 text-center text-slate-300">{c.qty || 1}</td>
                                  <td className="py-2.5 px-4 text-center font-mono text-slate-400">{c.net_weight_kg.toFixed(1)}kg / {c.gross_weight_kg.toFixed(1)}kg</td>
                                  <td className="py-2.5 px-4 text-center font-mono text-slate-300">₹{c.rate_per_kg}/kg</td>
                                  <td className="py-2.5 px-4 text-slate-300">{c.buyer_name}</td>
                                  <td className="py-2.5 px-4 text-right font-black font-mono text-white">₹{c.sale_amount.toLocaleString('en-IN')}</td>
                                </tr>
                              ));
                              const groups: Record<string, any> = {};
                              raw.forEach(c => { const k = `${c.fruit_type}_${c.quality_grade}_${c.rate_per_kg}_${c.buyer_name}`; if (!groups[k]) groups[k] = { ...c, qty: 0, net_weight_kg: 0, gross_weight_kg: 0, sale_amount: 0 }; groups[k].qty += (c.qty||1); groups[k].net_weight_kg += c.net_weight_kg; groups[k].gross_weight_kg += c.gross_weight_kg; groups[k].sale_amount += c.sale_amount; });
                              return Object.values(groups).map((g, i) => (
                                <tr key={i} className="border-b border-slate-850/60">
                                  <td className="py-2.5 px-4 font-bold text-white">{g.fruit_type} <span className="text-blue-400 text-[9px]">{g.quality_grade}</span></td>
                                  <td className="py-2.5 px-4 text-center text-slate-300">{g.qty}</td>
                                  <td className="py-2.5 px-4 text-center font-mono text-slate-400">{g.net_weight_kg.toFixed(1)}kg / {g.gross_weight_kg.toFixed(1)}kg</td>
                                  <td className="py-2.5 px-4 text-center font-mono text-slate-300">₹{g.rate_per_kg}/kg</td>
                                  <td className="py-2.5 px-4 text-slate-300">{g.buyer_name}</td>
                                  <td className="py-2.5 px-4 text-right font-black font-mono text-white">₹{g.sale_amount.toLocaleString('en-IN')}</td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex justify-end mt-4">
                        <div className="w-full md:w-72 space-y-2 bg-slate-950/30 border border-slate-800/80 p-4 rounded-xl">
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>Gross Sales:</span>
                            <strong className="font-mono text-white">₹{activeCrates.reduce((s, c) => s + c.sale_amount, 0).toLocaleString('en-IN')}</strong>
                          </div>
                          <div className="border-t border-slate-800 pt-2">
                            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block mb-1">Seller Deductions</span>
                            {activeCharges.filter(ch => !ch.buyer_id).map(ch => (
                              <div key={ch.id} className="flex justify-between text-xs text-slate-400 py-0.5">
                                <span>{ch.notes}:</span>
                                <span className="text-rose-400 font-mono">-₹{ch.amount.toLocaleString('en-IN')}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-black text-white">
                            <span>Net Seller Payable:</span>
                            <span className="text-emerald-400 font-mono">₹{selectedLot.net_payable_to_seller.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Buyer Copy Blocks */}
                  {uniqueBuyers.map(buyerName => {
                    const buyerCrates = activeCrates.filter(c => c.buyer_name === buyerName);
                    const buyerCharges = activeCharges.filter(ch => ch.buyer_id && ch.buyer_name === buyerName);
                    const buyerGross = buyerCrates.reduce((s, c) => s + c.sale_amount, 0);
                    const buyerExtra = buyerCharges.reduce((s, ch) => s + ch.amount, 0);
                    return (
                      <div key={buyerName} className="border border-slate-800/80 rounded-2xl overflow-hidden">
                        <div className="bg-slate-900 px-4 py-2.5 flex items-center gap-2 border-b border-slate-800/80">
                          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Buyer Copy — {buyerName}</span>
                        </div>
                        <div className="p-4">
                          <div className="hidden md:block bg-slate-900 border border-slate-850 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead><tr className="bg-slate-950 text-slate-450 border-b border-slate-850/60 font-bold uppercase text-[9px]">
                                <th className="py-2.5 px-4">Item</th><th className="py-2.5 px-4 text-center">Crates</th>
                                <th className="py-2.5 px-4 text-center">Weights</th><th className="py-2.5 px-4 text-center">Rate</th>
                                <th className="py-2.5 px-4 text-right">Amount</th>
                              </tr></thead>
                              <tbody>
                                {buyerCrates.map((c, i) => (
                                  <tr key={i} className="border-b border-slate-850/60">
                                    <td className="py-2.5 px-4 font-bold text-white">{c.fruit_type} <span className="text-blue-400 text-[9px]">{c.quality_grade}</span></td>
                                    <td className="py-2.5 px-4 text-center text-slate-300">{c.qty || 1}</td>
                                    <td className="py-2.5 px-4 text-center font-mono text-slate-400">{c.net_weight_kg.toFixed(1)}kg / {c.gross_weight_kg.toFixed(1)}kg</td>
                                    <td className="py-2.5 px-4 text-center font-mono text-slate-300">₹{c.rate_per_kg}/kg</td>
                                    <td className="py-2.5 px-4 text-right font-black font-mono text-white">₹{c.sale_amount.toLocaleString('en-IN')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {/* Mobile buyer crate cards */}
                          <div className="md:hidden space-y-2 mb-3">
                            {buyerCrates.map((c, i) => (
                              <div key={i} className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex justify-between text-xs">
                                <div>
                                  <span className="font-bold text-white">{c.fruit_type}</span>
                                  <span className="ml-1.5 px-1 bg-blue-500/10 text-blue-400 rounded text-[9px]">{c.quality_grade}</span>
                                  <p className="text-slate-500 font-mono mt-0.5">{c.qty||1} crates · ₹{c.rate_per_kg}/kg · {c.net_weight_kg.toFixed(1)}kg</p>
                                </div>
                                <span className="font-black font-mono text-white">₹{c.sale_amount.toLocaleString('en-IN')}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-end mt-3">
                            <div className="w-full md:w-72 space-y-2 bg-slate-950/30 border border-slate-800/80 p-4 rounded-xl">
                              <div className="flex justify-between text-xs text-slate-400">
                                <span>Gross Sale:</span>
                                <strong className="font-mono text-white">₹{buyerGross.toLocaleString('en-IN')}</strong>
                              </div>
                              {buyerCharges.length > 0 && (
                                <div className="border-t border-slate-800 pt-2">
                                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mb-1">Additions</span>
                                  {buyerCharges.map(ch => (
                                    <div key={ch.id} className="flex justify-between text-xs text-slate-400 py-0.5">
                                      <span>{ch.notes}:</span>
                                      <span className="text-emerald-400 font-mono">+₹{ch.amount.toLocaleString('en-IN')}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-black text-white">
                                <span>Total Invoice Due:</span>
                                <span className="font-mono">₹{(buyerGross + buyerExtra).toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Standard Financial Deductions & Totals (non-combined view) */}
              {selectedBuyerFilter !== ALL_COPIES_KEY && (
              <div className="flex justify-end pt-4">
                <div className="w-full md:w-80 space-y-3 bg-slate-950/20 border border-slate-800/80 p-5 rounded-2xl">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Gross Sales:</span>
                    <strong className="text-white font-mono text-sm">₹{getDisplayRows().reduce((s, r) => s + r.sale_amount, 0).toLocaleString('en-IN')}</strong>
                  </div>

                  {!selectedBuyerFilter ? (
                    <>
                      <div className="border-t border-slate-800/85 my-2 pt-2">
                        <span className="text-[10px] text-rose-450 font-bold uppercase tracking-wider block mb-1.5">Seller Deductions & Fees</span>
                        {activeCharges.filter(ch => !ch.buyer_id).map(ch => (
                          <div key={ch.id} className="flex justify-between text-xs text-slate-400 py-1">
                            <span>{ch.notes}:</span>
                            <span className="text-rose-400 font-mono">-₹{ch.amount.toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-850 pt-3 text-sm font-black text-white">
                        <span>Net Seller Payable:</span>
                        <span className="text-emerald-450 font-mono text-base">
                          ₹{(selectedLot.net_payable_to_seller).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="border-t border-slate-800/85 my-2 pt-2">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mb-1.5">Buyer Additions & Surcharges</span>
                        {activeCharges.filter(ch => ch.buyer_id && ch.buyer_name === selectedBuyerFilter).map(ch => (
                          <div key={ch.id} className="flex justify-between text-xs text-slate-400 py-1">
                            <span>{ch.notes}:</span>
                            <span className="text-emerald-400 font-mono">+₹{ch.amount.toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-850 pt-3 text-sm font-black text-white">
                        <span>Total Invoice Bill:</span>
                        <span className="text-white font-mono text-base">
                          ₹{(
                            getDisplayRows().reduce((s, r) => s + r.sale_amount, 0) +
                            activeCharges.filter(ch => ch.buyer_id && ch.buyer_name === selectedBuyerFilter).reduce((s, ch) => s + ch.amount, 0)
                          ).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
