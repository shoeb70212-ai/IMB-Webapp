import fs from 'fs';

let html = fs.readFileSync('index.html', 'utf-8');

// 1. In data, replace nl.crates with nl.items, and adjust nc
html = html.replace(
    /nl: \{ step:1, seller_id:'', arrival_date: new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\], crates:\[\], selections: \[\], \n                      rateGroups:\[\], alloc:\{buyer_id:'', mode:'cash'\}, summary: \{\} \},\n\s*nc: \{ fruit:'Mango', grade:'A1', gross:'', tare:0\.5 \},/g,
    `nl: { step:1, seller_id:'', arrival_date: new Date().toISOString().split('T')[0], items:[], allocations:[], alloc_form:{item_id:'', buyer_id:'', qty:'', rate:'', mode:'cash'}, summary: {} },
                nc: { fruit:'Mango', grade:'A1', qty: 1, gross:'', tare:0.5 },`
);

// 2. Replace addNlCrate, prepStep3, prepStep4, etc
const newMethods = `
                addNlCrate() {
                    if(!this.nc.gross || this.nc.gross<=0 || !this.nc.qty || this.nc.qty<=0) return;
                    let grossTotal = this.nc.gross * this.nc.qty;
                    let tareTotal = this.nc.tare * this.nc.qty;
                    let netTotal = grossTotal - tareTotal;
                    this.nl.items.push({
                        id: this.genId(),
                        ...this.nc,
                        net_total: parseFloat(netTotal.toFixed(2)),
                        sold_qty: 0
                    });
                    this.nc.qty = 1; this.nc.gross = ''; this.$refs.grossInput.focus();
                },
                prepStep3() {
                    if(this.nl.items.length===0) return this.toast('Add items first');
                    this.nl.alloc_form = {item_id: this.nl.items[0]?.id || '', buyer_id:'', qty:'', rate:'', mode:'cash'};
                    this.nl.step = 3;
                },
                addAllocation() {
                    const f = this.nl.alloc_form;
                    if(!f.item_id || !f.buyer_id || !f.qty || f.qty<=0 || !f.rate || f.rate<=0) return this.toast('Fill all allocation fields properly');
                    
                    let item = this.nl.items.find(x=>x.id===f.item_id);
                    if(!item) return;
                    let available = item.qty - item.sold_qty;
                    if(f.qty > available) return this.toast('Only ' + available + ' crates left for this item');

                    let amt = (item.net_total / item.qty) * f.qty * f.rate;
                    let buyer = this.parties.find(x=>x.id===f.buyer_id);

                    if(f.mode === 'credit' && (buyer.current_outstanding + amt > buyer.credit_limit)) {
                        this.toast('Credit limit exceeded, proceeding anyway', 'warning');
                    }

                    item.sold_qty += parseInt(f.qty);
                    
                    this.nl.allocations.push({
                        id: this.genId(),
                        item_id: item.id, fruit: item.fruit, grade: item.grade,
                        buyer_id: buyer.id, buyer_name: buyer.name,
                        qty: parseInt(f.qty), rate: parseFloat(f.rate),
                        net_weight: ((item.net_total / item.qty) * f.qty),
                        gross_weight: (item.gross * f.qty), // Note: item.gross is per crate here
                        tare_weight: (item.tare * f.qty),
                        amount: parseFloat(amt.toFixed(2)),
                        mode: f.mode
                    });
                    
                    this.nl.alloc_form.qty = ''; this.nl.alloc_form.rate = '';
                },
                removeAllocation(i) {
                    let a = this.nl.allocations[i];
                    let item = this.nl.items.find(x=>x.id===a.item_id);
                    if(item) item.sold_qty -= a.qty;
                    this.nl.allocations.splice(i, 1);
                },
                prepStep4() {
                    if(this.nl.items.some(x=>x.sold_qty < x.qty)) return this.toast('Some crates remain unsold!');
                    let gross = this.nl.allocations.reduce((s,a)=>s+a.amount,0);
                    let totalCrates = this.nl.items.reduce((s,i)=>s+parseInt(i.qty),0);
                    let comm = gross * (this.settings.default_commission_percent/100);
                    let lab = totalCrates * this.settings.default_labour_per_crate;
                    let wei = totalCrates * this.settings.default_weighing_per_crate;
                    this.nl.summary = {
                        gross: Math.round(gross), net: Math.round(gross - comm - lab - wei),
                        charges: [
                            {type:'commission', amt: Math.round(comm), desc: \`Commission (\${this.settings.default_commission_percent}%)\`},
                            {type:'labour', amt: Math.round(lab), desc: \`Labour (\${totalCrates} crates)\`},
                            {type:'weighing', amt: Math.round(wei), desc: \`Weighing (\${totalCrates} crates)\`}
                        ]
                    };
                    this.nl.step = 4;
                },
                finalizeLot() {
                    let seller = this.parties.find(x=>x.id===this.nl.seller_id);
                    let lotId = 'LOT-'+this.genId().toUpperCase();
                    let totalCrates = this.nl.items.reduce((s,i)=>s+parseInt(i.qty),0);
                    let totalNet = this.nl.items.reduce((s,i)=>s+i.net_total,0);
                    
                    let nlObj = {
                        id: lotId, seller_id: seller.id, seller_name: seller.name, arrival_date: this.nl.arrival_date,
                        total_crates: totalCrates, total_weight_kg: parseFloat(totalNet.toFixed(2)),
                        gross_sale_amount: this.nl.summary.gross, net_payable_to_seller: this.nl.summary.net, status: 'auctioned'
                    };
                    this.lots.push(nlObj);

                    let bMap = {};
                    this.nl.allocations.forEach(a => {
                        this.crates.push({
                            id: this.genId(), lot_id: lotId, fruit_type: a.fruit, quality_grade: a.grade,
                            qty: a.qty,
                            gross_weight_kg: parseFloat(a.gross_weight.toFixed(2)), 
                            tare_weight_kg: parseFloat(a.tare_weight.toFixed(2)), 
                            net_weight_kg: parseFloat(a.net_weight.toFixed(2)), 
                            rate_per_kg: a.rate, sale_amount: a.amount,
                            buyer_id: a.buyer_id, buyer_name: a.buyer_name, payment_mode: a.mode, is_sold: true
                        });
                        if(!bMap[a.buyer_id]) bMap[a.buyer_id] = {cash:0, credit:0, upi:0, bank:0};
                        bMap[a.buyer_id][a.mode] += a.amount;
                    });

                    this.nl.summary.charges.forEach(ch => {
                        this.charges.push({id: this.genId(), lot_id: lotId, charge_type: ch.type, amount: ch.amt, notes: ch.desc});
                    });

                    Object.keys(bMap).forEach(b_id => {
                        let credAmt = bMap[b_id].credit || 0;
                        if(credAmt > 0) {
                            let b = this.parties.find(x=>x.id===b_id);
                            if(b) b.current_outstanding += credAmt;
                        }
                    });

                    this.saveData(); this.toast('Lot successfully finalized!', 'success');
                    localStorage.removeItem('ca_draft_nl'); this.hasDraft = false;
                    this.nl = { step:1, seller_id:'', arrival_date: this.nl.arrival_date, items:[], allocations:[], alloc_form:{item_id:'', buyer_id:'', qty:'', rate:'', mode:'cash'}, summary: {} };
                    this.tab = 'lots';
                },
`;

