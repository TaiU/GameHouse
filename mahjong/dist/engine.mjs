import {typeOf,sortTiles,shuffled,rng,nameOf,WINDS} from './tiles.mjs';
import {canWin,scoreHand,payments} from './rules.mjs';
export const VERSION='0.2.5';
import {isCurrentCommand} from './commands.mjs';
const copy=x=>structuredClone(x);
export const snapshot=state=>copy(state);
const matching=(p,t)=>p.hand.filter(id=>typeOf(id)===t);
const remove=(p,ids)=>{for(const id of ids){const i=p.hand.indexOf(id);if(i<0)throw Error('牌不在手中');p.hand.splice(i,1);}};
const log=(s,text,data={})=>{const n=s.events.length+1;const event={n,id:`${s.roundId}:event-${n}`,roundId:s.roundId,type:'message',text,...data};s.events.push(event);return event;};
export const seatWind=(s,i)=>(i-s.dealer+4)%4;
export const remaining=s=>Math.max(0,s.wall.length-16);
export const playerName=i=>i===0?'你':['','右家','對家','左家'][i];

export function newGame(seed=Date.now()){
  return beginHand({version:VERSION,seed:seed>>>0,handNumber:0,dealer:0,repeat:0,changes:0,roundWind:0,balances:[10000,10000,10000,10000],history:[]});
}
function beginHand(meta){
  const s={...meta,handNumber:meta.handNumber+1,phase:'dealing',turn:meta.dealer,wall:shuffled(rng(meta.seed+meta.handNumber*104729)),players:Array.from({length:4},()=>({hand:[],melds:[],flowers:[],discards:[],passedHu:false})),events:[],pending:null,result:null,lastDraw:null};
  s.roundId=`round-${s.handNumber}`;s.turnVersion=1;s.reserve=s.wall.slice(-16);
  log(s,`${WINDS[s.roundWind]}風圈・第 ${s.handNumber} 局，${playerName(s.dealer)}坐莊`);
  for(let n=0;n<4;n++)for(let j=0;j<4;j++){
    const i=(s.dealer+j)%4;
    for(let tile=0;tile<4;tile++)if(!take(s,i,'deal'))return s;
  }
  s.phase='turn';take(s,s.dealer,'normal');
  return s;
}
function finishDraw(s,reason='wallExhausted'){s.phase='ended';s.pending=null;s.result={kind:'draw',reason,roundId:s.roundId,settlementId:`${s.roundId}:settlement`,winner:null,loser:null,transfers:[],delta:[0,0,0,0],balances:s.balances.slice(),rows:[],tai:0};log(s,reason==='replacementExhausted'?'補牌不足，流局；保留已成立的槓與亮花。':'可摸牌用盡，流局；本局不轉移點數。',{type:'settlement',reason,settlementId:s.result.settlementId});}
function finishWin(s,winner,loser,kind,winningTile=null,extra={}){
  const p=s.players[winner];
  const score=kind==='flowers8'||kind==='flowers7'?{tai:8,rows:[{name:kind==='flowers8'?'八仙過海':'七搶一',tai:8}]}:scoreHand({hand:p.hand,melds:p.melds,flowers:p.flowers,winningTile,selfDraw:loser===null,seatWind:seatWind(s,winner),roundWind:s.roundWind,robKong:kind==='rob',kongDraw:s.lastDraw?.player===winner&&s.lastDraw.reason==='kong',lastTile:s.lastDraw?.player===winner&&s.lastDraw.last,...extra});
  const settlementId=`${s.roundId}:settlement`;
  const transfers=payments({winner,loser,dealer:s.dealer,repeat:s.repeat,score,roundId:s.roundId,settlementId}),delta=[0,0,0,0];
  for(const tr of transfers){delta[tr.from]-=tr.amount;delta[tr.to]+=tr.amount;}
  s.balances=s.balances.map((b,i)=>b+delta[i]);
  s.result={kind,winner,loser,winningTile,roundId:s.roundId,settlementId,dealer:s.dealer,repeat:s.repeat,rows:score.rows,tai:score.tai,transfers,delta,balances:s.balances.slice(),decomposition:score.decomposition,winningPlacement:score.winningPlacement,triggerEventId:extra.triggerEventId??null};
  s.phase='ended';s.pending=null;log(s,`${playerName(winner)}${loser===null?'自摸':'胡牌'}，牌型 ${score.tai} 台。`,{type:'settlement',settlementId,winner,loser,kind});
}
function exposeFlower(s,i,id){
  const seven=s.players.findIndex((q,j)=>j!==i&&q.flowers.length===7);
  const p=s.players[i];p.flowers.push(id);const event=log(s,`${playerName(i)}補花：${nameOf(id)}`,{type:'flower',player:i,tile:id});
  if(p.flowers.length===8){finishWin(s,i,null,'flowers8',null,{triggerEventId:event.id});return false;}
  if(seven>=0){finishWin(s,seven,i,'flowers7',null,{triggerEventId:event.id});return false;}
  return true;
}
// wall ends with the original immutable 16 physical reserve IDs; replacements
// consume the available tail immediately BEFORE that reserve, never wall.pop().
function take(s,i,reason){
  let tail=reason==='kong',actual=reason;
  while(true){
    if(!remaining(s)){finishDraw(s,tail?'replacementExhausted':'wallExhausted');return false;}
    const id=tail?s.wall.splice(s.wall.length-17,1)[0]:s.wall.shift();
    s.players[i].passedHu=false;
    if(typeOf(id)>=34){if(!exposeFlower(s,i,id))return false;tail=true;actual='flower';continue;}
    s.players[i].hand.push(id);sortTiles(s.players[i].hand);
    s.lastDraw={player:i,tile:id,reason:actual,last:remaining(s)===0};
    log(s,`${playerName(i)}${reason==='deal'?'取得發牌':actual==='flower'?'補花後摸牌':actual==='kong'?'槓後補牌':'摸牌'}`,{type:'draw',player:i,reason:actual,remaining:remaining(s)});
    return true;
  }
}
function turnActions(s,i){
  const p=s.players[i],types=p.hand.map(typeOf),a=p.hand.map(id=>({kind:'discard',tile:id}));
  if(s.lastDraw?.player===i&&canWin(types,p.melds.length))a.unshift({kind:'hu'});
  if(remaining(s)>0){
    for(const t of new Set(types))if(matching(p,t).length===4)a.push({kind:'concealedKong',tiles:matching(p,t)});
    p.melds.forEach((m,index)=>{if(m.kind==='pung'){const id=p.hand.find(id=>typeOf(id)===typeOf(m.tiles[0]));if(id!==undefined)a.push({kind:'addedKong',tile:id,meld:index});}});
  }
  return a;
}
function reactions(s,i,pending){
  const p=s.players[i],t=typeOf(pending.tile),same=matching(p,t),a=[];
  if(!p.passedHu&&canWin([...p.hand.map(typeOf),t],p.melds.length))a.push({kind:'hu'});
  if(pending.kind==='discard'){
    if(same.length>=2)a.push({kind:'pung',tiles:same.slice(0,2)});
    if(same.length===3&&remaining(s)>0)a.push({kind:'openKong',tiles:same});
    if(i===(pending.from+1)%4&&t<27){
      for(let start=Math.max(Math.floor(t/9)*9,t-2);start<=Math.min(Math.floor(t/9)*9+6,t);start++){
        const need=[start,start+1,start+2];need.splice(need.indexOf(t),1);
        const ids=need.map(x=>p.hand.find(id=>typeOf(id)===x));
        if(ids.every(id=>id!==undefined))a.push({kind:'chi',tiles:ids});
      }
    }
  }
  return a.length?[...a,{kind:'pass'}]:[];
}
export function legalActions(s,i){
  let actions=[];
  if(s.phase==='ended')actions=i===0?[{kind:'next'}]:[];
  else if(s.phase==='turn')actions=i===s.turn?turnActions(s,i):[];
  else if(s.phase==='response'&&i!==s.pending.from&&s.pending.votes[i]===null)actions=s.pending.options[i];
  return copy(actions).map(a=>({...a,roundId:s.roundId,turnVersion:s.turnVersion}));
}
function openWindow(s,pending){
  s.phase='response';s.pending={...pending,options:[[],[],[],[]],votes:[null,null,null,null]};
  for(let i=0;i<4;i++){
    if(i!==pending.from)s.pending.options[i]=reactions(s,i,pending);
    if(!s.pending.options[i].length)s.pending.votes[i]={kind:'pass'};
  }
  resolve(s);
}
function resolve(s){
  const q=s.pending;if(q.votes.some(v=>v===null))return;
  const order=[1,2,3].map(d=>(q.from+d)%4);
  const winner=order.find(i=>q.votes[i].kind==='hu');
  if(winner!==undefined){
    if(q.kind==='rob')remove(s.players[q.from],[q.tile]);
    else s.players[q.from].discards.at(-1).claimed=true;
    s.players[winner].hand.push(q.tile);sortTiles(s.players[winner].hand);
    finishWin(s,winner,q.from,q.kind==='rob'?'rob':'discard',q.tile);return;
  }
  if(q.kind==='rob'){
    remove(s.players[q.from],[q.tile]);const m=s.players[q.from].melds[q.meld];m.tiles.push(q.tile);m.kind='kong';
    log(s,`${playerName(q.from)}加槓 ${nameOf(q.tile)}`);s.turn=q.from;s.pending=null;s.phase='turn';take(s,s.turn,'kong');return;
  }
  const claimant=order.find(i=>['pung','openKong'].includes(q.votes[i].kind))??order.find(i=>q.votes[i].kind==='chi');
  if(claimant!==undefined){
    const a=q.votes[claimant],p=s.players[claimant];remove(p,a.tiles);s.players[q.from].discards.at(-1).claimed=true;
    p.melds.push({kind:a.kind==='openKong'?'kong':a.kind,tiles:sortTiles([...a.tiles,q.tile]),concealed:false,from:q.from,called:q.tile});
    s.turn=claimant;s.phase='turn';s.pending=null;s.lastDraw=null;
    log(s,`${playerName(claimant)}${{chi:'吃',pung:'碰',openKong:'明槓'}[a.kind]} ${nameOf(q.tile)}`);
    if(a.kind==='openKong')take(s,claimant,'kong');
  }else{s.turn=(q.from+1)%4;s.phase='turn';s.pending=null;take(s,s.turn,'normal');}
}
const actionKey=a=>JSON.stringify([a.kind,a.tile??null,a.meld??null,a.tiles??null]);
// Invalid actions throw before cloning/mutating. Callers retain their exact previous state.
export function act(state,player,action){
  if(!isCurrentCommand(state,action))throw Error('命令已過期或缺少局號／行動版本');
  const found=legalActions(state,player).find(a=>actionKey(a)===actionKey(action));
  if(!found)throw Error('目前不能執行這個動作');
  if(found.kind==='next'){
    const r=state.result,repeat=r.winner===null||r.winner===state.dealer;
    const changes=state.changes+(repeat?0:1);
    return beginHand({version:VERSION,seed:state.seed,handNumber:state.handNumber,dealer:repeat?state.dealer:(state.dealer+1)%4,repeat:repeat?state.repeat+1:0,changes,roundWind:Math.floor(changes/4)%4,balances:state.balances.slice(),history:[...state.history,{handNumber:state.handNumber,...state.result}].slice(-20)});
  }
  const s=copy(state),p=s.players[player],a=found;
  if(s.phase==='response'){
    if(a.kind!=='hu'&&s.pending.options[player].some(x=>x.kind==='hu'))p.passedHu=true;
    s.pending.votes[player]=copy(a);resolve(s);
    // All seats share this response window; only closing it invalidates other votes.
    // legalActions rejects a duplicate vote from a seat that has already replied.
    if(s.phase!=='response')s.turnVersion++;
    return s;
  }
  s.turnVersion++; // A turn action leaves this action window, including kong replacement.
  if(a.kind==='hu'){finishWin(s,player,null,'selfDraw',s.lastDraw?.tile??p.hand.at(-1));}
  else if(a.kind==='discard'){
    remove(p,[a.tile]);p.discards.push({tile:a.tile,claimed:false});s.lastDraw=null;log(s,`${playerName(player)}打出 ${nameOf(a.tile)}`);openWindow(s,{kind:'discard',from:player,tile:a.tile});
  }else if(a.kind==='concealedKong'){
    remove(p,a.tiles);p.melds.push({kind:'kong',tiles:a.tiles.slice(),concealed:true,from:player});log(s,`${playerName(player)}暗槓`);take(s,player,'kong');
  }else if(a.kind==='addedKong')openWindow(s,{kind:'rob',from:player,tile:a.tile,meld:a.meld});
  return s;
}

