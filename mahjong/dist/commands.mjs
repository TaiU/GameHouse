// Shared by engine and UI; a version identifies an action/response window within a round.
export function isCurrentCommand(state,command){
  return !!command&&typeof command.roundId==='string'&&Number.isSafeInteger(command.turnVersion)
    &&command.roundId===state.roundId&&command.turnVersion===state.turnVersion;
}
// Capture once at render/schedule time. Never re-stamp an old callback on invocation.
export function bindCommand(getState,command,run){
  const captured=structuredClone(command);
  return (...args)=>isCurrentCommand(getState(),captured)?run(captured,...args):false;
}
export function createCommandScheduler(getState,run,setTimer=setTimeout,clearTimer=clearTimeout){
  let timer=null,generation=0;
  const cancel=()=>{generation++;if(timer!==null)clearTimer(timer);timer=null;};
  return {cancel,schedule(command,player,delay=650){
    cancel();const ownGeneration=generation;
    const guarded=bindCommand(getState,command,a=>run(a,player));
    timer=setTimer(()=>{if(ownGeneration!==generation)return;generation++;timer=null;guarded();},delay);
  }};
}

// A newly displayed settlement must not consume the tail of the winning gesture.
// detail alone is insufficient: a second click on a NEW element can report detail=1.
export function bindSettlementButton(button,run,now=()=>performance.now(),setTimer=setTimeout){
  const readyAt=now()+1000;
  button.disabled=true;
  setTimer(()=>{button.disabled=false;},1000);
  button.onkeydown=e=>{if(e.repeat)e.preventDefault();};
  button.onclick=e=>{
    if(now()<readyAt||e?.detail>1||e?.repeat)return false;
    return run(e);
  };
}
