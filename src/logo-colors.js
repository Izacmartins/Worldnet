/** Extrai uma cor REPRESENTATIVA de pixels realmente legíveis pelo navegador.
 * A cor só pode ser anunciada como retirada da logo quando a imagem passou no CORS.
 * Este arquivo não usa API comercial, proxy, nem conhecimento pré-gravado de marcas.
 */
export function dominantLogoColor(pixels,width,height) {
  if(!pixels || width<1 || height<1) return null;
  const groups=new Map();let included=0;
  const stride=Math.max(1,Math.ceil((width*height)/2500));
  for(let n=0;n<width*height;n+=stride){
    const i=n*4;
    const a=pixels[i+3],r=pixels[i],g=pixels[i+1],b=pixels[i+2];
    if(a<180) continue;
    const max=Math.max(r,g,b),min=Math.min(r,g,b);
    if(max-min<45 || max<55 || (r>237&&g>237&&b>237))continue;
    // Agrupar cores parecidas; evita escolher um pixel acidental ou antialias.
    const kr=Math.floor(r/32),kg=Math.floor(g/32),kb=Math.floor(b/32);
    const key=`${kr}:${kg}:${kb}`;
    const old=groups.get(key)||{count:0,r:0,g:0,b:0,contrast:0};
    old.count++;old.r+=r;old.g+=g;old.b+=b;old.contrast+=max-min;
    groups.set(key,old); included++;
  }
  if(included<3) return null;
  let best=null,bestScore=-1;
  for(const data of groups.values()){
    const score=data.count*(.75+data.contrast/data.count/255);
    if(score>bestScore){best=data;bestScore=score;}
  }
  if(!best)return null;
  return '#'+[best.r,best.g,best.b]
    .map(sum=>Math.round(sum/best.count).toString(16).padStart(2,'0')).join('').toUpperCase();
}
export function sampleLogoColor(url,timeoutMs=2300) {
  return new Promise(resolve=>{
    if(typeof Image==='undefined'||typeof document==='undefined'||!/^https:\/\//i.test(url||''))return resolve(null);
    const img=new Image();img.crossOrigin='anonymous';img.referrerPolicy='no-referrer';
    let completed=false;
    const end=color=>{if(completed)return;completed=true;clearTimeout(timer);img.onload=null;img.onerror=null;resolve(color);};
    const timer=setTimeout(()=>end(null),timeoutMs);
    img.onerror=()=>end(null);
    img.onload=()=>{
      try{
        const canvas=document.createElement('canvas');canvas.width=40;canvas.height=40;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        if(!ctx)return end(null);
        ctx.drawImage(img,0,0,40,40);
        const data=ctx.getImageData(0,0,40,40);
        end(dominantLogoColor(data.data,40,40));
      }catch{end(null);} // Segurança CORS: nunca burlar o navegador.
    };
    img.src=url;
  });
}
