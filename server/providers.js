import {resourceFromUrl} from '../shared/resources.js';

function plain(value){return String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}

export async function jsonRequest(url,{fetchImpl=fetch,signal}={}) {
  const response=await fetchImpl(url,{signal,redirect:'error',headers:{Accept:'application/json','User-Agent':'Worldnet/0.1 (public search prototype)'}});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  if(Number(response.headers.get('content-length'))>2_000_000)throw new Error('Resposta muito grande');
  const reader=response.body.getReader();let size=0;const parts=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000)throw new Error('Resposta muito grande');parts.push(value);}}
  finally{await reader.cancel().catch(()=>{});}
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}

export function createProviders({searxngUrl='',fetchImpl=fetch}={}) {
  const providers=[{
    name:'Wikipédia',
    async search(query,signal){
      const url=new URL('https://pt.wikipedia.org/w/api.php');
      url.search=new URLSearchParams({action:'query',format:'json',formatversion:'2',list:'search',srsearch:query,srlimit:'10',utf8:'1',origin:'*'});
      const data=await jsonRequest(url,{fetchImpl,signal});
      if(data.error)throw new Error('Consulta recusada');
      return (data.query?.search||[]).map(item=>resourceFromUrl(`https://pt.wikipedia.org/wiki/${encodeURIComponent(item.title.replaceAll(' ','_'))}`,
        {title:item.title,description:plain(item.snippet),source:'Wikipédia'})).filter(Boolean);
    }
  }];
  if(searxngUrl){
    const base=new URL(searxngUrl);
    if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw new Error('SEARXNG_URL inválida');
    providers.push({
      name:'SearXNG',
      async search(query,signal){
        const url=new URL('search',base.href.endsWith('/')?base.href:base.href+'/');
        url.search=new URLSearchParams({q:query,format:'json',language:'pt-BR',safesearch:'1'});
        const data=await jsonRequest(url,{fetchImpl,signal});
        if(!Array.isArray(data.results))throw new Error('SearXNG não retornou resultados JSON');
        // Do not turn a partial upstream outage into a silently successful empty result.
        if(!data.results.length&&data.unresponsive_engines?.length)throw new Error('Fontes do SearXNG indisponíveis');
        return data.results.slice(0,30).map(item=>resourceFromUrl(item.url,
          {title:plain(item.title),description:plain(item.content),thumbnail:item.thumbnail,source:'SearXNG'})).filter(Boolean);
      }
    });
  }
  return providers;
}

export async function youtubeMetadata(resource,{fetchImpl=fetch,signal}={}) {
  if(resource.kind!=='video'||resource.domain!=='youtube.com')return resource;
  const url=new URL('https://www.youtube.com/oembed');
  url.search=new URLSearchParams({url:resource.url,format:'json'});
  const data=await jsonRequest(url,{fetchImpl,signal});
  const parent=resourceFromUrl(data.author_url,{title:data.author_name,source:'YouTube oEmbed'});
  const enriched=resourceFromUrl(resource.url,{title:data.title,thumbnail:data.thumbnail_url,source:'YouTube oEmbed',parentId:parent?.kind==='channel'?parent.id:undefined});
  return {resource:enriched||resource,parent:parent?.kind==='channel'?parent:null};
}
