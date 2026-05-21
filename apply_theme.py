import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Body
html = html.replace('<body class="bg-slate-50 text-slate-800 font-sans h-screen flex overflow-hidden"', 
                    '<body class="flex h-screen w-full bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0] overflow-hidden"')

# 2. Sidebar
html = re.sub(r'<nav class="w-64 bg-slate-900.*?</nav>', '''<aside class="w-64 flex flex-col border-r border-[#141414] bg-[#E4E3E0] text-[#141414] no-print h-full flex-shrink-0">
        <div class="p-6 border-b border-[#141414]">
            <h1 class="text-xl font-bold tracking-tight uppercase leading-none">Kisan Mitra<br><span class="text-[10px] font-normal italic opacity-60">Mandi Services</span></h1>
        </div>
        <nav class="flex-1 py-4 uppercase text-[11px] font-semibold tracking-widest overflow-y-auto">
            <template x-for="item in ['dashboard', 'parties', 'new_lot', 'lots', 'khata', 'cashbook', 'reports', 'settings']">
                <button @click="changeTab(item)" 
                        :class="{'bg-[#141414] text-[#E4E3E0]': tab === item, 'hover:bg-white text-[#141414] border-b border-[#141414]/10': tab !== item}"
                        class="flex items-center px-6 py-3 transition-colors w-full text-left" x-text="item.replace(/_/g, ' ')">
                </button>
            </template>
        </nav>
        <div class="p-6 mt-auto border-t border-[#141414]">
            <div class="text-[10px] uppercase opacity-50 mb-1">Active Session</div>
            <div class="font-mono text-xs">TERM-01 / <span x-text="new Date().toLocaleDateString('en-GB')"></span></div>
        </div>
    </aside>''', html, flags=re.DOTALL)

# 3. Main container
html = html.replace('<main class="flex-1 overflow-y-auto relative print-container flex flex-col h-full bg-slate-50">', 
                    '<main class="flex-1 flex flex-col overflow-hidden bg-[#E4E3E0] relative print-container h-full">')
html = html.replace('<header class="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between no-print shadow-sm flex-shrink-0">',
                    '<header class="h-16 flex items-center justify-between px-8 border-b border-[#141414] bg-[#E4E3E0] no-print flex-shrink-0">')
html = html.replace('<h1 class="text-xl font-bold text-slate-800 capitalize" x-text="tab.replace(\'_\', \' \')"></h1>',
                    '<div class="flex items-center space-x-4"><span class="w-3 h-3 bg-green-600 rounded-full"></span> <span class="uppercase text-[11px] font-bold tracking-widest" x-text="tab.replace(/_/g, \' \')"></span></div>')
html = html.replace('<div class="flex items-center gap-4">\n                <span class="text-sm font-medium text-slate-600" x-text="settings.business_name"></span>\n            </div>',
                    '<div class="flex items-center space-x-6"><div class="text-right text-[11px] uppercase"><div class="opacity-50">Business Name</div><div class="font-mono font-bold text-sm text-[#141414]" x-text="settings.business_name || \'Not Set\'"></div></div></div>')

# 4. Scroll view for inner main content
html = html.replace('<div class="p-6 flex-1">', '<div class="p-6 flex-1 overflow-y-auto">')

# 5. Dashboard Cards
html = html.replace('grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8', 'grid-cols-4 gap-4 mb-8')
html = html.replace('bg-white p-4 rounded shadow-sm border border-slate-100', 'p-4 border border-[#141414] bg-white shadow-[4px_4px_0_0_#141414]')
html = html.replace('text-slate-500 text-sm mb-1 font-medium', 'text-[10px] uppercase font-bold opacity-50 mb-2')
html = html.replace('text-xl font-bold text-slate-800', 'text-3xl font-mono text-[#141414]')

# 6. Content Panels / Tables
html = html.replace('bg-white rounded shadow-sm border border-slate-100 p-4', 'border border-[#141414] bg-white flex flex-col p-4 shadow-[4px_4px_0_0_#141414]')
html = html.replace('h2 class="font-bold text-lg mb-4"', 'h2 class="font-serif italic text-lg uppercase mb-4 text-[#141414]"')
html = html.replace('h2 class="text-xl font-bold mb-4"', 'h2 class="font-serif italic text-xl uppercase mb-4 text-[#141414]"')
html = html.replace('h2 class="text-xl font-bold mb-1"', 'h2 class="font-serif italic text-xl uppercase mb-1 text-[#141414]"')
html = html.replace('text-slate-500 text-sm mb-4', 'text-[10px] uppercase font-bold opacity-50 mb-4')

