// The show advances with simulation time, so pause/speed affect every cue together.
export function createPerformance() {
  let phase='cruising', elapsed=0, laps=0, completed=0, gathered=0, total=0, nextNote=0;
  const released=new Set();
  let events=[];
  const state=()=>({phase,elapsed,laps,completed,gathered,total,released:released.size,departed:[...released],nextNote});
  function start() {
    if(phase!=='cruising') return;
    phase='collecting'; elapsed=0; gathered=0; total=0; nextNote=0; released.clear(); events=[];
  }
  function cancel() {phase='cruising';elapsed=0;laps=0;gathered=0;total=0;nextNote=0;released.clear();events=[];}
  return {
    state, start, cancel,
    reset() {cancel();completed=0;},
    gateClosed:()=>phase==='collecting'||phase==='overture',
    driveFactor:()=>phase==='overture'?Math.max(0,1-elapsed/0.8):1,
    pickup(id) {
      if(phase==='cruising'&&id===0) {laps++;if(laps>=2)start();}
      else if(phase==='releasing') {
        released.add(id);
        if(released.size===total) {phase='encore';elapsed=0;events.push({type:'bell'});}
      }
    },
    tick(dt,settled,count) {
      if(phase==='cruising') return;
      elapsed+=dt;
      if(phase==='collecting') {
        gathered=settled;total=count;
        if(count>0&&settled===count) {phase='overture';elapsed=0;}
      } else if(phase==='overture') {
        while(nextNote<6&&elapsed>=0.8+nextNote*0.65) events.push({type:'note',index:nextNote++});
        if(elapsed>=5.5) {phase='releasing';elapsed=0;}
      } else if(phase==='encore'&&elapsed>=2) {
        completed++;cancel();
      }
    },
    takeEvents() {const pending=events;events=[];return pending;},
  };
}
