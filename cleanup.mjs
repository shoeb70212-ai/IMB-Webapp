import fs from 'fs';

let html = fs.readFileSync('index.html', 'utf-8');

const replacements = [
    [/p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-\[42px\] px-3 py-2/g, 'rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[42px] px-3 py-2'],
    [/p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm min-h-\[42px\] px-3 py-2/g, 'rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm min-h-[42px] px-3 py-2'],
    [/p-2 rounded-md focus:outline-none focus:ring-1/g, 'rounded-md focus:outline-none focus:ring-1 px-3 py-2']
];

for (const [pat, repl] of replacements) {
    html = html.replace(pat, repl);
}

fs.writeFileSync('index.html', html, 'utf-8');
console.log('Cleanup applied successfully!');
