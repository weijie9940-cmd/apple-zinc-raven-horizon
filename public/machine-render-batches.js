// Render-only submission groups. Named source meshes remain the physical and
// picking model; no geometry is simplified, moved or removed from that model.
export function createRenderBatches(T,scene,{enabled=true}={}) {
 const groups=new Map(),batches=[];
 const signatures=new Map();
 const signature=material=>{
  if(!signatures.has(material)){
   const data=material.toJSON();delete data.metadata;delete data.uuid;delete data.name;delete data.color;
   // Emissive music plates have independent per-frame intensity controls.
   signatures.set(material,JSON.stringify(data)+(material.emissive?.getHex()?material.id:''));
  }
  return signatures.get(material);
 };
 if(enabled)scene.traverse(o=>{
  if(!o.isMesh||o.children.length||o.isInstancedMesh||o.isBatchedMesh||o.isSkinnedMesh||Array.isArray(o.material)||o.material.transparent||o.customDepthMaterial||o.customDistanceMaterial||Object.keys(o.geometry.morphAttributes).length||o.onBeforeRender!==T.Object3D.prototype.onBeforeRender)return;
  const g=o.geometry;
  if(g.drawRange.start!==0||g.drawRange.count!==Infinity)return;
  const schema=Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b)).map(([name,a])=>`${name}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`).join(',');
  const key=[signature(o.material),!!g.index,schema,o.castShadow,o.receiveShadow,o.layers.mask,o.renderOrder].join('|');
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);
 });
 for(const sources of groups.values()){
  if(sources.length<2)continue;
  const geometries=[...new Set(sources.map(o=>o.geometry))],first=sources[0];
  const vertices=geometries.reduce((n,g)=>n+g.attributes.position.count,0),indices=geometries.reduce((n,g)=>n+(g.index?.count||0),0);
  const material=first.material.clone();
  // Per-instance colors preserve different timber and track finishes while
  // sharing identical lighting/texture settings and one shader cache.
  if(material.color)material.color.setHex(0xffffff);
  if(material.emissive)material.emissive=first.material.emissive;
  const mesh=new T.BatchedMesh(sources.length,vertices,indices,material),ids=new Map();
  mesh.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
  // This bundled Three revision stores _colorsTexture but its renderer probes
  // colorTexture. Supply the alias to avoid reselecting shaders on every draw.
  Object.defineProperty(mesh,'colorTexture',{get(){return this._colorsTexture;}});
  for(const g of geometries)ids.set(g,mesh.addGeometry(g));
  const entries=sources.map(source=>{const id=mesh.addInstance(ids.get(source.geometry)),color=source.material.color?.clone();if(color)mesh.setColorAt(id,color);return {source,id,color,visible:source.visible,matrix:null};});
  mesh.name='render-batch';mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.layers.mask=first.layers.mask;mesh.renderOrder=first.renderOrder;
  mesh.frustumCulled=false;mesh.perObjectFrustumCulled=false;mesh.sortObjects=false;mesh.visible=false;
  mesh.userData.renderOnly=true;mesh.raycast=()=>{};scene.add(mesh);batches.push({mesh,entries,material:first.material,version:first.material.version});
 }
 return {
  stats:()=>({enabled,batches:batches.length,sources:batches.reduce((n,b)=>n+b.entries.length,0)}),
  render(draw){
   scene.updateMatrixWorld(true);
   // Read every ancestor before hiding any source (a source may have children).
   for(const b of batches){
    if(b.version!==b.material.version){b.mesh.material.copy(b.material);if(b.material.color)b.mesh.material.color.setHex(0xffffff);if(b.material.emissive)b.mesh.material.emissive=b.material.emissive;b.version=b.material.version;}
    b.mesh.material.emissiveIntensity=b.material.emissiveIntensity;
    b.mesh.visible=!b.entries.some(e=>e.source.material.transparent);
    if(!b.mesh.visible)continue;
    for(const e of b.entries){
     e.visible=e.source.visible;let visible=true;
     if(e.color&&!e.color.equals(e.source.material.color)){e.color.copy(e.source.material.color);b.mesh.setColorAt(e.id,e.color);}
     for(let o=e.source;o;o=o.parent)if(!o.visible){visible=false;break;}
     if(!e.matrix||!e.matrix.equals(e.source.matrixWorld)){b.mesh.setMatrixAt(e.id,e.source.matrixWorld);e.matrix??=new T.Matrix4();e.matrix.copy(e.source.matrixWorld);}
     b.mesh.setVisibleAt(e.id,visible);
    }
   }
   const autoUpdate=scene.matrixWorldAutoUpdate;
   try{
    scene.matrixWorldAutoUpdate=false;
    for(const b of batches)if(b.mesh.visible)for(const e of b.entries)e.source.visible=false;
    return draw();
   }finally{
    scene.matrixWorldAutoUpdate=autoUpdate;
    for(const b of batches){if(b.mesh.visible)for(const e of b.entries)e.source.visible=e.visible;b.mesh.visible=false;}
   }
  },
 };
}
