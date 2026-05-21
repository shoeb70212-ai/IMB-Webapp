import fs from 'fs';

let html = fs.readFileSync('index.html', 'utf-8');

const replacements = [
    // Modal missing rounded
    [/bg-slate-900 border border-slate-800 shadow-md shadow-black\/40 overflow-x-auto w-full/g, 'bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-x-auto w-full'],
    // table min-w
    [/w-full min-w-\[500px\] text-sm text-left border/g, 'w-full min-w-[500px] text-sm text-left border-y border-slate-800'],
    // other border tables
    [/border rounded-md/g, 'border border-slate-800 rounded-lg'],
    // cleanup text-sm
    [/font-mono text-sm leading-relaxed text-xs/g, 'font-mono text-sm'],
    [/font-mono text-\[13px\]/g, 'font-mono text-sm'],
    [/font-mono text-sm leading-relaxed/g, 'font-mono text-sm'],
    [/text-sm min-w-max text-left font-mono text-sm/g, 'w-full min-w-max text-left font-mono text-sm'],
    // Fix modal wrapper if any
    [/shadow-md shadow-black\/40/g, 'shadow-sm']
];

for (const [pat, repl] of replacements) {
    html = html.replace(pat, repl);
}

fs.writeFileSync('index.html', html, 'utf-8');
console.log('Final tweaks applied!');