// Clear old methods
html = html.replace(/addNlCrate\(\) \{[\s\S]*?finalizeLot\(\) \{[\s\S]*?this\.tab = 'lots';\n                \},/m, newMethods);

// Fix UI templates: Step 2 Crate Entry
const step2UI = `
                    <div x-show="nl.step === 2">
                        <h2 class="font-sans font-bold tracking-tight text-lg sm:text-xl uppercase mb-1 text-slate-200">Crate Entry</h2>
                        <p class="text-slate-500 text-sm mb-4">Add crate batches to this lot.</p>
                        <form @submit.prevent="addNlCrate" class="flex flex-col sm:flex-row gap-4 items-start sm:items-end bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4 shadow-sm">
                            <div class="w-full sm:flex-1"><label class="block text-xs mb-1 text-slate-400">Fruit</label>
                                <select x-model="nc.fruit" class="w-full border border-slate-800 bg-slate-900 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm min-h-[42px] px-3 py-2">
                                    <template x-for="f in settings.fruit_types"><option :value="f" x-text="f"></option></template>
                                </select></div>
                            <div class="w-full sm:w-20"><label class="block text-xs mb-1 text-slate-400">Grade</label>
                                <select x-model="nc.grade" class="w-full border border-slate-800 bg-slate-900 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm min-h-[42px] px-3 py-2">
                                    <template x-for="g in settings.quality_grades"><option :value="g" x-text="g"></option></template>
                                </select></div>
                            <div class="w-full sm:w-20"><label class="block text-xs mb-1 text-slate-400">Qty (Crts)</label><input type="number" min="1" x-model="nc.qty" class="w-full border border-slate-800 bg-slate-900 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm min-h-[42px] px-3 py-2 text-blue-400 font-bold" required></div>
                            <div class="w-full sm:w-28"><label class="block text-xs mb-1 text-slate-400">Gross/Cr(kg)</label><input type="number" step="0.1" x-model="nc.gross" x-ref="grossInput" class="w-full border border-slate-800 bg-slate-900 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm min-h-[42px] px-3 py-2" required></div>
                            <div class="w-full sm:w-20"><label class="block text-xs mb-1 text-slate-400">Tare/Cr(kg)</label><input type="number" step="0.1" x-model="nc.tare" class="w-full border border-slate-800 bg-slate-900 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm min-h-[42px] px-3 py-2" required></div>
                            <button type="submit" class="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 border border-slate-800 text-sm font-medium  hover:bg-blue-700 hover:text-slate-200 transition-colors rounded-md min-h-[42px] px-3 py-2 mt-2 sm:mt-0">Add Items</button>
                        </form>

                        <div class="max-h-64 overflow-y-auto overflow-x-auto border border-slate-800 rounded-lg mb-4 w-full bg-slate-900 shadow-sm">
                            <table class="w-full text-sm text-left">
                                <thead class="sticky top-0 bg-slate-950 z-10 border-b border-slate-800 text-xs uppercase tracking-wider font-semibold font-mono text-sm text-slate-500"><tr>
                                    <th class="p-3">#</th><th class="p-3">Item</th><th class="p-3 text-right">Qty</th><th class="p-3 text-right">Gross(/cr)</th><th class="p-3 text-right">Tare(/cr)</th><th class="p-3 text-right">Net Total</th><th class="p-3"></th>
                                </tr></thead>
                                <tbody>
                                    <template x-for="(c, i) in nl.items">
                                        <tr class="border-b border-slate-800/50 hover:bg-slate-950">
                                            <td class="p-3 text-slate-500" x-text="i+1"></td>
                                            <td class="p-3"><span x-text="c.fruit"></span> <span class="bg-blue-600/20 text-blue-300 px-1.5 py-0.5 rounded text-xs font-bold" x-text="c.grade"></span></td>
                                            <td class="p-3 text-right font-medium text-emerald-400" x-text="c.qty + ' cr'"></td>
                                            <td class="p-3 text-right text-slate-400" x-text="c.gross+'kg'"></td>
                                            <td class="p-3 text-right text-slate-400" x-text="c.tare+'kg'"></td>
                                            <td class="p-3 text-right font-medium" x-text="c.net_total+'kg'"></td>
                                            <td class="p-3 text-right"><button @click="nl.items.splice(i, 1)" class="text-rose-400 hover:text-rose-500 text-xs font-bold px-2 py-1 bg-rose-500/10 rounded">✕</button></td>
                                        </tr>
                                    </template>
                                </tbody>
                            </table>
                            <div x-show="nl.items.length===0" class="p-6 text-center text-slate-500 text-sm">No items added yet.</div>
                        </div>
                        <div class="flex flex-col sm:flex-row justify-between items-center bg-slate-950 p-4 border border-slate-800 rounded-xl gap-4">
                            <div class="font-medium text-slate-300">Total Crates: <span class="text-white text-lg" x-text="nl.items.reduce((a,b)=>a+parseInt(b.qty), 0)"></span> | Total Net: <span class="text-white text-lg" x-text="nl.items.reduce((a,b)=>a+b.net_total, 0).toFixed(2) + ' kg'"></span></div>
                            <div class="flex gap-4 w-full sm:w-auto">
                                <button @click="nl.step=1" class="flex-1 sm:flex-none text-slate-400 px-4 py-2 hover:bg-slate-800 rounded-md border border-slate-800">Back</button>
                                <button @click="prepStep3()" class="flex-1 sm:flex-none bg-blue-600 text-white px-6 py-2 shadow-sm font-medium hover:bg-blue-700 transition-colors rounded-md">Next: Auction</button>
                            </div>
                        </div>
                    </div>
`;
html = html.replace(/<div x-show="nl\.step === 2">[\s\S]*?<!-- Step 3 -->/m, step2UI + '\n\n                    <!-- Step 3 -->');

const step3UI = `
                    <div x-show="nl.step === 3">
                        <h2 class="font-sans font-bold tracking-tight text-lg sm:text-xl uppercase mb-1 text-slate-200">Auction / Allocation</h2>
                        <p class="text-slate-500 text-sm mb-4">Allocate quantities of items to buyers.</p>

                        <div class="flex flex-col lg:flex-row gap-6">
                            <!-- Left: Sell Form & Inventory -->
                            <div class="w-full lg:w-[45%] flex flex-col gap-6">
                                <div class="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-sm">
                                    <h3 class="font-bold text-sm mb-4 text-emerald-400 flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg> New Allocation</h3>
                                    <form @submit.prevent="addAllocation" class="space-y-4">
                                        <div>
                                            <label class="block text-xs text-slate-400 mb-1">Select Item</label>
                                            <select x-model="nl.alloc_form.item_id" class="w-full border border-slate-800 bg-slate-900 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[42px] px-3 py-2 text-sm font-medium">
                                                <template x-for="item in nl.items">
                                                    <option :value="item.id" x-text="\`\${item.fruit} \${item.grade} (\${item.qty - item.sold_qty} left)\`"></option>
                                                </template>
                                            </select>
                                        </div>
                                        <div class="flex gap-4">
                                            <div class="flex-1">
                                                <label class="block text-xs text-slate-400 mb-1">Buyer</label>
                                                <select x-model="nl.alloc_form.buyer_id" class="w-full border border-slate-800 bg-slate-900 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[42px] px-3 py-2 text-sm" required>
                                                    <option value="">-- Choose --</option>
                                                    <template x-for="b in parties.filter(p=>p.type==='buyer')"><option :value="b.id" x-text="b.name"></option></template>
                                                </select>
                                            </div>
                                            <div class="w-24">
                                                <label class="block text-xs text-slate-400 mb-1">Qty</label>
                                                <input type="number" min="1" x-model="nl.alloc_form.qty" class="w-full border border-slate-800 bg-slate-900 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[42px] px-3 py-2 text-sm font-bold text-center" required>
                                            </div>
                                        </div>
                                        <div class="flex gap-4">
                                            <div class="flex-1">
                                                <label class="block text-xs text-slate-400 mb-1">Rate (₹/kg)</label>
                                                <input type="number" step="0.1" min="0" x-model="nl.alloc_form.rate" class="w-full border border-slate-800 bg-slate-900 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[42px] px-3 py-2 text-sm" required>
                                            </div>
                                            <div class="flex-1">
                                                <label class="block text-xs text-slate-400 mb-1">Payment</label>
                                                <select x-model="nl.alloc_form.mode" class="w-full border border-slate-800 bg-slate-900 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[42px] px-3 py-2 text-sm">
                                                    <option value="cash">Cash</option><option value="credit" class="text-rose-400 font-bold">Credit</option><option value="upi">UPI</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button type="submit" class="w-full bg-emerald-600 text-white py-2 rounded-md font-bold shadow-sm hover:bg-emerald-500 transition-colors uppercase tracking-wide text-sm mt-2">Allocate</button>
                                    </form>
                                </div>
                                
                                <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
                                    <h3 class="font-bold text-xs text-slate-500 uppercase tracking-wider mb-3">Inventory Status</h3>
                                    <div class="space-y-3">
                                        <template x-for="item in nl.items">
                                            <div class="flex justify-between items-center text-sm border-b border-slate-800/50 pb-2 last:border-0 last:pb-0">
                                                <div><span class="font-medium" x-text="item.fruit"></span> <span class="bg-blue-600/10 text-xs px-1 rounded text-blue-400" x-text="item.grade"></span></div>
                                                <div class="flex items-center gap-3">
                                                    <div class="w-24 h-2 bg-slate-800 rounded-full overflow-hidden shrink-0"><div class="h-full bg-emerald-500" :style="'width: '+(item.sold_qty/item.qty*100)+'%'"></div></div>
                                                    <span class="font-mono text-xs text-slate-400 w-12 text-right" x-text="item.sold_qty+'/'+item.qty"></span>
                                                </div>
                                            </div>
                                        </template>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Right: Sold List -->
                            <div class="flex-1 bg-slate-900 border border-slate-800 rounded-xl flex flex-col shadow-sm overflow-hidden h-[500px]">
                                <div class="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
                                    <h3 class="font-bold text-sm text-slate-200">Allocated (<span x-text="nl.allocations.length"></span>)</h3>
                                </div>
                                <div class="flex-1 overflow-y-auto">
                                    <table class="w-full text-xs text-left">
                                        <thead class="sticky top-0 bg-slate-950 z-10 border-b border-slate-800 uppercase tracking-wider font-semibold font-mono text-slate-500"><tr>
                                            <th class="p-3">Buyer</th><th class="p-3">Item</th><th class="p-3 text-right">Qty</th><th class="p-3 text-right">Amt</th><th class="p-3 text-center"></th>
                                        </tr></thead>
                                        <tbody>
                                            <template x-for="(a, i) in nl.allocations" :key="a.id">
                                            <tr class="border-b border-slate-800/50 hover:bg-slate-800 transition-colors">
                                                <td class="p-3">
                                                    <div class="font-medium text-slate-200 text-sm" x-text="a.buyer_name"></div>
                                                    <div class="text-[10px] uppercase text-slate-500 font-bold" :class="a.mode==='credit'?'text-rose-400':''" x-text="a.mode"></div>
                                                </td>
                                                <td class="p-3">
                                                    <span x-text="a.fruit"></span> <span class="bg-blue-600/10 px-1 rounded text-blue-400" x-text="a.grade"></span>
                                                    <div class="text-[10px] text-slate-400 mt-0.5" x-text="a.net_weight.toFixed(1)+'kg @ ₹'+a.rate"></div>
                                                </td>
                                                <td class="p-3 text-right font-medium text-emerald-400" x-text="a.qty + ' cr'"></td>
                                                <td class="p-3 text-right font-bold text-sm" x-html="formatINR(a.amount)"></td>
                                                <td class="p-3 text-center"><button @click="removeAllocation(i)" class="text-rose-400 hover:text-rose-500 font-bold px-2 py-1 bg-rose-500/10 rounded">✕</button></td>
                                            </tr>
                                            </template>
                                        </tbody>
                                    </table>
                                    <div x-show="nl.allocations.length===0" class="p-8 text-center text-slate-500 italic">No allocations yet.</div>
                                </div>
                                <div class="p-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center text-sm">
                                    <div class="text-slate-400">Total Alloc: <span class="font-bold text-slate-200" x-html="formatINR(nl.allocations.reduce((s,a)=>s+a.amount,0))"></span></div>
                                </div>
                            </div>
                        </div>

                        <div class="flex justify-between mt-6 bg-slate-950 p-4 border border-slate-800 rounded-xl">
                            <div><button @click="nl.allocations.forEach((a,i)=>removeAllocation(i)); nl.allocations=[]" class="text-rose-400 text-sm border border-rose-900/50 px-3 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20">Reset Entire Auction</button></div>
                            <div class="flex gap-4">
                                <button @click="nl.step=2" class="text-slate-400 px-4 py-2 hover:bg-slate-800 border border-slate-800 rounded-md">Back</button>
                                <button @click="prepStep4()" class="bg-blue-600 text-white px-6 py-2 shadow-sm font-medium hover:bg-blue-700 transition-colors border border-blue-500 rounded-md">Next: Settlement & Finalize</button>
                            </div>
                        </div>
                    </div>
`;
html = html.replace(/<div x-show="nl\.step === 3">[\s\S]*?<!-- Step 5 -->/m, step3UI + '\n\n                    <!-- Step 4 -->');

// Re-map step 5 to step 4 because we removed "Set Rates" step.
html = html.replace(/<div x-show="nl\.step === 5">/g, '<div x-show="nl.step === 4">');
html = html.replace(/nl\.step=4/g, 'nl.step=3'); // in back buttons of old step 5

// On top tabs
html = html.replace(/<template x-for="s in \[1,2,3,4,5\]">/g, '<template x-for="s in [1,2,3,4]">');
html = html.replace(/<span x-text="\['Arrival', 'Crates', 'Rates', 'Auction', 'Finalize'\]\[s-1\]"><\/span>/g, '<span x-text="[\'Arrival\', \'Crates\', \'Auction\', \'Finalize\'][s-1]"></span>');

fs.writeFileSync('index.html', html, 'utf-8');
console.log('Done refactoring crates logic');
