import {resolveLabelVisibility,stepLabelVisibility} from './label-layout.js';
import * as THREE from './vendor/three/three.module.js';
import { OrbitControls } from './vendor/three/OrbitControls.js';
import { surfaceTexture, createHouse } from './materials3d.js';
import { heightAt, drapePolygon, groundGeometry, boundaryPoints } from './terrain3d.js';
import {extendTerrain,buildLandscape,pointInside,makeFloatingLabel} from './landscape3d.js';

const $ = selector => document.querySelector(selector);
const host = $('#scene'), info = $('#lotInfo'), loading = $('#loading');
const planStarted=performance.now();host.dataset.loading='true';
const currency = $('#currency'), list = $('#lotList');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const mobileLayout=matchMedia('(max-width:760px)');
const filtersPanel=document.querySelector('.filter-disclosure');
filtersPanel.open=!mobileLayout.matches;
mobileLayout.addEventListener('change',e=>{filtersPanel.open=!e.matches;});
const catalog = new Map(), lotMeshes = new Map(), lotGroups=new Map(), pickTargets = [];
let catalogRefreshing=false,catalogReady=false,landscapeVisual=null,numbersEnabled=false;
const blockedBlocks = new Set(['B','I']);
let lots = [], selected = null, verified = false, flying = false, phase = 0, radius = 600;
let sceneWidth=1,sceneHeight=1,projectRadius=0;const blockLabels=[];
let cameraMove = null, view = 'perspective', changed = true;
const center = new THREE.Vector3();
let terrain=null;
const terrainHeight=(x,y)=>heightAt(terrain,x,y);

