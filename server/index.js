import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ResourceStore} from './store.js';
import {createProviders} from './providers.js';
import {SearchService} from './search.js';

export function createApp({store,providers,timeoutMs=5000,staticRoot=null,fetchImpl=fetch}={}) {
  const service=new SearchService(store,providers,{timeoutMs,fetchImpl});
  const clients=new Map();
  const server=createServer(async(req,res)=>{
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    try {
      const url=new URL(req.url,'http://worldnet.local');
      if(req.method!=='GET')return send(405,{error:'Método não permitido'});
      if(url.pathname==='/api/health')return send(200,{ok:true,resources:store.count(),providers:providers.map(p=>p.name)});
      if(url.pathname==='/api/resources'){
        const offset=Number(url.searchParams.get('offset')||0);
        if(!Number.isSafeInteger(offset)||offset<0)return send(400,{error:'Página inválida'});
        return send(200,{resources:store.list(200,offset),total:store.count()});
      }
      if(url.pathname==='/api/search'){
        const q=url.searchParams.get('q')?.trim();
        if(!q||q.length>200)return send(400,{error:'Informe de 1 a 200 caracteres'});
        const now=Date.now(),ip=req.socket.remoteAddress;
        for(const [key,value] of clients)if(now-value.start>60_000)clients.delete(key);
        const client=clients.get(ip)||{start:now,count:0};client.count++;clients.set(ip,client);
        if(client.count>30)return send(429,{error:'Aguarde um minuto antes de pesquisar novamente'});
        if(service.pending.size>=4&&!service.pending.has(q.toLocaleLowerCase('pt-BR')))return send(503,{error:'Busca ocupada. Tente novamente em instantes'});
        if(store.count()>=20_000)return send(503,{error:'O índice atingiu o limite deste piloto'});
        return send(200,await service.search(q));
      }
      if(url.pathname.startsWith('/api/'))return send(404,{error:'Rota não encontrada'});
      if(staticRoot){
        const root=resolve(staticRoot),file=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
        if(!file.startsWith(root+sep))return send(403,{error:'Caminho inválido'});
        try{
          const data=await readFile(file),type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'}[extname(file)]||'application/octet-stream';
          res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});return res.end(data);
        }catch{return send(404,{error:'Arquivo não encontrado. Execute npm run build'});}
      }
      send(404,{error:'Rota não encontrada'});
    }catch(error){
      const invalid=/Informe|endereço/.test(error.message);
      send(invalid?400:500,{error:invalid?error.message:'Não foi possível completar a busca'});
    }
  });
  return server;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const store=new ResourceStore(process.env.WORLDNET_DB||resolve('data/worldnet.sqlite'));
  const server=createApp({store,providers:createProviders({searxngUrl:process.env.SEARXNG_URL}),staticRoot:process.argv.includes('--static')?resolve('dist'):null});
  const port=Number(process.env.API_PORT||8787),host=process.env.API_HOST||'127.0.0.1';
  server.listen(port,host,()=>console.log(`Worldnet Search ativo na porta ${port}; ${store.count()} recursos persistidos.`));
  const shutdown=()=>{server.close(()=>{store.close();process.exit(0);});server.closeIdleConnections();};
  process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
