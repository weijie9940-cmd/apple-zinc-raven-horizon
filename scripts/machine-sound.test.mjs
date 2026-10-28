import test from 'node:test';
import assert from 'node:assert/strict';
import {mechanicalCues,renderImpact,IMPACTS,createImpactVoices} from '../public/machine-sound.js';
import {createBucketCycle} from '../public/machine-bucket-state.js';
const cycle={releaseS:5,loop:12};
const snapshot=(s,elapsed=null)=>({positions:[s],loading:elapsed===null?null:{bucket:0,elapsed}});
test('load cues occur once at actual stopper and seating phases',()=>{
 for(const [at,kind] of [[.12,'open'],[.77,'stop'],[1.05,'wood']]){
  assert.deepEqual(mechanicalCues(snapshot(1,at-.01),snapshot(1,at+.01),cycle),[kind]);
  assert.deepEqual(mechanicalCues(snapshot(1,at+.01),snapshot(1,at+.02),cycle),[]);
 }
 assert.deepEqual(mechanicalCues(snapshot(1),snapshot(1,.02),cycle),[]);
});
test('voices are bounded, cached and disconnected on stop or completion',()=>{
 const sources=[];let buffers=0;
 const context={sampleRate:48000,createBuffer:()=>{buffers++;return {copyToChannel(){}};},createBufferSource:()=>{const s={connect(){},disconnect(){this.disconnected=true;},start(){},stop(){this.stopped=true;}};sources.push(s);return s;}};
 const v=createImpactVoices(context,{});
 for(let i=0;i<8;i++)assert.equal(v.play('wood'),true);
 assert.equal(v.play('wood'),false);assert.equal(buffers,1);
 sources[0].onended();assert.equal(v.state().voices,7);assert.equal(sources[0].disconnected,true);
 assert.equal(v.play('latch'),true);v.stop();assert.equal(v.state().voices,0);
 assert.ok(sources.slice(1).every(s=>s.stopped&&s.disconnected));
});
test('return latch crosses once with wrap and never at rest',()=>{
 assert.deepEqual(mechanicalCues(snapshot(5.54),snapshot(5.56),cycle),['latch']);
 assert.deepEqual(mechanicalCues(snapshot(5.56),snapshot(5.56),cycle),[]);
 assert.deepEqual(mechanicalCues(snapshot(11.9),snapshot(.1),{releaseS:-.5,loop:12}),['latch']);
});
test('cue detector accepts the actual bucket cycle contract',()=>{
 const c=createBucketCycle({straight:4,arc:1.6,loop:11.2});
 assert.deepEqual(mechanicalCues(snapshot(c.releaseS+.54),snapshot(c.releaseS+.56),c),['latch']);
});
test('impact buffers are deterministic quiet finite signals with click-free endpoints',()=>{
 for(const kind of Object.keys(IMPACTS)){
  const a=renderImpact(kind,48000),b=renderImpact(kind,48000);
  assert.deepEqual(a,b);assert.equal(a[0],0);assert.ok(Math.abs(a.at(-1))<1e-5);
  let peak=0,energy=0;for(const s of a){assert.ok(Number.isFinite(s));peak=Math.max(peak,Math.abs(s));energy+=s*s;}
  assert.ok(peak>.005&&peak<=.13);assert.ok(energy>0);assert.ok(a.length<48000*.3);
 }
 assert.throws(()=>renderImpact('unknown',48000),/Unknown/);
});
