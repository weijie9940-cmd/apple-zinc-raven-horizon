import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDriveTour} from '../public/machine-drive-state.js';

test('inspection slow motion is temporary and tour respects pause and manual control',()=>{
 const tour=createDriveTour();assert.equal(tour.state().timeScale,1);
 tour.open();assert.equal(tour.state().timeScale,.25);tour.play(true);
 tour.tick(7,{playing:false});assert.equal(tour.state().step,0);
 tour.tick(6,{playing:true});assert.equal(tour.state().step,1);
 tour.manual();tour.tick(20,{playing:true});assert.equal(tour.state().step,1);
 tour.select(3);tour.play(true);tour.tick(6,{playing:true});assert.equal(tour.state().auto,false);
 tour.close();assert.equal(tour.state().timeScale,1);assert.equal(tour.state().active,false);
});
test('reduced-motion users choose shots explicitly; selections clamp and reset timing',()=>{
 const tour=createDriveTour({reducedMotion:true});tour.open(9);assert.equal(tour.state().step,3);
 tour.play(true);tour.tick(100,{playing:true});assert.equal(tour.state().auto,false);
 tour.select(-1);assert.equal(tour.state().step,0);tour.slow(false);assert.equal(tour.state().timeScale,1);
});
