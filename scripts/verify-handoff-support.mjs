import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try {
 const page=await browser.newPage();await page.goto(process.argv[2]||'http://127.0.0.1:8084/');await page.waitForFunction(()=>window.__machine?.ready);
 const r=await page.evaluate(async()=>{
  const T=await import('/vendor/three/three.module.js');const {createLiftCarrier}=await import('/machine-lift-carrier.js');
  const cycle=window.__machine.bucketCycle,mat=new T.MeshBasicMaterial(),c=createLiftCarrier({index:0,R:.16,wood:mat,metal:mat,cycle});
  const tri=new T.Triangle(),closest=new T.Vector3();let minGap=Infinity,maxSupportGap=0;
  const phases=[0,.4,2,cycle.releaseS-.4,cycle.releaseS-.2,cycle.releaseS-.1,cycle.releaseS];
  for(const s of phases){c.sync({pos:{x:0,y:0,z:0},s});c.group.updateMatrixWorld(true);const p=new T.Vector3(...Object.values(cycle.ball({x:0,y:0,z:0},s)));let support=Infinity;
   for(const o of c.group.children){const g=o.geometry,a=g.attributes.position,idx=g.index;for(let i=0;i<idx.count;i+=3){for(const[v,n]of[[tri.a,0],[tri.b,1],[tri.c,2]])v.fromBufferAttribute(a,idx.getX(i+n)).applyMatrix4(o.matrixWorld);tri.closestPointToPoint(p,closest);const gap=p.distanceTo(closest)-.16;minGap=Math.min(minGap,gap);if(['bucket/curved-floor','bucket/front-door'].includes(o.name))support=Math.min(support,gap);}}
   maxSupportGap=Math.max(maxSupportGap,support);
  }
  const m=window.__machine;m.scene.updateMatrixWorld(true);const pins=m.scene.getObjectByName('chain/pins'),matrix=new T.Matrix4(),pinPoint=new T.Vector3();let maxMountGap=0;
  for(const bucket of m.buckets){let gap=Infinity;for(let i=0;i<pins.count;i++){pins.getMatrixAt(i,matrix);pinPoint.setFromMatrixPosition(matrix);gap=Math.min(gap,Math.hypot(pinPoint.x-bucket.position.x,pinPoint.y-bucket.position.y));}maxMountGap=Math.max(maxMountGap,gap);}
  return {minGap,maxSupportGap,maxMountGap,closedWalls:c.group.children.filter(o=>['bucket/side','bucket/back','bucket/front-door'].includes(o.name)).length};
 });console.log(r);assert.ok(r.minGap>-.0001,'Bucket solids must clear their payload');assert.ok(r.maxSupportGap<.001,'Wooden floor and open door must continuously support the payload');assert.ok(r.maxMountGap<1e-6,'Mounts must follow actual chain pins');assert.equal(r.closedWalls,4);
}finally{await browser.close();}
