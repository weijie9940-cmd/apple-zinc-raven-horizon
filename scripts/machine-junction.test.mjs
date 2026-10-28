import {test} from 'node:test';
import assert from 'node:assert/strict';
import {junctionFootprint} from '../public/machine-junction.js';
const lane=points=>({points:points.map(([x,z])=>({x,y:0,z})),sides:points.map((p,i)=>{
 const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],n=Math.hypot(dx,dz);
 return {x:-dz/n,y:0,z:dx/n};
})});
test('coincident lanes retain one closed perimeter instead of removing both walls',()=>{
 const main=lane([[0,0],[1,0],[2,0]]),shape=junctionFootprint([main,main],.176);
 assert.equal(shape.length,1);assert.equal(shape[0].length,1);
 assert.deepEqual(shape[0][0][0],shape[0][0].at(-1));
 const area=Math.abs(shape[0][0].slice(1).reduce((sum,p,i)=>{const a=shape[0][0][i];return sum+a[0]*p[1]-p[0]*a[1];},0)/2);
 assert.ok(Math.abs(area-2*.352)<1e-10);
});
test('a split and rejoin produces a continuous outer guard and a closed divider island',()=>{
 const main=lane([[0,0],[1,0],[2,0],[3,0],[4,0],[5,0]]);
 const branch=lane([[0,0],[1,0],[2,-1],[3,-1],[4,0],[5,0]]);
 const shape=junctionFootprint([main,branch],.176);
 assert.equal(shape.length,1);assert.equal(shape[0].length,2);
 for(const ring of shape[0])assert.deepEqual(ring[0],ring.at(-1));
});
