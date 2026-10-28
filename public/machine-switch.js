import * as THREE from 'three';

export function createTrackSwitch({position,tangent,wood,metal,drive,sampleMain,sampleResponse,R}) {
 const group=new THREE.Group();group.name='duet-switch';group.position.set(position.x,position.y,position.z);
 const along=new THREE.Vector3(tangent.x,0,tangent.z).normalize(),side=new THREE.Vector3().crossVectors(along,new THREE.Vector3(0,1,0));
 group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(along,new THREE.Vector3(0,1,0),side));
 const inverse=group.quaternion.clone().invert();
 const local=p=>new THREE.Vector3(p.x-position.x,p.y-position.y,p.z-position.z).applyQuaternion(inverse);
 const brass=metal.clone();brass.color.setHex(0xc5a25b);brass.roughness=.35;
 const timber=wood.clone();timber.color.setHex(0xc5aa81);
 const mesh=(parent,geometry,material,name,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geometry,material);m.name=name;m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
 mesh(group,new THREE.BoxGeometry(.46,.08,.42),timber,'switch/base',-.12,-.18,-.65);
 mesh(group,new THREE.BoxGeometry(.08,position.y-.32,.08),timber,'switch/stand',-.12,-(position.y-.32)/2-.22,-.65);
 mesh(group,new THREE.CylinderGeometry(.045,.045,.38,12),brass,'switch/pivot',-.12,.03,-.65);
 const handle=new THREE.Group();handle.position.set(-.12,.22,-.65);group.add(handle);
 mesh(handle,new THREE.CylinderGeometry(.025,.025,.34,10),brass,'switch/lever-stem',0,.17,0);
 const knob=mesh(handle,new THREE.SphereGeometry(.095,16,12),timber,'switch/lever',0,.37,0);
 const at=sampleMain(.2),other=sampleResponse(.2);
 const commonSign=(other.pos.x-at.pos.x)*at.side.x+(other.pos.z-at.pos.z)*at.side.z>=0?1:-1;
 const heelSample=sampleMain(0);
 const heel=local({x:heelSample.pos.x+heelSample.side.x*commonSign*(R+.027),y:heelSample.pos.y-R-.002,z:heelSample.pos.z+heelSample.side.z*commonSign*(R+.027)});
 const profile=sample=>Array.from({length:18},(_,i)=>{
  const smp=sample(.24*i/17),p={...smp.pos};p.x+=smp.side.x*commonSign*(R+.027);p.z+=smp.side.z*commonSign*(R+.027);p.y-=R+.002;return local(p);
 });
 const profiles=[profile(sampleMain,sampleResponse),profile(sampleResponse,sampleMain)];
 const bladeGeometry=new THREE.BufferGeometry();
 const blade=mesh(group,bladeGeometry,brass,'switch/tongue');blade.userData.routeGuide=true;brass.side=THREE.DoubleSide;
 mesh(group,new THREE.CylinderGeometry(.019,.019,.32,12),brass,'switch/heel-bearing',heel.x,heel.y+.05,heel.z);
 mesh(group,new THREE.CylinderGeometry(.055,.055,.025,16),timber,'switch/heel-seat',heel.x,heel.y-.04,heel.z);
 const rod=mesh(group,new THREE.CylinderGeometry(.014,.014,1,10),brass,'switch/link');
 const throwRod=mesh(group,new THREE.CylinderGeometry(.012,.012,1,10),brass,'switch/throw-arm');
 const crank=mesh(group,new THREE.CylinderGeometry(.04,.04,.035,12),brass,'switch/crank',-.12,-.21,-.65);
 const bearing=mesh(group,new THREE.CylinderGeometry(.025,.025,.1,12),brass,'switch/throw-bearing');
 const pin=mesh(group,new THREE.SphereGeometry(.025,12,8),brass,'switch/throw-pin');
 const connect=(object,a,b)=>{object.position.copy(a).add(b).multiplyScalar(.5);const d=b.clone().sub(a);object.scale.set(1,d.length(),1);object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());};
 let last=-1,endpoints=null;
 function sync(){
  const state=drive.state(),p=state.position;if(p===last)return false;last=p;
  const t=p*p*(3-2*p),points=profiles[0].map((a,i)=>a.clone().lerp(profiles[1][i],t)),vertices=[];
  const tri=(a,b,c)=>vertices.push(...a.toArray(),...b.toArray(),...c.toArray());
  for(let i=0;i<points.length-1;i++){
   const a=points[i],b=points[i+1],n=new THREE.Vector3(b.z-a.z,0,a.x-b.x).normalize().multiplyScalar(.006);
   const A=a.clone().add(n),B=b.clone().add(n),C=B.clone().add(new THREE.Vector3(0,.23,0)),D=A.clone().add(new THREE.Vector3(0,.23,0));
   const E=a.clone().sub(n),F=b.clone().sub(n),G=F.clone().add(new THREE.Vector3(0,.23,0)),H=E.clone().add(new THREE.Vector3(0,.23,0));
   tri(A,B,C);tri(A,C,D);tri(F,E,H);tri(F,H,G);tri(D,C,G);tri(D,G,H);
  }
  const attribute=bladeGeometry.getAttribute('position');if(attribute&&attribute.array.length===vertices.length){attribute.array.set(vertices);attribute.needsUpdate=true;}else bladeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));bladeGeometry.computeVertexNormals();bladeGeometry.computeBoundingSphere();
  handle.rotation.x=-.4+t*.8;crank.rotation.y=t*.8;
  const from=new THREE.Vector3(-.12+.06*Math.sin(t*.8),-.23,-.65+.06*Math.cos(t*.8));
  const to=points.at(-1).clone();to.y-=.065;
  connect(rod,from,to);connect(throwRod,to,new THREE.Vector3(heel.x,heel.y-.065,heel.z));
  pin.position.copy(to);bearing.position.copy(to).add(new THREE.Vector3(0,.025,0));
  endpoints={from:from.toArray(),to:to.toArray()};return true;
 }
 sync();
 return {group,pickable:[knob],sync,state:()=>({...drive.state(),angle:last*.8-.4,handle:handle.rotation.x,endpoints,heel:heel.toArray(),profile:profiles[Math.round(last)].map(p=>p.toArray())})};
}
