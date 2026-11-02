#!/usr/bin/env node
// 迴廊幻境截圖：node tools/drift-shot.js [輸出資料夾，預設 ./drift-shots] [寬度，預設 640]
// 用真正的遊戲頁（index.html?drift-dev）逐章截兩張：一開始的樣子、照解法動完機關後的樣子。
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const out = path.resolve(process.argv[2] || 'drift-shots'), width = +process.argv[3] || 640;
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: width + 40, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const url = 'file://' + path.resolve(__dirname, '../index.html');
  await page.goto(url + '?drift-dev&drift-level=0#drift'); await page.waitForTimeout(400);
  const n = await page.evaluate(() => (window.DriftLevels || []).length || 2);
  const D = require('../js/drift.js');
  for (let i = 0; i < n; i++) {
    await page.goto(url + `?drift-dev&drift-level=${i}#drift`); await page.waitForTimeout(350);
    const stage = await page.$('#dr-stage');
    await stage.screenshot({ path: path.join(out, `ch${i + 1}-start.png`) });
    const L = await page.evaluate(() => window.__drift.W.L);
    const sol = D.solve(D.build(L));
    if (sol.plan) {
      await page.evaluate(plan => window.__drift.apply(plan), sol.plan); await page.waitForTimeout(120);
      await stage.screenshot({ path: path.join(out, `ch${i + 1}-solved.png`) });
    }
    console.log(`第 ${i + 1} 章：${sol.ops} 次操作`);
  }
  if (errors.length) console.log('頁面錯誤：\n' + errors.join('\n'));
  await browser.close();
  console.log('截圖在 ' + out);
})();
