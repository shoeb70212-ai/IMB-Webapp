import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateId } from '../db';
import { LabourWorker, LabourTx, PaymentMode } from '../types';
import { 
  Plus, Search, Check, X, ShieldAlert, Trash2, Edit2, 
  CreditCard, Briefcase, DollarSign, History, Printer, 
  Users, Phone, ArrowDownLeft, ArrowUpRight, ArrowLeft
} from 'lucide-react';
import { printViaBrowser } from '../printing';

export default function LabourWages() {
  // Database queries
  const workers = useLiveQuery(() => db.labourList.toArray()) || [];
  const transactions = useLiveQuery(() => db.labourTransactions.toArray()) || [];
  const lots = useLiveQuery(() => db.lots.toArray()) || [];

  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  // Modal controls
  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);

  // Form states
  const [workerForm, setWorkerForm] = useState({
    id: '',
    name: '',
    phone: '',
    type: 'Loader',
    rate_per_crate: '15',
    starting_balance: '0'
  });

  const [jobForm, setJobForm] = useState({
    job_type: 'manual' as 'manual' | 'lot',
    lot_id: '',
    crates: '',
    rate: '15',
    description: '',
    amount: ''
  });

  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    mode: 'cash' as PaymentMode,
    description: 'Wages Payout'
  });

  const [errorMsg, setErrorMsg] = useState('');

  // Selected worker details
  const selectedWorker = workers.find(w => w.id === selectedWorkerId) || null;

  // Filter workers based on search term
  const filteredWorkers = workers.filter(w => 
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (w.phone && w.phone.includes(searchTerm)) ||
    w.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Worker transactions sorted by date descending
  const workerTxList = transactions
    .filter(t => t.labour_id === selectedWorkerId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Handle open worker modal (Add/Edit)
  const openWorkerModal = (worker?: LabourWorker) => {
    if (worker) {
      setWorkerForm({
        id: worker.id,
        name: worker.name,
        phone: worker.phone,
        type: worker.type,
        rate_per_crate: worker.rate_per_crate.toString(),
        starting_balance: worker.current_balance.toString()
      });
    } else {
      setWorkerForm({
        id: '',
        name: '',
        phone: '',
        type: 'Loader',
        rate_per_crate: '15',
        starting_balance: '0'
      });
    }
    setErrorMsg('');
    setWorkerModalOpen(true);
  };

  // Submit Worker profile creation/edit
  const handleWorkerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const name = workerForm.name.trim();
    const phone = workerForm.phone.trim();
    const ratePerCrate = parseFloat(workerForm.rate_per_crate) || 0;
    const balance = parseFloat(workerForm.starting_balance) || 0;

    if (!name || !phone) {
      setErrorMsg('Name and Phone number are required');
      return;
    }

    try {
      if (workerForm.id) {
        // Edit existing worker
        const oldWorker = workers.find(w => w.id === workerForm.id);
        if (!oldWorker) return;

        const balanceDiff = balance - oldWorker.current_balance;

        await db.transaction('rw', [db.labourList, db.labourTransactions], async () => {
          await db.labourList.update(workerForm.id, {
            name,
            phone,
            type: workerForm.type,
            rate_per_crate: ratePerCrate,
            current_balance: balance
          });

          // Log transaction for manual balance change
          if (balanceDiff !== 0) {
            await db.labourTransactions.add({
              id: 'lt_' + generateId(),
              labour_id: workerForm.id,
              date: new Date().toISOString(),
              type: balanceDiff > 0 ? 'work' : 'payment',
              description: 'Manual Balance Correction',
              amount: Math.abs(balanceDiff)
            });
          }
        });
      } else {
        // Create new worker
        const newId = 'lab_' + generateId();
        await db.transaction('rw', [db.labourList, db.labourTransactions], async () => {
          await db.labourList.add({
            id: newId,
            name,
            phone,
            type: workerForm.type,
            rate_per_crate: ratePerCrate,
            current_balance: balance
          });

          if (balance !== 0) {
            await db.labourTransactions.add({
              id: 'lt_' + generateId(),
              labour_id: newId,
              date: new Date().toISOString(),
              type: balance > 0 ? 'work' : 'payment',
              description: 'Opening Balance Setup',
              amount: Math.abs(balance)
            });
          }
        });
        setSelectedWorkerId(newId);
      }
      setWorkerModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Database error saving worker');
    }
  };

  // Delete worker personnel
  const handleWorkerDelete = async (w: LabourWorker) => {
    if (!window.confirm(`Are you sure you want to delete worker "${w.name}"? This clears their profile and all local transaction history.`)) {
      return;
    }
    try {
      await db.transaction('rw', [db.labourList, db.labourTransactions, db.cashbook], async () => {
        // Find all their payment transactions to reverse cashbook entries
        const workerPayments = await db.labourTransactions
          .where({ labour_id: w.id, type: 'payment' })
          .toArray();

        for (const payment of workerPayments) {
          await db.cashbook.where({ labour_tx_id: payment.id }).delete();
        }

        await db.labourList.delete(w.id);
        await db.labourTransactions.where({ labour_id: w.id }).delete();
      });

      if (selectedWorkerId === w.id) {
        setSelectedWorkerId(null);
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting worker');
    }
  };

  // Open record work modal
  const openJobModal = () => {
    if (!selectedWorkerId) return;
    setJobForm({
      job_type: 'manual',
      lot_id: '',
      crates: '',
      rate: selectedWorker?.rate_per_crate.toString() || '15',
      description: '',
      amount: ''
    });
    setErrorMsg('');
    setJobModalOpen(true);
  };

  // Recalculate job wage amount
  const handleJobFormChange = (fields: Partial<typeof jobForm>) => {
    const updated = { ...jobForm, ...fields };

    if (updated.job_type === 'lot' && updated.lot_id) {
      const lot = lots.find(l => l.id === updated.lot_id);
      if (lot) {
        updated.crates = lot.total_crates.toString();
        const cratesVal = parseInt(lot.total_crates.toString()) || 0;
        const rateVal = parseFloat(updated.rate) || 0;
        updated.amount = (cratesVal * rateVal).toString();
        updated.description = `Lot Handling (${lot.total_crates} crates) for Lot ${lot.id}`;
      }
    } else {
      const cratesVal = parseInt(updated.crates) || 0;
      const rateVal = parseFloat(updated.rate) || 0;
      if (cratesVal > 0) {
        updated.amount = (cratesVal * rateVal).toString();
      }
    }

    setJobForm(updated);
  };

  // Record labor work credit
  const handleJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedWorker) return;
    const amount = parseFloat(jobForm.amount) || 0;
    const crates = parseInt(jobForm.crates) || 0;
    const rate = parseFloat(jobForm.rate) || 0;
    const desc = jobForm.description.trim() || 'Manual Labor Job';

    if (amount <= 0) {
      setErrorMsg('Invalid wage/work amount');
      return;
    }

    try {
      await db.transaction('rw', [db.labourList, db.labourTransactions], async () => {
        const txId = 'lt_' + generateId();
        await db.labourTransactions.add({
          id: txId,
          labour_id: selectedWorker.id,
          date: new Date().toISOString(),
          type: 'work',
          description: desc,
          crates,
          rate,
          amount
        });

        await db.labourList.update(selectedWorker.id, {
          current_balance: selectedWorker.current_balance + amount
        });
      });
      setJobModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error recording job');
    }
  };

  // Open payout modal
  const openPayoutModal = () => {
    if (!selectedWorkerId) return;
    setPayoutForm({
      amount: '',
      mode: 'cash',
      description: 'Wages Payout'
    });
    setErrorMsg('');
    setPayoutModalOpen(true);
  };

  // Record wage payment outflow (synchronized to cashbook)
  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedWorker) return;
    const amount = parseFloat(payoutForm.amount) || 0;
    const desc = payoutForm.description.trim() || 'Wages Payment';

    if (amount <= 0) {
      setErrorMsg('Please enter a valid amount');
      return;
    }

    try {
      const txId = 'lt_' + generateId();
      const cashbookId = 'cb_' + generateId();
      const dateIso = new Date().toISOString();

      await db.transaction('rw', [db.labourList, db.labourTransactions, db.cashbook], async () => {
        // 1. Add Wages Transaction
        await db.labourTransactions.add({
          id: txId,
          labour_id: selectedWorker.id,
          date: dateIso,
          type: 'payment',
          description: desc,
          amount,
          mode: payoutForm.mode
        });

        // 2. Subtract from worker balance
        await db.labourList.update(selectedWorker.id, {
          current_balance: selectedWorker.current_balance - amount
        });

        // 3. Post Outflow Entry in Cashbook
        await db.cashbook.add({
          id: cashbookId,
          date: dateIso,
          entry_type: 'payment',
          party_id: selectedWorker.id,
          party_name: selectedWorker.name,
          description: `Wages paid: ${selectedWorker.name} (${desc})`,
          amount,
          mode: payoutForm.mode,
          labour_tx_id: txId // Double-entry foreign key reference
        });
      });

      setPayoutModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error recording payout');
    }
  };

  // Delete wages/payout transaction with cascading sync to cashbook
  const handleTransactionDelete = async (tx: LabourTx) => {
    if (!selectedWorker) return;
    if (!window.confirm('Are you sure you want to revert this entry? Worker balance impact will be reversed and any cashbook records will be deleted.')) {
      return;
    }

    try {
      await db.transaction('rw', [db.labourList, db.labourTransactions, db.cashbook], async () => {
        // 1. Calculate balance impact
        let newBalance = selectedWorker.current_balance;
        if (tx.type === 'work') {
          newBalance -= tx.amount;
        } else if (tx.type === 'payment') {
          newBalance += tx.amount;

          // 2. Cascade delete from cashbook if it was a payment
          await db.cashbook.where({ labour_tx_id: tx.id }).delete();
        }

        // 3. Update balance & delete wages entry
        await db.labourList.update(selectedWorker.id, { current_balance: newBalance });
        await db.labourTransactions.delete(tx.id);
      });
    } catch (err: any) {
      alert(err.message || 'Error deleting log entry');
    }
  };

  // Print Statement Helper
  const handlePrintStatement = () => {
    if (!selectedWorker) return;
    const settings = JSON.parse(localStorage.getItem('ca_settings') || '{}');

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
              Loader Account Ledger
            </h2>
            <div style="font-size: 12px; color: #475569; line-height: 1.5;">
              <div><strong>Statement Date:</strong> <span class="print-monospace">${new Date().toLocaleDateString()}</span></div>
              <div><strong>Net Balance Owed:</strong> <span class="print-monospace" style="font-weight: 700; color: #16a34a;">₹${selectedWorker.current_balance.toLocaleString('en-IN')}</span></div>
            </div>
          </div>
        </div>

        <!-- Worker details card -->
        <div style="background: #f1f5f9; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; font-size: 13px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div>
            <strong>Worker Name:</strong> ${selectedWorker.name}
          </div>
          <div>
            <strong>Phone:</strong> <span class="print-monospace">${selectedWorker.phone || 'N/A'}</span>
          </div>
          <div>
            <strong>Labour Category:</strong> ${selectedWorker.type}
          </div>
        </div>

        <!-- Transaction Logs -->
        <h4 style="margin: 20px 0 10px 0; font-size: 13px; color: #1e293b; text-transform: uppercase; font-family: 'Outfit', sans-serif; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">Transaction Logs</h4>
        
        <table class="print-table" style="margin-bottom: 25px;">
          <thead>
            <tr>
              <th style="text-align: left; width: 15%;">Date</th>
              <th style="text-align: left; width: 40%;">Description</th>
              <th style="text-align: center; width: 10%;">Crates</th>
              <th style="text-align: center; width: 10%;">Rate</th>
              <th style="text-align: right; width: 12.5%;">Credit (Work)</th>
              <th style="text-align: right; width: 12.5%;">Debit (Paid)</th>
            </tr>
          </thead>
          <tbody>
            ${[...workerTxList].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(t => `
              <tr>
                <td class="print-monospace" style="color: #64748b;">${new Date(t.date).toLocaleDateString()}</td>
                <td style="color: #1e293b; font-weight: 500;">${t.description}</td>
                <td class="print-monospace" style="text-align: center;">${t.crates || '-'}</td>
                <td class="print-monospace" style="text-align: center;">${t.rate ? '₹' + t.rate : '-'}</td>
                <td class="print-monospace" style="text-align: right; font-weight: bold; color: #16a34a;">
                  ${t.type === 'work' ? '₹' + t.amount.toLocaleString('en-IN') : '-'}
                </td>
                <td class="print-monospace" style="text-align: right; font-weight: bold; color: #dc2626;">
                  ${t.type === 'payment' ? '₹' + t.amount.toLocaleString('en-IN') : '-'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Signatures -->
        <div class="print-signature-row" style="margin-top: 50px;">
          <div class="print-signature-box">Worker Signature</div>
          <div class="print-signature-box">Authorized Agent</div>
        </div>
      </div>
    `;

    printViaBrowser(printHtml, 'a4');
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-slate-950 text-slate-200 animate-fade-in">
      {/* Left panel: Directory list */}
      <div className={`w-full md:w-80 border-r border-slate-800/50 flex flex-col h-full bg-slate-950 flex-shrink-0 ${
        selectedWorkerId ? 'hidden md:flex' : 'flex'
      }`}>
        <div className="p-4 border-b border-slate-800/50 space-y-3">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-extrabold text-white font-display flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              <span>Labour Crews</span>
            </h1>
            <button
              onClick={() => openWorkerModal()}
              className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg cursor-pointer"
              title="Add Loader Crew"
            >
              <Plus className="w-4.5 h-4.5" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search crew or worker..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-600 placeholder-slate-650"
            />
          </div>
        </div>

        {/* Worker roster */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-900/60 p-2 space-y-1">
          {filteredWorkers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No worker crews logged.
            </div>
          ) : (
            filteredWorkers.map(w => (
              <button
                key={w.id}
                onClick={() => setSelectedWorkerId(w.id)}
                className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition duration-150 cursor-pointer ${
                  selectedWorkerId === w.id
                    ? 'bg-slate-900 border border-slate-800'
                    : 'hover:bg-slate-900/40 border border-transparent'
                }`}
              >
                <div>
                  <h4 className="text-xs font-bold text-white truncate max-w-[150px]">{w.name}</h4>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1">
                    <span className="bg-slate-850 px-1.5 py-0.5 rounded text-slate-400 font-medium">{w.type}</span>
                    {w.phone && (
                      <span className="flex items-center gap-0.5">
                        <Phone className="w-2.5 h-2.5" /> {w.phone}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wide block">Balance</span>
                  <span className={`text-xs font-bold font-mono ${
                    w.current_balance > 0 ? 'text-emerald-400' : 'text-slate-400'
                  }`}>
                    ₹{w.current_balance.toLocaleString('en-IN')}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel: Details & logs */}
      <div className={`flex-1 flex flex-col h-full bg-slate-950 min-w-0 ${
        selectedWorkerId ? 'flex' : 'hidden md:flex'
      }`}>
        {selectedWorker ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header info */}
            <div className="p-6 border-b border-slate-800/50 bg-slate-900/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <button
                  onClick={() => setSelectedWorkerId(null)}
                  className="mb-3 px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-bold text-slate-400 hover:text-white rounded-xl flex items-center gap-1 md:hidden cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Crews List</span>
                </button>
                
                <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full text-[9px] font-bold uppercase tracking-wider">
                  {selectedWorker.type}
                </span>
                <h2 className="text-2xl font-black text-white font-display mt-1">{selectedWorker.name}</h2>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{selectedWorker.phone || 'No phone recorded'}</span>
                  <span className="mx-1.5 text-slate-800">|</span>
                  <span>Crate rate: ₹{selectedWorker.rate_per_crate}/crate</span>
                </p>
              </div>

              {/* Actions & Balance */}
              <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl text-right shrink-0">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest block">Balance Owed</span>
                  <h3 className={`text-lg font-black font-mono mt-0.5 ${
                    selectedWorker.current_balance > 0 ? 'text-emerald-400' : 'text-slate-400'
                  }`}>
                    ₹{selectedWorker.current_balance.toLocaleString('en-IN')}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openWorkerModal(selectedWorker)}
                    className="p-2 bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl cursor-pointer"
                    title="Edit profile"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleWorkerDelete(selectedWorker)}
                    className="p-2 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 rounded-xl cursor-pointer"
                    title="Delete Worker"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Record Operations Bar */}
            <div className="px-6 py-3 bg-slate-900/30 border-b border-slate-800/40 flex flex-wrap gap-3">
              <button
                onClick={openJobModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition"
              >
                <Briefcase className="w-4 h-4" />
                <span>Record Work Card</span>
              </button>
              <button
                onClick={openPayoutModal}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition"
              >
                <CreditCard className="w-4 h-4" />
                <span>Payout Wages</span>
              </button>
              <button
                onClick={handlePrintStatement}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-slate-800 cursor-pointer transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print statement</span>
              </button>
            </div>

            {/* Transaction Logs */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex items-center gap-1.5 text-slate-400">
                <History className="w-4 h-4" />
                <h3 className="text-sm font-bold text-slate-300 font-display">Transaction Log Sheet</h3>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  {workerTxList.length === 0 ? (
                    <div className="py-16 text-center text-slate-500 text-xs">
                      No logs logged for this worker.
                    </div>
                  ) : (
                    <>
                      <table className="hidden lg:table w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Description</th>
                            <th className="py-3 px-4 text-center">Crates</th>
                            <th className="py-3 px-4 text-center">Rate</th>
                            <th className="py-3 px-4 text-center">Impact</th>
                            <th className="py-3 px-4 text-right">Amount</th>
                            <th className="py-3 px-4 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850/50">
                          {workerTxList.map(t => (
                            <tr key={t.id} className="hover:bg-slate-800/10">
                              <td className="py-3.5 px-4 text-slate-400 font-mono">
                                {new Date(t.date).toLocaleDateString()}
                              </td>
                              <td className="py-3.5 px-4 font-medium text-slate-200">
                                {t.description}
                                {t.mode && (
                                  <span className="ml-2 px-1.5 py-0.5 bg-slate-800 text-slate-400 font-mono text-[9px] uppercase rounded">
                                    {t.mode}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-center text-slate-400 font-mono">
                                {t.crates || '-'}
                              </td>
                              <td className="py-3.5 px-4 text-center text-slate-400 font-mono">
                                {t.rate ? `₹${t.rate}` : '-'}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider ${
                                  t.type === 'work'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-rose-500/10 text-rose-400'
                                }`}>
                                  {t.type === 'work' ? 'Earned' : 'Paid'}
                                </span>
                              </td>
                              <td className={`py-3.5 px-4 text-right font-bold font-mono text-sm ${
                                t.type === 'work' ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {t.type === 'work' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  onClick={() => handleTransactionDelete(t)}
                                  className="p-1 bg-slate-850 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded transition cursor-pointer"
                                  title="Revert entry"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      
                      <div className="lg:hidden space-y-3 p-4">
                        {workerTxList.map(t => (
                          <div key={t.id} className="p-4 bg-slate-950 border border-slate-850 rounded-2xl flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 font-mono text-[10px]">
                                {new Date(t.date).toLocaleDateString()}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider ${
                                t.type === 'work'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-rose-500/10 text-rose-400'
                              }`}>
                                {t.type === 'work' ? 'Earned' : 'Paid'}
                              </span>
                            </div>
                            
                            <div className="flex justify-between items-end gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-200 text-xs leading-normal truncate">
                                  {t.description}
                                </p>
                                {t.mode && (
                                  <span className="inline-block mt-1 px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 font-mono text-[9px] uppercase rounded">
                                    {t.mode}
                                  </span>
                                )}
                                {t.crates ? (
                                  <p className="text-[9px] text-slate-500 mt-1 font-mono">
                                    Crates: {t.crates} @ ₹{t.rate}/cr
                                  </p>
                                ) : null}
                              </div>
                              <div className="text-right flex items-center gap-2 shrink-0">
                                <span className={`font-extrabold font-mono text-xs ${
                                  t.type === 'work' ? 'text-emerald-400' : 'text-rose-400'
                                }`}>
                                  {t.type === 'work' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                                </span>
                                <button
                                  onClick={() => handleTransactionDelete(t)}
                                  className="p-1 bg-slate-900 border border-slate-850 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded transition cursor-pointer"
                                  title="Revert entry"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
            <Users className="w-16 h-16 mb-4 opacity-20 text-blue-500" />
            <h3 className="text-base font-bold text-slate-400 font-display">Select a Loader Crew</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">
              Choose a workers crew from the roster or register a new team to manage credit balances, record work orders, and log cash payouts.
            </p>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD/EDIT WORKER */}
      {workerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl lg:rounded-3xl w-full lg:max-w-md overflow-y-auto max-h-[85vh] lg:max-h-[none] shadow-2xl mobile-bottom-sheet lg:relative">
            <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto my-3 block lg:hidden" />
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-850">
              <h3 className="text-base font-bold text-white font-display">
                {workerForm.id ? 'Modify Crew Profile' : 'Register Labour Crew'}
              </h3>
              <button
                onClick={() => setWorkerModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWorkerSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Worker/Gang Name</label>
                <input
                  type="text"
                  value={workerForm.name}
                  onChange={(e) => setWorkerForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Raju Loader Crew, Suresh Mandi loader"
                  required
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 placeholder-slate-650"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={workerForm.phone}
                    onChange={(e) => setWorkerForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="10-digit phone"
                    required
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 placeholder-slate-650 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Crew Type</label>
                  <select
                    value={workerForm.type}
                    onChange={(e) => setWorkerForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600"
                  >
                    <option value="Loader">Loader Gang</option>
                    <option value="Individual">Individual Loader</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="Driver">Driver / Transport</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Default Rate (₹/crate)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={workerForm.rate_per_crate}
                    onChange={(e) => setWorkerForm(prev => ({ ...prev, rate_per_crate: e.target.value }))}
                    required
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Starting Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={workerForm.starting_balance}
                    onChange={(e) => setWorkerForm(prev => ({ ...prev, starting_balance: e.target.value }))}
                    placeholder="0"
                    disabled={!!workerForm.id} // Disabled on edit
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 font-mono disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setWorkerModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-4.5 h-4.5" />
                  <span>Save Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD WORK JOB */}
      {jobModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl lg:rounded-3xl w-full lg:max-w-md overflow-y-auto max-h-[85vh] lg:max-h-[none] shadow-2xl mobile-bottom-sheet lg:relative">
            <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto my-3 block lg:hidden" />
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-850">
              <h3 className="text-base font-bold text-white font-display">Record Unloading/Work Job</h3>
              <button
                onClick={() => setJobModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleJobSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Job Type Toggle */}
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1.5">Unloading Reference</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleJobFormChange({ job_type: 'manual', lot_id: '', crates: '', amount: '', description: '' })}
                    className={`py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer ${
                      jobForm.job_type === 'manual'
                        ? 'bg-slate-850 text-white border border-slate-800'
                        : 'text-slate-500 hover:text-slate-355'
                    }`}
                  >
                    Manual Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => handleJobFormChange({ job_type: 'lot', crates: '', amount: '', description: '' })}
                    className={`py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer ${
                      jobForm.job_type === 'lot'
                        ? 'bg-slate-850 text-white border border-slate-800'
                        : 'text-slate-500 hover:text-slate-355'
                    }`}
                  >
                    Link settled Lot
                  </button>
                </div>
              </div>

              {/* Link Lot selection if job_type === lot */}
              {jobForm.job_type === 'lot' && (
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Select Mandi Lot</label>
                  <select
                    value={jobForm.lot_id}
                    onChange={(e) => handleJobFormChange({ lot_id: e.target.value })}
                    required
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600"
                  >
                    <option value="">-- Choose Arrival Lot --</option>
                    {lots
                      .filter(l => l.status === 'auctioned' || l.status === 'settled')
                      .map(l => (
                        <option key={l.id} value={l.id}>
                          {l.id} - {l.seller_name} ({l.total_crates} Crates)
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Crates count & rate */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Total Crates</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={jobForm.crates}
                    disabled={jobForm.job_type === 'lot'}
                    onChange={(e) => handleJobFormChange({ crates: e.target.value })}
                    placeholder="Count"
                    required
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 font-mono disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Handling Rate (₹/crate)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={jobForm.rate}
                    onChange={(e) => handleJobFormChange({ rate: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Job Description</label>
                <input
                  type="text"
                  value={jobForm.description}
                  onChange={(e) => setJobForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g. Unloading Grapes lot 12, manual sorting crates"
                  required
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 placeholder-slate-650"
                />
              </div>

              {/* Final Amount calculated */}
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Net Earnings Credit (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={jobForm.amount}
                  onChange={(e) => setJobForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-emerald-400 font-extrabold focus:outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setJobModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-4.5 h-4.5" />
                  <span>Log Work Credits</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RECORD WAGE PAYOUT */}
      {payoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl lg:rounded-3xl w-full lg:max-w-md overflow-y-auto max-h-[85vh] lg:max-h-[none] shadow-2xl mobile-bottom-sheet lg:relative">
            <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto my-3 block lg:hidden" />
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-850">
              <h3 className="text-base font-bold text-white font-display">Record Wage Payout</h3>
              <button
                onClick={() => setPayoutModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePayoutSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Amount & Mode */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Payout Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={payoutForm.amount}
                    onChange={(e) => setPayoutForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Payment Mode</label>
                  <select
                    value={payoutForm.mode}
                    onChange={(e) => setPayoutForm(prev => ({ ...prev, mode: e.target.value as PaymentMode }))}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600"
                  >
                    <option value="cash">Cash Out</option>
                    <option value="upi">UPI / Online</option>
                    <option value="bank">Bank Account Transfer</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Description Reference</label>
                <input
                  type="text"
                  required
                  value={payoutForm.description}
                  onChange={(e) => setPayoutForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g. Weekly crew settlement, loan advance"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 placeholder-slate-650"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setPayoutModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg cursor-pointer flex items-center gap-1.5 shadow-lg"
                >
                  <Check className="w-4.5 h-4.5" />
                  <span>Disburse Payout</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
