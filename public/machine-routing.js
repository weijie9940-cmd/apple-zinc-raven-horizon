export function createRouteSelector() {
  let mode='alternate',next='main',last='main';
  let counts={main:0,response:0};
  return {
    setMode(value){if(['main','response','alternate'].includes(value)){mode=value;next='main';}},
    preview:()=>mode==='alternate'?next:mode,
    commit(){const choice=mode==='alternate'?next:mode;last=choice;counts[choice]++;if(mode==='alternate')next=next==='main'?'response':'main';return choice;},
    reset(){counts={main:0,response:0};next='main';last=mode==='response'?'response':'main';},
    state:()=>({mode,next:mode==='alternate'?next:mode,last,counts:{...counts}}),
  };
}

export function responseCurve(start,end,startTangent,endTangent,n=500) {
  const offset=(p,t,d)=>({x:p.x+t.x*d,y:p.y+t.y*d,z:p.z+t.z*d});
  const a=offset(start,startTangent,.8),b=offset(end,endTangent,-.8);
  const controls=[start,a,{x:start.x-1.2,y:start.y+(end.y-start.y)*.34,z:start.z-3.1},
    {x:end.x+1.2,y:start.y+(end.y-start.y)*.66,z:end.z-3.1},b,end];
  return Array.from({length:n},(_,i)=>{
    if(!i)return {...start};if(i===n-1)return {...end};
    const t=i/(n-1),work=controls.map(p=>({...p}));
    for(let level=5;level>0;level--)for(let j=0;j<level;j++)for(const axis of ['x','y','z'])work[j][axis]=work[j][axis]*(1-t)+work[j+1][axis]*t;
    return work[0];
  });
}

