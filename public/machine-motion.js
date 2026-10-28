const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};

// Distance from the upper pre-tip station; ease in before the fixed guide,
// remain slow through handoff, and recover only after the cup is level.
export function tippingFactor(distance){
 return 1-.28*smooth((distance+.28)/.28)*(1-smooth((distance-1.10)/.65));
}

export function createMotionGovernor(){
 let velocity=0;
 return {
  value:()=>velocity,
  reset:()=>{velocity=0;},
  step(dt,{base,performance=1,loaded=0,tip=1,stopDistance=Infinity}){
   const target=Math.max(0,base*performance*Math.max(.9,1-.03*loaded)*tip);
   const braking=Math.sqrt(2*.9*Math.max(0,stopDistance));
   const goal=Math.min(target,braking);
   const change=(goal>velocity?1.5:.9)*Math.max(0,dt);
   velocity=Math.min(braking,velocity+Math.max(-change,Math.min(change,goal-velocity)));
   return velocity;
  },
 };
}
