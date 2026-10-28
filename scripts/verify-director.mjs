import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {checkedUrl} from './browser-guard.mjs';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const url=checkedUrl(process.argv[2]||'http://127.0.0.1:8084/');
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__machine?.ready);
 await page.locator('#btn-play').click();
 const state=()=>page.evaluate(()=>window.__machine.getExperience());
 assert.equal((await state()).director.enabled,false);
 await page.locator('#btn-performance').click();
 assert.equal((await state()).director.enabled,false,'ordinary performance does not take over the camera');
 assert.equal(await page.locator('#arrival-dots i').count(),8);
 assert.ok(Number(await page.locator('#arrival-progress').getAttribute('aria-valuenow'))>0);
 await page.locator('#btn-watch').click();
 await page.waitForFunction(()=>window.__machine.getExperience().director.shot?.kind==='traveller');
 const view=await page.locator('#view').boundingBox();
 await page.mouse.move(view.x+view.width/2,view.y+view.height/2);
 await page.mouse.down();await page.mouse.move(view.x+view.width/2+45,view.y+view.height/2+15);await page.mouse.up();
 assert.equal((await state()).director.enabled,false,'dragging during the opening transition exits immediately');
 assert.equal((await state()).performance.phase,'collecting','exiting the camera does not cancel the show');
 await page.locator('#btn-reset').click();await page.locator('[data-count="4"]').click();await page.waitForTimeout(1000);
 const origin=await page.evaluate(()=>({pos:window.__machine.camera.position.toArray(),target:window.__machine.controls.target.toArray()}));
 await page.locator('#btn-watch').click();
 await page.evaluate(()=>window.__machine.audit(6));
 await page.waitForFunction(()=>window.__machine.getExperience().director.shot?.kind==='wide');
 await page.evaluate(()=>window.__machine.audit(6));
 await page.waitForFunction(()=>window.__machine.getExperience().director.shot?.kind==='traveller');
 let collected=false;
 for(let i=0;i<300;i++){
  if((await state()).performance.phase==='overture'){collected=true;break;}
  await page.evaluate(()=>window.__machine.audit(.25));
 }
 assert.ok(collected,'all balls reach the queue');
 await page.waitForFunction(()=>window.__machine.getExperience().director.shot?.kind==='piano');
 await page.waitForTimeout(1400);
 assert.equal((await state()).arrival.queued,4);
 assert.ok((await page.locator('#arrival-summary').textContent()).includes('空拍保留'));
 await page.screenshot({path:'screenshots/director-piano-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1400);
 const card=await page.locator('#performance-card').boundingBox(),canvas=await page.locator('#view').boundingBox();
 assert.ok(card.y+card.height<=canvas.y+2,JSON.stringify({card,canvas}));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'screenshots/director-piano-mobile.png'});
 await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(1400);
 await page.evaluate(()=>window.__machine.audit(5.5));
 await page.waitForFunction(()=>window.__machine.getExperience().director.shot?.kind==='curtain');
 await page.waitForTimeout(1400);
 await page.screenshot({path:'screenshots/director-release.png'});
 let bell=false;
 for(let i=0;i<400;i++){
  if((await state()).performance.phase==='encore'){bell=true;break;}
  await page.evaluate(()=>window.__machine.audit(.1));
 }
 assert.ok(bell);
 await page.evaluate(()=>window.__machine.audit(2.1));
 await page.waitForFunction(()=>!window.__machine.getExperience().director.enabled);await page.waitForTimeout(1400);
 const returned=await page.evaluate(()=>({pos:window.__machine.camera.position.toArray(),target:window.__machine.controls.target.toArray()}));
 assert.ok(Math.hypot(...returned.pos.map((v,i)=>v-origin.pos[i]))<0.02,'restore original camera');
 assert.ok(Math.hypot(...returned.target.map((v,i)=>v-origin.target[i]))<0.02,'restore original orbit target');
 for(const action of ['preset','escape','follow']){
  await page.locator('#btn-watch').click();await page.waitForTimeout(100);
  if(action==='preset')await page.locator('[data-view="top"]').click();
  if(action==='escape')await page.keyboard.press('Escape');
  if(action==='follow')await page.locator('#btn-follow').click();
  assert.equal((await state()).director.enabled,false,action+' takes control');
  await page.locator('#btn-reset').click();await page.waitForTimeout(900);
 }
 assert.equal((await state()).context,'uninitialized','watching never opts into sound');
 assert.deepEqual(errors,[]);
 const reduced=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await reduced.goto(url,{waitUntil:'domcontentloaded'});await reduced.waitForFunction(()=>window.__machine?.ready);
 await reduced.locator('#btn-watch').click();await reduced.waitForFunction(()=>window.__machine.getExperience().director.shot?.kind==='wide');
 const before=await reduced.evaluate(()=>window.__machine.camera.position.toArray());await reduced.waitForTimeout(500);
 assert.deepEqual(await reduced.evaluate(()=>window.__machine.camera.position.toArray()),before);
 console.log(JSON.stringify({ok:true,checks:['opt-in camera','per-ball progress','drag during transitions','phase shots','restore previous view','manual controls and Escape','mobile layout','reduced motion','sound stays off'],errors}));
}finally{await browser.close();}
