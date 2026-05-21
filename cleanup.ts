import * as fs from 'fs';

let html = fs.readFileSync('index.html', 'utf-8');

html = html.replace(/bg-slate-800/g, 'bg-[#141414]');
html = html.replace(/border-slate-800/g, 'border-[#141414]');
html = html.replace(/text-slate-800/g, 'text-[#141414]');
html = html.replace(/bg-slate-300/g, 'bg-[#141414]/30');
html = html.replace(/border-slate-300/g, 'border-[#141414]/30');

// Replace exact class 'rounded' with 'rounded-none' 
// Handle space boundaries
html = html.replace(/\brounded\b/g, 'rounded-none');
html = html.replace(/\brounded-lg\b/g, 'rounded-none');
html = html.replace(/\brounded-md\b/g, 'rounded-none');
html = html.replace(/\brounded-sm\b/g, 'rounded-none');

// The stat cards inside dashboard might still be 1 cols md:grid-cols-2 etc, we forced it to grid-cols-4.

fs.writeFileSync('index.html', html, 'utf-8');
console.log('Cleanup completed');
