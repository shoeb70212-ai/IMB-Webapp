import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateId, DEFAULT_BUSINESS_SETTINGS } from '../db';
import { Party, Lot, PaymentMode, SystemSettings } from '../types';
import { ArrowLeft, ArrowRight, Plus, Trash2, Calendar, Clipboard, Users, ShieldAlert, Award, Layers } from 'lucide-react';

interface NewLotWizardProps {
  onNavigate: (tab: string, param?: any) => void;
}

interface DraftItem {
  id: string;
  fruit: string;
  grade: string;
  qty: number;
  gross: number; // gross weight per crate
  tare: number; // tare weight per crate
  rate: number;
  net_total: number;
  sold_qty: number;
}

interface DraftAllocation {
  id: string;
  item_id: string;
  fruit: string;
  grade: string;
  buyer_id: string;
  buyer_name: string;
  qty: number;
  rate: number;
  net_weight: number;
  gross_weight: number;
  tare_weight: number;
  amount: number;
  mode: PaymentMode;
}

interface DraftSummary {
  gross: number;
  net: number;
  charges: { type: string; amt: number; desc: string; qty?: number; rate?: number }[];
  buyer_charges: { buyer_id: string; buyer_name: string; type: string; desc: string; qty: number; rate: number; amt: number }[];
}

