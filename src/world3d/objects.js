import * as THREE from 'three';
import {CELL,terrainSeed} from './model.js';

const PALETTES={
  dark:{sky:0x101c30,fog:0x101c30,road:0x17263b,pavement:0x2a3b50,body:0x41576e,glass:0x68bfc7,grass:0x1a665b,tree:0x42b58b,text:'#eafaff',board:'#142839'},
  light:{sky:0xd7e7ed,fog:0xd7e7ed,road:0x9bafbc,pavement:0xcbd9dd,body:0xdce8e5,glass:0x42889a,grass:0x94c9a5,tree:0x398b70,text:'#173840',board:'#eaf6f3'}
};
export {PALETTES};

export function createAssets(){
  const geometries={box:new THREE.BoxGeometry(1,1,1),trunk:new THREE.CylinderGeometry(.14,.22,1,5),tree:new THREE.IcosahedronGeometry(1,0)};
  const material=new THREE.MeshStandardMaterial({roughness:.8,metalness:.12});
  const glow=new THREE.MeshStandardMaterial({roughness:.5,metalness:.1,emissive:0x559fbc,emissiveIntensity:.35});
  return {geometries,material,glow,dispose(){Object.values(geometries).forEach(g=>g.dispose());material.dispose();glow.dispose();}};
}

const dummy=new THREE.Object3D();
function batch(group,geometry,material,items,{shadows=false}={}){
  if(!items.length)return;
  const mesh=new THREE.InstancedMesh(geometry,material,items.length);
  items.forEach((item,i)=>{
    dummy.position.set(item.x,item.y,item.z);dummy.scale.set(item.w||1,item.h||1,item.d||1);dummy.rotation.set(0,item.rotation||0,0);dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color(item.color));
  });
  mesh.castShadow=shadows;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);return mesh;
}

function panelTexture(title,subtitle,palette){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;
  const c=canvas.getContext('2d');c.fillStyle=palette.board;c.fillRect(0,0,512,192);
  c.fillStyle='#64d9cd';c.fillRect(0,0,8,192);c.fillRect(24,25,42,4);
  c.fillStyle=palette.text;c.font='bold 28px system-ui';
  const words=String(title).slice(0,100).split(/\s+/);let line='',y=75;
  for(const word of words){const next=line?line+' '+word:word;if(c.measureText(next).width>460&&line){c.fillText(line,24,y,460);line=word;y+=36;if(y>115)break;}else line=next;}
  if(y<=115)c.fillText(line,24,y,460);
  c.globalAlpha=.7;c.font='17px system-ui';c.fillText(String(subtitle).slice(0,65),24,166,465);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;return texture;
}

