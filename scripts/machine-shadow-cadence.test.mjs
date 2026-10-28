import test from 'node:test';
import assert from 'node:assert/strict';
import {createShadowCadence} from '../public/machine-shadow-cadence.js';

test('dynamic shadows update on first frame, every other running frame and every dirty still frame',()=>{
 const cadence=createShadowCadence(2);
 assert.equal(cadence.next({playing:true,dirty:false}),true);
 assert.equal(cadence.next({playing:true,dirty:false}),false);
 assert.equal(cadence.next({playing:true,dirty:false}),true);
 assert.equal(cadence.next({playing:false,dirty:false}),false);
 assert.equal(cadence.next({playing:false,dirty:true}),true);
 assert.equal(cadence.next({playing:true,dirty:false}),false);
});
