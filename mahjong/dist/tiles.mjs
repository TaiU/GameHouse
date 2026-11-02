export const WINDS = ['東','南','西','北'];
export const NAMES = [...'一二三四五六七八九'].map(x=>x+'萬').concat([...'一二三四五六七八九'].map(x=>x+'筒'),[...'一二三四五六七八九'].map(x=>x+'索'),['東','南','西','北','中','發','白','春','夏','秋','冬','梅','蘭','竹','菊']);
export const typeOf = id => id < 136 ? Math.floor(id/4) : id-102;
export const nameOf = id => NAMES[typeOf(id)];
export const sortTiles = hand => hand.sort((a,b)=>typeOf(a)-typeOf(b)||a-b);
export const counts = types => { const c=Array(34).fill(0); for(const t of types) if(t<34)c[t]++; return c; };
export function rng(seed) { let x=seed>>>0; return ()=>{x+=0x6D2B79F5; let t=x; t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}; }
export function shuffled(random) {const a=Array.from({length:144},(_,i)=>i);for(let i=143;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
