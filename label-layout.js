// Anchored labels: collision handling changes visibility, never geographic position.
export function resolveLabelVisibility(candidates,viewport){
  const accepted=[],visible=new Set();
  const ordered=candidates.slice().sort((a,b)=>b.priority-a.priority||Number(b.wasVisible)-Number(a.wasVisible)||a.order-b.order);
  for(const label of ordered){
    if(label.depth<=0||!label.enabled)continue;
    const inset=label.wasVisible?-8:8;
    if(label.x-label.width/2<viewport.left+inset||label.x+label.width/2>viewport.right-inset||label.y-label.height/2<viewport.top+inset||label.y+label.height/2>viewport.bottom-inset)continue;
    const gap=label.wasVisible?1:9;
    if(accepted.some(other=>Math.abs(other.x-label.x)<(other.width+label.width)/2+gap&&Math.abs(other.y-label.y)<(other.height+label.height)/2+gap))continue;
    accepted.push(label);visible.add(label.key);
  }
  return visible;
}
export function stepLabelVisibility(state,wanted,now,dt,reducedMotion=false){
  if(state.candidate!==wanted){state.candidate=wanted;state.since=now;}
  const delay=wanted?160:220;
  if(state.target!==wanted&&now-state.since>=delay)state.target=wanted;
  const previous=state.opacity,target=state.target?1:0;
  state.opacity=reducedMotion?target:state.opacity+(target-state.opacity)*(1-Math.exp(-dt/0.065));
  if(Math.abs(state.opacity-target)<.005)state.opacity=target;
  return state.target!==wanted||state.opacity!==target||previous!==state.opacity;
}
