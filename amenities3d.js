import {createGoldenRetriever} from './golden-retriever3d.js';
import * as THREE from './vendor/three/three.module.js';
import {heightAt} from './terrain3d.js';

// Small reference models, positioned inside the recreation area from the CAD plan.
export function parkCenterAt(points,y){
  const intersections=[];
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a[1]>y)!==(b[1]>y))intersections.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
  intersections.sort((a,b)=>a-b);return intersections.length>1?[(intersections[0]+intersections.at(-1))/2,y]:null;
}
export function buildAmenities(parent,terrain,{park,surface,path,label,layout}){
  const group=new THREE.Group();parent.add(group);
  const material=color=>new THREE.MeshStandardMaterial({color,roughness:.9});
  const stone=material('#d2c7b2'),wood=material('#9a7450'),metal=material('#6d6970'),violet=material('#80658b'),water=material('#578f9a');
  function box(w,h,d,mat,x,y,z,owner=group){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;owner.add(mesh);return mesh;}
  function cylinder(radius,height,mat,x,y,z,owner=group){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,20),mat);mesh.position.set(x,y,z);mesh.castShadow=true;owner.add(mesh);return mesh;}
  function baseAt(x,y,radius){let min=Infinity,max=-Infinity;for(let i=0;i<20;i++){const a=i*Math.PI/10,h=heightAt(terrain,x+Math.cos(a)*radius,y+Math.sin(a)*radius);min=Math.min(min,h);max=Math.max(max,h);}return {bottom:min-.1,top:max+.25};}
  function plaza(x,y,radius){const base=baseAt(x,y,radius),g=new THREE.Group();g.position.set(x-500,base.top,y-380);group.add(g);cylinder(radius,base.top-base.bottom,stone,0,-(base.top-base.bottom)/2,0,g);return g;}
  function table(g,x,z){cylinder(.9,.16,wood,x,.95,z,g);cylinder(.13,.9,metal,x,.45,z,g);for(const d of [-1,1])box(1.5,.16,.35,wood,x,.55,z+d*1.25,g);cylinder(.06,2.6,metal,x,1.3,z,g);const canopy=new THREE.Mesh(new THREE.ConeGeometry(1.8,.5,12),material('#e5ddcd'));canopy.position.set(x,2.8,z);canopy.castShadow=true;g.add(canopy);}
  const centers={water:parkCenterAt(park,430),grill1:parkCenterAt(park,473),games:parkCenterAt(park,504),grill2:parkCenterAt(park,535),pet:parkCenterAt(park,554)};
  for(const key of ['grill1','grill2']){const p=centers[key];if(!p)continue;const g=plaza(...p,6.2);table(g,-2,-1.5);table(g,2,1.8);box(1.5,1,.8,stone,0,.5,-3.4,g);box(1.4,.12,.75,metal,0,1.08,-3.4,g);}
  if(centers.grill1)label('Zona de parrillas',...centers.grill1);
  if(centers.water){const p=centers.water,g=plaza(...p,5.6);cylinder(3.4,.25,stone,0,.125,0,g);cylinder(3.05,.12,water,0,.31,0,g);for(let i=0;i<5;i++){const a=i*Math.PI*2/5,x=Math.cos(a)*2,z=Math.sin(a)*2;const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,.42,z),new THREE.Vector3(x*.5,2.4,z*.5),new THREE.Vector3(0,.5,0)]);const jet=new THREE.Mesh(new THREE.TubeGeometry(curve,12,.045,4,false),material('#d4eced'));g.add(jet);}label('Juego de aguas',...p);}
  if(centers.games){const p=centers.games,g=plaza(...p,7.3);for(const x of [-1.3,1.3])for(const z of [-1,1])box(.18,3,.18,wood,x,1.5,z,g);box(3,.25,2.5,wood,0,2,0,g);const roof=new THREE.Mesh(new THREE.ConeGeometry(2.2,1.1,4),violet);roof.rotation.y=Math.PI/4;roof.position.y=3.6;roof.castShadow=true;g.add(roof);const slide=box(1.15,.15,4.2,material('#a69db3'),0,1.1,2.7,g);slide.rotation.x=Math.PI/7;for(const x of [-3.3,3.3]){const leg=box(.15,3.4,.15,wood,x,1.7,-3,g);leg.rotation.z=x<0?-.18:.18;}box(7,.18,.18,wood,0,3.3,-3,g);for(const x of [-1.2,1.2]){box(.07,2.1,.07,metal,x,2.2,-3,g);box(.9,.14,.65,violet,x,1.12,-3,g);}label('Zona de juegos',...p);}
  if(centers.pet){const p=centers.pet,g=plaza(...p,4.6);for(const x of [-2,0,2]){const arch=new THREE.Mesh(new THREE.TorusGeometry(.8,.085,5,14,Math.PI),wood);arch.position.set(x,.8,0);g.add(arch);}const puppy=createGoldenRetriever();puppy.position.set(1.3,.08,2.1);puppy.rotation.y=-.6;g.add(puppy);label('Pet friendly',...p);}
  // Club and entrance are indicative models inside the areas shown on the official plan.
  const club=plaza(696,386,19);box(14,5,8,material('#e6ddcb'),7,2.5,-4,club);box(15,.5,9,material('#9a8c7c'),7,5.25,-4,club);box(10,1.1,7,stone,-7,.55,2,club);box(9,.12,6,water,-7,1.16,2,club);box(5,1.05,4,stone,-6,.525,-5,club);box(4,.12,3,water,-6,1.12,-5,club);for(const x of [1,4,7])box(1.6,.4,3,material('#e6dfd1'),x,.35,5,club);label('Club Alegra',696,386);
  const [gateX,gateZ]=layout.gate,gateY=heightAt(terrain,gateX,gateZ);
  const gate=new THREE.Group();gate.position.set(gateX-500,gateY,gateZ-380);gate.rotation.y=layout.gateAngle;group.add(gate);
  box(.8,6,.8,stone,-4.5,3,0,gate);box(.8,6,.8,stone,4.5,3,0,gate);box(10,1.2,1.3,wood,0,6.2,0,gate);
  // Separate security cabin, canopy, glazing and access barrier.
  const cabin=material('#e6ddcb'),glass=material('#42666c');
  box(4,3.5,4,cabin,8,1.75,0,gate);box(4.7,.3,4.7,wood,8,3.65,0,gate);
  box(2.6,1.35,.08,glass,8,2.25,2.04,gate);box(.08,1.35,2.6,glass,5.96,2.25,0,gate);
  box(.35,1.1,.35,metal,4, .55,-2.2,gate);box(7,.14,.16,material('#eee9da'),.5,1.2,-2.2,gate);
  label('Pórtico y seguridad',gateX,gateZ);
  const mirador=plaza(815,544,6.5);box(8,.3,5,wood,0,.15,0,mirador);for(const x of [-3.5,0,3.5])box(.12,1.2,.12,metal,x,.8,2.3,mirador);box(7.5,.12,.12,metal,0,1.35,2.3,mirador);box(3,.2,.7,wood,0,.65,-1.3,mirador);label('Mirador',815,544);
  const trekMaterial=material('#b87563');
  for(const trek of layout.trekking)path(trek,3.2,trekMaterial,.4);
  for(const [x,y] of layout.trekkingPlatforms){const points=Array.from({length:20},(_,i)=>[x+Math.cos(i*Math.PI/10)*5,y+Math.sin(i*Math.PI/10)*5]);surface(points,trekMaterial,.41);}
  label('Trekking',105,228);
  return {centers,group};
}
