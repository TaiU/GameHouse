// 旋轉拼板：點一下把板子轉 90 度，讓所有線條首尾相接、不留斷頭
(function () {
  const S = {};
  // 方向位元：上 1、右 2、下 4、左 8
  const rot = m => ((m << 1) | (m >> 3)) & 15;
  S.generate = function (W, H) {
    for (let t = 0; t < 50; t++) {
      const mask = new Array(W * H).fill(0);
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const i = r * W + c;
        if (c < W - 1 && Math.random() < .55) { mask[i] |= 2; mask[i + 1] |= 8; }
        if (r < H - 1 && Math.random() < .55) { mask[i] |= 4; mask[i + W] |= 1; }
      }
      // 不要太多空格與孤立端點
      const empty = mask.filter(m => !m).length, ends = mask.filter(m => [1, 2, 4, 8].includes(m)).length;
      if (empty > W * H * .08 || ends > W * H * .2) continue;
      const turns = mask.map(() => Math.floor(Math.random() * 4));
      const cur = mask.map((m, i) => { let x = m; for (let k = 0; k < turns[i]; k++) x = rot(x); return x; });
      if (S.solved(W, H, cur)) continue;
      return { W, H, cur, deg: turns.map(k => k * 90) };
    }
  };
  S.solved = function (W, H, m) {
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const x = m[r * W + c];
      if ((x & 1) !== ((r > 0 ? m[(r - 1) * W + c] : 0) & 4 ? 1 : 0)) return false;
      if ((x & 2 ? 1 : 0) !== ((c < W - 1 ? m[r * W + c + 1] : 0) & 8 ? 1 : 0)) return false;
      if ((x & 4 ? 1 : 0) !== ((r < H - 1 ? m[(r + 1) * W + c] : 0) & 1 ? 1 : 0)) return false;
      if ((x & 8 ? 1 : 0) !== ((c > 0 ? m[r * W + c - 1] : 0) & 2 ? 1 : 0)) return false;
    }
    return true;
  };
  // 以「原始方向」畫圖，旋轉交給 CSS
  function tileSVG(m0) {
    const P = { 1: [50, 0], 2: [100, 50], 4: [50, 100], 8: [0, 50] };
    const sides = [1, 2, 4, 8].filter(b => m0 & b);
    let d = '';
    if (sides.length === 2 && !((m0 === 5) || (m0 === 10))) {
      const [a, b] = sides.map(s => P[s]); d = `M${a[0]} ${a[1]} Q50 50 ${b[0]} ${b[1]}`;
    } else sides.forEach(s => { d += `M50 50 L${P[s][0]} ${P[s][1]} `; });
    const dot = sides.length === 1 ? '<circle cx="50" cy="50" r="13" />' : sides.length >= 3 ? '<circle cx="50" cy="50" r="10" />' : '';
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${d}" /><g class="dot">${dot}</g></svg>`;
  }
  const SIZES = [{ n: 5, name: '5×5' }, { n: 7, name: '7×7' }, { n: 9, name: '9×9' }];

  S.mount = function (root, api) {
    let N = +api.load('spin.n', 5), st;
    root.innerHTML = `
      <div class="game-head">
        <div class="seg" id="sp-sizes">${SIZES.map(s => `<button data-n="${s.n}">${s.name}</button>`).join('')}</div>
        <div class="stat">轉了 <b id="sp-moves">0</b> 次</div>
      </div>
      <p class="rule">點一下板子就順時針轉 90 度。把每一條線都接起來，不能有線頭伸向空格或盤面外。</p>
      <div class="sp-grid" id="sp-grid"></div>
      <div class="tools center"><button id="sp-new" class="primary">新局</button></div>
      <p class="msg" id="sp-msg"></p>`;
    const $ = s => root.querySelector(s), grid = $('#sp-grid');
    function newGame() {
      const g = S.generate(N, N);
      st = { ...g, orig: g.cur.slice(), base: g.cur.slice(), moves: 0, done: false };
      // base 是畫圖用的方向，deg 從 0 開始累計
      st.deg = st.cur.map(() => 0);
      grid.style.setProperty('--n', N);
      grid.innerHTML = st.base.map((m, i) => `<button class="sp-tile" data-i="${i}" aria-label="板子 ${Math.floor(i / N) + 1}-${i % N + 1}"><span style="transform:rotate(0deg)">${tileSVG(m)}</span></button>`).join('');
      $('#sp-msg').textContent = ''; $('#sp-moves').textContent = 0;
      root.querySelectorAll('#sp-sizes button').forEach(b => b.classList.toggle('on', +b.dataset.n === N));
      grid.classList.remove('won');
      mark();
    }
    function mark() {
      // 標出與鄰居接好的板子
      const m = st.cur, W = N;
      [...grid.children].forEach((el, i) => {
        const r = Math.floor(i / W), c = i % W, x = m[i]; let ok = x !== 0;
        if (x & 1) ok = ok && r > 0 && (m[i - W] & 4); if (x & 2) ok = ok && c < W - 1 && (m[i + 1] & 8);
        if (x & 4) ok = ok && r < W - 1 && (m[i + W] & 1); if (x & 8) ok = ok && c > 0 && (m[i - 1] & 2);
        el.classList.toggle('ok', !!ok);
      });
    }
    grid.addEventListener('click', e => {
      const b = e.target.closest('.sp-tile'); if (!b || st.done) return;
      const i = +b.dataset.i;
      st.cur[i] = rot(st.cur[i]); st.deg[i] += 90; st.moves++;
      b.firstElementChild.style.transform = `rotate(${st.deg[i]}deg)`;
      $('#sp-moves').textContent = st.moves;
      mark();
      if (S.solved(N, N, st.cur)) { st.done = true; grid.classList.add('won'); $('#sp-msg').textContent = `全部接上了！轉了 ${st.moves} 次。`; api.confetti(); }
    });
    $('#sp-new').onclick = newGame;
    $('#sp-sizes').onclick = e => { const b = e.target.closest('button'); if (!b) return; N = +b.dataset.n; api.save('spin.n', N); newGame(); };
    newGame();
  };

  if (typeof module !== 'undefined') module.exports = S; else window.GameRoom.register('spin', S);
})();
