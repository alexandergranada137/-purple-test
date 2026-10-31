import * as THREE from './vendor/three/three.module.js';
import {heightAt,drapePolygon,boundaryPoints} from './terrain3d.js';
import {surfaceTexture} from './materials3d.js';
import {buildAmenities,parkCenterAt} from './amenities3d.js';

// Keep the original survey grid intact. Only the surroundings are scenic relief.
export function extendTerrain(source){
  const dx=(source.xMax-source.xMin)/(source.columns-1),dy=(source.yMax-source.yMin)/(source.rows-1);
  const left=32,right=32,top=28,bottom=39;
  const terrain={...source,columns:source.columns+left+right,rows:source.rows+top+bottom,xMin:source.xMin-left*dx,xMax:source.xMax+right*dx,yMin:source.yMin-top*dy,yMax:source.yMax+bottom*dy,heights:[]};
  for(let r=0;r<terrain.rows;r++)for(let c=0;c<terrain.columns;c++){
    const x=terrain.xMin+c*dx,y=terrain.yMin+r*dy;
    let h=heightAt(source,x,y);
    if(y>source.yMax){const d=y-source.yMax;const t=Math.min(d/65,1);h-=38*(t*t*(3-2*t));h+=Math.max(0,d-240)*.18;}
    if(y<source.yMin){const d=source.yMin-y;h+=d*.17+Math.sin(x*.014)*Math.min(d*.045,10);}
    const side=Math.max(source.xMin-x,x-source.xMax,0);h+=side*.035;
    terrain.heights.push(h);
  }
  return terrain;
}
export function pointInside([x,y],points){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export function ribbon(points,width){
  const left=[],right=[];
  for(let i=0;i<points.length;i++){
    const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
    const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1;
    left.push([p[0]-dy/length*width/2,p[1]+dx/length*width/2]);
    right.push([p[0]+dy/length*width/2,p[1]-dx/length*width/2]);
  }
  return [...left,...right.reverse()];
}
function smooth(points){
  const curve=new THREE.SplineCurve(points.map(p=>new THREE.Vector2(...p)));
  return curve.getPoints(160).map(p=>[p.x,p.y]);
}
export function highwayToTerrainEdges(cadRoad,terrain){
  const start=cadRoad[0],end=cadRoad.at(-1);
  const west=smooth([[terrain.xMin-30,194],[-220,179],[-135,142],[-88,120],[-28,106],start]);
  const east=smooth([end,[900,274],[969,279],[1050,268],[1140,239],[terrain.xMax+30,219]]);
  return [...west.slice(0,-1),...cadRoad,...east.slice(1)];
}
export function buildLandscape(scene,terrain,data,lots,ground,options={}){
  const development=new THREE.Group(),context=new THREE.Group();scene.add(development,context);
  const commands=[],labels=[];
  const grass=surfaceTexture('grass'),soil=surfaceTexture('soil');
  const material=(color,map=null)=>new THREE.MeshStandardMaterial({color,map,roughness:.96});
  const lawn=material('#7b9859',grass),paving=material('#c1ad8b',soil),curb=material('#ded1b7'),asphalt=material('#56595a'),bank=material('#a59778',soil),fieldMaterials=['#5f7544','#788452','#8c965a','#637c46'].map(c=>material(c,grass));
  function surface(points,mat,lift,parent=development){commands.push({points,color:'#'+mat.color.getHexString(),map:mat.map,lift,parent});}
  function path(points,width,mat,lift,parent=development){return surface(ribbon(points,width),mat,lift,parent);}
  function label(text,x,y,parent=development,width=66){const sprite=makeFloatingLabel(parent,text,x,y,terrain,{width:width>80?145:125});labels.push(sprite);}
  // Filled CAD road corridors with rounded joins, clipped around lots and parks.
  for(const road of data.roadSurfaces||[]){commands.push({points:road.points,holes:road.holes,color:'#c1ad8b',lift:.09,parent:development});}
  for(const park of data.parks)surface(park.points,lawn,.30);
  // Winding pedestrian walk through the actual central park outline.
  const park=data.parks[0].points;
  const walk=smooth(Array.from({length:12},(_,i)=>parkCenterAt(park,430+i*12)).filter(Boolean)).filter(p=>pointInside(p,park));
  if(walk.length>1)path(walk,2.3,curb,.38);
  label('Parque central',428,503);
  if(data.accessRoad){const access=data.accessRoad.points;path(access,10.2,curb,.13);path(access,8.2,paving,.16);label('Acceso principal',330,320);label('Ingreso al proyecto',142,129);}
  // Arrival sequence: approach road, open forecourt, then controlled entry.
  surface(data.amenityLayout.arrivalCourt,material('#cbbda2',soil),.08);
  path(data.amenityLayout.gateApproach,data.amenityLayout.gateApproachWidth,paving,.50);
  // Scenic continuations follow the Maps reference and run beyond the atlas edges,
  // so the asphalt, shoulders and markings all leave the model together.
  const centerline=highwayToTerrainEdges(data.highway.centerline,ground.geometry.userData.mapBounds||terrain);
  path(centerline,11.2,curb,.14,context);
  path(centerline,8.3,asphalt,.20,context);
  commands.push({line:centerline,color:'#e5d8b4',lift:.26,parent:context,dash:true});
  label('Variante de Uchumayo',484,213,context,89);
  const river=smooth([[-480,741],[-200,775],[80,763],[300,793],[520,824],[740,786],[920,688],[1120,506],[1400,401]]);
  path(river,31,bank,.12,context);
  const water=new THREE.MeshStandardMaterial({color:'#338aa0',roughness:.42,metalness:.06});path(river,17,water,.21,context);
  label('Río Chili',550,819,context,91);
  // Approximate agricultural patches observed north of the highway and on the river terraces.
  const fields=[
    [[180,-90],[272,-74],[252,46],[166,31]],
    [[283,-69],[373,-49],[359,99],[265,75]],
    [[388,-48],[476,-30],[449,132],[370,109]],
    [[491,-23],[566,-8],[555,126],[466,138]],
    [[581,-8],[662,12],[643,105],[569,123]],
    [[10,848],[123,833],[139,895],[26,914]],
    [[151,832],[254,842],[245,927],[153,916]],
    [[272,851],[362,860],[349,957],[263,937]],
    [[379,858],[483,875],[470,969],[365,956]],
    [[505,868],[618,854],[639,946],[494,973]],
    [[659,842],[755,814],[790,900],[658,938]]
  ];
  fields.forEach((points,i)=>surface(points,fieldMaterials[i%4],.08,context));
  // Soft vegetated terraces following the valley; exposed escarpments remain visible.
  surface(ribbon(river,91),material('#738855',grass),.035,context);
  surface([[90,698],[260,719],[430,746],[590,757],[755,721],[852,658],[886,679],[770,759],[594,790],[416,775],[244,748],[83,729]],material('#81965d',grass),.04,context);
  surface([[155,266],[238,308],[354,342],[479,361],[588,357],[590,375],[467,379],[346,359],[230,326],[148,286]],material('#8b9d65',grass),.045,context);
  // Common areas visible on the commercial plan: trekking grounds and southern alameda.
  surface(data.amenityLayout.trekkingGround,material('#7c9759',grass),.06);
  const alameda=data.amenityLayout.alameda;
  surface(alameda,material('#7e975d',grass),.07);
  path(data.amenityLayout.alamedaWalk,2.8,paving,.10);
  label('Alameda',...data.amenityLayout.alamedaLabel);
  // A broad gravel apron makes the clubhouse precinct legible from above.
  surface([[660,360],[735,355],[747,412],[655,414]],bank,.31);
  const amenity=buildAmenities(development,terrain,{park,surface,path,label,layout:data.amenityLayout});
  const treePoints=[];
  function onRoad(x,y,clearance){
    const p=[x,y];
    for(const road of data.roadSurfaces||[]){
      if(pointInside(p,road.points)&&!(road.holes||[]).some(h=>pointInside(p,h)))return true;
      if(nearLine(p,[...road.points,road.points[0]],clearance)||(road.holes||[]).some(h=>nearLine(p,[...h,h[0]],clearance)))return true;
    }
    return nearLine(p,centerline,5.6+clearance)||nearLine(p,data.accessRoad.points,5.1+clearance)||nearLine(p,data.amenityLayout.gateApproach,data.amenityLayout.gateApproachWidth/2+clearance)||nearLine(p,data.amenityLayout.alamedaWalk,1.4+clearance)||data.amenityLayout.trekking.some(route=>nearLine(p,route,1.6+clearance));
  }
  function addTree(x,y,size,parent){if(onRoad(x,y,size*.8+.8)||lots.some(l=>l.polygon&&pointInside([x,y],l.polygon)))return;treePoints.push({x,y,size,parent});}
  let seed=791;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(const area of [...data.parks,{points:data.amenityLayout.trekkingGround},{points:data.amenityLayout.alameda}]){
    const xs=area.points.map(p=>p[0]),ys=area.points.map(p=>p[1]);
    for(let n=0;n<200;n++){const x=Math.min(...xs)+random()*(Math.max(...xs)-Math.min(...xs)),y=Math.min(...ys)+random()*(Math.max(...ys)-Math.min(...ys));
      if(!pointInside([x,y],area.points))continue;
      if(walk.some(p=>Math.hypot(x-p[0],y-p[1])<3.4)||nearLine([x,y],data.amenityLayout.alamedaWalk,4))continue;
      if(data.amenityLayout.trekking.some(route=>nearLine([x,y],route,6)))continue;
      if(data.amenityLayout.trekkingPlatforms.some(p=>Math.hypot(x-p[0],y-p[1])<7))continue;
      if(Object.values(amenity.centers).some(p=>p&&Math.hypot(x-p[0],y-p[1])<9))continue;
      if(treePoints.some(p=>Math.hypot(x-p.x,y-p.y)<7))continue;
      addTree(x,y,2.6+random()*1.8,development);
    }
  }
  for(let i=0;i<river.length;i+=2){const [x,y]=river[i];for(const offset of [-22,22])addTree(x+random()*9,y+offset,2.7+random()*2.8,context);}
  // Sparse scenic trees, clear of parcels, roads and river.
  function nearLine(p,points,radius){return points.some((b,i)=>{if(!i)return false;const a=points[i-1],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)<radius;});}
  for(let n=0;n<650;n++){
    const x=terrain.xMin+random()*(terrain.xMax-terrain.xMin),y=terrain.yMin+random()*(terrain.yMax-terrain.yMin),p=[x,y];
    // Concentrate trees on riparian terraces and the narrow access-road planting strip.
    const riverFringe=nearLine(p,river,67),accessStrip=data.accessRoad&&nearLine(p,data.accessRoad.points,31)&&y>230&&y<355;
    if(!riverFringe&&!accessStrip)continue;
    if(fields.some(field=>pointInside(p,field)))continue;
    if(nearLine(p,river,30)||nearLine(p,centerline,18)||(data.accessRoad&&nearLine(p,data.accessRoad.points,15)))continue;
    if(data.streets.some(street=>nearLine(p,street.points,14)))continue;
    if(treePoints.some(tree=>Math.hypot(x-tree.x,y-tree.y)<19))continue;
    addTree(x,y,3+random()*3,context);
  }
  // Scattered planting in the strip between the highway and access approach.
  const accessLine=data.accessRoad.points;
  function lineY(points,x){for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0])&&Math.abs(b[0]-a[0])>.01)return a[1]+(x-a[0])/(b[0]-a[0])*(b[1]-a[1]);}return null;}
  for(let x=195;x<647;x+=18){const north=lineY(centerline,x),south=lineY(accessLine,x);if(north==null||south==null||south-north<25)continue;for(let row=0;row<2;row++){const y=north+12+(south-north-24)*(row*.55+random()*.3);const tx=x+random()*8;if(nearLine([tx,y],centerline,11)||nearLine([tx,y],accessLine,11))continue;addTree(tx,y,2.8+random()*2,context);}}
  const trunkGeo=new THREE.CylinderGeometry(.18,.27,1,5),crownGeo=new THREE.IcosahedronGeometry(1,1);
  const trunkMat=material('#77634a'),leafMat=material('#526d3f');
  for(const parent of [development,context]){
    const trees=treePoints.filter(p=>p.parent===parent),trunks=new THREE.InstancedMesh(trunkGeo,trunkMat,trees.length),crowns=new THREE.InstancedMesh(crownGeo,leafMat,trees.length),dummy=new THREE.Object3D();
    trees.forEach((p,i)=>{const base=heightAt(terrain,p.x,p.y)+.35;
      dummy.position.set(p.x-500,base+p.size*.45,p.y-380);dummy.scale.set(1,p.size*.9,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
      dummy.position.y=base+p.size*1.12;dummy.scale.set(p.size*.7,p.size*.8,p.size*.65);dummy.rotation.y=i*2.4;dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);crowns.setColorAt(i,new THREE.Color().setHSL(.23+(i%5)*.012,.23,.27+(i%4)*.025));
    });crowns.castShadow=true;crowns.receiveShadow=false;parent.add(trunks,crowns);
  }
  // A few discreet benches along the central pedestrian path.
  const seatGeo=new THREE.BoxGeometry(2.2,.25,.65),seatMat=material('#8a6a47');
  for(let i=12;i<walk.length;i+=28){const p=walk[i],seat=new THREE.Mesh(seatGeo,seatMat);seat.position.set(p[0]-500,heightAt(terrain,...p)+.95,p[1]-380);development.add(seat);}
  const atlas=createSurfaceAtlas(ground,commands,[],lots,options);
  atlas.repaint();
  return {development,context,treeCount:treePoints.length,labels,repaint:atlas.repaint};
}

