import test from 'node:test';import assert from 'node:assert/strict';
import {newGame,act,legalActions,audit,observe,snapshot} from '../dist/engine.mjs';
import {shuffled,rng,typeOf} from '../dist/tiles.mjs';
import {scoreHand,payments} from '../dist/rules.mjs';
import {fixture,tileId} from './fixtures.mjs';
const waiting=[0,1,2,3,4,5,9,10,11,12,13,14,18,19,20,27];
const kind=(s,i,k)=>act(s,i,legalActions(s,i).find(a=>a.kind===k));
const passAll=s=>{while(s.phase==='response'){const i=[0,1,2,3].find(i=>legalActions(s,i).length);s=kind(s,i,'pass');}return s;};
function leaveAvailable(s,keep=[]){
  const remaining=s.wall.slice(0,-16).filter(id=>!keep.includes(id));
  for(const id of remaining)if(typeOf(id)>=34)s.players[3].flowers.push(id);else s.players[3].discards.push({tile:id,claimed:false});
  s.wall=[...keep,...s.reserve];return s;
}
test('D01 original last 16 physical IDs never drawn; deal in four-tile packets',()=>{
  const s=newGame(87654);assert.deepEqual(s.reserve,shuffled(rng(87654)).slice(-16));assert.deepEqual(s.wall.slice(-16),s.reserve);
  const draws=s.events.filter(e=>e.type==='draw');assert.deepEqual(draws.slice(0,16).map(e=>e.player),[0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3]);
  assert.equal(draws.length,65);assert.deepEqual(audit(s),[]);
});
test('D01 last discard still accepts hu; no kong and illegal kong is atomic',()=>{
  let s=fixture({hands:{1:waiting},wallStart:[27]});const id=s.wall.shift(),old=s.players[0].hand.pop();s.wall.unshift(old);s.players[0].hand.push(id);leaveAvailable(s);
  const before=JSON.stringify(s);assert(!legalActions(s,0).some(a=>a.kind.includes('Kong')));assert.throws(()=>act(s,0,{kind:'addedKong',tile:id,meld:0,roundId:s.roundId,turnVersion:s.turnVersion}));assert.equal(JSON.stringify(s),before);
  s=act(s,0,legalActions(s,0).find(a=>a.kind==='discard'&&a.tile===id));assert(legalActions(s,1).some(a=>a.kind==='hu'));s=kind(s,1,'hu');s=passAll(s);assert.equal(s.result.winner,1);assert.deepEqual(audit(s),[]);
});
test('D01 exhausted wall allows chi and another discard before draw',()=>{
  let s=fixture({hands:{1:[0,1,3,4,9,10,11,12,13,14,18,19,20,27,28,29]},wallStart:[2]});
  const id=s.wall.shift(),old=s.players[0].hand.pop();s.wall.unshift(old);s.players[0].hand.push(id);leaveAvailable(s);
  s=act(s,0,legalActions(s,0).find(a=>a.kind==='discard'&&a.tile===id));s=kind(s,1,'chi');s=passAll(s);assert.equal(s.phase,'turn');assert.equal(s.turn,1);
  s=act(s,1,legalActions(s,1).find(a=>a.kind==='discard'));s=passAll(s);assert.equal(s.result.kind,'draw');assert.deepEqual(audit(s),[]);
});
test('D01 kong then final flower leaves legal kong and reports replacement shortage',()=>{
  let s=fixture({hands:{0:[0,0,0,0,3,4,5,9,10,11,18,19,20,27,27,28,29]},wallEnd:[34]});
  leaveAvailable(s,[s.wall.at(-17)]);const bottom=s.reserve.slice();s.players[0].passedHu=true;s=kind(s,0,'concealedKong');
  assert.equal(s.result.reason,'replacementExhausted');assert.equal(s.players[0].melds.length,1);assert.equal(s.players[0].passedHu,false);assert(s.players[0].flowers.some(id=>typeOf(id)===34));assert.deepEqual(s.wall,bottom);assert.deepEqual(audit(s),[]);
});
test('D02 transfers expose mandatory accounting fields and settlement IDs',()=>{
  const tr=payments({winner:1,loser:0,dealer:0,repeat:2,score:{tai:3,rows:[]},roundId:'round-9',settlementId:'round-9:settlement'})[0];
  assert.deepEqual([tr.payer,tr.payee,tr.baseTai,tr.dealerTai,tr.totalTai,tr.amount,tr.roundId,tr.settlementId],[0,1,3,5,8,2100,'round-9','round-9:settlement']);
});
test('D03 draw attempt without actual tile does not clear passed hu',()=>{
  let s=newGame(32);leaveAvailable(s);s.players[1].passedHu=true;
  s=act(s,0,legalActions(s,0).find(a=>a.kind==='discard'));s=passAll(s);
  assert.equal(s.result.kind,'draw');assert.equal(s.players[1].passedHu,true);
});
test('D04 nominal two-sided shape cannot add a fifth owned copy',()=>{
  const types=[0,1,2,...Array(4).fill([3,4,5]).flat(),9,9],used=Array(34).fill(0),hand=types.map(t=>t*4+used[t]++);
  const scored=scoreHand({hand,melds:[],flowers:[],winningTile:0,selfDraw:false,seatWind:0,roundWind:0});
  assert(!scored.rows.some(r=>r.name==='平胡'));assert.deepEqual(scored.winningCandidates,[0,6,9]);assert(!scored.winningCandidates.includes(3));assert(!scored.rows.some(r=>r.name==='獨聽'));
});
test('D05 seven flowers do not retroactively rob earlier eighth; events unique',()=>{
  let s=fixture({hands:{0:[0,0,0,0,3,4,5,9,10,11,18,19,20,27,27,28,29]},flowers:{0:[34,35,36,37,38,39],1:[41]},wallEnd:[8,40]});
  s=kind(s,0,'concealedKong');assert.equal(s.players[0].flowers.length,7);assert.equal(s.result,null);assert.equal(s.phase,'turn');
  const flower=s.events.filter(e=>e.type==='flower');assert.equal(flower.length,1);assert.equal(flower[0].tile,142);assert.equal(new Set(s.events.map(e=>e.id)).size,s.events.length);assert.deepEqual(audit(s),[]);
});
test('D05 seven rob one references unique event without moving flower; fixed 8 base',()=>{
  let s=fixture({hands:{0:[0,0,0,0,3,4,5,9,10,11,18,19,20,27,27,28,29]},flowers:{2:[34,35,36,37,38,39,40]},wallEnd:[41],repeat:2});s=kind(s,0,'concealedKong');
  assert.equal(s.result.tai,8);assert.equal(s.result.rows.length,1);assert.equal(s.result.transfers[0].baseTai,8);assert.equal(s.result.transfers[0].dealerTai,5);assert.equal(s.players[2].flowers.length,7);assert(s.players[0].flowers.includes(143));assert.equal(s.events.find(e=>e.id===s.result.triggerEventId).type,'flower');assert.deepEqual(audit(s),[]);
});
test('D06 snapshot is independent; rival view strips reserve and hidden kong',()=>{
  let s=fixture({hands:{0:[0,0,0,0,3,4,5,9,10,11,18,19,20,27,27,28,29]}});s=kind(s,0,'concealedKong');
  const snap=snapshot(s),view=observe(s,1);snap.wall.pop();assert.notEqual(snap.wall.length,s.wall.length);
  assert(!('reserve'in view));assert(!('wall'in view));assert(!('seed'in view));assert.deepEqual(view.players[0].melds[0],{kind:'kong',concealed:true,count:4,from:0});
  assert(!view.events.some(e=>e.text.includes('一萬')));assert.deepEqual(audit(s),[]);
});
