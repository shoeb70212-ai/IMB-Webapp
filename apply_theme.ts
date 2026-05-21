import * as fs from 'fs';

let html = fs.readFileSync('index.html', 'utf-8');

// Colors and general mapping
const mapping: Record<string, string> = {
    'bg-slate-50': 'bg-[#E4E3E0]',
    'text-slate-800': 'text-[#141414]',
    'text-slate-700': 'text-[#141414]/90',
    'text-slate-600': 'text-[#141414]/70',
    'text-slate-500': 'text-[#141414]/50',
    'text-slate-400': 'text-[#141414]/30',
    'bg-indigo-600': 'bg-[#141414]',
    'text-indigo-600': 'text-[#141414] font-bold',
    'text-white': 'text-[#E4E3E0]',
    'bg-white': 'bg-white',
    'border-slate-100': 'border-[#141414]/20',
    'border-slate-200': 'border-[#141414]/30',
    'border-slate-300': 'border-[#141414]/50',
    'border-slate-700': 'border-[#141414]/70',
    'shadow-sm': 'shadow-[4px_4px_0_0_#141414]',
    'bg-slate-100': 'bg-[#E4E3E0]',
    'bg-slate-200': 'bg-[#141414]/10',
    'hover:bg-slate-50': 'hover:bg-[#141414] hover:text-[#E4E3E0]',
    'hover:bg-slate-200': 'hover:bg-[#141414]/20',
};

// Replace map exactly so we don't accidentally ruin class names
for (const [k, v] of Object.entries(mapping)) {
    html = html.split(k).join(v);
}

// 1. Body
html = html.replace('<body class="bg-[#E4E3E0] text-[#141414] font-sans h-screen flex overflow-hidden"', 
                    '<body class="flex h-screen w-full bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0] overflow-hidden"');

