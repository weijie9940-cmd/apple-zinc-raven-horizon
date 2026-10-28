import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {checkedUrl} from './browser-guard.mjs';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const Audio=window.AudioContext;
  window.AudioContext=class extends Audio{constructor(...args){super(...args);window.__testContext=this;const connect=AudioNode.prototype.connect;const ctx=this;
   AudioNode.prototype.connect=function(destination,...rest){if(destination===ctx.destination&&!window.__testAnalyser){const a=ctx.createAnalyser();a.fftSize=2048;connect.call(this,a);window.__testAnalyser=a;}return connect.call(this,destination,...rest);};
  }};
 });
 await page.goto(checkedUrl(process.argv[2]||'http://127.0.0.1:8084/'));await page.waitForFunction(()=>window.__machine?.ready);
 assert.equal(await page.evaluate(()=>window.__machine.getExperience().context),'uninitialized');
 await page.locator('#btn-play').click();await page.locator('#btn-music').click();
 await page.waitForFunction(()=>window.__machine.getExperience().enabled);
 const before=await page.evaluate(()=>window.__machine.getExperience().mechanical);
 await page.evaluate(()=>window.__machine.audit(120));
 assert.deepEqual(await page.evaluate(()=>window.__machine.getExperience().mechanical),before,'diagnostic steps must never generate sound');
 await page.locator('#btn-reset').click();await page.locator('[data-speed="2"]').click();await page.locator('#btn-play').click();
 await page.waitForFunction(()=>{const c=window.__machine.getExperience().mechanical.counts;return Object.values(c).every(n=>n>0);},null,{timeout:40000});
 const measured=await page.evaluate(async()=>{
  let peak=0;const a=window.__testAnalyser,data=new Float32Array(a.fftSize);
  for(let i=0;i<120;i++){a.getFloatTimeDomainData(data);for(const v of data)peak=Math.max(peak,Math.abs(v));await new Promise(r=>setTimeout(r,25));}
  return {peak,effects:window.__machine.getExperience().mechanical};
 });assert.ok(measured.peak>1e-5&&measured.peak<1,'real output contains non-clipped audio');assert.ok(measured.effects.voices<=8);
 await page.evaluate(async()=>{await window.__testContext.suspend();Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 const hidden=await page.evaluate(()=>window.__machine.getExperience().mechanical);assert.equal(hidden.voices,0);
 await page.waitForTimeout(350);assert.deepEqual(await page.evaluate(()=>window.__machine.getExperience().mechanical),hidden);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForFunction(()=>window.__machine.getExperience().context==='running');
 await page.locator('#btn-play').click();
 const paused=await page.evaluate(()=>window.__machine.getExperience().mechanical);assert.equal(paused.voices,0);
 await page.waitForTimeout(350);assert.deepEqual(await page.evaluate(()=>window.__machine.getExperience().mechanical),paused);
 const silence=await page.evaluate(()=>{const a=window.__testAnalyser,d=new Float32Array(a.fftSize);a.getFloatTimeDomainData(d);return Math.max(...d.map(Math.abs));});assert.ok(silence<.0001);
 await page.locator('#btn-music').click();await page.locator('#btn-play').click();await page.waitForTimeout(1500);
 assert.deepEqual(await page.evaluate(()=>window.__machine.getExperience().mechanical),paused,'mute must not create effects');
 await page.locator('#btn-play').click();await page.locator('#btn-music').click();await page.waitForFunction(()=>window.__machine.getExperience().enabled);
 assert.deepEqual(await page.evaluate(()=>window.__machine.getExperience().mechanical),paused,'enable while paused must not replay effects');
 // Render the very same cached voice implementation through the real browser
 // audio engine for a listening artifact, with the production master gain.
 const samples=await page.evaluate(async()=>{
  const {createImpactVoices}=await import('/machine-sound.js');
  const rate=48000,context=new OfflineAudioContext(1,rate*3,rate),gain=context.createGain();gain.gain.value=.3;gain.connect(context.destination);
  // BufferSource.start is scheduled for this short illustrative sequence.
  const native=context.createBufferSource.bind(context);let at=.2;
  context.createBufferSource=()=>{const source=native(),start=source.start.bind(source),time=at;source.start=()=>start(time);return source;};
  const voices=createImpactVoices(context,gain);
  for(const [time,kind] of [[.2,'open'],[.85,'stop'],[1.13,'wood'],[2.2,'latch']]){at=time;voices.play(kind);}
  const result=await context.startRendering();return Array.from(result.getChannelData(0));
 });
 const wav=Buffer.alloc(44+samples.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(48000,24);wav.writeUInt32LE(96000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);samples.forEach((v,i)=>wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));writeFileSync('screenshots/mechanical-sound-demo.wav',wav);
 await page.screenshot({path:'screenshots/mechanical-sound-desktop.png'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'screenshots/mechanical-sound-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,measured,silence,checks:['user-activated','real cues all four kinds','non-clipped output','silent diagnostics','hidden gating and suspended context recovery','pause stops voices','mute','no replay on enable','offline engine demo','mobile'],errors}));
}finally{await browser.close();}
