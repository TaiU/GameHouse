// 數獨：產生唯一解題目、筆記、錯誤提示、復原
(function () {
  const S = {};

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const peersOf = [];
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9), c = i % 9, set = new Set();
    for (let k = 0; k < 9; k++) { set.add(r * 9 + k); set.add(k * 9 + c); }
    const br = r - r % 3, bc = c - c % 3;
    for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) set.add((br + dr) * 9 + bc + dc);
    set.delete(i); peersOf.push([...set]);
  }
  function candidates(g, i) {
    const used = new Set(); for (const p of peersOf[i]) if (g[p]) used.add(g[p]);
    const out = []; for (let v = 1; v <= 9; v++) if (!used.has(v)) out.push(v); return out;
  }
  // 計算解數（最多 limit 個）
  function countSolutions(g, limit) {
    let best = -1, bestC = null;
    for (let i = 0; i < 81; i++) if (!g[i]) {
      const c = candidates(g, i);
      if (c.length === 0) return 0;
      if (best < 0 || c.length < bestC.length) { best = i; bestC = c; if (c.length === 1) break; }
    }
    if (best < 0) return 1;
    let n = 0;
    for (const v of bestC) { g[best] = v; n += countSolutions(g, limit - n); g[best] = 0; if (n >= limit) break; }
    return n;
  }
  function fill(g) {
    let i = g.indexOf(0); if (i < 0) return true;
    for (const v of shuffle(candidates(g, i))) { g[i] = v; if (fill(g)) return true; }
    g[i] = 0; return false;
  }
  S.generate = function (clues) {
    const sol = new Array(81).fill(0); fill(sol);
    const puz = sol.slice();
    let filled = 81;
    for (const i of shuffle([...Array(81).keys()])) {
      if (filled <= clues) break;
      const keep = puz[i]; puz[i] = 0;
      if (countSolutions(puz.slice(), 2) !== 1) puz[i] = keep; else filled--;
    }
    return { puzzle: puz, solution: sol };
  };

  const LEVELS = [
    { id: 'easy', name: '入門', clues: 40 },
    { id: 'mid', name: '進階', clues: 32 },
    { id: 'hard', name: '高手', clues: 26 },
    { id: 'expert', name: '大師', clues: 22 },
  ];

  S.mount = function (root, api) {
    let st, level = api.load('sudoku.level', 'mid'), timer = null;
    root.innerHTML = `
      <div class="game-head">
        <div class="seg" id="sd-levels">${LEVELS.map(l => `<button data-l="${l.id}">${l.name}</button>`).join('')}</div>
        <div class="stat"><span id="sd-time">00:00</span> · 錯誤 <span id="sd-err">0</span>/3</div>
      </div>
      <div class="sd-wrap">
        <div class="sd-grid" id="sd-grid" tabindex="0" aria-label="數獨盤面"></div>
        <div class="sd-side">
          <div class="sd-pad" id="sd-pad">${[1,2,3,4,5,6,7,8,9].map(n => `<button data-n="${n}"><b>${n}</b><small></small></button>`).join('')}</div>
          <div class="tools">
            <button id="sd-undo">復原</button>
            <button id="sd-erase">清除</button>
            <button id="sd-note" aria-pressed="false">筆記</button>
            <button id="sd-hint">提示</button>
            <button id="sd-new" class="primary">新局</button>
          </div>
        </div>
      </div>
      <p class="msg" id="sd-msg"></p>`;
    const grid = root.querySelector('#sd-grid');
    for (let i = 0; i < 81; i++) {
      const d = document.createElement('div'); d.className = 'sd-cell'; d.dataset.i = i;
      const r = Math.floor(i / 9), c = i % 9;
      if (c % 3 === 2 && c < 8) d.classList.add('br'); if (r % 3 === 2 && r < 8) d.classList.add('bb');
      grid.appendChild(d);
    }
    const cells = [...grid.children];
    const $ = s => root.querySelector(s);

    function newGame() {
      const L = LEVELS.find(l => l.id === level) || LEVELS[1];
      $('#sd-msg').textContent = '出題中…';
      setTimeout(() => {
        const { puzzle, solution } = S.generate(L.clues);
        st = { puzzle, solution, val: puzzle.slice(), notes: Array.from({ length: 81 }, () => new Set()), sel: puzzle.indexOf(0), err: 0, hist: [], noteMode: false, t0: Date.now(), done: false };
        $('#sd-msg').textContent = '';
        startTimer(); render();
      }, 20);
    }
    function startTimer() {
      clearInterval(timer);
      timer = setInterval(() => { if (!st || st.done) return; const s = Math.floor((Date.now() - st.t0) / 1000); $('#sd-time').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, 500);
    }
    function render() {
      root.querySelectorAll('#sd-levels button').forEach(b => b.classList.toggle('on', b.dataset.l === level));
      $('#sd-err').textContent = st.err; $('#sd-note').setAttribute('aria-pressed', st.noteMode);
      $('#sd-note').classList.toggle('on', st.noteMode);
      const selV = st.val[st.sel];
      const sr = Math.floor(st.sel / 9), sc = st.sel % 9;
      cells.forEach((el, i) => {
        const v = st.val[i], r = Math.floor(i / 9), c = i % 9;
        el.className = el.className.replace(/ (given|sel|peer|same|wrong)/g, '');
        if (st.puzzle[i]) el.classList.add('given');
        if (i === st.sel) el.classList.add('sel');
        else if (r === sr || c === sc || (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3))) el.classList.add('peer');
        if (v && v === selV && i !== st.sel) el.classList.add('same');
        if (v && v !== st.solution[i]) el.classList.add('wrong');
        if (v) el.textContent = v;
        else if (st.notes[i].size) el.innerHTML = `<div class="notes">${[1,2,3,4,5,6,7,8,9].map(n => `<i>${st.notes[i].has(n) ? n : ''}</i>`).join('')}</div>`;
        else el.textContent = '';
      });
      root.querySelectorAll('#sd-pad button').forEach(b => {
        const n = +b.dataset.n; const left = 9 - st.val.filter((v, i) => v === n && v === st.solution[i]).length;
        b.querySelector('small').textContent = left || ''; b.disabled = left === 0;
      });
    }
    function push() { st.hist.push({ val: st.val.slice(), notes: st.notes.map(s => new Set(s)) }); if (st.hist.length > 200) st.hist.shift(); }
    function input(n) {
      if (!st || st.done || st.puzzle[st.sel]) return;
      const i = st.sel;
      if (st.val[i] && st.val[i] === st.solution[i]) return;
      push();
      if (st.noteMode) { st.val[i] = 0; st.notes[i].has(n) ? st.notes[i].delete(n) : st.notes[i].add(n); }
      else {
        st.val[i] = n; st.notes[i].clear();
        if (n !== st.solution[i]) { st.err++; if (st.err >= 3) { st.done = true; $('#sd-msg').textContent = '錯了三次，這局結束。按「新局」再來一盤。'; } }
        else for (const p of peersOf[i]) st.notes[p].delete(n);
        if (st.val.every((v, k) => v === st.solution[k])) { st.done = true; $('#sd-msg').textContent = `完成！用時 ${$('#sd-time').textContent}，錯誤 ${st.err} 次。`; api.confetti(); }
      }
      render();
    }
    grid.addEventListener('click', e => { const c = e.target.closest('.sd-cell'); if (!c) return; st.sel = +c.dataset.i; render(); });
    root.querySelector('#sd-pad').addEventListener('click', e => { const b = e.target.closest('button'); if (b) input(+b.dataset.n); });
    $('#sd-undo').onclick = () => { const h = st.hist.pop(); if (h && !st.done) { st.val = h.val; st.notes = h.notes; render(); } };
    $('#sd-erase').onclick = () => { if (st.puzzle[st.sel] || st.done) return; if (st.val[st.sel] === st.solution[st.sel]) return; push(); st.val[st.sel] = 0; st.notes[st.sel].clear(); render(); };
    $('#sd-note').onclick = () => { st.noteMode = !st.noteMode; render(); };
    $('#sd-hint').onclick = () => { if (st.done) return; let i = st.sel; if (st.val[i] === st.solution[i]) i = st.val.findIndex((v, k) => v !== st.solution[k]); if (i < 0) return; st.sel = i; const nm = st.noteMode; st.noteMode = false; input(st.solution[i]); st.noteMode = nm; render(); };
    $('#sd-new').onclick = newGame;
    root.querySelector('#sd-levels').onclick = e => { const b = e.target.closest('button'); if (!b) return; level = b.dataset.l; api.save('sudoku.level', level); newGame(); };
    const onKey = e => {
      if (!st) return;
      if (e.key >= '1' && e.key <= '9') input(+e.key);
      else if (e.key === 'Backspace' || e.key === 'Delete') $('#sd-erase').onclick();
      else if (e.key === 'n' || e.key === 'N') $('#sd-note').onclick();
      else { const m = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key]; if (m) { e.preventDefault(); st.sel = (st.sel + m + 81) % 81; render(); } }
    };
    document.addEventListener('keydown', onKey);
    newGame();
    return () => { clearInterval(timer); document.removeEventListener('keydown', onKey); };
  };

  if (typeof module !== 'undefined') module.exports = S; else window.GameRoom.register('sudoku', S);
})();
