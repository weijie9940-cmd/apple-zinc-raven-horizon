import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { checkedUrl } from './browser-guard.mjs';
const browser = await chromium.launch({headless:true, ...(process.platform === 'win32' ? {channel:'msedge'} : {})});
try {
  const page = await browser.newPage({viewport:{width:1280,height:800}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(checkedUrl(process.argv[2] || 'http://127.0.0.1:8084/'), {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.__machine?.ready);
  assert.equal(await page.evaluate(() => window.__machine.getExperience().context), 'uninitialized');
  await page.locator('#btn-music').click();
  await page.waitForFunction(() => window.__machine.getExperience().enabled);
  await page.waitForFunction(() => window.__machine.getExperience().strikes > 0, null, {timeout:30000});
  await page.locator('#btn-play').click();
  const strikes = await page.evaluate(() => window.__machine.getExperience().strikes);
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.__machine.getExperience().strikes), strikes);
  await page.locator('#btn-music').click();
  assert.equal(await page.evaluate(() => window.__machine.getExperience().enabled), false);
  for (const viewport of [{width:1280,height:800}, {width:390,height:844}]) {
    await page.setViewportSize(viewport);
    await page.locator('#btn-follow').click();
    await page.waitForTimeout(1800);
    assert.equal(await page.evaluate(() => window.__machine.getExperience().following), true);
    const projection = await page.evaluate(async () => {
      const {Vector3} = await import('/vendor/three/three.module.js');
      const m = window.__machine, b = m.ballXYZ()[0];
      const p = new Vector3(b.x,b.y,b.z).project(m.camera);
      return {x:p.x, y:p.y};
    });
    assert.ok(Math.abs(projection.x)<0.3 && Math.abs(projection.y)<0.3, JSON.stringify(projection));
    await page.screenshot({path:`screenshots/music-follow-${viewport.width}.png`});
    const box = await page.locator('#view').boundingBox();
    await page.mouse.move(box.x+box.width/2, box.y+box.height/2);
    await page.mouse.down(); await page.mouse.move(box.x+box.width/2+30,box.y+box.height/2+10); await page.mouse.up();
    assert.equal(await page.evaluate(() => window.__machine.getExperience().following), false);
    await page.locator('#btn-follow').click();
    await page.locator('[data-view="wide"]').click();
    assert.equal(await page.evaluate(() => window.__machine.getExperience().following), false);
    await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({path:`screenshots/music-wide-${viewport.width}.png`});
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ok:true, sound:'user-activated; actual crossing; pause and mute', follow:'centered desktop/mobile; drag and preset exit',errors}));
} finally { await browser.close(); }
