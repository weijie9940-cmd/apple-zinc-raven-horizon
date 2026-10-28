import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {checkedUrl} from './browser-guard.mjs';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{const page=await browser.newPage();await page.goto(checkedUrl(process.argv[2]||'http://127.0.0.1:8084/'));await page.waitForFunction(()=>window.__machine?.ready);
 const r=await page.evaluate(async()=>{
  const T=await import('/vendor/three/three.module.js'),m=window.__machine,collector=m.scene.getObjectByName('tube/inlet-collector'),config=m.pipe.collector,ray=new T.Raycaster(),missing=[];
  m.scene.updateMatrixWorld(true);let radialChecks=0;
  for(let i=1;i<12;i++)for(let j=0;j<32;j++){
   const y=config.bottom+(config.top-config.bottom)*i/12,a=j*Math.PI/16;
   ray.set(new T.Vector3(m.pipe.x,y,m.pipe.z),new T.Vector3(Math.cos(a),0,Math.sin(a)));ray.near=0;ray.far=.38;
   const hit=ray.intersectObject(collector,false)[0],expected=config.boreRadius+(config.mouthRadius-config.boreRadius)*i/12;
   if(!hit||Math.abs(hit.distance-expected)>.001)missing.push({i,j,d:hit?.distance,expected});radialChecks++;
  }
  const g=collector.geometry,a=g.attributes.position,idx=g.index,tri=new T.Triangle(),nearest=new T.Vector3();let minClearance=Infinity,maxInletGap=0,payloadChecks=0;
  for(const path of m.pathSamples().filter(p=>['funnel','inlet'].includes(p.name)))for(const p of path.points){
   const center=new T.Vector3(...Object.values(p));let gap=Infinity;
   for(let i=0;i<idx.count;i+=3){for(const[v,n]of[[tri.a,0],[tri.b,1],[tri.c,2]])v.fromBufferAttribute(a,idx.getX(i+n)).applyMatrix4(collector.matrixWorld);tri.closestPointToPoint(center,nearest);gap=Math.min(gap,center.distanceTo(nearest)-m.R);}
   minClearance=Math.min(minClearance,gap);if(path.name==='inlet')maxInletGap=Math.max(maxInletGap,gap);payloadChecks++;
  }
  return {radialChecks,payloadChecks,missing,minClearance,maxInletGap,config};
 });console.log(JSON.stringify(r));assert.deepEqual(r.missing,[]);assert.ok(r.minClearance>.002);assert.ok(r.maxInletGap<.05,'gravity transfer must stay within its collector');assert.ok(r.config.pipeOverlap>=.035);assert.equal(r.config.mouthRadius,.35);
}finally{await browser.close();}
