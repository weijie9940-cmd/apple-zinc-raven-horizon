import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeFlow} from '../public/machine-traffic.js';
test('an uncontested arrival keeps its speed and position',()=>{
 assert.deepEqual(mergeFlow([{id:1,progress:-.7,v:.4,ticket:1}],.4),[{id:1,progress:-.7,v:.4,ticket:1}]);
});
test('two lanes follow the moving leader without stopping the whole junction',()=>{
 const result=mergeFlow([{id:2,progress:-.5,v:.5,ticket:2},{id:1,progress:-.3,v:.3,ticket:1}],.4);
 assert.equal(result[0].id,1);assert.equal(result[1].progress,-.7);assert.equal(result[1].v,.3);
});
test('ticket order prevents overtaking and an already downstream ball remains ahead',()=>{
 const result=mergeFlow([{id:1,progress:-.3,v:.3,ticket:1},{id:2,progress:.5,v:.2,ticket:null},{id:3,progress:-.1,v:.4,ticket:2}],.4);
 assert.deepEqual(result.map(b=>b.id),[2,1,3]);assert.equal(result[2].progress,-.7);
});

test('an arrival yields at its current position instead of jumping backwards into queue spacing',()=>{
 const result=mergeFlow([{id:1,progress:-.73,v:.25,ticket:1},{id:2,progress:-.99,minimum:-1.0,v:.5,ticket:2}],.4);
 assert.equal(result[1].progress,-1);assert.equal(result[1].v,0);
});
