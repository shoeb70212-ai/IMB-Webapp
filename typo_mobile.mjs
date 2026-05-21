import fs from 'fs';

let html = fs.readFileSync('index.html', 'utf-8');

const replacements = [
    [/text-\[10px\] font-bold/g, 'text-xs font-semibold tracking-wide'],
    [/text-\[10px\] font-normal/g, 'text-xs tracking-wide'],
    [/border border-slate-700\/50 rounded-lg overflow-hidden/g, 'border border-slate-800 rounded-xl shadow-sm overflow-hidden'],
    [/bg-slate-950 p-5 border-b border-slate-700\/50 text-center/g, 'bg-slate-950 p-6 border-b border-slate-800 text-center'],
    // Ensure the main padding on desktop isn't unnecessarily tight on bottom
    [/p-4 sm:p-8 pb-16 md:pb-8/g, 'p-4 sm:p-8 pb-20 md:pb-8']
];

for (const [pat, repl] of replacements) {
    html = html.replace(pat, repl);
}

fs.writeFileSync('index.html', html, 'utf-8');
console.log('Mobile padding and typography fixed!');
