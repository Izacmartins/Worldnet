/**
 * Worldnet City v0.8 – low-cost 2.5D procedural architecture.
 * Buildings are unique per domain; only verified metadata is credited to brands.
 * The procedural palette is urban art, NOT purported site branding.
 */
import {visualIdentity, domainHash, billboardContent} from './identity.js';
export const CHUNK_W = 320, CHUNK_H = 240;
export const THEMES = {
  dark:{night:true,backdrop:0x070a15,street:0x0e1220,asphalt:0x141926,roadLine:0x747e91,
    slab:0x22283a,slabAlt:0x22283a,plot:0x182231,plotInner:0x1a2333,railing:0x58657b,
    neon:0x5ae7f2,neonAlt:0xdb83ed,text:'#f1f6ff',muted:'#b4c8e4',face:0x343b50,
    side:0x1b1e32,roof:0x475064,window:0x99ddf4,windowOff:0x384a60,door:0x0c1628,
    outline:0x070c19,light:0xc9efff,shadow:0x02040b},
  light:{night:false,backdrop:0xe8eef6,street:0xdce2ec,asphalt:0xcad2e0,roadLine:0x8fa0b5,
    slab:0xe5e9f0,slabAlt:0xf5f7fa,plot:0xd2dbe7,plotInner:0xe4ebf4,railing:0x859cb5,
    neon:0x067daf,neonAlt:0x8e55ae,text:'#15334c',muted:'#51687e',face:0xf5f7fc,
    side:0x9eaec4,roof:0xffffff,window:0x69a8d6,windowOff:0xbccddd,door:0x344b68,
    outline:0x7d92ab,light:0xeaf8ff,shadow:0x8295a7}
};
export function colorInt(c){const n=parseInt(String(c||'').replace('#',''),16);return Number.isFinite(n)?n:0x74889e;}
export function blend(a,b,t){
  const channel=(x,i)=>(x>>>i)&255;
  const mix=i=>Math.max(0,Math.min(255,Math.round(channel(a,i)*(1-t)+channel(b,i)*t)));
  return (mix(16)<<16)|(mix(8)<<8)|mix(0);
}
export function normalizeCategory(value){
  const c=String(value||'').toLocaleLowerCase('pt-BR');
  if(c.includes('loja'))return 'Loja'; if(c.includes('blog'))return 'Blog';
  if(c.includes('notíc')||c.includes('notic'))return 'Notícias';
  if(c.includes('wiki'))return 'Wiki';
  if(c.includes('comunidade')||c.includes('forum'))return 'Comunidade';
  if(c.includes('jogo')||c.includes('game'))return 'Jogos';
  if(c.includes('educa'))return 'Educação';
  if(c.includes('tecno')||c.includes('software'))return 'Tecnologia';
  if(c.includes('mídia')||c.includes('midia')||c.includes('vídeo'))return 'Mídia';
  if(c.includes('música')||c.includes('musica'))return 'Música';
  if(c.includes('viagem'))return 'Viagem';
  if(c.includes('finan'))return 'Finanças';
  return 'Site';
}
export function infoLevel(site){
  if(!site)return 0;
  if(site.metadataStatus==='url-only')return 1;
  const hasName=Boolean(site.title && site.title!==site.domain);
  const typed=normalizeCategory(site.category)!=='Site'||visualIdentity(site).category!=='Site';
  // Level 3 requires real, sourced brand colors. Procedural colors DO NOT count.
  if(hasName&&typed&&site.colorVerified)return 3;
  if(hasName||typed||site.official||site.description)return 2;
  return 1;
}
const planCache = new WeakMap();
let cachedHomePlan=null;
export function buildingPlan(site,home=false){
  if (home && cachedHomePlan) return cachedHomePlan;
  if (!home && site && planCache.has(site)) return planCache.get(site);
  const seed=domainHash(site?.id||site?.domain||'worldnet-central');
  const level=home?3:infoLevel(site);
  const rank=Number(site?.rank)||Number.POSITIVE_INFINITY;
  const identity=visualIdentity(site||{});
  const archetype=home?'central':identity.archetype;
  // Lots use a six-column by three-row invisible construction grid.
  const scale=rank<=20?1:rank<=500?.75:rank<=5000?.5:0;
  const variant=domainHash(`${site?.id||site?.domain||'central'}:lot`);
  const widthCells=home?5:Math.min(6,Math.max(2,2+(variant%4)+(level===3?1:0)+(scale>0.8?1:0)));
  const heightCells=home?3:Math.min(3,1+((variant>>>8)%3));
  const plot={x:28,y:24,w:264,h:192};
  const width=Math.max(64,Math.round(plot.w*(widthCells/6))-12);
  const height=Math.max(47,Math.round(plot.h*(heightCells/3))-16);
  const solid={x:Math.round((CHUNK_W-width)/2),y:214-height,w:width,h:height};
  const floors=home?3:1+((seed>>>12)%4)+(level===3?1:0);
  const roofStyle=(seed>>>17)%5;
  const plan={level,widthCells,heightCells,plot,solid,home,seed,floors,roofStyle,archetype};
  if(home) cachedHomePlan=plan;
  else if(site) planCache.set(site,plan);
  return plan;
}
export function hitsSolid(px,py,wx,wy,plan,radius=8){
  if(!plan)return false;
  const b=plan.solid;
  const nx=Math.max(wx+b.x,Math.min(px,wx+b.x+b.w));
  const ny=Math.max(wy+b.y,Math.min(py,wy+b.y+b.h));
  return (px-nx)**2+(py-ny)**2<radius**2;
}
export function distanceToSolid(px,py,wx,wy,plan){
  const b=plan.solid;
  return Math.hypot(Math.max(wx+b.x-px,0,px-wx-b.x-b.w),Math.max(wy+b.y-py,0,py-wy-b.y-b.h));
}
const rec=(g,x,y,w,h,c,a=1,r=0)=>{g.fillStyle(c,a);r?g.fillRoundedRect(x,y,w,h,r):g.fillRect(x,y,w,h);};
const ln=(g,x,y,X,Y,c,a=1,width=1)=>{g.lineStyle(width,c,a).lineBetween(x,y,X,Y);};
const poly=(g,c,points,a=1)=>{g.fillStyle(c,a).fillPoints(points.map(([x,y])=>({x,y})),true);};
const ellipse=(g,x,y,w,h,c,a=1)=>{g.fillStyle(c,a).fillEllipse(x,y,w,h);};
const circle=(g,x,y,r,c,a=1)=>{g.fillStyle(c,a).fillCircle(x,y,r);};
function txt(scene,text,x,y,opts={}){
  const e=scene.add.text(x,y,text,{fontFamily:'Arial, sans-serif',fontSize:'12px',fontStyle:'bold',
    color:'#ffffff',align:'center',resolution:1.5,...opts});e.setOrigin(.5);return e;
}
function short(v,max=22){const s=String(v||'').trim();return s.length>max?s.slice(0,max-1)+'…':s;}

