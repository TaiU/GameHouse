import {typeOf, counts} from './tiles.mjs';

// Enumerate every standard five-meld-and-pair decomposition. No seven-pairs shortcut.
export function decompositions(types, exposed=0) {
  const need=5-exposed;
  if(need<0||types.length!==need*3+2)return [];
  const c=counts(types); if(c.some(n=>n>4))return [];
  const out=[];
  function groups(pair,acc){
    const t=c.findIndex(n=>n>0);
    if(t<0){if(acc.length===need)out.push({pair,groups:acc.slice()});return;}
    if(acc.length>=need)return;
    if(c[t]>=3){c[t]-=3;acc.push({kind:'pung',types:[t,t,t]});groups(pair,acc);acc.pop();c[t]+=3;}
    if(t<27&&t%9<=6&&c[t+1]&&c[t+2]){c[t]--;c[t+1]--;c[t+2]--;acc.push({kind:'chi',types:[t,t+1,t+2]});groups(pair,acc);acc.pop();c[t]++;c[t+1]++;c[t+2]++;}
  }
  for(let p=0;p<34;p++)if(c[p]>=2){c[p]-=2;groups(p,[]);c[p]+=2;}
  return out;
}
export const canWin = (types,exposed=0)=>decompositions(types,exposed).length>0;
export function winningTypes(types,melds=[]){
  const all=counts(types.concat(melds.flatMap(m=>m.tiles.map(typeOf))));
  return Array.from({length:34},(_,t)=>t).filter(t=>all[t]<4&&canWin([...types,t],melds.length));
}

export function scoreHand({hand,melds,flowers,winningTile,selfDraw,seatWind,roundWind,robKong=false,kongDraw=false,lastTile=false}){
  const types=hand.map(typeOf), win=typeOf(winningTile);
  const decomps=decompositions(types,melds.length);
  if(!decomps.length)throw Error('不是五面子一對眼');
  const before=types.slice();before.splice(before.indexOf(win),1);
  const candidates=winningTypes(before,melds),single=candidates.length===1;
  const exposed=melds.map(m=>({kind:m.kind==='chi'?'chi':'pung',types:m.tiles.map(typeOf),concealed:m.concealed}));
  const all=types.concat(exposed.flatMap(g=>g.types));
  const suits=new Set(all.filter(t=>t<27).map(t=>Math.floor(t/9))), honors=all.some(t=>t>=27);
  const closed=melds.every(m=>m.concealed);
  let best=null;
  for(const d of decomps){
    const places=[...d.groups.map((g,i)=>g.types.includes(win)?i:null).filter(i=>i!==null),...(d.pair===win?[-1]:[])];
    for(const place of places){
      const rows=[];const add=(name,tai)=>rows.push({name,tai});
      const groups=d.groups.concat(exposed), pungs=groups.filter(g=>g.kind==='pung').map(g=>g.types[0]);
      if(closed&&selfDraw)add('門清自摸',3);else{if(closed)add('門清',1);if(selfDraw)add('自摸',1);}
      for(const start of [34,38]){
        const f=flowers.map(typeOf).filter(t=>t>=start&&t<start+4);
        if(f.length===4)add(start===34?'四季齊全':'四君子齊全',2);
        else if(f.includes(start+seatWind))add(start===34?'正季花':'正君子花',1);
      }
      const dragons=pungs.filter(t=>t>=31).length, winds=pungs.filter(t=>t>=27&&t<31).length;
      if(dragons===3)add('大三元',8);
      else if(dragons===2&&d.pair>=31)add('小三元',4);
      else for(const t of pungs.filter(t=>t>=31))add(['紅中','青發','白板'][t-31],1);
      if(winds===4)add('大四喜',16);
      else if(winds===3&&d.pair>=27&&d.pair<31)add('小四喜',8);
      else {if(pungs.includes(27+seatWind))add('門風刻',1);if(pungs.includes(27+roundWind))add('圈風刻',1);}
      if(suits.size===0)add('字一色',16);
      else {if(groups.every(g=>g.kind==='pung'))add('碰碰胡',4);if(suits.size===1)add(honors?'混一色':'清一色',honors?4:8);}
      const hidden=d.groups.filter((g,i)=>g.kind==='pung'&&(selfDraw||i!==place)).length+exposed.filter(g=>g.kind==='pung'&&g.concealed).length;
      if(hidden>=3)add(['三暗刻','四暗刻','五暗刻'][hidden-3],[2,5,8][hidden-3]);
      const g=d.groups[place];
      const otherEnd=g?.kind==='chi'?(win===g.types[0]?win+3:win===g.types[2]?win-3:-1):-1;
      const twoSide=g?.kind==='chi'&&((win===g.types[0]&&win%9!==6)||(win===g.types[2]&&win%9!==2))&&candidates.length>=2&&candidates.includes(otherEnd)&&candidates.includes(win);
      if(!selfDraw&&!flowers.length&&!honors&&groups.every(g=>g.kind==='chi')&&twoSide)add('平胡',2);
      if(!selfDraw&&melds.length===5&&melds.every(m=>!m.concealed))add('全求人',2);
      else if(single)add('獨聽',1);
      if(robKong)add('搶槓',1);
      if(selfDraw&&kongDraw)add('槓上開花',1);
      if(selfDraw&&lastTile)add('海底自摸',1);
      const tai=rows.reduce((n,r)=>n+r.tai,0);
      if(!best||tai>best.tai)best={tai,rows,decomposition:d,winningPlacement:place,winningCandidates:candidates};
    }
  }
  return best;
}

export function payments({winner,loser=null,dealer,repeat,score,roundId=null,settlementId=null}){
  const payers=loser===null?[0,1,2,3].filter(i=>i!==winner):[loser];
  return payers.map(from=>{
    const dealerTai=(from===dealer||winner===dealer)?1+2*repeat:0;
    const rows=[...score.rows,...(dealerTai?[{name:`莊家${repeat?'・連 '+repeat:''}`,tai:dealerTai}]:[])];
    const tai=score.tai+dealerTai;
    return {from,to:winner,tai,payer:from,payee:winner,baseTai:score.tai,dealerTai,totalTai:tai,amount:500+200*tai,roundId,settlementId,rows};
  });
}
