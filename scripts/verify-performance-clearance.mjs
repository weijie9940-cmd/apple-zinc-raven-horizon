import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {checkedUrl} from './browser-guard.mjs';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage();await page.goto(checkedUrl(process.argv[2]||'http://127.0.0.1:8084/'),{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__machine?.ready);await page.locator('#btn-play').click();
 await page.locator('[data-count="12"]').click();await page.locator('#btn-performance').click();
 const result=await page.evaluate(async()=>{
  const T=await import('/vendor/three/three.module.js'),m=window.__machine,solids=[];
  m.scene.getObjectByName('curtain-mechanism').traverse(o=>{if(o.isMesh)solids.push(o);});
  const tri=new T.Triangle(),closest=new T.Vector3(),point=new T.Vector3(),inverse=new T.Matrix4();
  let minimum=Infinity,worst=null;const phases=new Set();
  for(let step=0;step<1200;step++){
   m.audit(.1);m.scene.updateMatrixWorld(true);phases.add(m.getExperience().performance.phase);
   const balls=m.ballXYZ(),states=m.getBalls();
   for(let i=0;i<balls.length;i++)for(const object of solids){
    const pos=point.set(balls[i].x,balls[i].y,balls[i].z).applyMatrix4(inverse.copy(object.matrixWorld).invert());
    const geometry=object.geometry;if(!geometry.boundingBox)geometry.computeBoundingBox();
    if(geometry.boundingBox.distanceToPoint(pos)>m.R+.08)continue;
    const a=geometry.attributes.position,index=geometry.index;
    for(let j=0;j<(index?index.count:a.count);j+=3){
     tri.a.fromBufferAttribute(a,index?index.getX(j):j);tri.b.fromBufferAttribute(a,index?index.getX(j+1):j+1);tri.c.fromBufferAttribute(a,index?index.getX(j+2):j+2);
     if(tri.getArea()<1e-12)continue;
     tri.closestPointToPoint(pos,closest);const gap=closest.distanceTo(pos)-m.R;
     if(gap<minimum){minimum=gap;worst={mesh:object.name,mode:states[i].mode,ball:balls[i],phase:m.getExperience().performance.phase};}
    }
   }
  }
  return {minimum,worst,phases:[...phases],completed:m.getExperience().performance.completed};
 });
 assert.ok(result.minimum>=-0.0001,JSON.stringify(result));assert.ok(result.completed>0);
 assert.ok(result.phases.includes('overture')&&result.phases.includes('releasing'));
 console.log(JSON.stringify({ok:true,...result}));
}finally{await browser.close();}
