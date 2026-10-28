import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arrivalManifest, performanceShot} from '../public/machine-director.js';

const lengths=[20,2,8,16,1,1];
test('arrival progress reflects each ball route and reports the last traveller',()=>{
 const balls=[{mode:'carried'}, {mode:'track',track:0,s:10,v:1}, {mode:'track',track:3,s:15,v:0}, {mode:'track',track:3,s:8,v:1}];
 const report=arrivalManifest(balls,lengths);
 assert.equal(report.queued,1);assert.equal(report.remaining,3);assert.equal(report.lastMoving,0);
 assert.deepEqual(report.balls.map(b=>b.stage),['提升','螺旋','已归队','回流']);
 assert.ok(report.progress>0 && report.progress<1);
 const advanced=arrivalManifest([{mode:'track',track:0,s:0,v:1},...balls.slice(1)],lengths);
 assert.ok(advanced.progress>report.progress);
 assert.equal(arrivalManifest(balls.map(()=>({mode:'track',track:4,s:1,v:0})),lengths).progress,1);
});
test('director follows the conductor, shows arrivals, then the last traveller and musical cues',()=>{
 const report={balls:[{stage:'提升'}],remaining:2,lastMoving:2};
 assert.deepEqual(performanceShot({phase:'collecting',elapsed:1},report),{kind:'traveller',ball:0,label:'指挥球领场'});
 assert.equal(performanceShot({phase:'collecting',elapsed:7},report).kind,'wide');
 assert.equal(performanceShot({phase:'collecting',elapsed:12},report).ball,2);
 assert.equal(performanceShot({phase:'overture'},report).kind,'piano');
 assert.equal(performanceShot({phase:'releasing'},report).kind,'curtain');
 assert.equal(performanceShot({phase:'encore'},report).kind,'curtain');
 assert.equal(performanceShot({phase:'cruising'},report),null);
});
test('reduced motion uses stable collection shots instead of tracking moving balls',()=>{
 assert.equal(performanceShot({phase:'collecting',elapsed:1},{remaining:4},true).kind,'wide');
});

test('waiting at a route junction is not reported as having reached the recovery queue',()=>{
 const report=arrivalManifest([{mode:'track',track:6,s:4,v:0},{mode:'track',track:3,s:6,v:0},{mode:'track',track:3,s:15,v:0}],lengths,{responseIndex:6,joinS:12});
 assert.equal(report.queued,1);assert.deepEqual(report.balls.map(b=>b.stage),['等待放行','等待放行','已归队']);
});
