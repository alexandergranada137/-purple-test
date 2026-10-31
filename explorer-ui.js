// Mobile presentation only: no scene, geometry or camera changes.
(()=>{
 const mobile=matchMedia('(max-width:760px)');
 const options=document.querySelector('.scene-options'),legend=document.querySelector('.legend-disclosure');
 const sync=()=>{for(const panel of [options,legend])if(panel)panel.open=!mobile.matches;};sync();mobile.addEventListener('change',sync);
 options?.addEventListener('click',event=>{if(mobile.matches&&event.target.closest('button'))options.open=false;});
 const info=document.querySelector('#lotInfo'),link=document.querySelector('.mobile-selection-link'),list=document.querySelector('#lotList');
 const update=()=>{if(!link)return;link.hidden=!document.querySelector('.explorer-panel.has-selection');if(!link.hidden)link.textContent=list.value?'Ver ficha · '+list.value:'Ver ficha del lote';};
 if(info)new MutationObserver(update).observe(info,{childList:true,subtree:true});update();
})();
