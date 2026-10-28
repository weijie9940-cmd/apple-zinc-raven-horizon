import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {checkedUrl} from './browser-guard.mjs';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{const page=await browser.newPage();await page.goto(checkedUrl(process.argv[2]||'http://127.0.0.1:8084/'));await page.waitForFunction(()=>window.__machine?.ready);await page.locator('#btn-play').click();
 const result=await page.evaluate(async()=>{
  const T=await import('/vendor/three/three.module.js'),m=window.__machine,meshes=[];m.scene.updateMatrixWorld(true);m.scene.traverse(o=>{if(o.isMesh&&(o.name.startsWith('channel/')||o.name.startsWith('tube/')||o.name==='junction/guard'))meshes.push(o);});
  const ray=new T.Raycaster(),routes=[],failures=[];let probes=0;
  for(const tr of m.channelSections(true)){
   let floorChecks=0,wallChecks=0,transfers=0,maxFloorGap=0,maxWallDistance=0,maxSideY=0;
   if(tr.name==='inlet'){
    const o=m.scene.getObjectByName('tube/inlet-collector'),a=o.geometry.attributes.position,idx=o.geometry.index,tri=new T.Triangle(),q=new T.Vector3();let minClearance=Infinity,maxGap=0;
    for(const p of tr.sections){const center=new T.Vector3(...Object.values(p.center));let gap=Infinity;
     for(let i=0;i<idx.count;i+=3){for(const[v,n]of[[tri.a,0],[tri.b,1],[tri.c,2]])v.fromBufferAttribute(a,idx.getX(i+n)).applyMatrix4(o.matrixWorld);tri.closestPointToPoint(center,q);gap=Math.min(gap,center.distanceTo(q)-m.R);}
     probes++;minClearance=Math.min(minClearance,gap);maxGap=Math.max(maxGap,gap);if(gap<-.0001||gap>.05)failures.push({route:tr.name,s:p.s,kind:'gravity-collector',gap});
    }
    routes.push({name:tr.name,sections:tr.sections.length,gravityContainmentChecks:tr.sections.length,minClearance,maxGap,maxSideY:0});continue;
   }
   for(const p of tr.sections){
    maxSideY=Math.max(maxSideY,Math.abs(p.side.y));
    const origin=new T.Vector3(...Object.values(p.center)),up=new T.Vector3(...Object.values(p.up)),side=new T.Vector3(...Object.values(p.side));
    if(p.s===0||p.s===tr.total)origin.addScaledVector(new T.Vector3(...Object.values(p.tangent)),p.s===0?.0001:-.0001);
    // This short trimmed receiver region is supported by the moving door;
    // verify-transfer-support.mjs tests it at actual moving-ball positions.
    if(tr.name==='pour'&&p.s<.05){transfers++;continue;}
    ray.set(origin,up.clone().negate());ray.near=0;ray.far=.30;
    const floor=ray.intersectObjects(meshes,false).find(h=>h.face.normal.clone().transformDirection(h.object.matrixWorld).dot(up)>.3);floorChecks++;probes++;
    const allowance=tr.name==='inlet'||tr.name==='chute'&&p.up.y<.75?.07:.012;
    if(!floor||floor.distance>.16+allowance)failures.push({route:tr.name,s:p.s,kind:'floor',distance:floor?.distance??null});
    if(floor)maxFloorGap=Math.max(maxFloorGap,floor.distance-.16);
    // Concrete feed portals: funnel accepts the pour and exits through its
    // aperture; inlet first one ball diameter accepts that incoming sweep.
    // Floor support is still checked at every one of these portal sections.
    const portal=tr.name==='funnel'&&(p.s<.05||tr.total-p.s<.70)||tr.name==='inlet'&&p.s<.32||['ramp2','response'].includes(tr.name)&&(p.s<.05||tr.total-p.s<.05);
    if(portal){transfers++;continue;}
    const limit=['ramp2','response'].includes(tr.name)?.80:.30;
    for(const sign of [-1,1]){
     ray.set(origin,side.clone().multiplyScalar(sign));ray.near=0;ray.far=limit;
     const hit=ray.intersectObjects(meshes,false)[0];wallChecks++;probes++;
     if(!hit)failures.push({route:tr.name,s:p.s,kind:sign<0?'left':'right'});else maxWallDistance=Math.max(maxWallDistance,hit.distance);
    }
   }routes.push({name:tr.name,sections:tr.sections.length,floorChecks,wallChecks,transferSections:transfers,maxSideY,maxFloorGap,maxWallDistance});
  }
  const tube=m.scene.getObjectByName('tube/drop-pipe'),pipeChecks=[];
  for(let i=1;i<12;i++){const y=m.pipe.outletY+(m.pipe.top-m.pipe.outletY)*i/12;
   for(let j=0;j<16;j++){const a=j*Math.PI/8;ray.set(new T.Vector3(m.pipe.x,y,m.pipe.z),new T.Vector3(Math.cos(a),0,Math.sin(a)));ray.near=0;ray.far=.26;const hit=ray.intersectObject(tube,false)[0];probes++;if(!hit)pipeChecks.push({i,j});}
  }
  return {probes,routes,pipeRadialChecks:176,pipeMissing:pipeChecks,failures};
 });writeFileSync('work/whole-route-support.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));assert.deepEqual(result.failures,[]);assert.deepEqual(result.pipeMissing,[]);assert.equal(result.routes.length,8);assert.ok(result.routes.every(r=>r.maxSideY<1e-5));
}finally{await browser.close();}
