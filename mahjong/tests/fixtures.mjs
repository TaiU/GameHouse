import {newGame} from '../dist/engine.mjs';
import {typeOf,sortTiles,shuffled,rng} from '../dist/tiles.mjs';
// TEST ONLY: construct explicit physical fixtures with a full 144-tile partition.
// Production app never imports this file or accepts a fixture/query seed.
export function fixture({turn=0,hands={},melds={},flowers={},wallEnd=[],wallStart=[],dealer=0,repeat=0}={}){
  const s=newGame(1);s.turn=turn;s.dealer=dealer;s.repeat=repeat;s.phase='turn';s.result=null;s.pending=null;s.events=[];
  let pool=shuffled(rng(729));
  const grab=t=>{const n=pool.findIndex(id=>typeOf(id)===t);if(n<0)throw Error('fixture has >4 copies of '+t);return pool.splice(n,1)[0];};
  s.players=Array.from({length:4},()=>({hand:[],melds:[],flowers:[],discards:[],passedHu:false}));
  for(let i=0;i<4;i++){
    s.players[i].hand=(hands[i]??[]).map(grab);
    s.players[i].melds=(melds[i]??[]).map(m=>({...m,tiles:m.types.map(grab)}));
    s.players[i].flowers=(flowers[i]??[]).map(grab);
  }
  const head=wallStart.map(grab),tail=wallEnd.map(grab);
  for(let i=0;i<4;i++){
    const p=s.players[i],target=16-p.melds.length*3+(i===turn?1:0);
    if(i in hands&&p.hand.length!==target)throw Error(`fixture hand ${i} has ${p.hand.length}, expected ${target}`);
    while(p.hand.length<target){const index=pool.findIndex(id=>typeOf(id)<34);p.hand.push(pool.splice(index,1)[0]);}
    sortTiles(p.hand);
  }
  s.reserve=pool.splice(-16);s.wall=[...head,...pool,...tail,...s.reserve];s.lastDraw={player:turn,tile:s.players[turn].hand.at(-1),reason:'normal',last:false};
  return s;
}
export function tileId(s,i,t){return s.players[i].hand.find(id=>typeOf(id)===t);}
