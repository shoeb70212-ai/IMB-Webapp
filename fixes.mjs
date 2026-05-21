import fs from 'fs';

let html = fs.readFileSync('index.html', 'utf-8');

// 1. Add cbForm to data
html = html.replace('cbModal: false,', "cbModal: false, cbForm: { type: 'receipt', mode: 'cash', amount: '', desc: '', party: '' },");

// 2. Add saveManualEntry method
const methodToAdd = `
                saveManualEntry() {
                    if(!this.cbForm.amount || this.cbForm.amount<=0 || !this.cbForm.desc) return alert('Invalid details');
                    this.cashbook.push({
                        id: this.genId(), date: new Date().toISOString(), entry_type: this.cbForm.type, party_id: '', party_name: this.cbForm.party || 'Miscellaneous',
                        description: this.cbForm.desc, amount: parseFloat(this.cbForm.amount), mode: this.cbForm.mode
                    });
                    this.saveData(); this.cbModal = false; alert('Entry saved!');
                    this.cbForm = { type: 'receipt', mode: 'cash', amount: '', desc: '', party: '' };
                },
`;
html = html.replace('getFilteredCashbook() {', methodToAdd + '\n                getFilteredCashbook() {');

// 3. Update changeTab to handle Reports rendering
const newChangeTab = `changeTab(t) { 
                    this.tab = t; this.selectedLot = null; this.selectedKhataBuyer = null; 
                    if(t === 'reports') setTimeout(() => this.renderChart(), 50);
                },`;
html = html.replace(/changeTab\(t\)\s*\{\s*this\.tab\s*=\s*t;\s*this\.selectedLot\s*=\s*null;\s*this\.selectedKhataBuyer\s*=\s*null;\s*\},\s*/, newChangeTab + '\n');


// 4. Add Cashbook Modal HTML properly before <script>
const cbModalHtml = `
    <!-- Manual Cashbook Modal -->
    <div x-show="cbModal" x-cloak class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-slate-900 border border-slate-800 shadow-sm w-[95%] sm:w-full sm:max-w-md max-w-sm p-4 md:p-6 max-h-[90vh] overflow-y-auto rounded-xl" @click.away="cbModal=false">
             <h2 class="font-sans font-semibold tracking-tight text-lg uppercase mb-4 text-slate-200">Manual Cashbook Entry</h2>
             <div class="space-y-3">
                <div class="flex gap-4 mb-2">
                    <label class="flex items-center gap-1 text-sm"><input type="radio" value="receipt" x-model="cbForm.type" class="text-blue-500 bg-slate-900 border-slate-800"> Receipt (In)</label>
                    <label class="flex items-center gap-1 text-sm"><input type="radio" value="payment" x-model="cbForm.type" class="text-blue-500 bg-slate-900 border-slate-800"> Payment (Out)</label>
                </div>
                <div><label class="block text-sm mb-1 text-slate-400">Amount (₹)</label><input type="number" x-model.number="cbForm.amount" class="w-full border border-slate-800 bg-slate-900 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[42px] px-3 py-2 text-lg font-bold" :class="cbForm.type==='receipt'?'text-emerald-500':'text-rose-500'"></div>
                <div><label class="block text-sm mb-1 text-slate-400">Mode</label>
                    <select x-model="cbForm.mode" class="w-full border border-slate-800 bg-slate-900 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[42px] px-3 py-2"><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank Transfer</option></select>
                </div>
                <div><label class="block text-sm mb-1 text-slate-400">Description</label><input type="text" x-model="cbForm.desc" placeholder="e.g. Tea expenses, Advance" class="w-full border border-slate-800 bg-slate-900 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[42px] px-3 py-2"></div>
                <div><label class="block text-sm mb-1 text-slate-400">Party Name (Optional)</label><input type="text" x-model="cbForm.party" class="w-full border border-slate-800 bg-slate-900 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[42px] px-3 py-2"></div>
             </div>
             <div class="mt-6 flex justify-end gap-4">
                <button @click="cbModal=false" class="px-4 py-2 text-slate-400 font-medium hover:text-slate-200">Cancel</button>
                <button @click="saveManualEntry()" class="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700">Save Entry</button>
            </div>
        </div>
    </div>
`;
html = html.replace('<!-- Script Application Logic -->', cbModalHtml + '\n    <!-- Script Application Logic -->');

// 5. Ensure cbModal=true resets the form correctly by modifying the launch button
html = html.replace('@click="cbModal = true"', '@click="cbModal = true; cbForm = { type: \'receipt\', mode: \'cash\', amount: \'\', desc: \'\', party: \'\' }"');

fs.writeFileSync('index.html', html, 'utf-8');
console.log('Checks applied');
