// Compact, keyboard-accessible navigation on phones; desktop links stay visible.
(()=>{const header=document.querySelector('.site-header'),nav=header?.querySelector('nav');if(!nav)return;const mobile=matchMedia('(max-width:760px)');const toggle=document.createElement('button');toggle.type='button';toggle.className='navigation-toggle';toggle.textContent='Menú';nav.id='site-navigation';toggle.setAttribute('aria-controls',nav.id);toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Abrir navegación');header.insertBefore(toggle,nav);
 const sync=()=>{nav.hidden=mobile.matches;toggle.setAttribute('aria-expanded',String(!nav.hidden));toggle.textContent='Menú';toggle.setAttribute('aria-label','Abrir navegación');};sync();mobile.addEventListener('change',sync);toggle.onclick=()=>{nav.hidden=!nav.hidden;toggle.setAttribute('aria-expanded',String(!nav.hidden));toggle.textContent=nav.hidden?'Menú':'Cerrar';toggle.setAttribute('aria-label',nav.hidden?'Abrir navegación':'Cerrar navegación');};header.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobile.matches&&!nav.hidden){nav.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.textContent='Menú';toggle.setAttribute('aria-label','Abrir navegación');toggle.focus();}});
})();
// Global site utilities and interactive form logic for La Morada

let savedCurrency;try{savedCurrency=localStorage.getItem('morada-currency');}catch{}
let selectedCurrency = (new URLSearchParams(location.search).get('moneda') || savedCurrency) === 'USD' ? 'USD' : 'PEN';
const currencyPicker = document.createElement('select');
currencyPicker.setAttribute('aria-label','Moneda de los precios');
currencyPicker.innerHTML = '<option value="PEN">Soles · S/</option><option value="USD">Dólares · US$</option>';
currencyPicker.value = selectedCurrency;
const quoteCurrencyHost=document.querySelector('#quoteCurrencySlot')||document.querySelector('.form-intro');
if(quoteCurrencyHost){const label=document.createElement('label');label.className='quote-currency';label.textContent='Moneda de la cotización';label.append(currencyPicker);quoteCurrencyHost.append(label);}
const selectedCents = price => selectedCurrency === 'USD' ? price?.usd_cents : price?.cents;
// Independent published prices: no exchange rate.
const money = value => new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: selectedCurrency,
  maximumFractionDigits: 2
}).format(value || 0);

