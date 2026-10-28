import * as THREE from 'three';
import { crossedChime, normalizeScore, nextPitch, DEFAULT_SCORE, PITCHES, hammerMotion } from './machine-music.js';

const SAVE_KEY = 'marble-atelier:piano:v1';
const colors = [0xd49aa8, 0xdbad85, 0xd6bc76, 0x91b4a2, 0x8bb4c2, 0xaaa2bf];

export function createPianoBridge({track, centerAt, sampleAt, wood, metal, chimes, response=false,trackId=3}) {
  const group = new THREE.Group();
  group.name = response?'response-piano-bridge':'piano-bridge';
  let notes;
  try { notes = response?[0,2,4]:normalizeScore(JSON.parse(localStorage.getItem(SAVE_KEY))); }
  catch { notes = [...DEFAULT_SCORE]; }
  const timber = wood.clone(); timber.color.setHex(0xc4a77e);
  const brass = metal.clone(); brass.color.setHex(0xb79b64); brass.roughness = 0.4;
  const dark = new THREE.MeshStandardMaterial({color:0x46565a, roughness:0.65});
  const pickable = [];
  const palette=response?[0xb2a5c8,0xa3b3ca,0x99bdb6]:colors;
  let lastPlayed = -1;
  const mesh = (parent, geometry, material, name, x, y, z) => {
    const object = new THREE.Mesh(geometry, material);
    object.name = response?name.replace('piano/','response-piano/'):name; object.position.set(x,y,z); object.castShadow = true; object.receiveShadow = true;
    parent.add(object); return object;
  };
  const modules = Array.from({length:response?3:6}, (_, index) => {
    // The gently sloping back of the return track is the shared music bed.
    const s = track.total * (response?0.42+index*0.09:0.47 + index * 0.039);
    const p = centerAt(s), tangent = sampleAt(s).tangent;
    const root = new THREE.Group(); root.name = `${response?'response-piano':'piano'}/${index+1}`;
    root.position.set(p.x,p.y,p.z);
    // A right-handed basis keeps +Z pointing into the machine, away from its frame.
    const along = new THREE.Vector3(tangent.x,0,tangent.z).normalize();
    const inward = new THREE.Vector3(-along.z,0,along.x);
    if (inward.z < 0) { along.negate(); inward.negate(); }
    root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(along, new THREE.Vector3(0,1,0), inward));
    group.add(root);
    mesh(root,new THREE.BoxGeometry(0.49,0.1,0.92),timber,'piano/bed',0,-0.23,0.75);
    for (const z of [0.4,1.08]) {
      mesh(root,new THREE.BoxGeometry(0.1,p.y-0.41,0.1),timber,'piano/foot',0,-(p.y-0.41)/2-0.23,z);
    }
    for (const x of [-0.17,0.17]) {
      mesh(root,new THREE.BoxGeometry(0.055,0.48,0.07),timber,'piano/bearing',x,0.08,0.37);
    }
    const axle = mesh(root,new THREE.CylinderGeometry(0.035,0.035,0.43,12),brass,'piano/axle',0,0.32,0.37);
    axle.rotation.z = Math.PI/2;
    const lever = new THREE.Group(); lever.name = 'piano/lever'; lever.position.set(0,0.32,0.37); root.add(lever);
    mesh(lever,new THREE.BoxGeometry(0.055,0.04,0.39),brass,'piano/lever-arm',0,-0.055,-0.18);
    const roller = mesh(lever,new THREE.CylinderGeometry(0.065,0.065,0.075,16),dark,'piano/roller',0,-0.091,-0.37);
    roller.rotation.z = Math.PI/2;
    const hammer = new THREE.Group(); hammer.name = 'piano/hammer'; hammer.position.set(0,0.32,0.37); root.add(hammer);
    mesh(hammer,new THREE.BoxGeometry(0.055,0.055,0.48),timber,'piano/hammer-arm',0,0,0.24);
    mesh(hammer,new THREE.SphereGeometry(0.07,14,10),dark,'piano/hammer-head',0,0,0.48);
    hammer.rotation.x = -0.18;
    // An eccentric cam and follower let the same hammers play the curtain call.
    const cam=mesh(root,new THREE.CylinderGeometry(0.1,0.1,0.06,16),brass,'piano/curtain-cam',0.12,0.15,0.37);
    cam.rotation.z=Math.PI/2;
    const follower=mesh(root,new THREE.BoxGeometry(0.035,0.18,0.035),brass,'piano/cam-follower',0.12,0.23,0.37);
    const platePivot = new THREE.Group(); platePivot.position.set(0,0.01,0.83); root.add(platePivot);
    const plateMaterial = new THREE.MeshStandardMaterial({color:palette[index],metalness:0.4,roughness:0.38,emissive:palette[index],emissiveIntensity:0});
    const plate = mesh(platePivot,new THREE.BoxGeometry(0.38,0.055,0.76),plateMaterial,'piano/plate',0,0,0);
    plate.userData.pianoIndex = index; pickable.push(plate);
    for (const z of [-0.22,0.22]) {
      mesh(platePivot,new THREE.SphereGeometry(0.024,8,6),brass,'piano/pin',0,0.038,z);
    }
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const label = mesh(platePivot,new THREE.PlaneGeometry(0.29,0.29),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}),'piano/label',0,0.03,0.03);
    label.rotation.x = -Math.PI/2; label.rotateZ(Math.PI); label.castShadow=false; label.receiveShadow=false;
    label.userData.pianoIndex = index; pickable.push(label);
    return {root, s, track:trackId, lever, roller, hammer, cam, follower, autoAge:Infinity, platePivot, plate, canvas, texture, age:Infinity, strikes:0};
  });

  function paint(index) {
    const m = modules[index], pitch = notes[index], note = pitch === null ? '—' : PITCHES[pitch].label;
    const ctx = m.canvas.getContext('2d'); ctx.clearRect(0,0,128,128);
    ctx.fillStyle = '#283d48'; ctx.textAlign = 'center';
    ctx.font = '500 25px Arial'; ctx.fillText(String(index+1).padStart(2,'0'),64,37);
    ctx.font = 'bold 36px Arial'; ctx.fillText(note,64,88);
    m.texture.needsUpdate = true;
    m.plate.scale.z = pitch === null ? 0.72 : 1.12 - pitch * 0.045;
    m.plate.material.color.setHex(pitch === null ? 0xc8cbc5 : palette[index]);
    const button = response?null:document.querySelector(`[data-piano-note="${index}"]`);
    if (button) {
      button.querySelector('strong').textContent = note;
      button.setAttribute('aria-label', `琴片 ${index+1}：${pitch === null ? '空拍' : note}，点击切换音符`);
      button.dataset.rest = String(pitch === null);
    }
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY,JSON.stringify({version:1, notes})); }
    catch { /* Private or full storage still allows composing for this visit. */ }
  }
  function cycle(index) {
    if(response)return;
    if (!Number.isInteger(index) || index < 0 || index >= 6) return;
    notes[index] = nextPitch(notes[index]); paint(index); save();
    const status = document.getElementById('piano-feedback');
    if (status) status.textContent = `琴片 ${index+1} · ${notes[index] === null ? '空拍' : PITCHES[notes[index]].label}`;
  }
  modules.forEach((_,i) => paint(i));
  function play(index, automatic=false) {
    const m=modules[index];
    if(!m||notes[index]===null) return;
    m.age=0;m.strikes++;lastPlayed=index;
    if(automatic)m.autoAge=0;
    chimes.strike(response?7+index:index,notes[index],response?-1:0);
  }
  return {
    group, pickable, cycle, play,
    resetScore() { notes = [...DEFAULT_SCORE]; modules.forEach((_,i)=>paint(i)); save(); },
    resetMotion() { modules.forEach(m=>{m.age=Infinity;m.autoAge=Infinity;}); lastPlayed=-1; },
    cross(previous, balls) {
      modules.forEach((m,index) => {
        if (balls.some((b,i)=>crossedChime(previous[i],b,m))) {
          // Rest plates disengage their hammer; the roller still follows the ball.
          if (notes[index] !== null) {
            play(index);
          }
        }
      });
    },
    update(dt, balls) {
      modules.forEach((m,index) => {
        m.age += dt;
        m.autoAge += dt;
        const camLift=m.autoAge<0.6?Math.max(0,Math.cos(m.autoAge*7))*0.045:0;
        m.cam.position.y=0.15+camLift;
        m.cam.rotation.x=m.autoAge<0.6?Math.min(Math.PI*2,m.autoAge/0.6*Math.PI*2):0;
        m.follower.position.y=0.23+camLift;
        const motion = hammerMotion(m.age);
        const near = balls.reduce((distance,b)=>b.mode==='track' && b.track===trackId ? Math.min(distance,Math.abs(b.s-m.s)) : distance,Infinity);
        m.lever.rotation.x = Math.max(0,1-near/0.3)*0.13;
        m.roller.rotation.x += dt * Math.max(0,1-near/0.3)*8;
        m.hammer.rotation.x = notes[index] === null ? -0.5 : motion.angle;
        m.platePivot.rotation.z = motion.vibration;
        const ringing = m.age < 0.6;
        m.plate.material.emissiveIntensity = ringing ? Math.exp(-m.age*8)*0.35 : 0;
        const button = response?null:document.querySelector(`[data-piano-note="${index}"]`);
        if (button && button.hasAttribute('data-playing') !== ringing) {
          if (ringing) button.setAttribute('data-playing',''); else button.removeAttribute('data-playing');
        }
      });
    },
    state: () => ({notes:[...notes], lastPlayed, modules:modules.map(m=>({s:m.s,strikes:m.strikes,angle:m.hammer.rotation.x,vibration:m.platePivot.rotation.z}))}),
  };
}
