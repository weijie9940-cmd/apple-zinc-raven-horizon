import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPerformance} from '../public/machine-performance.js';

test('only the conductor completing two loops starts a performance',()=>{
  const show=createPerformance();
  show.pickup(2); assert.equal(show.state().laps,0);
  show.pickup(0); assert.equal(show.state().phase,'cruising');
  show.pickup(0); assert.equal(show.state().phase,'collecting');
  assert.equal(show.gateClosed(),true);
});
test('wait for every ball to settle, play six notes once, then wait for unique departures before ringing',()=>{
  const show=createPerformance(); show.start();
  show.tick(20,3,4); assert.equal(show.state().phase,'collecting');
  show.tick(0,4,4); assert.equal(show.state().phase,'overture');
  assert.deepEqual(show.takeEvents(),[]);
  show.tick(0,4,4); assert.deepEqual(show.takeEvents(),[]);
  show.tick(4.5,4,4);
  assert.deepEqual(show.takeEvents(),[0,1,2,3,4,5].map(index=>({type:'note',index})));
  show.tick(1,4,4); assert.equal(show.state().phase,'releasing');
  assert.equal(show.gateClosed(),false);
  show.pickup(0); show.pickup(0); show.pickup(1); show.pickup(2);
  assert.equal(show.state().released,3); assert.deepEqual(show.takeEvents(),[]);
  show.pickup(3); assert.equal(show.state().phase,'encore');
  assert.deepEqual(show.takeEvents(),[{type:'bell'}]);
  show.pickup(3); assert.deepEqual(show.takeEvents(),[]);
  show.tick(2,0,4); assert.equal(show.state().phase,'cruising');
  assert.equal(show.state().completed,1); assert.equal(show.state().laps,0);
});
test('pause, cancellation and reset cannot leave a shut gate or old pending notes',()=>{
  const show=createPerformance(); show.start(); show.tick(0,4,4);
  show.tick(0.9,4,4); const before=show.state();
  show.tick(0,4,4); assert.deepEqual(show.state(),before);
  show.cancel(); assert.equal(show.gateClosed(),false); assert.deepEqual(show.takeEvents(),[]);
  show.start(); assert.equal(show.state().released,0); assert.equal(show.state().elapsed,0);
  show.reset(); assert.equal(show.state().phase,'cruising'); assert.equal(show.state().completed,0);
});
