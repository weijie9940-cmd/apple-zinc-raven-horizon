export const IMPACTS=Object.freeze({
 wood:Object.freeze({duration:.22,decay:29,level:.11,tones:[270,617,1180]}),
 open:Object.freeze({duration:.08,decay:65,level:.025,tones:[1120,2340,3510]}),
 stop:Object.freeze({duration:.12,decay:46,level:.055,tones:[870,1920,3210]}),
 latch:Object.freeze({duration:.10,decay:55,level:.04,tones:[1460,2930,4270]}),
});

export function renderImpact(kind,sampleRate){
 const profile=IMPACTS[kind];if(!profile)throw Error('Unknown mechanical impact');
 const data=new Float32Array(Math.ceil(profile.duration*sampleRate));
 for(let i=0;i<data.length;i++){
  const t=i/sampleRate,attack=Math.min(1,t/.002),tail=Math.min(1,(data.length-1-i)/sampleRate/.015);
  const wave=profile.tones.reduce((sum,f,n)=>sum+Math.sin(2*Math.PI*f*t)*[1,.30,.12][n],0)/1.42;
  data[i]=wave*profile.level*attack*tail*Math.exp(-t*profile.decay);
 }
 return data;
}

const crossed=(before,after,mark,loop)=>before!==after&&(before<after?before<mark&&mark<=after:mark>before||mark<=after);
export function mechanicalCues(before,after,cycle){
 const events=[];
 if(before.loading&&after.loading&&before.loading.bucket===after.loading.bucket){
  for(const [time,kind] of [[.12,'open'],[.77,'stop'],[1.05,'wood']])
   if(before.loading.elapsed<time&&after.loading.elapsed>=time)events.push(kind);
 }
 const latch=((cycle.releaseS+.55)%cycle.loop+cycle.loop)%cycle.loop;
 before.positions.forEach((s,i)=>{if(crossed(s,after.positions[i],latch,cycle.loop))events.push('latch');});
 return events;
}

// Cached mono buffers, one-shot voices, and bounded overlap share the music bus.
export function createImpactVoices(context,output){
 const buffers=new Map(),voices=new Set(),counts={wood:0,open:0,stop:0,latch:0};
 function stop(){for(const voice of voices){voice.stop();voice.disconnect();}voices.clear();}
 return {
  play(kind){
   if(!IMPACTS[kind]||voices.size>=8)return false;
   if(!buffers.has(kind)){const data=renderImpact(kind,context.sampleRate),buffer=context.createBuffer(1,data.length,context.sampleRate);buffer.copyToChannel(data,0);buffers.set(kind,buffer);}
   const source=context.createBufferSource();source.buffer=buffers.get(kind);source.connect(output);voices.add(source);counts[kind]++;
   source.onended=()=>{source.disconnect();voices.delete(source);};source.start();return true;
  },
  stop,
  state:()=>({counts:{...counts},voices:voices.size}),
 };
}
