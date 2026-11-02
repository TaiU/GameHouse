// 遊戲間的 service worker：讓網頁 app 離線也能玩。
// 本站檔案「先上網拿最新、斷線才用快取」，所以每次推上 main 後，有網路時一定是新版；
// 外部字型與 three.js 「先用快取」。新增遊戲檔時把路徑加進 CORE，並把 VERSION 加一。
const VERSION = 'gamehouse-v1';
const CORE = [
  './', 'index.html', 'manifest.webmanifest',
  'icons/logo.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  'js/sudoku.js', 'js/stars.js', 'js/gomoku.js', 'js/tilematch.js', 'js/xiangqi.js', 'js/bigtwo.js', 'js/numbox.js',
  'js/cube.js', 'js/spin.js', 'js/drift-audio.js', 'js/drift-levels.js', 'js/drift.js',
  'mahjong/dist/index.html', 'mahjong/dist/style.css', 'mahjong/dist/app.mjs', 'mahjong/dist/ai.mjs', 'mahjong/dist/commands.mjs',
  'mahjong/dist/engine.mjs', 'mahjong/dist/faces.mjs', 'mahjong/dist/rules.mjs', 'mahjong/dist/tiles.mjs',
];
const CDN = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(CORE);
    // 外部檔案抓不到不影響安裝，第一次用到時會再補進快取
    await Promise.all(CDN.map(u => c.add(new Request(u, { mode: 'cors' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) e.respondWith(networkFirst(req));
  else if (/^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)$/.test(url.hostname)) e.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  const c = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) c.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') return (await c.match('index.html')) || Response.error();
    throw err;
  }
}

async function cacheFirst(req) {
  const c = await caches.open(VERSION);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') c.put(req, res.clone());
  return res;
}
