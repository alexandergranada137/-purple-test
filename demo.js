// Static presentation adapter. Never stores leads, credentials or admin data.
(()=>{
 const nativeFetch=window.fetch.bind(window),base=new URL('.',document.baseURI);let catalogPromise;
 const snapshot=()=>catalogPromise??=nativeFetch(new URL('catalog-snapshot.json',base)).then(r=>{if(!r.ok)throw Error('Catálogo de muestra no disponible');return r.json();});
 window.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url||String(input),location.href);
  if(url.origin===location.origin&&url.pathname.startsWith('/api/')){
   const method=(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
   if(method!=='GET')return Response.json({ok:false,message:'Demostración de presentación: no se registran solicitudes ni cambios.'},{status:409});
   if(url.pathname==='/api/catalogo'){const response=await nativeFetch(new URL('catalog-snapshot.json',base),{signal:options.signal});return response;}
   if(url.pathname==='/api/contenido')return nativeFetch(new URL('content-snapshot.json',base),{signal:options.signal});
   if(url.pathname==='/api/config')return Response.json({ok:true,config:{}});
   return Response.json({ok:false,message:'Esta función pertenece al panel privado.'},{status:401});
  }
  return nativeFetch(input,options);
 };
 document.addEventListener('DOMContentLoaded',()=>{
  const banner=document.createElement('p');banner.className='demo-notice';banner.textContent='Demostración de presentación · Las solicitudes y reservas están desactivadas.';const header=document.querySelector('.site-header');if(header)header.after(banner);else document.body.prepend(banner);
  for(const form of document.querySelectorAll('#visitForm,#quoteForm')){
   const message=document.createElement('p');message.className='demo-form-note';message.textContent='Vista de demostración. Aquí puedes conocer el proceso; no se envían ni se guardan datos.';form.prepend(message);
   if(form.id==='visitForm')for(const control of form.querySelectorAll('input,select,textarea,button'))control.disabled=true;
   else{const lock=()=>{const groups=form.querySelectorAll('fieldset');if(groups[1]&&!groups[1].disabled)groups[1].disabled=true;for(const control of form.querySelectorAll('button[type=submit],.consent-label input'))if(!control.disabled)control.disabled=true;};lock();new MutationObserver(lock).observe(form,{subtree:true,attributes:true,attributeFilter:['disabled'],childList:true});}
   form.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();},true);
  }
  const status=document.querySelector('#catalogStatus');if(status)snapshot().then(data=>{const text='Catálogo de referencia · '+new Date(data.generated).toLocaleDateString('es-PE')+'. Confirma disponibilidad con el equipo.';const sync=()=>{if(status.textContent!==text)status.textContent=text;};new MutationObserver(sync).observe(status,{childList:true,characterData:true,subtree:true});sync();}).catch(()=>{});
 });
})();
