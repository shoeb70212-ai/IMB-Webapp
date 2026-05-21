import * as fs from 'fs';
let html = fs.readFileSync('index.html', 'utf-8');
html = html.split('rounded-none-full').join('rounded-full');
html = html.split('rounded-none-lg').join('rounded-lg');
html = html.split('rounded-none-md').join('rounded-md');
html = html.split('rounded-none-sm').join('rounded-sm');
html = html.split('rounded-none-none').join('rounded-none');
fs.writeFileSync('index.html', html, 'utf-8');
