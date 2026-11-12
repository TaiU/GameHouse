// 五子棋：15 路棋盤，可對電腦或雙人對弈
(function () {
  const G = {}, N = 15;
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

  function winLine(b, i) {
    const p = b[i]; if (!p) return null;
    const r = Math.floor(i / N), c = i % N;
    for (const [dr, dc] of DIRS) {
      const line = [i];
      for (const s of [1, -1]) {
        let rr = r + dr * s, cc = c + dc * s;
        while (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr * N + cc] === p) { line.push(rr * N + cc); rr += dr * s; cc += dc * s; }
      }
      if (line.length >= 5) return line;
    }
    return null;
  }
  // 以某點為中心，評估某方在四個方向的棋形分數
  function shapeScore(b, i, p) {
    const r = Math.floor(i / N), c = i % N; let total = 0;
    for (const [dr, dc] of DIRS) {
      let count = 1, open = 0;
      for (const s of [1, -1]) {
        let rr = r + dr * s, cc = c + dc * s, k = 0;
        while (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr * N + cc] === p) { count++; rr += dr * s; cc += dc * s; k++; }
        if (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr * N + cc] === 0) open++;
      }
      if (count >= 5) total += 1e7;
      else if (count === 4) total += open === 2 ? 1e6 : open === 1 ? 1e5 : 0;
      else if (count === 3) total += open === 2 ? 5e4 : open === 1 ? 2e3 : 0;
      else if (count === 2) total += open === 2 ? 1e3 : open === 1 ? 100 : 0;
      else total += open * 10;
    }
    return total;
  }
  G.bestMove = function (b, me, level) {
    const opp = 3 - me; let best = -1, bestS = -Infinity;
    if (b.every(v => !v)) return 7 * N + 7;
    for (let i = 0; i < N * N; i++) {
      if (b[i]) continue;
      const r = Math.floor(i / N), c = i % N; let near = false;
      for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr * N + cc]) { near = true; break; } }
      if (!near) continue;
      b[i] = me; const atk = shapeScore(b, i, me); b[i] = opp; const def = shapeScore(b, i, opp); b[i] = 0;
      let s = atk * 1.1 + def * (level === 'easy' ? 0.5 : 1) + (7 - Math.max(Math.abs(r - 7), Math.abs(c - 7)));
      if (level === 'easy') s *= 0.6 + Math.random() * 0.8;
      if (s > bestS) { bestS = s; best = i; }
    }
    return best;
  };

  G.mount = function (root, api) {
    let mode = api.load('gomoku.mode', 'ai'), level = api.load('gomoku.level', 'hard'), st, aiTimer;
    root.innerHTML = `
      <div class="game-head">
        <div class="seg" id="gm-mode"><button data-m="ai">對電腦</button><button data-m="pvp">雙人</button></div>
        <div class="seg" id="gm-level"><button data-l="easy">輕鬆</button><button data-l="hard">認真</button></div>
        <div class="stat" id="gm-turn"></div>
      </div>
      <canvas id="gm-board" class="gm-board" width="600" height="600" aria-label="五子棋棋盤"></canvas>
      <div class="tools center"><button id="gm-undo">悔棋</button><button id="gm-new" class="primary">新局</button></div>
      <p class="msg" id="gm-msg"></p>`;
    const $ = s => root.querySelector(s), cv = $('#gm-board'), ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = cv.height = 600 * dpr; ctx.scale(dpr, dpr);
    const M = 28, step = (600 - 2 * M) / (N - 1);

    function newGame() { clearTimeout(aiTimer); st = { b: new Array(N * N).fill(0), turn: 1, moves: [], win: null }; $('#gm-msg').textContent = ''; draw(); }
    function css(v) { return getComputedStyle(root).getPropertyValue(v).trim(); }
    function draw() {
      root.querySelectorAll('#gm-mode button').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
      root.querySelectorAll('#gm-level button').forEach(b => b.classList.toggle('on', b.dataset.l === level));
      $('#gm-level').hidden = mode !== 'ai';
      $('#gm-turn').innerHTML = st.win ? '' : `輪到 <b>${st.turn === 1 ? '黑' : '白'}</b>${mode === 'ai' && st.turn === 2 ? '（思考中）' : ''}`;
      ctx.fillStyle = css('--board') || '#d9b77a'; ctx.fillRect(0, 0, 600, 600);
      ctx.strokeStyle = css('--board-line') || 'rgba(60,40,15,.75)'; ctx.lineWidth = 1;
      for (let k = 0; k < N; k++) {
        ctx.beginPath(); ctx.moveTo(M, M + k * step); ctx.lineTo(600 - M, M + k * step); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(M + k * step, M); ctx.lineTo(M + k * step, 600 - M); ctx.stroke();
      }
      ctx.fillStyle = css('--board-line') || 'rgba(60,40,15,.85)';
      for (const [r, c] of [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]]) { ctx.beginPath(); ctx.arc(M + c * step, M + r * step, 4, 0, 7); ctx.fill(); }
      const last = st.moves[st.moves.length - 1];
      st.b.forEach((p, i) => {
        if (!p) return; const x = M + (i % N) * step, y = M + Math.floor(i / N) * step, R = step * 0.44;
        const g = ctx.createRadialGradient(x - R * .35, y - R * .35, R * .1, x, y, R);
        if (p === 1) { g.addColorStop(0, '#6a6a6a'); g.addColorStop(1, '#111'); } else { g.addColorStop(0, '#fff'); g.addColorStop(1, '#cfcac0'); }
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
        if (i === last) { ctx.fillStyle = css('--accent') || '#d0412d'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill(); }
      });
      if (st.win) { ctx.strokeStyle = css('--accent') || '#d0412d'; ctx.lineWidth = 3; const pts = st.win.map(i => [M + (i % N) * step, M + Math.floor(i / N) * step]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.lineTo(...pts[pts.length - 1]); ctx.stroke(); }
    }
    function play(i) {
      if (st.win || st.b[i]) return;
      st.b[i] = st.turn; st.moves.push(i);
      const w = winLine(st.b, i);
      if (w) { st.win = w; const who = st.turn === 1 ? '黑' : '白'; $('#gm-msg').textContent = mode === 'ai' ? (st.turn === 1 ? '你贏了！' : '電腦贏了，再來一局？') : `${who}棋獲勝！`; if (mode !== 'ai' || st.turn === 1) api.confetti(); }
      else if (st.moves.length === N * N) $('#gm-msg').textContent = '和局。';
      st.turn = 3 - st.turn; draw();
      if (!st.win && mode === 'ai' && st.turn === 2) aiTimer = setTimeout(() => play(G.bestMove(st.b, 2, level)), 280);
    }
    cv.addEventListener('click', e => {
      if (mode === 'ai' && st.turn === 2) return;
      const rc = cv.getBoundingClientRect(), sx = 600 / rc.width;
      const c = Math.round(((e.clientX - rc.left) * sx - M) / step), r = Math.round(((e.clientY - rc.top) * sx - M) / step);
      if (r >= 0 && r < N && c >= 0 && c < N) play(r * N + c);
    });
    $('#gm-undo').onclick = () => {
      clearTimeout(aiTimer);
      const k = mode === 'ai' ? (st.turn === 1 ? 2 : 1) : 1;
      for (let t = 0; t < k && st.moves.length; t++) { st.b[st.moves.pop()] = 0; st.turn = 3 - st.turn; }
      if (mode === 'ai') st.turn = 1;
      st.win = null; $('#gm-msg').textContent = ''; draw();
    };
    $('#gm-new').onclick = newGame;
    $('#gm-mode').onclick = e => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.m; api.save('gomoku.mode', mode); newGame(); };
    $('#gm-level').onclick = e => { const b = e.target.closest('button'); if (!b) return; level = b.dataset.l; api.save('gomoku.level', level); draw(); };
    newGame();
    addEventListener('gr-theme', draw);
    return () => { clearTimeout(aiTimer); removeEventListener('gr-theme', draw); };
  };

  if (typeof module !== 'undefined') module.exports = G; else window.GameRoom.register('gomoku', G);
})();
