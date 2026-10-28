import test from 'node:test';
import assert from 'node:assert/strict';
import {createBucketCycle,loadingProgress,stopperLift} from '../public/machine-bucket-state.js';
const cycle=createBucketCycle({straight:4,arc:1.6,loop:11.2});
test('wooden cup stays level through lift and returns level',()=>{for(const s of [.5,1,3,7.5]){const p=cycle.pose(s);assert.equal(p.tilt,0);assert.equal(p.door,0);assert.equal(p.roll,0);}});
test('lower fixed guide opens the loading bridge before pickup',()=>{assert.equal(cycle.pose(cycle.pickupS).door,Math.PI/2);assert.equal(cycle.pose(cycle.pickupS).tilt,0);});
test('upper guide tips before moving ball to the exit',()=>{const p=cycle.pose(cycle.releaseS);assert.ok(Math.abs(p.tilt-35*Math.PI/180)<1e-9);assert.ok(Math.abs(p.roll-.40)<1e-9);assert.equal(p.door,Math.PI/2);const early=cycle.pose(4+1.6+.20);assert.equal(early.roll,0);assert.ok(early.tilt>0);});
test('upper guide closes door before restoring level',()=>{assert.equal(cycle.pose(cycle.releaseS+.58).door,0);assert.ok(cycle.pose(cycle.releaseS+.58).tilt>0);});
test('shared ball pose rotates around the suspended pivot',()=>{const p=cycle.ball({x:2,y:5,z:0},cycle.releaseS);assert.ok(p.z>.95);assert.ok(p.y<4.6);assert.equal(p.x,2);assert.equal(cycle.ball({x:2,y:5,z:0},1).y,4.74);});

test('receiver waiting happens before the door opens',()=>{assert.ok(Number.isFinite(cycle.preTipS));const p=cycle.pose(cycle.preTipS);assert.equal(p.door,0);assert.equal(p.tilt,0);assert.equal(p.roll,0);});
test('release preserves tangential payload speed',()=>{const c=.4,expected=c*(.80/.30+Math.sin(cycle.angle));assert.ok(Math.abs(cycle.releaseSpeed(c)-expected)<1e-9);});

test('single-ball stop opens before feed and closes behind the first ball',()=>{assert.equal(loadingProgress(.12),0);assert.equal(stopperLift(.12),.30);assert.ok(.725*(1-loadingProgress(.65))+.16<.55);assert.equal(stopperLift(.80),0);assert.equal(loadingProgress(1.1),1);});