# 7. Tables general
html = html.replace('table class="w-full text-left text-sm"', 'table class="w-full text-left font-mono text-xs"')
html = html.replace('thead class="border-b bg-slate-50"', 'thead class="sticky top-0 bg-white z-10 border-b border-[#141414]"')
html = html.replace('thead class="bg-slate-50 border-b text-slate-500"', 'thead class="sticky top-0 bg-white z-10 border-b border-[#141414] text-[#141414]/50 uppercase text-[10px]"')
html = html.replace('thead class="bg-slate-100 sticky top-0"', 'thead class="sticky top-0 bg-[#E4E3E0] z-10 border-b border-[#141414] text-[#141414]/50 uppercase text-[10px]"')
html = html.replace('thead class="bg-slate-100 border-b text-slate-600"', 'thead class="sticky top-0 bg-[#E4E3E0] z-10 border-b border-[#141414] text-[#141414]/50 uppercase text-[10px]"')
html = html.replace('thead class="bg-slate-100"', 'thead class="sticky top-0 bg-[#E4E3E0] z-10 border-b border-[#141414] text-[#141414]/50 uppercase text-[10px]"')

html = html.replace('tr class="text-slate-500"', 'tr class="text-[10px] uppercase text-[#141414]/50"')
html = html.replace('border-b last:border-0 hover:bg-slate-50 cursor-pointer', 'hover:bg-[#141414] hover:text-[#E4E3E0] cursor-pointer border-b border-[#141414]/10')
html = html.replace('border-b hover:bg-slate-50 cursor-pointer', 'hover:bg-[#141414] hover:text-[#E4E3E0] cursor-pointer border-b border-[#141414]/10')
html = html.replace('border-b hover:bg-slate-50', 'hover:bg-[#141414]/5 border-b border-[#141414]/10')
html = html.replace('border-b', 'border-b border-[#141414]/10')
html = html.replace('border-t hover:bg-slate-50', 'border-t border-[#141414]/10 hover:bg-[#141414]/5')
html = html.replace('border-t', 'border-t border-[#141414]/10')

# 8. Modals & Whitespace panels
html = html.replace('bg-white rounded border border-slate-200', 'bg-white border border-[#141414] shadow-[4px_4px_0_0_#141414]')
html = html.replace('bg-white border rounded-lg p-6', 'bg-white border border-[#141414] p-6 shadow-[4px_4px_0_0_#141414]')
html = html.replace('bg-white border border-slate-200 rounded-lg p-6', 'bg-white border border-[#141414] p-6 shadow-[4px_4px_0_0_#141414]')
html = html.replace('bg-white p-6 rounded shadow-sm border border-slate-100', 'bg-white p-6 border border-[#141414] shadow-[4px_4px_0_0_#141414]')
html = html.replace('bg-white p-6 border rounded shadow-sm', 'bg-white p-6 border border-[#141414] shadow-[4px_4px_0_0_#141414]')
html = html.replace('bg-white p-6 rounded border border-slate-200', 'bg-white p-6 border border-[#141414] shadow-[4px_4px_0_0_#141414]')
html = html.replace('table class="w-full bg-white rounded shadow-sm text-sm text-left"', 'table class="w-full bg-white border border-[#141414] shadow-[4px_4px_0_0_#141414] text-sm text-left font-mono"')

# 9. Buttons
html = html.replace('bg-indigo-600 text-white', 'bg-[#141414] text-[#E4E3E0] border border-[#141414] hover:bg-[#E4E3E0] hover:text-[#141414] transition-colors')
html = html.replace('text-indigo-600', 'text-[#141414] font-bold')

# 10. Inputs & Selects
html = html.replace('border p-2 rounded', 'border border-[#141414] p-2 bg-transparent rounded-none focus:outline-none focus:ring-1 focus:ring-[#141414]')
html = html.replace('border p-1 rounded', 'border border-[#141414] p-1 bg-transparent rounded-none focus:outline-none focus:ring-1 focus:ring-[#141414]')
html = html.replace('border p-1.5 rounded', 'border border-[#141414] p-1.5 bg-transparent rounded-none focus:outline-none focus:ring-1 focus:ring-[#141414]')

# Fix arbitrary remnants
html = html.replace('text-slate-500', 'text-[#141414]/60')
html = html.replace('text-slate-600', 'text-[#141414]/80')
html = html.replace('text-slate-800', 'text-[#141414]')
html = html.replace('bg-slate-50', 'bg-[#E4E3E0]')
html = html.replace('bg-slate-100', 'bg-white')
html = html.replace('border-slate-200', 'border-[#141414]/20')
html = html.replace('rounded', 'rounded-none')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
