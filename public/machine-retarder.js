import * as THREE from 'three';

// A continuous rubber belt transfers the ball's motion to the bearing rollers.
// Its side mounting fits inside the existing guard, leaving that guard intact.
export function createMergeRetarderView({name,end,sampleAt,otherAt,model,wood,metal,R}) {
 const group=new THREE.Group();group.name='retarder/'+name;
 const rubber=new THREE.MeshStandardMaterial({color:0x425451,roughness:.85,side:THREE.DoubleSide});
 const brass=metal.clone();brass.color.setHex(0xb69c68);brass.roughness=.4;
 const timber=wood.clone();timber.color.setHex(0xc4ac87);
 const start=end-1.25,finish=end-.015;
 const midpoint=sampleAt((start+finish)/2),other=otherAt((start+finish)/2);
 const sign=(other.pos.x-midpoint.pos.x)*midpoint.side.x+(other.pos.z-midpoint.pos.z)*midpoint.side.z>=0?-1:1;
 const point=(s,offset=R+.0195,y=0)=>{
  const p=sampleAt(s),length=Math.hypot(p.side.x,p.side.z);return new THREE.Vector3(p.pos.x+p.side.x/length*offset*sign,p.pos.y+y,p.pos.z+p.side.z/length*offset*sign);
 };
 const mesh=(geometry,material,label)=>{const m=new THREE.Mesh(geometry,material);m.name=`retarder/${name}/${label}`;m.castShadow=true;group.add(m);return m;};
 const rollers=Array.from({length:9},(_,i)=>{
  const s=start+(finish-start)*i/8;
  const roller=mesh(new THREE.CylinderGeometry(.019,.019,.09,12),brass,'roller-'+i);roller.position.copy(point(s));
  const spoke=mesh(new THREE.BoxGeometry(.036,.002,.003),rubber,'spoke-'+i);spoke.position.copy(point(s,R+.0195,.046));
  const shaft=mesh(new THREE.CylinderGeometry(.005,.005,.21,10),brass,'shaft-'+i);shaft.position.copy(point(s,R+.0195,.06));
  return {roller,spoke,s};
 });
 const beltGeometry=new THREE.BufferGeometry(),belt=mesh(beltGeometry,rubber,'belt');
 const markers=Array.from({length:8},(_,i)=>mesh(new THREE.SphereGeometry(.004,6,4),brass,'belt-rivet-'+i));
 const arms=[];
 for(const s of [start+.08,finish-.08]) {
  const post=mesh(new THREE.BoxGeometry(.035,.45,.035),timber,'support');post.position.copy(point(s,R+.11,-.005));
  const cross=mesh(new THREE.BoxGeometry(.12,.025,.035),timber,'bearing-arm');cross.position.copy(point(s,R+.061,.22));
  const direction=sampleAt(s).side;cross.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),new THREE.Vector3(direction.x,0,direction.z).normalize());
  const lever=mesh(new THREE.BoxGeometry(.015,.035,.12),brass,'brake-rocker');lever.position.copy(point(s,R+.04,.135));
  const pad=mesh(new THREE.BoxGeometry(.018,.018,.025),rubber,'brake-pad');pad.position.copy(point(s,R+.0195,.092));arms.push({lever,pad,s});
 }
 let previous='';
 function sync(){
  const state=model.state(),key=`${state.travel}:${state.pressure}`;if(key===previous)return false;previous=key;
  const positions=[],pressure=state.pressure;
  const push=(a,b,c)=>positions.push(...a.toArray(),...b.toArray(),...c.toArray());
  const quad=(a,b,c,d)=>{push(a,b,c);push(a,c,d);};
  const inner=R+.0004; // Belt stays tangent; pressure acts on the pulley brake.
  for(let i=0;i<256;i++){
   const a=start+(finish-start)*i/256,b=start+(finish-start)*(i+1)/256;
   for(const offset of [inner,R+.039]){
    const A=point(a,offset,-.045),B=point(b,offset,-.045),C=point(b,offset,.045),D=point(a,offset,.045);quad(A,B,C,D);
   }
   quad(point(a,inner,.045),point(b,inner,.045),point(b,R+.039,.045),point(a,R+.039,.045));
  }
  const attribute=beltGeometry.getAttribute('position');if(attribute&&attribute.array.length===positions.length){attribute.array.set(positions);attribute.needsUpdate=true;}else beltGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));beltGeometry.computeVertexNormals();beltGeometry.computeBoundingSphere();
  rollers.forEach(({roller,spoke},i)=>{roller.rotation.y=-state.rollers[i].angle*sign;spoke.rotation.y=roller.rotation.y;});
  markers.forEach((m,i)=>{const s=start+((i/markers.length+state.travel/(finish-start))%1)*(finish-start);m.position.copy(point(s,R+.021,.049));});
  arms.forEach(({lever,pad,s})=>{lever.rotation.z=pressure*.2;pad.position.copy(point(s,R+.0195,.092-pressure*.012));});
  return true;
 }
 sync();return {group,sync,state:()=>({...model.state(),start,finish,sign})};
}



