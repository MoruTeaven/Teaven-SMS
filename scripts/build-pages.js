const fs = require('fs');
const path = require('path');

const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin-dashboard.html'), 'utf-8');
const userHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'user-center.html'), 'utf-8');

const outDir = path.join(__dirname, '..', 'src', 'gen');
fs.mkdirSync(outDir, { recursive: true });

const content = `// Auto-generated. Do not edit.
export const ADMIN_HTML = ${JSON.stringify(adminHtml)};
export const USER_HTML = ${JSON.stringify(userHtml)};
`;

fs.writeFileSync(path.join(outDir, 'pages.ts'), content, 'utf-8');
console.log('Pages embedded successfully.');
console.log('  admin-dashboard.html:', (adminHtml.length / 1024).toFixed(1), 'KB');
console.log('  user-center.html:', (userHtml.length / 1024).toFixed(1), 'KB');