export function buildChunk(assets,{x,z,description,detail,theme}){
  const group=new THREE.Group(),owned=[],palette=PALETTES[theme],seed=terrainSeed(x,z);
  const solids=[{x:16,y:-.2,z:12,w:CELL.x,h:.4,d:CELL.z,color:palette.road},
    {x:16,y:.03,z:12,w:27,h:.12,d:19,color:palette.pavement}];
  const windows=[];
  if(description){
    const p=description;
    for(const body of p.bodies){
      solids.push({x:body.x,y:body.y+body.h/2+.12,z:body.z,w:body.w,h:body.h,d:body.d,color:palette.body});
      solids.push({x:body.x,y:body.y+body.h+.2,z:body.z,w:body.w+.25,h:.22,d:body.d+.25,color:p.accent});
      if(detail==='full'){
        const rows=Math.max(1,Math.floor(body.h/2)),cols=Math.max(2,Math.floor(body.w/2));
        for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
          windows.push({x:body.x-body.w/2+(col+.5)*body.w/cols,y:body.y+1+row*1.8,z:body.z+body.d/2+.04,w:.8,h:.7,d:.05,color:(row+col+seed)%3?p.secondary:palette.glass});
        }
        // Side windows make geometric depth visible while orbiting.
        for(let row=0;row<rows;row++)for(let col=0;col<3;col++)windows.push({x:body.x+body.w/2+.04,y:body.y+1+row*1.8,z:body.z-body.d/2+(col+.5)*body.d/3,w:.05,h:.7,d:.8,color:palette.glass});
      }
    }
    if(detail==='full'){
      const b=p.bodies[0],front=b.z+b.d/2+.2;
      solids.push({x:b.x,y:1.2,z:front,w:1.5,h:2.2,d:.25,color:palette.road});
      if(['market','central','pod','kiosk'].includes(p.archetype))solids.push({x:b.x,y:3,z:front+.6,w:b.w*.9,h:.3,d:1.7,color:p.secondary});
      const texture=panelTexture(p.title,p.home?'PESQUISE · EXPLORE · DESCUBRA':p.site.metadataStatus==='url-only'?'Endereço · metadados não confirmados':p.site.source||p.site.domain,palette);
      const material=new THREE.MeshBasicMaterial({map:texture});owned.push(texture,material);
      const sign=new THREE.Mesh(new THREE.PlaneGeometry(7.5,2.8),material);owned.push(sign.geometry);
      sign.position.set(b.x,Math.min(b.h-1,4.3),front+.16);group.add(sign);
      sign.userData.interactive=true;
      // Screens have real frames/supports and are occluded by architecture.
      if(p.home||p.site?.id){
        const px=24,pz=19.1;
        solids.push({x:px,y:1,z:pz,w:.28,h:2,d:.3,color:palette.body},{x:px,y:2.7,z:pz,w:5.6,h:2.6,d:.35,color:p.accent});
        const content=new THREE.Mesh(new THREE.PlaneGeometry(5.2,2.2),material);owned.push(content.geometry);
        content.position.set(px,2.7,pz+.2);group.add(content);
        content.userData.interactive=true;
        group.userData.mediaSurface=content;
      }
    }
  } else {
    // Parks and open plazas vary without moving the connected road perimeter.
    solids.push({x:16,y:.12,z:12,w:seed%3===0?10:19,h:.12,d:seed%3===0?13:11,color:palette.grass});
    if(seed%2)solids.push({x:16,y:.2,z:12,w:2,h:.1,d:17,color:palette.pavement,rotation:.25});
    const trunks=[],trees=[];
    for(const [xx,zz] of [[7,6],[25,7],[8,18],[25,17]]){
      trunks.push({x:xx,y:1,z:zz,h:2,color:0x765f54});trees.push({x:xx,y:2.5,z:zz,w:1.6,h:1.8,d:1.6,color:palette.tree});
    }
    batch(group,assets.geometries.trunk,assets.material,trunks);
    batch(group,assets.geometries.tree,assets.material,trees,{shadows:detail==='full'});
  }
  const mass=batch(group,assets.geometries.box,assets.material,solids,{shadows:detail==='full'});
  if(description)mass.userData.interactiveFrom=2;
  batch(group,assets.geometries.box,assets.glow,windows);
  group.userData.owned=owned;group.userData.description=description;
  return group;
}

export function disposeChunk(group){
  // Geometry/material shared by instanced meshes belongs to the asset pool.
  for(const item of group.userData.owned||[])item.dispose();
  group.traverse(obj=>{if(obj.isInstancedMesh)obj.dispose();});
  group.removeFromParent();
}

export function createAvatar(assets){
  const group=new THREE.Group();
  const body=new THREE.Mesh(assets.geometries.box,new THREE.MeshStandardMaterial({color:0x58ded1,roughness:.7}));
  body.scale.set(.65,.85,.4);body.position.y=1;body.castShadow=true;group.add(body);
  const head=new THREE.Mesh(assets.geometries.tree,new THREE.MeshStandardMaterial({color:0xf0c1a0,roughness:.9}));
  head.position.y=1.7;head.scale.setScalar(.3);head.castShadow=true;group.add(head);
  const legs=[];
  for(const x of [-.2,.2]){const leg=new THREE.Mesh(assets.geometries.box,new THREE.MeshStandardMaterial({color:0x172d43}));leg.scale.set(.22,.55,.28);leg.position.set(x,.3,0);leg.castShadow=true;group.add(leg);legs.push(leg);}
  group.userData.legs=legs;return group;
}