/** 12 reusable road/plaza variations per theme, no visible construction grid. */
export function drawGround(scene,cx,cy,theme,vacant=false){
  const p=THEMES[theme],v=((Math.abs(cx)+Math.abs(cy)*3)%12);
  const g=scene.add.graphics();
  rec(g,0,0,CHUNK_W,CHUNK_H,p.asphalt);
  // Seamless, smooth roads: run around the lots. Broken lane strips removed.
  rec(g,0,0,CHUNK_W,21,p.street);
  rec(g,0,CHUNK_H-21,CHUNK_W,21,p.street);
  rec(g,0,0,24,CHUNK_H,p.street);
  rec(g,CHUNK_W-24,0,24,CHUNK_H,p.street);
  // Perímetros conectados; o interior varia para parecer uma cidade menos quadriculada.
  rec(g,24,22,272,196,p.slab);
  rec(g,29,27,262,186,p.slabAlt);
  if(v%3===0){
    // praça oval / rotatória de pedestres (não bloqueia circulação)
    ellipse(g,160,117,248,169,p.plotInner,1);
  }else if(v%3===1){
    rec(g,39,34,242,172,p.plotInner,1,27);
  }else{
    rec(g,35,33,250,174,p.plotInner,1,7);
  }
  if(v===6||v===8||v===11){
    // passeio diagonal conecta a borda sul à fachada, sem barreira física
    poly(g,p.slabAlt,[[30,187],[52,206],[282,48],[266,31]],.7);
  }
  ln(g,0,19,CHUNK_W,19,p.roadLine,.15);
  ln(g,0,221,CHUNK_W,221,p.roadLine,.18);
  ln(g,24,0,24,CHUNK_H,p.roadLine,.13);
  ln(g,296,0,296,CHUNK_H,p.roadLine,.13);
  // Clean, randomized plaza details do not obstruct paths.
  if(v===0 || v===4){
    rec(g,31,207,258,4,p.roadLine,.22,1);
    for(let i=0;i<3;i++)rec(g,38+i*22,207,13,4,p.neon,.25,1);
  }else if(v===1 || v===5){
    g.lineStyle(2,p.railing,.35).strokeRoundedRect(32,30,256,180,13);
    rec(g,38,196,26,8,p.roadLine,.27,2);
    rec(g,CHUNK_W-64,196,26,8,p.roadLine,.27,2);
  }else{
    g.lineStyle(1,p.neon,.18).strokeRoundedRect(36,33,248,175,5);
    for(const x of [39,281]){rec(g,x,185,3,19,p.railing,.22);}
  }
  // Subtle curved road junctions on some chunks; no unnatural painted grids.
  if(v===2 || v===5){
    g.lineStyle(2,p.roadLine,.18);g.beginPath();g.arc(21,21,17,0,Math.PI/2,false);g.strokePath();
    g.lineStyle(2,p.roadLine,.18);g.beginPath();g.arc(299,219,17,Math.PI,Math.PI*1.5,false);g.strokePath();
  }
  // Praças/áreas de respiro: árvores, pisos lisos, canteiros ovais e bancos baixos.
  // São desenhos no chão: sem colisão nem objetos adicionais por chunk.
  if(vacant){
    const park=(v%4)!==1;
    if(park){
      ellipse(g,161,116,172,113,p.night?0x192c31:0xb8d8cd,.90);
      ellipse(g,161,116,127,77,p.night?0x1b413f:0x9bc7b2,.68);
      for(const [px,py] of [[88,70],[230,80],[87,170],[236,171]]){
        circle(g,px+2,py+4,12,p.shadow,.18);
        circle(g,px,py,9,p.night?0x217267:0x469775,.83);
        circle(g,px-3,py-3,4,p.night?0x50cba4:0x78b999,.82);
      }
    }else{
      ellipse(g,159,117,170,111,p.night?0x283047:0xd8e3ef,.7);
      for(let i=0;i<3;i++){
        const rx=99+i*57;
        rec(g,rx,108,32,5,p.railing,.56,2);
        rec(g,rx,118,32,2,p.neon,.30,1);
      }
    }
    // Passeios CURVOS que formam desvios nas praças. Todos conectam às
    // calçadas externas, e os lotes vazios permanecem completamente transitáveis.
    g.lineStyle(15,p.slabAlt,.65);
    g.beginPath();
    if(v%2===0){
      g.moveTo(25,120);
      for(let i=1;i<=16;i++){
        const t=i/16;
        g.lineTo(25+270*t,120+Math.sin((t*1.55-.22)*Math.PI)*(v%4===0?44:-40));
      }
    }else{
      g.moveTo(160,24);
      for(let i=1;i<=16;i++){
        const t=i/16;
        g.lineTo(160+Math.sin(t*Math.PI*1.8)*(v%3===0?35:-34),24+192*t);
      }
    }
    g.strokePath();
  }
  // Pequenos marcadores nas esquinas, sem rede de traços/grades.
  for(const [x,y] of [[31,25],[289,25],[31,215],[289,215]]){
    rec(g,x-2,y-2,4,4,p.railing,.45,1);
    rec(g,x-1,y-1,2,2,p.neon,.52,1);
  }
  return g;
}
function windows(g,identity,p,left,top,w,bottom,cols=4,rows=2){
  const front=bottom-top, regionTop=top+40,regionBottom=bottom-35;
  if(regionBottom<=regionTop)return;
  const dx=(w-27)/cols, dy=(regionBottom-regionTop)/Math.max(1,rows);
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const x=left+13+i*dx+2,y=regionTop+j*dy+2;
    const width=Math.max(6,dx-7), height=Math.max(6,Math.min(21,dy-5));
    const lit=((identity.seed>>>((i+j*3)%24))&1)===1;
    rec(g,x,y,width,height,lit?identity.glow:p.windowOff,lit?.59:.35,1);
    if(lit && width>=14)ln(g,x+3,y+4,x+Math.min(width-3,12),y+4,0xffffff,.18,1);
  }
}
function door(g,p,identity,left,bottom,w,shape='normal'){
  const dw=Math.min(30,Math.max(17,w*.18)),x=left+w/2-dw/2;
  rec(g,x-4,bottom-38,dw+8,41,p.outline,.9,3);
  rec(g,x,bottom-36,dw,36,p.door,1,shape==='arch'?9:2);
  rec(g,x+3,bottom-33,Math.max(4,dw-6),Math.min(22,dw),identity.accent,.21,2);
  ln(g,x+dw-5,bottom-19,x+dw-5,bottom-16,identity.glow,1,2);
  ln(g,x-5,bottom+1,x+dw+5,bottom+1,identity.accent,.8,2);
}
function billboard(g,p,identity,site,l,t,w,h,kind='panel'){
  const inset=4;
  rec(g,l,t,w,h,p.outline,.99,kind==='rounded'?5:2);
  rec(g,l+inset,t+inset,w-2*inset,h-2*inset,blend(p.door,identity.accent,p.night?.20:.09),1,2);
  rec(g,l+inset,t+inset,Math.min(8,w*.10),h-2*inset,identity.accent,.92,1);
  ln(g,l+inset+10,t+7,l+w-8,t+7,identity.secondary,.62,2);
  // Add a tiny screen symbol only when source content exists, not a fake advertising claim.
  if(site.description){
    rec(g,l+w-25,t+11,15,15,identity.secondary,.35,2);
    ln(g,l+w-23,t+22,l+w-16,t+15,identity.glow,.7,2);
  }
}
/** Distinct 2.5D facades from category/domain. Roof shape, windows, canopy, signage. */
function architecture(g,p,id,plan,site,left,top,w,bottom,depth,side){
  const form=plan.archetype, rise=Math.max(0,Math.round(plan.floors*4));
  const roofY=top-depth;
  const A=id.accent,B=id.secondary,C=id.tertiary,glass=p.window;
  switch(form){
    case 'market':
      rec(g,left+8,top+35,w-16,14,A,.88,3);
      for(let i=0;i<Math.max(3,Math.ceil(w/20));i++){
        const sw=(w-18)/Math.max(3,Math.ceil(w/20));
        rec(g,left+9+i*sw,top+44,sw,10,i%2===0?A:0xf7ebdb,.92,1);
      }
      for(const pos of [0.12,0.68]){
        rec(g,left+w*pos,top+61,w*.22,Math.max(12,Math.min(37,bottom-top-102)),glass,.49,3);
        rec(g,left+w*pos+3,top+65,w*.18,5,B,.67,1);
      }
      rec(g,left+w*.67,roofY-8,w*.25,9,B,.85,3);
      break;
    case 'broadcast':case 'studio':
      billboard(g,p,id,site,left+12,top+36,w-24,Math.max(26,Math.min(51,bottom-top-79)));
      rec(g,left+18,top+98,w-36,3,B,.6);
      ln(g,left+w*.74,roofY,left+w*.74,roofY-34,A,.92,3);
      circle(g,left+w*.74,roofY-36,6,B,.8);
      break;
    case 'arcade':
      for(let i=0;i<3;i++){
        const x=left+11+i*(w-22)/3;
        rec(g,x,top+38,(w-38)/3,Math.max(26,Math.min(55,bottom-top-75)),p.door,1,4);
        rec(g,x+4,top+44,Math.max(8,(w-38)/3-8),25,i===1?B:A,.71,2);
      }
      rec(g,left+w*.7,roofY-16,Math.min(23,w*.2),17,C,.92,4);
      break;
    case 'concert':
      rec(g,left+10,top+41,w-20,Math.max(23,Math.min(52,bottom-top-81)),p.outline,.85,4);
      for(let i=0;i<7;i++){
        const hh=7+(domainHash(`${site.domain}:${i}`)%23);
        rec(g,left+22+i*(w-43)/7,top+77-hh,Math.max(4,(w-57)/10),hh,i%2?A:B,.86,1);
      }
      break;
    case 'library':case 'archive':
      rec(g,left+15,top+38,w-30,Math.min(43,bottom-top-72),p.door,.95,2);
      for(let r=0;r<3;r++){
        rec(g,left+23,top+46+r*12,Math.max(20,w-59-(r*13)),4,r===0?A:p.windowOff,.88,1);
        rec(g,left+w-31,top+44+r*12,6,9,B,.69,1);
      }
      if(form==='archive'){
        for(let x=left+13;x<left+w-9;x+=(w-25)/4)rec(g,x,top+86,Math.max(6,w*.12),19,glass,.26,2);
      }
      break;
    case 'commons':case 'campus':
      for(let i=0;i<4;i++){
        const x=left+14+i*(w-34)/4;
        rec(g,x,top+44,Math.max(8,(w-44)/5),31,A,i===1?.70:.36,8);
        rec(g,x+3,top+59,Math.max(4,(w-44)/5-6),5,glass,.38,2);
      }
      break;
    case 'tech':case 'finance':case 'glass':
      rec(g,left+10,top+36,w-20,Math.max(24,bottom-top-74),p.door,.72,2);
      windows(g,id,p,left,top,w,bottom,Math.max(3,Math.floor(w/24)),3);
      for(let i=0;i<3;i++)ln(g,left+12,top+47+i*13,left+w-12,top+47+i*13,A,.31,2);
      ln(g,left+w*.78,roofY,left+w*.78,roofY-23,B,.8,2);
      break;
    case 'terminal':
      rec(g,left+8,top+37,w-16,9,B,.8,3);
      windows(g,id,p,left,top,w,bottom,3,1);
      for(let i=0;i<4;i++)rec(g,left+12+i*(w-24)/4,top+67,Math.max(12,(w-24)/4-6),6,A,.45,3);
      break;
    case 'kiosk':case 'pod':
      rec(g,left+5,top+32,w-10,8,B,.88,3);
      rec(g,left+14,top+46,w-28,Math.min(38,bottom-top-79),A,.42,8);
      ellipse(g,left+w/2,roofY-8,w*.66,16,A,.56);
      break;
    case 'loft':case 'terrace':
      for(let i=0;i<Math.min(4,plan.floors);i++){
        const y=top+38+i*21;
        if(y>bottom-35)break;
        rec(g,left+9,y,w-18,5,i%2?B:A,.58,2);
        rec(g,left+20,y+6,w-40,12,glass,.28,2);
      }
      break;
    case 'spire':case 'tower':
      windows(g,id,p,left,top,w,bottom,Math.max(2,Math.floor(w/29)),Math.min(4,plan.floors));
      rec(g,left+w*.34,roofY-12,w*.33,12,blend(p.roof,A,.45),1,2);
      ln(g,left+w*.5,roofY-12,left+w*.5,roofY-38,A,.9,3);
      circle(g,left+w*.5,roofY-38,4,B,.95);
      break;
    case 'stack':
      for(let i=0;i<3;i++){
        const xx=left+10+(i%2)*9,yy=top+40+i*23;
        if(yy>bottom-35)break;
        rec(g,xx,yy,w-38,16,i%2?B:A,.40,2);
        rec(g,xx+6,yy+4,w-51,4,glass,.38,1);
      }
      break;
    default:
      windows(g,id,p,left,top,w,bottom,2+((plan.seed>>>5)%3),2);
      rec(g,left+18,roofY-7,w*.25,7,B,.75,1);
  }
  if(plan.level===3 || (site.description && w>100)){
    // Rich-content screen: titles/subtitles from *actual available data* only.
    rec(g,left+8,top-11,w-16,7,A,.84,2);
    rec(g,left+18,top-17,Math.max(13,w*.25),5,B,.73,1);
  }
  // Roof silhouettes differ even among unknown domain types.
  if(plan.roofStyle===1){rec(g,left+16,roofY-9,w*.24,8,p.side,.94,2);}
  if(plan.roofStyle===2){ln(g,left+Math.min(31,w*.24),roofY,left+Math.min(31,w*.24),roofY-18,B,.84,2);}
  if(plan.roofStyle===3){rec(g,left+w*.68,roofY-12,Math.max(13,w*.14),11,A,.57,3);}
  if(plan.roofStyle===4){rec(g,left+w*.16,roofY-8,w*.35,5,B,.79,2);}
  door(g,p,id,left,bottom,w,form==='archive'?'arch':'normal');
}
/** Extra 2.5D rooftop massing changes the silhouette of the block itself. */
function silhouette(g,p,id,plan,left,top,w,depth,side){
  const A=id.accent,B=id.secondary,C=id.tertiary;
  const roofTop=top-depth;
  switch(plan.archetype){
    case 'market':
      poly(g,blend(p.roof,A,.48),[[left-6,top+31],[left+w+5,top+31],
        [left+w+11,top+38],[left-12,top+38]]);
      rec(g,left+13,roofTop-5,Math.max(15,w*.26),6,B,.92,2);
      break;
    case 'library':case 'archive':
      poly(g,blend(p.roof,A,.38),[[left+5,roofTop],[left+w/2,roofTop-22],
        [left+w-5,roofTop],[left+w*.74,roofTop+3],[left+w*.26,roofTop+3]]);
      ln(g,left+w/2,roofTop-22,left+w/2,roofTop-8,B,.55,2);
      break;
    case 'broadcast':case 'studio':
      // Large rooftop digital screen for sites with editorial/video metadata.
      rec(g,left+w*.15,roofTop-29,w*.7,24,p.outline,.95,3);
      rec(g,left+w*.15+3,roofTop-26,w*.7-6,18,blend(p.door,A,.35),.98,1);
      ln(g,left+w*.15+11,roofTop-16,left+w*.15+w*.35,roofTop-16,B,.8,3);
      ln(g,left+w*.25,roofTop,left+w*.25,roofTop-5,p.railing,.72,3);
      ln(g,left+w*.75,roofTop,left+w*.75,roofTop-5,p.railing,.72,3);
      break;
    case 'arcade':
      for(const sx of [left+6,left+w-19]){
        rec(g,sx,roofTop-23,13,25,blend(p.side,C,.47),1,3);
        rec(g,sx+3,roofTop-28,7,7,A,.96,2);
      }
      break;
    case 'concert':
      ellipse(g,left+w/2,roofTop+3,w*.70,25,blend(p.roof,B,.55),1);
      for(let i=0;i<3;i++)rec(g,left+w*.32+i*w*.12,roofTop-10,w*.055,9,i%2?A:B,.84,2);
      break;
    case 'tech':case 'glass':case 'spire':
      rec(g,left+w*.59,roofTop-21,w*.22,21,blend(p.roof,B,.35),1,2);
      ln(g,left+w*.68,roofTop-21,left+w*.68,roofTop-32,A,.9,3);
      circle(g,left+w*.68,roofTop-35,4,B,.93);
      break;
    case 'commons':case 'campus':
      for(let i=0;i<3;i++){
        const x=left+9+i*(w-18)/3;
        rec(g,x,roofTop-12,(w-30)/4,12,blend(p.roof,B,.4),1,3);
      }
      break;
    case 'finance':
      for(let i=0;i<3;i++){
        const x=left+w*.17+i*w*.21;
        rec(g,x,roofTop-8,w*.12,8,blend(p.roof,A,.65),.98,1);
      }
      break;
    case 'kiosk':case 'pod':
      ellipse(g,left+w/2,roofTop+4,w*.72,20,blend(p.roof,B,.50),.95);
      break;
    case 'loft':case 'terrace':
      rec(g,left+9,roofTop-12,w*.4,10,blend(p.roof,A,.33),.95,2);
      rec(g,left+w*.55,roofTop-8,w*.27,8,blend(p.roof,B,.45),.95,2);
      break;
    case 'tower':case 'stack':
      rec(g,left+w*.18,roofTop-9,w*.60,9,blend(p.roof,A,.3),.92,2);
      rec(g,left+w*.33,roofTop-15,w*.33,6,B,.74,1);
      break;
    default:
      rec(g,left+w*.2,roofTop-7,w*.22,6,blend(p.roof,B,.47),.74,2);
  }
}

