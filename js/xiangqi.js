// 楚河漢界：中國象棋，對電腦（alpha-beta 搜尋）或雙人同機
(function () {
  const X = {};
  // 盤面 10 列 × 9 行，紅方在下（列 9），黑方在上（列 0）
  // 棋子：大寫紅、小寫黑。K 帥 A 仕 B 相 N 馬 R 車 C 炮 P 兵
  const START = [
    'rnbakabnr', '.........', '.c.....c.', 'p.p.p.p.p', '.........',
    '.........', 'P.P.P.P.P', '.C.....C.', '.........', 'RNBAKABNR'];
  const NAMES = { K: '帥', A: '仕', B: '相', N: '傌', R: '俥', C: '炮', P: '兵', k: '將', a: '士', b: '象', n: '馬', r: '車', c: '砲', p: '卒' };
  const VAL = { K: 10000, R: 900, C: 450, N: 400, B: 200, A: 200, P: 100 };
  const isRed = p => p && p === p.toUpperCase();
  const side = p => (p ? (isRed(p) ? 'r' : 'b') : null);
  const inB = (r, c) => r >= 0 && r < 10 && c >= 0 && c < 9;

  X.init = () => START.map(row => row.split('').map(ch => (ch === '.' ? '' : ch)));

  function pseudoMoves(b, r, c) {
    const p = b[r][c], s = side(p), P = p.toUpperCase(), out = [];
    const add = (rr, cc) => { if (inB(rr, cc) && side(b[rr][cc]) !== s) out.push([rr, cc]); };
    const inPalace = (rr, cc) => cc >= 3 && cc <= 5 && (s === 'r' ? rr >= 7 : rr <= 2);
    if (P === 'R' || P === 'C') {
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let rr = r + dr, cc = c + dc, jumped = false;
        while (inB(rr, cc)) {
          const q = b[rr][cc];
          if (P === 'R') { if (!q) out.push([rr, cc]); else { if (side(q) !== s) out.push([rr, cc]); break; } }
          else if (!jumped) { if (!q) out.push([rr, cc]); else jumped = true; }
          else if (q) { if (side(q) !== s) out.push([rr, cc]); break; }
          rr += dr; cc += dc;
        }
      }
    } else if (P === 'N') {
      for (const [dr, dc, lr, lc] of [[2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0], [1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1]])
        if (inB(r + lr, c + lc) && !b[r + lr][c + lc]) add(r + dr, c + dc);
    } else if (P === 'B') {
      for (const [dr, dc] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
        const rr = r + dr, cc = c + dc;
        if (inB(rr, cc) && !b[r + dr / 2][c + dc / 2] && (s === 'r' ? rr >= 5 : rr <= 4)) add(rr, cc);
      }
    } else if (P === 'A') {
      for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (inPalace(r + dr, c + dc)) add(r + dr, c + dc);
    } else if (P === 'K') {
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inPalace(r + dr, c + dc)) add(r + dr, c + dc);
    } else if (P === 'P') {
      const f = s === 'r' ? -1 : 1; add(r + f, c);
      if (s === 'r' ? r <= 4 : r >= 5) { add(r, c - 1); add(r, c + 1); }
    }
    return out;
  }
  function findKing(b, s) { const k = s === 'r' ? 'K' : 'k'; for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) if (b[r][c] === k) return [r, c]; return null; }
  function inCheck(b, s) {
    const k = findKing(b, s); if (!k) return true;
    const o = findKing(b, s === 'r' ? 'b' : 'r');
    if (o && o[1] === k[1]) { // 將帥照面
      let blocked = false; for (let r = Math.min(k[0], o[0]) + 1; r < Math.max(k[0], o[0]); r++) if (b[r][k[1]]) { blocked = true; break; }
      if (!blocked) return true;
    }
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
      const p = b[r][c]; if (!p || side(p) === s || p.toUpperCase() === 'K') continue;
      if (pseudoMoves(b, r, c).some(([rr, cc]) => rr === k[0] && cc === k[1])) return true;
    }
    return false;
  }
  X.legalMoves = function (b, s) {
    const out = [];
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
      if (side(b[r][c]) !== s) continue;
      for (const [rr, cc] of pseudoMoves(b, r, c)) {
        const cap = b[rr][cc]; b[rr][cc] = b[r][c]; b[r][c] = '';
        if (!inCheck(b, s)) out.push({ fr: r, fc: c, tr: rr, tc: cc, cap });
        b[r][c] = b[rr][cc]; b[rr][cc] = cap;
      }
    }
    return out;
  };
  X.inCheck = inCheck;

  // 簡單位置加分：兵過河、馬車往中路
  function evalBoard(b) {
    let s = 0;
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
      const p = b[r][c]; if (!p) continue; const P = p.toUpperCase(), red = isRed(p);
      let v = VAL[P];
      const adv = red ? 9 - r : r;
      if (P === 'P') v += adv >= 5 ? 60 + (4 - Math.abs(c - 4)) * 10 + (adv >= 8 ? -30 : 0) : 0;
      if (P === 'N' || P === 'C') v += (4 - Math.abs(c - 4)) * 6 + adv * 3;
      if (P === 'R') v += adv * 4;
      s += red ? v : -v;
    }
    return s;
  }
  function search(b, s, depth, alpha, beta) {
    const moves = X.legalMoves(b, s);
    if (!moves.length) return -100000 + (10 - depth);
    if (depth === 0) return (s === 'r' ? 1 : -1) * evalBoard(b);
    moves.sort((m1, m2) => (m2.cap ? VAL[m2.cap.toUpperCase()] : 0) - (m1.cap ? VAL[m1.cap.toUpperCase()] : 0));
    for (const m of moves) {
      b[m.tr][m.tc] = b[m.fr][m.fc]; b[m.fr][m.fc] = '';
      const v = -search(b, s === 'r' ? 'b' : 'r', depth - 1, -beta, -alpha);
      b[m.fr][m.fc] = b[m.tr][m.tc]; b[m.tr][m.tc] = m.cap;
      if (v > alpha) alpha = v; if (alpha >= beta) break;
    }
    return alpha;
  }
  X.bestMove = function (b, s, depth) {
    const moves = X.legalMoves(b, s); let best = null, bestV = -Infinity;
    moves.sort(() => Math.random() - .5);
    moves.sort((m1, m2) => (m2.cap ? VAL[m2.cap.toUpperCase()] : 0) - (m1.cap ? VAL[m1.cap.toUpperCase()] : 0));
    for (const m of moves) {
      b[m.tr][m.tc] = b[m.fr][m.fc]; b[m.fr][m.fc] = '';
      const v = -search(b, s === 'r' ? 'b' : 'r', depth - 1, -Infinity, -bestV);
      b[m.fr][m.fc] = b[m.tr][m.tc]; b[m.tr][m.tc] = m.cap;
      if (v > bestV) { bestV = v; best = m; }
    }
    return best;
  };

  X.mount = function (root, api) {
    let mode = api.load('xq.mode', 'ai'), level = api.load('xq.level', 'mid'), st, aiTimer;
    const DEPTH = { easy: 1, mid: 2, hard: 3 };
    root.innerHTML = `
      <div class="game-head">
        <div class="seg" id="xq-mode"><button data-m="ai">對電腦</button><button data-m="pvp">雙人</button></div>
        <div class="seg" id="xq-level"><button data-l="easy">入門</button><button data-l="mid">普通</button><button data-l="hard">強</button></div>
        <div class="stat" id="xq-turn"></div>
      </div>
      <div class="xq-board" id="xq-board" aria-label="象棋棋盤"></div>
      <div class="tools center"><button id="xq-undo">悔棋</button><button id="xq-new" class="primary">新局</button></div>
      <p class="msg" id="xq-msg"></p>`;
    const $ = s => root.querySelector(s), board = $('#xq-board');
    // 棋盤底圖
    const lines = [];
    for (let r = 0; r < 10; r++) lines.push(`<line x1="0" y1="${r}" x2="8" y2="${r}"/>`);
    for (let c = 0; c < 9; c++) { if (c === 0 || c === 8) lines.push(`<line x1="${c}" y1="0" x2="${c}" y2="9"/>`); else lines.push(`<line x1="${c}" y1="0" x2="${c}" y2="4"/><line x1="${c}" y1="5" x2="${c}" y2="9"/>`); }
    lines.push('<line x1="3" y1="0" x2="5" y2="2"/><line x1="5" y1="0" x2="3" y2="2"/><line x1="3" y1="7" x2="5" y2="9"/><line x1="5" y1="7" x2="3" y2="9"/>');
    board.innerHTML = `<svg class="xq-lines" viewBox="-.6 -.6 9.2 10.2" aria-hidden="true"><g stroke="#5a3d18" stroke-width=".035" fill="none">${lines.join('')}<rect x="-.12" y="-.12" width="8.24" height="9.24" stroke-width=".07"/></g>
      <text x="2" y="4.66" font-size=".5" text-anchor="middle" fill="#5a3d18" font-family="LXGW WenKai TC, serif">楚 河</text><text x="6" y="4.66" font-size=".5" text-anchor="middle" fill="#5a3d18" font-family="LXGW WenKai TC, serif">漢 界</text></svg><div class="xq-pieces" id="xq-pieces"></div>`;
    const layer = $('#xq-pieces');

    function newGame() { clearTimeout(aiTimer); st = { b: X.init(), turn: 'r', hist: [], sel: null, last: null, over: false }; $('#xq-msg').textContent = ''; render(); }
    function render() {
      root.querySelectorAll('#xq-mode button').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
      root.querySelectorAll('#xq-level button').forEach(b => b.classList.toggle('on', b.dataset.l === level));
      $('#xq-level').hidden = mode !== 'ai';
      const chk = !st.over && inCheck(st.b, st.turn);
      $('#xq-turn').innerHTML = st.over ? '' : `輪到 <b>${st.turn === 'r' ? '紅方' : '黑方'}</b>${chk ? '・將軍！' : ''}${mode === 'ai' && st.turn === 'b' ? '（思考中）' : ''}`;
      const targets = st.sel ? X.legalMoves(st.b, st.turn).filter(m => m.fr === st.sel[0] && m.fc === st.sel[1]) : [];
      let html = '';
      for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
        const p = st.b[r][c], pos = `style="--r:${r};--c:${c}"`;
        const isLast = st.last && ((st.last.fr === r && st.last.fc === c) || (st.last.tr === r && st.last.tc === c));
        if (p) html += `<button class="xq-p ${isRed(p) ? 'red' : 'blk'} ${st.sel && st.sel[0] === r && st.sel[1] === c ? 'sel' : ''} ${isLast ? 'last' : ''}" data-r="${r}" data-c="${c}" ${pos} aria-label="${NAMES[p]}">${NAMES[p]}</button>`;
        else if (isLast) html += `<span class="xq-from" ${pos}></span>`;
      }
      for (const m of targets) html += `<button class="xq-dot ${m.cap ? 'cap' : ''}" data-r="${m.tr}" data-c="${m.tc}" style="--r:${m.tr};--c:${m.tc}" aria-label="走到這裡"></button>`;
      layer.innerHTML = html;
    }
    function doMove(m) {
      st.hist.push({ b: st.b.map(r => r.slice()), turn: st.turn, last: st.last });
      st.b[m.tr][m.tc] = st.b[m.fr][m.fc]; st.b[m.fr][m.fc] = ''; st.last = m; st.sel = null;
      st.turn = st.turn === 'r' ? 'b' : 'r';
      if (!X.legalMoves(st.b, st.turn).length) {
        st.over = true; const winner = st.turn === 'r' ? '黑方' : '紅方';
        $('#xq-msg').textContent = mode === 'ai' ? (winner === '紅方' ? '你贏了！' : '電腦贏了，再來一局？') : `${winner}獲勝！`;
        if (mode !== 'ai' || winner === '紅方') api.confetti();
      }
      render();
      if (!st.over && mode === 'ai' && st.turn === 'b') aiTimer = setTimeout(() => { const mv = X.bestMove(st.b, 'b', DEPTH[level]); if (mv) doMove(mv); }, 60);
    }
    layer.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t || st.over) return;
      if (mode === 'ai' && st.turn === 'b') return;
      const r = +t.dataset.r, c = +t.dataset.c;
      if (t.classList.contains('xq-dot')) { const m = X.legalMoves(st.b, st.turn).find(m => m.fr === st.sel[0] && m.fc === st.sel[1] && m.tr === r && m.tc === c); if (m) doMove(m); return; }
      if (side(st.b[r][c]) === st.turn) { st.sel = st.sel && st.sel[0] === r && st.sel[1] === c ? null : [r, c]; render(); }
      else if (st.sel) { const m = X.legalMoves(st.b, st.turn).find(m => m.fr === st.sel[0] && m.fc === st.sel[1] && m.tr === r && m.tc === c); if (m) doMove(m); }
    });
    $('#xq-undo').onclick = () => {
      clearTimeout(aiTimer);
      const k = mode === 'ai' ? (st.turn === 'r' ? 2 : 1) : 1;
      for (let i = 0; i < k && st.hist.length; i++) { const h = st.hist.pop(); st.b = h.b; st.turn = h.turn; st.last = h.last; }
      st.over = false; st.sel = null; $('#xq-msg').textContent = ''; render();
    };
    $('#xq-new').onclick = newGame;
    $('#xq-mode').onclick = e => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.m; api.save('xq.mode', mode); newGame(); };
    $('#xq-level').onclick = e => { const b = e.target.closest('button'); if (!b) return; level = b.dataset.l; api.save('xq.level', level); render(); };
    newGame();
    return () => clearTimeout(aiTimer);
  };

  if (typeof module !== 'undefined') module.exports = X; else window.GameRoom.register('xiangqi', X);
})();
