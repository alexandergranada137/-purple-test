import * as THREE from './vendor/three/three.module.js';

const surfaceImages=new Map();
// Small, repeatable procedural materials. No external photographs or tracking requests.
export function surfaceTexture(kind) {
  if(surfaceImages.has(kind))return textureFromSurface(surfaceImages.get(kind),kind);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  let seed = kind === 'grass' ? 417 : 931;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.fillStyle = kind === 'grass' ? '#718c4c' : '#b8ac92';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 14000; i++) {
    const x = random() * 256, y = random() * 256;
    if (kind === 'grass') {
      ctx.strokeStyle = ['#59763b','#829c57','#9ba96a','#657c43'][Math.floor(random()*4)];
      ctx.lineWidth = .6;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+(random()-.5)*3,y-random()*4); ctx.stroke();
    } else {
      ctx.fillStyle = ['#a69a80','#c9bda4','#d0c5ac','#998e77'][Math.floor(random()*4)];
      ctx.fillRect(x,y,random()*2+.4,random()*2+.4);
    }
  }
  surfaceImages.set(kind,canvas);
  return textureFromSurface(canvas,kind);
}
function textureFromSurface(canvas,kind){
 const texture=new THREE.CanvasTexture(canvas);texture.name=kind;texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;return texture;
}

export function createHouse(size, status) {
  const group = new THREE.Group();
  const wall = new THREE.MeshStandardMaterial({color: '#e9dfcc', roughness:.94});
  const roof = new THREE.MeshStandardMaterial({color: '#8a6b5b', roughness:.9});
  const glass = new THREE.MeshStandardMaterial({color:'#445e61',roughness:.32,metalness:.15});
  const box = (w,h,d,material,x,y,z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
  };
  if(status==='separated'){
    const concrete=new THREE.MeshStandardMaterial({color:'#b3b0a3',roughness:1});
    const brick=new THREE.MeshStandardMaterial({color:'#b47c58',roughness:1});
    const steel=new THREE.MeshStandardMaterial({color:'#595b55',roughness:.8});
    box(size*1.14,size*.08,size*.94,concrete,0,size*.04,0);
    for(const x of [-.46,.46])for(const z of [-.35,.35]){
      box(size*.09,size*.58,size*.09,concrete,x*size,size*.37,z*size);
      box(size*.018,size*.2,size*.018,steel,x*size,size*.76,z*size);
    }
    for(const z of [-.35,.35])box(size, size*.07,size*.09,concrete,0,size*.675,z*size);
    for(const x of [-.46,.46])box(size*.09,size*.07,size*.79,concrete,x*size,size*.675,0);
    box(size*.85,size*.28,size*.07,brick,0,size*.22,-size*.35);
    box(size*.07,size*.18,size*.62,brick,-size*.46,size*.17,0);
    box(size*.32,size*.23,size*.07,brick,size*.3,size*.195,size*.35);
    box(size*.25,size*.10,size*.21,brick,-size*.29,size*.13,size*.57);
    for(let i=0;i<3;i++)box(size*.4,size*.025,size*.045,roof,size*.2,size*(.1+i*.03),size*.55);
    group.userData.constructionStage='structure';
    return group;
  }
  box(size,size*.65,size*.8,wall,0,size*.325,0);
  box(size*1.12,size*.12,size*.93,roof,0,size*.71,0);
  box(size*.22,size*.38,.12,glass,-size*.23,size*.32,size*.405);
  box(size*.22,size*.38,.12,glass,size*.23,size*.32,size*.405);
  box(size*.16,size*.45,.14,roof,0,size*.225,size*.41);
  const stripe = new THREE.MeshStandardMaterial({color:status==='sold'?'#a54e42':'#b58e45'});
  box(size*.85,.3,size*.18,stripe,0,.15,size*.6);
  return group;
}
