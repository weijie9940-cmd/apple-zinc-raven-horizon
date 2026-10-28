import {createImpactVoices} from './machine-sound.js';

export function crossedChime(before, after, point) {
  return Boolean(before && after.mode === 'track' && after.track === point.track && after.s >= point.s &&
    (before.mode !== 'track' || before.track !== point.track || before.s < point.s));
}

export const DEFAULT_SCORE = Object.freeze([0, 2, 4, 5, 4, 2]);
export const PITCHES = Object.freeze([
  {label:'Do', frequency:523.25}, {label:'Re', frequency:587.33},
  {label:'Mi', frequency:659.25}, {label:'Fa', frequency:698.46},
  {label:'Sol', frequency:783.99}, {label:'La', frequency:880},
  {label:'Si', frequency:987.77}, {label:'Do↑', frequency:1046.5},
]);
export function normalizeScore(value) {
  return value?.version === 1 && Array.isArray(value.notes) && value.notes.length === 6 &&
    value.notes.every(n => n === null || Number.isInteger(n) && n >= 0 && n < PITCHES.length)
    ? [...value.notes] : [...DEFAULT_SCORE];
}
export const nextPitch = pitch => pitch === null ? 0 : pitch === 7 ? null : pitch + 1;

// Impact, quick rebound and spring settling are driven by simulation time.
export function hammerMotion(age) {
  if (age >= 0.8) return {angle:-0.18, vibration:0};
  return {
    angle:age <= 0.025 ? 0.45 : -0.18 + 0.63 * Math.exp(-(age-0.025) * 9) * Math.cos((age-0.025) * 20),
    vibration:Math.sin(age * 105) * Math.exp(-age * 8) * 0.012,
  };
}

export function createChimes() {
  let context, output, effects, audible=false, enabled = false, strikes = 0, bells = 0;
  const recent = Array(10).fill(-Infinity);
  function sound(index,pitch,bell=false,octave=0) {
    if(pitch===null||!PITCHES[pitch]||!enabled||context.state!=='running'||document.hidden)return;
    const now=context.currentTime;
    if(now-recent[index]<0.075)return;
    recent[index]=now;strikes++;if(bell)bells++;
    const ratios=bell?[1,2,3.05]:[1,2.76];
    ratios.forEach((ratio,partial)=>{
      const oscillator=context.createOscillator(),gain=context.createGain();
      oscillator.frequency.value=PITCHES[pitch].frequency*ratio*2**octave;
      gain.gain.setValueAtTime(0,now);
      gain.gain.linearRampToValueAtTime(partial?0.045:0.2,now+0.006);
      const decay=bell?2.1:partial?0.35:1.1;
      gain.gain.exponentialRampToValueAtTime(0.0001,now+decay);
      oscillator.connect(gain);gain.connect(output);oscillator.start(now);oscillator.stop(now+decay+0.05);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    });
  }
  return {
    async enable(value) {
      enabled = false;
      audible=false;effects?.stop();
      if (output) { output.gain.cancelScheduledValues(context.currentTime); output.gain.setValueAtTime(0,context.currentTime); }
      if (!value) return false;
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('此浏览器暂不支持声音');
      context ||= new Audio();
      if (!output) { output = context.createGain(); output.gain.value = 0; output.connect(context.destination); }
      effects ||= createImpactVoices(context,output);
      await context.resume();
      enabled = context.state === 'running';
      return enabled;
    },
    active(value) {
      audible=enabled&&value;
      if(!audible)effects?.stop();
      if (!output) return;
      if(audible&&context.state==='suspended')context.resume().catch(()=>{});
      output.gain.cancelScheduledValues(context.currentTime);
      output.gain.setTargetAtTime(enabled && value ? 0.3 : 0, context.currentTime, 0.015);
    },
    strike(index, pitch = index,octave=0) {
      sound(index,pitch,false,octave);
    },
    bell(){sound(6,7,true);},
    mechanical(kind){if(enabled&&audible&&context.state==='running'&&!document.hidden)effects.play(kind);},
    state: () => ({ enabled, strikes, bells, mechanical:effects?.state()||{counts:{wood:0,open:0,stop:0,latch:0},voices:0}, context: context?.state || 'uninitialized' }),
  };
}