export default function NewLotWizard({ onNavigate }: NewLotWizardProps) {
  // Queries
  const parties = useLiveQuery(() => db.parties.toArray()) || [];
  const labourList = useLiveQuery(() => db.labourList.toArray()) || [];

  // System Settings
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const stored = localStorage.getItem('ca_settings');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return DEFAULT_BUSINESS_SETTINGS;
  });

  // Steps
  const [step, setStep] = useState(1);
  
  // Wizard States
  const [sellerId, setSellerId] = useState('');
  const [arrivalDate, setArrivalDate] = useState(() => new Date().toISOString().substring(0, 16));
  const [labourId, setLabourId] = useState('');
  
  // Step 2 Form & Items list
  const [items, setItems] = useState<DraftItem[]>([]);
  const [nc, setNc] = useState({
    fruit: '',
    grade: '',
    qty: 1,
    gross: '',
    tare: '0.5',
    rate: ''
  });
  const grossInputRef = useRef<HTMLInputElement | null>(null);

  // Step 3 Form & Allocations
  const [allocations, setAllocations] = useState<DraftAllocation[]>([]);
  const [allocForm, setAllocForm] = useState({
    item_id: '',
    buyer_id: '',
    qty: '',
    rate: '',
    mode: 'cash' as PaymentMode
  });

  // Step 4 Summary
  const [summary, setSummary] = useState<DraftSummary>({
    gross: 0,
    net: 0,
    charges: [],
    buyer_charges: []
  });

  // Toast
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'warning' | 'info'>('info');
  
  const triggerToast = (msg: string, type: 'success' | 'warning' | 'info' = 'info') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Set default form values when items / settings change
  useEffect(() => {
    if (settings.fruit_types.length > 0 && !nc.fruit) {
      setNc(prev => ({ 
        ...prev, 
        fruit: settings.fruit_types[0],
        grade: settings.quality_grades[0] || 'A1'
      }));
    }
  }, [settings, nc.fruit]);

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const draftRaw = localStorage.getItem('ca_draft_nl');
      if (draftRaw) {
        const draft = JSON.parse(draftRaw);
        setStep(draft.step || 1);
        setSellerId(draft.seller_id || '');
        if (draft.arrival_date) setArrivalDate(draft.arrival_date);
        setLabourId(draft.labour_id || '');
        setItems(draft.items || []);
        setAllocations(draft.allocations || []);
        if (draft.summary) setSummary(draft.summary);
      }
    } catch (e) {
      console.error('Failed to restore lot draft', e);
    }
  }, []);

  // Save draft whenever state changes
  const saveDraft = (currentStep: number, currentItems = items, currentAllocations = allocations, currentSummary = summary) => {
    const draft = {
      step: currentStep,
      seller_id: sellerId,
      arrival_date: arrivalDate,
      labour_id: labourId,
      items: currentItems,
      allocations: currentAllocations,
      summary: currentSummary
    };
    localStorage.setItem('ca_draft_nl', JSON.stringify(draft));
  };

  // Step 1 -> Step 2
  const nextStep1 = () => {
    if (!sellerId) return triggerToast('Please select a seller', 'warning');
    const s = 2;
    setStep(s);
    saveDraft(s);
  };

  // Step 2 Form Rate defaults
  const handleFruitGradeChange = (fruit: string, grade: string) => {
    const defaultPrice = settings.grade_prices[grade] || '';
    setNc(prev => ({
      ...prev,
      fruit,
      grade,
      rate: defaultPrice ? defaultPrice.toString() : prev.rate
    }));
  };

  // Step 2: Add Crate
  const addCrateItem = () => {
    const qty = parseInt(nc.qty.toString()) || 0;
    const gross = parseFloat(nc.gross) || 0;
    const tare = parseFloat(nc.tare) || 0;
    const rate = parseFloat(nc.rate) || 0;

    if (qty <= 0 || gross <= 0 || rate <= 0) {
      return triggerToast('Please enter valid quantities, weights, and rates', 'warning');
    }

    const netWeightPerCrate = gross - tare;
    const netTotalWeight = netWeightPerCrate * qty;

    const existingIndex = items.findIndex(
      x => x.fruit === nc.fruit && x.grade === nc.grade && x.rate === rate
    );

    let newItems = [...items];
    let newId = '';

    if (existingIndex !== -1) {
      const oldItem = newItems[existingIndex];
      const totalQty = oldItem.qty + qty;
      const avgGross = (oldItem.gross * oldItem.qty + gross * qty) / totalQty;
      const avgTare = (oldItem.tare * oldItem.qty + tare * qty) / totalQty;
      
      newItems[existingIndex] = {
        ...oldItem,
        qty: totalQty,
        gross: parseFloat(avgGross.toFixed(2)),
        tare: parseFloat(avgTare.toFixed(2)),
        net_total: parseFloat((oldItem.net_total + netTotalWeight).toFixed(2))
      };
      newId = oldItem.id;
    } else {
      newId = generateId();
      const newItem: DraftItem = {
        id: newId,
        fruit: nc.fruit,
        grade: nc.grade,
        qty,
        gross,
        tare,
        rate,
        net_total: parseFloat(netTotalWeight.toFixed(2)),
        sold_qty: 0
      };
      newItems.push(newItem);
    }
    
    setItems(newItems);
    
    // Clear forms and refocus
    setNc(prev => ({
      ...prev,
      qty: 1,
      gross: '',
      rate: settings.grade_prices[prev.grade]?.toString() || ''
    }));

    if (grossInputRef.current) {
      grossInputRef.current.focus();
    }

    // Set first alloc item id if empty
    if (!allocForm.item_id) {
      setAllocForm(prev => ({ ...prev, item_id: newId }));
    }

    // Auto prep step 4 calculations
    const updatedSummary = calculateCharges(newItems, allocations);
    setSummary(updatedSummary);
    saveDraft(step, newItems, allocations, updatedSummary);
    triggerToast(existingIndex !== -1 ? 'Item updated (merged)!' : 'Item added!', 'success');
  };

  // Delete Crate Item
  const deleteCrateItem = (itemId: string) => {
    const newItems = items.filter(x => x.id !== itemId);
    const newAllocations = allocations.filter(a => a.item_id !== itemId);
    setItems(newItems);
    setAllocations(newAllocations);
    
    if (allocForm.item_id === itemId) {
      setAllocForm(prev => ({ ...prev, item_id: newItems[0]?.id || '' }));
    }

    const updatedSummary = calculateCharges(newItems, newAllocations);
    setSummary(updatedSummary);
    saveDraft(step, newItems, newAllocations, updatedSummary);
  };

  // Step 2 -> Step 3
  const nextStep2 = () => {
    if (items.length === 0) return triggerToast('Please add at least one crate entry', 'warning');
    
    // Initialize alloc form with first item
    setAllocForm(prev => ({
      ...prev,
      item_id: items[0].id,
      buyer_id: parties.find(p => p.type === 'buyer')?.id || '',
      rate: items[0].rate.toString()
    }));
    
    const s = 3;
    setStep(s);
    saveDraft(s);
  };

  // Update default rate when selected item changes in allocations
  const handleAllocItemChange = (itemId: string) => {
    const item = items.find(x => x.id === itemId);
    setAllocForm(prev => ({
      ...prev,
      item_id: itemId,
      rate: item ? item.rate.toString() : prev.rate
    }));
  };

  // Add allocation
  const addAllocRecord = () => {
    const itemId = allocForm.item_id;
    const buyerId = allocForm.buyer_id;
    const qty = parseInt(allocForm.qty) || 0;
    const rate = parseFloat(allocForm.rate) || 0;
    const mode = allocForm.mode;

    if (!itemId || !buyerId || qty <= 0 || rate <= 0) {
      return triggerToast('Please enter valid buyer, quantity, and rate', 'warning');
    }

    const itemIdx = items.findIndex(x => x.id === itemId);
    if (itemIdx === -1) return;
    const item = items[itemIdx];
    
    const available = item.qty - item.sold_qty;
    if (qty > available) {
      return triggerToast(`Only ${available} crates left for this grade`, 'warning');
    }

    const netWeight = parseFloat(((item.net_total / item.qty) * qty).toFixed(2));
    const amount = netWeight * rate;
    const buyer = parties.find(p => p.id === buyerId);
    if (!buyer) return;

    // Check Credit Limit Warning
    const draftCreditSum = allocations
      .filter(a => a.buyer_id === buyerId && a.mode === 'credit')
      .reduce((sum, a) => sum + a.amount, 0);

    const outstanding = buyer.current_outstanding || 0;
    const limit = buyer.credit_limit || 0;

    if (mode === 'credit' && (outstanding + draftCreditSum + amount > limit)) {
      triggerToast(`Warning: Credit limit exceeded for ${buyer.name}! Limit: ₹${limit}`, 'warning');
    }

    // Allocate crates
    const updatedItems = [...items];
    updatedItems[itemIdx].sold_qty += qty;
    setItems(updatedItems);

    const existingAllocIdx = allocations.findIndex(
      a => a.item_id === itemId && a.buyer_id === buyerId && a.rate === rate && a.mode === mode
    );

    let newAllocations = [...allocations];
    if (existingAllocIdx !== -1) {
      const oldAlloc = newAllocations[existingAllocIdx];
      newAllocations[existingAllocIdx] = {
        ...oldAlloc,
        qty: oldAlloc.qty + qty,
        net_weight: parseFloat((oldAlloc.net_weight + netWeight).toFixed(2)),
        gross_weight: parseFloat((oldAlloc.gross_weight + item.gross * qty).toFixed(2)),
        tare_weight: parseFloat((oldAlloc.tare_weight + item.tare * qty).toFixed(2)),
        amount: parseFloat((oldAlloc.amount + amount).toFixed(2))
      };
    } else {
      const newAlloc: DraftAllocation = {
        id: generateId(),
        item_id: itemId,
        fruit: item.fruit,
        grade: item.grade,
        buyer_id: buyerId,
        buyer_name: buyer.name,
        qty,
        rate,
        net_weight: netWeight,
        gross_weight: parseFloat((item.gross * qty).toFixed(2)),
        tare_weight: parseFloat((item.tare * qty).toFixed(2)),
        amount: parseFloat(amount.toFixed(2)),
        mode
      };
      newAllocations.push(newAlloc);
    }

    setAllocations(newAllocations);

    // Reset alloc form fields
    setAllocForm(prev => ({
      ...prev,
      qty: '',
      rate: item.rate.toString()
    }));

    const updatedSummary = calculateCharges(updatedItems, newAllocations);
    setSummary(updatedSummary);
    saveDraft(step, updatedItems, newAllocations, updatedSummary);
  };

  // Remove Allocation
  const removeAllocRecord = (idx: number) => {
    const target = allocations[idx];
    const itemIdx = items.findIndex(x => x.id === target.item_id);
    const updatedItems = [...items];
    
    if (itemIdx > -1) {
      updatedItems[itemIdx].sold_qty -= target.qty;
      setItems(updatedItems);
    }

    const newAllocations = allocations.filter((_, i) => i !== idx);
    setAllocations(newAllocations);

    const updatedSummary = calculateCharges(updatedItems, newAllocations);
    setSummary(updatedSummary);
    saveDraft(step, updatedItems, newAllocations, updatedSummary);
  };

  // Step 3 -> Step 4 calculations
  const calculateCharges = (currentItems = items, currentAllocations = allocations): DraftSummary => {
    const gross = currentAllocations.reduce((sum, a) => sum + a.amount, 0);
    const totalCrates = currentItems.reduce((sum, i) => sum + i.qty, 0);
    
    const commPct = parseFloat(settings.default_commission_percent.toString()) || 0;
    const labPerCrate = parseFloat(settings.default_labour_per_crate.toString()) || 0;
    const weiPerCrate = parseFloat(settings.default_weighing_per_crate.toString()) || 0;
    
    const commAmt = Math.round(gross * (commPct / 100));
    const labAmt = Math.round(totalCrates * labPerCrate);
    const weiAmt = Math.round(totalCrates * weiPerCrate);

    const charges = [
      { type: 'commission', amt: commAmt, desc: `Commission (${commPct}%)` },
      { type: 'labour', amt: labAmt, desc: `Labour (General Unloading)`, qty: totalCrates, rate: labPerCrate },
      { type: 'weighing', amt: weiAmt, desc: `Weighing (${totalCrates} Crates)` }
    ];

    // Compute buyer charges (Default loader wages charged to buyer per crate allocation)
    // Gather buyer crate counts
    const buyerCrates: Record<string, { name: string; qty: number }> = {};
    currentAllocations.forEach(a => {
      if (!buyerCrates[a.buyer_id]) {
        buyerCrates[a.buyer_id] = { name: a.buyer_name, qty: 0 };
      }
      buyerCrates[a.buyer_id].qty += a.qty;
    });

    const buyer_charges: DraftSummary['buyer_charges'] = [];
    Object.keys(buyerCrates).forEach(bId => {
      const bcQty = buyerCrates[bId].qty;
      buyer_charges.push({
        buyer_id: bId,
        buyer_name: buyerCrates[bId].name,
        type: 'labour',
        desc: 'Labour (General)',
        qty: bcQty,
        rate: labPerCrate,
        amt: bcQty * labPerCrate
      });
    });

    return {
      gross,
      net: gross - (commAmt + labAmt + weiAmt),
      charges,
      buyer_charges
    };
  };

  const nextStep3 = () => {
    // Check if all items are fully allocated
    const unallocated = items.some(item => item.qty > item.sold_qty);
    if (unallocated && !confirm('Some crates are not fully allocated. Do you want to proceed anyway?')) {
      return;
    }

    const updatedSummary = calculateCharges();
    setSummary(updatedSummary);
    const s = 4;
    setStep(s);
    saveDraft(s, items, allocations, updatedSummary);
  };

  // Adjust charge amount in summary
  const adjustSellerCharge = (idx: number, amountStr: string) => {
    const val = parseInt(amountStr) || 0;
    const newCharges = [...summary.charges];
    newCharges[idx].amt = val;
    
    const totalCharges = newCharges.reduce((s, c) => s + c.amt, 0);
    const updatedSummary = {
      ...summary,
      charges: newCharges,
      net: summary.gross - totalCharges
    };
    setSummary(updatedSummary);
    saveDraft(step, items, allocations, updatedSummary);
  };

  // Adjust buyer charge
  const adjustBuyerCharge = (idx: number, valStr: string) => {
    const val = parseInt(valStr) || 0;
    const newBuyerCharges = [...summary.buyer_charges];
    newBuyerCharges[idx].amt = val;
    
    const updatedSummary = {
      ...summary,
      buyer_charges: newBuyerCharges
    };
    setSummary(updatedSummary);
    saveDraft(step, items, allocations, updatedSummary);
  };

  // Finalize Lot Transaction
  const handleFinalize = async () => {
    const seller = parties.find(p => p.id === sellerId);
    if (!seller) return triggerToast('Invalid Seller ID', 'warning');

    const lotId = 'LOT-' + generateId().toUpperCase();
    const totalCrates = items.reduce((s, i) => s + i.qty, 0);
    const totalNetWeight = items.reduce((s, i) => s + i.net_total, 0);

    const finalLot: Lot = {
      id: lotId,
      seller_id: sellerId,
      seller_name: seller.name,
      arrival_date: new Date(arrivalDate).toISOString(),
      status: 'auctioned',
      total_crates: totalCrates,
      total_weight_kg: parseFloat(totalNetWeight.toFixed(2)),
      gross_sale_amount: summary.gross,
      net_payable_to_seller: summary.net,
      labour_id: labourId || undefined
    };

    try {
      await db.transaction('rw', [
        db.lots, db.crates, db.charges, db.parties, db.khata, db.labourTransactions, db.labourList
      ], async () => {
        // 1. Add Lot record
        await db.lots.add(finalLot);

        // 2. Add Crate Allocations
        for (const a of allocations) {
          await db.crates.add({
            id: generateId(),
            lot_id: lotId,
            fruit_type: a.fruit,
            quality_grade: a.grade,
            qty: a.qty,
            gross_weight_kg: parseFloat(a.gross_weight.toFixed(2)),
            tare_weight_kg: parseFloat(a.tare_weight.toFixed(2)),
            net_weight_kg: parseFloat(a.net_weight.toFixed(2)),
            rate_per_kg: a.rate,
            sale_amount: a.amount,
            buyer_id: a.buyer_id,
            buyer_name: a.buyer_name,
            payment_mode: a.mode,
            is_sold: true
          });
        }

        // 3. Add Seller Charges
        for (const ch of summary.charges) {
          await db.charges.add({
            id: generateId(),
            lot_id: lotId,
            charge_type: ch.type,
            amount: ch.amt,
            notes: ch.desc
          });
        }

        // 4. Group allocations by buyer to post to Khata Ledger
        const buyerAmounts: Record<string, { cash: number; credit: number }> = {};
        allocations.forEach(a => {
          if (!buyerAmounts[a.buyer_id]) {
            buyerAmounts[a.buyer_id] = { cash: 0, credit: 0 };
          }
          if (a.mode === 'credit') {
            buyerAmounts[a.buyer_id].credit += a.amount;
          } else {
            buyerAmounts[a.buyer_id].cash += a.amount;
          }
        });

        // Add buyer charges to persistence
        for (const ch of summary.buyer_charges) {
          await db.charges.add({
            id: generateId(),
            lot_id: lotId,
            charge_type: ch.type,
            amount: ch.amt,
            notes: ch.desc,
            buyer_id: ch.buyer_id,
            buyer_name: ch.buyer_name,
            qty: ch.qty,
            rate: ch.rate
          });
        }

        // 5. Update Buyer outstanding and add Khata ledgers
        for (const buyerId of Object.keys(buyerAmounts)) {
          const credAmt = buyerAmounts[buyerId].credit;
          const buyerCharges = summary.buyer_charges.filter(c => c.buyer_id === buyerId);
          const buyerChargesAmt = buyerCharges.reduce((s, c) => s + c.amt, 0);
          
          const totalToCharge = credAmt + buyerChargesAmt;
          
          if (totalToCharge > 0) {
            const b = await db.parties.get(buyerId);
            if (b) {
              const newBalance = b.current_outstanding + totalToCharge;
              await db.parties.update(buyerId, { current_outstanding: newBalance });
              await db.khata.add({
                id: generateId(),
                buyer_id: buyerId,
                buyer_name: b.name,
                transaction_type: 'sale_credit',
                amount: totalToCharge,
                lot_id: lotId,
                reference_note: `Crates purchase (credit: ₹${credAmt}) + charges (₹${buyerChargesAmt}) for lot: ${lotId}`,
                date: new Date().toISOString(),
                balance_after: newBalance
              });
            }
          }
        }

        // 6. Credit Labor Crew if selected
        if (labourId) {
          const lb = await db.labourList.get(labourId);
          if (lb) {
            const labCharge = summary.charges.find(c => c.type === 'labour');
            const amtToCredit = labCharge ? labCharge.amt : (totalCrates * (lb.rate_per_crate || 15));

            await db.labourTransactions.add({
              id: 'lt_' + generateId(),
              labour_id: labourId,
              date: new Date().toISOString(),
              type: 'work',
              description: `Lot unloading crew charges: ${lotId} (${totalCrates} Crates)`,
              crates: totalCrates,
              rate: lb.rate_per_crate || 15,
              amount: amtToCredit
            });

            await db.labourList.update(labourId, {
              current_balance: lb.current_balance + amtToCredit
            });
          }
        }
      });

      // Reset Draft
      localStorage.removeItem('ca_draft_nl');
      triggerToast('Lot finalized successfully!', 'success');
      onNavigate('lots');
    } catch (err: any) {
      triggerToast(err.message || 'Database error finalizing lot', 'warning');
    }
  };

  const cancelWizard = () => {
    if (confirm('Cancel and discard this lot draft?')) {
      localStorage.removeItem('ca_draft_nl');
      onNavigate('lots');
    }
  };

  const sellers = parties.filter(p => p.type === 'seller');
  const buyers = parties.filter(p => p.type === 'buyer');

  return (
    <div className="flex-grow overflow-y-auto px-3.5 py-4 lg:p-6 pb-28 lg:pb-6 space-y-4 lg:space-y-6 animate-fade-in bg-slate-950 text-slate-200">
      {/* Toast */}
      {toastMsg && (
        <div className={`fixed bottom-4 right-4 z-50 px-6 py-3 rounded-xl shadow-xl font-medium text-sm border ${
          toastType === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-rose-500 border-rose-400 text-white'
        }`}>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold tracking-tight text-white font-display">New Seller Lot</h1>
          <p className="text-slate-400 text-xs lg:text-sm mt-0.5">Auction invoicing and crate distribution wizard.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <span className="text-xs font-extrabold text-blue-400 uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-3.5 py-2 rounded-xl">
            Step {step} of 4
          </span>
          <button 
            onClick={cancelWizard}
            className="px-4 py-2 border border-slate-800 text-xs font-bold text-slate-400 hover:text-rose-455 bg-slate-900/60 hover:bg-slate-850 rounded-xl cursor-pointer transition duration-200 hover-lift"
          >
            Discard Draft
          </button>
        </div>
      </div>

      {/* Progress Line */}
      <div className="glass-panel p-3.5 rounded-3xl border border-slate-850 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {[
            { stepNum: 1, label: 'Seller & Crew', desc: 'Select Mandi client' },
            { stepNum: 2, label: 'Crate Specs', desc: 'Add weight & rate' },
            { stepNum: 3, label: 'Buyer Allocations', desc: 'Distribute crates' },
            { stepNum: 4, label: 'Settlement Account', desc: 'Finalize receipts' }
          ].map((item, i) => {
            const isCurrent = step === item.stepNum;
            const isCompleted = step > item.stepNum;
            return (
              <React.Fragment key={item.stepNum}>
                <div className="flex-grow flex items-center gap-3 group">
                  <div className={`w-8.5 h-8.5 rounded-2xl flex items-center justify-center font-extrabold font-display text-xs border transition-all duration-300 shrink-0 ${
                    isCurrent
                      ? 'bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-500/20 scale-105 glow-blue'
                      : isCompleted
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-950 border-slate-850 text-slate-500'
                  }`}>
                    {item.stepNum}
                  </div>
                  <div className="truncate">
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${
                      isCurrent ? 'text-white' : isCompleted ? 'text-emerald-450' : 'text-slate-500'
                    }`}>
                      {item.label}
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 hidden md:block truncate">{item.desc}</p>
                  </div>
                </div>
                {i < 3 && (
                  <div className={`hidden md:block h-0.5 w-10 shrink-0 rounded-full transition-colors duration-350 ${
                    step > item.stepNum ? 'bg-gradient-to-r from-emerald-500 to-blue-500/30' : 'bg-slate-850'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* STEP 1: Seller and Crew Selection */}
      {step === 1 && (
        <div className="glass-panel border border-slate-850 rounded-3xl p-5 lg:p-8 max-w-xl mx-auto space-y-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-20 -top-20 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors"></div>
          
          <div className="flex items-center gap-3 border-b border-slate-850 pb-4">
            <Clipboard className="w-5.5 h-5.5 text-blue-450" />
            <h3 className="text-base lg:text-lg font-bold text-white font-display uppercase tracking-wider">Seller & Mandi Details</h3>
          </div>
          
          <div className="space-y-4">
            {/* Seller */}
            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1.5">Select Seller Client</label>
              <select
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none transition duration-200"
              >
                <option value="">-- Choose Seller --</option>
                {sellers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.address || 'No location'})</option>
                ))}
              </select>
            </div>

            {/* Arrival Date */}
            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1.5">Arrival Date & Time</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="datetime-local"
                  value={arrivalDate}
                  onChange={(e) => setArrivalDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Labor Crew */}
            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1.5">Allocate Loader Gang (Unloading Crew)</label>
              <select
                value={labourId}
                onChange={(e) => setLabourId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none transition duration-200"
              >
                <option value="">-- Choose Crew (Optional) --</option>
                {labourList.map(l => (
                  <option key={l.id} value={l.id}>{l.name} (Rate: ₹{l.rate_per_crate}/Crate)</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-850">
            <button
              onClick={nextStep1}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-lg shadow-blue-500/10 cursor-pointer hover:scale-[1.02] transition"
            >
              <span>Next: Crate Specs</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {/* STEP 2: Crate details entry */}
      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
          {/* Left panel Form */}
          <div className="glass-panel rounded-3xl p-5 lg:p-6 h-fit space-y-5 shadow-2xl relative overflow-hidden group">
            <div className="absolute -right-20 -top-20 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors"></div>
            
            <div className="flex items-center gap-3 border-b border-slate-850 pb-4">
              <Layers className="w-5.5 h-5.5 text-blue-450" />
              <h3 className="text-base font-bold text-white font-display uppercase tracking-wider">Crate Specs</h3>
            </div>

            <div className="space-y-4">
              {/* Fruit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wider">Fruit</label>
                  <select
                    value={nc.fruit}
                    onChange={(e) => handleFruitGradeChange(e.target.value, nc.grade)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl text-xs text-slate-200 focus:outline-none transition duration-200"
                  >
                    {settings.fruit_types.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wider">Grade</label>
                  <input
                    type="text"
                    list="quality-grades-list"
                    value={nc.grade}
                    onChange={(e) => handleFruitGradeChange(nc.fruit, e.target.value)}
                    placeholder="e.g. A1"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl text-xs text-slate-200 focus:outline-none transition duration-200"
                  />
                  <datalist id="quality-grades-list">
                    {settings.quality_grades.map(g => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Qty & Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wider">Crate Count</label>
                  <input
                    type="number"
                    min="1"
                    value={nc.qty}
                    onChange={(e) => setNc(prev => ({ ...prev, qty: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl text-xs text-slate-200 focus:outline-none font-mono transition duration-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wider">Price / kg (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={nc.rate}
                    onChange={(e) => setNc(prev => ({ ...prev, rate: e.target.value }))}
                    placeholder="Rate / kg"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl text-xs text-slate-200 focus:outline-none font-mono transition duration-200"
                  />
                </div>
              </div>

              {/* Weight */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wider">Gross Wt (kg)</label>
                  <input
                    ref={grossInputRef}
                    type="number"
                    step="0.01"
                    min="0"
                    value={nc.gross}
                    onChange={(e) => setNc(prev => ({ ...prev, gross: e.target.value }))}
                    placeholder="e.g. 15.5"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl text-xs text-slate-200 focus:outline-none font-mono transition duration-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wider">Tare Box Wt</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={nc.tare}
                    onChange={(e) => setNc(prev => ({ ...prev, tare: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl text-xs text-slate-200 focus:outline-none font-mono transition duration-200"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={addCrateItem}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10 hover:scale-[1.02] transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Crate Entry</span>
            </button>
          </div>

          {/* Right panel Table of items */}
          <div className="lg:col-span-2 glass-panel rounded-3xl p-5 lg:p-6 shadow-2xl flex flex-col justify-between min-h-[380px] relative overflow-hidden group">
            <div className="absolute -right-20 -top-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors"></div>
            
            <div>
              <h3 className="text-base font-bold text-white font-display mb-4 uppercase tracking-wider">Crates List ({items.length} records)</h3>
              
              {/* Desktop Table view */}
              <div className="hidden md:block overflow-x-auto">
                {items.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-sm">
                    <Layers className="w-10 h-10 mb-2 opacity-30 text-blue-400" />
                    <span>No crates entered yet</span>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                        <th className="py-3 px-4">Fruit / Grade</th>
                        <th className="py-3 px-4 text-center">Crates</th>
                        <th className="py-3 px-4 text-right">Gross/Cr</th>
                        <th className="py-3 px-4 text-right">Net Wt. Total</th>
                        <th className="py-3 px-4 text-right">Auction Rate</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/40">
                      {items.map(item => (
                        <tr key={item.id} className="hover:bg-slate-900/40 transition duration-150">
                          <td className="py-3 px-4 font-semibold text-white">
                            {item.fruit} <span className="text-[10px] text-blue-450 font-bold ml-1 px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/10">{item.grade}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-xs text-slate-350 font-bold">{item.qty}</td>
                          <td className="py-3 px-4 text-right font-mono text-xs text-slate-400">{item.gross} kg</td>
                          <td className="py-3 px-4 text-right font-mono text-xs text-slate-300">{item.net_total.toFixed(1)} kg</td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-400 font-mono text-xs">₹{item.rate}/kg</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => deleteCrateItem(item.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-450 rounded-xl hover:bg-rose-500/10 cursor-pointer transition"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Mobile Card List view */}
              <div className="md:hidden space-y-3 pr-1">
                {items.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-xs">
                    <Layers className="w-8 h-8 mb-2 opacity-30 text-blue-400" />
                    <span>No crates entered yet</span>
                  </div>
                ) : (
                  items.map(item => (
                    <div key={item.id} className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-2xl flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-xs">{item.fruit}</span>
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-lg text-[9px] uppercase tracking-wide font-sans font-bold">{item.grade}</span>
                        </div>
                        <button
                          onClick={() => deleteCrateItem(item.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-450 rounded-xl hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                      <div className="flex justify-between items-end text-xs font-mono">
                        <div className="text-slate-400 text-[11px]">
                          <div>Qty: <span className="text-slate-200 font-bold">{item.qty} Crates</span></div>
                          <div className="text-[10px] text-slate-500 mt-0.5">Gross: {item.gross}kg | Net: {item.net_total.toFixed(1)}kg</div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-450 text-xs">₹{item.rate}/kg</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-850 mt-4">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 bg-slate-900 border border-slate-850 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                onClick={nextStep2}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10 hover:scale-[1.02] transition"
              >
                <span>Next: Buyer Allocations</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Allocations to buyers */}
      {step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Allocation input Form */}
          <div className="glass-panel rounded-3xl p-5 lg:p-6 h-fit space-y-5 shadow-2xl relative overflow-hidden group">
            <div className="absolute -right-20 -top-20 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl group-hover:bg-purple-500/10 transition-colors"></div>
            
            <div className="flex items-center gap-3 border-b border-slate-850 pb-4">
              <Users className="w-5.5 h-5.5 text-blue-450" />
              <h3 className="text-base font-bold text-white font-display uppercase tracking-wider">Crates Allocations</h3>
            </div>

            <div className="space-y-4">
              {/* Target item */}
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wider">Select Lot Grade</label>
                <select
                  value={allocForm.item_id}
                  onChange={(e) => handleAllocItemChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl text-xs text-slate-200 focus:outline-none transition duration-200"
                >
                  <option value="">-- Choose Item --</option>
                  {items.map(item => {
                    const left = item.qty - item.sold_qty;
                    return (
                      <option key={item.id} value={item.id}>
                        {item.fruit} ({item.grade}) - {left} left of {item.qty}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Select Buyer */}
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wider">Assign to Buyer</label>
                <select
                  value={allocForm.buyer_id}
                  onChange={(e) => setAllocForm(prev => ({ ...prev, buyer_id: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl text-xs text-slate-200 focus:outline-none transition duration-200"
                >
                  <option value="">-- Choose Buyer --</option>
                  {buyers.map(b => (
                    <option key={b.id} value={b.id}>{b.name} (Limit: ₹{b.credit_limit})</option>
                  ))}
                </select>
              </div>

              {/* Quantity and Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wider">Crates Allocated</label>
                  <input
                    type="number"
                    min="1"
                    value={allocForm.qty}
                    onChange={(e) => setAllocForm(prev => ({ ...prev, qty: e.target.value }))}
                    placeholder="Crates Count"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl text-xs text-slate-200 focus:outline-none font-mono transition duration-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wider">Final Bid / kg (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={allocForm.rate}
                    onChange={(e) => setAllocForm(prev => ({ ...prev, rate: e.target.value }))}
                    placeholder="Rate"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-xl text-xs text-slate-200 focus:outline-none font-mono transition duration-200"
                  />
                </div>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wider">Payment Terms</label>
                <div className="grid grid-cols-4 gap-1.5 bg-slate-950 p-1 border border-slate-850 rounded-xl">
                  {(['cash', 'credit', 'upi', 'bank'] as PaymentMode[]).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAllocForm(prev => ({ ...prev, mode }))}
                      className={`py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider cursor-pointer transition ${
                        allocForm.mode === mode
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                          : 'text-slate-500 hover:text-slate-350 hover:bg-slate-900/50'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={addAllocRecord}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10 hover:scale-[1.02] transition"
            >
              <Plus className="w-4 h-4" />
              <span>Allocate Crates</span>
            </button>
          </div>

          {/* Allocation Table */}
          <div className="lg:col-span-2 glass-panel rounded-3xl p-5 lg:p-6 shadow-2xl flex flex-col justify-between min-h-[380px] relative overflow-hidden group">
            <div className="absolute -right-20 -top-20 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors"></div>

            <div>
              <h3 className="text-base font-bold text-white font-display mb-4 uppercase tracking-wider">Allocation Ledger ({allocations.length} items)</h3>
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                {allocations.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-sm">
                    <Users className="w-10 h-10 mb-2 opacity-30 text-blue-450" />
                    <span>No buyer allocations made yet</span>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                        <th className="py-3 px-4">Grade</th>
                        <th className="py-3 px-4">Buyer Name</th>
                        <th className="py-3 px-4 text-center">Crates</th>
                        <th className="py-3 px-4 text-right">Net Weight</th>
                        <th className="py-3 px-4 text-right">Bid</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                        <th className="py-3 px-4 text-center">Terms</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/40">
                      {allocations.map((a, idx) => (
                        <tr key={a.id} className="hover:bg-slate-900/40 transition duration-150">
                          <td className="py-3 px-4 font-semibold text-white">
                            {a.fruit} <span className="text-[10px] text-blue-455 font-bold ml-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/10">{a.grade}</span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-300 truncate max-w-[120px]">{a.buyer_name}</td>
                          <td className="py-3 px-4 text-center font-mono text-xs text-slate-200 font-bold">{a.qty}</td>
                          <td className="py-3 px-4 text-right font-mono text-xs text-slate-400">{a.net_weight.toFixed(1)} kg</td>
                          <td className="py-3 px-4 text-right font-mono text-xs text-slate-400 font-bold">₹{a.rate}/kg</td>
                          <td className="py-3 px-4 text-right font-extrabold text-emerald-400 font-mono text-xs">₹{a.amount.toFixed(0)}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider ${
                              a.mode === 'credit' 
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/10' 
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                            }`}>
                              {a.mode}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => removeAllocRecord(idx)}
                              className="p-1.5 text-slate-500 hover:text-rose-455 rounded-xl hover:bg-rose-500/10 cursor-pointer transition"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Mobile Card List View */}
              <div className="md:hidden space-y-3 pr-1">
                {allocations.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-xs">
                    <Users className="w-8 h-8 mb-2 opacity-30 text-blue-450" />
                    <span>No buyer allocations made yet</span>
                  </div>
                ) : (
                  allocations.map((a, idx) => (
                    <div key={a.id} className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-2xl flex flex-col gap-2.5">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-xs">{a.fruit}</span>
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-lg text-[9px] uppercase tracking-wide font-sans font-bold">{a.grade}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider ${
                            a.mode === 'credit' 
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/10' 
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                          }`}>
                            {a.mode}
                          </span>
                          <button
                            onClick={() => removeAllocRecord(idx)}
                            className="p-1.5 text-slate-500 hover:text-rose-450 rounded-lg hover:bg-rose-500/10 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-end text-xs">
                        <div className="text-[11px]">
                          <div className="text-slate-350">Buyer: <span className="font-bold text-white">{a.buyer_name}</span></div>
                          <div className="text-[10px] text-slate-505 font-mono mt-0.5">Qty: {a.qty} Cr. ({a.net_weight.toFixed(1)}kg) @ ₹{a.rate}/kg</div>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-emerald-400 font-mono text-xs">₹{a.amount.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-850 mt-4">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 bg-slate-900 border border-slate-850 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                onClick={nextStep3}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10 hover:scale-[1.02] transition"
              >
                <span>Next: Settlement Summary</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Settlement Fees and Finalization */}
      {step === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Seller settlement */}
          <div className="glass-panel border border-slate-850 rounded-3xl p-5 lg:p-6 shadow-2xl space-y-4 relative overflow-hidden group">
            <div className="absolute -right-20 -top-20 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors"></div>
            
            <h3 className="text-base font-bold text-white font-display border-b border-slate-850 pb-3 uppercase tracking-wider">
              Seller Settlement
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between text-sm text-slate-400">
                <span className="font-medium">Gross Auction Sales</span>
                <span className="font-mono text-white font-bold">₹{summary.gross.toLocaleString('en-IN')}</span>
              </div>
              
              <div className="border-t border-slate-850/80 pt-4 space-y-3">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Seller Deductions</span>
                {summary.charges.map((ch, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 text-xs font-medium">{ch.desc}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 text-xs font-bold">₹</span>
                      <input
                        type="number"
                        value={ch.amt}
                        onChange={(e) => adjustSellerCharge(idx, e.target.value)}
                        className="w-20 px-2 py-1.5 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-lg text-right text-xs font-mono text-white focus:outline-none transition duration-150"
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-slate-850 pt-4 flex justify-between items-center">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Net Payable to Seller</span>
                <span className="text-lg font-extrabold text-emerald-400 font-mono">₹{summary.net.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Buyer settlement */}
          <div className="glass-panel border border-slate-850 rounded-3xl p-5 lg:p-6 shadow-2xl space-y-4 relative overflow-hidden group">
            <div className="absolute -right-20 -top-20 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors"></div>

            <h3 className="text-base font-bold text-white font-display border-b border-slate-850 pb-3 uppercase tracking-wider">
              Buyers Surcharge
            </h3>
            <div className="space-y-4 pr-1">
              {summary.buyer_charges.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No buyers allocated. Go back to step 3.</p>
              ) : (
                summary.buyer_charges.map((ch, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3.5 bg-slate-950/40 rounded-2xl border border-slate-850">
                    <div>
                      <h4 className="text-xs font-bold text-white truncate max-w-[120px]">{ch.buyer_name}</h4>
                      <p className="text-[10px] text-slate-505 mt-0.5 font-bold uppercase tracking-wider">{ch.desc} ({ch.qty} Cr.)</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 text-xs font-bold">₹</span>
                      <input
                        type="number"
                        value={ch.amt}
                        onChange={(e) => adjustBuyerCharge(idx, e.target.value)}
                        className="w-20 px-2 py-1.5 bg-slate-955 border border-slate-850 hover:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-lg text-right text-xs font-mono text-white focus:outline-none transition duration-150"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Finalize options */}
          <div className="glass-panel border border-slate-850 rounded-3xl p-5 lg:p-6 shadow-2xl flex flex-col justify-between h-full min-h-[280px] relative overflow-hidden group">
            <div className="absolute -right-20 -top-20 w-40 h-40 bg-rose-500/5 rounded-full blur-3xl group-hover:bg-rose-500/10 transition-colors"></div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-rose-400">
                <ShieldAlert className="w-5.5 h-5.5 shrink-0" />
                <h3 className="text-xs font-bold font-display uppercase tracking-wider">Final review</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                Confirming finalization will register a transaction in the lots ledger, update the allocated buyer balances in their Khata, and credit wages to the loaders crew directory.
              </p>
              <div className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <span>Total Crates Count:</span>
                  <span className="font-mono font-extrabold text-white text-xs">{items.reduce((s, i) => s + i.qty, 0)}</span>
                </div>
                <div className="flex justify-between text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <span>Buyer Ledger Credit:</span>
                  <span className="font-mono font-extrabold text-rose-400 text-xs">
                    ₹{allocations.filter(a => a.mode === 'credit').reduce((s, a) => s + a.amount, 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-850 mt-4">
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 bg-slate-900 border border-slate-850 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                onClick={handleFinalize}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-650 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10 hover:scale-[1.02] transition"
              >
                <Award className="w-4.5 h-4.5" />
                <span>Finalize Transaction</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
