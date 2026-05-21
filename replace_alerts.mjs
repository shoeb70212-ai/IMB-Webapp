import fs from 'fs';

let html = fs.readFileSync('index.html', 'utf-8');

const toastData = `
                toastMsg: '', toastType: 'error',
                toast(msg, type='error') {
                    this.toastMsg = msg;
                    this.toastType = type;
                    setTimeout(() => { if(this.toastMsg === msg) this.toastMsg = ''; }, 3000);
                },
`;
html = html.replace('hasDraft: false,', toastData + 'hasDraft: false,');

// Replace alerts
html = html.replace(/alert\('([^']+)'\)/g, "this.toast('$1')");
html = html.replace(/alert\("([^"]+)"\)/g, 'this.toast("$1")');
html = html.replace(/(else\s*\{[\s]*)alert/g, "$1this.toast"); // for the inline button
html = html.replace(/if\(!confirm\('[^']+'\)\) return;/g, "this.toast('Credit limit exceeded, proceeding anyway', 'warning');");

// The inline button had: if(nl.seller_id){nl.step=2}else{alert('Select a seller')}
html = html.replace(/alert\('Select a seller'\)/g, "toast('Select a seller')");

// Add toast UI before closing </body>
const toastUI = `
    <!-- Toast Notification -->
    <div x-show="toastMsg" 
        x-transition
        class="fixed bottom-4 right-4 z-[9999] px-6 py-3 rounded-xl shadow-xl font-medium text-sm border border-slate-800"
        :class="toastType === 'success' ? 'bg-emerald-600 text-white' : (toastType === 'warning' ? 'bg-amber-500 text-slate-900' : 'bg-rose-500 text-white')"
        x-cloak>
        <span x-text="toastMsg"></span>
    </div>
`;
html = html.replace('</body>', toastUI + '\n</body>');

// Fix success alerts
html = html.replace(/this\.toast\('Lot successfully finalized!'\)/g, "this.toast('Lot successfully finalized!', 'success')");
html = html.replace(/this\.toast\('Payment Recorded!'\)/g, "this.toast('Payment Recorded!', 'success')");
html = html.replace(/this\.toast\('Entry saved!'\)/g, "this.toast('Entry saved!', 'success')");
html = html.replace(/this\.toast\('Seller Paid!'\)/g, "this.toast('Seller Paid!', 'success')");
html = html.replace(/this\.toast\('Settings saved'\)/g, "this.toast('Settings saved', 'success')");

fs.writeFileSync('index.html', html, 'utf-8');
console.log('Alerts replaced with toasts.');
