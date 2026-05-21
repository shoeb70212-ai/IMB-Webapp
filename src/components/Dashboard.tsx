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
    .slice(0, 5);

  return (
    <div className="flex-grow overflow-y-auto px-3.5 py-4 lg:p-6 pb-28 lg:pb-6 space-y-4 lg:space-y-6 animate-fade-in bg-slate-950 text-slate-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 lg:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold tracking-tight text-white font-display">Dashboard Overview</h1>
          <p className="text-slate-400 text-[11px] md:text-xs lg:text-sm mt-0.5 lg:mt-1">Real-time summaries of mandi transactions and balances.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
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
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-blue-400 border border-blue-500/30 hover:border-blue-500/60 font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition duration-200 disabled:opacity-50"
          >
            <Sparkles className={`w-4.5 h-4.5 ${loadingInsights ? 'animate-spin' : ''}`} />
            <span>{loadingInsights ? 'Analyzing...' : showInsights ? 'Hide Insights' : 'AI Insights'}</span>
          </button>

          <button 
            id="btn-new-lot"
            onClick={() => onNavigate('new_lot')}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-blue-500/20 transition duration-200"
          >
            <PlusCircle className="w-5 h-5" />
            <span>New Seller Lot</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-5">
        {/* Card 1: Galla */}
        <div className="glass-panel rounded-2xl p-3.5 lg:p-5 hover:border-emerald-500/30 transition duration-300 relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] lg:text-xs font-semibold uppercase tracking-wider text-slate-400">Cash Balance (Galla)</p>
              <h3 className="text-xl lg:text-2xl font-bold font-display mt-1 lg:mt-2 text-white">₹{stats.cashBalance.toLocaleString('en-IN')}</h3>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <ArrowUpRight className="w-4 h-4" />
            <span>Active Cash drawer balance</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
        </div>

        {/* Card 2: Unpaid Seller Dues */}
        <div className="glass-panel rounded-2xl p-4 lg:p-5 hover:border-amber-500/30 transition duration-300 relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] lg:text-xs font-semibold uppercase tracking-wider text-slate-400">Unpaid Seller Dues</p>
              <h3 className="text-xl lg:text-2xl font-bold font-display mt-1 lg:mt-2 text-white">₹{stats.unpaidSellers.toLocaleString('en-IN')}</h3>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-amber-400 font-medium">
            <Clock className="w-4 h-4" />
            <span>Awaiting payout settlement</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-amber-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
        </div>

        {/* Card 3: Outstanding Credits */}
        <div className="glass-panel rounded-2xl p-4 lg:p-5 hover:border-rose-500/30 transition duration-300 relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] lg:text-xs font-semibold uppercase tracking-wider text-slate-400">Buyer Outstandings</p>
              <h3 className="text-xl lg:text-2xl font-bold font-display mt-1 lg:mt-2 text-white">₹{stats.outstandingCredit.toLocaleString('en-IN')}</h3>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-rose-400 font-medium">
            <ArrowDownRight className="w-4 h-4" />
            <span>Uncollected credit sales</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-rose-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
        </div>

        {/* Card 4: Commissions Earned */}
        <div className="glass-panel rounded-2xl p-4 lg:p-5 hover:border-blue-500/30 transition duration-300 relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] lg:text-xs font-semibold uppercase tracking-wider text-slate-400">Total Commissions</p>
              <h3 className="text-xl lg:text-2xl font-bold font-display mt-1 lg:mt-2 text-white">₹{stats.commissionEarned.toLocaleString('en-IN')}</h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-blue-400 font-medium">
            <TrendingUp className="w-4 h-4" />
            <span>Accumulated agent commissions</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
        </div>
      </div>

      {/* Smart Mandi Advisor Panel (Decoupled insights, wrapped in try-catch) */}
      {/* Smart Mandi Advisor Panel (Decoupled insights, wrapped in try-catch) */}
      {(showInsights || loadingInsights) && (
        <div className="glass-panel rounded-2xl p-4 lg:p-6 border border-blue-500/10 shadow-lg shadow-blue-950/10 relative overflow-hidden group">
          {/* Subtle animated light glow behind advisor */}
          <div className="absolute -right-24 -top-24 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors duration-500"></div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/15 rounded-lg text-blue-400">
                <Sparkles className={`w-5 h-5 ${loadingInsights ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <h3 className="text-sm lg:text-base font-bold text-white font-display">Smart Mandi Advisor</h3>
                <p className="text-[10px] text-slate-400">Operational alerts & business recommendations computed from local data.</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold text-blue-400 uppercase tracking-wider">
              Local AI Engine
            </span>
          </div>

          {loadingInsights ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-blue-400 animate-spin" />
              <p className="text-xs text-slate-400 font-medium">Analyzing mandi data & calculating real-time recommendations...</p>
            </div>
          ) : (
            <div>
              {insights && insights.alerts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {insights.alerts.map((alert) => {
                    const alertStyles = {
                      danger: {
                        bg: 'bg-rose-500/5 border-rose-500/10 text-rose-200',
                        iconBg: 'bg-rose-500/10 text-rose-455',
                        icon: <ShieldAlert className="w-4 h-4 shrink-0" />
                      },
                      warning: {
                        bg: 'bg-amber-500/5 border-amber-500/10 text-amber-200',
                        iconBg: 'bg-amber-500/10 text-amber-455',
                        icon: <AlertTriangle className="w-4 h-4 shrink-0" />
                      },
                      success: {
                        bg: 'bg-emerald-500/5 border-emerald-500/10 text-emerald-200',
                        iconBg: 'bg-emerald-500/10 text-emerald-455',
                        icon: <CheckCircle2 className="w-4 h-4 shrink-0" />
                      },
                      info: {
                        bg: 'bg-blue-500/5 border-blue-500/10 text-blue-200',
                        iconBg: 'bg-blue-500/10 text-blue-455',
                        icon: <Info className="w-4 h-4 shrink-0" />
                      }
                    }[alert.type] || {
                      bg: 'bg-slate-500/5 border-slate-500/10 text-slate-200',
                      iconBg: 'bg-slate-500/10 text-slate-400',
                      icon: <Info className="w-4 h-4 shrink-0" />
                    };

                    return (
                      <div 
                        key={alert.id} 
                        className={`p-3.5 rounded-xl border flex gap-3 items-start transition-all duration-300 hover:border-slate-700/50 ${alertStyles.bg}`}
                      >
                        <div className={`p-2 rounded-lg shrink-0 ${alertStyles.iconBg}`}>
                          {alertStyles.icon}
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">{alert.title}</h4>
                          <p className="text-xs text-slate-400 leading-relaxed font-medium">{alert.message}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white uppercase">All Systems Nominal</h4>
                  <p className="text-xs text-slate-400 max-w-sm">No active alerts. All seller accounts, buyer limits, cash drawers, and labor logs are in order.</p>
                </div>
              )}
              
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowInsights(false)}
                  className="px-3.5 py-1.5 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-400 hover:text-white text-xs font-bold rounded-xl cursor-pointer transition"
                >
                  Hide Insights
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visual Chart & Recents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Commission Chart */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-3.5 lg:p-5 flex flex-col h-[215px] lg:h-[350px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm lg:text-base font-bold text-white font-display">Daily Commission History</h3>
            <span className="text-[10px] text-slate-500 font-mono font-medium">Last 14 Days</span>
          </div>
          <div className="flex-grow min-h-0 relative">
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* Top Buyers */}
        <div className="glass-panel rounded-2xl p-3.5 lg:p-5 flex flex-col h-[215px] lg:h-[350px]">
          <h3 className="text-sm lg:text-base font-bold text-white font-display mb-4">Top Debtors (Khata)</h3>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {topBuyers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs lg:text-sm">
                <Users className="w-8 h-8 mb-2 opacity-50 text-slate-655" />
                <span>No buyer balances found</span>
              </div>
            ) : (
              topBuyers.map(b => (
                <div 
                  key={b.id} 
                  onClick={() => onNavigate('khata', b)}
                  className="flex justify-between items-center p-3 bg-slate-950/40 hover:bg-slate-900 border border-slate-800/80 rounded-xl cursor-pointer transition duration-150"
                >
                  <div className="truncate pr-2">
                    <h4 className="text-xs lg:text-sm font-semibold text-white truncate">{b.name}</h4>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{b.phone || 'No phone'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs lg:text-sm font-bold text-rose-450 font-mono">₹{b.current_outstanding.toLocaleString('en-IN')}</span>
                    <p className="text-[9px] text-slate-500 uppercase font-bold mt-0.5">Click to Ledger</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Lots */}
      <div className="glass-panel rounded-2xl p-3 lg:p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm lg:text-base font-bold text-white font-display">Recent Arrivals & Lots</h3>
          <button 
            onClick={() => onNavigate('lots')}
            className="text-xs text-blue-450 hover:text-blue-300 font-semibold cursor-pointer"
          >
            View All Lots &rarr;
          </button>
        </div>
        
        {recentLots.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-500 text-sm">
            <Archive className="w-10 h-10 mb-2 opacity-50" />
            <span>No lots recorded yet</span>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                    <th className="py-3 px-4">Lot ID</th>
                    <th className="py-3 px-4">Seller</th>
                    <th className="py-3 px-4">Arrival Date</th>
                    <th className="py-3 px-4 text-center">Crates</th>
                    <th className="py-3 px-4 text-right">Net Weight</th>
                    <th className="py-3 px-4 text-right">Net Payable</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {recentLots.map(l => (
                    <tr key={l.id} className="hover:bg-slate-900/40 transition duration-150">
                      <td className="py-3 px-4 font-bold text-white font-mono">{l.id}</td>
                      <td className="py-3 px-4 font-medium text-slate-350">{l.seller_name}</td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-xs">
                        {new Date(l.arrival_date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-300 font-mono">{l.total_crates}</td>
                      <td className="py-3 px-4 text-right text-slate-400 font-mono">{l.total_weight_kg.toFixed(1)} kg</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-400 font-mono">₹{l.net_payable_to_seller.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                          l.status === 'paid' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : l.status === 'settled'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
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
            <div className="md:hidden space-y-3">
              {recentLots.map(l => (
                <div key={l.id} className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-white text-xs">{l.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-extrabold tracking-wider ${
                      l.status === 'paid' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : l.status === 'settled'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {l.status}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-200">{l.seller_name}</h4>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                        {new Date(l.arrival_date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-mono">{l.total_crates} Crates | {l.total_weight_kg.toFixed(0)} kg</p>
                      <p className="text-xs font-bold text-emerald-400 font-mono mt-0.5">₹{l.net_payable_to_seller.toLocaleString('en-IN')}</p>
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