// This is the ONLY object passed to AI. No wall identities, seed or rival concealed tiles.
export function observe(s,i){
  const result=s.result?Object.fromEntries(Object.entries(s.result).filter(([k])=>!['decomposition','winningPlacement'].includes(k))):null;
  return copy({version:s.version,roundId:s.roundId,turnVersion:s.turnVersion,me:i,phase:s.phase,turn:s.turn,dealer:s.dealer,repeat:s.repeat,roundWind:s.roundWind,handNumber:s.handNumber,balances:s.balances,remaining:remaining(s),hand:s.players[i].hand,passedHu:s.players[i].passedHu,players:s.players.map((p,j)=>({handCount:p.hand.length,melds:p.melds.map(m=>m.concealed&&i!==j?{kind:'kong',concealed:true,count:4,from:j}:{...m}),flowers:p.flowers,discards:p.discards})),pending:s.pending?{kind:s.pending.kind,from:s.pending.from,tile:s.pending.tile}:null,actions:legalActions(s,i),result,events:s.events.slice(-10),lastDraw:s.lastDraw?.player===i?s.lastDraw:null});
}

export function audit(s){
  const ids=[...s.wall,...s.players.flatMap(p=>[...p.hand,...p.flowers,...p.melds.flatMap(m=>m.tiles),...p.discards.filter(d=>!d.claimed).map(d=>d.tile)])];
  const errors=[];
  if(ids.length!==144||new Set(ids).size!==144||ids.some(id=>!Number.isInteger(id)||id<0||id>143))errors.push('144 張實體牌守恆失敗');
  if(s.balances.reduce((a,b)=>a+b,0)!==40000)errors.push('總點數不是 40000');
  if(s.wall.length<16)errors.push('底牌不足 16');
  if(s.reserve?.length!==16||JSON.stringify(s.wall.slice(-16))!==JSON.stringify(s.reserve))errors.push('固定底牌被動用或改變');
  if(s.phase!=='dealing'&&s.phase!=='ended')s.players.forEach((p,i)=>{
    const effective=p.hand.length+p.melds.length*3;
    const expected=(s.phase==='turn'&&i===s.turn)||(s.phase==='response'&&s.pending.kind==='rob'&&i===s.pending.from)?17:16;
    if(effective!==expected)errors.push(`${i} 家有效手牌 ${effective}，應為 ${expected}`);
    if(p.hand.some(id=>typeOf(id)>=34))errors.push('花在暗手');
  });
  return errors;
}
