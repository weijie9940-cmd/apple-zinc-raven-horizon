import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {checkedUrl} from './browser-guard.mjs';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(checkedUrl(process.argv[2]||'http://127.0.0.1:8084/'),{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.__machine?.ready);
 await page.locator('#btn-play').click();await page.locator('[data-count="8"]').click();
 const result=await page.evaluate(()=>{
  const m=window.__machine,g=m.routeGeometry,runs=Array.from({length:8},()=>({fork:0,merge:0}));
  const maximum={fork:0,merge:0},queues={fork:0,merge:0};let overlaps=0,nan=0,cruising=0,rewinds=0,maxRewind=0,rewind=null;
  for(let i=0;i<3000;i++){
   const audit=m.audit(.1);overlaps+=audit.worldOverlaps+audit.overlaps;nan+=audit.nan;rewinds+=audit.routingRewinds;if(audit.maxRoutingRewind>maxRewind){maxRewind=audit.maxRoutingRewind;rewind=audit.routingRewind;}
   if(m.getExperience().performance.phase!=='cruising'){runs.forEach(r=>{r.fork=r.merge=0;});continue;}
   cruising+=.1;let forkQueue=0,mergeQueue=0;
   m.getBalls().forEach((b,id)=>{
    const stopped=b.mode==='track'&&b.v<.05;
    const fork=stopped&&b.track===3&&b.s>g.splitS-2&&b.s<g.splitS;
    const merge=stopped&&(b.track===3&&b.s>g.joinS-2&&b.s<g.joinS||b.track===g.responseIndex&&b.s>g.responseLength-2);
    runs[id].fork=fork?runs[id].fork+.1:0;runs[id].merge=merge?runs[id].merge+.1:0;
    maximum.fork=Math.max(maximum.fork,runs[id].fork);maximum.merge=Math.max(maximum.merge,runs[id].merge);
    if(fork)forkQueue++;if(merge)mergeQueue++;
   });
   queues.fork=Math.max(queues.fork,forkQueue);queues.merge=Math.max(queues.merge,mergeQueue);
  }
  return {seconds:300,cruising,maximumStoppedSeconds:maximum,maximumQueue:queues,overlaps,nan,rewinds,maxRewind,rewind,routing:m.getExperience().routing};
 });
 console.log(JSON.stringify(result));
 assert.equal(result.overlaps,0);assert.equal(result.nan,0);assert.equal(result.rewinds,0,"routing must not move balls backwards");
 assert.ok(result.maximumStoppedSeconds.fork<=2,'eight-ball fork wait exceeds 2 seconds');
 assert.ok(result.maximumStoppedSeconds.merge<=2,'eight-ball merge wait exceeds 2 seconds');
 assert.ok(result.maximumQueue.merge<=2,'eight-ball merge builds a persistent queue');
 assert.ok(result.routing.counts.main>8&&result.routing.counts.response>8);
 // Change the requested route with twelve balls already occupying both lanes.
 await page.locator('[data-count="12"]').click();await page.locator('#btn-routing').click();
 const switches=[];
 for(const mode of ['main','response','alternate','main','response','alternate']){
  await page.locator(`[data-route="${mode}"]`).click();
  const audit=await page.evaluate(()=>window.__machine.audit(60));
  assert.equal(audit.worldOverlaps,0,JSON.stringify({mode,...audit}));assert.equal(audit.overlaps,0);
  assert.equal(audit.nan,0);assert.equal(audit.routingRewinds,0,JSON.stringify({mode,...audit}));switches.push(mode);
 }
 console.log(JSON.stringify({modeChanges:switches,balls:12,seconds:360}));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,errors}));
}finally{await browser.close();}
