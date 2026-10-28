import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {checkedUrl} from './browser-guard.mjs';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(checkedUrl(process.argv[2]||'http://127.0.0.1:8084/'),{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__machine?.ready);
 await page.locator('#btn-play').click();
 const result=await page.evaluate(async()=>{
  const T=await import('/vendor/three/three.module.js'),m=window.__machine;
  m.scene.updateMatrixWorld(true);
  const rails=[];m.scene.traverse(o=>{if(o.isMesh&&['junction/guard'].includes(o.name))rails.push(o);});
  const paths=m.pathSamples(),missing=[];let checks=0;
  for(const path of paths.filter(p=>['ramp2','response'].includes(p.name)))for(let i=1;i<path.points.length-1;i++){
   if(path.name==='ramp2'&&(i/299<.425||i/299>.745))continue;
   const p=path.points[i],a=path.points[i-1],b=path.points[i+1];
   const side=new T.Vector3(b.z-a.z,0,a.x-b.x).normalize();
   for(const sign of [-1,1]){
    const ray=new T.Raycaster(new T.Vector3(p.x,p.y,p.z),side.clone().multiplyScalar(sign),.01,.8);
    checks++;if(!ray.intersectObjects(rails,false).length)missing.push({path:path.name,i,sign});
   }
  }
  return {checks,missing};
 });
 assert.deepEqual(result.missing,[],JSON.stringify(result));
 await page.locator('#btn-routing').click();await page.waitForTimeout(1500);
 await page.screenshot({path:'screenshots/rails-closeup.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1200);
 await page.screenshot({path:'screenshots/rails-closeup-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,...result,errors}));
}finally{await browser.close();}