// 2. Cotizador and Financing Simulator Logic
(function initQuoteForm() {
  const form = document.querySelector('#quoteForm');
  if (!form) return;

  const blockSelect = document.querySelector('#quoteBlock');
  const lotSelect = document.querySelector('#quoteLot');
  const quoteState = document.querySelector('#quoteState');
  const whatsappBtn = document.querySelector('#whatsappDirectBtn');

  const simDownAmount = document.querySelector('#simDownAmount');
  const simMonthlyAmount = document.querySelector('#simMonthlyAmount');

  let currentDownPct = 50;
  let currentMonths = 36; // 36 months default

  let catalogue = [];
  let catalogueVerified = false;

  // Parse URL query parameters (?manzana=B&lote=4)
  const urlParams = new URLSearchParams(window.location.search);
  const chosenBlock = urlParams.get('manzana');
  const chosenLot = urlParams.get('lote');

  if (chosenBlock && /^[a-k]$/i.test(chosenBlock)) {
    blockSelect.value = chosenBlock.toUpperCase();
  }

  // Fetch prices from API with robust fallback to lots.json
  let catalogueLoading=false;
  async function loadCatalogue() {
    if(catalogueLoading)return;catalogueLoading=true;const previousLot=lotSelect.value;blockSelect.disabled=true;lotSelect.disabled=true;quoteState.setAttribute('aria-busy','true');window.MoradaLoading?.skeleton(quoteState);
    try {
      const r = await fetch('/api/catalogo');
      if (r.ok) {
        const data = await r.json();
        if (data?.lots?.length) {
          catalogue = data.lots;catalogueVerified=true;
          populateLots();
          if(previousLot||chosenLot)lotSelect.value=String(Number(previousLot||chosenLot));updateQuoteDisplay();
          return;
        }
      }
      throw new Error('API catalogue empty or unavailable');
    } catch {
      catalogueVerified=false;
      // Graceful fallback to static lots.json
      try {
        const fallbackRes = await fetch('lots.json');
        if (!fallbackRes.ok)throw new Error('No se pudo cargar el catálogo.');
        if (fallbackRes.ok) {
          const lots = await fallbackRes.json();
          catalogue = lots.map(l => ({ ...l, price: null }));
          populateLots();
          if(previousLot||chosenLot)lotSelect.value=String(Number(previousLot||chosenLot));updateQuoteDisplay();
        }
      } catch (e) {
        console.error('Catalogue fallback error:', e);
        if (quoteState)quoteState.textContent='No se pudieron cargar los lotes. Revisa tu conexión y pulsa Reintentar en el aviso.';
      }
    }finally{catalogueLoading=false;blockSelect.disabled=false;lotSelect.disabled=false;quoteState.setAttribute('aria-busy','false');if(!catalogue.length){form.dataset.ready='false';form.querySelector('button[type=submit]').disabled=true;}}
  }

  window.addEventListener('morada:retry',loadCatalogue);



  function populateLots() {
    const selectedBlock = blockSelect.value;
    const filtered = catalogue
      .filter(x => !selectedBlock || x.block === selectedBlock)
      .sort((a, b) => a.lot - b.lot);

    if (!selectedBlock) {
      lotSelect.innerHTML = '<option value="">Primero elige una manzana</option>';
      return;
    }

    if (!filtered.length) {
      lotSelect.innerHTML = '<option value="">No hay lotes registrados</option>';
      return;
    }

    lotSelect.innerHTML = '<option value="">Selecciona un lote</option>' +
      filtered.map(x => {
        const st = x.price?.status;
        const tag = st === 'sold' ? ' (Vendido)' : (st === 'separated' ? ' (Separado)' : '');
        return `<option value="${x.lot}">Lote ${String(x.lot).padStart(2, '0')}${tag}</option>`;
      }).join('');
  }

  function currentLot() {
    const bVal = blockSelect.value;
    const lVal = Number(lotSelect.value);
    if (!bVal || !lVal) return null;
    return catalogue.find(x => x.block === bVal && Number(x.lot) === lVal) || null;
  }

  function updateFinancing(totalPrice) {
    if (!simDownAmount || !simMonthlyAmount) return;
    document.querySelector('#simulatorCard').hidden=!(totalPrice>0);

    if (!totalPrice || totalPrice <= 0) {
      simDownAmount.textContent = 'Por confirmar';
      simMonthlyAmount.textContent = 'Por confirmar';
      return;
    }

    const downPayment = totalPrice * (currentDownPct / 100);
    const balance = totalPrice - downPayment;
    const monthly = balance / currentMonths;

    simDownAmount.textContent = money(downPayment);
    simMonthlyAmount.textContent = `${money(monthly)} / mes`;
  }

  function updateWhatsAppLink() {
    if (!whatsappBtn) return;
    const item = currentLot();
    const name = document.querySelector('#userName')?.value.trim() || 'Interesado';
    const price = item?.price;
    const total = price ? (selectedCents(price) / 100) : 0;
    const area = price?.area; 

    let text = `¡Hola La Morada! Mi nombre es ${name}.`;
    if (item) {
      text += ` Estoy interesado en cotizar el *Lote ${item.id}* (Manzana ${item.block}, Lote ${item.lot}).`;
      if (total > 0) {
        text += ` ${area ? `Área: ${area} m², ` : ''}Precio: ${money(total)}.`;
      }
      text += ` Me gustaría conocer facilidades de financiamiento directo y coordinar una visita al proyecto.`;
    } else {
      text += ` Quisiera información general sobre los lotes disponibles en La Morada y coordinar una visita.`;
    }

    whatsappBtn.href = `https://api.whatsapp.com/send?phone=51966030329&text=${encodeURIComponent(text)}`;
  }

  function updateQuoteDisplay() {
    const item = currentLot();
    const price = item?.price;
    const unavailable=['B','I'].includes(item?.block)||['sold','separated','blocked'].includes(price?.status);
    const ready=Boolean(item)&&!unavailable;
    form.dataset.ready=String(ready);
    const submitButton=form.querySelector('button[type=submit]');submitButton.disabled=!ready;
    submitButton.textContent=document.querySelector('#requestType').value==='hold'?'Solicitar separación':'Solicitar cotización';
    const holdOption=document.querySelector('#requestType option[value=hold]');holdOption.disabled=!catalogueVerified||price?.status!=='available';
    if(holdOption.disabled&&document.querySelector('#requestType').value==='hold'){document.querySelector('#requestType').value='quote';submitButton.textContent='Solicitar cotización';}
    const backLink=document.querySelector('.form-intro .back');
    if(backLink)backLink.href=item?`recorrido.html?lote=${encodeURIComponent(item.id)}&moneda=${selectedCurrency}`:'recorrido.html';
    const currentUrl=new URL(location.href);
    if(blockSelect.value)currentUrl.searchParams.set('manzana',blockSelect.value);else currentUrl.searchParams.delete('manzana');
    if(item)currentUrl.searchParams.set('lote',String(item.lot));else currentUrl.searchParams.delete('lote');
    currentUrl.searchParams.set('moneda',selectedCurrency);history.replaceState(null,'',currentUrl);
    if(unavailable){
      const label=['B','I'].includes(item.block)||price?.status==='blocked'?'Fuera de venta':price.status==='sold'?'Vendido':'Separado';
      quoteState.className='quote-state state-unavailable';quoteState.replaceChildren();
      const heading=document.createElement('strong');heading.textContent=`Lote ${item.id} · ${label}`;
      const note=document.createElement('p');note.textContent='Elige otro lote para consultar sus condiciones.';
      const alternative=document.createElement('a');alternative.className='text-link';alternative.href=`recorrido.html?manzana=${encodeURIComponent(item.block)}`;alternative.textContent='Ver otros lotes en el plano';
      quoteState.append(heading,note,alternative);updateFinancing(0);return;
    }

    if (!item) {
      quoteState.className = 'quote-state';
      quoteState.textContent = 'Primero elige tu lote. Podrás consultar su precio antes de dejar tus datos.';
      updateFinancing(0);
      updateWhatsAppLink();
      return;
    }

    if (!price || selectedCents(price) == null) {
      quoteState.className = 'quote-state';
      quoteState.innerHTML = `
        <span>Lote ${item.id} · Manzana ${item.block}</span>
        <strong>Precio por confirmar</strong>
        <small>${catalogueVerified?'Consulta con el equipo el precio en esta moneda.':'No pudimos confirmar precios ni disponibilidad. Puedes enviar una consulta al equipo.'}</small>
      `;
      updateFinancing(0);
      updateWhatsAppLink();
      return;
    }

    const base = selectedCents(price) / 100;
    const total = selectedCents(price) / 100;
    const discount = 0;
    const area = price.area;

    quoteState.className = 'quote-state state-available';
    quoteState.innerHTML = `
      <div class="quote-price-header">
        <span>Precio publicado · Lote ${item.id}</span>
        <span class="badge-avail">Disponible</span>
      </div>
      <div class="quote-price-row">
        <strong>${money(total)}</strong>
        ${discount > 0 ? `<del>${money(base)}</del><em>${discount}% dscto.</em>` : ''}
      </div>
      <div class="quote-details-row">
        ${area ? `<span>Área total: <b>${area} m²</b></span>` : ''}
        ${area ? `<span>Precio / m²: <b>${money(total / area)}</b></span>` : ''}
      </div>
    `;

    updateFinancing(total);
    updateWhatsAppLink();
  }

  // Simulator Pill Buttons
  document.querySelectorAll('#downPaymentGroup button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#downPaymentGroup button').forEach(b => {b.classList.remove('active');b.setAttribute('aria-pressed','false');});
      btn.classList.add('active');btn.setAttribute('aria-pressed','true');
      currentDownPct = Number(btn.dataset.down);
      const item = currentLot();
      const total = item?.price ? (selectedCents(item.price) / 100) : 0;
      updateFinancing(total);
    };
  });

  document.querySelectorAll('#termGroup button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#termGroup button').forEach(b => {b.classList.remove('active');b.setAttribute('aria-pressed','false');});
      btn.classList.add('active');btn.setAttribute('aria-pressed','true');
      currentMonths = [12,24,36].includes(Number(btn.dataset.months))?Number(btn.dataset.months):36;
      const item = currentLot();
      const total = item?.price ? (selectedCents(item.price) / 100) : 0;
      updateFinancing(total);
    };
  });

  blockSelect.onchange = () => {
    populateLots();
    updateQuoteDisplay();
  };

  lotSelect.onchange = updateQuoteDisplay;
  document.querySelector('#requestType').addEventListener('change',updateQuoteDisplay);
  document.querySelectorAll('.pill-btn').forEach(button=>button.setAttribute('aria-pressed',String(button.classList.contains('active'))));
  currencyPicker.addEventListener('change', () => { selectedCurrency=currencyPicker.value; try{localStorage.setItem('morada-currency',selectedCurrency);}catch{} updateQuoteDisplay(); });

  ['#userName', '#userEmail', '#userPhone', '#userMessage'].forEach(id => {
    document.querySelector(id)?.addEventListener('input', updateWhatsAppLink);
  });

  const consentLabel=document.createElement('label');consentLabel.className='consent-label';
  const consent=document.createElement('input');consent.type='checkbox';consent.required=true;consent.name='privacyConsent';
  consentLabel.append(consent,document.createTextNode(' Autorizo el uso de mis datos para responder esta solicitud. '));
  const privacyLink=document.createElement('a');privacyLink.href='privacidad.html';privacyLink.textContent='Información de privacidad (otra pestaña)';privacyLink.target='_blank';privacyLink.rel='noopener';consentLabel.append(privacyLink);form.querySelector('.action-buttons-group').before(consentLabel);
  const submissionStatus=document.createElement('p');submissionStatus.setAttribute('role','status');submissionStatus.className='form-message';submissionStatus.tabIndex=-1;form.append(submissionStatus);
  document.querySelector('#requestType').value=urlParams.get('solicitud')==='separacion'?'hold':'quote';
  let sending=false;
  let requestId=crypto.randomUUID();
  // Handle Form Submission (Generates formatted email and summary)
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if(sending)return;
    if(!currentLot()||['sold','separated','blocked'].includes(currentLot()?.price?.status)){updateQuoteDisplay();quoteState.tabIndex=-1;quoteState.focus();return;}
    if (['B','I'].includes(currentLot()?.block)) { quoteState.textContent='Esta manzana está fuera de venta.'; return; }
    const fd = new FormData(form);
    const purpose=fd.get('requestType')==='hold'?'hold':'quote';
    if(purpose==='hold'&&currentLot()?.price?.status!=='available'){submissionStatus.textContent='Para solicitar separación, el lote debe tener disponibilidad confirmada. Solicita primero una cotización.';return;}
    sending=true;const submit=form.querySelector('button[type=submit]');submit.disabled=true;submit.textContent='Enviando solicitud…';
    const item = currentLot();
    let quoteText = 'Cotización pendiente de precio oficial';

    if (item?.price && item.price.status === 'available') {
      try {
        const r = await fetch('/api/cotizar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, currency: selectedCurrency })
        });
        const data = await r.json();
        if (data.ok) {
          quoteText = [
            `Lote Seleccionado: ${data.quote.id}`,
            `Área: ${data.quote.area} m²`,
            `Precio publicado: ${money(data.quote.total)}`,
            data.quote.discount ? `Descuento Aplicado: ${data.quote.discount}%` : '',
            `Simulación Inicial (${currentDownPct}%): ${money(data.quote.total * (currentDownPct / 100))}`,
            `Cuota Mensual Estimada (${currentMonths} meses): ${money((data.quote.total * (1 - currentDownPct / 100)) / currentMonths)}`
          ].filter(Boolean).join('\n');
        } else {
          quoteText = data.message;
        }
      } catch {
        quoteText = 'No se pudo verificar el precio en línea en este momento.';
      }
    }

    try {
      const response=await fetch('/api/clientes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:fd.get('name'),email:fd.get('email'),phone:fd.get('phone'),requestId,purpose,message:fd.get('message'),lotId:item?.id||'',currency:selectedCurrency,consent:consent.checked})});
      const result=await response.json();if(!response.ok)throw new Error(result.message||'No se pudo registrar la solicitud.');
      submissionStatus.textContent='Solicitud registrada.';
      window.dispatchEvent(new CustomEvent('morada:lead',{detail:{currency:selectedCurrency}}));
    } catch(error) { submissionStatus.textContent=error.message||'No pudimos registrar tu solicitud. Inténtalo nuevamente.';submissionStatus.className='form-message error';submissionStatus.focus();sending=false;submit.disabled=false;submit.textContent=purpose==='hold'?'Solicitar separación':'Solicitar cotización';return; }
    const messageLines = [
      'SOLICITUD DE COTIZACIÓN · PROYECTO LA MORADA',
      '==========================================',
      `Nombre: ${fd.get('name')}`,
      `Correo: ${fd.get('email')}`,
      `Teléfono: ${fd.get('phone') || 'No especificado'}`,
      `Interés: ${item ? `Manzana ${item.block}, Lote ${String(item.lot).padStart(2, '0')}` : 'Asesoría general de lotización'}`,
      '------------------------------------------',
      quoteText,
      '------------------------------------------',
      `Consulta Adicional: ${fd.get('message') || 'Deseo conocer condiciones de pago y agendar una visita al terreno.'}`,
      '=========================================='
    ];

    const fullMessage = messageLines.join('\n');

    const quoteSummary = document.querySelector('#quoteSummary');
    const sendQuoteBtn = document.querySelector('#sendQuote');
    const resultBox = document.querySelector('#quoteResult');

    if (quoteSummary) quoteSummary.textContent = fullMessage;
    if (sendQuoteBtn) {
      sendQuoteBtn.href = `mailto:biosfera.marketing.di@gmail.com?subject=${encodeURIComponent('Solicitud de Cotización · La Morada')}&body=${encodeURIComponent(fullMessage)}`;
    }

    sending=false;submit.disabled=false;submit.textContent=purpose==='hold'?'Solicitar separación':'Solicitar cotización';
    form.hidden = true;
    if (resultBox) {
      resultBox.hidden = false;
      resultBox.focus();
    }
  });

  // Edit quote button
  document.querySelector('#editQuote')?.addEventListener('click', () => {
    requestId=crypto.randomUUID();
    document.querySelector('#quoteResult').hidden = true;
    form.hidden = false;
    blockSelect.focus();
  });

  // Copy summary to clipboard
  document.querySelector('#copySummaryBtn')?.addEventListener('click', async () => {
    const summaryText = document.querySelector('#quoteSummary')?.textContent || '';
    try {
      await navigator.clipboard.writeText(summaryText);
      const btn = document.querySelector('#copySummaryBtn');
      if (btn) {
        btn.textContent = 'Resumen copiado';
        setTimeout(() => { btn.textContent = 'Copiar resumen'; }, 2500);
      }
    } catch {
      const feedback=document.querySelector('#copySummaryBtn');feedback.textContent='Selecciona el resumen para copiarlo';document.querySelector('#quoteSummary')?.focus();
    }
  });

  loadCatalogue();
  updateWhatsAppLink();
})();

