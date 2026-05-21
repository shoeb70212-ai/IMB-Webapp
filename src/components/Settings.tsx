import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { SystemSettings } from '../types';
import { 
  Save, Download, Upload, ShieldAlert, Check, Plus, Trash2, 
  Settings as SettingsIcon, Image, RefreshCw, AlertTriangle 
} from 'lucide-react';

export default function Settings() {
  // Local state for settings
  const [settings, setSettings] = useState<SystemSettings>({
    business_name: '',
    owner_name: '',
    phone: '',
    address: '',
    default_commission_percent: 6,
    default_labour_per_crate: 15,
    default_weighing_per_crate: 5,
    fruit_types: [],
    quality_grades: [],
    grade_prices: {}
  });

  const [businessLogo, setBusinessLogo] = useState<string>('');
  const [newFruit, setNewFruit] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [newGradePrice, setNewGradePrice] = useState('');

  // Info / Error Alerts
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Load settings on mount
  useEffect(() => {
    const saved = localStorage.getItem('ca_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({
          business_name: parsed.business_name || '',
          owner_name: parsed.owner_name || '',
          phone: parsed.phone || '',
          address: parsed.address || '',
          default_commission_percent: parseFloat(parsed.default_commission_percent) || 0,
          default_labour_per_crate: parseFloat(parsed.default_labour_per_crate) || 0,
          default_weighing_per_crate: parseFloat(parsed.default_weighing_per_crate) || 0,
          fruit_types: parsed.fruit_types || [],
          quality_grades: parsed.quality_grades || [],
          grade_prices: parsed.grade_prices || {}
        });
        if (parsed.business_logo) {
          setBusinessLogo(parsed.business_logo);
        }
      } catch (e) {
        console.error('Error parsing settings', e);
      }
    }
  }, []);

  // Save Settings to LocalStorage
  const handleSaveSettings = (updatedSettings: SystemSettings, updatedLogo?: string) => {
    try {
      const payload = {
        ...updatedSettings,
        business_logo: updatedLogo !== undefined ? updatedLogo : businessLogo
      };
      localStorage.setItem('ca_settings', JSON.stringify(payload));
      
      // Dispatch a custom event to notify App.tsx shell to update logo/theme
      window.dispatchEvent(new Event('settings-updated'));
      
      setSuccessMsg('Settings saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to save settings');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSaveSettings(settings);
  };

  // Upload Logo & convert to Base64
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      setErrorMsg('Image size must be less than 1MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setBusinessLogo(base64);
      handleSaveSettings(settings, base64);
    };
    reader.readAsDataURL(file);
  };

  // Remove logo
  const handleRemoveLogo = () => {
    setBusinessLogo('');
    handleSaveSettings(settings, '');
  };

  // Manage Fruits List
  const handleAddFruit = () => {
    const fruit = newFruit.trim();
    if (!fruit) return;
    if (settings.fruit_types.includes(fruit)) {
      setErrorMsg('Fruit already exists');
      return;
    }
    const updated = {
      ...settings,
      fruit_types: [...settings.fruit_types, fruit]
    };
    setSettings(updated);
    handleSaveSettings(updated);
    setNewFruit('');
  };

  const handleRemoveFruit = (fruit: string) => {
    const updated = {
      ...settings,
      fruit_types: settings.fruit_types.filter(f => f !== fruit)
    };
    setSettings(updated);
    handleSaveSettings(updated);
  };

  // Manage Quality Grades List
  const handleAddGrade = () => {
    const grade = newGrade.trim();
    const price = parseFloat(newGradePrice) || 0;
    if (!grade) return;
    if (settings.quality_grades.includes(grade)) {
      setErrorMsg('Grade already exists');
      return;
    }

    const updatedGrades = [...settings.quality_grades, grade];
    const updatedPrices = { ...settings.grade_prices, [grade]: price };

    const updated = {
      ...settings,
      quality_grades: updatedGrades,
      grade_prices: updatedPrices
    };

    setSettings(updated);
    handleSaveSettings(updated);
    setNewGrade('');
    setNewGradePrice('');
  };

  const handleRemoveGrade = (grade: string) => {
    const updatedGrades = settings.quality_grades.filter(g => g !== grade);
    const updatedPrices = { ...settings.grade_prices };
    delete updatedPrices[grade];

    const updated = {
      ...settings,
      quality_grades: updatedGrades,
      grade_prices: updatedPrices
    };
    setSettings(updated);
    handleSaveSettings(updated);
  };

  // DATABASE BACKUPS MODULES
  // Export to JSON file
  const handleExportBackup = async () => {
    try {
      const data = {
        settings: JSON.parse(localStorage.getItem('ca_settings') || '{}'),
        parties: await db.parties.toArray(),
        lots: await db.lots.toArray(),
        crates: await db.crates.toArray(),
        charges: await db.charges.toArray(),
        khata: await db.khata.toArray(),
        cashbook: await db.cashbook.toArray(),
        labourList: await db.labourList.toArray(),
        labourTransactions: await db.labourTransactions.toArray()
      };

      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `kisan_mitra_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErrorMsg('Backup generation failed: ' + e.message);
    }
  };

  // Import JSON backup
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('WARNING: Importing this backup file will PERMANENTLY WIPE all current local records and overwrite settings. Do you want to proceed?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        
        // Basic schema verification
        if (!data.parties || !data.lots || !data.crates || !data.khata || !data.cashbook) {
          throw new Error('Invalid backup file schema: missing core tables');
        }

        // Wipe tables and bulk load
        await db.transaction('rw', [
          db.parties, db.lots, db.crates, db.charges, db.khata, db.cashbook, db.labourList, db.labourTransactions
        ], async () => {
          await db.parties.clear();
          await db.lots.clear();
          await db.crates.clear();
          await db.charges.clear();
          await db.khata.clear();
          await db.cashbook.clear();
          await db.labourList.clear();
          await db.labourTransactions.clear();

          if (data.parties.length) await db.parties.bulkAdd(data.parties);
          if (data.lots.length) await db.lots.bulkAdd(data.lots);
          if (data.crates.length) await db.crates.bulkAdd(data.crates);
          if (data.charges?.length) await db.charges.bulkAdd(data.charges);
          if (data.khata.length) await db.khata.bulkAdd(data.khata);
          if (data.cashbook.length) await db.cashbook.bulkAdd(data.cashbook);
          if (data.labourList?.length) await db.labourList.bulkAdd(data.labourList);
          if (data.labourTransactions?.length) await db.labourTransactions.bulkAdd(data.labourTransactions);
        });

        // Store settings
        if (data.settings) {
          localStorage.setItem('ca_settings', JSON.stringify(data.settings));
        }

        setSuccessMsg('Backup imported successfully! Page will refresh...');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err: any) {
        setErrorMsg('Failed to import backup: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-fade-in bg-slate-950 text-slate-200">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white font-display flex items-center gap-2">
          <SettingsIcon className="w-8 h-8 text-blue-500" />
          <span>System Settings</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">Configure company profiles, defaults rates, fruit classifications, and manage offline data backups.</p>
      </div>

      {/* Message banners */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-2xl flex items-center gap-2">
          <Check className="w-5 h-5" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-2xl flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="ml-auto text-rose-400 hover:text-white font-bold">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SECTION 1: BUSINESS PROFILE & DEFAULTS */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white font-display mb-4 border-b border-slate-800 pb-2">Business Profile & Rules</h3>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Mandi Firm/Trading Name</label>
                  <input
                    type="text"
                    value={settings.business_name}
                    onChange={(e) => setSettings(prev => ({ ...prev, business_name: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 font-medium"
                    placeholder="e.g. Kisan Trading Co."
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Owner Name</label>
                  <input
                    type="text"
                    value={settings.owner_name}
                    onChange={(e) => setSettings(prev => ({ ...prev, owner_name: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600"
                    placeholder="Owner's Name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={settings.phone}
                    onChange={(e) => setSettings(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 font-mono"
                    placeholder="Mandi phone"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Firm Address</label>
                  <input
                    type="text"
                    value={settings.address}
                    onChange={(e) => setSettings(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600"
                    placeholder="Stall Address, Market Yard"
                  />
                </div>
              </div>

              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-6 mb-2">Default Transaction Slabs</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Commission Slab (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={settings.default_commission_percent}
                    onChange={(e) => setSettings(prev => ({ ...prev, default_commission_percent: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Labour Unload Fee (₹/crate)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={settings.default_labour_per_crate}
                    onChange={(e) => setSettings(prev => ({ ...prev, default_labour_per_crate: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Weighing Charge (₹/crate)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={settings.default_weighing_per_crate}
                    onChange={(e) => setSettings(prev => ({ ...prev, default_weighing_per_crate: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition shadow-lg shadow-blue-500/10"
                >
                  <Save className="w-4.5 h-4.5" />
                  <span>Save Config</span>
                </button>
              </div>
            </form>
          </div>

          {/* BUSINESS LOGO MANAGER */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row gap-6 items-center">
            <div className="w-24 h-24 border border-slate-800 bg-slate-950 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 relative">
              {businessLogo ? (
                <img src={businessLogo} alt="Business logo" className="w-full h-full object-contain" />
              ) : (
                <Image className="w-8 h-8 text-slate-650" />
              )}
            </div>
            <div className="space-y-2 text-center md:text-left">
              <h4 className="text-sm font-bold text-white font-display">Firm Branding Logo</h4>
              <p className="text-slate-500 text-xs">Upload a logo to print on bills and ledger slips. Maximum 1MB (PNG/JPG).</p>
              <div className="flex gap-2 justify-center md:justify-start pt-2">
                <label className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl cursor-pointer transition flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Logo</span>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                {businessLogo && (
                  <button
                    onClick={handleRemoveLogo}
                    className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 text-xs font-bold rounded-xl cursor-pointer transition"
                  >
                    Remove logo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: LIST OPTIONS & DATABASE BACKUPS */}
        <div className="space-y-6">
          {/* FRUITS CLASSIFICATIONS */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <h3 className="text-base font-bold text-white font-display mb-3 border-b border-slate-800 pb-2">Fruit Categories</h3>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newFruit}
                onChange={(e) => setNewFruit(e.target.value)}
                placeholder="New fruit name"
                className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-600"
              />
              <button
                onClick={handleAddFruit}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1">
              {settings.fruit_types.map(f => (
                <span key={f} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-bold text-slate-300">
                  <span>{f}</span>
                  <button onClick={() => handleRemoveFruit(f)} className="p-0.5 hover:bg-slate-850 text-slate-500 hover:text-rose-400 rounded-md">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* QUALITY GRADES CONFIGS */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <h3 className="text-base font-bold text-white font-display mb-3 border-b border-slate-800 pb-2">Grades & Guidelines</h3>
            <div className="space-y-2 mb-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newGrade}
                  onChange={(e) => setNewGrade(e.target.value)}
                  placeholder="Grade name (e.g. A1)"
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-600"
                />
                <input
                  type="number"
                  value={newGradePrice}
                  onChange={(e) => setNewGradePrice(e.target.value)}
                  placeholder="Guide rate (₹/kg)"
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-600 font-mono"
                />
              </div>
              <button
                onClick={handleAddGrade}
                className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex justify-center items-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Quality Grade</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {settings.quality_grades.map(g => (
                <div key={g} className="flex justify-between items-center px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                  <span className="font-bold text-white">{g}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-400">₹{settings.grade_prices[g] || 0}/kg</span>
                    <button onClick={() => handleRemoveGrade(g)} className="text-slate-500 hover:text-rose-400 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* BACKUP & RESTORE */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white font-display mb-2 border-b border-slate-800 pb-2">Offline Data Backup</h3>
            <p className="text-slate-500 text-xs leading-relaxed">Ensure local business accounts remain secure. Perform weekly exports to a JSON file to prevent local browser memory cleanups.</p>
            
            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleExportBackup}
                className="w-full py-2.5 bg-slate-950 hover:bg-slate-850 text-slate-200 border border-slate-800 hover:border-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <Download className="w-4 h-4 text-blue-500" />
                <span>Export Local Ledger JSON</span>
              </button>

              <label className="w-full py-2.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition">
                <Upload className="w-4 h-4" />
                <span>Restore Backup File</span>
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>
            </div>
            
            <div className="flex gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl text-[10px] leading-normal font-medium">
              <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
              <span>Restoring database imports clears and overwrites all local records. Ensure you download current ledger logs before restoring.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
