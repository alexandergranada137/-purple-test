import * as THREE from './vendor/three/three.module.js';

export function heightAt(terrain,x,y){
  if(!terrain)return 0;
  const u=Math.max(0,Math.min(terrain.columns-1,(x-terrain.xMin)/(terrain.xMax-terrain.xMin)*(terrain.columns-1)));
  const v=Math.max(0,Math.min(terrain.rows-1,(y-terrain.yMin)/(terrain.yMax-terrain.yMin)*(terrain.rows-1)));
  const x0=Math.min(Math.floor(u),terrain.columns-2),y0=Math.min(Math.floor(v),terrain.rows-2),fx=u-x0,fy=v-y0;
  const h=(a,b)=>terrain.heights[b*terrain.columns+a];
  // Use the same diagonal and planar interpolation as the rendered ground.
  return fx+fy<=1 ? h(x0,y0)+(h(x0+1,y0)-h(x0,y0))*fx+(h(x0,y0+1)-h(x0,y0))*fy
    : h(x0+1,y0+1)+(h(x0,y0+1)-h(x0+1,y0+1))*(1-fx)+(h(x0+1,y0)-h(x0+1,y0+1))*(1-fy);
}
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function clip(subject,triangle){
  let output=subject;
  for(let i=0;i<3;i++){
    const a=triangle[i],b=triangle[(i+1)%3],input=output;output=[];
    for(let j=0;j<input.length;j++){
      const p=input[j],q=input[(j+1)%input.length],dp=cross(a,b,p),dq=cross(a,b,q),pin=dp>=-1e-8,qin=dq>=-1e-8;
      if(pin)output.push(p);
      if(pin!==qin){const t=dp/(dp-dq);output.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
    }
    if(output.length<3)return [];
  }
  return output;
}
function clean(polygon){
  const points=polygon.filter((p,i,a)=>!i || Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>1e-7);
  if(points.length>1&&Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<1e-7)points.pop();
  return points;
}
export function drapePolygon(polygon,terrain,lift=.25){
  const points=clean(polygon),faces=THREE.ShapeUtils.triangulateShape(points.map(p=>new THREE.Vector2(...p)),[]),positions=[],uv=[];
  function append(poly){for(let i=1;i+1<poly.length;i++){
    const tri=[poly[0],poly[i+1],poly[i]];
    if(Math.abs(cross(...tri))<1e-8)continue;
    for(const [x,y] of tri){positions.push(x-500,heightAt(terrain,x,y)+lift,y-380);uv.push(x/14,y/14);}
  }}
  for(const face of faces){
    const tri=face.map(i=>points[i]);
    if(!terrain){append(tri);continue;}
    const dx=(terrain.xMax-terrain.xMin)/(terrain.columns-1),dy=(terrain.yMax-terrain.yMin)/(terrain.rows-1);
    const c0=Math.max(0,Math.floor((Math.min(...tri.map(p=>p[0]))-terrain.xMin)/dx)),c1=Math.min(terrain.columns-2,Math.floor((Math.max(...tri.map(p=>p[0]))-terrain.xMin)/dx));
    const r0=Math.max(0,Math.floor((Math.min(...tri.map(p=>p[1]))-terrain.yMin)/dy)),r1=Math.min(terrain.rows-2,Math.floor((Math.max(...tri.map(p=>p[1]))-terrain.yMin)/dy));
    for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){
      const x=terrain.xMin+c*dx,y=terrain.yMin+r*dy,a=[x,y],b=[x+dx,y],d=[x,y+dy],e=[x+dx,y+dy];
      append(clip(tri,[a,b,d]));append(clip(tri,[b,e,d]));
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.addGroup(0,positions.length/3,0);geometry.computeVertexNormals();return geometry;
}
export function groundGeometry(terrain){
  const xs=[Math.min(-600,terrain.xMin-100),...Array.from({length:terrain.columns},(_,i)=>terrain.xMin+i*(terrain.xMax-terrain.xMin)/(terrain.columns-1)),Math.max(1600,terrain.xMax+100)];
  const ys=[Math.min(-500,terrain.yMin-100),...Array.from({length:terrain.rows},(_,i)=>terrain.yMin+i*(terrain.yMax-terrain.yMin)/(terrain.rows-1)),Math.max(1300,terrain.yMax+100)];
  const vertices=[],uv=[],indices=[];
  for(const y of ys)for(const x of xs){vertices.push(x-500,heightAt(terrain,x,y),y-380);uv.push((x-xs[0])/(xs.at(-1)-xs[0]),(y-ys[0])/(ys.at(-1)-ys[0]));}
  for(let r=0;r<ys.length-1;r++)for(let c=0;c<xs.length-1;c++){const a=r*xs.length+c,b=a+1,d=a+xs.length,e=d+1;indices.push(a,d,b,b,d,e);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.userData.mapBounds={xMin:xs[0],xMax:xs.at(-1),yMin:ys[0],yMax:ys.at(-1)};return geometry;
}
export function boundaryPoints(points,terrain,lift=.45,closed=true){
  const result=[];
  for(let i=0;i<points.length-(closed?0:1);i++){const a=points[i],b=points[(i+1)%points.length],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2));for(let n=0;n<steps;n++){const t=n/steps,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;result.push(new THREE.Vector3(x-500,heightAt(terrain,x,y)+lift,y-380));}}
  return result;
}
