// 麻將配對：疊層牌陣，找兩張相同且「自由」的牌消除（左右任一側空、上方沒壓牌）
(function () {
  const T = {};
  const NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  // 34 種牌：m 萬、p 筒、s 條、z 字
  T.KINDS = [];
  for (const s of ['m', 'p', 's']) for (let n = 1; n <= 9; n++) T.KINDS.push(s + n);
  for (let n = 1; n <= 7; n++) T.KINDS.push('z' + n);

  const DOTS = {
    1: [[.5, .5]], 2: [[.5, .25], [.5, .75]], 3: [[.25, .2], [.5, .5], [.75, .8]],
    4: [[.28, .27], [.72, .27], [.28, .73], [.72, .73]], 5: [[.28, .25], [.72, .25], [.5, .5], [.28, .75], [.72, .75]],
    6: [[.3, .2], [.7, .2], [.3, .5], [.7, .5], [.3, .8], [.7, .8]],
    7: [[.22, .15], [.5, .24], [.78, .33], [.3, .6], [.7, .6], [.3, .85], [.7, .85]],
    8: [[.3, .14], [.7, .14], [.3, .38], [.7, .38], [.3, .62], [.7, .62], [.3, .86], [.7, .86]],
    9: [[.22, .2], [.5, .2], [.78, .2], [.22, .5], [.5, .5], [.78, .5], [.22, .8], [.5, .8], [.78, .8]],
  };
  const STICKS = {
    1: [[.5, .5]], 2: [[.5, .27], [.5, .73]], 3: [[.5, .27], [.3, .73], [.7, .73]],
    4: [[.3, .27], [.7, .27], [.3, .73], [.7, .73]], 5: [[.25, .27], [.75, .27], [.5, .5], [.25, .73], [.75, .73]],
    6: [[.2, .27], [.5, .27], [.8, .27], [.2, .73], [.5, .73], [.8, .73]],
    7: [[.5, .17], [.2, .5], [.5, .5], [.8, .5], [.2, .83], [.5, .83], [.8, .83]],
    8: [[.2, .27], [.4, .27], [.6, .27], [.8, .27], [.2, .73], [.4, .73], [.6, .73], [.8, .73]],
    9: [[.2, .17], [.5, .17], [.8, .17], [.2, .5], [.5, .5], [.8, .5], [.2, .83], [.5, .83], [.8, .83]],
  };
  const INK = '#1f3a5a', RED = '#b8322a', GRN = '#2f7a4a';
  // 回傳一張牌面的 SVG（viewBox 60×80）
  T.face = function (k) {
    const s = k[0], n = +k.slice(1);
    let body = '';
    if (s === 'm') {
      body = `<text x="30" y="34" font-size="26" text-anchor="middle" fill="${INK}" font-weight="700">${NUM[n - 1]}</text><text x="30" y="68" font-size="28" text-anchor="middle" fill="${RED}" font-weight="700">萬</text>`;
    } else if (s === 'p') {
      const r = n === 1 ? 17 : n <= 4 ? 10 : n <= 6 ? 8.5 : 7.2;
      body = DOTS[n].map(([x, y], i) => {
        const col = n === 1 ? RED : (n === 5 && i === 2) || (n === 7 && i < 3) || (n === 9 && i >= 3 && i < 6) ? RED : (n % 2 ? INK : GRN);
        const cx = 6 + x * 48, cy = 6 + y * 68;
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="2.4"/><circle cx="${cx}" cy="${cy}" r="${r * .45}" fill="${col}"/>`;
      }).join('');
    } else if (s === 's') {
      if (n === 1) body = `<g fill="${GRN}"><ellipse cx="30" cy="42" rx="9" ry="20"/></g><g stroke="#f6efe0" stroke-width="2"><path d="M30 25 V59 M24 34 H36 M24 50 H36"/></g><circle cx="30" cy="17" r="5" fill="${RED}"/>`;
      else body = STICKS[n].map(([x, y], i) => {
        const col = (n === 5 && i === 2) || (n === 7 && i === 0) || (n === 9 && i % 3 === 1) ? RED : GRN;
        const cx = 6 + x * 48, cy = 6 + y * 68, h = n >= 7 ? 18 : 24;
        return `<rect x="${cx - 3.2}" y="${cy - h / 2}" width="6.4" height="${h}" rx="3" fill="${col}"/><rect x="${cx - 4.2}" y="${cy - 1.3}" width="8.4" height="2.6" rx="1.3" fill="${col}"/>`;
      }).join('');
    } else {
      const ch = ['東', '南', '西', '北', '中', '發', ''][n - 1];
      const col = n === 5 ? RED : n === 6 ? GRN : INK;
      body = n === 7 ? `<rect x="12" y="14" width="36" height="52" rx="3" fill="none" stroke="${INK}" stroke-width="3"/><rect x="17" y="19" width="26" height="42" rx="2" fill="none" stroke="${INK}" stroke-width="1.2"/>`
        : `<text x="30" y="55" font-size="36" text-anchor="middle" fill="${col}" font-weight="700">${ch}</text>`;
    }
    return `<svg viewBox="0 0 60 80" aria-hidden="true" style="font-family:'LXGW WenKai TC','Noto Serif TC',serif">${body}</svg>`;
  };
  T.name = k => { const s = k[0], n = +k.slice(1); return s === 'z' ? ['東', '南', '西', '北', '紅中', '青發', '白板'][n - 1] : NUM[n - 1] + { m: '萬', p: '筒', s: '條' }[s]; };

  // 牌陣：以「牌寬」為單位的座標，可有半格
  function layout() {
    const P = [];
    for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) P.push({ x, y, z: 0 });
    for (let y = 1; y < 5; y++) for (let x = 1; x < 7; x++) P.push({ x, y, z: 1 });
    for (let y = 2; y < 4; y++) for (let x = 2; x < 6; x++) P.push({ x, y, z: 2 });
    P.push({ x: 3, y: 2.5, z: 3 }, { x: 4, y: 2.5, z: 3 });
    P.push({ x: -1, y: 2.5, z: 0 }, { x: 8, y: 2.5, z: 0 });
    return P;
  }
  function isFree(P, alive, i) {
    const a = P[i]; let L = false, R = false;
    for (let j = 0; j < P.length; j++) {
      if (j === i || !alive[j]) continue; const b = P[j];
      if (Math.abs(a.y - b.y) >= 1) continue;
      if (b.z === a.z + 1 && Math.abs(a.x - b.x) < 1) return false;
      if (b.z === a.z) { if (b.x - a.x === -1) L = true; if (b.x - a.x === 1) R = true; }
    }
    return !(L && R);
  }
  T.isFree = isFree;
  // 反向拆解產生必有解的牌局
  T.deal = function () {
    const P = layout();
    for (let attempt = 0; attempt < 100; attempt++) {
      const alive = P.map(() => true), faces = new Array(P.length);
      const pool = []; const kinds = T.KINDS.slice().sort(() => Math.random() - .5);
      for (let k = 0; pool.length < P.length / 2; k++) pool.push(kinds[k % kinds.length]);
      pool.sort(() => Math.random() - .5);
      let ok = true;
      for (const f of pool) {
        const free = P.map((_, i) => i).filter(i => alive[i] && isFree(P, alive, i));
        if (free.length < 2) { ok = false; break; }
        const a = free.splice(Math.floor(Math.random() * free.length), 1)[0]; alive[a] = false;
        const free2 = P.map((_, i) => i).filter(i => alive[i] && isFree(P, alive, i));
        const b = free2[Math.floor(Math.random() * free2.length)]; alive[b] = false;
        faces[a] = faces[b] = f;
      }
      if (ok) return { P, faces };
    }
  };

  T.mount = function (root, api) {
    let st;
    root.innerHTML = `
      <div class="game-head">
        <div class="stat">剩 <b id="tm-left">0</b> 張 · 可配 <b id="tm-moves">0</b> 對</div>
        <div class="stat"><span id="tm-time">00:00</span></div>
      </div>
      <div class="tm-board" id="tm-board"></div>
      <div class="tools center"><button id="tm-undo">復原</button><button id="tm-hint">提示</button><button id="tm-shuffle">洗牌</button><button id="tm-new" class="primary">新局</button></div>
      <p class="msg" id="tm-msg"></p>`;
    const $ = s => root.querySelector(s), board = $('#tm-board');
    let timer;
    function newGame() {
      const d = T.deal(); st = { ...d, alive: d.P.map(() => true), sel: -1, hist: [], t0: Date.now(), done: false, hint: [] };
      board.innerHTML = '';
      const order = d.P.map((p, i) => i).sort((a, b) => d.P[a].z - d.P[b].z || d.P[a].y - d.P[b].y || d.P[b].x - d.P[a].x);
      for (const i of order) {
        const p = d.P[i], el = document.createElement('button');
        el.className = 'tm-tile'; el.dataset.i = i;
        el.style.setProperty('--x', p.x + 1); el.style.setProperty('--y', p.y); el.style.setProperty('--z', p.z);
        el.innerHTML = T.face(d.faces[i]); el.setAttribute('aria-label', T.name(d.faces[i]));
        board.appendChild(el);
      }
      $('#tm-msg').textContent = '';
      clearInterval(timer);
      timer = setInterval(() => { if (st.done) return; const s = Math.floor((Date.now() - st.t0) / 1000); $('#tm-time').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, 500);
      render();
    }
    function pairs() {
      const free = st.P.map((_, i) => i).filter(i => st.alive[i] && isFree(st.P, st.alive, i)), out = [];
      for (let a = 0; a < free.length; a++) for (let b = a + 1; b < free.length; b++) if (st.faces[free[a]] === st.faces[free[b]]) out.push([free[a], free[b]]);
      return { free: new Set(free), out };
    }
    function render() {
      const { free, out } = pairs();
      board.querySelectorAll('.tm-tile').forEach(el => {
        const i = +el.dataset.i;
        el.hidden = !st.alive[i];
        el.classList.toggle('free', free.has(i)); el.classList.toggle('sel', st.sel === i); el.classList.toggle('hint', st.hint.includes(i));
      });
      const left = st.alive.filter(Boolean).length;
      $('#tm-left').textContent = left; $('#tm-moves').textContent = out.length;
      if (!left) { st.done = true; $('#tm-msg').textContent = `清空了！用時 ${$('#tm-time').textContent}。`; api.confetti(); }
      else if (!out.length) $('#tm-msg').textContent = '沒有可以配的牌了。按「洗牌」重排剩下的牌，或「復原」退回去。';
    }
    board.addEventListener('click', e => {
      const el = e.target.closest('.tm-tile'); if (!el || st.done) return; const i = +el.dataset.i;
      if (!isFree(st.P, st.alive, i)) { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); return; }
      st.hint = []; $('#tm-msg').textContent = '';
      if (st.sel === i) st.sel = -1;
      else if (st.sel >= 0 && st.faces[st.sel] === st.faces[i]) { st.hist.push([st.sel, i]); st.alive[st.sel] = st.alive[i] = false; st.sel = -1; }
      else st.sel = i;
      render();
    });
    $('#tm-undo').onclick = () => { const h = st.hist.pop(); if (!h || st.done) return; h.forEach(i => st.alive[i] = true); st.sel = -1; $('#tm-msg').textContent = ''; render(); };
    $('#tm-hint').onclick = () => { const { out } = pairs(); st.hint = out[0] || []; render(); };
    $('#tm-shuffle').onclick = () => {
      if (st.done) return;
      const idx = st.P.map((_, i) => i).filter(i => st.alive[i]), f = idx.map(i => st.faces[i]);
      for (let t = 0; t < 50; t++) { f.sort(() => Math.random() - .5); idx.forEach((i, k) => st.faces[i] = f[k]); if (pairs().out.length) break; }
      board.querySelectorAll('.tm-tile').forEach(el => { const i = +el.dataset.i; el.innerHTML = T.face(st.faces[i]); el.setAttribute('aria-label', T.name(st.faces[i])); });
      st.hist = []; st.sel = -1; $('#tm-msg').textContent = ''; render();
    };
    $('#tm-new').onclick = newGame;
    newGame();
    return () => clearInterval(timer);
  };

  if (typeof module !== 'undefined') module.exports = T; else { window.MJTiles = T; window.GameRoom.register('tilematch', T); }
})();
