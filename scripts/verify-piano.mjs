import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { checkedUrl } from './browser-guard.mjs';
const browser = await chromium.launch({headless:true, ...(process.platform==='win32' ? {channel:'msedge'} : {})});
try {
  const page = await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto(checkedUrl(process.argv[2] || 'http://127.0.0.1:8084/'),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__machine?.ready);
  const state=()=>page.evaluate(()=>window.__machine.getExperience());
  assert.equal((await state()).context,'uninitialized');
  await page.locator('#btn-routing').click();await page.locator('[data-route="main"]').click();await page.locator('#btn-routing-close').click();
  await page.locator('#btn-compose').click();
  await page.locator('#btn-score-reset').click();
  assert.deepEqual((await state()).piano.notes,[0,2,4,5,4,2]);
  // All six plates can be disengaged. Real rolling balls must stay silent.
  for(let i=0;i<6;i++){
    while((await state()).piano.notes[i]!==null) await page.locator(`[data-piano-note="${i}"]`).click();
  }
  await page.locator('#btn-music').click();
  await page.waitForFunction(()=>window.__machine.getExperience().enabled);
  await page.locator('[data-speed="2"]').click();
  await page.locator('[data-count="12"]').click();
  const mutedBefore=(await state()).strikes;
  await page.waitForTimeout(6000);
  assert.equal((await state()).strikes,mutedBefore);
  assert.ok((await state()).piano.modules.every(m=>m.angle===-0.5));
  await page.locator('#btn-score-reset').click();
  await page.locator('#btn-reset').click();
  await page.waitForFunction(()=>window.__machine.getExperience().piano.modules.every(m=>m.strikes>0),null,{timeout:30000});
  assert.ok((await state()).strikes>mutedBefore);
  await page.locator('#btn-play').click();
  const frozen=(await state()).piano.modules;
  await page.waitForTimeout(400);
  assert.deepEqual((await state()).piano.modules,frozen);
  await page.locator('[data-view="piano"]').click();
  await page.waitForTimeout(1000);
  // Actual 3D picking changes the score, without using a controller test hook.
  const target=await page.evaluate(async()=>{
    const {Vector3}=await import('/vendor/three/three.module.js');
    const m=window.__machine, plate=m.scene.getObjectByName('piano/1').getObjectByName('piano/plate');
    const p=plate.getWorldPosition(new Vector3()).project(m.camera), box=m.canvas.getBoundingClientRect();
    return {x:box.x+(p.x+1)*box.width/2,y:box.y+(1-p.y)*box.height/2};
  });
  await page.mouse.click(target.x,target.y);
  assert.equal((await state()).piano.notes[0],1,'clicking the physical plate changes Do to Re');
  await page.reload({waitUntil:'domcontentloaded'}); await page.waitForFunction(()=>window.__machine?.ready);
  assert.equal((await state()).piano.notes[0],1,'composition persists after reload');
  assert.equal((await state()).enabled,false,'reload never auto-plays audio');
  for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    await page.locator('#btn-compose').click();
    await page.waitForTimeout(1200);
    const panel=await page.locator('#piano-editor').boundingBox();
    assert.ok(panel.x>=0 && panel.x+panel.width<=viewport.width);
    assert.ok(panel.y+panel.height<viewport.height-260);
    await page.screenshot({path:`screenshots/piano-editor-${viewport.width}.png`});
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#piano-editor').isVisible(),false);
  }
  await page.locator('#btn-compose').click(); await page.locator('#btn-score-reset').click();
  await page.locator('#btn-compose-close').click(); await page.locator('[data-view="wide"]').click();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,checks:['six physical hammers triggered by balls','rests disengage hammers and stay silent','paused mechanism freezes','3D plate editing','composition survives reload','desktop/mobile editor and Escape'],errors}));
} finally {await browser.close();}
