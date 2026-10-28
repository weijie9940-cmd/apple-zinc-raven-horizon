import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSwitchDrive,createMergeRetarder,trackTravel} from '../public/machine-mechanisms.js';
test('switch requires 0.3 simulation seconds and occupancy locks its blade',()=>{
 const m=createSwitchDrive({duration:.3});m.request('response');m.tick(.15,{locked:false});assert.equal(m.ready('response'),false);
 const position=m.state().position;m.request('main');m.tick(.3,{locked:true});assert.equal(m.state().position,position);
 m.request('response');m.tick(.15,{locked:false});assert.equal(m.ready('response'),true);
 m.tick(0,{locked:false});assert.equal(m.state().position,1);m.reset('main');assert.equal(m.ready('main'),true);
});
test('retarder applies the adopted speed limit and rotates only from contact travel',()=>{
 const m=createMergeRetarder();m.beginStep();const free=m.limit({id:1,freeSpeed:.5,targetSpeed:.5,dt:.01});assert.equal(free.v,.5);assert.equal(free.pressure,0);
 const braked=m.limit({id:2,freeSpeed:.5,targetSpeed:.2,dt:.01});assert.equal(braked.v,.2);assert.ok(braked.pressure>0);
 m.contact({id:2,roller:0,distance:.02,dt:.01});assert.ok(m.state().rollers[0].angle>0);const angle=m.state().rollers[0].angle;
 m.contact({id:2,roller:0,distance:.02,dt:0});assert.equal(m.state().rollers[0].angle,angle);
 m.beginStep();assert.equal(m.state().pressure,0);assert.equal(m.state().rollers[0].angle,angle);
 m.reset();assert.equal(m.state().pressure,0);assert.equal(m.state().rollers[0].angle,0);
});

test('rolling uses adopted distance even when a ball ends the step stopped or changes lanes',()=>{
 const paths={lengths:[0,0,0,16,0,0,6.7],splitS:7,joinS:12,responseIndex:6};
 assert.ok(Math.abs(trackTravel({track:3,s:6.9},{track:3,s:6.92},paths)-.02)<1e-9);
 assert.ok(Math.abs(trackTravel({track:3,s:6.99},{track:6,s:0},paths)-.01)<1e-9);
 assert.ok(Math.abs(trackTravel({track:6,s:6.69},{track:3,s:12.01},paths)-.02)<1e-9);
});
