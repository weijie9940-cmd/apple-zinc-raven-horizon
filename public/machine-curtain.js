import * as THREE from 'three';

export function createCurtainMechanism({position,tangent,wood,metal}) {
  const group=new THREE.Group();group.name='curtain-mechanism';
  group.position.set(position.x,position.y,position.z);
  const x=new THREE.Vector3(tangent.x,0,tangent.z).normalize();
  const z=new THREE.Vector3().crossVectors(x,new THREE.Vector3(0,1,0));
  group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,new THREE.Vector3(0,1,0),z));
  const brass=metal.clone();brass.color.setHex(0xc4a15d);brass.roughness=0.32;
  const timber=wood.clone();timber.color.setHex(0xc5aa81);
  const mesh=(parent,geometry,material,name,px,py,pz)=>{
    const object=new THREE.Mesh(geometry,material);object.name=name;object.position.set(px,py,pz);
    object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;
  };
  for(const side of [-0.43,0.43]) {
    mesh(group,new THREE.BoxGeometry(0.08,position.y-0.18,0.08),timber,'curtain/post',0.22,-(position.y-0.18)/2,side);
    mesh(group,new THREE.TorusGeometry(0.075,0.018,8,16),brass,'curtain/sleeve',0.22,0,side);
  }
  const gate=new THREE.Group();gate.name='curtain/gate';group.add(gate);
  mesh(gate,new THREE.BoxGeometry(0.04,0.07,0.98),brass,'curtain/gate-bar',0.22,0,0);
  mesh(gate,new THREE.SphereGeometry(0.06,12,8),brass,'curtain/gate-handle',0.22,0,0.56);
  const bellRig=new THREE.Group();bellRig.position.set(0.22,0.42,-1.35);group.add(bellRig);
  mesh(group,new THREE.BoxGeometry(0.075,0.9,0.075),timber,'curtain/bell-post',0.22,0.3,-1.70);
  mesh(group,new THREE.BoxGeometry(0.08,0.06,0.46),timber,'curtain/bell-arm',0.22,0.75,-1.51);
  const bell=new THREE.Group();bell.name='curtain/bell';bellRig.add(bell);
  const profile=[[0.04,0.29],[0.09,0.27],[0.14,0.22],[0.16,0.13],[0.21,0.035],[0.26,0],[0.27,-0.025]].map(([a,b])=>new THREE.Vector2(a,b));
  const bellMaterial=brass.clone();bellMaterial.side=THREE.DoubleSide;
  mesh(bell,new THREE.LatheGeometry(profile,32),bellMaterial,'curtain/bell-shell',0,0,0);
  const clapper=new THREE.Group();clapper.position.y=0.21;bell.add(clapper);
  mesh(clapper,new THREE.CylinderGeometry(0.015,0.015,0.25,8),brass,'curtain/clapper-stem',0,-0.125,0);
  mesh(clapper,new THREE.SphereGeometry(0.045,12,8),brass,'curtain/clapper',0,-0.26,0);
  let opening=1,ringAge=Infinity,rings=0;
  gate.position.z=1.1;
  return {
    group,
    ring(){ringAge=0;rings++;},
    reset(){ringAge=Infinity;rings=0;opening=1;gate.position.z=1.1;bell.rotation.z=0;clapper.rotation.z=0;},
    update(dt,closed){
      opening+=((closed?0:1)-opening)*(1-Math.exp(-dt*8));gate.position.z=opening*1.1;
      ringAge+=dt;
      const swing=ringAge<2?Math.sin(ringAge*23)*Math.exp(-ringAge*2.4):0;
      bell.rotation.z=swing*0.12;clapper.rotation.z=-swing*0.65;
    },
    clearForPickup:()=>opening>0.9,
    state:()=>({opening,rings,ringAge:Number.isFinite(ringAge)?ringAge:null}),
  };
}
