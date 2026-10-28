import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {checkedUrl} from './browser-guard.mjs';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{const page=await browser.newPage();await page.goto(checkedUrl(process.argv[2]||'http://127.0.0.1:8084/'));await page.waitForFunction(()=>window.__machine?.ready);
 const r=await page.evaluate(async()=>{
  const T=await import('/vendor/three/three.module.js'),m=window.__machine,meshes=[];m.scene.updateMatrixWorld(true);m.scene.traverse(o=>{if(o.isMesh&&(o.name.startsWith('channel/')||o.name.startsWith('tube/')))meshes.push(o);});
  const ray=new T.Raycaster(),holes=[];let count=0,maxSideY=0,minUpY=1,minGap=Infinity,maxFloorGap=-Infinity;
  for(const tr of m.channelSections())for(const p of tr.sections){
   if(tr.name==='chute'?p.s<tr.total-.65:p.s>.80)continue;
   maxSideY=Math.max(maxSideY,Math.abs(p.side.y));minUpY=Math.min(minUpY,p.up.y);
   const origin=new T.Vector3(...Object.values(p.center)),up=new T.Vector3(...Object.values(p.up)),side=new T.Vector3(...Object.values(p.side));
   // Probe just inside each open seam to avoid edge-only triangle precision.
   if(p.s===0||p.s===tr.total)origin.addScaledVector(new T.Vector3(...Object.values(p.tangent)),p.s===0?.0001:-.0001);
   const probes=[...[-.14,-.07,0,.07,.14].map(offset=>['floor',up.clone().negate(),offset]),['left',side.clone().negate(),0],['right',side,0]];
   for(const [key,direction,offset]of probes){
    ray.set(origin.clone().addScaledVector(side,offset),direction);ray.near=0;ray.far=.30;
    const hits=ray.intersectObjects(meshes,false),hit=key==='floor'?hits.find(h=>h.face.normal.clone().transformDirection(h.object.matrixWorld).dot(up)>.5):hits[0],d=hit?.distance;
    const minimum=key==='floor'?Math.sqrt(.16**2-offset**2)-.001:.159;
    if(d===undefined||d>.211||d<minimum)holes.push({track:tr.name,s:p.s,key,offset,d:d??null});
    if(d!==undefined){if(offset===0)minGap=Math.min(minGap,d-.16);if(key==='floor'&&offset===0)maxFloorGap=Math.max(maxFloorGap,d-.16);}count++;
   }
  }
  return {count,maxSideY,minUpY,minGap,maxFloorGap,holes};
 });console.log(JSON.stringify(r));assert.ok(r.maxSideY<1e-5,'gravity-supported open channels must have horizontal side axes');assert.ok(r.minUpY>.5);assert.deepEqual(r.holes,[],'floor and both walls must physically enclose the marked seam');assert.ok(r.maxFloorGap<.012,'floor must support the ball within allowance');
}finally{await browser.close();}
