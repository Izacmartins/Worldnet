/** Physical open tabs and public information structures. All geometric, no media in render loop. */
import {THEMES,blend,colorInt,CHUNK_W,CHUNK_H} from './city-art.js';
import {hashPlot} from './layout.js';
import {visualIdentity} from './identity.js';
const KINDS=['news','images','videos','audio','articles','shop','social'];
export const LABELS={news:'NOTÍCIAS',images:'GALERIA',videos:'VÍDEOS',audio:'MÚSICA',articles:'LEITURAS',shop:'VITRINE',social:'SOCIAL',about:'INFO'};
export function kioskKindForSite(site){
  const category=String(site?.category||'').toLowerCase();
  if(/notíc|notic|jornal|portal/.test(category))return 'news';
  if(/blog|wiki|educa|conhec/.test(category))return 'articles';
  if(/vídeo|video|mídia|midia|jogo/.test(category))return 'videos';
  if(/músic|music|áudio/.test(category))return 'audio';
  if(/loja|comércio|shop/.test(category))return 'shop';
  if(/fórum|forum|comunidade|social/.test(category))return 'social';
  if(/arte|foto|imagem/.test(category))return 'images';
  return KINDS[hashPlot(site?.domain||'worldnet')%KINDS.length];
}
export function plazaKind(cx,cy){return KINDS[hashPlot(`media-kiosk:${cx}:${cy}`)%KINDS.length];}
/**
 * Small, low-poly installation. Billboard contains label only; media never loads
 * in Phaser. Player approaches the structure and uses F/click to open overlay.
 */

export function drawKiosk(scene,theme,kind,opts={}){
  const p=THEMES[theme];
  const colors={news:'#ffa467',images:'#ba8fff',videos:'#73dbff',audio:'#ff7eb4',articles:'#85e6bc',shop:'#ffdb70',social:'#8badff',about:'#94b8c9'};
  const color=colorInt(colors[kind]||'#87d1df');
  const alt=colorInt(theme==='dark' ? '#f6fbff' : '#f8fbff');
  const g=scene.add.graphics();
  const w=opts.compact?58:78;
  const h=opts.compact?36:48;
  // shadow + slim support, as if the tab is mounted on a pole or wall
  g.fillStyle(p.shadow,p.night?.24:.14); g.fillEllipse(0,5,w+14,12);
  if(!opts.wall){
    g.fillStyle(p.railing,.9); g.fillRoundedRect(-4,4,8,12,2);
    g.fillStyle(blend(p.side,color,.26),.95); g.fillRoundedRect(-7,15,14,6,2);
  }
  // browser-like window
  g.fillStyle(p.outline,.95); g.fillRoundedRect(-w/2,-h/2,w,h,6);
  g.fillStyle(theme==='dark'?0x11203a:0xeaf0f8,1); g.fillRoundedRect(-w/2+2,-h/2+2,w-4,h-4,5);
  g.fillStyle(color,.98); g.fillRoundedRect(-w/2+2,-h/2+2,w-4,10,5);
  // top tabs and close dots
  for(const [i,c] of [[0,color],[1,blend(color,0xffffff,.45)],[2,blend(color,0x000000,.18)]]){
    g.fillStyle(c,.95); g.fillCircle(-w/2+10+i*8,-h/2+7,2);
  }
  g.fillStyle(alt,.72); g.fillRoundedRect(-w/2+28,-h/2+4,w-40,5,2);
  // mini thumbnail panel
  g.fillStyle(blend(p.door,color,.25),.96); g.fillRoundedRect(-w/2+7,-h/2+16,w*.33,h*.38,3);
  g.lineStyle(1,color,.82).strokeRoundedRect(-w/2+7,-h/2+16,w*.33,h*.38,3);
  g.fillStyle(color,.22); g.fillRoundedRect(-w/2+10,-h/2+19,w*.27,5,2);
  // content preview lines
  const lineX=-w/2+31, lineW=w-39;
  g.fillStyle(blend(color,0xffffff,.4),.55); g.fillRoundedRect(lineX,-h/2+18,lineW,4,2);
  g.fillStyle(blend(p.roadLine,color,.2),.5); g.fillRoundedRect(lineX,-h/2+26,lineW-6,3,2);
  g.fillRoundedRect(lineX,-h/2+32,lineW-12,3,2);
  if(!opts.compact){
    g.fillStyle(color,.18); g.fillRoundedRect(-w/2+7,h/2-11,w-14,6,3);
    g.fillStyle(color,.85); g.fillRoundedRect(-w/2+7,h/2-11,Math.max(16,w*.28),6,3);
  }
  const heading=scene.add.text(0,-h/2-8,LABELS[kind]||'INFO',{
    fontFamily:'Arial,sans-serif',fontSize:opts.compact?'6px':'8px',fontStyle:'bold',
    color:theme==='dark'?'#f5fbff':'#1d3650',align:'center',resolution:1
  }).setOrigin(.5);
  heading.setAlpha(opts.compact?.92:1);
  return scene.add.container(0,0,[g,heading]);
}


export function installationPositions(cx,cy,site,isHome,lite){
  if(lite) return [];
  if(isHome){
    return [
      {kind:'news',x:62,y:224,range:68},
      {kind:'images',x:134,y:145,range:66,wall:true},
      {kind:'videos',x:235,y:224,range:68},
      {kind:'articles',x:265,y:90,range:66,wall:true}
    ];
  }
  if(site){
    // A content entity displays its own sourced record, not unrelated media.
    if(site.id)return [{kind:'about',x:160,y:204,range:64,site}];
    const primary=kioskKindForSite(site);
    const altA=primary==='news'?'articles':'news';
    const altB=primary==='videos'?'images':'videos';
    return [
      {kind:primary,x:262,y:102,range:62,site,wall:true},
      {kind:'about',x:72,y:194,range:58,site},
      {kind:altB,x:236,y:195,range:58,site},
      {kind:altA,x:136,y:150,range:56,site,wall:true}
    ];
  }
  const kind=plazaKind(cx,cy);
  const second=KINDS[(KINDS.indexOf(kind)+3)%KINDS.length];
  return [
    {kind,x:98,y:150,range:70},
    {kind:second,x:218,y:96,range:66,wall:true},
    {kind:'about',x:226,y:176,range:58}
  ];
}

export function kioskWithin(x,y,kiosk,worldX,worldY){
  return Math.hypot(x-(worldX+kiosk.x),y-(worldY+kiosk.y))<=kiosk.range;
}
