import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,tileId} from './fixtures.mjs';
import {act,legalActions,audit,observe,newGame} from '../dist/engine.mjs';
import {typeOf} from '../dist/tiles.mjs';
import {scoreHand} from '../dist/rules.mjs';
const waiting=[0,1,2,3,4,5,9,10,11,12,13,14,18,19,20,27];
const doKind=(s,i,k)=>act(s,i,legalActions(s,i).find(a=>a.kind===k));
const passAll=s=>{while(s.phase==='response'){const i=[0,1,2,3].find(i=>legalActions(s,i).length);s=doKind(s,i,'pass');}return s;};

test('nearest hu outranks another hu and lower claims; one payment',()=>{
  let s=fixture({hands:{1:waiting,2:waiting}});
  if(tileId(s,0,27)===undefined){const id=s.wall.find(id=>typeOf(id)===27),old=s.players[0].hand.pop();s.wall[s.wall.indexOf(id)]=old;s.players[0].hand.push(id);}
  s=act(s,0,legalActions(s,0).find(a=>a.kind==='discard'&&a.tile===tileId(s,0,27)));
  assert(legalActions(s,1).some(a=>a.kind==='hu'));assert(legalActions(s,2).some(a=>a.kind==='hu'));
  s=doKind(s,2,'hu');s=doKind(s,1,'hu');s=passAll(s);
  assert.equal(s.result.winner,1);assert.equal(s.result.loser,0);assert.equal(s.result.transfers.length,1);assert.deepEqual(audit(s),[]);
});
test('chi only next player and all available sequences are separate choices',()=>{
  let s=fixture({hands:{1:[0,1,3,4,9,10,11,12,13,14,18,19,20,27,28,29]},wallStart:[]});
  const id=s.wall.find(id=>typeOf(id)===2),old=s.players[0].hand.pop();s.wall[s.wall.indexOf(id)]=old;s.players[0].hand.push(id);
  s=act(s,0,legalActions(s,0).find(a=>a.kind==='discard'&&a.tile===id));
  assert.equal(legalActions(s,1).filter(a=>a.kind==='chi').length,3);
  assert(!legalActions(s,2).some(a=>a.kind==='chi'));assert(!legalActions(s,3).some(a=>a.kind==='chi'));
  s=doKind(s,1,'chi');s=passAll(s);assert.equal(s.turn,1);assert.equal(s.players[1].melds.at(-1).kind,'chi');assert.deepEqual(audit(s),[]);
  assert(!legalActions(s,1).some(a=>a.kind==='hu'),'claim without draw cannot be self-draw hu');
});
test('passed hu remains blocked until that player draws',()=>{
  let s=fixture({hands:{2:waiting}});
  const id=s.wall.find(id=>typeOf(id)===27),old=s.players[0].hand.pop();s.wall[s.wall.indexOf(id)]=old;s.players[0].hand.push(id);
  s=act(s,0,legalActions(s,0).find(a=>a.kind==='discard'&&a.tile===id));assert(legalActions(s,2).some(a=>a.kind==='hu'));s=doKind(s,2,'pass');s=passAll(s);
  assert(s.players[2].passedHu);assert.equal(s.turn,1);
  // Player 1 discards, player 2's own draw clears it after responses resolve.
  s=act(s,1,legalActions(s,1).find(a=>a.kind==='discard'));s=passAll(s);
  assert.equal(s.turn,2);assert.equal(s.players[2].passedHu,false);assert.deepEqual(audit(s),[]);
});
test('rob added kong moves exactly the fourth tile into winning hand',()=>{
  let s=fixture({hands:{0:[2,6,7,8,9,10,11,12,13,14,18,19,20,30],1:[0,1,3,4,5,9,10,11,18,19,20,24,25,26,27,27]},melds:{0:[{kind:'pung',types:[2,2,2],concealed:false,from:3}]}});
  const id=tileId(s,0,2);s=doKind(s,0,'addedKong');assert.equal(s.pending.kind,'rob');
  s=doKind(s,1,'hu');s=passAll(s);
  assert.equal(s.result.kind,'rob');assert.equal(s.players[0].melds[0].tiles.length,3);assert(!s.players[0].hand.includes(id));assert(s.players[1].hand.includes(id));assert.deepEqual(audit(s),[]);
});
test('concealed kong is hidden from rival AI and replacement can cascade flowers',()=>{
  let s=fixture({hands:{0:[0,0,0,0,3,4,5,9,10,11,18,19,20,27,27,28,29]},wallEnd:[8,35,34]});
  s=doKind(s,0,'concealedKong');assert.equal(s.players[0].flowers.length,2);assert.equal(typeOf(s.lastDraw.tile),8);assert.equal(s.lastDraw.reason,'flower');
  assert.equal(observe(s,1).players[0].melds[0].tiles,undefined);assert.deepEqual(audit(s),[]);
});
test('eight flowers and seven rob one terminate immediately without normal hand',()=>{
  let s=fixture({hands:{0:[0,0,0,0,3,4,5,9,10,11,18,19,20,27,27,28,29]},flowers:{0:[34,35,36,37,38,39,40]},wallEnd:[41]});
  s=doKind(s,0,'concealedKong');assert.equal(s.result.kind,'flowers8');assert.equal(s.result.tai,8);assert.equal(s.result.transfers.length,3);assert.deepEqual(audit(s),[]);
  s=fixture({hands:{0:[0,0,0,0,3,4,5,9,10,11,18,19,20,27,27,28,29]},flowers:{2:[34,35,36,37,38,39,40]},wallEnd:[41]});
  s=doKind(s,0,'concealedKong');assert.equal(s.result.kind,'flowers7');assert.equal(s.result.winner,2);assert.equal(s.result.loser,0);assert.deepEqual(audit(s),[]);
});
test('16-tile reserve draw, no transfer, dealer repeat',()=>{
  let s=newGame(32);
  // Move only surplus wall tiles into discarded piles, preserving every physical tile.
  while(s.wall.length>16)s.players[3].discards.push({tile:s.wall.shift(),claimed:false});
  s=act(s,0,legalActions(s,0).find(a=>a.kind==='discard'));s=passAll(s);
  assert.equal(s.result.kind,'draw');assert.deepEqual(s.balances,[10000,10000,10000,10000]);assert.deepEqual(audit(s),[]);
  const n=act(s,0,legalActions(s,0).find(a=>a.kind==='next'));assert.equal(n.dealer,0);assert.equal(n.repeat,1);
});
test('four dealer changes rotate wind and negatives do not stop next hand',()=>{
  let s=newGame(22);s.phase='ended';s.result={kind:'discard',winner:1};s.balances=[-500,20500,10000,10000];
  for(let n=0;n<4;n++){s.phase='ended';s.result={kind:'discard',winner:(s.dealer+1)%4};s=act(s,0,legalActions(s,0).find(a=>a.kind==='next'));}
  assert.equal(s.roundWind,1);assert.equal(s.dealer,0);assert.equal(s.balances[0],-500);assert.equal(s.phase,'turn');assert.deepEqual(audit(s),[]);
});
test('D03 declining self draw still permits ron before own next draw',()=>{
  let s=fixture({hands:{0:[...waiting,27],1:[6,6,7,8,15,15,16,17,21,22,24,25,28,29,30,27]},wallStart:[33]});
  assert(legalActions(s,0).some(a=>a.kind==='hu'));
  const ownDraws=s.events.filter(e=>e.type==='draw'&&e.player===0).length;
  // Decline a legal self draw by discarding East; no new passed-hu restriction.
  s=act(s,0,legalActions(s,0).find(a=>a.kind==='discard'&&a.tile===tileId(s,0,27)));
  assert.equal(s.players[0].passedHu,false);assert.deepEqual(audit(s),[]);
  s=passAll(s);assert.equal(s.turn,1);
  // The next seat actually draws, then discards its own physical East.
  s=act(s,1,legalActions(s,1).find(a=>a.kind==='discard'&&a.tile===tileId(s,1,27)));
  assert.equal(s.events.filter(e=>e.type==='draw'&&e.player===0).length,ownDraws);
  assert(legalActions(s,0).some(a=>a.kind==='hu'));
  s=doKind(s,0,'hu');s=passAll(s);
  assert.equal(s.result.kind,'discard');assert.equal(s.result.winner,0);assert.equal(s.result.loser,1);
  assert.deepEqual(audit(s),[]);
});
