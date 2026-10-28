export function createDriveTour({reducedMotion=false}={}) {
 let active=false,step=0,auto=false,slow=true,elapsed=0;
 const select=n=>{step=Math.max(0,Math.min(3,Math.trunc(n)||0));elapsed=0;};
 return {
  open(n=0){active=true;auto=false;slow=true;select(n);},
  close(){active=false;auto=false;elapsed=0;},
  select(n){select(n);auto=false;},
  play(value){auto=active&&value&&!reducedMotion;elapsed=0;},
  manual(){auto=false;elapsed=0;},
  slow(value){slow=!!value;},
  tick(dt,{playing}={}){if(!active||!auto||!playing||dt<=0)return;elapsed+=dt;if(elapsed>=6){elapsed=0;if(step<3)step++;else auto=false;}},
  state:()=>({active,step,auto,slow,timeScale:active&&slow?.25:1}),
 };
}
