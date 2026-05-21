import * as fs from 'fs';

let html = fs.readFileSync('index.html', 'utf-8');

html = html.replace('class="bg-white rounded-lg shadow-xl w-full max-w-md p-6"', 'class="bg-white border border-[#141414] shadow-[4px_4px_0_0_#141414] w-[95%] sm:w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"');
html = html.replace('class="bg-white rounded-lg shadow-xl w-full max-w-sm p-6"', 'class="bg-white border border-[#141414] shadow-[4px_4px_0_0_#141414] w-[95%] sm:w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto"');
html = html.replace('class="bg-white border rounded-none p-6 shadow-xl w-full max-w-sm"', 'class="bg-white border border-[#141414] shadow-[4px_4px_0_0_#141414] w-[95%] sm:w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto"');
html = html.replace('class="bg-white p-6 shadow-xl w-full max-w-sm border border-[#141414]"', 'class="bg-white border border-[#141414] shadow-[4px_4px_0_0_#141414] w-[95%] sm:w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto"');

// Fix remaining font-bold usages that don't match theme as much
html = html.replace('h2 class="text-lg font-bold mb-4"', 'h2 class="font-serif italic text-lg uppercase mb-4 text-[#141414]"');
html = html.replace('hover:text-[#141414] transition-colors rounded-none text-sm font-medium mb-2"', 'hover:text-[#141414] transition-colors rounded-none mb-2"');

fs.writeFileSync('index.html', html, 'utf-8');
