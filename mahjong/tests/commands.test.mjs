import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {newGame,act,legalActions,observe,audit} from '../dist/engine.mjs';
import {bindCommand,createCommandScheduler} from '../dist/commands.mjs';
import {fixture,tileId} from './fixtures.mjs';
const reject=(s,i,a)=>{const before=structuredClone(s);assert.throws(()=>act(s,i,a),/命令已過期/);assert.deepEqual(s,before);};
const kind=(s,i,k)=>legalActions(s,i).find(a=>a.kind===k);

test('U02 replay: previous-round physical tile 96 cannot be discarded again',()=>{
  const replay=JSON.parse(readFileSync(new URL('./data/independent-r1-first-hand-replay.json',import.meta.url)));
  let s=newGame(replay.seed);
  for(const x of replay.trace){
    const a=legalActions(s,x.player).find(a=>a.kind===x.action.kind&&a.tile===x.action.tile&&a.meld===x.action.meld&&JSON.stringify(a.tiles)===JSON.stringify(x.action.tiles));
    assert(a);s=act(s,x.player,a);
  }
  s=act(s,0,kind(s,0,'next'));
  const old=JSON.parse(readFileSync(new URL('./data/independent-r1-stale-action.json',import.meta.url)));
  assert.equal(s.roundId,'round-2');assert.equal(s.turn,old.player);assert(s.players[old.player].hand.includes(old.oldAction.tile));
  reject(s,old.player,old.oldAction);assert.deepEqual(audit(s),[]);
  const current=legalActions(s,old.player).find(a=>a.kind==='discard'&&a.tile===old.oldAction.tile);
  const n=act(s,old.player,current);assert.deepEqual(audit(n),[]);
  writeFileSync('tests/results/stale-action-v025-m1574.json',JSON.stringify({case:'U02',status:'PASS',oldAction:old.oldAction,currentAction:current,before:{round:s.roundId,turn:s.turn,wall:s.wall.length,discards:s.players[old.player].discards.length},rejectedWithoutMutation:true,currentAccepted:true},null,2));
});
test('missing, future, wrong-round versions reject atomically; observation carries valid commands',()=>{
  const s=newGame(32),a=kind(s,0,'discard'),view=observe(s,0);
  assert.equal(view.roundId,s.roundId);assert.equal(view.turnVersion,1);assert.deepEqual(view.actions,legalActions(s,0));
  for(const c of [null,{}, {kind:a.kind,tile:a.tile},{...a,turnVersion:'1'},{...a,turnVersion:2},{...a,roundId:'round-99'}])reject(s,0,c);
  const n=act(s,0,a);assert.equal(n.turnVersion,2);reject(n,0,a);
});
test('same-seat kong replacement invalidates previously legal discard even if tile remains',()=>{
  const s=fixture({hands:{0:[0,0,0,0,3,4,5,9,10,11,18,19,20,27,27,28,29]}});
  const old=legalActions(s,0).find(a=>a.kind==='discard'&&a.tile===tileId(s,0,27));
  const n=act(s,0,kind(s,0,'concealedKong'));assert.equal(n.turn,0);assert(n.players[0].hand.includes(old.tile));reject(n,0,old);
  assert.deepEqual(audit(act(n,0,{...old,turnVersion:n.turnVersion})),[]);
});
function responseFixture(){
  const waiting=[0,1,2,3,4,5,9,10,11,12,13,14,18,19,20,27];
  let s=fixture({hands:{1:waiting,2:waiting},wallStart:[27]});
  const id=s.wall.shift(),old=s.players[0].hand.pop();s.wall.unshift(old);s.players[0].hand.push(id);
  return act(s,0,legalActions(s,0).find(a=>a.kind==='discard'&&a.tile===id));
}
const rejectDuplicate=(s,i,a)=>{const before=structuredClone(s);assert.throws(()=>act(s,i,a));assert.deepEqual(s,before);};
for(const order of [[1,2],[2,1]])test(`same-window captured hu survives other response; arrival ${order} keeps nearest winner`,()=>{
  let s=responseFixture();const version=s.turnVersion;
  const captured=[0,1,2,3].map(i=>kind(s,i,'hu')??kind(s,i,'pass'));
  assert(captured[1]&&captured[2]);
  s=act(s,order[0],captured[order[0]]);assert.equal(s.turnVersion,version);
  rejectDuplicate(s,order[0],captured[order[0]]);
  s=act(s,order[1],captured[order[1]]);
  if(s.phase==='response')s=act(s,3,captured[3]);
  assert.equal(s.result.winner,1);assert.equal(s.turnVersion,version+1);assert.deepEqual(audit(s),[]);
  reject(s,1,captured[1]);
  const next=kind(s,0,'next'),n=act(s,0,next);reject(n,0,next);
});
test('captured pass remains valid after another hu; lower claim cannot outrank hu',()=>{
  let s=responseFixture();const hu=kind(s,2,'hu'),pass=kind(s,1,'pass'),pung=kind(s,3,'pung'),third=kind(s,3,'pass');
  s=act(s,2,hu);s=act(s,1,pass);rejectDuplicate(s,1,pass);
  if(s.phase==='response')s=act(s,3,pung??third);
  assert.equal(s.result.winner,2);assert.deepEqual(audit(s),[]);
});
test('captured UI and AI replies remain usable in same window and scheduler fires once',()=>{
  let s=responseFixture();let calls=0;const queued=[];
  const human=bindCommand(()=>s,kind(s,1,'hu'),a=>{s=act(s,1,a);calls++;});
  const scheduler=createCommandScheduler(()=>s,(a,i)=>{s=act(s,i,a);calls++;},fn=>{queued.push(fn);return queued.length;},()=>{});
  scheduler.schedule(kind(s,2,'hu'),2);queued[0]();queued[0]();assert.equal(calls,1);
  human();assert.equal(calls,2);
  while(s.phase==='response'){const i=[0,1,2,3].find(i=>legalActions(s,i).length);s=act(s,i,kind(s,i,'pass'));}
  assert.equal(s.result.winner,1);assert.deepEqual(audit(s),[]);
});
test('captured click/Enter/next callbacks do not re-stamp, mutate or run twice',()=>{
  let state={roundId:'round-1',turnVersion:1},calls=0;
  for(const kind of ['discard','hu','pass','next']){
    const command={...state,kind,tile:96};
    const click=bindCommand(()=>state,command,a=>{assert.equal(a.kind,kind);calls++;state={...state,turnVersion:state.turnVersion+1};});
    command.turnVersion=999;click();const count=calls;assert.equal(click(),false);assert.equal(calls,count);
  }
  const old=bindCommand(()=>state,{...state,kind:'next'},()=>calls++);
  state={roundId:'round-2',turnVersion:1};assert.equal(old(),false);assert.equal(calls,4);
});
test('queued AI callbacks reject stale versions and canceled generations, current callback runs once',()=>{
  let state={roundId:'round-1',turnVersion:1},calls=0;const queued=[];
  const scheduler=createCommandScheduler(()=>state,(a,i)=>{assert.equal(i,2);calls++;state={...state,turnVersion:state.turnVersion+1};},fn=>{queued.push(fn);return queued.length;},()=>{});
  scheduler.schedule({...state,kind:'discard',tile:96},2);state={...state,turnVersion:2};queued[0]();assert.equal(calls,0);
  scheduler.schedule({...state,kind:'discard',tile:96},2);scheduler.schedule({...state,kind:'discard',tile:97},2);
  queued[1]();assert.equal(calls,0);queued[2]();queued[2]();assert.equal(calls,1);
  scheduler.schedule({...state,kind:'discard',tile:96},2);state={roundId:'round-2',turnVersion:1};queued[3]();assert.equal(calls,1);
  scheduler.schedule({...state,kind:'discard',tile:96},2);scheduler.cancel();queued[4]();assert.equal(calls,1);
});

