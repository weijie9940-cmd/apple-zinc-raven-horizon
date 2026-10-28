export function createSwitchDrive({duration=.3}={}) {
 let position=0,requested='main',locked=false;
 const value=route=>route==='response'?1:0;
 return {
  request(route){requested=route;},
  tick(dt,options={}){locked=!!options.locked;if(locked||dt<=0)return;const delta=value(requested)-position;position+=Math.sign(delta)*Math.min(Math.abs(delta),dt/duration);},
  ready:route=>Math.abs(position-value(route))<1e-6,
  reset(route='main'){position=value(route);requested=route;locked=false;},
  state:()=>({position,route:position<.5?'main':'response',target:requested,locked,ready:Math.abs(position-value(requested))<1e-6}),
 };
}

export function createMergeRetarder({rollerCount=9,radius=.019}={}) {
 let pressure=0,travel=0,contactDistance=null,baseTravel=0;
 let contacts=new Map(),limits=new Map();
 return {
  beginStep(){pressure=0;contacts.clear();limits.clear();contactDistance=null;baseTravel=travel;},
  limit({id,freeSpeed,targetSpeed,dt}){
   const v=Math.max(0,Math.min(freeSpeed,targetSpeed));
   const force=dt>0?Math.max(0,Math.min(1,(freeSpeed-v)/Math.max(.025,freeSpeed))):0;
   pressure=Math.max(pressure,force);limits.set(id,{v,pressure:force});return {v,pressure:force};
  },
  contact({id,distance,dt}){
   if(dt<=0||distance<=0)return;
   contacts.set(id,distance);contactDistance=Math.min(...contacts.values());travel=baseTravel+contactDistance;
  },
  reset(){pressure=0;travel=0;contactDistance=null;contacts.clear();limits.clear();baseTravel=0;},
  state:()=>({pressure,travel,contacts:contacts.size,limits:[...limits.entries()].map(([id,s])=>({id,...s})),rollers:Array.from({length:rollerCount},()=>({angle:travel/radius}))}),
 };
}
export function trackTravel(previous,current,{lengths,splitS,joinS,responseIndex}) {
 if(!previous)return null;
 if(previous.track===current.track)return Math.max(0,current.s-previous.s);
 if(previous.track===3&&current.track===responseIndex)return Math.max(0,splitS-previous.s+current.s);
 if(previous.track===responseIndex&&current.track===3)return Math.max(0,lengths[responseIndex]-previous.s+current.s-joinS);
 return Math.max(0,lengths[previous.track]-previous.s+current.s);
}