// A single terrain texture replaces stacked coplanar meshes: no competing depth buffers.
function createSurfaceAtlas(ground,commands,labels,lots,options){
 const mobile=matchMedia('(max-width:760px)').matches;
 const canvas=document.createElement('canvas'),size=mobile?1024:2048;canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d',{alpha:false}),bounds=ground.geometry.userData.mapBounds;
 const detailCanvas=document.createElement('canvas'),detailSize=mobile?2048:4096;detailCanvas.width=detailCanvas.height=detailSize;const detailCtx=detailCanvas.getContext('2d',{alpha:false}),detailBounds={xMin:60,xMax:860,yMin:220,yMax:720};
 const soil=surfaceTexture('soil'),grass=surfaceTexture('grass');
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.anisotropy=options.anisotropy||4;
 texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
 ground.material.map?.dispose();ground.material.map=texture;ground.material.color.set('#fff');ground.material.roughness=1;ground.material.needsUpdate=true;
 const detailTexture=new THREE.CanvasTexture(detailCanvas);detailTexture.colorSpace=THREE.SRGBColorSpace;detailTexture.flipY=false;detailTexture.anisotropy=texture.anisotropy;
 const rect=new THREE.Vector4((detailBounds.xMin-bounds.xMin)/(bounds.xMax-bounds.xMin),(detailBounds.yMin-bounds.yMin)/(bounds.yMax-bounds.yMin),(detailBounds.xMax-bounds.xMin)/(bounds.xMax-bounds.xMin),(detailBounds.yMax-bounds.yMin)/(bounds.yMax-bounds.yMin));
 ground.material.onBeforeCompile=shader=>{shader.uniforms.moradaDetailMap={value:detailTexture};shader.uniforms.moradaDetailRect={value:rect};shader.fragmentShader='uniform sampler2D moradaDetailMap;\nuniform vec4 moradaDetailRect;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
#ifdef USE_MAP
 vec4 moradaColor=texture2D(map,vMapUv);
 vec2 moradaUv=(vMapUv-moradaDetailRect.xy)/(moradaDetailRect.zw-moradaDetailRect.xy);
 if(all(greaterThanEqual(moradaUv,vec2(0.0)))&&all(lessThanEqual(moradaUv,vec2(1.0))))moradaColor=texture2D(moradaDetailMap,moradaUv);
 diffuseColor*=moradaColor;
#endif
`);};
 ground.material.customProgramCacheKey=()=> 'morada-single-surface-atlas-v1';
 function paint(ctx,bounds,size){
 const sx=size/(bounds.xMax-bounds.xMin),sy=size/(bounds.yMax-bounds.yMin);
 const patternFor=image=>{const pattern=ctx.createPattern(image,'repeat');pattern.setTransform(new DOMMatrix().scale(.055));return pattern;};
 const dirtPattern=patternFor(soil.image),grassPattern=patternFor(grass.image);
 function polygon(points,append=false){if(!append)ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}
 function text(value,x,y,size,color){ctx.font=`600 ${size}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.strokeStyle='rgba(255,255,255,.65)';ctx.lineWidth=.4;ctx.strokeText(value,x,y);ctx.fillStyle=color;ctx.fillText(value,x,y);}
  ctx.setTransform(sx,0,0,sy,-bounds.xMin*sx,-bounds.yMin*sy);ctx.fillStyle='#92996e';ctx.fillRect(bounds.xMin,bounds.yMin,bounds.xMax-bounds.xMin,bounds.yMax-bounds.yMin);
  ctx.globalAlpha=.12;ctx.fillStyle=dirtPattern;ctx.fillRect(bounds.xMin,bounds.yMin,bounds.xMax-bounds.xMin,bounds.yMax-bounds.yMin);ctx.globalAlpha=1;ctx.globalAlpha=.10;ctx.fillStyle=grassPattern;ctx.fillRect(bounds.xMin,bounds.yMin,bounds.xMax-bounds.xMin,bounds.yMax-bounds.yMin);ctx.globalAlpha=1;
  for(const command of [...commands].sort((a,b)=>a.lift-b.lift)){
   if(!command.parent.visible)continue;
   if(command.line){ctx.beginPath();command.line.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=command.color;ctx.lineWidth=.35;ctx.setLineDash([4,4]);ctx.stroke();ctx.setLineDash([]);continue;}
   polygon(command.points);for(const hole of command.holes||[])polygon(hole,true);ctx.fillStyle=command.color;ctx.fill('evenodd');
   if(command.map){ctx.save();ctx.clip();ctx.globalAlpha=.16;ctx.fillStyle=command.map.name==='grass'?grassPattern:dirtPattern;ctx.fillRect(bounds.xMin,bounds.yMin,bounds.xMax-bounds.xMin,bounds.yMax-bounds.yMin);ctx.restore();}
  }
  for(const lot of lots){if(!lot.polygon?.length)continue;const status=options.statusFor(lot);polygon(lot.polygon);ctx.fillStyle=options.palette[status];ctx.fill();
   if(status==='available'){ctx.save();ctx.clip();ctx.globalAlpha=.14;ctx.fillStyle=grassPattern;ctx.fillRect(bounds.xMin,bounds.yMin,bounds.xMax-bounds.xMin,bounds.yMax-bounds.yMin);ctx.restore();}
   ctx.strokeStyle='#f0ecdf';ctx.lineWidth=.45;ctx.stroke();
  }

  for(const label of labels)if(label.parent.visible)text(label.text,label.x,label.y,label.size,'#4b5146');
  if(options.numbersVisible())for(const lot of lots){if(!lot.point||!lot.polygon||!pointInside(lot.point,lot.polygon))continue;text(String(lot.lot).padStart(2,'0'),...lot.point,3.4,'#393237');}
 }
 function repaint(){paint(ctx,bounds,size);paint(detailCtx,detailBounds,detailSize);texture.needsUpdate=true;detailTexture.needsUpdate=true;}
 return {repaint};
}

export function makeFloatingLabel(parent,text,x,y,terrain,{width=95,block=null}={}){
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 const font=block?'700 62px system-ui':'600 26px system-ui';
 ctx.font=font;
 canvas.width=block?128:Math.ceil(ctx.measureText(text).width+40);
 canvas.height=block?112:52;
 if(!block)width=canvas.width/2;
 ctx.fillStyle=block?'rgba(38,70,50,.96)':'rgba(253,252,247,.94)';
 ctx.strokeStyle=block?'rgba(229,238,216,.8)':'rgba(51,76,55,.22)';
 ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(2,2,canvas.width-4,canvas.height-4,block?22:14);ctx.fill();ctx.stroke();
 ctx.fillStyle=block?'#f8f7ed':'#243f30';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=font;
 ctx.fillText(text,canvas.width/2,canvas.height/2+1,canvas.width-24);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,opacity:0,depthTest:false,depthWrite:false,toneMapped:false}));
 sprite.frustumCulled=false;sprite.position.set(x-500,heightAt(terrain,x,y)+8,y-380);sprite.userData={anchor:sprite.position.clone(),pixelWidth:width,pixelHeight:width*canvas.height/canvas.width,block};sprite.renderOrder=5;parent.add(sprite);return sprite;
}
