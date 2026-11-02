// 從 icons/logo.svg 產生網頁 app 需要的各尺寸圖示。換 logo 後執行：node tools/make-icons.js
// logo.svg 需有 id="bg"（底板，帶 rx 圓角）與 id="mark"（圖案）兩個元素。
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const dir = path.join(__dirname, '..', 'icons');
const src = fs.readFileSync(path.join(dir, 'logo.svg'), 'utf8');

// 滿版底板，圖案縮到 scale 倍置中：給 maskable（安全區是中間 80% 圓）與 iOS（系統自己切圓角）用
function fullBleed(scale) {
  const off = 256 * (1 - scale);
  return src.replace(/(<rect id="bg"[^>]*?)\s+rx="[\d.]+"/, '$1')
    .replace('<g id="mark">', `<g id="mark" transform="translate(${off} ${off}) scale(${scale})">`);
}

const out = [
  ['icon-192.png', 192, src], ['icon-512.png', 512, src], ['favicon-32.png', 32, src],
  ['maskable-512.png', 512, fullBleed(0.78)], ['apple-touch-icon.png', 180, fullBleed(0.9)],
];

(async () => {
  const browser = await chromium.launch();
  for (const [name, size, svg] of out) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}`);
    await page.screenshot({ path: path.join(dir, name), omitBackground: true });
    await page.close();
    console.log(name, size);
  }
  await browser.close();
})();
