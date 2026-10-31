const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const heroSelect=document.querySelector('#heroBlockSelect'),heroLink=document.querySelector('#heroExploreBtn');
heroSelect?.addEventListener('change',()=>{
 const block=heroSelect.value;
 heroLink.href=block?`recorrido.html?manzana=${encodeURIComponent(block)}`:'recorrido.html';
});

const tabs=[...document.querySelectorAll('.gallery-tabs [role=tab]')];
let galleryAnimation;
function selectView(tab){
 if(tab.getAttribute('aria-selected')==='true')return;
 galleryAnimation?.cancel();
 for(const item of tabs){
  const active=item===tab;
  item.setAttribute('aria-selected',String(active));item.tabIndex=active?0:-1;
  document.getElementById(item.getAttribute('aria-controls')).hidden=!active;
 }
 const panel=document.getElementById(tab.getAttribute('aria-controls'));
 if(!reducedMotion.matches)galleryAnimation=panel.animate([{opacity:.35},{opacity:1}],{duration:180,easing:'cubic-bezier(.23,1,.32,1)'});
}
for(const [index,tab] of tabs.entries()){
 tab.addEventListener('click',()=>selectView(tab));
 tab.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  let next;
  if(event.key==='ArrowRight')next=(index+1)%tabs.length;
  if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
  if(event.key==='Home')next=0;
  if(event.key==='End')next=tabs.length-1;
  if(next===undefined)return;
  event.preventDefault();tabs[next].focus();selectView(tabs[next]);
 });
}

const dialog=document.querySelector('#terrain-video-dialog'),video=dialog.querySelector('video');
let videoTrigger;
for(const button of document.querySelectorAll('[data-open-terrain]'))button.addEventListener('click',()=>{
 videoTrigger=button;
 if(!video.getAttribute('src'))video.src=video.dataset.src;
 dialog.showModal();
 video.play().catch(()=>{/* Native controls remain available when autoplay is blocked. */});
});
dialog.querySelector('.video-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
dialog.addEventListener('close',()=>{video.pause();videoTrigger?.focus({preventScroll:true});});
document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();});

// Only animate the newly revealed content; summaries respond immediately to input.
for(const detail of document.querySelectorAll('.amenity-card'))detail.addEventListener('toggle',()=>{
 if(!detail.open||reducedMotion.matches)return;
 detail.querySelector('.amenity-card-detail').animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:200,easing:'cubic-bezier(.23,1,.32,1)'});
});
