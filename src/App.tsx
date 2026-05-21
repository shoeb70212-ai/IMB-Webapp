import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, PlusCircle, Package, BookOpen, 
  Receipt, Briefcase, Settings as SettingsIcon, Sun, Moon, 
  Sparkles, Menu, X, AlertTriangle, ShieldAlert
} from 'lucide-react';

import Dashboard from './components/Dashboard';
import Parties from './components/Parties';
import NewLotWizard from './components/NewLotWizard';
import Lots from './components/Lots';
import KhataLedger from './components/KhataLedger';
import Cashbook from './components/Cashbook';
import LabourWages from './components/LabourWages';
import Settings from './components/Settings';

export default function App() {
  // Active Tab: dashboard | parties | new_lot | lots | khata | cashbook | labour | settings
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('ca_active_tab') || 'dashboard';
  });

  const [activeTabParam, setActiveTabParam] = useState<any>(null);

  // Theme state: dark | light | bazaar
  const [theme, setTheme] = useState<'dark' | 'light' | 'bazaar'>(() => {
    return (localStorage.getItem('ca_theme') as 'dark' | 'light' | 'bazaar') || 'dark';
  });

  // Settings state (firm name, address, logo, etc.)
  const [businessSettings, setBusinessSettings] = useState(() => {
    try {
      const stored = localStorage.getItem('ca_settings');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Lot Draft state
  const [hasDraft, setHasDraft] = useState(false);
  const [draftStep, setDraftStep] = useState(1);

  // Sync active tab to localStorage
  useEffect(() => {
    localStorage.setItem('ca_active_tab', activeTab);
  }, [activeTab]);

  // Sync theme to document attribute & localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ca_theme', theme);
  }, [theme]);

  // Global App Scaling State & Syncer
  const [appScale, setAppScale] = useState<string>(() => {
    return localStorage.getItem('ca_app_scale') || 'standard';
  });

  useEffect(() => {
    const scaleMap: Record<string, string> = {
      'extra-compact': '13px',
      'compact': '14.5px',
      'standard': '16px',
      'spacious': '17.5px',
      'extra-spacious': '19px'
    };
    const fontSize = scaleMap[appScale] || '16px';
    document.documentElement.style.fontSize = fontSize;
    localStorage.setItem('ca_app_scale', appScale);
  }, [appScale]);

  // Read settings and draft state
  const checkSettingsAndDrafts = () => {
    try {
      // 1. Settings
      const storedSettings = localStorage.getItem('ca_settings');
      if (storedSettings) {
        setBusinessSettings((prev: any) => {
          if (JSON.stringify(prev) !== storedSettings) {
            return JSON.parse(storedSettings);
          }
          return prev;
        });
      }
      
      // 2. Draft lot
      const draftRaw = localStorage.getItem('ca_draft_nl');
      if (draftRaw) {
        const draft = JSON.parse(draftRaw);
        const hasItems = draft.items && draft.items.length > 0;
        const hasSeller = !!draft.seller_id;
        if (draft.step > 1 || hasItems || hasSeller) {
          setHasDraft(true);
          setDraftStep(draft.step || 1);
        } else {
          setHasDraft(false);
        }
      } else {
        setHasDraft(false);
      }
    } catch (e) {
      console.error('Error checking settings/drafts:', e);
    }
  };

  useEffect(() => {
    checkSettingsAndDrafts();

    // Listen to custom settings-updated event from Settings.tsx
    const handleSettingsUpdate = () => {
      checkSettingsAndDrafts();
      const storedScale = localStorage.getItem('ca_app_scale') || 'standard';
      setAppScale(storedScale);
    };

    // Listen to draft changes by polling/intercepting or on mount
    window.addEventListener('settings-updated', handleSettingsUpdate);
    
    // Also set up a small interval to check for draft and scale changes in the background
    const interval = setInterval(() => {
      checkSettingsAndDrafts();
      const storedScale = localStorage.getItem('ca_app_scale') || 'standard';
      setAppScale(prev => prev !== storedScale ? storedScale : prev);
    }, 2000);

    return () => {
      window.removeEventListener('settings-updated', handleSettingsUpdate);
      clearInterval(interval);
    };
  }, []);

  // Theme switcher cyclist
  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'dark') return 'light';
      if (prev === 'light') return 'bazaar';
      return 'dark';
    });
  };

  // Safe navigation function passed to children
  const handleNavigate = (tab: string, param?: any) => {
    setActiveTab(tab);
    setActiveTabParam(param || null);
  };

  // Clear lot wizard draft
  const handleClearDraft = () => {
    if (window.confirm('Are you sure you want to discard your draft arrival lot? This resets the wizard.')) {
      localStorage.removeItem('ca_draft_nl');
      setHasDraft(false);
      // If we are currently on new_lot, refresh it by navigating away and back or letting it read empty localstorage
      if (activeTab === 'new_lot') {
        window.location.reload();
      }
    }
  };

  // Sidebar list configuration
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'parties', label: 'Parties Directory', icon: Users },
    { id: 'new_lot', label: 'New Lot Wizard', icon: PlusCircle, highlight: hasDraft },
    { id: 'lots', label: 'Arrival Lots', icon: Package },
    { id: 'khata', label: 'Khata Ledger', icon: BookOpen },
    { id: 'cashbook', label: 'Cashbook Drawer', icon: Receipt },
    { id: 'labour', label: 'Labour Wages', icon: Briefcase },
    { id: 'settings', label: 'System Settings', icon: SettingsIcon },
  ];

  // Render correct component based on activeTab
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'parties':
        return <Parties onNavigate={handleNavigate} />;
      case 'new_lot':
        return <NewLotWizard onNavigate={handleNavigate} />;
      case 'lots':
        return <Lots />;
      case 'khata':
        return <KhataLedger initialBuyer={activeTabParam} />;
      case 'cashbook':
        return <Cashbook />;
      case 'labour':
        return <LabourWages />;
      case 'settings':
        return <Settings />;
      case 'more':
        return (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-fade-in bg-slate-950 text-slate-200">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white font-display">More Options</h1>
              <p className="text-slate-400 text-sm mt-1">Access labour logs, system settings, and theme configurations.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={() => handleNavigate('labour')}
                className="flex items-center gap-4 p-5 bg-slate-900 border border-slate-800/80 rounded-3xl hover:border-blue-500/30 hover:bg-slate-850/20 transition-all duration-300 text-left cursor-pointer group"
              >
                <div className="p-3.5 bg-blue-600/10 text-blue-400 rounded-2xl group-hover:bg-blue-650 group-hover:text-white transition duration-300">
                  <Briefcase className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Labour Wages</h3>
                  <p className="text-slate-500 text-xs mt-1 leading-normal">Manage crew members, unloading logs, advances & payouts.</p>
                </div>
              </button>
              
              <button 
                onClick={() => handleNavigate('settings')}
                className="flex items-center gap-4 p-5 bg-slate-900 border border-slate-800/80 rounded-3xl hover:border-blue-500/30 hover:bg-slate-850/20 transition-all duration-300 text-left cursor-pointer group"
              >
                <div className="p-3.5 bg-blue-600/10 text-blue-400 rounded-2xl group-hover:bg-blue-650 group-hover:text-white transition duration-300">
                  <SettingsIcon className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">System Settings</h3>
                  <p className="text-slate-500 text-xs mt-1 leading-normal">Configure business credentials, commission slabs, and export backups.</p>
                </div>
              </button>

              <div 
                className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800/80 rounded-3xl md:col-span-2"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-blue-600/10 text-blue-400 rounded-2xl">
                    <Sparkles className="w-5.5 h-5.5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Active Theme</h3>
                    <p className="text-slate-500 text-xs mt-1 leading-normal">Cycler between three distinct theme styles.</p>
                  </div>
                </div>
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 text-xs font-bold text-slate-300 cursor-pointer transition"
                >
                  {theme === 'dark' && <Moon className="w-3.5 h-3.5 text-blue-400" />}
                  {theme === 'light' && <Sun className="w-3.5 h-3.5 text-amber-500" />}
                  {theme === 'bazaar' && <Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
                  <span className="capitalize">{theme}</span>
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  const getMobileActiveTab = () => {
    if (activeTab === 'dashboard') return 'home';
    if (activeTab === 'parties') return 'parties';
    if (activeTab === 'new_lot') return 'new_lot';
    if (['lots', 'khata', 'cashbook'].includes(activeTab)) return 'finance';
    return 'more';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-200">
      
      {/* 1. DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-72 bg-slate-900 border-r border-slate-800/60 shrink-0 no-print">
        {/* Sidebar Header / Brand profile */}
        <div className="p-6 border-b border-slate-850 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center overflow-hidden shrink-0">
            {businessSettings.business_logo ? (
              <img src={businessSettings.business_logo} alt="Brand logo" className="w-full h-full object-contain" />
            ) : (
              <Sparkles className="w-5 h-5 text-blue-400" />
            )}
          </div>
          <div className="truncate">
            <h1 className="text-sm font-extrabold text-white tracking-wide truncate">
              {businessSettings.business_name || 'Kisan Mitra'}
            </h1>
            <p className="text-[10px] text-slate-500 font-semibold truncate">
              {businessSettings.owner_name ? `Prop: ${businessSettings.owner_name}` : 'Mandi commission agent'}
            </p>
          </div>
        </div>

        {/* Sidebar Nav links */}
        <nav className="flex-grow p-4 space-y-1 overflow-y-auto">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition duration-150 cursor-pointer ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.highlight && (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" title="Draft in progress" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer / Theme cycling */}
        <div className="p-4 border-t border-slate-850 flex items-center justify-between bg-slate-900/60">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Active Theme</span>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 text-xs font-bold text-slate-350 cursor-pointer transition"
          >
            {theme === 'dark' && <Moon className="w-3.5 h-3.5 text-blue-400" />}
            {theme === 'light' && <Sun className="w-3.5 h-3.5 text-amber-500" />}
            {theme === 'bazaar' && <Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
            <span className="capitalize">{theme}</span>
          </button>
        </div>
      </aside>

      {/* 2. MOBILE BOTTOM NAVIGATION */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-md border-t border-slate-800/60 flex items-center justify-around z-45 no-print px-1 select-none pt-1 pb-[env(safe-area-inset-bottom)] min-h-[56px] box-content">
        <button
          onClick={() => handleNavigate('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
            getMobileActiveTab() === 'home' ? 'text-blue-400 font-bold' : 'text-slate-500 hover:text-slate-350'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Home</span>
        </button>

        <button
          onClick={() => handleNavigate('parties')}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
            getMobileActiveTab() === 'parties' ? 'text-blue-400 font-bold' : 'text-slate-500 hover:text-slate-350'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Parties</span>
        </button>

        {/* Center Prominent New Lot Action Button */}
        <div className="flex-1 flex justify-center py-1">
          <button
            onClick={() => handleNavigate('new_lot')}
            className={`flex items-center justify-center w-11 h-11 bg-gradient-to-tr from-blue-600 to-blue-700 text-white rounded-full -translate-y-2.5 shadow-lg shadow-blue-500/20 border-4 border-slate-950 active:scale-95 transition-all cursor-pointer relative ${
              getMobileActiveTab() === 'new_lot' ? 'from-blue-500 to-blue-600' : ''
            }`}
            title="Create New Lot"
          >
            <PlusCircle className="w-5.5 h-5.5" />
            {hasDraft && (
              <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-amber-500 border border-slate-950 animate-pulse" />
            )}
          </button>
        </div>

        <button
          onClick={() => handleNavigate('lots')}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
            getMobileActiveTab() === 'finance' ? 'text-blue-400 font-bold' : 'text-slate-500 hover:text-slate-350'
          }`}
        >
          <Receipt className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Finance</span>
        </button>

        <button
          onClick={() => handleNavigate('more')}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
            getMobileActiveTab() === 'more' ? 'text-blue-400 font-bold' : 'text-slate-500 hover:text-slate-350'
          }`}
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">More</span>
        </button>
      </nav>

      {/* 3. MAIN WORKSPACE CONTAINER */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
        
        {/* Mobile header ribbon */}
        <header className="lg:hidden bg-slate-900 border-b border-slate-850 h-12 flex items-center justify-between px-3 shrink-0 no-print">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue-600/10 border border-blue-500/20 flex items-center justify-center overflow-hidden shrink-0">
              {businessSettings.business_logo ? (
                <img src={businessSettings.business_logo} alt="Brand logo" className="w-full h-full object-contain" />
              ) : (
                <Sparkles className="w-4 h-4 text-blue-400" />
              )}
            </div>
            <h1 className="text-sm font-extrabold text-white font-display">
              {businessSettings.business_name || 'Kisan Mitra'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 cursor-pointer"
            >
              {theme === 'dark' && <Moon className="w-4.5 h-4.5 text-blue-400" />}
              {theme === 'light' && <Sun className="w-4.5 h-4.5 text-amber-500" />}
              {theme === 'bazaar' && <Sparkles className="w-4.5 h-4.5 text-emerald-400" />}
            </button>
          </div>
        </header>

        {/* Mobile top navigation tabs for Finance section */}
        {['lots', 'khata', 'cashbook'].includes(activeTab) && (
          <div className="lg:hidden bg-slate-900 border-b border-slate-850 px-4 py-2 flex gap-1.5 shrink-0 no-print select-none">
            <button
              onClick={() => handleNavigate('lots')}
              className={`flex-1 py-1.5 text-center rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                activeTab === 'lots'
                  ? 'bg-blue-600/10 text-blue-400 border-blue-500/35 font-extrabold'
                  : 'text-slate-400 bg-transparent border-transparent'
              }`}
            >
              Lots
            </button>
            <button
              onClick={() => handleNavigate('khata')}
              className={`flex-1 py-1.5 text-center rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                activeTab === 'khata'
                  ? 'bg-blue-600/10 text-blue-400 border-blue-500/35 font-extrabold'
                  : 'text-slate-400 bg-transparent border-transparent'
              }`}
            >
              Khata Ledger
            </button>
            <button
              onClick={() => handleNavigate('cashbook')}
              className={`flex-1 py-1.5 text-center rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                activeTab === 'cashbook'
                  ? 'bg-blue-600/10 text-blue-400 border-blue-500/35 font-extrabold'
                  : 'text-slate-400 bg-transparent border-transparent'
              }`}
            >
              Cashbook
            </button>
          </div>
        )}

        {/* Global Draft lot notification banner */}
        {hasDraft && activeTab !== 'new_lot' && (
          <div className="no-print bg-amber-500/10 border-b border-amber-500/25 px-6 py-2.5 flex items-center justify-between text-xs text-amber-400 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-amber-500" />
              <span>
                <strong>Unsaved Draft Arrival Lot:</strong> You have an ongoing arrival lot entry at <strong>Step {draftStep}</strong>.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleNavigate('new_lot')}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold cursor-pointer transition text-[11px]"
              >
                Resume Draft
              </button>
              <button
                onClick={handleClearDraft}
                className="text-slate-400 hover:text-rose-400 transition font-bold cursor-pointer"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Main interactive Tab Content container */}
        <main className="flex-1 flex flex-col overflow-hidden min-h-0">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
