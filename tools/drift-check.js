#!/usr/bin/env node
// 迴廊幻境關卡檢查：node tools/drift-check.js [關卡檔，預設 js/drift-levels.js]
// 每一章印出：錯誤、警告、最少要動幾次機關、一組解法，以及一開始的「畫面格」地圖。
// 有錯誤時結束碼為 1。
const fs = require('fs'), path = require('path'), vm = require('vm');
const D = require('../js/drift.js');
const file = path.resolve(process.argv[2] || path.join(__dirname, '../js/drift-levels.js'));
const sandbox = { window: {}, console };
vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const LEVELS = sandbox.window.DriftLevels;
if (!Array.isArray(LEVELS)) { console.error('檔案沒有設定 window.DriftLevels = [...]'); process.exit(1); }

let bad = 0;
LEVELS.forEach((L, i) => {
  const r = D.validate(L);
  console.log(`\n第 ${i + 1} 章「${L.name || '?'}」  方塊 ${r.info.blocks ?? '?'}、可走頂面 ${r.info.nodes ?? '?'}、最少操作 ${r.info.minOps ?? '?'} 次`);
  r.errors.forEach(e => console.log('  ✗ ' + e));
  r.warnings.forEach(w => console.log('  ! ' + w));
  if (r.errors.length) { bad++; return; }
  const W = D.build(L), st0 = D.initState(W), pos0 = D.layout(W, st0);
  if (r.info.plan) { // 照解法重播，印出每一步當下站的位置（世界座標，未轉視角）
    let st = D.initState(W);
    r.info.plan.forEach((m, k) => {
      const p = D.world(W, m.stand, st), what = m.g === 'view' ? (m.dir > 0 ? '把建築向右轉 ↻' : '把建築向左轉 ↺') : `把「${W.pieces[m.g].label || '機關' + m.g}」往${m.dir > 0 ? '前' : '回'}撥`;
      console.log(`  ${k + 1}. 走到 [${p.join(',')}]${W.blocks[m.stand].g >= 0 ? '（站在機關上）' : ''}，${what}`);
      st = D.operate(W, st, m.g, m.dir, m.stand);
    });
    console.log(`  ${r.info.plan.length + 1}. 走到終點`);
  }
  // 地圖：每個畫面格印出頂面高度（機關方塊用英文字母），S 起點、G 終點
  const nodes = D.nodes(W, st0); let u0 = 1e9, u1 = -1e9, w0 = 1e9, w1 = -1e9;
  for (const [, [u, w]] of nodes) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); w0 = Math.min(w0, w); w1 = Math.max(w1, w); }
  const at = new Map(); for (const [b, c] of nodes) at.set(c.join(), b);
  console.log(`  一開始的畫面格地圖（只畫走得到的頂面；橫軸 u = x−z、縱軸 w = y−z；數字是高度 z，字母是機關方塊，S 起點、G 終點）`);
  for (let w = w0; w <= w1; w++) {
    let line = '    ';
    for (let u = u0; u <= u1; u++) {
      const b = at.get(u + ',' + w);
      if (b === undefined) line += ' ·';
      else if (b === W.start) line += ' S';
      else if (b === W.goal) line += ' G';
      else if (W.blocks[b].g >= 0) line += ' ' + 'abcdefgh'[W.blocks[b].g];
      else { const z = pos0[b][2]; line += ' ' + (z >= 0 && z < 10 ? z : '+'); }
    }
    console.log(line);
  }
});
console.log(bad ? `\n${bad} 章有錯誤。` : `\n全部 ${LEVELS.length} 章都解得開。`);
process.exit(bad ? 1 : 0);
