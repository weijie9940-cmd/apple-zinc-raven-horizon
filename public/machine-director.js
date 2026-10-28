export function arrivalManifest(balls,lengths,route={}) {
  const entries=balls.map((ball,id)=>{
    const fraction=Math.max(0,Math.min(1,(ball.s||0)/(lengths[ball.track]||1)));
    let stage,progress;
    if(ball.mode==='carried'){stage='提升';progress=0.08;}
    else if(ball.mode==='inlet'){stage='入孔';progress=0.55;}
    else if(ball.mode==='pipe'){stage='落管';progress=0.6;}
    else if(ball.track===0){stage='螺旋';progress=0.2+fraction*0.3;}
    else if(ball.track===1){stage='接应';progress=0.63+fraction*0.06;}
    else if(ball.track===2){stage='波浪';progress=0.7+fraction*0.12;}
    else if(ball.track===route.responseIndex){stage=ball.v<0.05?'等待放行':'低音回应';progress=.84+fraction*.13;}
    else if(ball.track===3&&route.joinS!=null&&ball.s<route.joinS&&ball.v<.05){stage='等待放行';progress=.84+fraction*.14;}
    else if(ball.track===3||ball.track===4){
      stage=ball.v<0.05?'已归队':'回流';
      progress=stage==='已归队'?1:ball.track===4?0.99:0.84+fraction*0.14;
    }else{stage='出斗';progress=0.16+fraction*0.03;}
    return {id,stage,progress};
  });
  const moving=entries.filter(b=>b.stage!=='已归队');
  const last=moving.reduce((candidate,b)=>!candidate||b.progress<candidate.progress?b:candidate,null);
  const counts=new Map();entries.forEach(b=>counts.set(b.stage,(counts.get(b.stage)||0)+1));
  return {
    balls:entries,queued:entries.length-moving.length,remaining:moving.length,lastMoving:last?.id ?? null,
    progress:entries.length?entries.reduce((sum,b)=>sum+b.progress,0)/entries.length:0,
    summary:[...counts].map(([stage,n])=>`${stage} ${n}`).join(' · '),
  };
}

export function performanceShot(show,manifest,reducedMotion=false) {
  if(show.phase==='cruising')return null;
  if(show.phase==='overture')return {kind:'piano',label:'主旋律与低音，交替谢幕'};
  if(show.phase==='releasing')return {kind:'curtain',label:'开闸，等待最后一颗球'};
  if(show.phase==='encore')return {kind:'curtain',label:'终止钟声 · 新一幕'};
  if(reducedMotion)return {kind:'wide',label:'等待滚珠归队'};
  if(show.elapsed<5&&manifest.balls?.[0]?.stage!=='已归队')return {kind:'traveller',ball:0,label:'指挥球领场'};
  if(show.elapsed<10||!manifest.remaining)return {kind:'wide',label:'等待滚珠归队'};
  return {kind:'traveller',ball:manifest.lastMoving,label:`等待 ${manifest.lastMoving+1} 号球归队`};
}
