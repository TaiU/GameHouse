import test from 'node:test';import assert from 'node:assert/strict';
import {bindSettlementButton} from '../dist/commands.mjs';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
test('settlement rejects cross-target second click, touch-like detail 1 and held keys; fresh activation works',()=>{
  let time=0,calls=0,prevented=0;const timers=[],button={};
  bindSettlementButton(button,()=>++calls,()=>time,fn=>timers.push(fn));
  assert(button.disabled);button.onclick({detail:1});time=999;button.onclick({detail:1});button.onclick({detail:0});assert.equal(calls,0);
  time=1000;timers[0]();assert.equal(button.disabled,false);button.onclick({detail:2});button.onkeydown({repeat:true,preventDefault(){prevented++;}});assert.equal(calls,0);assert.equal(prevented,1);
  button.onclick({detail:1});button.onclick({detail:0});assert.equal(calls,2);
});
test('actual app self-draw settles once, overlap click cannot advance; fresh next and duplicate next preserve balances',async()=>{
  class Element{constructor(){this.children=[];this.dataset={};this.attributes={};this.classList={toggle(){},add(){}};this.innerHTML='';this.textContent='';}setAttribute(k,v){this.attributes[k]=v;}replaceChildren(...v){this.children=v;}append(v){this.children.push(v);}focus(){}showModal(){this.open=true;}close(){this.open=false;}}
  const roots=new Map(),get=id=>{if(!roots.has(id))roots.set(id,new Element());return roots.get(id);};let time=0;const timers=[];
  const original={document:globalThis.document,performance:globalThis.performance,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
  const folder=mkdtempSync(join(tmpdir(),'mahjong-u08-app-'));
  const engine=new URL('../dist/engine.mjs',import.meta.url).href,fixture=JSON.parse(readFileSync(new URL('./data/u08-prehu.json',import.meta.url)));
  fixture.version='0.2.5';
  writeFileSync(join(folder,'engine.mjs'),`export * from ${JSON.stringify(engine)};export const newGame=()=>structuredClone(${JSON.stringify(fixture)});`);
  let source=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');source=source.replace(/from '\.\/(.*?)'/g,(_,f)=>`from '${f==='engine.mjs'?pathToFileURL(join(folder,f)).href:new URL('../dist/'+f,import.meta.url).href}'`);writeFileSync(join(folder,'app.mjs'),source);
  globalThis.document={getElementById:get,createElement:()=>new Element(),querySelector:()=>null};globalThis.performance={now:()=>time};globalThis.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length;};globalThis.clearTimeout=()=>{};
  try{
    await import(pathToFileURL(join(folder,'app.mjs')).href);
    const hu=get('actions').children.find(b=>b.textContent==='自摸');assert(hu);hu.onclick({detail:1});
    assert(get('settlement').open);assert.match(get('round').textContent,/第 1 局/);const paid=get('result-body').innerHTML;
    const modalNext=get('next-hand'),footerNext=get('actions').children.find(b=>b.textContent.includes('下一局'));
    for(const b of [modalNext,footerNext,get('result-close')]){assert(b.disabled);b.onclick({detail:1});}
    hu.onclick({detail:2});assert(get('settlement').open);assert.match(get('round').textContent,/第 1 局/);assert.equal(get('result-body').innerHTML,paid);
    time=1000;for(const t of timers.slice())if(t.ms===1000)t.fn();
    modalNext.onclick({detail:2});assert.match(get('round').textContent,/第 1 局/);
    modalNext.onclick({detail:1});assert.match(get('round').textContent,/第 2 局/);const balances=[0,1,2,3].map(i=>get('seat-'+i).innerHTML.match(/class="score [^"]*">([^<]+)/)[1]);
    assert.deepEqual(balances,['14,500','8,500','8,500','8,500']);
    modalNext.onclick({detail:1});footerNext.onclick({detail:1});assert.match(get('round').textContent,/第 2 局/);assert.equal(get('settlement').open,false);
  }finally{Object.assign(globalThis,original);}
});
