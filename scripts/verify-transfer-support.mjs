import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {checkedUrl} from './browser-guard.mjs';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{const page=await browser.newPage();await page.goto(checkedUrl(process.argv[2]||'http://127.0.0.1:8084/'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__machine?.ready);await page.locator('#btn-play').click();await page.locator('#btn-reset').click();
 const r=await page.evaluate(async()=>{
  const T=await import('/vendor/three/three.module.js'),m=window.__machine,staticMeshes=[];m.scene.updateMatrixWorld(true);
  m.scene.traverse(o=>{if(o.isMesh&&o.name.startsWith('channel/'))staticMeshes.push(o);});
  const tri=new T.Triangle(),q=new T.Vector3(),normal=new T.Vector3(),box=new T.Box3(),failures=[];let loadingChecks=0,unloadingChecks=0,maxGap=0;
  for(let i=0;i<3600;i++){
   m.audit(1/120);m.scene.updateMatrixWorld(true);const load=m.loadingState(),states=m.getBalls(),xyz=m.ballXYZ();
   states.forEach((b,id)=>{
    const loading=load&&b.mode==='carried'&&b.bucket===load.bucket&&load.elapsed>=.15;
    const unloading=b.mode==='track'&&b.track===5&&b.s<.07;
    if(!loading&&!unloading)return;
    const p=new T.Vector3(...Object.values(xyz[id]));let gap=Infinity;
    const parts=[...staticMeshes,...m.buckets.flatMap(g=>g.children.filter(o=>['bucket/curved-floor','bucket/front-door'].includes(o.name)))];
    for(const o of parts){box.setFromObject(o);if(box.distanceToPoint(p)>m.R+.025)continue;const a=o.geometry.attributes.position,idx=o.geometry.index;
     for(let j=0;j<idx.count;j+=3){for(const[v,n]of[[tri.a,0],[tri.b,1],[tri.c,2]])v.fromBufferAttribute(a,idx.getX(j+n)).applyMatrix4(o.matrixWorld);tri.getNormal(normal);if(normal.y<.1)continue;tri.closestPointToPoint(p,q);if(q.y>p.y)continue;gap=Math.min(gap,p.distanceTo(q)-m.R);}
    }
    if(loading)loadingChecks++;else unloadingChecks++;maxGap=Math.max(maxGap,gap);if(gap>.02||gap<-.001)failures.push({time:i/120,loading:!!loading,id,s:b.s,gap:Number.isFinite(gap)?gap:null});
   });
  }return {loadingChecks,unloadingChecks,maxGap,failures};
 });console.log(JSON.stringify(r));assert.ok(r.loadingChecks>100);assert.ok(r.unloadingChecks>3);assert.deepEqual(r.failures,[],'actual moving transfers must remain supported');
}finally{await browser.close();}
