import {stopperLift} from './machine-bucket-state.js';
import * as THREE from 'three';
export function createBucketEscapement({position,wood,metal,baseTop}){
 const group=new THREE.Group();group.name='bucket-station/escapement';group.position.set(position.x,position.y,position.z-.175);
 const brass=metal.clone();brass.color.setHex(0xb99a52);brass.roughness=.35;
 const make=(size,material,name,x,y,z=0)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(...size),material);o.name=name;o.position.set(x,y,z);o.castShadow=true;group.add(o);return o;};
 const height=position.y+.37-baseTop;
 for(const sign of [-1,1])make([.05,height,.06],wood,'bucket-station/stop-post',sign*.30,(baseTop-position.y+.37)/2);
 make([.70,.045,.07],wood,'bucket-station/stop-beam',0,.37);
 const gate=make([.65,.065,.022],brass,'bucket-station/stop-bar',0,0);
 const stems=[-1,1].map(sign=>make([.018,.32,.018],brass,'bucket-station/stop-stem',sign*.29,.16));
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 return {group,sync(elapsed){const lift=stopperLift(elapsed);gate.position.y=lift;stems.forEach(o=>o.position.y=.16+lift);},state:()=>({lift:gate.position.y})};
}
