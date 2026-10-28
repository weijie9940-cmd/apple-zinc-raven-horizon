import * as THREE from 'three';

// All moving detail reads the actual drivetrain angles, never wall-clock time.
export function createDriveDetail({motor,body,plate,gears,axle,sprockets,x1,x3,y,zGear,zC,baseTop,metal,wood}) {
 const group=new THREE.Group();group.name='drive/detail';
 const brass=metal.clone();brass.color.setHex(0xb5934c);brass.roughness=.4;
 const ink=metal.clone();ink.color.setHex(0x365d64);
 const copper=metal.clone();copper.color.setHex(0xbe7d59);copper.roughness=.55;
 const mesh=(geometry,material,name,parent=group)=>{const m=new THREE.Mesh(geometry,material);m.name='drive/'+name;m.castShadow=true;parent.add(m);return m;};
 const cylinder=(r,len,material,name,parent)=>{const m=mesh(new THREE.CylinderGeometry(r,r,len,24),material,name,parent);m.rotation.x=Math.PI/2;return m;};
 const rotor=new THREE.Group();rotor.name='drive/input-rotor';rotor.position.copy(motor.position);group.add(rotor);
 cylinder(.095,.38,ink,'rotor-core',rotor);
 for(let i=0;i<6;i++){const a=i*Math.PI/3,coil=mesh(new THREE.BoxGeometry(.06,.065,.29),copper,'copper-winding',rotor);coil.position.set(Math.cos(a)*.105,Math.sin(a)*.105,0);coil.rotation.z=a;}
 const coupling=new THREE.Group();coupling.name='drive/input-coupling';coupling.position.set(x1,y,zGear+.37);group.add(coupling);
 cylinder(.082,.11,brass,'input-collar',coupling);
 const stripe=mesh(new THREE.BoxGeometry(.014,.014,.12),ink,'input-index',coupling);stripe.position.y=.081;
 // The keyed output shaft reaches both cheeks of the upper chain wheel.
 axle.geometry.dispose();axle.geometry=new THREE.CylinderGeometry(.045,.045,zC+.52-zGear,20);
 axle.position.z=(zGear+zC+.52)/2;axle.name='drive/output-shaft';
 const output=new THREE.Group();output.name='drive/output-coupling';output.position.set(x3,y,zGear+.13);group.add(output);
 cylinder(.083,.12,brass,'output-collar',output);
 const key=mesh(new THREE.BoxGeometry(.012,.012,.18),ink,'shaft-key',output);key.position.set(0,.044,.35);
 const bearingParts=[];
 for(const z of [zGear+.26,zC+.28]) {
  const ring=mesh(new THREE.TorusGeometry(.067,.019,12,28),brass,'shaft-bearing');ring.position.set(x3,y,z);bearingParts.push(ring);
  const height=y-.083-baseTop;
  const support=mesh(new THREE.BoxGeometry(.065,height,.065),wood,'bearing-foot');support.position.set(x3,baseTop+height/2,z);
  const foot=mesh(new THREE.BoxGeometry(.15,.035,.15),wood,'bearing-base');foot.position.set(x3,baseTop+.0175,z);
 }
 gears.forEach((gear,i)=>{
  const mark=mesh(new THREE.BoxGeometry(.018,.055,.008),ink,'gear-index-'+i,gear);
  mark.position.set(0,[.085,.29,.53][i],.05);
 });
 const shells=[...motor.children,plate].filter(m=>m.isMesh).map(m=>{
  m.material=m.material.clone();return {mesh:m,opacity:m.material.opacity,transparent:m.material.transparent,depthWrite:m.material.depthWrite};
 });
 body.name='drive/motor-shell';motor.userData.driveStep=0;body.userData.driveStep=0;
 let revealed=false;
 return {
  group,pickable:[body],
  targets:[[motor,rotor,coupling],[...gears],[axle,output,...bearingParts],[sprockets[0],sprockets[1],sprockets[2],sprockets[3]]],
  sync({phi1,phi3}){rotor.rotation.z=phi1;coupling.rotation.z=phi1;output.rotation.z=phi3;},
  reveal(value){if(revealed===value)return;revealed=value;for(const s of shells){s.mesh.material.opacity=value?.14:s.opacity;s.mesh.material.transparent=value||s.transparent;s.mesh.material.depthWrite=value?false:s.depthWrite;s.mesh.material.needsUpdate=true;}},
 };
}
