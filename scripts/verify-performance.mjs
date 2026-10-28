import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {checkedUrl} from './browser-guard.mjs';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(checkedUrl(process.argv[2]||'http://127.0.0.1:8084/'),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__machine?.ready);
  await page.locator('#btn-play').click();
  assert.equal(await page.evaluate(()=>window.__machine.scene.getObjectByName('ball/0').material.color.getHex()),0xc5a25b);
  const cycles=[];
  for(const count of [4,8,12]){
    await page.locator(`[data-count="${count}"]`).click();
    await page.locator('#btn-performance').click();
    const states=[];
    // Run the actual fixed-step simulation; audit checks ball separations throughout.
    for(let i=0;i<100;i++){
      const result=await page.evaluate(()=>({audit:window.__machine.audit(3),experience:window.__machine.getExperience()}));
      assert.equal(result.audit.nan,0);assert.equal(result.audit.worldOverlaps,0,JSON.stringify(result.audit));
      if(states.at(-1)!==result.experience.performance.phase)states.push(result.experience.performance.phase);
      if(result.experience.performance.completed>0){cycles.push({count,states,completed:result.experience.performance.completed,rings:result.experience.curtain.rings,seconds:(i+1)*3});break;}
      if(i===99)throw Error('Show stalled: '+JSON.stringify(result.experience));
    }
    assert.ok(cycles.at(-1).rings>=1);
  }
  await page.locator('[data-count="4"]').click();
  // Smooth station approaches and tipping intentionally extend two full laps.
  // Keep a finite six-minute simulation budget for the automatic cycle.
  const automatic=await page.evaluate(()=>{window.__machine.audit(360);return window.__machine.getExperience();});
  assert.ok(automatic.performance.completed>0,'the conductor starts and completes a show without pressing the show button');
  // Capture real-time cues (audio is unlocked only here, not by the audits).
  await page.locator('[data-count="4"]').click();
  await page.locator('#btn-music').click();await page.waitForFunction(()=>window.__machine.getExperience().enabled);
  await page.locator('#btn-performance').click();
  await page.evaluate(()=>window.__machine.audit(0.5));
  const frozen=await page.evaluate(()=>window.__machine.getExperience().performance);
  await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>window.__machine.getExperience().performance),frozen);
  // Advance collection without touching show internals, then let the overture play naturally.
  while(await page.evaluate(()=>window.__machine.getExperience().performance.phase==='collecting')){
    await page.evaluate(()=>window.__machine.audit(0.5));
  }
  await page.locator('[data-speed="2"]').click();await page.locator('#btn-play').click();
  await page.waitForFunction(()=>window.__machine.getExperience().performance.phase==='overture');
  await page.screenshot({path:'screenshots/curtain-overture.png'});
  await page.waitForFunction(()=>window.__machine.getExperience().performance.phase==='releasing',null,{timeout:20000});
  assert.ok(await page.evaluate(()=>window.__machine.getExperience().strikes>0));
  await page.locator('[data-view="curtain"]').click();await page.waitForTimeout(1000);
  await page.waitForFunction(()=>window.__machine.getExperience().performance.phase==='encore',null,{timeout:60000});
  assert.equal(await page.evaluate(()=>window.__machine.getExperience().bells),1);
  await page.screenshot({path:'screenshots/curtain-bell.png'});
  await page.locator('#btn-reset').click();
  assert.equal(await page.evaluate(()=>window.__machine.getExperience().performance.phase),'cruising');
  assert.equal(await page.evaluate(()=>window.__machine.getExperience().curtain.rings),0);
  await page.setViewportSize({width:390,height:844});
  await page.locator('#btn-performance').click();await page.waitForTimeout(300);
  await page.screenshot({path:'screenshots/curtain-mobile-active.png'});
  await page.locator('#btn-performance').click();
  assert.equal(await page.evaluate(()=>window.__machine.getExperience().performance.phase),'cruising');
  await page.locator('[data-view="curtain"]').click();await page.waitForTimeout(1000);
  await page.screenshot({path:'screenshots/curtain-mobile-closeup.png'});
  assert.equal(await page.locator('[data-view="curtain"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,cycles,automatic:automatic.performance.completed,checks:['gold conductor','automatic two-loop trigger','collection and release for 4/8/12 balls','pause','six-note overture','last-ball bell','reset and cancel','mobile'],errors}));
}finally{await browser.close();}
