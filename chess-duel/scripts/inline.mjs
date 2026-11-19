// Inlines the single-file build's JS and CSS into one HTML body fragment.
import fs from 'node:fs';
const dir = 'dist-single';
const html = fs.readFileSync(`${dir}/index.html`, 'utf8');
const js = fs.readFileSync(`${dir}/${html.match(/src="\.\/(assets\/[^"]+\.js)"/)[1]}`, 'utf8');
const css = fs.readFileSync(`${dir}/${html.match(/href="\.\/(assets\/[^"]+\.css)"/)[1]}`, 'utf8');
const out = `<title>Chess Duel</title>\n<meta name="theme-color" content="#121012">\n<style>${css}</style>\n<div id="root"></div>\n<script type="module">${js.replace(/<\/script/g, '<\\/script')}</script>\n`;
fs.writeFileSync(process.argv[2], out);
console.log((out.length / 1024).toFixed(0) + ' KB');
