import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {checkedUrl} from './browser-guard.mjs';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(checkedUrl(process.argv[2]||'http://127.0.0.1:8084/'),{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.__machine?.ready);
 await page.locator('#btn-play').click();await page.locator('#btn-routing').click();
 await page.locator('[data-route="main"]').click();await page.locator('[data-count="8"]').click();
 await page.locator('[data-route="response"]').click();
 const before=await page.evaluate(()=>window.__machine.getExperience().mechanisms);
 await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>window.__machine.getExperience().mechanisms),before,'paused mechanisms must not animate');
 const half=await page.evaluate(()=>{window.__machine.audit(.15);return window.__machine.getExperience().mechanisms.switch;});
 assert.ok(half.position>0&&half.position<1);assert.equal(half.ready,false);
 await page.evaluate(()=>window.__machine.audit(.2));
 assert.equal(await page.evaluate(()=>window.__machine.getExperience().mechanisms.switch.ready),true);
 const geometry=[];
 for(const mode of ['main','response']){
  await page.locator(`[data-route="${mode}"]`).click();await page.locator('[data-count="8"]').click();
  geometry.push(await page.evaluate(async mode=>{
   const T=await import('/vendor/three/three.module.js'),m=window.__machine,blade=m.scene.getObjectByName('switch/tongue');m.scene.updateMatrixWorld(true);
   const tri=new T.Triangle(),closest=new T.Vector3(),g=blade.geometry.clone();g.applyMatrix4(blade.matrixWorld);const a=g.attributes.position;let gap=Infinity;
   const distance=p=>{let min=Infinity;for(let i=0;i<a.count;i+=3){tri.a.fromBufferAttribute(a,i);tri.b.fromBufferAttribute(a,i+1);tri.c.fromBufferAttribute(a,i+2);tri.closestPointToPoint(p,closest);min=Math.min(min,p.distanceTo(closest));}return min-m.R;};
   for(const p of m.mechanismPaths()[mode])gap=Math.min(gap,distance(new T.Vector3(p.x,p.y,p.z)));
   g.dispose();return {mode,gap};
  },mode));
 }
 assert.ok(geometry.every(g=>g.gap>=-.0001),JSON.stringify(geometry));
 await page.locator('[data-route="alternate"]').click();await page.locator('[data-count="8"]').click();
 const motion=await page.evaluate(async()=>{
  const T=await import('/vendor/three/three.module.js'),m=window.__machine,tri=new T.Triangle(),closest=new T.Vector3();let hits=0,braking=0,travel=0,violations=0,contactChecks=0,maxContactGap=-Infinity,minContactGap=Infinity,rotationErrors=0;
  for(let n=0;n<2400;n++){
   m.audit(.025);const e=m.getExperience(),drive=e.mechanisms.switch;
   if(e.mechanisms.retarders.main.pressure>0||e.mechanisms.retarders.response.pressure>0)braking++;
   travel=Math.max(travel,e.mechanisms.retarders.main.travel,e.mechanisms.retarders.response.travel);
   const balls=m.getBalls(),xyz=m.ballXYZ(),blade=m.scene.getObjectByName('switch/tongue');m.scene.updateMatrixWorld(true);
   if(n%24===0)for(const lane of ['main','response']){
    const state=e.mechanisms.retarders[lane],roller=m.scene.getObjectByName(`retarder/${lane}/roller-0`);
    if(state.travel>0&&Math.abs(roller.rotation.y+state.rollers[0].angle*state.sign)>1e-6)rotationErrors++;
    const belt=m.scene.getObjectByName(`retarder/${lane}/belt`),geometry=belt.geometry,attr=geometry.attributes.position;
    balls.forEach((b,id)=>{
     if(b.mode!=='track'||b.track!==(lane==='main'?3:m.routeGeometry.responseIndex)||b.s<state.start+.02||b.s>state.finish-.02)return;
     const p=new T.Vector3(xyz[id].x,xyz[id].y,xyz[id].z).applyMatrix4(belt.matrixWorld.clone().invert());let d=Infinity;
     for(let j=0;j<attr.count;j+=3){tri.a.fromBufferAttribute(attr,j);tri.b.fromBufferAttribute(attr,j+1);tri.c.fromBufferAttribute(attr,j+2);tri.closestPointToPoint(p,closest);d=Math.min(d,p.distanceTo(closest));}
     const gap=d-m.R;contactChecks++;maxContactGap=Math.max(maxContactGap,gap);minContactGap=Math.min(minContactGap,gap);
    });
   }
   const g=blade.geometry,a=g.attributes.position;
   balls.forEach((b,id)=>{
    if(b.mode!=='track'||!(b.track===3&&Math.abs(b.s-m.routeGeometry.splitS)<.8||b.track===m.routeGeometry.responseIndex&&b.s<.8))return;
    const p=new T.Vector3(xyz[id].x,xyz[id].y,xyz[id].z).applyMatrix4(blade.matrixWorld.clone().invert());let min=Infinity;
    for(let i=0;i<a.count;i+=3){tri.a.fromBufferAttribute(a,i);tri.b.fromBufferAttribute(a,i+1);tri.c.fromBufferAttribute(a,i+2);tri.closestPointToPoint(p,closest);min=Math.min(min,p.distanceTo(closest));}
    if(min<m.R-.0001)hits++;
    if(b.track===3&&b.s>=m.routeGeometry.splitS-.2&&b.s<m.routeGeometry.splitS+.2&&!drive.ready)violations++;
   });
  }
  return {hits,braking,travel,violations,contactChecks,maxContactGap,minContactGap,rotationErrors};
 });
 assert.equal(motion.rotationErrors,0,JSON.stringify(motion));assert.ok(motion.contactChecks>0&&motion.maxContactGap<=.0005&&motion.minContactGap>=-.0001,JSON.stringify(motion));
 assert.equal(motion.hits,0,JSON.stringify(motion));assert.equal(motion.violations,0,JSON.stringify(motion));assert.ok(motion.travel>0);assert.ok(motion.braking>0,'real merge conflict must actuate a brake');
 await page.screenshot({path:'screenshots/linkage-closeup.png'});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(800);await page.screenshot({path:'screenshots/linkage-closeup-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,geometry,motion,errors}));
}finally{await browser.close();}
