import * as fs from 'fs';

let html = fs.readFileSync('index.html', 'utf-8');

// 1. Add overflow-x-auto to existing wrappers
html = html.replace('class="max-h-64 overflow-y-auto border rounded-none mb-4"', 'class="max-h-64 overflow-y-auto overflow-x-auto border rounded-none mb-4 w-full"');
html = html.replace('class="max-h-64 overflow-y-auto border rounded-none mb-2"', 'class="max-h-64 overflow-y-auto overflow-x-auto border rounded-none mb-2 w-full"');
html = html.replace('class="bg-white border border-[#141414] shadow-[4px_4px_0_0_#141414]"', 'class="bg-white border border-[#141414] shadow-[4px_4px_0_0_#141414] overflow-x-auto w-full"');
html = html.replace('class="bg-white border border-[#141414] shadow-[4px_4px_0_0_#141414] overflow-x-auto w-full"', 'class="bg-white border border-[#141414] shadow-[4px_4px_0_0_#141414] overflow-x-auto w-full"'); // avoid duplication (just a note, regex is better)

// Make sure we only add it if not already there
html = html.replace(/<div x-show="!selectedLot" class="bg-white border border-\[#141414\] shadow-\[4px_4px_0_0_#141414\]( overflow-x-auto w-full)?">/g, '<div x-show="!selectedLot" class="bg-white border border-[#141414] shadow-[4px_4px_0_0_#141414] overflow-x-auto w-full">');
html = html.replace(/<div x-show="!selectedKhataBuyer" class="bg-white border border-\[#141414\] shadow-\[4px_4px_0_0_#141414\]( overflow-x-auto w-full)?">/g, '<div x-show="!selectedKhataBuyer" class="bg-white border border-[#141414] shadow-[4px_4px_0_0_#141414] overflow-x-auto w-full">');

// 2. Wrap standalone tables
// Top Outstanding Buyers table (line 86)
if (!html.includes('<div class="overflow-x-auto w-full"><table class="w-full text-left font-mono text-xs">\n                            <thead class="sticky top-0 bg-white z-10 border-b border-[#141414]"><tr class="text-[10px] uppercase text-[#141414]/50">\n                                <th class="p-2">Buyer</th>')) {
    html = html.replace('<table class="w-full text-left font-mono text-xs">\n                            <thead class="sticky top-0 bg-white z-10 border-b border-[#141414]"><tr class="text-[10px] uppercase text-[#141414]/50">\n                                <th class="p-2">Buyer</th>', 
                        '<div class="overflow-x-auto w-full"><table class="w-full text-left font-mono text-xs">\n                            <thead class="sticky top-0 bg-white z-10 border-b border-[#141414]"><tr class="text-[10px] uppercase text-[#141414]/50">\n                                <th class="p-2">Buyer</th>');
    // We need to close this div, where is the end of this table?
    html = html.replace('</tbody>\n                        </table>\n                    </section>', '</tbody>\n                        </table></div>\n                    </section>');
}

// Parties Table (line 112)
if (!html.includes('<div class="overflow-x-auto w-full"><table class="w-full bg-white border border-[#141414]')) {
    html = html.replace('<table class="w-full bg-white border border-[#141414] shadow-[4px_4px_0_0_#141414] text-sm text-left font-mono">', 
                        '<div class="overflow-x-auto w-full mb-4"><table class="w-full bg-white border border-[#141414] shadow-[4px_4px_0_0_#141414] text-sm min-w-max text-left font-mono">');
    // Close the wrapper
    html = html.replace('</tbody>\n                </table>\n            </div>', '</tbody>\n                </table></div>\n            </div>');
}

// Line 224: <table class="w-full border rounded-none text-left text-sm mb-6">
if (!html.includes('<div class="overflow-x-auto w-full mb-6"><table class="w-full border rounded-none text-left text-sm">')) {
    html = html.replace('<table class="w-full border rounded-none text-left text-sm mb-6">', '<div class="overflow-x-auto w-full mb-6"><table class="w-full min-w-[500px] border rounded-none text-left text-sm">');
    html = html.replace('</tbody>\n                        </table>\n                        \n                        <div class="flex justify-end gap-2">', '</tbody>\n                        </table></div>\n                        \n                        <div class="flex justify-end gap-2">');
}

// Line 412: crates summary
if (!html.includes('<div class="overflow-x-auto w-full mb-6"><table class="w-full min-w-[500px] text-sm text-left border">')) {
    html = html.replace('<table class="w-full text-sm text-left mb-6 border">', '<div class="overflow-x-auto w-full mb-6"><table class="w-full min-w-[500px] text-sm text-left border">');
    html = html.replace('</tbody>\n                            </table>\n                            <div class="flex', '</tbody>\n                            </table></div>\n                            <div class="flex');
}

// Line 485:
if (!html.includes('<div class="overflow-x-auto w-full mb-4"><table class="w-full min-w-[500px] text-sm text-left border">')) {
    html = html.replace('<table class="w-full text-sm text-left border">', '<div class="overflow-x-auto w-full mb-4"><table class="w-full min-w-[500px] text-sm text-left border">');
    html = html.replace('</tbody>\n                            </table>\n                        </div>', '</tbody>\n                            </table></div>\n                        </div>');
}

// Line 517: cashbook table
html = html.replace('<div class="bg-white border rounded-none">', '<div class="bg-white border rounded-none overflow-x-auto w-full">');

// Dashboard summary cards text sizing fix
// From: text-3xl font-mono text-[#141414]
html = html.replace(/text-3xl font-mono text-\[#141414\]/g, 'text-2xl sm:text-3xl font-mono text-[#141414]');
html = html.replace(/text-3xl font-mono text-red-600/g, 'text-2xl sm:text-3xl font-mono text-red-600');

// Modal overlays responsive tweaks
html = html.replace('class="bg-white w-full max-w-md p-6 rounded-none"', 'class="bg-white w-[95%] sm:w-full max-w-md p-4 sm:p-6 rounded-none max-h-[90vh] overflow-y-auto"');
html = html.replace('class="bg-white w-full max-w-sm p-6 rounded-none"', 'class="bg-white w-[95%] sm:w-full max-w-sm p-4 sm:p-6 rounded-none max-h-[90vh] overflow-y-auto"');
html = html.replace('<div class="bg-black bg-opacity-50 fixed inset-0 flex items-center justify-center z-50" x-cloak>', '<div class="bg-black/50 fixed inset-0 flex items-center justify-center z-50 p-4" x-cloak>');


fs.writeFileSync('index.html', html, 'utf-8');
