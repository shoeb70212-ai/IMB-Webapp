import fs from 'fs';

let html = fs.readFileSync('index.html', 'utf-8');

const replacements = [
    // Change sharp edges to rounded-md for a more modern native look
    [/rounded-none/g, 'rounded-md'],
    // Improve button padding and typography
    [/px-6 py-2 border border-slate-800 text-xs/g, 'px-4 py-2 border border-slate-800 text-sm'],
    [/px-4 py-2 border border-slate-800 text-xs/g, 'px-4 py-2 border border-slate-800 text-sm'],
    [/px-6 py-2 border border-slate-800 uppercase text-\[11px\]/g, 'px-4 py-2 border border-slate-700 uppercase tracking-wider text-xs'],
    // Dashboard table headers
    [/text-xs uppercase tracking-wider/g, 'text-xs uppercase tracking-wider font-semibold'],
    // Improve inputs spacing and sizes
    [/min-h-\[40px\]/g, 'min-h-[42px] px-3 py-2'],
    // Improve modals width
    [/w-\[95%\] sm:w-full/g, 'w-[95%] sm:w-full sm:max-w-md'],
    // Header text formatting
    [/font-sans font-semibold tracking-tight text-xl/g, 'font-sans font-bold tracking-tight text-lg sm:text-xl'],
    // General gap improvements
    [/gap-1/g, 'gap-2'],
    [/gap-2/g, 'gap-3'],
    [/gap-3/g, 'gap-4'],
    // Fix over-written text sizes in headers
    [/font-mono text-\[13px\] text-xs/g, 'font-mono text-sm'],
    [/font-mono text-\[13px\]/g, 'font-mono text-sm']
];

for (const [pat, repl] of replacements) {
    html = html.replace(pat, repl);
}

fs.writeFileSync('index.html', html, 'utf-8');
console.log('Layout refinements applied successfully!');
