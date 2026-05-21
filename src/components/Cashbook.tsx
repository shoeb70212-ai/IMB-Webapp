import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateId } from '../db';
import { CashbookEntry, PaymentMode } from '../types';
import { Plus, Search, Calendar, Check, X, ShieldAlert, ArrowDownLeft, ArrowUpRight, BookOpen, Trash2, Users, Briefcase, FileText } from 'lucide-react';

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

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-display">Cashbook</h1>
          <p className="text-slate-400 text-sm mt-1">Chronological registers of daily cash drawer flows.</p>
        </div>
        <button 
          onClick={openModal}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg hover:shadow-blue-500/20 transition duration-200"
        >
          <Plus className="w-5 h-5" />
          <span>New Entry</span>
        </button>
      </div>

      {/* Date filter & summaries */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* Date Selector */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-center">
          <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-2">Filter Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-600 font-mono"
            />
          </div>
        </div>

        {/* Daily Cash In */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Inflow</span>
            <h4 className="text-xl font-bold text-emerald-400 font-mono mt-1">+₹{dailyReceipts.toLocaleString('en-IN')}</h4>
          </div>
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        {/* Daily Cash Out */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Outflow</span>
            <h4 className="text-xl font-bold text-rose-400 font-mono mt-1">-₹{dailyPayments.toLocaleString('en-IN')}</h4>
          </div>
          <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        {/* Net Daily Balance */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Daily Net drawer</span>
            <h4 className={`text-xl font-extrabold font-mono mt-1 ${
              dailyNet >= 0 ? 'text-white' : 'text-rose-500'
            }`}>
              {dailyNet >= 0 ? '+' : ''}₹{dailyNet.toLocaleString('en-IN')}
            </h4>
          </div>
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Cash register table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <h3 className="text-base font-bold text-white font-display mb-4">Cash Drawer Log for {new Date(filterDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</h3>
        <div className="overflow-x-auto">
          {filteredEntries.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-500">
              <BookOpen className="w-12 h-12 mb-3 opacity-30" />
              <span className="font-semibold text-slate-400">No cash entries logged for this date</span>
              <p className="text-slate-500 text-xs mt-1">Select another date or add a manual cash ledger entry.</p>
            </div>
          ) : (
            <>
              <table className="hidden lg:table w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Party/Worker</th>
                    <th className="py-3 px-4">Description / Reference</th>
                    <th className="py-3 px-4 text-center">Mode</th>
                    <th className="py-3 px-4 text-center">Flow</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 font-sans text-xs">
                  {filteredEntries.map(e => (
                    <tr key={e.id} className="hover:bg-slate-800/15 transition duration-150">
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {new Date(e.date).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true
                        })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white truncate max-w-[120px]">{e.party_name}</td>
                      <td className="py-3 px-4 text-slate-300 font-medium">{e.description}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-400 uppercase tracking-wider font-mono">
                        {e.mode}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider ${
                          e.entry_type === 'receipt' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/10'
                        }`}>
                          {e.entry_type === 'receipt' ? 'Inflow' : 'Outflow'}
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-right font-black font-mono text-sm ${
                        e.entry_type === 'receipt' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {e.entry_type === 'receipt' ? '+' : '-'}₹{e.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-center no-print font-sans">
                        <button
                          onClick={() => handleDeleteEntry(e)}
                          className="p-1 hover:bg-slate-800 text-slate-500 hover:text-rose-450 rounded-lg cursor-pointer transition-colors"
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
                  <div key={e.id} className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl flex flex-col gap-2 animate-fade-in">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(e.date).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider ${
                          e.entry_type === 'receipt' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/10'
                        }`}>
                          {e.entry_type === 'receipt' ? 'Inflow' : 'Outflow'}
                        </span>
                        <button
                          onClick={() => handleDeleteEntry(e)}
                          className="p-1 hover:bg-slate-800 text-slate-500 hover:text-rose-455 rounded-lg cursor-pointer transition-colors"
                          title="Delete Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-white">
                      {e.party_name}
                    </div>
                    <p className="text-xs text-slate-350">{e.description}</p>
                    <div className="flex justify-between items-end pt-2 border-t border-slate-850/50 mt-1">
                      <div>
                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Mode</span>
                        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">{e.mode}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-black font-mono ${
                          e.entry_type === 'receipt' ? 'text-emerald-400' : 'text-rose-400'
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
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl lg:rounded-3xl w-full lg:max-w-md overflow-hidden shadow-2xl animate-fade-in mobile-bottom-sheet lg:relative">
            {/* Mobile Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto my-3 block lg:hidden" />
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-850 lg:pt-4 pt-1">
              <h3 className="text-base font-bold text-white font-display">Record Cashbook Entry</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Entry Category */}
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1.5">Entry Category</label>
                <div className="grid grid-cols-4 gap-1.5 bg-slate-950 p-1 border border-slate-800 rounded-xl">
                  {(['general', 'seller', 'labour', 'buyer'] as const).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleCategoryChange(cat)}
                      className={`py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition ${
                        category === cat
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-500 hover:text-slate-350'
                      }`}
                    >
                      {cat === 'general' ? 'Misc' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inflow vs Outflow */}
              {category === 'general' ? (
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1.5">Flow Type</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 border border-slate-800 rounded-xl">
                    <button
                      key="receipt-btn"
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, entry_type: 'receipt' }))}
                      className={`py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer ${
                        formData.entry_type === 'receipt'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Receipt (Cash In)
                    </button>
                    <button
                      key="payment-btn"
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, entry_type: 'payment' }))}
                      className={`py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer ${
                        formData.entry_type === 'payment'
                          ? 'bg-rose-600 text-white'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Payment (Cash Out)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-450">
                  <span>Forced Flow Type:</span>
                  <span className={`font-bold uppercase tracking-wider px-2.5 py-0.5 rounded text-[9px] ${
                    formData.entry_type === 'receipt'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/10'
                  }`}>
                    {formData.entry_type === 'receipt' ? 'Receipt (Cash In)' : 'Payment (Cash Out)'}
                  </span>
                </div>
              )}

              {/* Dynamic Entity Selectors */}
              {category === 'seller' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 font-semibold block mb-1">Select Seller</label>
                    <select
                      value={selectedSellerId}
                      onChange={(e) => handleSellerChange(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600"
                    >
                      <option value="">-- Choose Seller --</option>
                      {sellers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {selectedSellerId && (
                    <div>
                      <label className="text-xs text-slate-400 font-semibold block mb-1">Select Unpaid Lot</label>
                      <select
                        value={selectedLotId}
                        onChange={(e) => handleLotChange(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600"
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
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Select Labour Crew</label>
                  <select
                    value={selectedLabourId}
                    onChange={(e) => handleLabourChange(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600"
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
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Select Buyer</label>
                  <select
                    value={selectedBuyerId}
                    onChange={(e) => handleBuyerChange(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600"
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

              {/* Party Name (only visible in General category) */}
              {category === 'general' && (
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Party / Description Name</label>
                  <input
                    type="text"
                    value={formData.party_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, party_name: e.target.value }))}
                    placeholder="e.g. Miscellaneous Sales, Tea Expense"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 placeholder-slate-600"
                  />
                </div>
              )}

              {/* Amount & Mode */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Payment Mode</label>
                  <select
                    value={formData.mode}
                    onChange={(e) => setFormData(prev => ({ ...prev, mode: e.target.value as PaymentMode }))}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Detailed Description</label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Explain transaction details..."
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 placeholder-slate-600"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer flex items-center gap-1.5 shadow-lg shadow-blue-500/10"
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
