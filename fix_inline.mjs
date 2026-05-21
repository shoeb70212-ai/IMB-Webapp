import fs from 'fs';
let html = fs.readFileSync('index.html', 'utf-8');
html = html.replace(/else\{this\.toast/g, 'else{toast');
html = html.replace(/saveData\(\);\s*this\.toast/g, 'saveData(); toast'); // in @click inline
fs.writeFileSync('index.html', html, 'utf-8');
console.log('Fixed alpine inline bindings');
