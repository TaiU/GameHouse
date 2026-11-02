import {newGame,act,observe,legalActions,playerName,seatWind,remaining,audit} from './engine.mjs';
import {typeOf,nameOf,WINDS} from './tiles.mjs';
import {faceSvg} from './faces.mjs';
import {chooseAction} from './ai.mjs';
import {bindCommand,createCommandScheduler,bindSettlementButton} from './commands.mjs';

let state=newGame(),selected=null,resultShown=0;
const scheduler=createCommandScheduler(()=>state,perform);
const $=id=>document.getElementById(id),money=n=>n.toLocaleString('en-US');
const labels={pung:'碰',openKong:'明槓',concealedKong:'暗槓',addedKong:'加槓',hu:'胡',pass:'過'};
const face=id=>faceSvg(typeOf(id));
function tile(id,cls='small'){return `<span class="tile ${cls}" role="img" aria-label="${nameOf(id)}" title="${nameOf(id)}">${face(id)}</span>`;}
const back='<span class="back" aria-hidden="true"></span>';
function renderSeat(i){
  const p=state.players[i],active=state.phase==='turn'&&state.turn===i,dealer=state.dealer===i;
  const root=$(`seat-${i}`);root.classList.toggle('active',active);
  const melds=p.melds.map(m=>`<span class="meld" aria-label="${m.concealed?'暗槓':m.kind==='chi'?'吃':m.kind==='pung'?'碰':'槓'}">${m.tiles.map(id=>m.concealed&&i!==0?back:tile(id,`small ${id===m.called?'called':''}`)).join('')}</span>`).join('');
  const flowers=p.flowers.map(id=>tile(id,'small flower')).join('');
  root.innerHTML=`<div class="seat-head"><span class="avatar ${dealer?'dealer':''}" aria-label="${WINDS[seatWind(state,i)]}風${dealer?'・莊家':''}">${WINDS[seatWind(state,i)]}</span><span class="who"><span class="seat-name">${playerName(i)}${dealer?'<i class="dealer-tag">莊</i>':''}</span><span class="score ${state.balances[i]<0?'negative':''}">${money(state.balances[i])}</span></span>${i?`<span class="count" aria-label="暗手 ${p.hand.length} 張">${back}${p.hand.length}</span>`:''}</div>
    ${i?`<div class="backs" aria-hidden="true">${p.hand.map(()=>back).join('')}</div>`:''}
    ${flowers||melds?`<div class="public-zone" aria-label="花牌與副露">${flowers?`<span class="flowers">${flowers}</span>`:''}${melds}</div>`:''}
    <div class="river" aria-label="${playerName(i)}的牌河">${p.discards.map((d,n)=>tile(d.tile,`small ${d.claimed?'claimed':''} ${state.pending?.from===i&&state.pending.tile===d.tile&&n===p.discards.length-1?'latest':''}`)).join('')}</div>`;
}
function actionButton(a,label,cls='secondary'){
  const b=document.createElement('button');b.className=cls;b.textContent=label;b.onclick=bindCommand(()=>state,a,command=>perform(command));if(a?.kind==='next')bindSettlementButton(b,b.onclick);return b;
}
function render(){
  for(let i=0;i<4;i++)renderSeat(i);
  $('round').textContent=`${WINDS[state.roundWind]}風圈 · 第 ${state.handNumber} 局${state.repeat?' · 連莊 '+state.repeat:''}`;
  const dir=(cls,i)=>`<span class="direction ${cls} ${state.turn===i&&state.phase!=='ended'?'current':''}">${WINDS[seatWind(state,i)]}</span>`;
  $('compass').innerHTML=`${dir('n',2)}${dir('w',3)}<span class="c" aria-label="可摸牌 ${remaining(state)} 張"><b>${remaining(state)}</b><small>餘牌</small></span>${dir('e',1)}${dir('s',0)}`;
  $('last-play').textContent=state.pending?`${playerName(state.pending.from)}${state.pending.kind==='rob'?'加槓':'打出'}`:state.phase==='ended'?'本局結束':`${playerName(state.turn)}行牌`;
  $('last-tile').innerHTML=state.pending?tile(state.pending.tile,'large'):'';
  const actions=legalActions(state,0),discard=actions.some(a=>a.kind==='discard');
  if(selected!==null&&!actions.some(a=>a.kind==='discard'&&a.tile===selected))selected=null;
  // The drawn tile sits apart at the end of the rack, as on a real table; engine order is untouched.
  const hand=state.players[0].hand,drawn=state.lastDraw?.player===0&&hand.includes(state.lastDraw.tile)?state.lastDraw.tile:null;
  $('rack').replaceChildren(...[...hand.filter(id=>id!==drawn),...(drawn===null?[]:[drawn])].map(id=>{
    const b=document.createElement('button');b.className=`tile ${selected===id?'selected':''} ${drawn===id?'drawn':''}`;
    b.innerHTML=face(id);b.dataset.tile=id;b.setAttribute('aria-label',`選取${nameOf(id)}`);b.setAttribute('aria-pressed',String(selected===id));b.disabled=!discard;
    const command=actions.find(a=>a.kind==='discard'&&a.tile===id);
    b.onclick=bindCommand(()=>state,command,a=>{if(selected===id){perform(a);return;}selected=id;render();document.querySelector(`#rack [data-tile="${id}"]`)?.focus({preventScroll:true});});b.onkeydown=bindCommand(()=>state,command,(a,e)=>{if(e.key==='Enter'&&selected===id){e.preventDefault();perform(a);}});
    return b;
  }));
  $('hint').disabled=!discard;
  $('hint').onclick=bindCommand(()=>state,{roundId:state.roundId,turnVersion:state.turnVersion},()=>{const a=chooseAction(observe(state,0));if(a?.kind==='discard'){selected=a.tile;render();}else if(a)$('prompt').textContent=`建議${labels[a.kind]??'應牌'}`;});
  $('prompt').textContent=state.phase==='ended'?(state.result.kind==='draw'?'流局，點數不變':'本局已結算'):discard?(selected===null?'輪到你，選一張牌':`再點一次打出 ${nameOf(selected)}`):actions.length?(state.pending.kind==='rob'?'可以搶槓胡':'可以應牌'):state.pending?'等候應牌…':`${playerName(state.turn)}思考中…`;
  const bar=$('actions');bar.replaceChildren();
  if(discard){const b=actionButton(actions.find(a=>a.kind==='discard'&&a.tile===selected),selected===null?'選一張牌':`打出 ${nameOf(selected)}`,'primary');b.disabled=selected===null;bar.append(b);}
  for(const a of actions.filter(a=>!['discard','next'].includes(a.kind))){
    const b=actionButton(a,a.kind==='hu'?(state.phase==='turn'?'自摸':'胡牌'):labels[a.kind],a.kind==='hu'?'hu':a.kind==='pass'?'pass':'secondary');
    if(a.kind==='chi'){
      b.classList.add('combo');const all=[...a.tiles,state.pending.tile].sort((x,y)=>typeOf(x)-typeOf(y));
      b.innerHTML='<span>吃</span>'+all.map(id=>tile(id)).join('');b.setAttribute('aria-label','吃 '+all.map(nameOf).join('、'));
    }else if(a.kind.includes('Kong')){const id=a.tile??a.tiles[0];b.textContent+=` ${nameOf(id)}`;}
    bar.append(b);
  }
  if(state.phase==='ended'){bar.append(actionButton(actions.find(a=>a.kind==='next'),'下一局','primary'));const b=document.createElement('button');b.className='secondary';b.textContent='結算';b.onclick=()=>showResult();bar.append(b);}
  $('event-preview').textContent=state.events.at(-1)?.text??'';
  $('events').innerHTML=state.events.map(e=>`<li>${e.text}</li>`).join('');
  if(state.phase==='ended'&&resultShown!==state.handNumber){resultShown=state.handNumber;showResult();}
}
function showResult(){
  const r=state.result,draw=r.kind==='draw';
  bindSettlementButton($('next-hand'),bindCommand(()=>state,legalActions(state,0).find(a=>a.kind==='next'),a=>perform(a)));
  bindSettlementButton($('result-close'),()=>$('settlement').close());
  $('result-body').innerHTML=`<h2 id="result-title">${draw?'流局':`${playerName(r.winner)}${r.kind==='flowers8'?'・八仙過海':r.kind==='flowers7'?'・七搶一':r.loser===null?'自摸':r.kind==='rob'?'搶槓胡':'胡牌'}`}</h2>
    <p class="result-tai">${draw?'無點數轉移':`<b>${r.tai}</b> 台`}</p>
    ${draw?'':`<div class="result-hand" aria-label="胡牌手牌">${state.players[r.winner].hand.map(id=>tile(id)).join('')}${state.players[r.winner].melds.map(m=>`<span class="meld">${m.tiles.map(id=>m.concealed&&r.winner!==0?'<span class="back" aria-label="暗槓牌背"></span>':tile(id)).join('')}</span>`).join('')}</div><div class="score-rows">${r.rows.map(row=>`<span>${row.name} ${row.tai}</span>`).join('')||'<span>合法零台胡</span>'}</div>`}
    ${r.transfers.map(t=>`<div class="transfer"><span>${playerName(t.from)} → ${playerName(t.to)}</span><b>${money(t.amount)}</b><small>底 500 ＋ ${t.tai} 台 × 200${t.rows.filter(x=>x.name.startsWith('莊家')).map(x=>' · '+x.name+' '+x.tai+' 台').join('')}</small></div>`).join('')}
    <div class="balance-grid">${state.balances.map((b,i)=>`<div class="${i===0?'me':''}">${playerName(i)}<b class="${b<0?'negative':''}">${money(b)}</b><em class="${r.delta[i]>0?'up':r.delta[i]<0?'down':''}">${r.delta[i]>0?'+':''}${money(r.delta[i])}</em></div>`).join('')}</div>
    <p class="result-note">${draw||r.winner===state.dealer?'莊家連莊':'下一家接莊'}</p>`;
  if(!$('settlement').open)$('settlement').showModal();
}
function perform(action,player=0){
  try{
    const next=act(state,player,action),errors=audit(next);if(errors.length)throw Error(errors.join('；'));
    state=next;selected=null;
    if(action.kind==='next')$('settlement').close();
    render();schedule();
  }catch(e){console.error(e);$('prompt').textContent='動作未完成：'+e.message;}
}
function schedule(){
  scheduler.cancel();
  if(state.phase==='ended')return;
  const player=state.phase==='turn'?state.turn:[1,2,3].find(i=>legalActions(state,i).length);
  if(player===0||player===undefined)return;
  const action=chooseAction(observe(state,player));
  if(action)scheduler.schedule(action,player);
}
$('rules-open').onclick=()=>$('rules').showModal();$('rules-close').onclick=()=>$('rules').close();
// A click on the backdrop (outside the dialog box) closes it, like the close button.
for(const d of [$('rules'),$('settlement')])d.addEventListener?.('click',e=>{
  const r=d.getBoundingClientRect(),outside=e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;
  if(e.target===d&&outside&&(d.id==='rules'||!$('result-close').disabled))d.close();
});

render();schedule();
