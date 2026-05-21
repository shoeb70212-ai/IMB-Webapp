import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Chart, registerables } from 'chart.js';
import { TrendingUp, Users, DollarSign, Archive, ArrowUpRight, ArrowDownRight, Clock, PlusCircle, Sparkles, AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';

import { generateInsights } from '../utils/insightsEngine';

Chart.register(...registerables);

interface DashboardProps {
  onNavigate: (tab: string, param?: any) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  // Dexie live queries
  const lots = useLiveQuery(() => db.lots.toArray()) || [];
  const parties = useLiveQuery(() => db.parties.toArray()) || [];
  const cashbook = useLiveQuery(() => db.cashbook.toArray()) || [];
  const charges = useLiveQuery(() => db.charges.toArray()) || [];
  const crates = useLiveQuery(() => db.crates.toArray()) || [];
  const workers = useLiveQuery(() => db.labourList.toArray()) || [];
  const khata = useLiveQuery(() => db.khata.toArray()) || [];

  // Local state for advisor insights
  const [showInsights, setShowInsights] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Generate smart advisor insights (locally calculated, wrapped in try-catch for isolation)
  let insights = null;
  if (showInsights) {
    try {
      insights = generateInsights(parties, lots, crates, khata, cashbook, workers);
    } catch (e) {
      console.error('Error generating smart insights:', e);
    }
  }

  // Memoize statistics to avoid unnecessary re-renders and state updates
  const stats = React.useMemo(() => {
    // 1. Calculate Outstanding Credit (sum of all buyer outstanding balances)
    const outstanding = parties
      .filter(p => p.type === 'buyer')
      .reduce((sum, p) => sum + (p.current_outstanding || 0), 0);

    // 2. Calculate Daily Cashbook Balance (all receipt amounts minus payment amounts)
    const cashIn = cashbook
      .filter(e => e.entry_type === 'receipt')
      .reduce((sum, e) => sum + e.amount, 0);
    const cashOut = cashbook
      .filter(e => e.entry_type === 'payment')
      .reduce((sum, e) => sum + e.amount, 0);
    const cashBalance = cashIn - cashOut;

    // 3. Calculate Unpaid Seller Dues (net payable for lots with status 'auctioned')
    const unpaid = lots
      .filter(l => l.status === 'auctioned')
      .reduce((sum, l) => sum + l.net_payable_to_seller, 0);

    // 4. Calculate Commission Earned (charges of type 'commission')
    const commission = charges
      .filter(c => c.charge_type === 'commission')
      .reduce((sum, c) => sum + c.amount, 0);

    return {
      cashBalance,
      unpaidSellers: unpaid,
      outstandingCredit: outstanding,
      commissionEarned: commission
    };
  }, [lots, parties, cashbook, charges]);

  // Chart Rendering
  useEffect(() => {
    if (!canvasRef.current) return;
    
    // O(L) pre-mapping of lots to their arrival dates
    const lotMap = new Map<string, string>();
    lots.forEach(l => {
      if (l.arrival_date) {
        lotMap.set(l.id, l.arrival_date.substring(0, 10));
      }
    });

    // O(C) aggregation of daily commissions
    const dailyCommissions = new Map<string, number>();
    charges
      .filter(c => c.charge_type === 'commission')
      .forEach(ch => {
        const lotArrivalDate = lotMap.get(ch.lot_id);
        if (lotArrivalDate) {
          dailyCommissions.set(lotArrivalDate, (dailyCommissions.get(lotArrivalDate) || 0) + ch.amount);
        }
      });

    // Aggregate commissions for last 14 days
    const labels: string[] = [];
    const data: number[] = [];
    
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Label in MM-DD format
      labels.push(dateStr.substring(5));
      
      const dailySum = dailyCommissions.get(dateStr) || 0;
      data.push(dailySum);
    }

    const isLight = document.body.getAttribute('data-theme') === 'light';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
    const textColor = isLight ? '#545049' : '#a1a1aa';

    if (chartInstanceRef.current) {
      // Update existing chart to prevent re-creation flicker
      chartInstanceRef.current.data.labels = labels;
      chartInstanceRef.current.data.datasets[0].data = data;
      if (chartInstanceRef.current.options.scales?.y?.grid) {
        chartInstanceRef.current.options.scales.y.grid.color = gridColor;
      }
      if (chartInstanceRef.current.options.scales?.y?.ticks) {
        chartInstanceRef.current.options.scales.y.ticks.color = textColor;
      }
      if (chartInstanceRef.current.options.scales?.x?.ticks) {
        chartInstanceRef.current.options.scales.x.ticks.color = textColor;
      }
      chartInstanceRef.current.update();
    } else {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        chartInstanceRef.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Commission (₹)',
              data,
              backgroundColor: 'rgba(14, 165, 233, 0.75)',
              borderColor: 'rgb(14, 165, 233)',
              borderWidth: 1,
              borderRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: {
                beginAtZero: true,
                grid: { color: gridColor },
                ticks: { color: textColor, font: { family: 'Inter' } }
              },
              x: {
                grid: { display: false },
                ticks: { color: textColor, font: { family: 'Inter' } }
              }
            }
          }
        });
      }
    }

    return () => {
      // Keep instance alive during state updates but clean up on unmount
    };
  }, [charges, lots]);

  // Clean up chart on unmount explicitly
  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  // Recent lots
  const recentLots = [...lots]
    .sort((a, b) => new Date(b.arrival_date).getTime() - new Date(a.arrival_date).getTime())
    .slice(0, 5);

  // Top buyers with highest outstanding
  const topBuyers = [...parties]
    .filter(p => p.type === 'buyer')
    .sort((a, b) => (b.current_outstanding || 0) - (a.current_outstanding || 0))
    .slice(0, 5);  return (
    <div className="flex-grow overflow-y-auto px-4 py-5 lg:p-8 pb-28 lg:pb-8 space-y-6 lg:space-y-8 animate-fade-in bg-slate-950 text-slate-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-white font-display bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
            Dashboard Overview
          </h1>
          <p className="text-slate-400 text-xs lg:text-sm mt-1">
            Real-time summaries of mandi transactions, active credit books, and commission margins.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto shrink-0">
          <button
            onClick={() => {
              if (showInsights) {
                setShowInsights(false);
              } else {
                setLoadingInsights(true);
                setTimeout(() => {
                  setLoadingInsights(false);
                  setShowInsights(true);
                }, 800);
              }
            }}
            disabled={loadingInsights}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900/80 hover:bg-slate-800 text-blue-400 border border-blue-500/30 hover:border-blue-500/60 font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition duration-300 disabled:opacity-50 shadow-md backdrop-blur"
          >
            <Sparkles className={`w-4.5 h-4.5 text-blue-400 ${loadingInsights ? 'animate-spin' : 'animate-pulse'}`} />
            <span>{loadingInsights ? 'Analyzing Mandi...' : showInsights ? 'Hide Smart Insights' : 'Mandi AI Insights'}</span>
          </button>

          <button 
            id="btn-new-lot"
            onClick={() => onNavigate('new_lot')}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-blue-600 via-blue-650 to-indigo-650 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/15 hover:shadow-blue-500/25 transition duration-300 hover:scale-[1.02]"
          >
            <PlusCircle className="w-5 h-5 text-white" />
            <span>New Seller Lot</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
        {/* Card 1: Galla */}
        <div className="glass-panel rounded-3xl p-5 lg:p-6 hover-lift glow-emerald transition duration-300 relative overflow-hidden group border border-slate-850">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] lg:text-xs font-extrabold uppercase tracking-wider text-slate-400 font-display">Cash Balance (Galla)</p>
              <h3 className="text-2xl lg:text-3xl font-extrabold font-display mt-2 text-white tracking-tight">
                ₹{stats.cashBalance.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20 shadow-inner">
              <DollarSign className="w-5.5 h-5.5" />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-1.5 text-xs text-emerald-450 font-semibold">
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            <span>Active Cash drawer balance</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
        </div>

        {/* Card 2: Unpaid Seller Dues */}
        <div className="glass-panel rounded-3xl p-5 lg:p-6 hover-lift glow-amber transition duration-300 relative overflow-hidden group border border-slate-850">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] lg:text-xs font-extrabold uppercase tracking-wider text-slate-400 font-display">Unpaid Seller Dues</p>
              <h3 className="text-2xl lg:text-3xl font-extrabold font-display mt-2 text-white tracking-tight">
                ₹{stats.unpaidSellers.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-400 border border-amber-500/20 shadow-inner">
              <Clock className="w-5.5 h-5.5" />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
            <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
            <span>Awaiting payout settlement</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-amber-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
        </div>

        {/* Card 3: Outstanding Credits */}
        <div className="glass-panel rounded-3xl p-5 lg:p-6 hover-lift glow-rose transition duration-300 relative overflow-hidden group border border-slate-850">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] lg:text-xs font-extrabold uppercase tracking-wider text-slate-400 font-display">Buyer Outstandings</p>
              <h3 className="text-2xl lg:text-3xl font-extrabold font-display mt-2 text-white tracking-tight">
                ₹{stats.outstandingCredit.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-455 border border-rose-500/20 shadow-inner">
              <Users className="w-5.5 h-5.5" />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-1.5 text-xs text-rose-455 font-semibold">
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
            <span>Uncollected credit sales</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-rose-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
        </div>

        {/* Card 4: Commissions Earned */}
        <div className="glass-panel rounded-3xl p-5 lg:p-6 hover-lift glow-blue transition duration-300 relative overflow-hidden group border border-slate-850">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] lg:text-xs font-extrabold uppercase tracking-wider text-slate-400 font-display">Total Commissions</p>
              <h3 className="text-2xl lg:text-3xl font-extrabold font-display mt-2 text-white tracking-tight">
                ₹{stats.commissionEarned.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 border border-blue-500/20 shadow-inner">
              <TrendingUp className="w-5.5 h-5.5" />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-1.5 text-xs text-blue-450 font-semibold">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span>Accumulated agent commissions</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
        </div>
      </div>

      {/* Smart Mandi Advisor Panel */}
      {(showInsights || loadingInsights) && (
        <div className="glass-panel rounded-3xl p-5 lg:p-8 border border-blue-500/20 shadow-xl relative overflow-hidden group animate-fade-in">
          {/* Ambient gradient back-glow */}
          <div className="absolute -right-24 -top-24 w-56 h-56 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/15 transition-all duration-500"></div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-slate-850 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600/15 text-blue-400 rounded-xl border border-blue-500/25 shadow-inner">
                <Sparkles className={`w-5.5 h-5.5 ${loadingInsights ? 'animate-spin' : 'animate-pulse text-blue-400'}`} />
              </div>
              <div>
                <h3 className="text-base lg:text-lg font-extrabold text-white font-display">Smart Mandi Advisor</h3>
                <p className="text-xs text-slate-400 mt-0.5">Real-time ledger analysis and operational warnings computed locally.</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[10px] font-extrabold text-blue-400 uppercase tracking-widest font-display">
              Local AI Engine
            </span>
          </div>

          {loadingInsights ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="relative flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-blue-500/10 border-t-2 border-t-blue-400 animate-spin"></div>
                <Sparkles className="w-5 h-5 text-blue-400 absolute animate-pulse" />
              </div>
              <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">Auditing local databases & compiling insights...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {insights && insights.alerts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {insights.alerts.map((alert) => {
                    const alertStyles = {
                      danger: {
                        bg: 'bg-rose-500/5 border-rose-500/20 text-rose-200 hover:bg-rose-500/10 hover:border-rose-500/40 hover:shadow-[0_0_15px_-3px_rgba(244,63,94,0.15)]',
                        iconBg: 'bg-rose-500/10 text-rose-455 border border-rose-500/20',
                        icon: <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
                      },
                      warning: {
                        bg: 'bg-amber-500/5 border-amber-500/20 text-amber-200 hover:bg-amber-500/10 hover:border-amber-500/40 hover:shadow-[0_0_15px_-3px_rgba(245,158,11,0.15)]',
                        iconBg: 'bg-amber-500/10 text-amber-455 border border-amber-500/20',
                        icon: <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                      },
                      success: {
                        bg: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-200 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:shadow-[0_0_15px_-3px_rgba(16,185,129,0.15)]',
                        iconBg: 'bg-emerald-500/10 text-emerald-455 border border-emerald-500/20',
                        icon: <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
                      },
                      info: {
                        bg: 'bg-blue-500/5 border-blue-500/20 text-blue-200 hover:bg-blue-500/10 hover:border-blue-500/40 hover:shadow-[0_0_15px_-3px_rgba(59,130,246,0.15)]',
                        iconBg: 'bg-blue-500/10 text-blue-455 border border-blue-500/20',
                        icon: <Info className="w-4.5 h-4.5 shrink-0" />
                      }
                    }[alert.type] || {
                      bg: 'bg-slate-500/5 border-slate-500/20 text-slate-200',
                      iconBg: 'bg-slate-500/10 text-slate-400',
                      icon: <Info className="w-4.5 h-4.5 shrink-0" />
                    };

                    return (
                      <div 
                        key={alert.id} 
                        className={`p-4 rounded-2xl border flex gap-3.5 items-start transition-all duration-300 hover:scale-[1.01] ${alertStyles.bg}`}
                      >
                        <div className={`p-2 rounded-xl shrink-0 ${alertStyles.iconBg}`}>
                          {alertStyles.icon}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <h4 className="text-xs font-extrabold text-white uppercase tracking-widest font-display">{alert.title}</h4>
                          <p className="text-xs text-slate-400 leading-relaxed font-semibold">{alert.message}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                  <div className="p-3 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-400 shadow-md">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h4 className="text-sm font-extrabold text-white uppercase tracking-widest font-display">All Systems Nominal</h4>
                  <p className="text-xs text-slate-400 max-w-md font-semibold">
                    No active warnings detected. All buyer credits, seller lot settlements, and cash drawers are in alignment.
                  </p>
                </div>
              )}
              
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowInsights(false)}
                  className="px-4 py-2 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/60 text-slate-400 hover:text-white text-xs font-bold rounded-xl cursor-pointer transition duration-200"
                >
                  Close Panel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visual Chart & Recents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Commission Chart */}
        <div className="lg:col-span-2 glass-panel rounded-3xl p-5 lg:p-6 flex flex-col h-[280px] lg:h-[380px] border border-slate-850 relative overflow-hidden group">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-sm lg:text-base font-extrabold text-white font-display uppercase tracking-wider">
                Daily Commission Volume
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Aggregated agency commissions over trailing two weeks.</p>
            </div>
            <span className="px-3 py-1 rounded-xl bg-slate-950 text-[10px] text-slate-400 border border-slate-800 font-mono font-bold">
              Last 14 Days
            </span>
          </div>
          <div className="flex-grow min-h-0 relative">
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* Top Debtors */}
        <div className="glass-panel rounded-3xl p-5 lg:p-6 flex flex-col h-[280px] lg:h-[380px] border border-slate-850 relative overflow-hidden group">
          <div className="mb-4">
            <h3 className="text-sm lg:text-base font-extrabold text-white font-display uppercase tracking-wider">
              Top Debtors (Khata)
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Buyers with highest outstanding credit balances.</p>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
            {topBuyers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs lg:text-sm">
                <Users className="w-8 h-8 mb-2 opacity-30 text-slate-655" />
                <span className="font-semibold">No buyer balances found</span>
              </div>
            ) : (
              topBuyers.map(b => (
                <div 
                  key={b.id} 
                  onClick={() => onNavigate('khata', b)}
                  className="flex justify-between items-center p-3.5 bg-slate-950/45 hover:bg-slate-900/60 border border-slate-850 rounded-2xl cursor-pointer hover:border-rose-500/25 hover:shadow-[0_0_12px_rgba(244,63,94,0.06)] transition-all duration-300 hover:scale-[1.01] group/item"
                >
                  <div className="truncate pr-2">
                    <h4 className="text-xs lg:text-sm font-bold text-white group-hover/item:text-blue-400 transition-colors truncate">
                      {b.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-mono mt-1 font-semibold">{b.phone || 'No phone record'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs lg:text-sm font-extrabold text-rose-455 font-mono block">
                      ₹{b.current_outstanding.toLocaleString('en-IN')}
                    </span>
                    <p className="text-[8px] text-slate-500 uppercase font-extrabold tracking-widest mt-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      Open Ledger &rarr;
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Lots */}
      <div className="glass-panel rounded-3xl p-5 lg:p-6 border border-slate-850">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-sm lg:text-base font-extrabold text-white font-display uppercase tracking-wider">
              Recent Arrivals & Lots
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Logs of newly arrived crates, auction bids, and status.</p>
          </div>
          <button 
            onClick={() => onNavigate('lots')}
            className="text-xs text-blue-450 hover:text-blue-300 font-bold cursor-pointer flex items-center gap-1 hover:translate-x-0.5 transition-transform"
          >
            <span>View All Mandi Lots</span>
            <span>&rarr;</span>
          </button>
        </div>
        
        {recentLots.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-sm">
            <Archive className="w-10 h-10 mb-2 opacity-30 text-slate-655" />
            <span className="font-semibold">No lots recorded yet</span>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">
                    <th className="py-3 px-4">Lot ID</th>
                    <th className="py-3 px-4">Seller Name</th>
                    <th className="py-3 px-4">Arrival Date & Time</th>
                    <th className="py-3 px-4 text-center">Total Crates</th>
                    <th className="py-3 px-4 text-right">Net Weight</th>
                    <th className="py-3 px-4 text-right">Net Payable</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/50">
                  {recentLots.map(l => (
                    <tr key={l.id} className="hover:bg-slate-900/30 transition-all duration-150 group/row">
                      <td className="py-4 px-4 font-extrabold text-white font-mono text-xs tracking-wider">
                        {l.id}
                      </td>
                      <td className="py-4 px-4 font-semibold text-slate-300 text-xs">
                        {l.seller_name}
                      </td>
                      <td className="py-4 px-4 text-slate-400 font-mono text-xs">
                        {new Date(l.arrival_date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </td>
                      <td className="py-4 px-4 text-center text-slate-200 font-mono font-bold text-xs">
                        {l.total_crates}
                      </td>
                      <td className="py-4 px-4 text-right text-slate-400 font-mono text-xs">
                        {l.total_weight_kg.toFixed(1)} kg
                      </td>
                      <td className="py-4 px-4 text-right font-extrabold text-emerald-450 font-mono text-xs">
                        ₹{l.net_payable_to_seller.toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-3 py-1 rounded-xl text-[9px] uppercase font-extrabold tracking-widest border inline-block ${
                          l.status === 'paid' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.06)]' 
                            : l.status === 'settled'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.06)]'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.06)] animate-pulse'
                        }`}>
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card-based View */}
            <div className="md:hidden space-y-4">
              {recentLots.map(l => (
                <div key={l.id} className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl flex flex-col gap-3 hover:border-slate-800/80 transition-colors">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-extrabold text-white text-xs tracking-wider">{l.id}</span>
                    <span className={`px-2.5 py-0.5 rounded-xl text-[9px] uppercase font-extrabold tracking-widest border ${
                      l.status === 'paid' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : l.status === 'settled'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {l.status}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-200 truncate">{l.seller_name}</h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-1 font-semibold">
                        {new Date(l.arrival_date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-slate-400 font-mono font-semibold">
                        {l.total_crates} Cr. | {l.total_weight_kg.toFixed(0)} kg
                      </p>
                      <p className="text-xs font-extrabold text-emerald-450 font-mono mt-1">
                        ₹{l.net_payable_to_seller.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