export function drawBuilding(scene,site,plan,theme,options={}){
  const p=THEMES[theme],id=visualIdentity(site||{}),b=plan.solid,g=scene.add.graphics();
  if(plan.home){id.accent=p.neon;id.secondary=p.neonAlt;id.glow=p.light;id.tertiary=p.neon;}
  const A=id.accent,B=id.secondary;
  const left=b.x+2,bottom=b.y+b.h,w=b.w-15;
  if(options.lite && !plan.home){
    // LOD distante: um único vetor e uma única etiqueta; nada de dezenas de janelas.
    const t=Math.min(134,63+plan.floors*15),top=bottom-t;
    ellipse(g,left+w*.53,bottom+1,w+8,15,p.shadow,p.night?.22:.12);
    poly(g,blend(p.side,id.secondary,.12),[[left+w,top],[left+w+11,top-17],[left+w+11,bottom],[left+w,bottom]]);
    rec(g,left,top,w,t,blend(p.face,id.accent,.24),1,3);
    poly(g,blend(p.roof,id.accent,.29),[[left,top],[left+w,top],[left+w+11,top-17],[left+11,top-17]]);
    rec(g,left+7,top+15,w-14,12,p.door,.87,3);
    rec(g,left+7,top+15,5,12,id.accent,.95,1);
    const tag=txt(scene,short(site?.domain||'',Math.max(8,Math.floor(w/9))),left+w/2,top+21,{fontSize:'9px',color:'#ffffff'});
    return {container:scene.add.container(0,0,[g,tag]),favicon:null,bounds:b,visual:id};
  }
  const frontH=Math.min(153,66+plan.floors*16+plan.level*5);
  const top=bottom-frontH;
  const depth= Math.max(10,Math.min(46,13+plan.floors*8));
  const side=8+((plan.seed>>>11)%13);
  const face=blend(p.face,A,p.night?.28:.18);
  const sideColor=blend(p.side,B,p.night?.16:.10);
  const roof=blend(p.roof,A,p.night?.38:.15);
  ellipse(g,left+w/2+9,bottom+2,w+25,20,p.shadow,p.night?.42:.20);
  rec(g,left-10,bottom-3,w+side+12,7,p.outline,.77,3);
  poly(g,sideColor,[[left+w,top],[left+w+side,top-depth],[left+w+side,bottom-4],[left+w,bottom]]);
  rec(g,left,top,w,frontH,face,1,2);
  poly(g,roof,[[left-3,top],[left+w+2,top],[left+w+side+2,top-depth],[left+side-4,top-depth]]);
  ln(g,left+3,top,left+w-2,top,A,.90,3);
  ln(g,left+w,top,left+w,bottom,p.outline,.46,2);
  ln(g,left+w+side,top-depth,left+w+side,bottom-4,B,.70,2);
  silhouette(g,p,id,plan,left,top,w,depth,side);
  // Colorful illuminated panels transform architecture; not claims about the brand.
  rec(g,left+4,top+32,5,Math.max(13,frontH-65),A,.68,1);
  rec(g,left+w-7,top+34,3,Math.max(12,frontH-70),B,.62,1);
  architecture(g,p,id,plan,site||{},left,top,w,bottom,depth,side);
  // Logotipo como elemento CENTRAL da fachada: quadro iluminado + monograma de
  // fallback. Quando existe favicon/logo real, a imagem o substitui no mesmo local.
  let logoBox=null;
  if(!plan.home){
    const size=Math.max(29,Math.min(49,Math.round(w*.31)));
    const lx=left+Math.max(22,w*.25),ly=Math.min(bottom-43,top+69);
    rec(g,lx-size/2-4,ly-size/2-4,size+8,size+8,p.outline,.95,7);
    rec(g,lx-size/2,ly-size/2,size,size,blend(p.door,id.accent,.16),1,5);
    g.lineStyle(2,id.accent,.9).strokeRoundedRect(lx-size/2-2,ly-size/2-2,size+4,size+4,6);
    logoBox={x:lx,y:ly,size};
  }
  // Physical sign and screen use only known title/domain/description.
  const content=billboardContent(site||{domain:'worldnet.local',title:'WORLDNET'});
  const signTop=top+8, signH=26;
  rec(g,left+9,signTop,w-18,signH,p.door,.94,4);
  rec(g,left+10,signTop,4,signH,A,.98,1);
  rec(g,left+w-17,signTop,3,signH,B,.81,1);
  g.lineStyle(1,A,.71).strokeRoundedRect(left+9,signTop,w-18,signH,4);
  const els=[g];
  const textColor=theme==='dark'?'#F6FAFF':'#F8FBFF';
  els.push(txt(scene,plan.home?'WORLDNET':short(content.title,w<110?11:w<175?17:23),left+w/2+3,signTop+13,{fontSize:w<118?'10px':'13px',fontStyle:'bold',color:textColor}));
  if(logoBox){
    const letters=({channel:'CH',video:'▶',article:'AR',page:'PG'})[site?.kind]||String(site?.domain||'').replace(/^www\./,'').split('.')[0].replace(/[^a-z0-9]/gi,'').slice(0,2).toUpperCase();
    els.push(txt(scene,letters||'?',logoBox.x,logoBox.y,{fontSize:logoBox.size>40?'19px':'14px',fontStyle:'bold',color:'#F9FCFF'}));
  }
  if(plan.home){
    els.push(txt(scene,'PESQUISAR  [ E ]',left+w/2,bottom+9,{fontSize:'11px',color:p.text,
      backgroundColor:p.night?'#162338':'#e2ebf6',padding:{x:8,y:4}}));
  }else{
    const type= id.category==='Site'?short(site.domain,29):id.category.toUpperCase();
    els.push(txt(scene,type,left+w/2,bottom+8,{fontSize:'9px',fontStyle:'bold',color:p.muted,letterSpacing:1}));
    // Small physical e-ink information banner, only for sites with verified text metadata.
    if(site.description && w>=115 && frontH>=109){
      const desc=short(content.subtitle,w<160?20:34);
      const panelY=Math.min(bottom-43,top+97);
      rec(g,left+14,panelY,w-28,21,p.door,.88,3);
      rec(g,left+14,panelY,4,21,B,.94,1);
      els.push(txt(scene,desc,left+w/2+3,panelY+11,{fontSize:'8px',color:'#E5F7FF'}));
    }
    // Honest source quality badges. Visual tier != real brand authenticity.
    if(plan.level===3){
      els.push(txt(scene,'DADOS 3',left+w-24,top-12,{fontSize:'8px',color:'#FFF',
        backgroundColor:'#234658',padding:{x:4,y:2}}));
    }
  }
  const container=scene.add.container(0,0,els);
  container.setDepth(bottom+4);
  return {container,favicon:logoBox,bounds:b,visual:id};
}
