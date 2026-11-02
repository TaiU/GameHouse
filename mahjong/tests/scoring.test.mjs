import test from 'node:test';import assert from 'node:assert/strict';
import {scoreHand,winningTypes} from '../dist/rules.mjs';
import {typeOf} from '../dist/tiles.mjs';
function make(types,win,extra={}){const used=Array(34).fill(0),hand=types.map(t=>4*t+used[t]++);return scoreHand({hand,winningTile:hand.find(id=>typeOf(id)===win),melds:[],flowers:[],selfDraw:false,seatWind:0,roundWind:0,...extra});}
const has=(s,n)=>s.rows.find(r=>r.name===n)?.tai??0;
test('pinhu two-sided versus edge/closed wait and flowers',()=>{
  const t=[0,1,2,3,4,5,9,10,11,12,13,14,18,19,20,23,23];
  assert.equal(has(make(t,18),'平胡'),2);
  assert.equal(has(make(t,2),'平胡'),0);
  assert.equal(has(make(t,19),'平胡'),0);
  assert.equal(has(make(t,18,{flowers:[136]}),'平胡'),0);
  assert.equal(has(make(t,18,{selfDraw:true}),'平胡'),0);
});
test('discard completes pung: four concealed becomes three concealed',()=>{
  const t=[0,0,0,9,9,9,18,18,18,27,27,27,3,4,5,31,31];
  assert.equal(has(make(t,27),'三暗刻'),2);assert.equal(has(make(t,27),'四暗刻'),0);
  assert.equal(has(make(t,27,{selfDraw:true}),'四暗刻'),5);
});
test('small dragons replace individual dragon bonuses; wind can stack',()=>{
  const s=make([0,1,2,9,10,11,27,27,27,31,31,31,32,32,32,33,33],33);
  assert.equal(has(s,'小三元'),4);assert.equal(has(s,'紅中'),0);assert.equal(has(s,'青發'),0);
  assert.equal(has(s,'門風刻'),1);assert.equal(has(s,'圈風刻'),1);
});
test('suit patterns select correct tier',()=>{
  assert.equal(has(make([0,0,0,1,1,1,2,2,2,3,3,3,4,4,4,5,5],5),'清一色'),8);
  assert.equal(has(make([0,0,0,1,1,1,2,2,2,3,3,3,4,4,4,27,27],27),'混一色'),4);
});
test('all exposed excludes unique wait; open zero-tai hand is legal',()=>{
  const melds=[0,3,9,12,18].map(start=>({kind:'chi',concealed:false,tiles:[start*4,(start+1)*4,(start+2)*4]}));
  const s=make([23,23],23,{melds});assert.equal(has(s,'全求人'),2);assert.equal(has(s,'獨聽'),0);
  const open=melds.slice(0,4),t=[18,19,20,23,23];
  const zero=make(t,19,{melds:open,flowers:[137],seatWind:0});
  // Closed wait here is exclusive and earns one, while a two-sided flower hand earns zero.
  const z=make(t,18,{melds:open,flowers:[137],seatWind:0});assert.equal(z.tai,0);
  assert.equal(has(z,'平胡'),0);assert.equal(has(z,'門清'),0);
});
test('event tai requires correct win mode',()=>{
  const t=[0,1,2,3,4,5,9,10,11,12,13,14,18,19,20,23,23];
  let s=make(t,18,{selfDraw:true,kongDraw:true,lastTile:true});assert.equal(has(s,'槓上開花'),1);assert.equal(has(s,'海底自摸'),1);
  s=make(t,18,{selfDraw:false,kongDraw:true,lastTile:true,robKong:true});assert.equal(has(s,'槓上開花'),0);assert.equal(has(s,'海底自摸'),0);assert.equal(has(s,'搶槓'),1);
});
