// 迴廊幻境的原創配樂與音效：全部用 Web Audio 即時合成，不載入任何音檔。
// 每一層換一種「氣氛」（調式、速度、樂器、環境聲），旋律是為這個遊戲寫的短動機，
// 由生成器加上變奏、留白與和弦對齊，所以每次聽都略有不同，但認得出主題。
//
// 用法（window.DriftAudio）：
//   start() / stop()       開關背景音樂（start 要在使用者點擊時呼叫）；on 讀目前狀態
//   setVolume(0..1)        總音量；volume 讀目前值（記在 localStorage）
//   setMood(層數)          任意整數，對應到 6 種氣氛之一，約 4 秒交叉淡入
//   sfx(名稱, n)           音效：rotate(含定位聲) settle step(n=步數) tap blocked slide(n=±1) unlock door win ui
//   unlock()               第一次觸控時呼叫，讓音樂關著時音效也能響
//   dispose()              離開遊戲時呼叫，淡出並停止一切
//   sfxOn / prefOn         音效開關；上次是否開著音樂（給遊戲決定按鈕初始狀態）
//   moods / mood           氣氛清單與目前編號；analyser 給試聽頁畫波形
const DriftAudio = (function () {
  const A = {};
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 無痕模式等 */ } },
  };

  // ── 六種氣氛 ──
  // degree（音級）以所在調式為準；motif 的每個音是 [音級, 拍數]，null 是休止。
  const MOODS = [
    { name: '晨霧', desc: 'D 利底亞調，慢板，玻璃鐘聲與風', root: 62, scale: [0, 2, 4, 6, 7, 9, 11], bpm: 60,
      chords: [0, 1, 5, 4], barsPerChord: 2, lead: 'bell', leadOct: 0, arp: null, texture: 'wind',
      pad: { cutoff: 900, gain: .042 }, sparkle: .025, reverb: .9, echo: .28,
      form: ['A', 'B', 'A2', '-'],
      A: [[4, 1], [6, 1], [7, 2], [8, 1], [7, 1], [4, 2]],
      B: [[7, 1.5], [8, .5], [9, 1], [10, 1], [9, 2], [7, 1], [null, 1]] },
    { name: '砂岸', desc: 'A 多利安調，拇指琴與豎琴分解和弦，潮聲水滴', root: 57, scale: [0, 2, 3, 5, 7, 9, 10], bpm: 72,
      chords: [0, 3, 0, 6], barsPerChord: 2, lead: 'kalimba', leadOct: 12, arp: [0, 2, 4, 7, 4, 2, 4, 2], arpProb: .75, texture: 'water',
      pad: { cutoff: 700, gain: .034 }, sparkle: .01, reverb: .75, echo: .2,
      form: ['A', 'A2', 'B', '-'],
      A: [[0, .5], [2, .5], [4, 1], [5, 1], [4, 1.5], [2, .5], [1, 1], [0, 2]],
      B: [[4, 1], [6, 1], [5, .5], [4, .5], [3, 1], [4, 3], [null, 1]] },
    { name: '星塔', desc: '降 E 五聲音階，高音鐘與星光閃爍', root: 63, scale: [0, 2, 4, 7, 9], bpm: 54,
      chords: [0, 3, 1, 2], barsPerChord: 2, lead: 'bell', leadOct: 12, arp: null, texture: 'shimmer',
      pad: { cutoff: 1300, gain: .03 }, sparkle: .07, reverb: 1, echo: .38,
      form: ['A', 'B', '-', 'A2'],
      A: [[5, 1], [7, 1], [6, 2], [8, 1], [7, 1], [5, 2]],
      B: [[8, 1], [9, .5], [8, .5], [7, 1], [6, 1], [7, 4]] },
    { name: '深井', desc: 'C 自然小調，低沉持續音與木質敲擊，回聲很長', root: 48, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 50,
      chords: [0, 5, 3, 4], barsPerChord: 2, lead: 'kalimba', leadOct: 12, arp: null, texture: 'deep',
      pad: { cutoff: 520, gain: .05 }, sparkle: .012, reverb: 1.1, echo: .42,
      form: ['A', '-', 'B', '-'],
      A: [[0, 1], [2, 1], [4, 3], [null, 1], [3, 1], [2, 1], [0, 2]],
      B: [[4, 1], [5, 1], [6, 1], [7, 3], [4, 2]] },
    { name: '庭園', desc: 'G 混合利底亞調，木笛旋律與撥弦，微風', root: 55, scale: [0, 2, 4, 5, 7, 9, 10], bpm: 76,
      chords: [0, 6, 3, 0], barsPerChord: 2, lead: 'flute', leadOct: 12, arp: [0, 4, 7, 9, 7, 4], arpProb: .55, texture: 'breeze',
      pad: { cutoff: 1000, gain: .03 }, sparkle: .015, reverb: .7, echo: .18,
      form: ['A', 'B', 'A2', 'B'],
      A: [[4, .5], [5, .5], [7, 1], [6, .5], [4, .5], [2, 1], [4, 1.5], [2, .5], [0, 2]],
      B: [[7, 1], [9, 1], [8, .5], [7, .5], [6, 1], [7, 2], [null, 2]] },
    { name: '歸途', desc: 'F 大調，溫暖和聲，木笛與鐘聲齊奏', root: 53, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 63,
      chords: [0, 3, 5, 4], barsPerChord: 2, lead: 'flutebell', leadOct: 12, arp: [0, 2, 4, 2, 7, 4, 2, 4], arpProb: .5, texture: 'breeze',
      pad: { cutoff: 1100, gain: .04 }, sparkle: .02, reverb: .85, echo: .22,
      form: ['A', 'B', 'A2', '-'],
      A: [[2, 1], [4, 1], [5, 1], [4, .5], [2, .5], [1, 2], [null, 2]],
      B: [[4, 1], [7, 1.5], [6, .5], [5, 1], [4, 1], [2, 1], [4, 2]] },
  ];
  A.moods = MOODS.map(m => ({ name: m.name, desc: m.desc }));

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const semis = (M, d) => { const n = M.scale.length, o = Math.floor(d / n); return M.scale[((d % n) + n) % n] + 12 * o; };
  const rand = () => Math.random();

  let ctx = null, master, comp, revIn, noiseBuf, analyser, sfxOut;
  let volume = store.get('drift.audio.vol', .7), on = false, moodIdx = 0, bus = null, timer = null;
  let step = 0, nextTime = 0, phraseNo = 0, arpOn = false;
  A.sfxOn = store.get('drift.audio.sfx', true);
  A.prefOn = store.get('drift.audio.on', false);

  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (rand() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 80 ? i / 80 : 1);
    }
    return buf;
  }
  function getCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    master = ctx.createGain(); master.gain.value = volume;
    analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
    master.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);
    const rev = ctx.createConvolver(); rev.buffer = impulse(5, 2.4);
    const revOut = ctx.createGain(); revOut.gain.value = .55;
    revIn = ctx.createGain(); revIn.connect(rev); rev.connect(revOut); revOut.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = rand() * 2 - 1;
    sfxOut = ctx.createGain(); sfxOut.gain.value = 1; sfxOut.connect(master);
    const sfxRev = ctx.createGain(); sfxRev.gain.value = .5; sfxOut.connect(sfxRev); sfxRev.connect(revIn);
    return ctx;
  }
  Object.defineProperty(A, 'analyser', { get: () => analyser || null });

  // 每種氣氛一條匯流排：乾聲 → 總線，並送到殘響；echo 是附點八分音符的回聲
  function makeBus(M) {
    const b = { out: ctx.createGain(), echo: ctx.createGain(), nodes: [], M };
    b.out.gain.value = 0; b.out.connect(master);
    const rs = ctx.createGain(); rs.gain.value = M.reverb; b.out.connect(rs); rs.connect(revIn);
    const dl = ctx.createDelay(2), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
    dl.delayTime.value = 60 / M.bpm * .75; fb.gain.value = M.echo; lp.type = 'lowpass'; lp.frequency.value = 2200;
    b.echo.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(b.out);
    return b;
  }
  function fadeBus(b, to, sec) {
    const g = b.out.gain, t = ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + sec);
  }
  function killBus(b, sec) {
    if (!b) return;
    fadeBus(b, 0, sec);
    setTimeout(() => { b.nodes.forEach(n => { try { n.stop(); } catch (e) { } }); try { b.out.disconnect(); b.echo.disconnect(); } catch (e) { } }, sec * 1000 + 400);
  }

  // ── 樂器 ──
  function envGain(dest, t, a, peak, dur) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(dest); return g;
  }
  function osc(type, f, t, end, dest, detune = 0) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    o.connect(dest); o.start(t); o.stop(end + .05); return o;
  }
  const INST = {
    // 玻璃鐘：FM 合成，調變量隨時間收斂，尾音乾淨
    bell(out, t, f, v, len = 4) {
      const g = envGain(out, t, .004, v, len);
      const car = osc('sine', f, t, t + len, g);
      const mod = ctx.createOscillator(), mg = ctx.createGain();
      mod.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * .05, t + 1.6);
      mod.connect(mg); mg.connect(car.frequency); mod.start(t); mod.stop(t + len + .05);
      osc('sine', f * 2, t, t + len * .4, envGain(out, t, .004, v * .25, len * .4));
      return g;
    },
    // 拇指琴：正弦主音＋很快消失的高泛音，像金屬片被撥
    kalimba(out, t, f, v, len = 1.8) {
      const g = envGain(out, t, .003, v, len);
      osc('sine', f, t, t + len, g);
      osc('sine', f * 5.4, t, t + .2, envGain(out, t, .002, v * .35, .18));
      osc('triangle', f * 2, t, t + .5, envGain(out, t, .002, v * .15, .5));
      return g;
    },
    // 撥弦（豎琴）：三角波＋鋸齒波經過快速關閉的濾波器
    harp(out, t, f, v, len = 2.2) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1;
      lp.frequency.setValueAtTime(f * 8, t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + .4);
      const g = envGain(out, t, .004, v, len); lp.connect(g);
      osc('triangle', f, t, t + len, lp); osc('sawtooth', f, t, t + len, lp, 6);
      return g;
    },
    // 木笛：慢起音、延遲的顫音、一點氣聲
    flute(out, t, f, v, len = 1) {
      const end = t + len + .35, g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .12);
      g.gain.setValueAtTime(v * .85, t + Math.max(.13, len)); g.gain.exponentialRampToValueAtTime(0.0001, end); g.connect(out);
      const o = osc('sine', f, t, end, g);
      const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5;
      vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * .006, t + .5);
      vib.connect(vg); vg.connect(o.frequency); vib.start(t); vib.stop(end);
      const tg = ctx.createGain(); tg.gain.value = .12; tg.connect(g); osc('triangle', f * 2, t, end, tg);
      const n = ctx.createBufferSource(); n.buffer = noiseBuf; const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 2; const ng = ctx.createGain(); ng.gain.value = .25;
      n.connect(bp); bp.connect(ng); ng.connect(g); n.start(t, rand()); n.stop(end);
      return g;
    },
    flutebell(out, t, f, v, len) { INST.flute(out, t, f, v * .8, len); return INST.bell(out, t, f * 2, v * .25, 3); },
    // 木質敲擊：短促、帶一點高泛音
    wood(out, t, f, v, len = .5) {
      const g = envGain(out, t, .002, v, len);
      osc('sine', f, t, t + len, g); osc('sine', f * 3.9, t, t + .08, envGain(out, t, .001, v * .3, .08));
      return g;
    },
  };

  // 和聲墊：每個音兩支微微走音的鋸齒波，一起過低通濾波器，濾波頻率緩慢呼吸
  function pad(b, t, notes, dur) {
    const M = b.M, a = Math.min(3, dur * .35), end = t + dur + 2.5;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(M.pad.gain, t + a); g.gain.setValueAtTime(M.pad.gain, t + dur);
    g.gain.linearRampToValueAtTime(0.0001, end);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = M.pad.cutoff; lp.Q.value = .4;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .07 + rand() * .05; lg.gain.value = M.pad.cutoff * .35;
    lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t); lfo.stop(end);
    lp.connect(g); g.connect(b.out);
    notes.forEach(m => { const f = mtof(m); osc('sawtooth', f, t, end, lp, -7 + rand() * 2); osc('sawtooth', f, t, end, lp, 7 - rand() * 2); });
    // 低音：和弦根音低兩個八度的正弦波
    const bg = ctx.createGain(); bg.gain.setValueAtTime(0.0001, t); bg.gain.linearRampToValueAtTime(M.pad.gain * 1.4, t + a);
    bg.gain.setValueAtTime(M.pad.gain * 1.4, t + dur); bg.gain.linearRampToValueAtTime(0.0001, end); bg.connect(b.out);
    osc('sine', mtof(notes[0] - 12), t, end, bg);
  }

  // 持續的環境聲，跟著匯流排一起淡入淡出
  function texture(b) {
    const M = b.M, kind = M.texture;
    const noise = (freq, q, gain, lfoRate, lfoDepth) => {
      const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
      const g = ctx.createGain(); g.gain.value = gain;
      const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = lfoRate; lg.gain.value = lfoDepth;
      l.connect(lg); lg.connect(bp.frequency);
      const l2 = ctx.createOscillator(), l2g = ctx.createGain(); l2.frequency.value = lfoRate * 1.7; l2g.gain.value = gain * .6;
      l2.connect(l2g); l2g.connect(g.gain);
      n.connect(bp); bp.connect(g); g.connect(b.out);
      n.start(); l.start(); l2.start(); b.nodes.push(n, l, l2);
    };
    if (kind === 'wind') noise(420, .8, .05, .045, 260);
    if (kind === 'breeze') noise(900, .6, .022, .06, 400);
    if (kind === 'water') { noise(300, .5, .045, .09, 120); noise(1600, 1.5, .01, .13, 500); }
    if (kind === 'deep' || kind === 'shimmer') {
      const base = kind === 'deep' ? M.root - 24 : M.root + 24, gain = kind === 'deep' ? .025 : .006;
      [0, 7, kind === 'deep' ? 12 : 16].forEach((s, i) => {
        const g = ctx.createGain(); g.gain.value = gain; g.connect(b.out);
        const o = ctx.createOscillator(); o.frequency.value = mtof(base + s); o.detune.value = (i - 1) * 4;
        const tr = ctx.createOscillator(), tg = ctx.createGain(); tr.frequency.value = .11 + i * .07; tg.gain.value = gain * .8;
        tr.connect(tg); tg.connect(g.gain); o.connect(g); o.start(); tr.start(); b.nodes.push(o, tr);
      });
      if (kind === 'shimmer') noise(5000, .7, .006, .05, 1500);
    }
  }

  // ── 生成器 ──
  const chordAt = (M, s) => M.chords[Math.floor(s / (M.barsPerChord * 8)) % M.chords.length];
  const chordTones = (M, r) => M.scale.length >= 7 ? [r, r + 2, r + 4] : [r, r + 1, r + 2];
  function snap(M, d, r) {
    const n = M.scale.length; if (n < 7) return d;
    const ok = x => [0, 2, 4].includes((((x - r) % n) + n) % n);
    if (ok(d)) return d; if (ok(d - 1)) return d - 1; return d + 1;
  }
  function voicing(M, r) {
    const tones = chordTones(M, r).concat(M.scale.length >= 7 && rand() < .5 ? [r + 6] : []);
    return tones.map(d => { let s = semis(M, d); while (s > 9) s -= 12; while (s < -3) s += 12; return M.root - 12 + s; }).sort((a, b) => a - b);
  }
  function phrase(b, t, s) {
    const M = b.M, kind = M.form[phraseNo++ % M.form.length];
    arpOn = !!M.arp && rand() < .7;
    if (kind === '-' || rand() < .12) return;
    let notes = M[kind === 'B' ? 'B' : 'A'].map(n => n.slice());
    if (kind === 'A2') { // 變奏：換掉最後一個長音，或把中間某音上移
      const last = notes.length - 1 - (notes[notes.length - 1][0] === null ? 1 : 0);
      notes[last][0] += rand() < .5 ? -2 : 2;
      if (rand() < .5) { const k = 1 + Math.floor(rand() * (notes.length - 2)); if (notes[k][0] !== null) notes[k][0] += 1; }
    }
    const spb = 60 / M.bpm, play = INST[M.lead];
    let beat = 0;
    notes.forEach(([d, len]) => {
      if (d !== null) {
        const at = s + beat * 2, onBeat = beat % 1 === 0 && len >= 1;
        const deg = onBeat ? snap(M, d, chordAt(M, at)) : d;
        const tt = t + beat * spb + (rand() - .5) * .02;
        const g = play(b.out, tt, mtof(M.root + M.leadOct + semis(M, deg)), .1 * (onBeat ? 1 : .8), Math.max(1.2, len * spb * 1.8));
        if (M.echo) g.connect(b.echo);
      }
      beat += len;
    });
  }
  function schedStep(b, t, s) {
    const M = b.M, perChord = M.barsPerChord * 8, stepDur = 30 / M.bpm, r = chordAt(M, s);
    if (s % perChord === 0) pad(b, t, voicing(M, r), perChord * stepDur);
    if (s % 32 === 0) phrase(b, t, s);
    if (arpOn && M.arp && rand() < M.arpProb) {
      const d = r + M.arp[s % M.arp.length];
      INST.harp(b.out, t, mtof(M.root + semis(M, d)), .035 + rand() * .015, 2);
    }
    if (rand() < M.sparkle) {
      const tones = chordTones(M, r), d = tones[Math.floor(rand() * 3)] + M.scale.length * 2;
      INST.bell(b.echo, t, mtof(M.root + semis(M, d)), .018, 3);
    }
    if (M.texture === 'water' && rand() < .05) { // 水滴：音高快速上滑的短正弦波
      const g = envGain(b.out, t, .002, .03, .12), o = ctx.createOscillator();
      const f0 = 500 + rand() * 600; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 2.4, t + .08);
      o.connect(g); o.start(t); o.stop(t + .15);
    }
  }
  function tick() {
    if (!bus) return;
    const ahead = ctx.currentTime + 1.2;
    while (nextTime < ahead) { schedStep(bus, nextTime, step); nextTime += 30 / bus.M.bpm; step++; }
  }
  function enterMood(i, fade) {
    const old = bus;
    bus = makeBus(MOODS[i]); texture(bus); fadeBus(bus, 1, fade);
    step = 0; phraseNo = 0; arpOn = false; nextTime = ctx.currentTime + .1;
    if (old) killBus(old, fade);
    tick();
  }

  // ── 對外 ──
  A.unlock = function () { const c = getCtx(); if (c && c.state !== 'running') c.resume(); };
  A.start = function () {
    const c = getCtx(); if (!c) return; c.resume();
    if (on) return;
    on = true; store.set('drift.audio.on', A.prefOn = true);
    enterMood(moodIdx, 3);
    timer = setInterval(tick, 200);
  };
  A.stop = function (sec = 2) {
    if (!on) return;
    on = false; store.set('drift.audio.on', A.prefOn = false);
    clearInterval(timer); timer = null; killBus(bus, sec); bus = null;
  };
  A.dispose = function () { const pref = A.prefOn; A.stop(.6); store.set('drift.audio.on', A.prefOn = pref); };
  A.setMood = function (n) {
    const i = ((Math.floor(n) || 0) % MOODS.length + MOODS.length) % MOODS.length;
    if (i === moodIdx && bus) return;
    moodIdx = i; if (on) enterMood(i, 4);
  };
  A.setVolume = function (v) {
    volume = Math.max(0, Math.min(1, +v || 0)); store.set('drift.audio.vol', volume);
    if (master) { const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(volume, t, .05); }
  };
  A.setSfx = function (b) { A.sfxOn = !!b; store.set('drift.audio.sfx', A.sfxOn); };
  Object.defineProperty(A, 'on', { get: () => on });
  Object.defineProperty(A, 'volume', { get: () => volume });
  Object.defineProperty(A, 'mood', { get: () => moodIdx });

  // 音效：音高取自目前氣氛的調式與和弦，所以和背景音樂永遠和諧
  let stepNo = 0;
  A.sfx = function (name, n = 0) {
    if (!A.sfxOn) return;
    const c = getCtx(); if (!c) return; if (c.state !== 'running') c.resume();
    const M = MOODS[moodIdx], t = c.currentTime + .01, out = sfxOut;
    const r = bus ? chordAt(M, Math.max(0, step - 4)) : M.chords[0];
    const note = (d, oct = 12) => mtof(M.root + oct + semis(M, d));
    const ct = chordTones(M, r), N = M.scale.length;
    const sweep = (f0, f1, dur, gain, q = 3) => {
      const s = c.createBufferSource(); s.buffer = noiseBuf; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * .3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(bp); bp.connect(g); g.connect(out); s.start(t, rand()); s.stop(t + dur + .05);
    };
    switch (name) {
      case 'rotate': { // 石塊轉動：濾波噪音掃頻＋低音滑音，方向決定往上或往下
        const up = n >= 0;
        sweep(up ? 260 : 900, up ? 900 : 260, .7, .09, 2.5);
        const g = envGain(out, t, .08, .05, .8), o = c.createOscillator(); o.type = 'triangle';
        const f = note(r, -12); o.frequency.setValueAtTime(up ? f : f * 1.12, t); o.frequency.exponentialRampToValueAtTime(up ? f * 1.12 : f, t + .7);
        o.connect(g); o.start(t); o.stop(t + .9);
        INST.wood(out, t + .72, note(r, -12), .1, .4); INST.bell(out, t + .75, note(r + N), .03, 2.5); // 轉到定位
        break;
      }
      case 'settle': // 轉到定位：木質一聲＋輕鐘
        INST.wood(out, t, note(r, -12), .12, .4); INST.bell(out, t + .03, note(r + N), .035, 2.5); break;
      case 'step': { // 每走一格往上爬一個和弦音
        const seq = [0, 1, 2, 3, 4, 5, 6].map(k => ct[k % 3] + Math.floor(k / 3) * N);
        if (n === 0) stepNo = 0;
        const d = seq[(n || stepNo++) % seq.length];
        INST.kalimba(out, t, note(d), .045, 1); break;
      }
      case 'tap': INST.kalimba(out, t, note(ct[1] + N), .06, 1.4); break;
      case 'blocked': INST.wood(out, t, note(r + 1, 0), .08, .3); INST.wood(out, t + .12, note(r, 0), .07, .4); break;
      case 'slide': { // 滑軌／升降台：+1 往上滑，-1 往回滑
        const up = n >= 0; sweep(up ? 450 : 750, up ? 750 : 450, .5, .05, 6);
        INST.wood(out, t + .48, note(up ? ct[1] : r, 0), .06, .3); break;
      }
      case 'unlock': ct.concat([r + N]).forEach((d, k) => INST.bell(out, t + k * .09, note(d), .05, 2.6)); break;
      case 'door': { // 門亮起：慢慢膨脹的高音和弦
        [r, r + 4, r + N + 1].forEach(d => {
          const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.03, t + 1);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5); g.connect(out); osc('sine', note(d), t, t + 3.5, g, (rand() - .5) * 10);
        });
        INST.bell(out, t + .9, note(r + N * 2), .04, 4); break;
      }
      case 'win': { // 過關：四個鐘聲往上，最後落在主音
        const line = [ct[0], ct[1], ct[2], ct[0] + N, ct[2], ct[0] + N];
        const tm = [0, .18, .36, .6, 1.0, 1.3];
        line.forEach((d, k) => INST.bell(out, t + tm[k], note(d), k === line.length - 1 ? .08 : .055, k === line.length - 1 ? 5 : 2.5));
        INST.harp(out, t + 1.3, note(r, -12), .06, 4); INST.harp(out, t + 1.32, note(r + 4, -12), .05, 4);
        break;
      }
      default: INST.wood(out, t, 1320, .03, .12); // 'ui'
    }
  };

  return A;
})();
window.DriftAudio = DriftAudio;
