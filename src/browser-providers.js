import {publicUrl,resourceFromUrl} from '../shared/resources.js';

export const plain=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/&(?:amp|quot|lt|gt|#39);/g,s=>({'&amp;':'&','&quot;':'"','&lt;':'<','&gt;':'>','&#39;':"'"}[s])).replace(/\s+/g,' ').trim();
const record=(url,metadata,extra={})=>{
  const item=resourceFromUrl(url,metadata);return item?{...item,...extra,origin:'remote',sourceUrl:url}:null;
};
export const BROWSER_PROVIDERS=[
  {id:'github',name:'GitHub',types:['repository'],
    url(q){const u=new URL('https://api.github.com/search/repositories');u.search=new URLSearchParams({q:q.slice(0,180),per_page:'8'});return u;},
    parse(data){return (data.items||[]).filter(x=>!x.private).map(x=>record(x.html_url,{title:x.full_name,description:plain(x.description),source:'GitHub · API pública',thumbnail:x.owner?.avatar_url},
      {kind:'repository',category:'Tecnologia',tags:(x.topics||[]).join(' '),stats:[x.language,Number.isFinite(x.stargazers_count)?`${x.stargazers_count.toLocaleString('pt-BR')} estrelas`:null].filter(Boolean).join(' · ')})).filter(Boolean);}
  },
  {id:'books',name:'Open Library',types:['book'],
    url(q){const u=new URL('https://openlibrary.org/search.json');u.search=new URLSearchParams({q,limit:'8',fields:'key,title,author_name,cover_i,first_publish_year'});return u;},
    parse(data){return (data.docs||[]).filter(x=>/^\/works\/OL\d+W$/.test(x.key)).map(x=>record('https://openlibrary.org'+x.key,
      {title:x.title,description:[(x.author_name||[]).join(', '),x.first_publish_year].filter(Boolean).join(' · '),source:'Open Library · catálogo público',thumbnail:Number.isSafeInteger(x.cover_i)?`https://covers.openlibrary.org/b/id/${x.cover_i}-M.jpg`:null},
      {kind:'book',category:'Educação',mediaLabel:'Capa do livro · Open Library'})).filter(Boolean);}
  },
  {id:'commons',name:'Wikimedia Commons',types:['image'],
    url(q){const u=new URL('https://commons.wikimedia.org/w/api.php');u.search=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:q,gsrnamespace:'6',gsrlimit:'6',prop:'imageinfo',iiprop:'url|extmetadata|mime',iiurlwidth:'480',origin:'*'});return u;},
    parse(data){if(data.error)throw new Error('Fonte recusou a pesquisa');return Object.values(data.query?.pages||{}).sort((a,b)=>a.index-b.index).map(x=>{
      const image=x.imageinfo?.[0],meta=image?.extmetadata||{};
      if(!image?.thumburl||!image.descriptionurl||!/^image\//.test(image.mime||'image/'))return null;
      return record(image.descriptionurl,{title:plain(x.title.replace(/^File:/,'')),description:plain(meta.ImageDescription?.value).slice(0,1000),thumbnail:image.thumburl,source:'Wikimedia Commons · arquivo público'},
        {kind:'image',category:'Mídia',credit:plain(meta.Artist?.value).slice(0,240),license:plain(meta.LicenseShortName?.value),licenseUrl:publicUrl(meta.LicenseUrl?.value)?.href||null,mediaLabel:'Imagem · Wikimedia Commons'});
    }).filter(Boolean);}
  },
  {id:'wiki',name:'Wikipédia',types:['article'],
    url(q){const u=new URL('https://pt.wikipedia.org/w/api.php');u.search=new URLSearchParams({action:'query',format:'json',formatversion:'2',list:'search',srsearch:q,srlimit:'6',origin:'*'});return u;},
    parse(data){if(data.error)throw new Error('Fonte recusou a pesquisa');return (data.query?.search||[]).map(x=>record(`https://pt.wikipedia.org/wiki/${encodeURIComponent(x.title.replaceAll(' ','_'))}`,
      {title:x.title,description:plain(x.snippet),source:'Wikipédia · pesquisa pública'}, {kind:'article',category:'Wiki'})).filter(Boolean);}
  }
];

// No cookies, secrets, JSONP, public proxy or attempts to bypass CORS/rate limits.
export async function queryProvider(provider,query,{fetchImpl=fetch,signal}={}){
  const response=await fetchImpl(provider.url(query),{signal,credentials:'omit',referrerPolicy:'no-referrer',headers:{Accept:'application/json'}});
  if(!response.ok){const error=new Error(response.status===429||response.status===403?'Limite ou acesso da fonte. Tente mais tarde.':`Fonte respondeu HTTP ${response.status}`);error.status=response.status;throw error;}
  const raw=await response.text();if(raw.length>2_000_000)throw new Error('Resposta excedeu o limite');
  return provider.parse(JSON.parse(raw)).slice(0,8);
}
