import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionGovernor, tippingFactor} from '../public/machine-motion.js';

test('drive starts at rest, ramps within acceleration bound, resets exactly',()=>{
 const g=createMotionGovernor();assert.equal(g.value(),0);
 assert.ok(g.step(.01,{base:1})<=.015001);
 for(let i=0;i<300;i++)g.step(.01,{base:1});assert.equal(g.value(),1);
 g.reset();assert.equal(g.value(),0);
});
test('loaded cruise reduction is modest and capped',()=>{
 for(const [loaded,expected] of [[0,1],[1,.97],[6,.9]]){const g=createMotionGovernor();for(let i=0;i<400;i++)g.step(.01,{base:1,loaded});assert.ok(Math.abs(g.value()-expected)<1e-9);}
});
test('braking speed respects distance to a station and can reach zero',()=>{
 const g=createMotionGovernor();for(let i=0;i<100;i++)g.step(.01,{base:1});
 assert.ok(g.step(.01,{base:1,stopDistance:.001})<=Math.sqrt(2*.9*.001)+1e-9);
 assert.equal(g.step(.01,{base:1,stopDistance:0}),0);
 assert.ok(g.step(.01,{base:1})>0);
});
test('performance target and tipping envelope apply once',()=>{
 const g=createMotionGovernor();for(let i=0;i<300;i++)g.step(.01,{base:2,performance:.5,tip:.7});assert.ok(Math.abs(g.value()-.7)<1e-9);
 assert.equal(tippingFactor(-1),1);assert.equal(tippingFactor(.3),.72);assert.equal(tippingFactor(2),1);
 assert.ok(Math.abs(tippingFactor(-.000001)-tippingFactor(.000001))<.0001);
});
