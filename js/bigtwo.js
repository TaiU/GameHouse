// 大老二：一人對三家電腦。點數 3 最小、2 最大；花色 梅花 < 方塊 < 紅心 < 黑桃
(function () {
  const B = {};
  const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  const SUITS = ['♣', '♦', '♥', '♠'];
  const SUIT_NAME = ['梅花', '方塊', '紅心', '黑桃'];
  // 牌以 0..51 表示：rank*4 + suit，數字越大越大
  const rk = c => Math.floor(c / 4), su = c => c % 4;
  B.label = c => RANKS[rk(c)] + SUITS[su(c)];
  const TYPE_NAME = { single: '單張', pair: '對子', triple: '三條', straight: '順子', full: '葫蘆', four: '鐵支', sflush: '同花順' };
  const FIVE_ORDER = ['straight', 'full', 'four', 'sflush'];

  // 順子用一般點數（A=1 或 14），允許 A2345 與 23456，不可繞過 K-A-2
  function straightKey(cards) {
    // 自然點數：A=1, 2=2, 3=3 ... K=13
    const n = cards.map(c => { const r = rk(c); return r === 11 ? 1 : r === 12 ? 2 : r + 3; }).sort((a, b) => a - b);
    const consec = a => a.every((v, i) => i === 0 || v === a[i - 1] + 1);
    if (new Set(n).size !== 5) return null;
    if (consec(n)) return true; // A2345、23456、3..7 … 9..K
    const hi = n.map(v => (v === 1 ? 14 : v)).sort((a, b) => a - b); // 10JQKA
    if (consec(hi) && !hi.includes(2)) return true;
    return null;
  }
  B.classify = function (cards) {
    const cs = cards.slice().sort((a, b) => a - b), n = cs.length;
    const max = cs[n - 1];
    if (n === 1) return { type: 'single', key: max, n };
    const ranks = cs.map(rk), same = ranks.every(r => r === ranks[0]);
    if (n === 2) return same ? { type: 'pair', key: max, n } : null;
    if (n === 3) return same ? { type: 'triple', key: max, n } : null;
    if (n !== 5) return null;
    const cnt = {}; ranks.forEach(r => cnt[r] = (cnt[r] || 0) + 1);
    const groups = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
    if (groups[0][1] === 4) return { type: 'four', key: +groups[0][0], n };
    if (groups[0][1] === 3 && groups[1][1] === 2) return { type: 'full', key: +groups[0][0], n };
    if (straightKey(cs)) {
      const flush = cs.every(c => su(c) === su(cs[0]));
      return { type: flush ? 'sflush' : 'straight', key: max, n };
    }
    return null;
  };
  B.beats = function (a, b) { // a 能否壓過 b
    if (!b) return true;
    if (a.n !== b.n) return false;
    if (a.n === 5 && a.type !== b.type) return FIVE_ORDER.indexOf(a.type) > FIVE_ORDER.indexOf(b.type);
    return a.key > b.key;
  };
  B.describe = (cards, combo) => `${TYPE_NAME[combo.type]} ${cards.slice().sort((a, b) => a - b).map(B.label).join(' ')}`;

  function combos(arr, k) { const out = []; (function go(s, cur) { if (cur.length === k) { out.push(cur.slice()); return; } for (let i = s; i < arr.length; i++) { cur.push(arr[i]); go(i + 1, cur); cur.pop(); } })(0, []); return out; }
  // 列出手上所有合法牌組
  B.allPlays = function (hand) {
    const plays = [], byRank = {};
    hand.forEach(c => (byRank[rk(c)] = byRank[rk(c)] || []).push(c));
    hand.forEach(c => plays.push([c]));
    for (const g of Object.values(byRank)) { if (g.length >= 2) combos(g, 2).forEach(p => plays.push(p)); if (g.length >= 3) combos(g, 3).forEach(p => plays.push(p)); }
    if (hand.length >= 5) {
      // 五張：只從有希望的組合中挑，避免 C(13,5) 全列舉太慢也還好（1287），直接列
      combos(hand, 5).forEach(p => { if (B.classify(p)) plays.push(p); });
    }
    return plays.map(p => ({ cards: p, combo: B.classify(p) })).filter(p => p.combo);
  };
  // 電腦策略：盡量用最小的牌壓；手牌多時保留 2 與炸彈
  B.aiChoose = function (hand, last, mustInclude, othersMin) {
    let plays = B.allPlays(hand).filter(p => B.beats(p.combo, last && last.combo));
    if (mustInclude != null) plays = plays.filter(p => p.cards.includes(mustInclude));
    if (!plays.length) return null;
    const cost = p => {
      let s = p.combo.key + (p.combo.n === 5 ? FIVE_ORDER.indexOf(p.combo.type) * 60 : 0);
      if (!last) s -= p.cards.length * 14; // 領出時偏好一次丟多張
      if (p.cards.some(c => rk(c) === 12) && hand.length > 5 && othersMin > 3) s += 80;
      if ((p.combo.type === 'four' || p.combo.type === 'sflush') && hand.length > 6) s += 120;
      return s;
    };
    plays.sort((a, b) => cost(a) - cost(b));
    const best = plays[0];
    // 跟牌時若只剩很貴的牌可壓，而對手手牌還多，就先過
    if (last && cost(best) > 60 && othersMin > 4 && hand.length > 4) return null;
    return best;
  };

  B.mount = function (root, api) {
    const NAMES = ['你', '右家', '對家', '左家'];
    let st, aiTimer;
    let score = [0, 0, 0, 0];
    try { score = JSON.parse(api.load('bigtwo.score', '[0,0,0,0]')); } catch (e) {}
    root.innerHTML = `
      <p class="rule">梅花 3 先出，而且第一手要包含它。可出單張、對子、三條，或五張牌組（順子 &lt; 葫蘆 &lt; 鐵支 &lt; 同花順）。只能用同樣張數去壓。三家都過，最後出牌的人重新領出。先出完的人贏，其他人按剩下的張數扣分，剩 10 張以上加倍。</p>
      <div class="b2-table">
        <div class="b2-seat b2-n" id="b2-s2"></div>
        <div class="b2-seat b2-w" id="b2-s3"></div>
        <div class="b2-center" id="b2-center"></div>
        <div class="b2-seat b2-e" id="b2-s1"></div>
      </div>
      <div class="b2-status" id="b2-status"></div>
      <div class="b2-hand" id="b2-hand" role="group" aria-label="你的手牌"></div>
      <div class="tools center">
        <button id="b2-sort">依花色排</button><button id="b2-hint">提示</button><button id="b2-pass">過</button><button id="b2-play" class="primary">出牌</button>
      </div>
      <p class="msg" id="b2-msg"></p>
      <div class="b2-score" id="b2-score"></div>`;
    const $ = s => root.querySelector(s);
    let sortBySuit = false;

    function deal() {
      clearTimeout(aiTimer);
      const deck = [...Array(52).keys()].sort(() => Math.random() - .5);
      const hands = [0, 1, 2, 3].map(i => deck.slice(i * 13, i * 13 + 13).sort((a, b) => a - b));
      const first = hands.findIndex(h => h.includes(0));
      st = { hands, turn: first, last: null, lastBy: -1, passes: 0, sel: new Set(), firstPlay: true, over: false, log: {} };
      $('#b2-msg').textContent = '';
      render(); next();
    }
    function sortedHand() {
      const h = st.hands[0].slice();
      return sortBySuit ? h.sort((a, b) => su(a) - su(b) || a - b) : h.sort((a, b) => a - b);
    }
    function cardHTML(c, extra = '') {
      const red = su(c) === 1 || su(c) === 2;
      return `<span class="b2-card ${red ? 'red' : ''} ${extra}"><b>${RANKS[rk(c)]}</b><i>${SUITS[su(c)]}</i></span>`;
    }
    function render() {
      for (const p of [1, 2, 3]) {
        const el = $('#b2-s' + p), said = st.log[p];
        el.innerHTML = `<div class="b2-name ${st.turn === p && !st.over ? 'on' : ''}">${NAMES[p]}<small>${st.hands[p].length} 張 · ${score[p]} 分</small></div>
          <div class="b2-backs">${'<span></span>'.repeat(Math.min(st.hands[p].length, 13))}</div>
          <div class="b2-said">${said ? (said === 'pass' ? '過' : said.map(c => cardHTML(c, 'mini')).join('')) : ''}</div>`;
      }
      $('#b2-center').innerHTML = st.last ? `<div class="b2-lastby">${NAMES[st.lastBy]}出的${TYPE_NAME[st.last.combo.type]}</div><div class="b2-pile">${st.last.cards.slice().sort((a, b) => a - b).map(c => cardHTML(c)).join('')}</div>`
        : `<div class="b2-lastby">${st.over ? '' : `${NAMES[st.turn]}領出`}</div>`;
      $('#b2-hand').innerHTML = sortedHand().map(c => `<button class="b2-cardbtn ${st.sel.has(c) ? 'sel' : ''}" data-c="${c}" aria-label="${SUIT_NAME[su(c)]}${RANKS[rk(c)]}" aria-pressed="${st.sel.has(c)}">${cardHTML(c)}</button>`).join('');
      const mine = st.turn === 0 && !st.over;
      const selCards = [...st.sel], combo = selCards.length ? B.classify(selCards) : null;
      const okPlay = mine && combo && B.beats(combo, st.last && st.last.combo) && (!st.firstPlay || st.sel.has(0));
      $('#b2-play').disabled = !okPlay; $('#b2-pass').disabled = !mine || !st.last; $('#b2-hint').disabled = !mine;
      $('#b2-status').innerHTML = st.over ? '' : mine ? (combo ? `已選：${TYPE_NAME[combo.type]}${okPlay ? '' : '（壓不過或不合規則）'}` : selCards.length ? '這幾張不成牌型' : st.firstPlay ? '你有梅花 3，請先出（要包含它）' : st.last ? '輪到你，壓過或選「過」' : '輪到你領出') : `等${NAMES[st.turn]}出牌…`;
      $('#b2-score').innerHTML = `累計：${NAMES.map((n, i) => `${n} <b>${score[i]}</b>`).join(' · ')} <button id="b2-reset" class="linkish">歸零</button>`;
      $('#b2-reset').onclick = () => { score = [0, 0, 0, 0]; api.save('bigtwo.score', JSON.stringify(score)); render(); };
    }
    function play(p, cards) {
      const combo = B.classify(cards);
      st.hands[p] = st.hands[p].filter(c => !cards.includes(c));
      st.last = { cards, combo }; st.lastBy = p; st.passes = 0; st.firstPlay = false; st.log[p] = cards;
      if (p === 0) st.sel.clear();
      if (!st.hands[p].length) return finish(p);
      advance();
    }
    function pass(p) { st.log[p] = 'pass'; st.passes++; if (p === 0) st.sel.clear(); advance(); }
    function advance() {
      st.turn = (st.turn + 1) % 4;
      if (st.passes >= 3) { st.last = null; st.passes = 0; st.log = {}; }
      render(); next();
    }
    function next() {
      if (st.over || st.turn === 0) return;
      aiTimer = setTimeout(() => {
        const p = st.turn, othersMin = Math.min(...[0, 1, 2, 3].filter(i => i !== p).map(i => st.hands[i].length));
        const choice = B.aiChoose(st.hands[p], st.last, st.firstPlay ? 0 : null, othersMin);
        if (choice) play(p, choice.cards); else if (st.last) pass(p); else play(p, [st.hands[p][0]]);
      }, 650);
    }
    function finish(w) {
      st.over = true;
      const pen = st.hands.map(h => (h.length >= 10 ? h.length * 2 : h.length));
      const gain = pen.reduce((a, b) => a + b, 0);
      pen.forEach((x, i) => { score[i] += i === w ? gain : -x; });
      api.save('bigtwo.score', JSON.stringify(score));
      $('#b2-msg').innerHTML = `${w === 0 ? '你先出完了，贏了！' : NAMES[w] + '先出完了。'}本局 ${NAMES.map((n, i) => i === w ? `${n} +${gain}` : `${n} −${pen[i]}`).join('、')}。<button id="b2-again" class="primary inline">再來一局</button>`;
      if (w === 0) api.confetti();
      render();
      $('#b2-again').onclick = deal;
    }
    $('#b2-hand').addEventListener('click', e => {
      const b = e.target.closest('.b2-cardbtn'); if (!b || st.over) return;
      const c = +b.dataset.c; st.sel.has(c) ? st.sel.delete(c) : st.sel.add(c); render();
    });
    $('#b2-play').onclick = () => { if (!$('#b2-play').disabled) play(0, [...st.sel]); };
    $('#b2-pass').onclick = () => { if (!$('#b2-pass').disabled) pass(0); };
    $('#b2-sort').onclick = () => { sortBySuit = !sortBySuit; $('#b2-sort').textContent = sortBySuit ? '依點數排' : '依花色排'; render(); };
    $('#b2-hint').onclick = () => {
      const plays = B.allPlays(st.hands[0]).filter(p => B.beats(p.combo, st.last && st.last.combo) && (!st.firstPlay || p.cards.includes(0)))
        .sort((a, b) => a.combo.key - b.combo.key);
      st.sel = new Set(plays.length ? plays[0].cards : []);
      if (!plays.length) $('#b2-msg').textContent = '沒有壓得過的牌，只能過。';
      render();
    };
    deal();
    return () => clearTimeout(aiTimer);
  };

  if (typeof module !== 'undefined') module.exports = B; else window.GameRoom.register('bigtwo', B);
})();
