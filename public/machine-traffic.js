// Candidates have committed tickets before the shared corridor. Downstream
// traffic leads; arrivals then keep FIFO order and follow a moving headway.
export function mergeFlow(candidates,gap) {
 const ordered=candidates.map(b=>({...b})).sort((a,b)=>{
  if(a.ticket==null&&b.ticket==null)return b.progress-a.progress;
  if(a.ticket==null)return -1;if(b.ticket==null)return 1;
  return a.ticket-b.ticket;
 });
 for(let i=1;i<ordered.length;i++) {
  const leader=ordered[i-1],ball=ordered[i],limit=leader.progress-gap;
  if(ball.progress>limit) {
   ball.progress=Math.max(ball.minimum??-Infinity,limit);
   ball.v=ball.progress>limit?0:Math.min(ball.v,leader.v);
  }
 }
 return ordered;
}