for(const order of [[1,2],[2,1]])test(`captured pung and hu both accepted; hu outranks pung, arrival ${order}`,()=>{
  const waiting=[0,1,2,3,4,5,9,10,11,12,13,14,18,19,20,27];
  let s=fixture({hands:{1:waiting,2:[27,27,6,7,8,15,16,17,21,22,23,24,25,26,28,29]},wallStart:[27]});
  const id=s.wall.shift(),old=s.players[0].hand.pop();s.wall.unshift(old);s.players[0].hand.push(id);
  s=act(s,0,legalActions(s,0).find(a=>a.kind==='discard'&&a.tile===id));
  const replies=[null,kind(s,1,'hu'),kind(s,2,'pung'),kind(s,3,'pass')];assert(replies[1]&&replies[2]);
  for(const i of order)s=act(s,i,replies[i]);
  if(s.phase==='response')s=act(s,3,replies[3]);
  assert.equal(s.result.winner,1);assert.equal(s.players[2].melds.length,0);assert.deepEqual(audit(s),[]);
});
test('rob-kong window accepts both originally captured hu replies and resolves nearest',()=>{
  const waiting=[0,1,3,4,5,9,10,11,18,19,20,24,25,26,27,27];
  let s=fixture({hands:{0:[2,6,7,8,9,10,11,12,13,14,18,19,20,30],1:waiting,2:waiting},melds:{0:[{kind:'pung',types:[2,2,2],concealed:false,from:3}]}});
  s=act(s,0,kind(s,0,'addedKong'));const version=s.turnVersion;
  const first=kind(s,1,'hu'),second=kind(s,2,'hu'),third=kind(s,3,'pass');assert(first&&second);
  s=act(s,2,second);assert.equal(s.turnVersion,version);rejectDuplicate(s,2,second);s=act(s,1,first);
  if(s.phase==='response')s=act(s,3,third);
  assert.equal(s.result.kind,'rob');assert.equal(s.result.winner,1);assert.equal(s.turnVersion,version+1);assert.deepEqual(audit(s),[]);
});
