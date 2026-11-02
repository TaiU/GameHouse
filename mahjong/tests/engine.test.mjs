import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,act,legalActions,audit,observe,remaining} from '../dist/engine.mjs';
import {typeOf} from '../dist/tiles.mjs';
import {decompositions,canWin,scoreHand,payments,winningTypes} from '../dist/rules.mjs';
import {chooseAction} from '../dist/ai.mjs';
const ids=types=>{const used=Array(42).fill(0);return types.map(t=>t<34?t*4+used[t]++:t+102);};
const score=(types,extra={})=>{const hand=ids(types);return scoreHand({hand,melds:[],flowers:[],winningTile:hand.at(-1),selfDraw:false,seatWind:0,roundWind:0,...extra});};

test('16-tile winning structure requires five melds and a pair',()=>{
  assert(canWin([0,1,2,3,4,5,9,10,11,18,19,20,31,31,31,27,27]));
  assert(!canWin([0,1,2,3,4,5,9,10,11,31,31,31,27,27]));
  assert(!canWin([0,0,0,0,0,1,2,3,4,5,6,7,8,9,9,9,9]));
  assert(decompositions([0,0,0,1,1,1,2,2,2,3,3,3,4,4,4,5,5]).length>1);
});
test('payment dealer relationship, repeats, zero tai and negatives',()=>{
  let p=payments({winner:1,loser:null,dealer:0,repeat:2,score:{tai:0,rows:[]}});
  assert.deepEqual(p.map(t=>[t.from,t.amount]),[[0,1500],[2,500],[3,500]]);
  assert.equal(payments({winner:2,loser:3,dealer:0,repeat:4,score:{tai:0,rows:[]}})[0].amount,500);
  assert.equal(payments({winner:0,loser:3,dealer:0,repeat:4,score:{tai:0,rows:[]}})[0].amount,2300);
});
test('scoring excludes double counted patterns',()=>{
  let s=score([27,27,27,28,28,28,29,29,29,30,30,30,31,31,31,32,32]);
  assert(s.rows.some(r=>r.name==='字一色'));assert(s.rows.some(r=>r.name==='大四喜'));
  for(const n of ['碰碰胡','圈風刻','門風刻'])assert(!s.rows.some(r=>r.name===n));
  s=score([0,1,2,9,10,11,31,31,31,32,32,32,33,33,33,27,27]);
  assert(s.rows.some(r=>r.name==='大三元'));assert(!s.rows.some(r=>['紅中','青發','白板'].includes(r.name)));
  s=score([0,1,2,3,4,5,9,10,11,18,19,20,31,31,31,27,27],{selfDraw:true});
  assert(s.rows.some(r=>r.name==='門清自摸'));assert(!s.rows.some(r=>['門清','自摸'].includes(r.name)));
});
test('flower set substitutes correct flower; flower draw is not kong draw',()=>{
  const s=score([0,1,2,3,4,5,9,10,11,18,19,20,31,31,31,27,27],{flowers:ids([34,35,36,37,38]),selfDraw:true,kongDraw:false});
  assert(s.rows.some(r=>r.name==='四季齊全'&&r.tai===2));assert(s.rows.some(r=>r.name==='正君子花'));
  assert(!s.rows.some(r=>r.name==='正季花'||r.name==='槓上開花'));
});
test('initial deal conservation and illegal input atomicity',()=>{
  for(let seed=1;seed<=20;seed++){
    const s=newGame(seed);assert.deepEqual(audit(s),[]);
    assert.deepEqual(s.players.map(p=>p.hand.length),[17,16,16,16]);
    const before=JSON.stringify(s);assert.throws(()=>act(s,1,{kind:'discard',tile:s.players[0].hand[0]}));assert.equal(JSON.stringify(s),before);
    const o=observe(s,1);assert(!('wall'in o));assert(!('seed'in o));assert(o.players.every(p=>!('hand'in p)));
    o.hand.pop();assert.equal(s.players[1].hand.length,16);
  }
});
test('multiple real AI hands terminate, conserve tiles/money and advance',()=>{
  let wins=0,draws=0,actions=0,s=newGame(87654);
  for(let n=0;n<12;n++){
    let turns=0;
    while(s.phase!=='ended'){
      assert.deepEqual(audit(s),[]);
      const player=s.phase==='turn'?s.turn:[0,1,2,3].find(i=>legalActions(s,i).length);
      assert.notEqual(player,undefined);
      const o=observe(s,player),a=chooseAction(o);assert(a);
      s=act(s,player,a);assert(++turns<700);actions++;
    }
    assert.deepEqual(audit(s),[]);
    if(s.result.kind==='draw')draws++;else wins++;
    const old=s;s=act(s,0,legalActions(s,0).find(a=>a.kind==='next'));
    assert.equal(s.handNumber,old.handNumber+1);
    if(old.result.winner===null||old.result.winner===old.dealer){assert.equal(s.dealer,old.dealer);assert.equal(s.repeat,old.repeat+1);}
    else {assert.equal(s.dealer,(old.dealer+1)%4);assert.equal(s.repeat,0);}
  }
  assert(wins>0);console.log(JSON.stringify({hands:12,wins,draws,actions}));
});
