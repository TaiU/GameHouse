import test from 'node:test';import assert from 'node:assert/strict';
// Execute the actual app module against a minimal DOM/timer adapter. This is not a browser test.
test('actual app bindings: retained tile, Enter, discard and AI callbacks cannot act twice',async()=>{
  class Element{
    constructor(){this.children=[];this.dataset={};this.attributes={};this.classList={toggle(){},add(){}};this.textContent='';this.innerHTML='';}
    setAttribute(k,v){this.attributes[k]=v;}replaceChildren(...items){this.children=items;}append(item){this.children.push(item);}focus(){}showModal(){this.open=true;}close(){this.open=false;}
  }
  const roots=new Map(),get=id=>{if(!roots.has(id))roots.set(id,new Element());return roots.get(id);};
  const old={document:globalThis.document,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,now:Date.now};const queued=[];
  globalThis.document={getElementById:get,createElement:()=>new Element(),querySelector:()=>null};
  globalThis.setTimeout=fn=>{queued.push(fn);return queued.length;};globalThis.clearTimeout=()=>{};Date.now=()=>87654;
  try{
    await import('../dist/app.mjs?binding-test');
    const rack=get('rack'),tile=rack.children[0],oldSelect=tile.onclick;oldSelect();
    const selected=get('rack').children.find(b=>b.attributes['aria-pressed']==='true'),enter=selected.onkeydown,discard=get('actions').children[0].onclick;
    enter({key:'Enter',preventDefault(){}});const after=get('events').innerHTML;assert(after.includes('你打出'));
    oldSelect();enter({key:'Enter',preventDefault(){}});discard();assert.equal(get('events').innerHTML,after);
    assert(queued.length>0);const ai=queued.at(-1);ai();const afterAI=get('events').innerHTML;assert.notEqual(afterAI,after);
    ai();assert.equal(get('events').innerHTML,afterAI);
    assert(!get('prompt').textContent.startsWith('動作未完成'));
  }finally{globalThis.document=old.document;globalThis.setTimeout=old.setTimeout;globalThis.clearTimeout=old.clearTimeout;Date.now=old.now;}
});