// Redirect anchor hashes to plano.html if on other pages
if (/^(#[a-k]|#club|#parque|#arborizacion)$/i.test(location.hash)) {
  location.replace('recorrido.html?manzana=' + encodeURIComponent(location.hash.slice(1).toUpperCase()));
}

// Navigation and privacy controls shared by public pages.
const footer=document.querySelector('footer');if(footer){for(const [label,url] of [['Privacidad','privacidad.html'],['Condiciones','condiciones.html']]){if(!footer.querySelector('a[href="'+url+'"]')){const a=document.createElement('a');a.href=url;a.textContent=label;footer.append(a);}}}
const prefButton=document.createElement('button');prefButton.type='button';prefButton.className='quiet-button';prefButton.textContent='Preferencias de privacidad';
prefButton.onclick=()=>{const panel=document.createElement('dialog');panel.className='privacy-dialog';panel.setAttribute('aria-labelledby','privacy-title');panel.innerHTML='<h2 id="privacy-title">Tu privacidad</h2><p>Las funciones esenciales mantienen tus preferencias. La analítica y la publicidad requieren tu elección. Solo se activarán los servicios configurados por La Morada si autorizas su categoría.</p><label><input id="analyticsChoice" type="checkbox"> Analítica</label><label><input id="marketingChoice" type="checkbox"> Publicidad</label><button type="button">Guardar preferencias</button><button class="privacy-close" type="button">Cerrar sin cambiar</button>';let prior={};try{prior=JSON.parse(localStorage.getItem('morada-consent')||'{}')||{};}catch{}panel.querySelector('#analyticsChoice').checked=prior.analytics===true;panel.querySelector('#marketingChoice').checked=prior.marketing===true;panel.querySelector('button').onclick=()=>{localStorage.setItem('morada-consent',JSON.stringify({analytics:panel.querySelector('#analyticsChoice').checked,marketing:panel.querySelector('#marketingChoice').checked,updated:new Date().toISOString()}));window.dispatchEvent(new Event('morada:consent'));panel.close();panel.remove();};panel.querySelector('.privacy-close').onclick=()=>{panel.close();};panel.addEventListener('close',()=>panel.remove(),{once:true});document.body.append(panel);panel.showModal();};(footer||document.body).append(prefButton);

if(!document.querySelector('script[src="measurement.js"]')){const script=document.createElement('script');script.src='measurement.js';document.head.append(script);}
