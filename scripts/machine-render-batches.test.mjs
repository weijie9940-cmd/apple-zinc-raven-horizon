import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/vendor/three/three.module.js';
import {createRenderBatches} from '../public/machine-render-batches.js';

test('render batching preserves world transforms, hierarchy visibility and audit geometry',()=>{
 const scene=new T.Scene(),parent=new T.Group(),material=new T.MeshStandardMaterial();scene.add(parent);
 const a=new T.Mesh(new T.BoxGeometry(),material),b=new T.Mesh(new T.SphereGeometry(),material);parent.add(a,b);parent.position.x=3;a.position.y=2;
 const original=a.geometry,batcher=createRenderBatches(T,scene);assert.equal(batcher.stats().sources,2);
 batcher.render(()=>{assert.equal(a.visible,false);const batch=scene.children.find(o=>o.isBatchedMesh);assert.ok(batch.visible);assert.ok(batch.colorTexture);assert.notEqual(batch.material,material);const color=new T.Color();batch.getColorAt(0,color);assert.ok(color.equals(material.color));assert.ok(batch.customDepthMaterial);const matrix=new T.Matrix4();batch.getMatrixAt(0,matrix);assert.equal(matrix.elements[12],3);assert.equal(matrix.elements[13],2);});
 assert.equal(a.visible,true);assert.equal(a.geometry,original);assert.equal(scene.children.find(o=>o.isBatchedMesh).visible,false);
 parent.visible=false;batcher.render(()=>{const batch=scene.children.find(o=>o.isBatchedMesh);assert.equal(batch.getVisibleAt(0),false);});
 assert.throws(()=>batcher.render(()=>{throw Error('render failure');}));assert.equal(a.visible,true);
});

test('mutable materials and transparent overlays remain individually rendered',()=>{
 const scene=new T.Scene(),material=new T.MeshStandardMaterial(),meshes=[0,1].map(()=>new T.Mesh(new T.BoxGeometry(),material));scene.add(...meshes);
 const overlay=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial({transparent:true,opacity:.5}));scene.add(overlay);
 const batcher=createRenderBatches(T,scene);material.opacity=.4;material.transparent=true;
 batcher.render(()=>{assert.equal(overlay.visible,true);assert.equal(meshes[0].visible,true);assert.equal(scene.children.find(o=>o.isBatchedMesh).visible,false);});
});

test('mesh parents stay visible so independent children are never lost',()=>{
 const scene=new T.Scene(),material=new T.MeshStandardMaterial();
 const parent=new T.Mesh(new T.BoxGeometry(),material),child=new T.Mesh(new T.BoxGeometry(),material),other=new T.Mesh(new T.BoxGeometry(),material);parent.add(child);scene.add(parent,other);
 const batcher=createRenderBatches(T,scene);batcher.render(()=>assert.equal(parent.visible,true));
});

test('unsupported multi-draw leaves the complete original render path',()=>{
 const scene=new T.Scene(),material=new T.MeshStandardMaterial();scene.add(new T.Mesh(new T.BoxGeometry(),material),new T.Mesh(new T.BoxGeometry(),material));
 const batcher=createRenderBatches(T,scene,{enabled:false});assert.equal(batcher.stats().sources,0);batcher.render(()=>assert.equal(scene.children.every(o=>o.visible),true));
});

test('moving and hidden sources update without losing the physical model',()=>{
 const scene=new T.Scene(),material=new T.MeshStandardMaterial(),a=new T.Mesh(new T.BoxGeometry(),material),b=new T.Mesh(new T.BoxGeometry(),material);scene.add(a,b);
 const batcher=createRenderBatches(T,scene),batch=scene.children.find(o=>o.isBatchedMesh);
 batcher.render(()=>assert.equal(batch.getVisibleAt(0),true));
 a.position.x=2;batcher.render(()=>{const matrix=new T.Matrix4();batch.getMatrixAt(0,matrix);assert.equal(matrix.elements[12],2);assert.equal(batch.getVisibleAt(1),true);});
 b.visible=false;batcher.render(()=>assert.equal(batch.getVisibleAt(1),false));assert.equal(a.visible,true);assert.equal(b.visible,false);assert.equal(batch.visible,false);
});

test('different finishes retain independent colors in a shared render group',()=>{
 const scene=new T.Scene(),a=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({color:0xff0000})),b=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({color:0x0000ff}));scene.add(a,b);
 const batcher=createRenderBatches(T,scene);assert.equal(batcher.stats().batches,1);b.material.color.setHex(0x00ff00);
 batcher.render(()=>{const batch=scene.children.find(o=>o.isBatchedMesh),color=new T.Color();batch.getColorAt(0,color);assert.ok(color.equals(a.material.color));batch.getColorAt(1,color);assert.ok(color.equals(b.material.color));assert.equal(batch.material.color.getHex(),0xffffff);});
});
