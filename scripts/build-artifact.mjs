// 產出可發佈成 Artifact 的頁面：去掉 html/head/body 殼、把 CSS 內嵌，其餘模組與 three.js 以同站檔案發佈。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles/main.css'), 'utf8');

const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
const keepHead = head
  .split('\n')
  .filter((line) => /<title>|fonts\.googleapis|fonts\.gstatic|importmap|<meta name="description"|\{ "imports"|\}$/.test(line) || line.includes('</script>'))
  .filter((line) => !line.includes('styles/main.css'))
  .join('\n');

const out = `${keepHead.trim()}
<style>
:root { color-scheme: dark; }
${css}
</style>
${body.trim()}
`;
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/index.html'), out);
console.log(`dist/index.html: ${out.length} bytes`);
