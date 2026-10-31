import * as THREE from './vendor/three/three.module.js';

// Seated golden retriever: broad head, feathered chest and tail, green bandana.
export function createGoldenRetriever(){
 const dog=new THREE.Group();dog.name='Golden retriever sentado con pañoleta verde';dog.userData.easterEgg=true;
 const coat=new THREE.MeshStandardMaterial({color:'#d8a14b',roughness:1});
 const feather=new THREE.MeshStandardMaterial({color:'#f0ce87',roughness:1});
 const ears=new THREE.MeshStandardMaterial({color:'#be863b',roughness:1});
 const dark=new THREE.MeshStandardMaterial({color:'#30271f',roughness:.65});
 const green=new THREE.MeshStandardMaterial({color:'#2c8051',roughness:.95,side:THREE.DoubleSide});
 const sphere=new THREE.SphereGeometry(1,20,14);
 function oval(material,x,y,z,sx,sy,sz){const m=new THREE.Mesh(sphere,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;dog.add(m);return m;}
 // Weight sits on the haunches, with straight forelegs and two forward paws.
 oval(coat,0,.58,-.12,.35,.51,.37);
 oval(coat,0,.29,-.28,.39,.28,.35);
 for(const x of [-1,1]){
  oval(coat,x*.3,.28,-.12,.20,.24,.27);
  oval(feather,x*.31,.10,.1,.18,.10,.24);
  oval(coat,x*.18,.43,.32,.10,.35,.11);
  oval(feather,x*.18,.10,.41,.13,.10,.20);
 }
 oval(feather,0,.84,.19,.29,.42,.25);
 for(const x of [-1,0,1])oval(feather,x*.15,.66,.32,.11,.22,.1);
 oval(coat,0,1.10,.12,.24,.28,.24);
 oval(coat,0,1.40,.20,.31,.29,.29);
 oval(feather,0,1.27,.43,.21,.14,.24);
 oval(dark,0,1.32,.653,.10,.065,.045);
 for(const x of [-1,1]){
  const ear=oval(ears,x*.285,1.23,.14,.115,.27,.16);ear.rotation.z=x*.12;
  oval(dark,x*.15,1.46,.439,.036,.042,.027);
  oval(feather,x*.145,1.477,.46,.009,.012,.008);
 }
 const band=new THREE.Mesh(new THREE.TorusGeometry(.245,.045,8,28),green);band.rotation.x=Math.PI/2;band.position.set(0,1.07,.14);dog.add(band);
 const bibGeometry=new THREE.BufferGeometry();bibGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.23,1.08,.36,.23,1.08,.36,0,.70,.47],3));bibGeometry.computeVertexNormals();
 const bib=new THREE.Mesh(bibGeometry,green);bib.castShadow=true;dog.add(bib);
 oval(green,.24,1.06,.05,.075,.065,.07);
 const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.22,-.47),new THREE.Vector3(.35,.13,-.57),new THREE.Vector3(.57,.12,-.30),new THREE.Vector3(.58,.11,.05)]);
 const tail=new THREE.Mesh(new THREE.TubeGeometry(curve,18,.11,8,false),feather);tail.castShadow=true;dog.add(tail);
 dog.scale.setScalar(1.2);
 return dog;
}
