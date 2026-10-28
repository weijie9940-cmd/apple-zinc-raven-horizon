const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export function createBucketCycle({straight,arc,loop,hang=.26,z=.95}) {
 const upper=straight+arc,lower=2*straight+arc;
 const pickupS=lower+.5*arc,releaseS=upper+.70,angle=35*Math.PI/180;
 function pose(s){s=((s%loop)+loop)%loop;let tilt=0,door=0,roll=0;
  if(s>=upper&&s<=releaseS+1.05){
   door=Math.PI/2*smooth((s-upper)/.10);
   tilt=angle*smooth((s-upper-.10)/.30);
   roll=.40*clamp((s-upper-.40)/.30)**2;
   if(s>releaseS+1e-7){roll=0;door=Math.PI/2*(1-smooth((s-releaseS-.35)/.20));tilt=angle*(1-smooth((s-releaseS-.60)/.40));}
  }
  if(s>=lower-.35)door=Math.PI/2*smooth((s-lower+.35)/.30);
  if(s<.25)door=Math.PI/2*(1-smooth(s/.25));
  return {tilt,door,roll};
 }
 function ball(pivot,s){const {tilt,roll}=pose(s);return {x:pivot.x,y:pivot.y-hang*Math.cos(tilt)-roll*Math.sin(tilt),z:z-hang*Math.sin(tilt)+roll*Math.cos(tilt)};}
 return {pose,ball,pickupS,releaseS,preTipS:upper,hang,z,angle,loop,releaseSpeed:speed=>speed*(.80/.30+Math.sin(angle))};
}

export const loadingProgress=elapsed=>smooth((elapsed-.15)/.90);
export const stopperLift=elapsed=>elapsed==null?0:.30*smooth(elapsed/.12)*(1-smooth((elapsed-.65)/.12));
