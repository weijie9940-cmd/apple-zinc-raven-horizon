import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRouteSelector,responseCurve} from '../public/machine-routing.js';

test('alternate commits one decision per ball; changing mode never rewrites an earlier choice',()=>{
 const router=createRouteSelector();
 assert.equal(router.commit(),'main');assert.equal(router.commit(),'response');
 router.setMode('response');const committed=router.commit();
 router.setMode('main');assert.equal(committed,'response');assert.equal(router.commit(),'main');
 assert.deepEqual(router.state().counts,{main:2,response:2});
 router.reset();assert.deepEqual(router.state().counts,{main:0,response:0});assert.equal(router.state().mode,'main');
});
test('a response curve joins exactly, heads downhill and is longer than the direct route',()=>{
 const start={x:4,y:1,z:-4},end={x:0,y:.85,z:-3.7},a={x:-1,y:-.02,z:0},b={x:-.8,y:-.02,z:.6};
 const points=responseCurve(start,end,a,b,500);
 assert.deepEqual(points[0],start);assert.deepEqual(points.at(-1),end);
 let length=0;
 for(let i=1;i<points.length;i++){
  assert.ok(points[i].y<points[i-1].y);
  length+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y,points[i].z-points[i-1].z);
 }
 assert.ok(length>5.5);assert.ok(Math.min(...points.map(p=>p.z))<-5);
});