const scene = new THREE.Scene();
const skyCanvas=document.createElement('canvas');skyCanvas.width=2;skyCanvas.height=512;const skyContext=skyCanvas.getContext('2d');const skyGradient=skyContext.createLinearGradient(0,0,0,512);skyGradient.addColorStop(0,'#b9d2e6');skyGradient.addColorStop(1,'#edf1ed');skyContext.fillStyle=skyGradient;skyContext.fillRect(0,0,2,512);scene.background=new THREE.CanvasTexture(skyCanvas);scene.background.colorSpace=THREE.SRGBColorSpace;scene.fog=new THREE.Fog('#e0e8e6',2100,4200);
const camera = new THREE.PerspectiveCamera(42,1,2,3200);
let renderer;
try { renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'}); }
catch { loading.textContent = 'El 3D no está disponible en este dispositivo. Usa la lista para consultar los lotes.'; }
let controls;
if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.domElement.setAttribute('aria-label','Plano 3D. Puedes seleccionar lotes también desde la lista.');
  host.prepend(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();stopTour();loading.hidden=false;loading.textContent='El visor se ha pausado. Recarga la página si no se recupera.';});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{loading.hidden=true;changed=true;});
  controls = new OrbitControls(camera,renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .07;
  controls.minPolarAngle = .05;
  controls.maxPolarAngle = Math.PI / 2.18;
  controls.minDistance = 35;
  controls.maxDistance = 900;
  controls.addEventListener('change',()=>{changed=true;});
  controls.addEventListener('start',()=>{stopTour();cameraMove=null;});
}
scene.add(new THREE.HemisphereLight('#eef6ff','#79705c',.95));
const sun = new THREE.DirectionalLight('#fff0d7',1.45);
sun.position.set(-300,650,200);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-650;sun.shadow.camera.right=650;
sun.shadow.camera.top=650;sun.shadow.camera.bottom=-650;
sun.shadow.camera.near=10;sun.shadow.camera.far=1600;
sun.shadow.normalBias=.7;sun.shadow.bias=-.0002;scene.add(sun);
const grass = surfaceTexture('grass'), soil = surfaceTexture('soil');
soil.repeat.set(32,26);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(2200,1800),new THREE.MeshStandardMaterial({map:soil,color:'#d7c7a3',roughness:1}));
ground.rotation.x=-Math.PI/2;ground.position.y=-2;ground.receiveShadow=true;scene.add(ground);
const palette={available:'#6d9b49',separated:'#e7c642',sold:'#c96558',blocked:'#a1a3a1',unknown:'#b3afa3'};
const labelViewPoint=new THREE.Vector3(),labelProjection=new THREE.Vector3();
function updateFloatingLabels(now,dt){
 camera.updateMatrixWorld(true);
 const sprites=[...blockLabels,...(landscapeVisual?.labels||[])],candidates=[];
 const worldPerPixelFactor=2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/sceneHeight;
 for(let order=0;order<sprites.length;order++){
  const sprite=sprites[order],data=sprite.userData;
  data.labelState??={candidate:false,target:false,since:now,opacity:0};
  const depth=-labelViewPoint.copy(data.anchor).applyMatrix4(camera.matrixWorldInverse).z;
  sprite.position.copy(data.anchor);
  const perPixel=Math.max(.001,depth*worldPerPixelFactor);
  sprite.scale.set(data.pixelWidth*perPixel,data.pixelHeight*perPixel,1);
  labelProjection.copy(data.anchor).project(camera);
  const priority=data.block===selected?.block?3:data.block?2:1;
  candidates.push({key:sprite,order,depth,x:(labelProjection.x+1)*sceneWidth/2,y:(1-labelProjection.y)*sceneHeight/2,width:data.pixelWidth,height:data.pixelHeight,enabled:sprite.parent.visible&&labelProjection.z>=-1&&labelProjection.z<=1,priority,wasVisible:data.labelState.target});
  sprite.renderOrder=20+priority;
 }
 const visible=resolveLabelVisibility(candidates,{left:mobileLayout.matches?8:345,right:sceneWidth-8,top:100,bottom:sceneHeight-105});
 let animating=false;
 for(const sprite of sprites){const state=sprite.userData.labelState;animating=stepLabelVisibility(state,visible.has(sprite),now,dt,reducedMotion.matches)||animating;sprite.material.opacity=state.opacity;sprite.visible=state.opacity>0&&sprite.parent.visible;}
 return animating;
}
function lotState(lot) { return blockedBlocks.has(lot.block) ? 'blocked' : verified ? catalog.get(lot.id)?.status || 'unknown' : 'unknown'; }
const names={available:'Disponible',separated:'Separado',sold:'Vendido',blocked:'Fuera de venta',unknown:'Disponibilidad por confirmar'};
function money(cents) { return new Intl.NumberFormat('es-PE',{style:'currency',currency:currency.value}).format(cents/100); }
function element(tag,text,className) {const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
function applyRaisedLotMaterial(mesh){
  const bounds=ground.geometry.userData.mapBounds;if(!ground.material.map||!bounds)return;
  const positions=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;
  for(let i=0;i<positions.count;i++)uv.setXY(i,(positions.getX(i)+500-bounds.xMin)/(bounds.xMax-bounds.xMin),(positions.getZ(i)+380-bounds.yMin)/(bounds.yMax-bounds.yMin));
  uv.needsUpdate=true;
  const material=ground.material.clone();material.visible=true;material.onBeforeCompile=ground.material.onBeforeCompile;material.customProgramCacheKey=ground.material.customProgramCacheKey;
  mesh.material[0].dispose();mesh.material[0]=material;mesh.receiveShadow=true;
}
function buildLot(lot) {
  if(!renderer || !lot.polygon || lot.polygon.length<3)return;
  const group=new THREE.Group();scene.add(group);lotGroups.set(lot.id,group);
  const points=lot.polygon.filter((p,i,a)=>!i || p[0]!==a[i-1][0] || p[1]!==a[i-1][1]);
  const geometry = drapePolygon(points,terrain,.85);
  const status=lotState(lot);
  const top=new THREE.MeshStandardMaterial({map:null,color:palette[status],roughness:.98});
  const side=new THREE.MeshStandardMaterial({color:'#a2997f',roughness:1});
  top.visible=false;side.visible=false;
  const mesh=new THREE.Mesh(geometry,[top,side]);
  mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData=lot;
  group.add(mesh);lotMeshes.set(lot.id,mesh);pickTargets.push(mesh);
  if(landscapeVisual)applyRaisedLotMaterial(mesh);
  const rim=boundaryPoints(points,terrain,0),vertices=[],indices=[];
  for(const p of rim)vertices.push(p.x,p.y,p.z,p.x,p.y+.85,p.z);
  for(let i=0;i<rim.length;i++){const a=i*2,b=((i+1)%rim.length)*2;indices.push(a,b,a+1,b,b+1,a+1);}
  const wallGeometry=new THREE.BufferGeometry();wallGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));wallGeometry.setIndex(indices);wallGeometry.computeVertexNormals();
  const wall=new THREE.Mesh(wallGeometry,new THREE.MeshStandardMaterial({color:'#b3ad91',roughness:1,side:THREE.DoubleSide}));group.add(wall);

  const edgePoints=boundaryPoints(points,terrain,1.4);
  const boundary=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edgePoints,true,'centripetal'),edgePoints.length,.55,4,true),new THREE.MeshBasicMaterial({color:'#ffe9a0',depthTest:false,depthWrite:false}));
  boundary.renderOrder=8;
  const highlight=new THREE.Mesh(drapePolygon(points,terrain,1.05),new THREE.MeshBasicMaterial({color:'#ffe7a0',transparent:true,opacity:.32,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));highlight.renderOrder=7;boundary.add(highlight);
  boundary.visible=false;mesh.userData.outline=boundary;group.add(boundary);
  if(status==='sold'||status==='separated'){
    // A triangle centroid is inside the cadastral polygon, including concave lots.
    const faces=THREE.ShapeUtils.triangulateShape(points.map(p=>new THREE.Vector2(...p)),[]);
    let best=null;
    for(const face of faces){
      const location=[0,1].map(axis=>face.reduce((sum,i)=>sum+points[i][axis],0)/3);
      let clearance=Infinity;
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1];
        const t=Math.max(0,Math.min(1,((location[0]-a[0])*dx+(location[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
        clearance=Math.min(clearance,Math.hypot(location[0]-a[0]-t*dx,location[1]-a[1]-t*dy));
      }
      if(!best||clearance>best.clearance)best={location,clearance};
    }
    if(best&&best.clearance>.5){
      const size=Math.min(13,best.clearance),[x,y]=best.location;
      const home=createHouse(size,status);
      // All model parts fit within radius .82*size; sample the full footprint for its base.
      let base=-Infinity;
      for(let dx=-size*.82;dx<=size*.82;dx+=size*.164)for(let dy=-size*.82;dy<=size*.82;dy+=size*.164)base=Math.max(base,terrainHeight(x+dx,y+dy));
      home.position.set(x-500,base+1,y-380);group.add(home);
    }
  }
}
function showLot(lot) {
  selected=lot;info.replaceChildren();
  document.querySelector(".explorer-panel").classList.add("has-selection");
  const status=lotState(lot),price=verified?catalog.get(lot.id):null;
  info.append(element('span',names[status],'lot-status '+status),element('h2',`Manzana ${lot.block} · Lote ${String(lot.lot).padStart(2,'0')}`));
  if(status!=='blocked'){
    const amount=currency.value==='USD'?price?.usd_cents:price?.cents;
    info.append(element('div',amount==null?'Precio por confirmar':money(amount),'lot-price'+(amount==null?' pending':'')));
    info.append(element('p',amount==null?'Solicita el precio vigente a nuestro equipo.':'Importe publicado por el propietario. Sin conversión de moneda.'));
    if(price?.area>0)info.append(element('div',`Área: ${new Intl.NumberFormat('es-PE').format(price.area)} m²`,'lot-facts'));
  }else info.append(element('p','Esta manzana no está disponible para cotización ni separación. Puedes explorar otras manzanas.'));
  if(status==='available'||status==='unknown'){
    const link=element('a',status==='available'?'Solicitar cotización':'Consultar este lote','primary');
    link.href=`cotizacion.html?manzana=${lot.block}&lote=${lot.lot}&moneda=${currency.value}`;info.append(link);
    if(status==='available'){const hold=element('a','Solicitar separación','secondary');hold.href=link.href+'&solicitud=separacion';info.append(hold);}
    info.append(element('p','La solicitud será atendida por un asesor y no confirma una reserva automática.'));
  }
  if(status==='sold'||status==='separated'){
    const link=element('a','Consultar alternativas','primary');link.href='contacto.html';info.append(link);
  }
  const mesh=lotMeshes.get(lot.id);
  if(mesh){const focus=element('button','Ver este lote de cerca','secondary');focus.type='button';focus.onclick=()=>focusLot(lot);info.append(focus);}
  else info.append(element('p','Este lote figura en el catálogo, pero su polígono está pendiente de verificación.'));
  list.value=lot.id;
  filtersPanel.open=false;
  const url=new URL(location.href);url.searchParams.set('lote',lot.id);url.searchParams.set('moneda',currency.value);history.replaceState(null,'',url);
  const share=element('button','Copiar enlace de este lote','share-lot');share.type='button';share.onclick=async()=>{try{await navigator.clipboard.writeText(url.href);share.textContent='Enlace copiado';}catch{const field=element('input');field.value=url.href;field.readOnly=true;field.setAttribute('aria-label','Enlace del lote para copiar');info.append(field);field.select();}};info.append(share);
  for(const [id,item] of lotMeshes){item.userData.outline.visible=id===lot.id;item.userData.outline.material.color.set('#ffe9a0');}
  changed=true;
}
function updateList(){
  const search=$('#lotSearch').value.trim().toUpperCase().replace(/\s+/g,'').replace(/^([A-K])-?(\d{1,2})$/,(_,b,n)=>b+'-'+n.padStart(2,'0'));
  const block=$('#blockFilter').value,status=$('#statusFilter').value;
  const filtered=lots.filter(l=>(!block||l.block===block)&&(!status||lotState(l)===status)&&(!search||l.id.includes(search)));
  $('#filterCount').textContent=filtered.length?`${filtered.length} ${filtered.length===1?'lote coincide':'lotes coinciden'} con tu búsqueda.`:'No hay coincidencias. Prueba otra manzana o limpia los filtros.';
  $('#clearFilters').hidden=!search&&!block&&!status;
  const filteredIds=new Set(filtered.map(l=>l.id));
  list.replaceChildren(new Option(filtered.length?`Selecciona un lote (${filtered.length})`:'No hay coincidencias',''));
  for(const lot of filtered)list.add(new Option(`${lot.id} · ${names[lotState(lot)]}`,lot.id));
  if(selected && filtered.some(l=>l.id===selected.id))list.value=selected.id;
  else if(selected){selected=null;document.querySelector('.explorer-panel').classList.remove('has-selection');info.replaceChildren(element('h2','Selecciona un lote'),element('p','Utiliza los resultados del filtro o elige un lote en el plano.'));for(const mesh of lotMeshes.values())mesh.userData.outline.visible=false;}

  changed=true;
}
function moveCamera(position,target){
  if(!controls)return;
  stopTour();
  if(reducedMotion.matches){camera.position.copy(position);controls.target.copy(target);changed=true;return;}
  cameraMove={started:performance.now(),from:camera.position.clone(),to:position,fromTarget:controls.target.clone(),target};
}
function focusLot(lot){
  const mesh=lotMeshes.get(lot.id);if(!mesh)return;
  mesh.updateMatrixWorld();const box=new THREE.Box3().setFromObject(mesh);const target=box.getCenter(new THREE.Vector3());
  const size=box.getSize(new THREE.Vector3());const distance=Math.max(size.x,size.z)*2+40;
  moveCamera(target.clone().add(new THREE.Vector3(distance*.4,distance,distance*.8)),target);
}
function setView(next){view=next;$('#perspective').setAttribute('aria-pressed',String(next==='perspective'));$('#topView').setAttribute('aria-pressed',String(next==='top'));moveCamera(center.clone().add(next==='top'?new THREE.Vector3(0,radius*1.35,1):new THREE.Vector3(radius*.15,radius*.8,radius*.8)),center.clone());}
function stopTour(){flying=false;$('#tour').setAttribute('aria-pressed','false');$('#tour').textContent='Recorrido aéreo';}
function removeLotVisual(id){
 const group=lotGroups.get(id);if(!group)return;
 group.traverse(object=>{object.geometry?.dispose();if(object.material)for(const mat of Array.isArray(object.material)?object.material:[object.material])mat.dispose();});
 scene.remove(group);lotGroups.delete(id);
 const mesh=lotMeshes.get(id),index=pickTargets.indexOf(mesh);if(index>=0)pickTargets.splice(index,1);lotMeshes.delete(id);

}
async function refreshCatalog(redraw=true,initialRequest=null){
 if(catalogRefreshing)return;catalogRefreshing=true;$('#refreshCatalog').disabled=true;
 const previous=new Map(catalog),wasVerified=verified;
 try{const response=await (initialRequest||fetch('/api/catalogo',{cache:'no-store'}));if(!response.ok)throw new Error();const data=await response.json();if(!Array.isArray(data.lots))throw new Error();catalog.clear();for(const lot of data.lots)if(lot.price)catalog.set(lot.id,lot.price);verified=true;}
 catch{verified=false;}
 finally{catalogRefreshing=false;$('#refreshCatalog').disabled=false;}
 const count={available:0,separated:0,sold:0,unknown:0,blocked:0};for(const lot of lots)count[lotState(lot)]++;
 $('#catalogStatus').textContent=verified?`${count.available} disponibles · ${count.separated} separados · ${count.sold} vendidos · ${count.unknown} por confirmar. Actualizado a las ${new Intl.DateTimeFormat('es-PE',{hour:'2-digit',minute:'2-digit'}).format(new Date())}`:'No se pudo actualizar. Los estados se muestran por confirmar. Pulsa Actualizar para reintentar.';
 if(redraw&&catalogReady){
  for(const lot of lots){const oldState=blockedBlocks.has(lot.block)?'blocked':wasVerified?previous.get(lot.id)?.status||'unknown':'unknown';if(oldState!==lotState(lot)){removeLotVisual(lot.id);buildLot(lot);}}
  landscapeVisual?.repaint();updateList();if(selected){const open=filtersPanel.open;showLot(selected);filtersPanel.open=open;}changed=true;
 }
}
$('#refreshCatalog').onclick=()=>refreshCatalog();
$('#clearFilters').onclick=()=>{for(const id of ['blockFilter','statusFilter','lotSearch'])$('#'+id).value='';updateList();};
window.addEventListener('focus',()=>{if(catalogReady)refreshCatalog();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&catalogReady)refreshCatalog();});

function planStage(text){if(!renderer)return;const message=loading.querySelector('.plan-loading-copy');if(message)message.textContent=text;}
const yieldToPage=()=>new Promise(resolve=>setTimeout(resolve,0));
async function planAsset(path){const response=await fetch(path);if(!response.ok)throw new Error('No se pudo descargar '+path);return response.json();}
async function initialize(){
  try{
    planStage('Descargando lotes, relieve y vías…');
    const initialCatalog=fetch('/api/catalogo',{cache:'no-store'});initialCatalog.catch(()=>{});
    const assets=await Promise.allSettled([planAsset('lots.json'),planAsset('cad-terrain.json'),planAsset('cad-landscape.json')]);
    if(assets[0].status!=='fulfilled')throw new Error('lot catalog');
    lots=assets[0].value;await refreshCatalog(false,initialCatalog);
    for(const block of [...new Set(lots.map(l=>l.block))].sort())$('#blockFilter').add(new Option(`Manzana ${block}${blockedBlocks.has(block)?' · Fuera de venta':''}`,block));
    if(assets[1].status==='fulfilled'){terrain=extendTerrain(assets[1].value);if(renderer){const geo=groundGeometry(terrain);ground.geometry.dispose();ground.geometry=geo;ground.rotation.x=0;ground.position.y=0;}}else terrain=null;
    for(let i=0;i<lots.length;i++){buildLot(lots[i]);if(i%12===11){planStage(`Preparando lotes: ${i+1} de ${lots.length}…`);await yieldToPage();}}
    catalogReady=true;
    if(renderer){
      planStage('Preparando el entorno y los detalles…');await yieldToPage();
      try{if(assets[2].status!=='fulfilled')throw new Error('landscape');const landscape=buildLandscape(scene,terrain,assets[2].value,lots,ground,{statusFor:lotState,palette,numbersVisible:()=>numbersEnabled,anisotropy:Math.min(8,renderer.capabilities.getMaxAnisotropy())});landscapeVisual=landscape;lotMeshes.forEach(applyRaisedLotMaterial);const toggle=$('#contextToggle');toggle.hidden=false;toggle.onclick=()=>{landscape.context.visible=!landscape.context.visible;toggle.setAttribute('aria-pressed',String(landscape.context.visible));landscape.repaint();changed=true;};}catch(error){console.error('Landscape loading failed',error);ground.material.map=null;ground.material.color.set('#b6a48c');ground.material.onBeforeCompile=()=>{};ground.material.customProgramCacheKey=()=> 'basic-plan-fallback';ground.material.needsUpdate=true;for(const mesh of lotMeshes.values()){mesh.material[0].visible=true;mesh.material[0].map=lotState(mesh.userData)==='available'?grass:null;mesh.material[0].needsUpdate=true;}}
    }
    if(renderer)for(const block of [...new Set(lots.map(l=>l.block))]){const points=lots.filter(l=>l.block===block&&l.polygon).flatMap(l=>l.polygon);if(!points.length)continue;const x=(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])))/2,y=(Math.min(...points.map(p=>p[1]))+Math.max(...points.map(p=>p[1])))/2;blockLabels.push(makeFloatingLabel(scene,block,x,y,terrain,{width:38,block}));}
    updateList();
    if(renderer){const bounds=new THREE.Box3();lotMeshes.forEach(m=>{m.updateMatrixWorld(true);bounds.expandByObject(m);});bounds.getCenter(center);const sphere=bounds.getBoundingSphere(new THREE.Sphere());projectRadius=sphere.radius;const vertical=THREE.MathUtils.degToRad(camera.fov),horizontal=2*Math.atan(Math.tan(vertical/2)*camera.aspect);radius=sphere.radius/Math.sin(Math.min(vertical,horizontal)/2)*.95;controls.maxDistance=mobileLayout.matches?Math.max(900,radius*1.45):900;if(!terrain){ground.position.x=center.x;ground.position.z=center.z;}sun.target.position.copy(center);scene.add(sun.target);setView('perspective');cameraMove=null;camera.position.copy(center).add(new THREE.Vector3(radius*.15,radius*.8,radius*.8));controls.target.copy(center);planStage('Preparando la vista…');await yieldToPage();if(renderer.compileAsync)await renderer.compileAsync(scene,camera);loading.hidden=true;delete host.dataset.loading;host.dataset.loadMs=String(Math.round(performance.now()-planStarted));changed=true;}
    const params=new URLSearchParams(location.search);const requestedBlock=params.get('manzana')?.toUpperCase();if(requestedBlock&&lots.some(l=>l.block===requestedBlock)){$('#blockFilter').value=requestedBlock;updateList();}if(params.get('vista')==='parque')$('#parkView').click();const initial=lots.find(l=>l.id===params.get('lote'));if(initial)showLot(initial);
  }catch{loading.hidden=false;loading.replaceChildren(element('p','No pudimos cargar el plano.','plan-loading-title'),element('p','Revisa tu conexión. Puedes volver a intentarlo sin perder el lote del enlace.','plan-loading-copy'));const retry=element('button','Volver a cargar el plano');retry.type='button';retry.onclick=()=>location.reload();loading.append(retry);$('#catalogStatus').textContent='Catálogo no disponible.';}
}
list.onchange=()=>{const lot=lots.find(l=>l.id===list.value);if(lot)showLot(lot);};
for(const id of ['blockFilter','statusFilter','lotSearch'])$('#'+id).addEventListener('input',updateList);
currency.value=(new URLSearchParams(location.search).get('moneda')||localStorage.getItem('morada-currency'))==='USD'?'USD':'PEN';
currency.onchange=()=>{localStorage.setItem('morada-currency',currency.value);if(selected)showLot(selected);};
function zoomBy(factor){if(!controls)return;const offset=camera.position.clone().sub(controls.target);offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance));moveCamera(controls.target.clone().add(offset),controls.target.clone());}
$('#zoomIn3d').onclick=()=>zoomBy(.76);$('#zoomOut3d').onclick=()=>zoomBy(1.3);
$('#numbersToggle').onclick=()=>{numbersEnabled=!numbersEnabled;$('#numbersToggle').setAttribute('aria-pressed',String(numbersEnabled));landscapeVisual?.repaint();changed=true;};
$('#parkView').onclick=()=>{const target=new THREE.Vector3(428-500,terrainHeight(428,503),503-380);moveCamera(target.clone().add(new THREE.Vector3(85,155,125)),target);};
$('#perspective').onclick=()=>setView('perspective');$('#topView').onclick=()=>setView('top');$('#reset').onclick=()=>setView(view);
$('#tour').onclick=()=>{if(flying){stopTour();return;}if(reducedMotion.matches){$('#catalogStatus').textContent='Movimiento reducido activado: utiliza las vistas manuales.';return;}cameraMove=null;flying=true;$('#tour').textContent='Pausar recorrido';$('#tour').setAttribute('aria-pressed','true');};
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)stopTour();});
if(renderer){
 const ray=new THREE.Raycaster();let down=null;
 renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
 renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const r=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const hit=ray.intersectObjects(pickTargets)[0];if(hit)showLot(hit.object.userData);});
 new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;const widthChanged=Math.abs(w-sceneWidth)>40;sceneWidth=w;sceneHeight=h;renderer.setSize(w,h);camera.aspect=w/h;if(w>760)camera.setViewOffset(w,h,-165,0,w,h);else camera.clearViewOffset();camera.updateProjectionMatrix();if(projectRadius&&widthChanged){const vertical=THREE.MathUtils.degToRad(camera.fov),horizontal=2*Math.atan(Math.tan(vertical/2)*camera.aspect);radius=projectRadius/Math.sin(Math.min(vertical,horizontal)/2)*.95;controls.maxDistance=mobileLayout.matches?Math.max(900,radius*1.45):900;if(!selected&&!flying)setView(view);}changed=true;}).observe(host);
 let last=performance.now();renderer.setAnimationLoop(t=>{const dt=Math.min((t-last)/1000,.05);last=t;if(document.hidden)return;if(cameraMove){const f=Math.min((t-cameraMove.started)/850,1),ease=1-(1-f)**3;camera.position.lerpVectors(cameraMove.from,cameraMove.to,ease);controls.target.lerpVectors(cameraMove.fromTarget,cameraMove.target,ease);if(f===1)cameraMove=null;changed=true;}if(flying){phase+=dt*.1;camera.position.set(center.x+Math.sin(phase)*radius,center.y+radius*.72,center.z+Math.cos(phase)*radius);controls.target.copy(center);changed=true;}controls.update();const labelsAnimating=updateFloatingLabels(t,dt);if(changed||labelsAnimating){renderer.render(scene,camera);changed=false;}});
 window.addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);controls.dispose();renderer.dispose();},{once:true});
}
initialize();

window.addEventListener('morada:retry',()=>{if(catalogReady)refreshCatalog();});
