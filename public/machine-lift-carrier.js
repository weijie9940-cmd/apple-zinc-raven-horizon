import * as THREE from 'three';

export function createLiftCarrier({index,R,wood,metal,cycle}) {
 const group=new THREE.Group();group.name='bucket/'+index;
 const brass=new THREE.MeshStandardMaterial({color:0xb99a52,metalness:.72,roughness:.32});
 wood=wood.clone();wood.color.setHex(0xc6a16b);
 const body=[],fixed=[];
 function mesh(geo,material,name,pos=[0,0,0],list=body){const o=new THREE.Mesh(geo,material);o.name=name;o.castShadow=true;o.receiveShadow=true;group.add(o);list.push({o,p:new THREE.Vector3(...pos)});return o;}
 const box=(size,mat,name,p,list)=>mesh(new THREE.BoxGeometry(...size),mat,name,p,list);
 const H=cycle.hang,floor=-H-R;
 // A continuous curved wooden shell, closed underneath and at its ends.
 const vertices=[],indices=[];
 for(let i=0;i<=24;i++){const x=-.225+i*.45/24,y=floor+.045*(x/.225)**2;for(const z of [-.23,.23])for(const d of [0,-.022])vertices.push(x,y+d,z);}
 const quad=(a,b,c,d)=>indices.push(a,b,c,a,c,d);
 for(let i=0;i<24;i++){const k=i*4,n=k+4;quad(k,k+2,n+2,n);quad(k+1,n+1,n+3,k+3);quad(k,k+4,k+5,k+1);quad(k+2,k+3,k+7,k+6);}
 quad(0,1,3,2);quad(96,98,99,97);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 mesh(geometry,wood,'bucket/curved-floor');
 for(const sign of [-1,1]){
  box([.022,.20,.46],wood,'bucket/side',[sign*.225,floor+.10,0]);
  box([.026,H+R+.015,.035],brass,'bucket/hanger',[sign*.25,-(H+R)/2,0]);
  const hinge=box([.065,.045,.045],brass,'bucket/trunnion',[sign*.25,0,0],fixed);
  hinge.userData.pivot=true;
 }
 box([.46,.20,.022],wood,'bucket/back',[0,floor+.10,-.241]);
 for(const sign of [-1,1])box([.012,.018,.49],brass,'bucket/rim',[sign*.239,floor+.20,0]);
 box([.56,.026,.035],metal,'bucket/crosshead',[0,0,0],fixed);
 box([.024,.024,cycle.z-.412],brass,'bucket/mount-axle',[0,0,(.412-cycle.z)/2],fixed);
 const door=box([.40,.18,.018],wood,'bucket/front-door',[0,0,0],[]);
 const hinge=box([.48,.014,.014],brass,'bucket/door-hinge',[0,floor-.009,.23]);
 const springGeometry=new THREE.TorusGeometry(.018,.004,6,16);springGeometry.rotateY(Math.PI/2);mesh(springGeometry,brass,'bucket/door-detent',[.238,floor-.009,.23]);
 box([.030,.025,.045],brass,'bucket/detent-stop',[.235,floor-.009,.20]);
 const followerAxle=new THREE.CylinderGeometry(.0125,.0125,.12,12);followerAxle.rotateZ(Math.PI/2);
 mesh(followerAxle,brass,'bucket/follower-axle',[-.31,0,0]);
 box([.075,.018,.018],brass,'bucket/roller-pin',[-.39,-.16,.07]);
 const tipFollower=mesh(new THREE.SphereGeometry(.012,12,8),brass,'bucket/tip-follower',[-.42,-.16,.07]);
 const doorLink=box([.25,.014,.014],brass,'bucket/door-link',[0,0,0],[]);
 const doorFollower=mesh(new THREE.SphereGeometry(.010,12,8),brass,'bucket/door-follower',[0,0,0],[]);
 box([.018,.17,.022],brass,'bucket/tip-lever',[-.36,-.085,.035]);
 // Small assembly details are baked by material/motion group: four extra
 // draw calls per carrier, rather than a separate mesh for every screw.
 const endgrain=wood.clone();endgrain.color.setHex(0xa98252);endgrain.roughness=.85;
 const recessed=new THREE.MeshStandardMaterial({color:0x705d3c,metalness:.4,roughness:.65});
 const detailParts={timber:[],brass:[],slots:[],pivots:[]};
 const part=(kind,geometry,x,y,z)=>{geometry.translate(x,y,z);detailParts[kind].push(geometry);};
 function pin(kind,radius,length,x,y,z){const g=new THREE.CylinderGeometry(radius,radius,length,12);g.rotateZ(Math.PI/2);part(kind,g,x,y,z);}
 for(const sign of [-1,1]){
  // Exposed dowel end grain at the side/back joint, outside the payload shell.
  for(const y of [floor+.055,floor+.145]){
   pin('timber',.010,.004,sign*.238,y,-.165);
   part('timber',new THREE.BoxGeometry(.024,.025,.003),sign*.214,y,-.2535);
  }
  // Slotted heads fasten the metal hanger to the wooden cheek.
  for(const y of [-.075,floor+.11,floor+.18]){
   pin('brass',.011,.004,sign*.266,y,0);
   const slot=new THREE.BoxGeometry(.001,.002,.013);slot.rotateX(Math.PI/4);
   part('slots',slot,sign*.2685,y,0);
  }
  // A physical axle passes through a holed washer and an open retaining ring.
  pin('pivots',.014,.065,sign*.268,0,0);
  const washer=new THREE.LatheGeometry([new THREE.Vector2(.016,-.003),new THREE.Vector2(.032,-.003),new THREE.Vector2(.032,.003),new THREE.Vector2(.016,.003),new THREE.Vector2(.016,-.003)],16);
  washer.rotateZ(Math.PI/2);part('pivots',washer,sign*.286,0,0);
  const clip=new THREE.TorusGeometry(.018,.003,6,18,Math.PI*1.65);clip.rotateY(Math.PI/2);
  part('pivots',clip,sign*.296,0,0);
 }
 pin('brass',.014,.014,-.246,floor-.009,.23);
 function bake(parts){
  const arrays={position:[],normal:[],uv:[]},indices=[];let offset=0;
  for(const g of parts){
   for(const name of Object.keys(arrays))arrays[name].push(...g.getAttribute(name).array);
   for(const i of g.index.array)indices.push(i+offset);
   offset+=g.getAttribute('position').count;g.dispose();
  }
  const g=new THREE.BufferGeometry();
  for(const [name,values] of Object.entries(arrays))g.setAttribute(name,new THREE.Float32BufferAttribute(values,name==='uv'?2:3));
  g.setIndex(indices);return g;
 }
 for(const [kind,material,list] of [['timber',endgrain,body],['brass',brass,body],['slots',recessed,body],['pivots',brass,fixed]]){
  const detail=mesh(bake(detailParts[kind]),material,'bucket/craft-'+kind,[0,0,0],list);detail.userData.assemblyDetail=true;
 }
 const rotation=new THREE.Quaternion(),gateRotation=new THREE.Quaternion(),axis=new THREE.Vector3(1,0,0),p=new THREE.Vector3();
 const apply=(o,point,q)=>{o.position.copy(point).applyQuaternion(q);o.position.z+=cycle.z;o.quaternion.copy(q);};
 function sync(frame,override){const pose=override||cycle.pose(frame.s);group.position.set(frame.pos.x,frame.pos.y,frame.pos.z);rotation.setFromAxisAngle(axis,pose.tilt);
  for(const {o,p} of body)apply(o,p,rotation);
  for(const {o,p} of fixed){o.position.copy(p);o.position.z+=cycle.z;o.quaternion.identity();}
  p.set(0,Math.cos(pose.door)*.09,Math.sin(pose.door)*.09).add(new THREE.Vector3(0,floor-.009,.23));
  gateRotation.setFromAxisAngle(axis,pose.tilt+pose.door);apply(door,p,rotation);door.quaternion.copy(gateRotation);
  p.set(.42,Math.cos(pose.door)*.065,Math.sin(pose.door)*.065).add(new THREE.Vector3(0,floor-.009,.23));apply(doorFollower,p,rotation);p.x=.31;apply(doorLink,p,rotation);
 }
 return {group,sync,tipFollower,doorFollower};
}
