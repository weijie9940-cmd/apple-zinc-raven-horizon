import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkedUrl, checkedOutputPath } from "./browser-guard.mjs";

const url = checkedUrl(process.argv[2] || "http://127.0.0.1:8084/");
const out = checkedOutputPath(join(process.cwd(), "work", "machine-verification.json"), [process.cwd()], "verification");
const browser = await chromium.launch({headless:true, ...(process.env.BROWSER_EXECUTABLE_PATH ? {executablePath:process.env.BROWSER_EXECUTABLE_PATH} : process.platform === "win32" ? {channel:"msedge"} : {})});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__machine?.ready);
 await page.locator("#btn-play").click();
 const geometry=await page.evaluate(async()=>{
  const T=await import("/vendor/three/three.module.js"),m=window.__machine;
  const tri=new T.Triangle(),closest=new T.Vector3();
  function meshGap(mesh,p){const g=mesh.geometry,a=g.attributes.position,idx=g.index;let min=Infinity;for(let i=0;i<(idx?idx.count:a.count);i+=3){for(const[v,n]of[[tri.a,0],[tri.b,1],[tri.c,2]])v.fromBufferAttribute(a,idx?idx.getX(i+n):i+n);if(tri.getArea()<1e-12)continue;tri.closestPointToPoint(p,closest);const d=closest.distanceTo(p);if(Number.isFinite(d))min=Math.min(min,d);}return min-m.R;}
  m.scene.updateMatrixWorld(true);
  const cup=m.buckets[0].children.map(mesh=>{const g=mesh.geometry.clone();g.applyMatrix4(mesh.matrix);const gap=meshGap({geometry:g},new T.Vector3(...Object.values(m.carrierSeats()[0])).sub(m.buckets[0].position));g.dispose();return{name:mesh.name,gap};});
  const solids=[];m.scene.traverse(mesh=>{if(!mesh.isMesh||mesh.isInstancedMesh||mesh.userData.renderOnly||mesh.userData.routeGuide||mesh.name.startsWith("ball/")||mesh.name==="journey-marker"||mesh.name==="director-marker"||mesh.name.startsWith("chime-marker-"))return;let parent=mesh.parent;while(parent){if(parent.name.startsWith("bucket/"))return;parent=parent.parent;}const geometry=mesh.geometry.clone();geometry.applyMatrix4(mesh.matrixWorld);geometry.computeBoundingBox();solids.push({geometry,box:geometry.boundingBox,name:mesh.name||mesh.geometry.type});});
  const hits=[];let samples=0,minimum=Infinity;
  for(const path of m.pathSamples()){for(const p of path.points){samples++;const pos=new T.Vector3(p.x,p.y,p.z);for(const solid of solids){if(solid.box.distanceToPoint(pos)>m.R+.005)continue;const gap=meshGap(solid,pos);minimum=Math.min(minimum,gap);if(gap < -.0001)hits.push({path:path.name,mesh:solid.name,gap,at:p});}}}
  solids.forEach(s=>s.geometry.dispose());
  return {samples,minimum,hits: hits.slice(0,20),cup,seams:m.seam,lift:m.liftClear};
 });
 if(geometry.hits.length||geometry.cup.some(c=>c.gap < -0.0001)||geometry.seams.some(j=>!j.ok)||!geometry.lift.ok)throw Error("Geometry regression: "+JSON.stringify(geometry));
 const pause=await page.evaluate(()=>window.__machine.getPhase());
 await page.waitForTimeout(100);const afterPause=await page.evaluate(()=>window.__machine.getPhase());
 if(pause.chainTravel!==afterPause.chainTravel||pause.phi3!==afterPause.phi3)throw Error("Pause advances drivetrain");
 const cycles=[];
 for(const count of [4,8,12]){await page.locator(`[data-count="${count}"]`).click();const audit=await page.evaluate(()=>window.__machine.audit(300));if(audit.nan||audit.overlaps||audit.worldOverlaps)throw Error("Cycle regression: "+JSON.stringify({count,...audit}));cycles.push({count,...audit});}
 for(const speed of [0.5,1,2]){await page.locator(`[data-speed="${speed}"]`).click();if(await page.evaluate(()=>window.__machine.getPhase().speed)!==speed)throw Error("Speed control");}
 await page.locator("#btn-reset").click();
 await page.locator('[data-speed="2"]').click();
 await page.locator("#btn-play").click();
 const journey=[];
 for(const stage of ["lift","spiral","return","lift"]){
  await page.waitForFunction(stage=>document.querySelector('[data-stage][aria-current="step"]')?.dataset.stage===stage,stage,{timeout:90000});
  const marker=await page.evaluate(()=>{
   const m=window.__machine,ring=m.scene.getObjectByName("journey-marker"),ball=m.ballXYZ()[0];
   const selected=document.querySelector('[data-stage][aria-current="step"]');
   return {stage:selected?.dataset.stage,label:document.getElementById("journey-current").textContent,desktopLabel:selected?.textContent,gap:Math.hypot(ring.position.x-ball.x,ring.position.y-ball.y,ring.position.z-ball.z),visible:ring.visible};
  });
  if(!marker.visible||marker.gap>1e-6||marker.label!==marker.desktopLabel)throw Error("Journey marker regression: "+JSON.stringify(marker));
  journey.push(marker.stage);
 }
 await page.locator("#btn-play").click();
 for(const viewport of [{width:1280,height:800},{width:390,height:844}]){await page.setViewportSize(viewport);for(const view of ["wide","top","gears"]){await page.locator(`[data-view="${view}"]`).click();await page.waitForTimeout(900);if(await page.locator(`[data-view="${view}"]`).getAttribute("aria-pressed")!=="true")throw Error("View selection");const visible=await page.evaluate(()=>{const canvas=window.__machine.canvas;return canvas.clientWidth>0&&canvas.clientHeight>0&&window.__machine.controls.enabled;});if(!visible)throw Error("View unusable");}}
 const summary={ok:true,url,geometry,cycles,journey,pause:true,speeds:[0.5,1,2],viewports:["desktop","mobile"],views:["wide","top","gears"],errors};
 if(errors.length)throw Error("Browser errors: "+errors.join(";"));
 mkdirSync(join(process.cwd(),"work"),{recursive:true});writeFileSync(out,JSON.stringify(summary,null,2));console.log(JSON.stringify({ok:true,samples:geometry.samples,geometryHits:geometry.hits.length,cycles:cycles.map(c=>({count:c.count,worldOverlaps:c.worldOverlaps,nan:c.nan})),journey,errors}));
} finally {await browser.close();}
