// Browser/server contract. URLs identify resources; domains identify their publishers.
export const RESOURCE_LABELS = Object.freeze({site:'Site', channel:'Canal', video:'Vídeo', article:'Artigo', page:'Página', image:'Imagem', repository:'Projeto', book:'Livro'});

export function publicUrl(value) {
  try {
    const u=new URL(value);
    const host=u.hostname.toLowerCase().replace(/\.$/,'');
    if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port)return null;
    if(!host.includes('.')||host.includes(':')||/^\d+(\.\d+){3}$/.test(host)||/(^|\.)(localhost|local|internal|test|invalid)$/.test(host))return null;
    u.hash='';
    for(const key of [...u.searchParams.keys()])if(/^utm_/i.test(key)||['fbclid','gclid'].includes(key))u.searchParams.delete(key);
    return u;
  } catch { return null; }
}

export function resourceFromUrl(value, metadata={}) {
  const u=publicUrl(value);
  if(!u)return null;
  let domain=u.hostname.replace(/^www\./,''), kind='page', id;
  if(['youtube.com','m.youtube.com','youtu.be'].includes(domain)) {
    domain='youtube.com';
    const path=u.pathname.split('/').filter(Boolean);
    const video= u.hostname==='youtu.be'?path[0]:['shorts','live','embed'].includes(path[0])?path[1]:u.searchParams.get('v');
    if(video && /^[\w-]{11}$/.test(video)) {
      kind='video';id=`youtube:video:${video}`;u.href=`https://www.youtube.com/watch?v=${video}`;
    } else if((path[0]==='channel'&&/^UC[\w-]{22}$/.test(path[1]||'')) || /^@[\p{L}\p{N}_.%-]+$/u.test(path[0]||'') || (['c','user'].includes(path[0])&&path[1])) {
      kind='channel';
      const key=path[0].startsWith('@')?path[0]:`${path[0]}/${path[1]}`;
      id=`youtube:channel:${key.startsWith('@')?key.toLowerCase():key}`;
      u.href=`https://www.youtube.com/${key}`;
    }
  }
  if(!id){
    if(u.pathname==='/'&&!u.search)kind='site';
    else if(/(^|\.)wikipedia\.org$/.test(domain)&&u.pathname.startsWith('/wiki/'))kind='article';
    id=kind==='site'?`site:${domain}`:`url:${u.href}`;
  }
  const title=String(metadata.title||'').trim().slice(0,220);
  const thumbnail=publicUrl(metadata.thumbnail)?.href||null;
  return {
    id,kind,domain,url:u.href,title:title||u.href,description:String(metadata.description||'').slice(0,1200),
    thumbnail,source:String(metadata.source||'Endereço informado').slice(0,180),
    metadataStatus:title?'sourced':'url-only',
    identityStatus:kind==='channel'&&!id.includes(':channel/UC')?'url':'canonical',
    parentId:kind==='site'?null:`site:${domain}`,
    ...(metadata.parentId?{parentId:metadata.parentId}:{})
  };
}

export function resourceSite(resource) {
  let displayName=resource.title;
  if(resource.metadataStatus==='url-only'){
    const url=new URL(resource.url);
    let path=url.pathname;try{path=decodeURIComponent(path);}catch{/* Keep the literal address if percent escapes are invalid. */}
    displayName=resource.kind==='channel'?`Canal ${path.replace(/^\//,'')}`:
      resource.kind==='video'?`Vídeo ${url.searchParams.get('v')}`:resource.url;
  }
  return {...resource,displayName, category:resource.category||(['channel','video'].includes(resource.kind)?'Mídia':resource.kind==='repository'?'Tecnologia':resource.kind==='book'?'Educação':resource.kind==='article'?'Wiki':'Site'),
    categoryConfidence:'estimativa',official:false,colorVerified:false,logoVerified:false};
}
