import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateId } from '../db';
import { Party, KhataEntry, PaymentMode } from '../types';
import { printViaBrowser } from '../printing';
import { Search, DollarSign, Printer, ArrowLeft, Plus, Check, X, Phone, ShieldAlert, FileText, Calendar, Trash2 } from 'lucide-react';

interface KhataLedgerProps {
  initialBuyer?: Party | null;
}

export default function KhataLedger({ initialBuyer = null }: KhataLedgerProps) {
  // Queries
  const parties = useLiveQuery(() => db.parties.toArray()) || [];
  const khata = useLiveQuery(() => db.khata.toArray()) || [];
  
  // Selected Buyer for detailed Ledger view
  const [selectedBuyer, setSelectedBuyer] = useState<Party | null>(initialBuyer);

  useEffect(() => {
    setSelectedBuyer(initialBuyer);
  }, [initialBuyer]);
  
  // Search query
  const [searchQuery, setSearchQuery] = useState('');
  
  // Payment Collection Modal State
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    mode: 'cash' as PaymentMode,
    desc: 'Payment Received'
  });
  const [payError, setPayError] = useState('');

  // Handle open payment modal
  const openPayModal = () => {
    if (!selectedBuyer) return;
    setPaymentForm({
      amount: '',
      mode: 'cash',
      desc: 'Payment Received'
    });
    setPayError('');
    setPayModalOpen(true);
  };

  // Submit Payment Received
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError('');

    if (!selectedBuyer) return;
    const amount = parseFloat(paymentForm.amount) || 0;
    if (amount <= 0) {
      setPayError('Please enter a valid amount');
      return;
    }

    const dateIso = new Date().toISOString();
    const mode = paymentForm.mode;
    const desc = paymentForm.desc.trim() || 'Payment Received';

    try {
      await db.transaction('rw', [db.parties, db.khata, db.cashbook], async () => {
        // Fetch fresh copy of buyer to prevent race conditions
        const freshBuyer = await db.parties.get(selectedBuyer.id);
        if (!freshBuyer) throw new Error('Buyer not found');

        const newOutstanding = freshBuyer.current_outstanding - amount;

        // 1. Update buyer outstanding balance
        await db.parties.update(selectedBuyer.id, {
          current_outstanding: newOutstanding
        });

        const khataTxId = 'k_' + generateId();
        // 2. Add entry to Khata Ledger
        await db.khata.add({
          id: khataTxId,
          buyer_id: selectedBuyer.id,
          buyer_name: selectedBuyer.name,
          transaction_type: 'payment_received',
          amount: amount,
          reference_note: `${desc} (${mode.toUpperCase()})`,
          date: dateIso,
          balance_after: newOutstanding
        });

        // 3. Log in Cashbook (receipt of cash inflow)
        await db.cashbook.add({
          id: 'cb_' + generateId(),
          date: dateIso,
          entry_type: 'receipt',
          party_id: selectedBuyer.id,
          party_name: selectedBuyer.name,
          description: `Khata Payment Received: ${desc}`,
          amount: amount,
          mode: mode,
          khata_tx_id: khataTxId
        });

        // Update local state for outstanding balance view
        setSelectedBuyer({
          ...selectedBuyer,
          current_outstanding: newOutstanding
        });
      });

      setPayModalOpen(false);
    } catch (err: any) {
      setPayError(err.message || 'Database error recording payment');
    }
  };

  // Print Statement Dispatcher
  const triggerPrintStatement = () => {
    if (!selectedBuyer) return;
    const settings = JSON.parse(localStorage.getItem('ca_settings') || '{}');
    
    // Sort chronological for ledger sheet progression
    const sortedTx = [...buyerTx].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const printHtml = `
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
              Khata Ledger Statement
            </h2>
            <div style="font-size: 12px; color: #475569; line-height: 1.5;">
              <div><strong>Statement Date:</strong> <span class="print-monospace">${new Date().toLocaleDateString()}</span></div>
              <div><strong>Outstanding:</strong> <span class="print-monospace" style="font-weight: 700; color: #dc2626;">₹${selectedBuyer.current_outstanding.toLocaleString('en-IN')}</span></div>
            </div>
          </div>
        </div>

        <!-- Buyer info block -->
        <div style="background: #f1f5f9; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; font-size: 13px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div>
            <strong>Customer Name:</strong> ${selectedBuyer.name}
          </div>
          <div>
            <strong>Phone:</strong> <span class="print-monospace">${selectedBuyer.phone || 'N/A'}</span>
          </div>
          <div>
            <strong>Credit Limit:</strong> <span class="print-monospace">₹${(selectedBuyer.credit_limit || 0).toLocaleString()}</span>
          </div>
        </div>

        <!-- Transactions Table -->
        <table class="print-table" style="margin-bottom: 25px;">
          <thead>
            <tr>
              <th style="text-align: left; width: 15%;">Date</th>
              <th style="text-align: left; width: 40%;">Description / Reference</th>
              <th style="text-align: right; width: 15%;">Debit (Sale)</th>
              <th style="text-align: right; width: 15%;">Credit (Recv)</th>
              <th style="text-align: right; width: 15%;">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${sortedTx.map(tx => {
              const isSale = tx.transaction_type === 'sale_credit';
              return `
                <tr>
                  <td class="print-monospace" style="color: #64748b;">${new Date(tx.date).toLocaleDateString()}</td>
                  <td style="color: #1e293b; font-weight: 500;">${tx.reference_note}</td>
                  <td class="print-monospace" style="text-align: right; color: ${isSale ? '#dc2626' : '#94a3b8'};">
                    ${isSale ? `₹${tx.amount.toLocaleString('en-IN')}` : '-'}
                  </td>
                  <td class="print-monospace" style="text-align: right; color: ${!isSale ? '#16a34a' : '#94a3b8'};">
                    ${!isSale ? `₹${tx.amount.toLocaleString('en-IN')}` : '-'}
                  </td>
                  <td class="print-monospace" style="text-align: right; font-weight: 700; color: #0f172a;">
                    ₹${tx.balance_after.toLocaleString('en-IN')}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- Signatures -->
        <div class="print-signature-row" style="margin-top: 50px;">
          <div class="print-signature-box">Customer Signature</div>
          <div class="print-signature-box">Authorized Agent</div>
        </div>
      </div>
    `;

    printViaBrowser(printHtml, 'a4');
  };

  // Keep selected buyer in sync with parties database updates
  useEffect(() => {
    if (selectedBuyer) {
      const updated = parties.find(p => p.id === selectedBuyer.id);
      if (updated && (updated.current_outstanding !== selectedBuyer.current_outstanding || updated.name !== selectedBuyer.name)) {
        setSelectedBuyer(updated);
      }
    }
  }, [parties, selectedBuyer]);

  const handleDeleteLedgerEntry = async (tx: KhataEntry) => {
    if (!window.confirm(`Are you sure you want to delete this ledger entry "${tx.reference_note}" for ₹${tx.amount.toLocaleString()}? This will also revert the corresponding cashbook transaction.`)) {
      return;
    }
    try {
      await db.khata.delete(tx.id);
    } catch (err: any) {
      alert(err.message || 'Error deleting ledger entry');
    }
  };

  // Filter buyers
  const buyersList = parties.filter(p => {
    if (p.type !== 'buyer') return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.phone && p.phone.includes(q))
    );
  });

  // Get selected buyer transactions
  const buyerTx = selectedBuyer
    ? khata
        .filter(x => x.buyer_id === selectedBuyer.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  return (
    <div className="flex-grow overflow-y-auto px-3.5 py-4 lg:p-6 pb-28 lg:pb-6 space-y-4 lg:space-y-6 animate-fade-in bg-slate-950 text-slate-200">
      {/* LEDGER DETAILS VIEW */}
      {selectedBuyer ? (
        <div className="space-y-6">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center no-print">
            <button
              onClick={() => setSelectedBuyer(null)}
              className="px-4 py-2 border border-slate-800 text-xs font-bold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-850 rounded-xl cursor-pointer flex items-center gap-1.5 transition duration-150"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Accounts</span>
            </button>
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={openPayModal}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10 transition duration-150"
              >
                <Plus className="w-4.5 h-4.5" />
                <span>Collect Payment</span>
              </button>
              <button
                onClick={triggerPrintStatement}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition duration-150"
              >
                <Printer className="w-4.5 h-4.5" />
                <span>Print Ledger</span>
              </button>
            </div>
          </div>

          {/* Statement Container (Printed output centers here) */}
          <div className="print-container bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl print-shadow-none print-border-none">
            {/* Print Brand header */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-white font-display uppercase">Khata Statement</h2>
                <p className="text-slate-400 text-xs mt-1">Transaction audit of client accounts.</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-blue-400 font-display block uppercase tracking-widest">Kisan Mitra</span>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{new Date().toLocaleDateString()}</span>
              </div>
            </div>

            {/* Client Detail Profile */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-950 p-5 rounded-2xl border border-slate-850">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Client Name</span>
                <h4 className="text-base font-bold text-white font-display">{selectedBuyer.name}</h4>
                <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
                  <Phone className="w-3.5 h-3.5 text-slate-600" />
                  <span className="font-mono">{selectedBuyer.phone || 'No phone'}</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Stall Address</span>
                <p className="text-sm text-slate-300 font-medium truncate">{selectedBuyer.address || 'Mandi Market, Area'}</p>
              </div>
              <div className="space-y-1 text-right md:text-left">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Outstanding Balance</span>
                <span className={`text-xl font-black font-mono block ${
                  selectedBuyer.current_outstanding > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  ₹{selectedBuyer.current_outstanding.toLocaleString('en-IN')}
                </span>
                <p className="text-[10px] text-slate-500 font-semibold mt-1">Credit Limit: ₹{selectedBuyer.credit_limit?.toLocaleString()}</p>
              </div>
            </div>

            {/* Ledger Transactions lists */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider block">Transaction History</h3>
              <div className="overflow-x-auto">
                {buyerTx.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-sm bg-slate-950 rounded-2xl border border-slate-850 border-dashed">
                    <FileText className="w-8 h-8 mb-2 opacity-30" />
                    <span>No transactions logged in this Khata</span>
                  </div>
                ) : (
                  <>
                    <table className="hidden lg:table w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Reference Note / Lot</th>
                          <th className="py-3 px-4 text-right">Debit (Sale)</th>
                          <th className="py-3 px-4 text-right">Credit (Received)</th>
                          <th className="py-3 px-4 text-right">Balance</th>
                          <th className="py-3 px-4 text-center no-print">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/60 font-mono text-xs">
                        {buyerTx.map(tx => {
                          const isSale = tx.transaction_type === 'sale_credit';
                          return (
                            <tr key={tx.id} className="hover:bg-slate-800/10">
                              <td className="py-3 px-4 text-slate-400">
                                {new Date(tx.date).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className="py-3 px-4 text-slate-200 font-sans font-medium">
                                {tx.reference_note}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-rose-400">
                                {isSale ? `₹${tx.amount.toLocaleString()}` : '-'}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-emerald-400">
                                {!isSale ? `₹${tx.amount.toLocaleString()}` : '-'}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-white">
                                ₹{tx.balance_after.toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-center no-print font-sans">
                                {tx.transaction_type !== 'sale_credit' && (
                                  <button
                                    onClick={() => handleDeleteLedgerEntry(tx)}
                                    className="p-1 hover:bg-slate-800 text-slate-500 hover:text-rose-450 rounded-lg cursor-pointer transition-colors"
                                    title="Delete Entry"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Mobile Card List */}
                    <div className="lg:hidden space-y-3 font-sans">
                      {buyerTx.map(tx => {
                        const isSale = tx.transaction_type === 'sale_credit';
                        return (
                          <div key={tx.id} className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(tx.date).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  isSale 
                                    ? 'bg-rose-500/10 text-rose-400' 
                                    : 'bg-emerald-500/10 text-emerald-400'
                                }}`}>
                                  {isSale ? 'Debit (Sale)' : 'Credit (Recv)'}
                                </span>
                                {tx.transaction_type !== 'sale_credit' && (
                                  <button
                                    onClick={() => handleDeleteLedgerEntry(tx)}
                                    className="p-1 hover:bg-slate-800 text-slate-500 hover:text-rose-455 rounded-lg cursor-pointer transition-colors"
                                    title="Delete Entry"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="text-sm font-semibold text-slate-200">
                              {tx.reference_note}
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-850/50 mt-1">
                              <div>
                                <span className="text-[10px] text-slate-500 block uppercase font-bold">Amount</span>
                                <span className={`text-sm font-extrabold font-mono ${
                                  isSale ? 'text-rose-400' : 'text-emerald-400'
                                }`}>
                                  ₹{tx.amount.toLocaleString()}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-slate-500 block uppercase font-bold">Balance</span>
                                <span className="text-sm font-bold font-mono text-white">
                                  ₹{tx.balance_after.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* DIRECTORY LIST OF BUYERS */
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-display">Khata Ledger</h1>
            <p className="text-slate-400 text-sm mt-1">Manage buyer outstanding credit and collections.</p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-[350px]">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search buyer name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 placeholder-slate-500"
            />
          </div>

          {/* Directory list */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {buyersList.length === 0 ? (
              <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
                <Search className="w-12 h-12 mb-3 opacity-30" />
                <span className="font-semibold text-slate-400">No buyers matching search</span>
              </div>
            ) : (
              buyersList.map(b => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBuyer(b)}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition duration-200 cursor-pointer flex justify-between items-center group relative overflow-hidden"
                >
                  <div className="truncate max-w-[65%]">
                    <h3 className="text-base font-bold text-white truncate font-display group-hover:text-blue-400 transition-colors">
                      {b.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 font-mono">{b.phone || 'No phone'}</p>
                    <span className="text-[10px] text-slate-600 block mt-2">Limit: ₹{b.credit_limit?.toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 block uppercase font-bold">Outstanding</span>
                    <span className={`text-base font-extrabold font-mono ${
                      b.current_outstanding > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      ₹{b.current_outstanding.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[9px] text-blue-400 font-bold block mt-1 uppercase group-hover:translate-x-1 transition-transform">
                      Statement &rarr;
                    </span>
                  </div>
                  {b.credit_limit && b.current_outstanding > b.credit_limit && (
                    <div className="absolute right-3.5 top-3.5 text-rose-500 animate-pulse">
                      <ShieldAlert className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* COLLECT PAYMENT MODAL */}
      {payModalOpen && selectedBuyer && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl lg:rounded-3xl w-full lg:max-w-md overflow-hidden shadow-2xl animate-fade-in mobile-bottom-sheet lg:relative">
            {/* Mobile Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto my-3 block lg:hidden" />
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-850 lg:pt-4 pt-1">
              <div>
                <h3 className="text-base font-bold text-white font-display">Collect Khata Payment</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Collect credit from: {selectedBuyer.name}</p>
              </div>
              <button
                onClick={() => setPayModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
              {payError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
                  <span>{payError}</span>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Payment Amount (₹)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Current outstanding: ₹{selectedBuyer.current_outstanding.toLocaleString()}</span>
              </div>

              {/* Mode */}
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1.5">Collection Mode</label>
                <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1 border border-slate-800 rounded-xl">
                  {(['cash', 'upi', 'bank'] as PaymentMode[]).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentForm(prev => ({ ...prev, mode }))}
                      className={`py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer ${
                        paymentForm.mode === mode
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Receipt Note / Description</label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={paymentForm.desc}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, desc: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 placeholder-slate-650"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-500/10"
                >
                  <Check className="w-4.5 h-4.5" />
                  <span>Receive Cash</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
