import {newGame,act,legalActions,observe,audit} from '../dist/engine.mjs';
import {chooseAction} from '../dist/ai.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
const games=Number(process.argv[2]??120),start=performance.now();
const summary={hands:games,wins:0,draws:0,actions:0,byAction:{},negativeBalanceObserved:false,errors:[]};
for(let n=0;n<games;n++){
  let s=newGame(n*7919+1001);
  if(n%5===0)s.balances=[-1000,21000,10000,10000];
  for(let step=0;s.phase!=='ended';step++){
    const errors=audit(s);if(errors.length||step>700){summary.errors.push({seed:s.seed,step,errors,state:s});break;}
    const i=s.phase==='turn'?s.turn:[0,1,2,3].find(i=>legalActions(s,i).length);
    const a=chooseAction(observe(s,i));if(!a){summary.errors.push({seed:s.seed,step,error:'no action',state:s});break;}
    summary.byAction[a.kind]=(summary.byAction[a.kind]??0)+1;summary.actions++;
    s=act(s,i,a);
  }
  if(s.phase==='ended'){
    if(s.result.kind==='draw')summary.draws++;else summary.wins++;
    summary.negativeBalanceObserved ||= s.balances.some(b=>b<0);
    const errs=audit(s);if(errs.length)summary.errors.push({seed:s.seed,errors:errs,state:s});
    s=act(s,0,legalActions(s,0).find(a=>a.kind==='next'));if(audit(s).length)summary.errors.push({seed:s.seed,errors:audit(s),state:s});
  }
}
summary.durationMs=Math.round(performance.now()-start);summary.timestamp=new Date().toISOString();
mkdirSync('tests/results',{recursive:true});
const path=`tests/results/simulation-${summary.timestamp.replace(/[:.]/g,'-')}.json`;
writeFileSync(path,JSON.stringify(summary,null,2));console.log(JSON.stringify({...summary,errors:summary.errors.length,path},null,2));
if(summary.errors.length)process.exitCode=1;
