import fs from 'fs';

let html = fs.readFileSync('index.html', 'utf-8');

const replacements = [
    [/bg-slate-900 border border-slate-800 shadow-md shadow-black\/40 w-\[95%\] sm:w-full sm:max-w-md max-w-md p-4 md:p-6/g, 'bg-slate-900 border border-slate-800 rounded-xl shadow-xl w-[95%] sm:w-full sm:max-w-md p-6'],
    [/bg-slate-900 border border-slate-800 shadow-md shadow-black\/40 w-\[95%\] sm:w-full max-w-sm p-4 md:p-6/g, 'bg-slate-900 border border-slate-800 rounded-xl shadow-xl w-[95%] sm:w-full sm:max-w-sm p-6'],
    // Stat cards logic
    [/p-4 border border-slate-800 bg-slate-900 shadow-md shadow-black\/40/g, 'p-5 border border-slate-800 bg-slate-900 rounded-xl shadow-sm'],
    // Card wrappers
    [/bg-slate-900 flex flex-col min-h-0/g, 'bg-slate-900 rounded-xl flex flex-col min-h-0 overflow-hidden'],
    [/bg-slate-900 p-4 md:p-6 border border-slate-800 shadow-md/g, 'bg-slate-900 p-5 sm:p-6 border border-slate-800 rounded-xl shadow-sm'],
    // Cashbook tables wrapper
    [/bg-slate-900 border rounded-md overflow-x-auto w-full/g, 'bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto w-full shadow-sm'],
    // New Lot main wrapper
    [/bg-slate-900 p-4 md:p-6 border border-slate-800 shadow-md shadow-black\/40 min-h-\[400px\]/g, 'bg-slate-900 p-5 sm:p-7 border border-slate-800 rounded-xl shadow-sm min-h-[400px]'],
    // Lot viewer
    [/bg-slate-900 border border-slate-800 p-4 md:p-6 shadow-md shadow-black\/40/g, 'bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-7 shadow-sm'],
    // Main area party list
    [/bg-slate-900 border border-slate-800 shadow-md shadow-black\/40 text-sm/g, 'bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden text-sm'],
    // Unsaved lot draft banner
    [/bg-slate-950 border border-slate-800/g, 'bg-slate-950 border border-slate-800 rounded-lg'],
    [/mt-8/g, 'mt-6 sm:mt-8'],
    [/p-3 border border-slate-800/g, 'p-4 border border-slate-800 rounded-lg'],
    // Cashbook & Add party text and padding
    [/py-1.5 rounded-md text-sm/g, 'py-2 rounded-md text-sm px-4'],
    [/px-4 py-2 text-slate-400/g, 'px-4 py-2 text-slate-400 font-medium hover:text-slate-200'],
    [/bg-slate-950 border rounded-md p-4/g, 'bg-slate-950 border border-slate-800 rounded-xl p-5'],
    [/w-full sm:w-72 bg-slate-950 p-4 border rounded-md/g, 'w-full sm:w-80 bg-slate-950 p-5 border border-slate-800 rounded-xl'],
    [/max-w-4xl mx-auto/g, 'max-w-5xl mx-auto'],
    [/bg-slate-950 p-4 border-b border-slate-700\/50 text-center/g, 'bg-slate-950 p-5 border-b border-slate-800 text-center'],
    [/p-4 bg-slate-900 text-sm/g, 'p-6 bg-slate-900 text-sm'],
    // Tables
    [/font-mono text-\[13px\] text-xs/g, 'font-mono text-sm leading-relaxed'],
    [/text-xs uppercase tracking-wider font-mono text-\[13px\]/g, 'text-xs uppercase tracking-wider font-semibold']
];

for (const [pat, repl] of replacements) {
    html = html.replace(pat, repl);
}

fs.writeFileSync('index.html', html, 'utf-8');
console.log('Final polish applied successfully!');
