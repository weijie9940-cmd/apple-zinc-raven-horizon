import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {checkedUrl} from './browser-guard.mjs';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage();await page.goto(checkedUrl(process.argv[2]||'http://127.0.0.1:8084/'));await page.waitForFunction(()=>window.__machine?.ready);
 const r=await page.evaluate(()=>{
  const cup=window.__machine.buckets[0],shaft=cup.getObjectByName('bucket/follower-axle'),a=shaft.geometry.attributes.position;
  let shaftRadius=0;for(let i=0;i<a.count;i++)shaftRadius=Math.max(shaftRadius,Math.hypot(a.getY(i),a.getZ(i)));
  const details=cup.children.filter(o=>o.userData.assemblyDetail);
  return {shaftRadius,washerClearance:.016-shaftRadius,clipClearance:.015-shaftRadius,meshes:details.length,allIndexed:details.every(o=>!!o.geometry.index),allFinite:details.every(o=>Array.from(o.geometry.attributes.position.array).every(Number.isFinite))};
 });console.log(r);assert.ok(r.washerClearance>.001);assert.ok(r.clipClearance>.001,'retaining ring must clear the lever shaft throughout rotation');assert.equal(r.meshes,4);assert.equal(r.allIndexed,true);assert.equal(r.allFinite,true);
}finally{await browser.close();}
