import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {checkedUrl} from './browser-guard.mjs';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(checkedUrl(process.argv[2]||'http://127.0.0.1:8084/'));await page.waitForFunction(()=>window.__machine?.ready);
 await page.locator('#btn-play').click();await page.locator('#btn-reset').click();
 const result=await page.evaluate(()=>{
  const m=window.__machine;let ratioError=0,loads=0,restarts=0,stops=0,tipSamples=0,peak=0,wasLoading=false;
  let previous=m.getPhase();
  for(let i=0;i<7200;i++){
   m.audit(1/120);const p=m.getPhase(),load=m.loadingState();
   const d1=p.phi1-previous.phi1,d2=p.phi2-previous.phi2,d3=p.phi3-previous.phi3;
   ratioError=Math.max(ratioError,Math.abs(d1+3*d2),Math.abs(d1-5*d3));
   peak=Math.max(peak,p.driveVelocity);
   if(load){loads++;if(p.driveVelocity===0)stops++;}
   if(wasLoading&&!load)restarts++;
   const tipping=m.bucketStates().some(b=>b.loaded&&b.pose.tilt>.2);
   if(tipping&&p.driveVelocity>0&&p.driveVelocity<p.baseChainSpeed*.85)tipSamples++;
   previous=p;wasLoading=!!load;
  }
  return {ratioError,loads,restarts,stops,tipSamples,peak,phase:m.getPhase()};
 });
 console.log(JSON.stringify({result,errors}));assert.equal(errors.length,0);assert.ok(result.ratioError<1e-10);assert.ok(result.loads>50);assert.equal(result.loads,result.stops);assert.ok(result.restarts>=2);assert.ok(result.tipSamples>20);assert.ok(result.peak>0);
}finally{await browser.close();}
