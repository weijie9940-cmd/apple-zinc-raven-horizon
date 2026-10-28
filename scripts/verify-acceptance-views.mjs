import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {checkedUrl} from './browser-guard.mjs';
const browser=await chromium.launch({headless:true,channel:'msedge'}),images=[],results=[];
try{
 for(const [label,viewport]of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,hasTouch:label==='mobile'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(checkedUrl(process.argv[2]||'http://127.0.0.1:8084/'));await page.waitForFunction(()=>window.__machine?.ready);await page.locator('#btn-play').click();
  const settle=()=>page.waitForFunction(()=>window.__machine.controls.enabled);
  const shot=async name=>{await settle();await page.waitForTimeout(150);const file=`screenshots/acceptance-${label}-${name}.png`;await page.screenshot({path:file});images.push({label:`${label} / ${name}`,file});};
  for(const view of ['wide','top','gears']){await page.locator(`[data-view="${view}"]`).click();await shot(view);assert.equal(await page.locator(`[data-view="${view}"]`).getAttribute('aria-pressed'),'true');}
  await page.locator('#btn-compose').click();await shot('piano');
  const note=await page.locator('[data-piano-note="0"]').textContent();await page.locator('[data-piano-note="0"]').click();assert.notEqual(await page.locator('[data-piano-note="0"]').textContent(),note);await page.locator('#btn-score-reset').click();await page.locator('#btn-compose-close').click();
  await page.locator('#btn-routing').click();for(const mode of ['main','response','alternate']){await page.locator(`[data-route="${mode}"]`).click();assert.equal(await page.evaluate(()=>window.__machine.getExperience().routing.mode),mode);}await shot('duet');await page.locator('#btn-routing-close').click();
  await page.locator('[data-view="curtain"]').click();await shot('curtain');
  await page.locator('#btn-drive').click();await shot('motor');await page.locator('[data-drive-step="3"]').click();await shot('lift');
  const layout=await page.evaluate(()=>{const a=document.getElementById('drive-panel').getBoundingClientRect(),v=document.getElementById('view').getBoundingClientRect();return {panelBottom:a.bottom,canvasTop:v.top,canvasHeight:v.height,overflow:document.documentElement.scrollWidth>innerWidth};});assert.equal(layout.overflow,false);if(label==='mobile')assert.ok(layout.canvasTop>=layout.panelBottom&&layout.canvasHeight>200);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#drive-panel').isVisible(),false);
  await page.locator('[data-count="12"]').click();assert.equal(await page.evaluate(()=>window.__machine.getPhase().count),12);
  for(const speed of [.5,1,2]){if(label==='mobile')await page.locator(`[data-speed="${speed}"]`).tap();else await page.locator(`[data-speed="${speed}"]`).click();assert.equal(await page.evaluate(()=>window.__machine.getPhase().speed),speed);}
  await page.locator('#btn-reset').click();assert.equal(await page.evaluate(()=>window.__machine.getExperience().performance.phase),'cruising');
  const state=await page.evaluate(()=>window.__machine.getPhase());await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>window.__machine.getPhase()),state);
  assert.deepEqual(errors,[]);results.push({label,views:8,noteEditing:true,routeControls:true,speedControls:true,count12:true,pauseAndReset:true,layout,errors});await context.close();
 }
 const sheet=await browser.newPage({viewport:{width:1440,height:1900}});
 await sheet.setContent(`<html><style>body{margin:0;padding:16px;background:#f5f2eb;font:14px sans-serif}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0;background:white;border:1px solid #ddd;padding:6px}img{width:100%;height:410px;object-fit:contain}figcaption{padding:5px;color:#283d48}</style><div class="grid">${images.map(i=>`<figure><img src="data:image/png;base64,${readFileSync(i.file).toString('base64')}"><figcaption>${i.label}</figcaption></figure>`).join('')}</div></html>`);
 await sheet.screenshot({path:'screenshots/acceptance-view-sheet.png',fullPage:true});writeFileSync('work/acceptance-views.json',JSON.stringify(results,null,2));console.log(JSON.stringify({ok:true,results}));
}finally{await browser.close();}
