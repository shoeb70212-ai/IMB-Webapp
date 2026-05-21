import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Party, PartyType } from '../types';
import { Search, UserPlus, Edit2, Archive, Check, X, ShieldAlert, Phone, MapPin, DollarSign } from 'lucide-react';

interface PartiesProps {
  onNavigate: (tab: string, param?: any) => void;
}

export default function Parties({ onNavigate }: PartiesProps) {
  // Queries
  const parties = useLiveQuery(() => db.parties.toArray()) || [];

  // Filter states
  const [activeTab, setActiveTab] = useState<'all' | 'seller' | 'buyer'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    type: 'buyer' as PartyType,
    credit_limit: '100000',
    current_outstanding: '0'
  });

  const [formError, setFormError] = useState('');

  // Handle open add modal
  const openAddModal = () => {
    setEditingParty(null);
    setFormData({
      name: '',
      phone: '',
      address: '',
      type: activeTab === 'seller' ? 'seller' : 'buyer',
      credit_limit: '100000',
      current_outstanding: '0'
    });
    setFormError('');
    setModalOpen(true);
  };

  // Handle open edit modal
  const openEditModal = (party: Party) => {
    setEditingParty(party);
    setFormData({
      name: party.name,
      phone: party.phone || '',
      address: party.address || '',
      type: party.type,
      credit_limit: party.credit_limit?.toString() || '0',
      current_outstanding: party.current_outstanding.toString()
    });
    setFormError('');
    setModalOpen(true);
  };

  // Handle Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const name = formData.name.trim();
    if (!name) {
      setFormError('Name is required');
      return;
    }

    const phone = formData.phone.trim();
    const address = formData.address.trim();
    const type = formData.type;
    const credit_limit = type === 'buyer' ? (parseFloat(formData.credit_limit) || 0) : undefined;
    const current_outstanding = parseFloat(formData.current_outstanding) || 0;

    try {
      if (editingParty) {
        // Edit Mode
        await db.parties.update(editingParty.id, {
          name,
          phone,
          address,
          type,
          credit_limit,
          current_outstanding
        });
      } else {
        // Add Mode
        const newId = (type === 'seller' ? 's_' : 'b_') + Math.random().toString(36).substring(2, 9);
        await db.parties.add({
          id: newId,
          name,
          phone,
          address,
          type,
          credit_limit,
          current_outstanding,
          archived: false
        });
      }
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Database error occurred');
    }
  };

  // Archive party
  const handleToggleArchive = async (party: Party) => {
    if (confirm(`Are you sure you want to ${party.archived ? 'unarchive' : 'archive'} ${party.name}?`)) {
      await db.parties.update(party.id, { archived: !party.archived });
    }
  };

  // Filter parties
  const filteredParties = parties.filter(p => {
    // 1. Tab filter
    if (activeTab !== 'all' && p.type !== activeTab) return false;
    
    // 2. Search query
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    
    return (
      p.name.toLowerCase().includes(q) ||
      (p.phone && p.phone.includes(q)) ||
      p.address.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-display">Directory</h1>
          <p className="text-slate-400 text-sm mt-1">Manage seller and buyer registration records.</p>
        </div>
        <button 
          id="btn-add-party"
          onClick={openAddModal}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg hover:shadow-blue-500/20 transition duration-200"
        >
          <UserPlus className="w-5 h-5" />
          <span>Add Party</span>
        </button>
      </div>

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        {/* Tabs */}
        <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-full sm:w-auto">
          {(['all', 'seller', 'buyer'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 sm:flex-none px-5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}s
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-[300px]">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search name, phone, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 placeholder-slate-500"
          />
        </div>
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredParties.length === 0 ? (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
            <Search className="w-12 h-12 mb-3 opacity-30" />
            <span className="font-semibold text-slate-400">No parties found</span>
            <p className="text-slate-500 text-xs mt-1">Try refining your search query or add a new profile.</p>
          </div>
        ) : (
          filteredParties.map(p => (
            <div 
              key={p.id} 
              className={`bg-slate-900 border rounded-2xl p-5 transition duration-200 flex flex-col justify-between min-h-[195px] relative group overflow-hidden interactive-card ${
                p.archived ? 'border-dashed border-slate-800 opacity-60' : 'border-slate-800'
              }`}
            >
              {/* Top accent line */}
              <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${
                p.type === 'seller' 
                  ? 'from-blue-600 to-blue-700' 
                  : 'from-emerald-500 to-emerald-600'
              }`} />

              {/* Top Row */}
              <div className="flex justify-between items-start">
                <div className="truncate max-w-[70%]">
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase font-extrabold tracking-wider ${
                    p.type === 'seller' 
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/10' 
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                  }`}>
                    {p.type}
                  </span>
                  <h3 className="text-lg font-bold text-white mt-2 truncate font-display">{p.name}</h3>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button 
                    onClick={() => openEditModal(p)}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                    title="Edit Details"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleToggleArchive(p)}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer"
                    title={p.archived ? "Restore Party" : "Archive Party"}
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Middle Row Details */}
              <div className="space-y-1.5 mt-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="font-mono">{p.phone || 'No Phone Added'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="truncate">{p.address || 'No Address Added'}</span>
                </div>
              </div>

              {/* Bottom Row - Ledger Summary / Limits */}
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800/80">
                <div>
                  {p.type === 'buyer' && (
                    <div className="text-[10px] text-slate-500 font-medium">
                      Limit: <span className="font-mono text-slate-400 font-semibold">₹{p.credit_limit?.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
                
                {p.type === 'buyer' ? (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Outstanding</span>
                    <span className={`text-sm font-bold font-mono ${
                      p.current_outstanding > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      ₹{p.current_outstanding.toLocaleString('en-IN')}
                    </span>
                  </div>
                ) : (
                  <button 
                    onClick={() => onNavigate('lots')}
                    className="text-[10px] font-bold text-blue-400 hover:underline uppercase tracking-wider cursor-pointer"
                  >
                    View Lots &rarr;
                  </button>
                )}
              </div>
              
              {/* Highlight balance alert */}
              {p.type === 'buyer' && p.credit_limit && p.current_outstanding > p.credit_limit && (
                <div className="absolute right-3 top-3 text-rose-500 animate-pulse" title="Credit limit exceeded!">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl lg:rounded-3xl w-full lg:max-w-md overflow-hidden shadow-2xl animate-fade-in mobile-bottom-sheet lg:relative">
            {/* Mobile Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto my-3 block lg:hidden" />
            
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-850 lg:pt-4 pt-1">
              <h3 className="text-lg font-bold text-white font-display">
                {editingParty ? 'Modify Party Details' : 'Register New Party'}
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Form Grid */}
              <div className="space-y-4">
                {/* Party Type Select (only on Add mode) */}
                {!editingParty && (
                  <div>
                    <label className="text-xs text-slate-400 font-semibold block mb-1.5">Party Type</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 border border-slate-800 rounded-xl">
                      {(['buyer', 'seller'] as const).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, type }))}
                          className={`py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer ${
                            formData.type === type
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter full name"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 placeholder-slate-600"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Mobile Phone (Optional)</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter phone number"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 placeholder-slate-600 font-mono"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Address / Mandi Stall (Optional)</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Enter city or stall number"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 placeholder-slate-600"
                  />
                </div>

                {/* Buyer Special Fields */}
                {formData.type === 'buyer' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 font-semibold block mb-1">Credit Limit (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.credit_limit}
                        onChange={(e) => setFormData(prev => ({ ...prev, credit_limit: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-semibold block mb-1">Opening Balance (₹)</label>
                      <input
                        type="number"
                        value={formData.current_outstanding}
                        onChange={(e) => setFormData(prev => ({ ...prev, current_outstanding: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-600 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 rounded-lg cursor-pointer transition duration-150"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer flex items-center gap-1.5 shadow-lg shadow-blue-500/10 transition duration-150"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingParty ? 'Save Changes' : 'Register'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
