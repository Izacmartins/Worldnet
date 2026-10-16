import {spawnSync} from 'node:child_process';
import {mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';

const image='ghcr.io/searxng/searxng@sha256:d7ac1a4c215ae9ea1e3e46b114aa94e4bc4e37f94e773559682491c9a18a7404';
const name='worldnet-searxng';
function docker(args,{capture=false}={}){
  const result=spawnSync('docker',args,{encoding:'utf8',stdio:capture?'pipe':'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0&&!capture)throw new Error(`Docker falhou (${result.status})`);
  return result;
}
const config=resolve('data/searxng'),cache=resolve('data/searxng-cache');
mkdirSync(config,{recursive:true});mkdirSync(cache,{recursive:true});
const settings=resolve(config,'settings.yml');
if(!existsSync(settings))writeFileSync(settings,`use_default_settings:
  engines:
    keep_only: [duckduckgo, wikipedia]
search:
  formats: [html, json]
  autocomplete: ""
server:
  secret_key: "${randomBytes(32).toString('hex')}"
  limiter: false
  image_proxy: false
outgoing:
  request_timeout: 4.0
  max_request_timeout: 4.0
`,{mode:0o600,flag:'wx'});
const existing=docker(['inspect','--format','{{index .Config.Labels "worldnet.managed"}}',name],{capture:true});
if(existing.status===0){
  if(existing.stdout.trim()!=='true')throw new Error('Já existe um container worldnet-searxng não gerenciado por este script. Preserve-o e escolha outro nome antes de continuar.');
  const mounts=docker(['inspect','--format','{{range .Mounts}}{{println .Source}}{{end}}',name],{capture:true});
  if(!mounts.stdout.split('\n').includes(config))throw new Error('O container existente pertence a outro checkout; não será alterado.');
  docker(['start',name]);
}else{
  docker(['pull',image]);
  const args=['run','-d','--name',name,'--label','worldnet.managed=true',
    '--user',`${process.getuid?.()||1000}:${process.getgid?.()||1000}`,'-e','FORCE_OWNERSHIP=false',
    '-p','127.0.0.1:8888:8080','-v',`${config}:/etc/searxng`,'-v',`${cache}:/var/cache/searxng`];
  const caFile=process.env.WORLDNET_CA_FILE||'/etc/ssl/certs/ca-certificates.crt';
  if(existsSync(caFile))args.push('-v',`${resolve(caFile)}:/etc/ssl/certs/ca-certificates.crt:ro`,
    '-e','SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt','-e','CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt');
  docker([...args,image]);
}
console.log('SearXNG iniciado na porta interna 8888. Configure SEARXNG_URL=http://127.0.0.1:8888 para conectar o Worldnet.');
