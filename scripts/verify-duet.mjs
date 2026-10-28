import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {checkedUrl} from './browser-guard.mjs';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(checkedUrl(process.argv[2]||'http://127.0.0.1:8084/'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__machine?.ready);
 await page.locator('#btn-play').click();await page.locator('#btn-routing').click();
 const geometry=await page.evaluate(()=>window.__machine.routeGeometry);
 assert.ok(geometry.responseLength>geometry.mainLength);
 await page.locator('[data-route="main"]').click();await page.locator('[data-count="4"]').click();
 let committed=-1;
 for(let i=0;i<600;i++){
  committed=await page.evaluate(()=>{const m=window.__machine;m.audit(.05);if(!m.getExperience().routing.counts.main)return -1;return m.getBalls().findIndex(b=>b.track===3&&b.s>=m.routeGeometry.splitS-.52&&b.s<m.routeGeometry.splitS);});
  if(committed>=0)break;
 }
 assert.ok(committed>=0,'a ball commits before entering the fork');
 await page.locator('[data-route="response"]').click();
 const continuing=await page.evaluate(id=>{window.__machine.audit(3.5);return window.__machine.getBalls()[id];},committed);
 assert.ok(continuing.track===3&&continuing.s>geometry.splitS,'switch changes only future arrivals');
 const results=[];
 for(const mode of ['main','response','alternate']){
  await page.locator(`[data-route="${mode}"]`).click();
  for(const count of [4,8,12]){
   await page.locator(`[data-count="${count}"]`).click();
   const data=await page.evaluate(()=>({audit:window.__machine.audit(300),experience:window.__machine.getExperience()}));
   assert.equal(data.audit.worldOverlaps,0,JSON.stringify({mode,count,...data.audit}));assert.equal(data.audit.nan,0);assert.equal(data.audit.overlaps,0);assert.equal(data.audit.routingRewinds,0,JSON.stringify({mode,count,...data.audit}));
   const decisions=data.experience.routing.counts;
   assert.ok(decisions.main+decisions.response>count,'fork remains active');
   if(mode==='main')assert.equal(decisions.response,0);
   if(mode==='response')assert.equal(decisions.main,0);
   if(mode==='alternate')assert.ok(decisions.main>0&&decisions.response>0&&Math.abs(decisions.main-decisions.response)<=1);
   results.push({mode,count,decisions,shows:data.experience.performance.completed});
  }
 }
 console.log(JSON.stringify({phase:'cycles',results}));
 await page.locator('[data-count="12"]').click();await page.locator('#btn-routing-close').click();await page.locator('#btn-performance').click();
 let completed=false;
 for(let i=0;i<200;i++){
  const result=await page.evaluate(()=>({audit:window.__machine.audit(3),experience:window.__machine.getExperience()}));
  assert.equal(result.audit.worldOverlaps,0);assert.equal(result.audit.routingRewinds,0,JSON.stringify(result.audit));
  if(result.experience.performance.completed>0){completed=true;break;}
 }
 assert.ok(completed,'both lanes gather and restart after the curtain call');
 await page.locator('#btn-routing').click();await page.locator('[data-route="response"]').click();
 await page.locator('[data-count="4"]').click();await page.locator('#btn-music').click();await page.waitForFunction(()=>window.__machine.getExperience().enabled);
 // Audit up to the first approach to a low key, then let actual frames strike all three.
 for(let i=0;i<400;i++){
  const near=await page.evaluate(()=>{window.__machine.audit(.25);const m=window.__machine,keys=m.getExperience().response.modules;return m.getBalls().some(b=>b.track===m.routeGeometry.responseIndex&&b.s>=keys[0].s-.8&&b.s<keys[0].s);});
  if(near)break;
  if(i===399)throw Error('No ball reaches the response piano');
 }
 await page.locator('[data-speed="2"]').click();await page.locator('#btn-play').click();
 await page.waitForFunction(()=>window.__machine.getExperience().response.modules.every(m=>m.strikes>0),null,{timeout:45000});
 assert.ok(await page.evaluate(()=>window.__machine.getExperience().strikes>0));
 await page.locator('#btn-play').click();
 await page.screenshot({path:'screenshots/duet-desktop.png'});
 // The physical hand lever cycles the selected routing mode.
 const point=await page.evaluate(async()=>{const T=await import('/vendor/three/three.module.js'),m=window.__machine,k=m.scene.getObjectByName('switch/lever');const p=k.getWorldPosition(new T.Vector3()).project(m.camera),r=m.canvas.getBoundingClientRect();return {x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};});
 await page.mouse.click(point.x,point.y);assert.equal(await page.evaluate(()=>window.__machine.getExperience().routing.mode),'alternate');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1200);
 await page.screenshot({path:'screenshots/duet-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.keyboard.press('Escape');assert.equal(await page.locator('#routing-editor').isVisible(),false);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,geometry,results,checks:['three modes','committed ball keeps its route','4/8/12 balls','fair merge','duet curtain call','three actual low-key strikes','physical lever','mobile layout'],errors}));
}finally{await browser.close();}
