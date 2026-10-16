import {resourceFromUrl} from '../shared/resources.js';
import {youtubeMetadata} from './providers.js';

export class SearchService {
  constructor(store,providers,{timeoutMs=5000,fetchImpl=fetch}={}) {
    this.store=store;this.providers=providers;this.timeoutMs=timeoutMs;this.fetchImpl=fetchImpl;this.pending=new Map();
  }
  register(resource){
    if(resource.kind!=='site'&&!this.store.get(`site:${resource.domain}`)) {
      this.store.upsert(resourceFromUrl(`https://${resource.domain}/`));
    }
    return this.store.upsert(resource);
  }
  async search(input) {
    const query=String(input||'').trim().replace(/\s+/g,' ').slice(0,200);
    if(!query)throw new Error('Informe uma pesquisa');
    const key=query.toLocaleLowerCase('pt-BR');
    if(this.pending.has(key))return this.pending.get(key);
    const task=this.run(query,key).finally(()=>this.pending.delete(key));
    this.pending.set(key,task);return task;
  }
  async run(query,key) {
    const direct=/^https?:\/\//i.test(query)?resourceFromUrl(query):null;
    if(/^https?:\/\//i.test(query)&&!direct)throw new Error('Use um endereço HTTP(S) público sem credenciais ou porta');
    if(direct){
      const errors=[];let resource=direct;
      if(direct.kind==='video'&&direct.domain==='youtube.com'){
        try{
          const enriched=await youtubeMetadata(direct,{fetchImpl:this.fetchImpl,signal:AbortSignal.timeout(this.timeoutMs)});
          if(enriched.parent)this.register(enriched.parent);
          resource=enriched.resource;
        }catch{errors.push({source:'YouTube oEmbed',message:'Metadados indisponíveis; endereço registrado sem confirmar título ou autor.'});}
      }
      return {query,results:[this.register(resource)],sources:[{name:'Endereço informado',status:'ok'}],errors,cached:false,stale:false};
    }
    const cached=this.store.cached(key);
    if(cached&&!cached.stale)return this.response(query,cached,true);
    const settled=await Promise.allSettled(this.providers.map(p=>p.search(query,AbortSignal.timeout(this.timeoutMs))));
    const resources=new Map(),sources=[],errors=[];
    for(let i=0;i<settled.length;i++){
      const result=settled[i],name=this.providers[i].name;
      sources.push({name,status:result.status==='fulfilled'?'ok':'unavailable'});
      if(result.status==='fulfilled') {
        for(const item of result.value)if(!resources.has(item.id))resources.set(item.id,this.register(item));
      } else errors.push({source:name,message:'Fonte indisponível ou consulta recusada.'});
    }
    const data={ids:[...resources.keys()],sources,errors};
    // Do not cache a total failure for an hour; local results remain searchable.
    if(sources.some(s=>s.status==='ok'))this.store.cache(key,data);
    if(!resources.size&&cached){return this.response(query,{...cached,sources,errors,stale:true},true);}
    return this.response(query,data,false);
  }
  response(query,data,cached){
    const merged=new Map();
    for(const item of this.store.search(query))merged.set(item.id,item);
    for(const id of data.ids){const resource=this.store.get(id);if(resource)merged.set(id,resource);}
    return {query,results:[...merged.values()].slice(0,40),sources:data.sources,errors:data.errors,cached,stale:Boolean(data.stale)};
  }
}
