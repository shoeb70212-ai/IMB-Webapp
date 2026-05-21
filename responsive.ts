import * as fs from 'fs';

let html = fs.readFileSync('index.html', 'utf-8');

// 1. Sidebar responsiveness
html = html.replace(
    '<aside class="w-64 flex flex-col border-r border-[#141414] bg-[#E4E3E0] text-[#141414] no-print h-full flex-shrink-0">',
    '<!-- Mobile overlay --><div x-show="sidebarOpen" @click="sidebarOpen = false" class="fixed inset-0 bg-[#141414]/50 z-40 md:hidden" x-cloak></div>\n    <aside :class="sidebarOpen ? \'translate-x-0\' : \'-translate-x-full\'" class="fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-[#141414] bg-[#E4E3E0] text-[#141414] no-print h-full flex-shrink-0 transition-transform duration-300 md:relative md:translate-x-0">'
);

// 2. Add toggle button in header
html = html.replace(
    '<header class="h-16 flex items-center justify-between px-8 border-b border-[#141414] bg-[#E4E3E0] no-print flex-shrink-0">',
    '<header class="h-16 flex items-center justify-between px-4 md:px-8 border-b border-[#141414] bg-[#E4E3E0] no-print flex-shrink-0">\n            <button @click="sidebarOpen = true" class="md:hidden mr-4 border border-[#141414] p-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="square" stroke-linejoin="miter" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg></button>'
);

// Close sidebar on tab change
html = html.replace('@click="changeTab(item)"', '@click="changeTab(item); sidebarOpen = false"');

// 3. Grid adjustments
html = html.replace('class="grid grid-cols-4 gap-4 mb-8"', 'class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"');
html = html.replace('class="grid grid-cols-3 gap-8 min-h-0"', 'class="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8 min-h-[500px] lg:min-h-0"');
html = html.replace('<div class="grid grid-cols-2 gap-4 max-w-md">', '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">');
html = html.replace('<div class="flex gap-6">', '<div class="flex flex-col md:flex-row gap-6">');
html = html.replace('<div class="grid grid-cols-2 gap-4 mb-6">', '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">');
html = html.replace('<div class="grid grid-cols-3 gap-4 mb-6">', '<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">');

// 4. Form flex adjust (Add Crate)
html = html.replace('class="flex gap-2 items-end bg-[#E4E3E0] p-3 rounded-none border border-[#141414]/20 mb-4"', 'class="flex flex-col sm:flex-row gap-2 items-start sm:items-end bg-[#E4E3E0] p-3 rounded-none border border-[#141414]/20 mb-4"');
html = html.replace('flex-1<div>', '<div class="w-full sm:flex-1">');
html = html.replace('<div class="w-24">', '<div class="w-full sm:w-24">');
html = html.replace('<button type="submit" class="bg-[#141414] text-[#E4E3E0] px-4 py-2 border border-[#141414] uppercase text-[11px] font-bold shadow-[2px_2px_0_0_#141414] hover:bg-transparent hover:text-[#141414] transition-colors rounded-none">Add</button>', '<button type="submit" class="w-full sm:w-auto bg-[#141414] text-[#E4E3E0] px-4 py-2 border border-[#141414] uppercase text-[11px] font-bold shadow-[2px_2px_0_0_#141414] hover:bg-transparent hover:text-[#141414] transition-colors rounded-none mt-2 sm:mt-0">Add</button>');
// Need to do this properly
html = html.replace('class="w-full border border-[#141414] bg-white p-2 rounded-none focus:outline-none focus:ring-1 focus:ring-[#141414]"', 'class="w-full border border-[#141414] bg-white p-2 rounded-none focus:outline-none focus:ring-1 focus:ring-[#141414] min-h-[40px]"');
html = html.replace('class="w-full border border-[#141414] bg-white p-1 rounded-none focus:outline-none focus:ring-1 focus:ring-[#141414]"', 'class="w-full border border-[#141414] bg-white p-1 rounded-none focus:outline-none focus:ring-1 focus:ring-[#141414] min-h-[32px]"');

// Add state to alpine
html = html.replace("tab: 'dashboard', partyTab: 'seller'", "sidebarOpen: false, tab: 'dashboard', partyTab: 'seller'");

// Change top flex of step 4
html = html.replace('<div class="w-72 bg-[#E4E3E0] border border-[#141414]/30 p-4">', '<div class="w-full md:w-72 bg-[#E4E3E0] border border-[#141414]/30 p-4">');

fs.writeFileSync('index.html', html, 'utf-8');
