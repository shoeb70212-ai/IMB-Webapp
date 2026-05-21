import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateId, DEFAULT_BUSINESS_SETTINGS } from '../db';
import { CashbookEntry, PaymentMode } from '../types';
import { printViaBrowser } from '../printing';
import { 
  Plus, Search, Calendar, Check, X, ShieldAlert, 
  ArrowDownLeft, ArrowUpRight, BookOpen, Trash2, 
  Users, Briefcase, FileText, Printer 
} from 'lucide-react';

export default function Cashbook() {
  // Queries
  const cashbook = useLiveQuery(() => db.cashbook.toArray()) || [];
  const parties = useLiveQuery(() => db.parties.toArray()) || [];
  const labourList = useLiveQuery(() => db.labourList.toArray()) || [];
  const lots = useLiveQuery(() => db.lots.toArray()) || [];

  // Filter state (defaults to today's date)
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState<'general' | 'seller' | 'labour' | 'buyer'>('general');
  const [selectedSellerId, setSelectedSellerId] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [selectedLabourId, setSelectedLabourId] = useState('');
  const [selectedBuyerId, setSelectedBuyerId] = useState('');
  
  const [formData, setFormData] = useState({
    entry_type: 'receipt' as 'receipt' | 'payment',
    party_name: '',
    amount: '',
    mode: 'cash' as PaymentMode,
    description: ''
  });
  const [formError, setFormError] = useState('');

  // Derived filter sets
  const sellers = parties.filter(p => p.type === 'seller' && !p.archived);
  const buyers = parties.filter(p => p.type === 'buyer' && !p.archived);

  // Handle open modal
  const openModal = () => {
    setCategory('general');
    setSelectedSellerId('');
    setSelectedLotId('');
    setSelectedLabourId('');
    setSelectedBuyerId('');
    setFormData({
      entry_type: 'receipt',
      party_name: '',
      amount: '',
      mode: 'cash',
      description: ''
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleCategoryChange = (cat: 'general' | 'seller' | 'labour' | 'buyer') => {
    setCategory(cat);
    setFormError('');
    setSelectedSellerId('');
    setSelectedLotId('');
    setSelectedLabourId('');
    setSelectedBuyerId('');
    
    if (cat === 'seller' || cat === 'labour') {
      setFormData(prev => ({
        ...prev,
        entry_type: 'payment',
        party_name: '',
        amount: '',
        description: cat === 'seller' ? 'Seller settlement' : 'Wages Payout'
      }));
    } else if (cat === 'buyer') {
      setFormData(prev => ({
        ...prev,
        entry_type: 'receipt',
        party_name: '',
        amount: '',
        description: 'Payment Received'
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        entry_type: 'receipt',
        party_name: '',
        amount: '',
        description: ''
      }));
    }
  };

  const handleSellerChange = (sellerId: string) => {
    setSelectedSellerId(sellerId);
    setSelectedLotId('');
    const seller = parties.find(p => p.id === sellerId);
    setFormData(prev => ({
      ...prev,
      party_name: seller ? seller.name : '',
      amount: '',
      description: seller ? `Seller settlement: ${seller.name}` : 'Seller settlement'
    }));
  };

  const handleLotChange = (lotId: string) => {
    setSelectedLotId(lotId);
    const lot = lots.find(l => l.id === lotId);
    if (lot) {
      setFormData(prev => ({
        ...prev,
        amount: lot.net_payable_to_seller.toString(),
        description: `Settle Lot #${lot.id} (Gross: ₹${lot.gross_sale_amount.toLocaleString('en-IN')})`
      }));
    }
  };

  const handleLabourChange = (workerId: string) => {
    setSelectedLabourId(workerId);
    const worker = labourList.find(w => w.id === workerId);
    if (worker) {
      setFormData(prev => ({
        ...prev,
        party_name: worker.name,
        amount: worker.current_balance > 0 ? worker.current_balance.toString() : '',
        description: `Wages Payout - ${worker.name}`
      }));
    }
  };

  const handleBuyerChange = (buyerId: string) => {
    setSelectedBuyerId(buyerId);
    const buyer = parties.find(p => p.id === buyerId);
    if (buyer) {
      setFormData(prev => ({
        ...prev,
        party_name: buyer.name,
        amount: buyer.current_outstanding > 0 ? buyer.current_outstanding.toString() : '',
        description: `Khata Payment - ${buyer.name}`
      }));
    }
  };

  // Submit manual cashbook entry
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const amount = parseFloat(formData.amount) || 0;
    const description = formData.description.trim();

    if (amount <= 0) {
      setFormError('Please enter a valid amount');
      return;
    }
    if (!description) {
      setFormError('Please enter a description');
      return;
    }

    try {
      if (category === 'seller') {
        if (!selectedSellerId) {
          setFormError('Please select a seller');
          return;
        }
        if (!selectedLotId) {
          setFormError('Please select a lot to pay');
          return;
        }
        const lot = lots.find(l => l.id === selectedLotId);
        if (!lot) {
          setFormError('Selected lot not found');
          return;
        }

        await db.transaction('rw', [db.lots, db.cashbook], async () => {
          await db.lots.update(lot.id, { status: 'paid' });
          await db.cashbook.add({
            id: 'cb_' + generateId(),
            date: new Date().toISOString(),
            entry_type: 'payment',
            party_id: lot.seller_id,
            party_name: lot.seller_name,
            description,
            amount,
            mode: formData.mode,
            lot_id: lot.id
          });
        });
      } else if (category === 'labour') {
        if (!selectedLabourId) {
          setFormError('Please select a labour worker');
          return;
        }
        const worker = labourList.find(w => w.id === selectedLabourId);
        if (!worker) {
          setFormError('Selected worker not found');
          return;
        }

        const txId = 'lt_' + generateId();
        const cashbookId = 'cb_' + generateId();
        const dateIso = new Date().toISOString();

        await db.transaction('rw', [db.labourList, db.labourTransactions, db.cashbook], async () => {
          await db.labourTransactions.add({
            id: txId,
            labour_id: worker.id,
            date: dateIso,
            type: 'payment',
            description,
            amount,
            mode: formData.mode
          });

          await db.labourList.update(worker.id, {
            current_balance: worker.current_balance - amount
          });

          await db.cashbook.add({
            id: cashbookId,
            date: dateIso,
            entry_type: 'payment',
            party_id: worker.id,
            party_name: worker.name,
            description,
            amount,
            mode: formData.mode,
            labour_tx_id: txId
          });
        });
      } else if (category === 'buyer') {
        if (!selectedBuyerId) {
          setFormError('Please select a buyer');
          return;
        }
        const buyer = parties.find(p => p.id === selectedBuyerId);
        if (!buyer) {
          setFormError('Selected buyer not found');
          return;
        }

        const khataTxId = 'k_' + generateId();
        const dateIso = new Date().toISOString();
        const newOutstanding = buyer.current_outstanding - amount;

        await db.transaction('rw', [db.parties, db.khata, db.cashbook], async () => {
          await db.parties.update(buyer.id, {
            current_outstanding: newOutstanding
          });

          await db.khata.add({
            id: khataTxId,
            buyer_id: buyer.id,
            buyer_name: buyer.name,
            transaction_type: 'payment_received',
            amount,
            reference_note: `${description} (${formData.mode.toUpperCase()})`,
            date: dateIso,
            balance_after: newOutstanding
          });

          await db.cashbook.add({
            id: 'cb_' + generateId(),
            date: dateIso,
            entry_type: 'receipt',
            party_id: buyer.id,
            party_name: buyer.name,
            description,
            amount,
            mode: formData.mode,
            khata_tx_id: khataTxId
          });
        });
      } else {
        // General entry
        const partyName = formData.party_name.trim() || 'Miscellaneous';
        await db.cashbook.add({
          id: 'cb_' + generateId(),
          date: new Date().toISOString(),
          entry_type: formData.entry_type,
          party_name: partyName,
          description,
          amount,
          mode: formData.mode
        });
      }

      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Database error logging entry');
    }
  };

  const handleDeleteEntry = async (entry: CashbookEntry) => {
    if (!window.confirm(`Are you sure you want to delete this cashbook entry for "${entry.party_name}" of ₹${entry.amount.toLocaleString()}? This will also cascade-delete any corresponding Khata or Labour records.`)) {
      return;
    }
    try {
      await db.cashbook.delete(entry.id);
    } catch (err: any) {
      alert(err.message || 'Error deleting cashbook entry');
    }
  };

  // Filter entries based on date
  const filteredEntries = cashbook
    .filter(e => e.date.startsWith(filterDate))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Aggregate stats for filtered date
  const dailyReceipts = filteredEntries
    .filter(e => e.entry_type === 'receipt')
    .reduce((sum, e) => sum + e.amount, 0);

  const dailyPayments = filteredEntries
    .filter(e => e.entry_type === 'payment')
    .reduce((sum, e) => sum + e.amount, 0);

  const dailyNet = dailyReceipts - dailyPayments;

  // Print Daily Cashbook Register Dispatcher
  const triggerPrintCashbook = () => {
    const settings = JSON.parse(localStorage.getItem('ca_settings') || '{}');
    
    const printHtml = `
      <div class="print-container print-border-frame" style="padding: 20px 24px; position: relative;">
        <!-- Top section: Two-column layout -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e293b; padding-bottom: 15px; margin-bottom: 20px;">
          <!-- Left column: Company info -->
          <div style="display: flex; align-items: center; gap: 15px;">
            ${settings.business_logo ? `<img src="${settings.business_logo}" style="max-height: 70px; max-width: 120px; object-fit: contain;" />` : ''}
            <div>
              <h1 style="margin: 0; font-family: 'Outfit', sans-serif; font-size: 22px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">${settings.business_name || DEFAULT_BUSINESS_SETTINGS.business_name}</h1>
              <p style="margin: 4px 0 2px 0; font-size: 13px; color: #475569; font-weight: 500;">Prop: ${settings.owner_name || DEFAULT_BUSINESS_SETTINGS.owner_name}</p>
              <p style="margin: 2px 0; font-size: 12px; color: #64748b;">${settings.address || DEFAULT_BUSINESS_SETTINGS.address}</p>
              <p style="margin: 2px 0; font-size: 12px; color: #64748b;"><strong>Phone:</strong> ${settings.phone || DEFAULT_BUSINESS_SETTINGS.phone}</p>
            </div>
          </div>
          <!-- Right column: Document details card -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 18px; min-width: 250px; text-align: right;">
            <h2 style="margin: 0 0 8px 0; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">
              Cash Drawer Register
            </h2>
            <div style="font-size: 12px; color: #475569; line-height: 1.5;">
              <div><strong>Selected Date:</strong> <span class="print-monospace">${new Date(filterDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span></div>
              <div><strong>Daily Inflow:</strong> <span class="print-monospace" style="font-weight: 700; color: #16a34a;">+₹${dailyReceipts.toLocaleString('en-IN')}</span></div>
              <div><strong>Daily Outflow:</strong> <span class="print-monospace" style="font-weight: 700; color: #dc2626;">-₹${dailyPayments.toLocaleString('en-IN')}</span></div>
              <div style="border-top: 1px solid #e2e8f0; margin-top: 4px; padding-top: 4px;"><strong>Net drawer balance:</strong> <span class="print-monospace" style="font-weight: 800; color: ${dailyNet >= 0 ? '#1e293b' : '#dc2626'}">${dailyNet >= 0 ? '+' : ''}₹${dailyNet.toLocaleString('en-IN')}</span></div>
            </div>
          </div>
        </div>

        <h3 style="font-size: 14px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 10px 0;">Cashbook Entries</h3>
        
        ${filteredEntries.length === 0 ? `
          <div style="padding: 40px; text-align: center; color: #64748b; border: 1px dashed #cbd5e1; border-radius: 8px;">
            No cashbook transactions recorded for this date.
          </div>
        ` : `
          <table class="print-table">
            <thead>
              <tr>
                <th style="text-align: left; width: 15%;">Time</th>
                <th style="text-align: left; width: 25%;">Party/Worker</th>
                <th style="text-align: left; width: 35%;">Description / Reference</th>
                <th style="text-align: center; width: 10%;">Mode</th>
                <th style="text-align: right; width: 15%;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${filteredEntries.map(e => `
                <tr>
                  <td class="print-monospace" style="color: #475569;">
                    ${new Date(e.date).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </td>
                  <td style="font-weight: 600; color: #0f172a;">${e.party_name}</td>
                  <td style="color: #334155;">${e.description}</td>
                  <td class="print-monospace" style="text-align: center; text-transform: uppercase; font-weight: 600; color: #475569;">
                    ${e.mode}
                  </td>
                  <td class="print-monospace" style="text-align: right; font-weight: 700; color: ${e.entry_type === 'receipt' ? '#16a34a' : '#dc2626'}">
                    ${e.entry_type === 'receipt' ? '+' : '-'}₹${e.amount.toLocaleString('en-IN')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}

        <!-- Bottom section: Signatures -->
        <div class="print-signature-row">
          <div class="print-signature-box">
            Authorized Agent Signature
          </div>
          <div class="print-signature-box">
            Accountant / Clerk Signature
          </div>
        </div>
      </div>
    `;
    printViaBrowser(printHtml, 'a4');
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'general': return <FileText className="w-3.5 h-3.5" />;
      case 'seller': return <Users className="w-3.5 h-3.5" />;
      case 'labour': return <Briefcase className="w-3.5 h-3.5" />;
      case 'buyer': return <Users className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  return (
    <div className="flex-grow overflow-y-auto px-4 py-5 lg:p-6 pb-28 lg:pb-6 space-y-5 lg:space-y-6 animate-fade-in text-slate-205 relative">
      {/* Background ambient glowing mesh details */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-blue-500/5 blur-3xl rounded-full pointer-events-none -z-10"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none -z-10"></div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white font-display uppercase">Cashbook</h1>
          <p className="text-slate-455 text-xs lg:text-sm mt-1">Chronological registers of daily cash drawer flows.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button 
            onClick={triggerPrintCashbook}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 text-slate-350 font-bold text-xs lg:text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer hover-lift transition-all"
            title="Print Cash Register Log"
          >
            <Printer className="w-4 h-4 lg:w-4.5 lg:h-4.5" />
            <span>Print Register</span>
          </button>
          <button 
            onClick={openModal}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs lg:text-sm font-extrabold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-950/20 hover-lift border border-blue-500/25 transition-all"
          >
            <Plus className="w-4 h-4 lg:w-5 lg:h-5" />
            <span>New Entry</span>
          </button>
        </div>
      </div>

      {/* Date filter & summaries */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        {/* Date Selector */}
        <div className="glass-panel border border-slate-800/60 rounded-2xl p-4 flex flex-col justify-center shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-slate-500/5 blur-xl rounded-full"></div>
          <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-2 relative z-10">Filter Date</label>
          <div className="relative z-10">
            <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-slate-950/80 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 font-mono"
            />
          </div>
        </div>

        {/* Daily Cash In */}
        <div className="glass-panel border border-slate-800/60 rounded-2xl p-4 flex items-center justify-between shadow-lg glow-emerald hover-lift relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 blur-xl rounded-full"></div>
          <div className="relative z-10">
            <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-widest block">Total Inflow</span>
            <h4 className="text-lg lg:text-xl font-black text-emerald-450 font-mono mt-1">+₹{dailyReceipts.toLocaleString('en-IN')}</h4>
          </div>
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl relative z-10">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        {/* Daily Cash Out */}
        <div className="glass-panel border border-slate-800/60 rounded-2xl p-4 flex items-center justify-between shadow-lg glow-rose hover-lift relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/5 blur-xl rounded-full"></div>
          <div className="relative z-10">
            <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-widest block">Total Outflow</span>
            <h4 className="text-lg lg:text-xl font-black text-rose-455 font-mono mt-1">-₹{dailyPayments.toLocaleString('en-IN')}</h4>
          </div>
          <div className="p-2.5 bg-rose-500/10 text-rose-450 rounded-xl relative z-10">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        {/* Net Daily Balance */}
        <div className={`glass-panel border border-slate-800/60 rounded-2xl p-4 flex items-center justify-between shadow-lg hover-lift relative overflow-hidden ${
          dailyNet >= 0 ? 'glow-blue' : 'glow-rose'
        }`}>
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 blur-xl rounded-full"></div>
          <div className="relative z-10">
            <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-widest block">Daily Net Drawer</span>
            <h4 className={`text-lg lg:text-xl font-black font-mono mt-1 ${
              dailyNet >= 0 ? 'text-white' : 'text-rose-400'
            }`}>
              {dailyNet >= 0 ? '+' : ''}₹{dailyNet.toLocaleString('en-IN')}
            </h4>
          </div>
          <div className={`p-2.5 rounded-xl relative z-10 ${
            dailyNet >= 0 ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'
          }`}>
            <BookOpen className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Cash register table */}
      <div className="glass-panel border border-slate-800/60 rounded-3xl p-5 md:p-6 shadow-2xl relative overflow-hidden">
        {/* Ambient background glow mesh inside table card */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none"></div>

        <h3 className="text-sm lg:text-base font-bold text-white font-display uppercase tracking-wider mb-4 relative z-10">
          Cash Drawer Log for {new Date(filterDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
        </h3>

        <div className="overflow-x-auto relative z-10">
          {filteredEntries.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-550 bg-slate-950/40 rounded-2xl border border-slate-850 border-dashed">
              <BookOpen className="w-12 h-12 mb-3 opacity-30 text-blue-550 animate-pulse-slow" />
              <span className="font-bold text-slate-400">No cash entries logged for this date</span>
              <p className="text-slate-500 text-xs mt-1">Select another date or add a manual cash ledger entry.</p>
            </div>
          ) : (
            <>
              <table className="hidden lg:table w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 bg-slate-950/80 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-5">Time</th>
                    <th className="py-3.5 px-5">Party/Worker</th>
                    <th className="py-3.5 px-5">Description / Reference</th>
                    <th className="py-3.5 px-5 text-center">Mode</th>
                    <th className="py-3.5 px-5 text-center">Flow</th>
                    <th className="py-3.5 px-5 text-right">Amount</th>
                    <th className="py-3.5 px-5 text-center no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/40 font-sans text-xs">
                  {filteredEntries.map(e => (
                    <tr key={e.id} className="hover:bg-slate-800/25 transition-all duration-150 border-b border-slate-850/20 last:border-0">
                      <td className="py-3.5 px-5 text-slate-450 font-mono">
                        {new Date(e.date).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true
                        })}
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-white truncate max-w-[140px]">{e.party_name}</td>
                      <td className="py-3.5 px-5 text-slate-300 font-medium">{e.description}</td>
                      <td className="py-3.5 px-5 text-center font-bold text-slate-400 uppercase tracking-wider font-mono text-[10px]">
                        {e.mode}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase font-extrabold tracking-wider ${
                          e.entry_type === 'receipt' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/15'
                        }`}>
                          {e.entry_type === 'receipt' ? 'Inflow' : 'Outflow'}
                        </span>
                      </td>
                      <td className={`py-3.5 px-5 text-right font-black font-mono text-sm ${
                        e.entry_type === 'receipt' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {e.entry_type === 'receipt' ? '+' : '-'}₹{e.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-5 text-center no-print">
                        <button
                          onClick={() => handleDeleteEntry(e)}
                          className="p-1.5 hover:bg-slate-800 text-slate-550 hover:text-rose-455 rounded-lg cursor-pointer transition-colors"
                          title="Delete Entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Card List */}
              <div className="lg:hidden space-y-3 font-sans">
                {filteredEntries.map(e => (
                  <div key={e.id} className="p-4 bg-slate-950/40 border border-slate-850/80 rounded-2xl flex flex-col gap-2 shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-slate-500/5 blur-md rounded-full"></div>
                    <div className="flex justify-between items-center relative z-10">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(e.date).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-extrabold tracking-wider ${
                          e.entry_type === 'receipt' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/10'
                        }`}>
                          {e.entry_type === 'receipt' ? 'Inflow' : 'Outflow'}
                        </span>
                        <button
                          onClick={() => handleDeleteEntry(e)}
                          className="p-1 hover:bg-slate-850 text-slate-500 hover:text-rose-455 rounded-lg cursor-pointer transition-colors"
                          title="Delete Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-white relative z-10">
                      {e.party_name}
                    </div>
                    <p className="text-[11px] text-slate-350 leading-relaxed relative z-10">{e.description}</p>
                    <div className="flex justify-between items-end pt-2.5 border-t border-slate-850/50 mt-1 relative z-10">
                      <div>
                        <span className="text-[8px] text-slate-500 block uppercase font-bold tracking-wider">Mode</span>
                        <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider font-mono">{e.mode}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-black font-mono ${
                          e.entry_type === 'receipt' ? 'text-emerald-450' : 'text-rose-455'
                        }`}>
                          {e.entry_type === 'receipt' ? '+' : '-'}₹{e.amount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* CREATE MANUAL ENTRY MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800/80 rounded-t-3xl lg:rounded-3xl w-full lg:max-w-md overflow-hidden shadow-2xl animate-fade-in mobile-bottom-sheet lg:relative">
            {/* Mobile Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto my-3 block lg:hidden" />
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-850 lg:pt-4 pt-1">
              <h3 className="text-base font-bold text-white font-display uppercase tracking-wider">Record Cashbook Entry</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto lg:max-h-none">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Entry Category */}
              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1.5 uppercase tracking-wider">Entry Category</label>
                <div className="grid grid-cols-4 gap-1 bg-slate-950/70 p-1 border border-slate-850 rounded-xl">
                  {(['general', 'seller', 'labour', 'buyer'] as const).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleCategoryChange(cat)}
                      className={`py-2 rounded-lg text-[9px] font-extrabold uppercase tracking-wider cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
                        category === cat
                          ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md border border-blue-500/20'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {getCategoryIcon(cat)}
                      <span>{cat === 'general' ? 'Misc' : cat}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Inflow vs Outflow */}
              {category === 'general' ? (
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1.5 uppercase tracking-wider">Flow Type</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-950/70 p-1 border border-slate-850 rounded-xl">
                    <button
                      key="receipt-btn"
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, entry_type: 'receipt' }))}
                      className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${
                        formData.entry_type === 'receipt'
                          ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md border border-emerald-500/20'
                          : 'text-slate-500 hover:text-slate-350'
                      }`}
                    >
                      Receipt (Cash In)
                    </button>
                    <button
                      key="payment-btn"
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, entry_type: 'payment' }))}
                      className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${
                        formData.entry_type === 'payment'
                          ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-md border border-rose-500/20'
                          : 'text-slate-500 hover:text-slate-350'
                      }`}
                    >
                      Payment (Cash Out)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-955/60 border border-slate-850 rounded-xl flex items-center justify-between text-xs text-slate-400 shadow-inner">
                  <span>Forced Flow Type:</span>
                  <span className={`font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded text-[9px] border ${
                    formData.entry_type === 'receipt'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                  }`}>
                    {formData.entry_type === 'receipt' ? 'Receipt (Cash In)' : 'Payment (Cash Out)'}
                  </span>
                </div>
              )}

              {/* Dynamic Entity Selectors */}
              {category === 'seller' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 font-bold block mb-1 uppercase tracking-wider">Select Seller</label>
                    <select
                      value={selectedSellerId}
                      onChange={(e) => handleSellerChange(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-955 border border-slate-850 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 font-sans"
                    >
                      <option value="">-- Choose Seller --</option>
                      {sellers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {selectedSellerId && (
                    <div>
                      <label className="text-xs text-slate-400 font-bold block mb-1 uppercase tracking-wider">Select Unpaid Lot</label>
                      <select
                        value={selectedLotId}
                        onChange={(e) => handleLotChange(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-955 border border-slate-850 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 font-sans"
                      >
                        <option value="">-- Choose Lot --</option>
                        {lots
                          .filter(l => l.seller_id === selectedSellerId && l.status !== 'paid')
                          .map(l => (
                            <option key={l.id} value={l.id}>
                              {l.id} (Payable: ₹{l.net_payable_to_seller.toLocaleString('en-IN')})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {category === 'labour' && (
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1 uppercase tracking-wider">Select Labour Crew</label>
                  <select
                    value={selectedLabourId}
                    onChange={(e) => handleLabourChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-955 border border-slate-850 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 font-sans"
                  >
                    <option value="">-- Choose Crew --</option>
                    {labourList.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} (Owed: ₹{w.current_balance.toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {category === 'buyer' && (
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1 uppercase tracking-wider">Select Buyer</label>
                  <select
                    value={selectedBuyerId}
                    onChange={(e) => handleBuyerChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-955 border border-slate-850 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 font-sans"
                  >
                    <option value="">-- Choose Buyer --</option>
                    {buyers.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} (Outstanding: ₹{b.current_outstanding.toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {category === 'general' && (
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1 uppercase tracking-wider">Party / Description Name</label>
                  <input
                    type="text"
                    value={formData.party_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, party_name: e.target.value }))}
                    placeholder="e.g. Miscellaneous Sales, Tea Expense"
                    className="w-full px-4 py-2.5 bg-slate-955 border border-slate-850 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 placeholder-slate-600 font-sans"
                  />
                </div>
              )}

              {/* Amount & Mode */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1 uppercase tracking-wider">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-slate-955 border border-slate-850 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1 uppercase tracking-wider">Payment Mode</label>
                  <select
                    value={formData.mode}
                    onChange={(e) => setFormData(prev => ({ ...prev, mode: e.target.value as PaymentMode }))}
                    className="w-full px-4 py-2.5 bg-slate-955 border border-slate-850 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 font-sans"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1 uppercase tracking-wider">Detailed Description</label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Explain transaction details..."
                  className="w-full px-4 py-2.5 bg-slate-955 border border-slate-850 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 placeholder-slate-650 font-sans"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-850/80 hover:bg-slate-800 border border-slate-800/80 rounded-xl cursor-pointer hover-lift transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-extrabold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl cursor-pointer flex items-center gap-1.5 shadow-lg shadow-blue-950/20 hover-lift border border-blue-500/25 transition-all"
                >
                  <Check className="w-4.5 h-4.5" />
                  <span>Log Transaction</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
