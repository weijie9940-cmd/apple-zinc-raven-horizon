import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage();await page.goto(process.argv[2]||'http://127.0.0.1:8084/');await page.waitForFunction(()=>window.__machine?.ready);await page.locator('#btn-play').click();await page.locator('#btn-reset').click();
 const r=await page.evaluate(async()=>{
  const T=await import('/vendor/three/three.module.js'),m=window.__machine,triangle=new T.Triangle(),nearest=new T.Vector3();
  const solids=[];m.scene.traverse(o=>solids.push(o));const tracks=m.camDefinitions.map(cam=>{const mesh=solids.find(o=>o.name==='bucket-cam/'+cam.name&&o.userData.camWorking),g=mesh.geometry,a=g.attributes.position,idx=g.index,triangles=[];for(let i=0;i<idx.count;i+=3){const vs=[0,1,2].map(n=>new T.Vector3().fromBufferAttribute(a,idx.getX(i+n)));triangles.push({vs,box:new T.Box3().setFromPoints(vs)});}return {...cam,mesh,triangles};});
  let minimum=Infinity,maximum=-Infinity,samples=0,waits=0,loads=0,worst=null;
  for(let i=0;i<900;i++){m.audit(1/30);m.scene.updateMatrixWorld(true);const states=m.bucketStates();
   for(let bi=0;bi<states.length;bi++){const state=states[bi];for(const cam of tracks){if(state.s<cam.start+.01||state.s>cam.end-.01)continue;const p=m.buckets[bi].getObjectByName(cam.key==='tipFollower'?'bucket/tip-follower':'bucket/door-follower').getWorldPosition(new T.Vector3());let gap=Infinity;for(const t of cam.triangles){if(t.box.distanceToPoint(p)>cam.radius+.004)continue;triangle.set(...t.vs);triangle.closestPointToPoint(p,nearest);gap=Math.min(gap,nearest.distanceTo(p)-cam.radius);}minimum=Math.min(minimum,gap);if(gap>maximum){maximum=gap;worst={cam:cam.name,s:state.s,gap};}samples++;}}
   const station=m.stationState();if(station.waiting!==null){const p=states[station.waiting].pose;if(p.tilt||p.door||p.roll)throw Error('Receiver wait must keep the bucket closed and level');waits++;}
   if(m.loadingState())loads++;
  }
  const posts=solids.filter(o=>o.name.startsWith('bucket-cam/')&&o.name.endsWith('/post')).length;
  return {minimum,maximum,samples,waits,loads,posts,worst};
 });console.log(r);assert.ok(r.samples>100);assert.ok(r.minimum>-.0005);assert.ok(r.maximum<.0015);assert.ok(r.posts>=3);assert.ok(r.loads>0);
}finally{await browser.close();}
