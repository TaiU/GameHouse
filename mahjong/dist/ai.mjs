import {typeOf,counts} from './tiles.mjs';

// A deterministic hand-efficiency player. Receives observe() only; no engine import.
// Exact meld/partial-group search is bounded by memoized 34-count positions.
export function efficiency(types,open=0){
  const c=counts(types),memo=new Map();
  function visit(m,t,p){
    if(m>5)return 99;
    const key=c.join('')+','+m+','+t+','+p;
    if(memo.has(key))return memo.get(key);
    const i=c.findIndex(n=>n);
    if(i<0)return 10-2*(m+open)-Math.min(t,5-m-open)-p;
    let best=99;
    const branch=(ids,nm,nt,np)=>{for(const x of ids)c[x]--;best=Math.min(best,visit(nm,nt,np));for(const x of ids)c[x]++;};
    if(c[i]>=3)branch([i,i,i],m+1,t,p);
    if(i<27&&i%9<7&&c[i+1]&&c[i+2])branch([i,i+1,i+2],m+1,t,p);
    if(c[i]>=2){if(!p)branch([i,i],m,t,1);if(t<5)branch([i,i],m,t+1,p);}
    if(i<27&&t<5){if(i%9<8&&c[i+1])branch([i,i+1],m,t+1,p);if(i%9<7&&c[i+2])branch([i,i+2],m,t+1,p);}
    branch([i],m,t,p);memo.set(key,best);return best;
  }
  return visit(0,0,0);
}
function discardRank(o,id){
  const types=o.hand.filter(x=>x!==id).map(typeOf),t=typeOf(id),c=counts(types);
  const visible=o.players.flatMap(p=>p.discards.map(d=>typeOf(d.tile)));
  const safe=visible.filter(x=>x===t).length;
  const connected=t<27?[t-2,t-1,t+1,t+2].filter(x=>x>=0&&x<27&&Math.floor(x/9)===Math.floor(t/9)).reduce((n,x)=>n+c[x],0):0;
  return efficiency(types,o.players[o.me].melds.length)*100+connected*3+c[t]*5-safe*2+(t<27?4-Math.abs(t%9-4):0);
}
export function chooseAction(o){
  const a=o.actions;
  if(!a.length)return null;
  if(a.some(x=>x.kind==='hu'))return a.find(x=>x.kind==='hu');
  const kong=a.find(x=>['concealedKong','addedKong','openKong'].includes(x.kind));
  if(kong)return kong;
  const discards=a.filter(x=>x.kind==='discard');
  if(discards.length){
    const ranks=new Map();
    for(const x of discards){const t=typeOf(x.tile);if(!ranks.has(t))ranks.set(t,discardRank(o,x.tile));}
    return discards.slice().sort((x,y)=>ranks.get(typeOf(x.tile))-ranks.get(typeOf(y.tile))||x.tile-y.tile)[0];
  }
  const before=efficiency(o.hand.map(typeOf),o.players[o.me].melds.length);
  for(const x of a.filter(x=>['pung','chi'].includes(x.kind))){
    const rest=o.hand.filter(id=>!x.tiles.includes(id));
    const after=Math.min(...rest.map(id=>efficiency(rest.filter(y=>y!==id).map(typeOf),o.players[o.me].melds.length+1)));
    if(after<before)return x;
  }
  return a.find(x=>x.kind==='pass')??a[0];
}
