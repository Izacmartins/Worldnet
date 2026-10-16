// Catálogo público de ranking Tranco, atualizado na origem por rotina diária.
// Cada navegador consulta e persiste seus dados no IndexedDB: nenhuma API de busca paga.
const SOURCE = 'https://raw.githubusercontent.com/wangmm001/tranco-top1m-cache/main/data/current.csv.gz';
const DB_NAME = 'worldnet-catalog-v1';
const STORE = 'snapshots';
const KEY = 'tranco-top-20000';
const TTL = 24 * 60 * 60 * 1000;
const LIMIT = 20000;
let memory = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function storedGet() {
  const db = await openDB();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
async function storedPut(value) {
  const db = await openDB();
  try { await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  }); } finally { db.close(); }
}
function parseRankedCsv(csv) {
  const rows = [];
  const seen = new Set();
  for (const line of csv.split(/\r?\n/)) {
    if (rows.length >= LIMIT) break;
    if (!line.trim()) continue;
    const parts = line.split(',');
    let rank, domain;
    if (/^\d+$/.test(parts[0]?.trim())) { rank=Number(parts[0]);domain=parts[1]?.trim(); }
    else if (/^\d+$/.test(parts[1]?.trim())) { rank=Number(parts[1]);domain=parts[0]?.trim(); }
    else continue;
    domain = (domain || '').replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
    if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(domain) || seen.has(domain)) continue;
    seen.add(domain);
    rows.push({rank, domain});
  }
  rows.sort((a,b)=>a.rank-b.rank);
  if(rows.length < 100) throw new Error('O catálogo recebido está incompleto.');
  return rows;
}
async function downloadCatalog() {
  const response = await fetch(SOURCE, {cache:'no-store'});
  if (!response.ok) throw new Error(`Fonte de ranking indisponível (HTTP ${response.status}).`);
  let body = response.body;
  if (!body) throw new Error('Não foi possível ler o catálogo.');
  // O arquivo é .gz; browsers atuais oferecem descompressão nativa.
  if (typeof DecompressionStream === 'undefined') throw new Error('Seu navegador não suporta descompressão gzip. Atualize o navegador.');
  // fetch geralmente entrega bytes gzip nesse endpoint; detectar codificação HTTP automática.
  const raw = new Uint8Array(await response.arrayBuffer());
  let csv;
  if(raw[0] === 0x1f && raw[1] === 0x8b) {
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'));
    csv = await new Response(stream).text();
  } else csv = new TextDecoder().decode(raw);
  return parseRankedCsv(csv);
}

export async function getCatalog(onStatus = () => {}) {
  if (memory && Date.now() - memory.updated < TTL) return memory;
  let cached = null;
  try { cached = await storedGet(); } catch { /* Armazenamento privado/bloqueado */ }
  if (cached?.sites?.length) {
    memory = cached;
    if (Date.now() - cached.updated < TTL) {
      onStatus(`Catálogo local: ${cached.sites.length.toLocaleString('pt-BR')} domínios.`);
      return cached;
    }
  }
  onStatus(cached ? 'Verificando atualização do catálogo…' : 'Baixando o catálogo para o navegador pela primeira vez…');
  try {
    const sites = await downloadCatalog();
    memory = { sites, updated: Date.now(), source: SOURCE };
    try { await storedPut(memory); } catch { onStatus('Sem armazenamento persistente; catálogo carregado apenas na memória.'); }
    return memory;
  } catch (err) {
    if (cached?.sites?.length) {
      onStatus('Sem atualização no momento. Usando o catálogo salvo.');
      return cached;
    }
    throw new Error(`Não foi possível obter o catálogo gratuito. ${err.message} Verifique a internet e tente novamente.`);
  }
}

// Pesquisa local por nome de domínio. Não finge ser busca de conteúdo ou Google.
export function searchCatalog(catalog, query, limit=350) {
  const terms = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const matches=[];
  for (const item of catalog.sites) {
    const domain=item.domain.toLowerCase();
    const label=domain.replace(/^www\./,'').replace(/[.-]/g,' ');
    if (!terms.every(term => label.includes(term))) continue;
    const exact=domain.split('.')[0] === terms.join('');
    const starts=label.startsWith(terms.join(' '));
    matches.push({...item, score:(exact?1e7:0)+(starts?1e6:0)-item.rank});
  }
  matches.sort((a,b)=>b.score-a.score);
  return matches.slice(0,limit).map(item=>({
    title:item.domain, domain:item.domain, url:`https://${item.domain}/`,
    description:`Domínio listado no ranking Tranco, posição ${item.rank}.`,rank:item.rank
  }));
}

export function catalogAgeLabel(catalog) {
  return new Date(catalog.updated).toLocaleString('pt-BR');
}