// 2. Sidebar replacement using regex
html = html.replace(/<nav class="w-64 bg-slate-900[\s\S]*?<\/nav>/, `<aside class="w-64 flex flex-col border-r border-[#141414] bg-[#E4E3E0] text-[#141414] no-print h-full flex-shrink-0">
        <div class="p-6 border-b border-[#141414]">
            <h1 class="text-xl font-bold tracking-tight uppercase leading-none">Kisan Mitra<br><span class="text-[10px] font-normal italic opacity-60">Mandi Services</span></h1>
        </div>
        <nav class="flex-1 py-4 uppercase text-[11px] font-semibold tracking-widest overflow-y-auto">
            <template x-for="item in ['dashboard', 'parties', 'new_lot', 'lots', 'khata', 'cashbook', 'reports', 'settings']">
                <button @click="changeTab(item)" 
                        :class="{'bg-[#141414] text-[#E4E3E0]': tab === item, 'hover:bg-white text-[#141414] border-b border-[#141414]/10': tab !== item}"
                        class="flex items-center px-6 py-3 transition-colors w-full text-left border-b border-[#141414]/10 last:border-0" x-text="item.replace(/_/g, ' ')">
                </button>
            </template>
        </nav>
        <div class="p-6 mt-auto border-t border-[#141414]">
            <div class="text-[10px] uppercase opacity-50 mb-1">Active Session</div>
            <div class="font-mono text-xs">TERM-01 / <span x-text="new Date().toLocaleDateString('en-GB')"></span></div>
        </div>
    </aside>`);

// 3. Main wrapper
html = html.replace('<main class="flex-1 overflow-y-auto relative print-container flex flex-col h-full bg-[#E4E3E0]">', 
                    '<main class="flex-1 flex flex-col overflow-hidden bg-[#E4E3E0] relative print-container h-full">');

// 4. Header
html = html.replace('<header class="h-16 bg-white border-b border-[#141414]/30 px-6 flex items-center justify-between no-print shadow-[4px_4px_0_0_#141414] flex-shrink-0">',
                    '<header class="h-16 flex items-center justify-between px-8 border-b border-[#141414] bg-[#E4E3E0] no-print flex-shrink-0">');

html = html.replace('<h1 class="text-xl font-bold text-[#141414] capitalize" x-text="tab.replace(\'_\', \' \')"></h1>',
                    '<div class="flex items-center space-x-4"><span class="w-3 h-3 bg-green-600 rounded-full"></span> <span class="uppercase text-[11px] font-bold tracking-widest" x-text="tab.replace(/_/g, \' \')"></span></div>');

html = html.replace('<div class="flex items-center gap-4">\n                <span class="text-sm font-medium text-[#141414]/70" x-text="settings.business_name"></span>\n            </div>',
                    '<div class="flex items-center space-x-6"><div class="text-right text-[11px] uppercase"><div class="opacity-50">Current Open Shift</div><div class="font-mono font-bold text-sm text-[#141414]" x-text="settings.business_name || \'TERM-1\'"></div></div></div>');

// 5. Scroll area
html = html.replace('<div class="p-6 flex-1">', '<div class="p-8 flex-1 overflow-y-auto grid grid-rows-[auto_1fr] gap-8">');

// 6. Dashboard Grid cols
html = html.replace('grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8', 'grid-cols-4 gap-4');

// 7. Stat Cards
html = html.split('<div class="bg-white p-4 rounded shadow-[4px_4px_0_0_#141414] border border-[#141414]/20">').join(
    '<div class="p-4 border border-[#141414] bg-white shadow-[4px_4px_0_0_#141414]">');

html = html.split('<div class="text-[#141414]/50 text-sm mb-1 font-medium"').join(
    '<div class="text-[10px] uppercase font-bold opacity-50 mb-2"');

html = html.split('<div class="text-xl font-bold text-[#141414]"').join(
    '<div class="text-3xl font-mono"');

// 8. Tables & Content blocks base classes
html = html.split('<div class="bg-white rounded shadow-[4px_4px_0_0_#141414] border border-[#141414]/20 p-4">').join(
    '<section class="border border-[#141414] bg-white flex flex-col min-h-0"><div class="p-4 border-b border-[#141414] flex justify-between items-center">');

html = html.split('<h2 class="font-bold text-lg mb-4">').join(
    '<h2 class="font-serif italic text-lg uppercase text-[#141414]">');

// End of header div inside sections
html = html.replace('<table class="w-full text-left text-sm">', '</div><div class="flex-1 overflow-auto p-4"><table class="w-full text-left font-mono text-xs">');

html = html.split('<table class="w-full text-left text-sm">').join(
    '<table class="w-full text-left font-mono text-xs">');

// 9. Tables headers
html = html.split('<thead class="border-b bg-[#E4E3E0]"><tr class="text-[#141414]/50">').join(
    '<thead class="sticky top-0 bg-white z-10 border-b border-[#141414]"><tr class="text-[10px] uppercase text-[#141414]/50">');

html = html.split('<thead class="border-b bg-[#E4E3E0]">').join(
    '<thead class="sticky top-0 bg-white z-10 border-b border-[#141414]"><tr class="text-[10px] uppercase text-[#141414]/50">');
    
html = html.split('<thead class="bg-[#E4E3E0] sticky top-0"><tr>').join(
    '<thead class="sticky top-0 bg-[#E4E3E0] z-10 border-b border-[#141414] text-[10px] uppercase text-[#141414]/50"><tr>');

html = html.split('<thead class="bg-[#E4E3E0] border-b text-[#141414]/50"><tr>').join(
    '<thead class="sticky top-0 bg-[#E4E3E0] z-10 border-b border-[#141414] text-[10px] uppercase text-[#141414]/50"><tr>');

// 10. Table hover borders
html = html.split('border-b last:border-0 hover:bg-[#141414] hover:text-[#E4E3E0] cursor-pointer').join(
    'hover:bg-[#141414] hover:text-[#E4E3E0] cursor-pointer border-b border-[#141414]/10');

html = html.split('border-b hover:bg-[#141414] hover:text-[#E4E3E0] cursor-pointer').join(
    'hover:bg-[#141414] hover:text-[#E4E3E0] cursor-pointer border-b border-[#141414]/10');

html = html.split('border-b hover:bg-[#141414] hover:text-[#E4E3E0]').join(
    'hover:bg-[#141414]/5 border-b border-[#141414]/10');

html = html.split('border-t hover:bg-[#141414] hover:text-[#E4E3E0]').join(
    'border-t border-[#141414]/10 hover:bg-[#141414]/5');

// 11. White panels / Modals
html = html.split('bg-white rounded border border-[#141414]/30').join(
    'bg-white border border-[#141414] shadow-[4px_4px_0_0_#141414]');

html = html.split('bg-white border rounded-lg p-6').join(
    'bg-white border border-[#141414] p-6 shadow-[4px_4px_0_0_#141414]');

html = html.split('bg-white border border-[#141414]/30 rounded-lg p-6').join(
    'bg-white border border-[#141414] p-6 shadow-[4px_4px_0_0_#141414]');

html = html.split('bg-white p-6 rounded shadow-[4px_4px_0_0_#141414] border border-[#141414]/20').join(
    'bg-white p-6 border border-[#141414] shadow-[4px_4px_0_0_#141414]');

html = html.split('bg-white p-6 border rounded shadow-[4px_4px_0_0_#141414]').join(
    'bg-white p-6 border border-[#141414] shadow-[4px_4px_0_0_#141414]');

html = html.split('bg-white p-6 rounded border border-[#141414]/30').join(
    'bg-white p-6 border border-[#141414] shadow-[4px_4px_0_0_#141414]');

html = html.split('w-full bg-white rounded shadow-[4px_4px_0_0_#141414] text-sm text-left').join(
    'w-full bg-white border border-[#141414] shadow-[4px_4px_0_0_#141414] text-sm text-left font-mono');

// 12. Buttons
html = html.split('bg-[#141414] text-[#E4E3E0] px-3 py-1.5 rounded').join('bg-[#141414] text-[#E4E3E0] px-4 py-2 border border-[#141414] uppercase text-[11px] font-bold shadow-[2px_2px_0_0_#141414] hover:bg-transparent hover:text-[#141414] transition-colors rounded-none');
html = html.split('bg-[#141414] text-[#E4E3E0] px-5 py-2 rounded font-medium').join('bg-[#141414] text-[#E4E3E0] px-6 py-2 border border-[#141414] uppercase text-[11px] font-bold shadow-[2px_2px_0_0_#141414] hover:bg-transparent hover:text-[#141414] transition-colors rounded-none');
html = html.split('bg-[#141414] text-[#E4E3E0] px-4 py-2 rounded font-medium').join('bg-[#141414] text-[#E4E3E0] px-6 py-2 border border-[#141414] uppercase text-[11px] font-bold shadow-[2px_2px_0_0_#141414] hover:bg-transparent hover:text-[#141414] transition-colors rounded-none');
html = html.split('bg-[#141414] text-[#E4E3E0] py-2 rounded font-medium text-sm').join('bg-[#141414] text-[#E4E3E0] py-2 border border-[#141414] uppercase text-[11px] font-bold shadow-[2px_2px_0_0_#141414] hover:bg-transparent hover:text-[#141414] transition-colors rounded-none');

// 13. Form Inputs
html = html.split('border p-2 rounded').join('border border-[#141414] bg-white p-2 rounded-none focus:outline-none focus:ring-1 focus:ring-[#141414]');
html = html.split('border p-1 rounded').join('border border-[#141414] bg-white p-1 rounded-none focus:outline-none focus:ring-1 focus:ring-[#141414]');
html = html.split('border p-1.5 rounded').join('border border-[#141414] bg-white p-2 rounded-none focus:outline-none focus:ring-1 focus:ring-[#141414]');

// 14. Some random h2 headers
html = html.split('<h2 class="text-xl font-bold mb-4">').join('<h2 class="font-serif italic text-xl uppercase mb-4 text-[#141414]">');
html = html.split('<h2 class="text-xl font-bold mb-1">').join('<h2 class="font-serif italic text-xl uppercase mb-1 text-[#141414]">');
html = html.split('<h2 class="text-lg font-bold mb-4">').join('<h2 class="font-serif italic text-lg uppercase mb-4 text-[#141414]">');
html = html.split('<h2 class="text-lg font-bold mb-6 border-b pb-2">').join('<h2 class="font-serif italic text-lg uppercase mb-6 border-b border-[#141414] pb-2 text-[#141414]">');

// 15. The "Recent lots" and "Top Outstanding" grid structure issue
const flexGridPatch = html.replace('<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">', '<div class="grid grid-cols-3 gap-8 min-h-0">');
if (flexGridPatch !== html) {
    html = flexGridPatch;
    // Inside this grid block we have 2 divs. Make the first span 2 columns.
    html = html.replace('<section class="border border-[#141414] bg-white flex flex-col min-h-0"><div class="p-4 border-b border-[#141414] flex justify-between items-center"><h2 class="font-serif italic text-lg uppercase text-[#141414]">Recent Lots</h2>', 
                        '<section class="col-span-2 border border-[#141414] bg-white flex flex-col min-h-0"><div class="p-4 border-b border-[#141414] flex justify-between items-center"><h2 class="font-serif italic text-lg uppercase text-[#141414]">Recent Lots</h2>');
}

// Write the result
fs.writeFileSync('index.html', html, 'utf-8');
console.log('Theme applied successfully.');
