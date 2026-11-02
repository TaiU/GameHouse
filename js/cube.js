// 轉角方塊：三階魔術方塊，用 three.js 繪製。可轉面、打亂、倒帶還原
(function () {
  const C = {};
  const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  // 面：軸、層、正向旋轉方向（順時針，從該面看過去）
  const MOVES = {
    U: { axis: 'y', layer: 1, dir: -1 }, D: { axis: 'y', layer: -1, dir: 1 },
    R: { axis: 'x', layer: 1, dir: -1 }, L: { axis: 'x', layer: -1, dir: 1 },
    F: { axis: 'z', layer: 1, dir: -1 }, B: { axis: 'z', layer: -1, dir: 1 },
  };
  const FACE_NAME = { U: '上', D: '下', R: '右', L: '左', F: '前', B: '後' };
  const COLORS = { px: 0xd8432f, nx: 0xf08a24, py: 0xf6f1e4, ny: 0xf2cc2b, pz: 0x2f8f5b, nz: 0x2f63b6 };

  function loadThree() {
    if (window.THREE) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = THREE_URL; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  const inv = m => (m.endsWith("'") ? m[0] : m + "'");

  C.mount = function (root, api) {
    root.innerHTML = `
      <div class="game-head">
        <div class="stat">步數 <b id="cb-steps">0</b> · <span id="cb-time">00:00</span></div>
        <div class="stat" id="cb-state">載入中…</div>
      </div>
      <div class="cb-stage" id="cb-stage" aria-label="魔術方塊，拖曳可轉動視角"></div>
      <p class="rule center">拖曳空白處轉視角。按面名順時針轉，按「′」那排逆時針轉。鍵盤 U D L R F B 也能轉，加 Shift 為逆時針。</p>
      <div class="cb-pad" id="cb-pad">
        ${Object.keys(MOVES).map(m => `<button data-m="${m}">${FACE_NAME[m]}<small>${m}</small></button>`).join('')}
        ${Object.keys(MOVES).map(m => `<button data-m="${m}'">${FACE_NAME[m]}′<small>${m}′</small></button>`).join('')}
      </div>
      <div class="tools center"><button id="cb-scramble" class="primary">打亂</button><button id="cb-undo">退一步</button><button id="cb-solve">倒帶還原</button><button id="cb-reset">直接復原</button></div>
      <p class="msg" id="cb-msg"></p>`;
    const $ = s => root.querySelector(s), stage = $('#cb-stage');
    let alive = true, cleanupFns = [];
    let renderer, scene, camera, cubeGroup, cubies = [], queue = [], busy = false, history = [], scrambled = false, t0 = 0, timer, steps = 0;
    let viewX = -0.5, viewY = 0.65;

    function build() {
      const T = window.THREE;
      scene = new T.Scene();
      camera = new T.PerspectiveCamera(35, 1, 0.1, 100); camera.position.set(0, 0, 11);
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      stage.appendChild(renderer.domElement);
      scene.add(new T.AmbientLight(0xffffff, 0.75));
      const dl = new T.DirectionalLight(0xffffff, 0.45); dl.position.set(4, 6, 8); scene.add(dl);
      cubeGroup = new T.Group(); scene.add(cubeGroup);
      const body = new T.BoxGeometry(0.96, 0.96, 0.96), bodyMat = new T.MeshLambertMaterial({ color: 0x14231e });
      const sticker = new T.PlaneGeometry(0.8, 0.8);
      for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
        const g = new T.Group(); g.position.set(x, y, z);
        g.add(new T.Mesh(body, bodyMat));
        const faces = [['px', x === 1, [0.49, 0, 0], [0, Math.PI / 2, 0]], ['nx', x === -1, [-0.49, 0, 0], [0, -Math.PI / 2, 0]],
          ['py', y === 1, [0, 0.49, 0], [-Math.PI / 2, 0, 0]], ['ny', y === -1, [0, -0.49, 0], [Math.PI / 2, 0, 0]],
          ['pz', z === 1, [0, 0, 0.49], [0, 0, 0]], ['nz', z === -1, [0, 0, -0.49], [0, Math.PI, 0]]];
        for (const [k, on, p, r] of faces) if (on) {
          const m = new T.Mesh(sticker, new T.MeshLambertMaterial({ color: COLORS[k], side: T.DoubleSide }));
          m.position.set(...p); m.rotation.set(...r); m.userData.color = k; g.add(m);
        }
        cubeGroup.add(g); cubies.push(g);
      }
      resize(); applyView();
      const ro = new ResizeObserver(resize); ro.observe(stage); cleanupFns.push(() => ro.disconnect());
      $('#cb-state').textContent = '已還原';
      loop();
    }
    function resize() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    function applyView() { cubeGroup.rotation.set(viewY, viewX, 0, 'XYZ'); }
    function loop() { if (!alive) return; renderer.render(scene, camera); requestAnimationFrame(loop); }

    function turn(move, record, ms) {
      queue.push({ move, record, ms }); if (!busy) runQueue();
    }
    function runQueue() {
      const job = queue.shift(); if (!job) { busy = false; afterTurns(); return; }
      busy = true;
      const T = window.THREE, spec = MOVES[job.move[0]], prime = job.move.endsWith("'");
      const angle = spec.dir * (prime ? -1 : 1) * Math.PI / 2;
      const pivot = new T.Group(); cubeGroup.add(pivot);
      const layer = cubies.filter(c => Math.round(c.position[spec.axis]) === spec.layer);
      layer.forEach(c => pivot.attach(c));
      const start = performance.now(), dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : job.ms;
      (function anim(now) {
        const t = dur ? Math.min(1, (now - start) / dur) : 1, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        pivot.rotation[spec.axis] = angle * e;
        if (t < 1) return requestAnimationFrame(anim);
        pivot.updateMatrixWorld();
        layer.forEach(c => { cubeGroup.attach(c); c.position.set(Math.round(c.position.x), Math.round(c.position.y), Math.round(c.position.z)); const q = c.quaternion; c.rotation.setFromQuaternion(q); ['x', 'y', 'z'].forEach(a => c.rotation[a] = Math.round(c.rotation[a] / (Math.PI / 2)) * (Math.PI / 2)); });
        cubeGroup.remove(pivot);
        if (job.record === 'user') { history.push(job.move); steps++; }
        else if (job.record === 'scramble') history.push(job.move);
        else if (job.record === 'undo') { /* 已從 history 移除 */ }
        $('#cb-steps').textContent = steps;
        runQueue();
      })(start);
    }
    function isSolved() {
      const T = window.THREE, seen = {};
      const n = new T.Vector3(), q = new T.Quaternion(), inverseGroup = cubeGroup.quaternion.clone().invert();
      for (const c of cubies) for (const s of c.children) {
        if (!s.userData.color) continue;
        s.getWorldQuaternion(q); q.premultiply(inverseGroup);
        n.set(0, 0, 1).applyQuaternion(q);
        const key = [Math.round(n.x), Math.round(n.y), Math.round(n.z)].join();
        if (seen[key] && seen[key] !== s.userData.color) return false; seen[key] = s.userData.color;
      }
      return true;
    }
    function afterTurns() {
      const solved = isSolved();
      $('#cb-state').textContent = solved ? '已還原' : '未還原';
      if (solved && scrambled) {
        scrambled = false; clearInterval(timer);
        const s = Math.floor((Date.now() - t0) / 1000);
        if (steps > 0 && !$('#cb-msg').dataset.auto) { $('#cb-msg').textContent = `轉回來了！共 ${steps} 步，用時 ${Math.floor(s / 60)} 分 ${s % 60} 秒。`; api.confetti(); }
        else $('#cb-msg').textContent = '已倒帶回原狀。';
        delete $('#cb-msg').dataset.auto;
        history = [];
      }
    }
    function scramble() {
      if (busy || !cubies.length) return;
      const faces = Object.keys(MOVES), seq = []; let prev = '';
      for (let i = 0; i < 22; i++) { let f; do f = faces[Math.floor(Math.random() * 6)]; while (f === prev); prev = f; seq.push(Math.random() < .5 ? f : f + "'"); }
      seq.forEach(m => turn(m, 'scramble', 90));
      scrambled = true; steps = 0; $('#cb-steps').textContent = 0; $('#cb-msg').textContent = '';
      t0 = Date.now(); clearInterval(timer);
      timer = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); $('#cb-time').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, 500);
    }
    function userTurn(m) { if (!cubies.length) return; turn(m, 'user', 200); }

    loadThree().then(() => { if (alive) build(); }).catch(() => { $('#cb-state').textContent = '3D 元件載入失敗，請檢查網路後重新整理。'; });

    $('#cb-pad').addEventListener('click', e => { const b = e.target.closest('button'); if (b) userTurn(b.dataset.m); });
    $('#cb-scramble').onclick = scramble;
    $('#cb-undo').onclick = () => { if (busy || !history.length) return; const m = history.pop(); steps = Math.max(0, steps - 1); turn(inv(m), 'undo', 200); };
    $('#cb-solve').onclick = () => {
      if (busy || !history.length) return;
      $('#cb-msg').dataset.auto = '1'; $('#cb-msg').textContent = `倒帶 ${history.length} 步中…`;
      const seq = history.slice().reverse().map(inv); history = [];
      seq.forEach(m => turn(m, 'undo', 140));
    };
    $('#cb-reset').onclick = () => {
      if (busy || !cubies.length) return;
      cubies.forEach(c => { cubeGroup.remove(c); }); cubies = [];
      stage.innerHTML = ''; renderer.dispose(); history = []; scrambled = false; steps = 0; clearInterval(timer);
      $('#cb-steps').textContent = 0; $('#cb-time').textContent = '00:00'; $('#cb-msg').textContent = '';
      build();
    };
    // 拖曳轉視角
    let drag = null;
    stage.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, vx: viewX, vy: viewY }; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', e => { if (!drag || !cubeGroup) return; viewX = drag.vx + (e.clientX - drag.x) * 0.01; viewY = Math.max(-1.4, Math.min(1.4, drag.vy + (e.clientY - drag.y) * 0.01)); applyView(); });
    stage.addEventListener('pointerup', () => { drag = null; });
    const onKey = e => { const k = e.key.toUpperCase(); if (MOVES[k] && !e.metaKey && !e.ctrlKey) userTurn(e.shiftKey ? k + "'" : k); };
    document.addEventListener('keydown', onKey);
    return () => { alive = false; clearInterval(timer); document.removeEventListener('keydown', onKey); cleanupFns.forEach(f => f()); if (renderer) renderer.dispose(); };
  };

  if (typeof module !== 'undefined') module.exports = C; else window.GameRoom.register('cube', C);
})();
