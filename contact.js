const visitDateInput=document.querySelector('#visitDate');
const today=new Date();visitDateInput.min=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
const visitForm=document.querySelector('#visitForm');let visitSending=false;let visitRequest=crypto.randomUUID();
visitForm.onsubmit=async event=>{
 event.preventDefault();if(visitSending)return;
 const message=document.querySelector('#visitStatus'),submit=visitForm.querySelector('button[type=submit]');
 visitSending=true;submit.disabled=true;const originalLabel=submit.textContent;submit.textContent='Registrando solicitud…';message.tabIndex=-1;message.className='form-message';message.textContent='Registrando tu solicitud…';
 const date=visitDateInput.value||'Por coordinar',time=document.querySelector('#visitTime').value||'Por coordinar';
 try{
  const r=await fetch('/api/clientes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:visitRequest,name:document.querySelector('#visitName').value,email:document.querySelector('#visitEmail').value,phone:document.querySelector('#visitPhone').value,message:`Visita al proyecto. Fecha preferida: ${date}. Horario: ${time}.`,currency:'PEN',consent:document.querySelector('#visitConsent').checked})});
  const data=await r.json();if(!r.ok)throw new Error(data.message||'No pudimos registrar la solicitud.');
  visitForm.hidden=true;
  const confirmation=document.createElement('section');confirmation.className='visit-confirmation';confirmation.tabIndex=-1;confirmation.setAttribute('aria-labelledby','visit-success-title');
  const heading=document.createElement('h2');heading.id='visit-success-title';heading.textContent='Tu visita empieza aquí.';
  const detail=document.createElement('p');detail.textContent='Recibimos tu solicitud. Nuestro equipo te contactará para confirmar la fecha, la hora y el punto de encuentro.';
  const preference=document.createElement('p');preference.className='visit-preference';preference.textContent=date==='Por coordinar'?'Fecha por coordinar con el equipo.':`Tu preferencia: ${new Intl.DateTimeFormat('es-PE',{dateStyle:'long'}).format(new Date(date+'T12:00:00'))}. Horario: ${time}.`;
  const explore=document.createElement('a');explore.href='recorrido.html';explore.className='button';explore.textContent='Explorar los lotes antes de ir';
  const again=document.createElement('button');again.type='button';again.className='text-link';again.textContent='Enviar otra solicitud';again.onclick=()=>{confirmation.remove();visitForm.reset();visitForm.hidden=false;message.textContent='';document.querySelector('#visitName').focus();};
  confirmation.append(heading,detail,preference,explore,again);visitForm.after(confirmation);confirmation.focus();visitRequest=crypto.randomUUID();
  window.dispatchEvent(new CustomEvent('morada:lead',{detail:{currency:'PEN'}}));
 }catch(error){message.textContent=error.message||'No pudimos conectar. Tus datos siguen aquí; vuelve a intentarlo.';message.className='form-message error';message.focus();}
 finally{visitSending=false;submit.disabled=false;submit.textContent=originalLabel;}
};
