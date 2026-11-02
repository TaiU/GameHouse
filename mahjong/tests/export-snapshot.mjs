import {writeFileSync,appendFileSync,mkdirSync} from 'node:fs';
import {newGame,act,legalActions,observe,snapshot,audit,VERSION} from '../dist/engine.mjs';
import {chooseAction} from '../dist/ai.mjs';
const seed=Number(process.argv[2]??87654),tag=`v${VERSION}-seed-${seed}`;
mkdirSync('tests/results',{recursive:true});
const full=`tests/results/${tag}-full.jsonl`,restricted=`tests/results/${tag}-observations.jsonl`;
let s=newGame(seed),step=0;
writeFileSync(full,JSON.stringify({step,seed,version:VERSION,state:snapshot(s)})+'\n');writeFileSync(restricted,'');
while(s.phase!=='ended'){
  const player=s.phase==='turn'?s.turn:[0,1,2,3].find(i=>legalActions(s,i).length),view=observe(s,player),action=chooseAction(view);
  appendFileSync(restricted,JSON.stringify({step:step+1,player,view,action})+'\n');
  s=act(s,player,action);const errors=audit(s);
  appendFileSync(full,JSON.stringify({step:++step,player,action,state:snapshot(s),errors})+'\n');
  if(errors.length||step>700)throw Error('Export failed: '+JSON.stringify(errors));
}
const settlement=s.result,nextAction=legalActions(s,0).find(a=>a.kind==='next');s=act(s,0,nextAction);
appendFileSync(full,JSON.stringify({step:++step,player:0,action:nextAction,state:snapshot(s),errors:audit(s)})+'\n');
console.log(JSON.stringify({full,restricted,steps:step,settlement,nextRound:s.roundId},null,2));
