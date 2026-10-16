import {sampleLogoColor} from './logo-colors.js';
/*
 * Worldnet Pesquisa Local v0.5
 * O navegador consulta APENAS fontes públicas que permitem CORS, em resposta
 * a uma pesquisa intencional do usuário. Sem proxy, tokens ou extração de
 * páginas arbitrárias. Os resultados e as consultas ficam em IndexedDB.
 */
const DB = 'worldnet-discoveries-v1';
const DB_VERSION = 1;
const MAX_PER_QUERY = 35;
const RESEARCH_TTL = 24 * 60 * 60 * 1000;
const WIKIPEDIA = 'https://pt.wikipedia.org/w/api.php';
const WIKIDATA = 'https://www.wikidata.org/w/api.php';
const cacheMemory = { sites: new Map(), queries: new Map() };

function dbOpen() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB indisponível'));
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('sites')) db.createObjectStore('sites', { keyPath: 'domain' });
      if (!db.objectStoreNames.contains('queries')) db.createObjectStore('queries', { keyPath: 'query' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function readAll(store) {
  const db = await dbOpen();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const request = tx.objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
async function putAll(store, items) {
  if (!items.length) return;
  const db = await dbOpen();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const obj = tx.objectStore(store);
      for (const item of items) obj.put(item);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Falha ao salvar dados'));
    });
  } finally { db.close(); }
}

export async function loadDiscoveries() {
  try {
    const [sites, queries] = await Promise.all([readAll('sites'), readAll('queries')]);
    for (const s of sites) cacheMemory.sites.set(s.domain, s);
    for (const q of queries) cacheMemory.queries.set(q.query, q);
  } catch { /* funciona em memória caso o armazenamento seja bloqueado */ }
  return [...cacheMemory.sites.values()];
}
export function discoveryCount() { return cacheMemory.sites.size; }
export function normalizeQuery(q) {
  return String(q || '').trim().replace(/\s+/g, ' ').slice(0, 90).toLocaleLowerCase('pt-BR');
}
export function normalizeWebsite(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const domain = url.hostname.toLowerCase().replace(/^www\./, '');
    if (domain.length > 130 || !/^[a-z\d][a-z\d.-]*\.[a-z\d-]{2,}$/i.test(domain)) return null;
    if (domain.includes('..') || /(?:^|\.)(?:localhost|local|internal|example|test)$/.test(domain)) return null;
    if (/^(?:\d+\.){3}\d+$/.test(domain)) return null;
    // Recusamos URLs com credenciais ou portas não convencionais.
    if (url.username || url.password || (url.port && url.port !== '443' && url.port !== '80')) return null;
    return { domain, url: `https://${domain}/` };
  } catch { return null; }
}

// Sites de hospedagem de referências, arquivos e identificadores não são
// tratados como destinos principais de uma pesquisa temática.
const EXCLUDED = [
  'web.archive.org', 'archive.org', 'doi.org', 'dx.doi.org', 'books.google.com',
  'google.com', 'googleusercontent.com', 'wikimedia.org', 'wikipedia.org',
  'wikidata.org', 'creativecommons.org', 'webcitation.org', 'worldcat.org',
  'isbnsearch.org', 'viaf.org', 'd-nb.info', 'id.loc.gov'
];
function isExcluded(domain) {
  return EXCLUDED.some(s => domain === s || domain.endsWith('.' + s));
}

export function classifySite(site) {
  const value = [site.domain, site.title, site.description].filter(Boolean).join(' ').toLowerCase();
  const patterns = [
    ['Loja', /(?:^|[.\s-])(?:shop|store|loja|ecommerce|commerce|market|mercado)(?:$|[.\s-])|loja virtual|comércio eletrônico/],
    ['Blog', /(?:^|[.\s-])(?:blog|blogs)(?:$|[.\s-])|diário pessoal/],
    ['Notícias', /(?:^|[.\s-])(?:news|noticias|notícias|jornal|gazeta|press)(?:$|[.\s-])|portal de notícias/],
    ['Wiki', /(?:^|[.\s-])(?:wiki|wikia)(?:$|[.\s-])|enciclopédia/],
    ['Comunidade', /(?:^|[.\s-])(?:forum|fórum|community|comunidade)(?:$|[.\s-])/],
    ['Jogos', /(?:^|[.\s-])(?:game|games|jogos|gaming)(?:$|[.\s-])|jogo eletrônico|video game/],
    ['Educação', /(?:^|[.\s-])(?:edu|university|universidade|escola)(?:$|[.\s-])|educaç/],
    ['Tecnologia', /(?:^|[.\s-])(?:developer|dev|software|code|codigo)(?:$|[.\s-])/]
  ];
  return patterns.find(([, regex]) => regex.test(value))?.[0] || 'Site';
}
export function neutralColor(category) {
  return ({Loja:'#7c92ae', Blog:'#8a83a8', Notícias:'#859baa', Wiki:'#779fa1', Comunidade:'#7a92a5', Jogos:'#827eae', Educação:'#849d92', Tecnologia:'#748ea9'})[category] || '#66869c';
}
function colorClaim(entity) {
  const claims = entity?.claims?.P465 || [];
  for (const claim of claims) {
    const hex = claim?.mainsnak?.datavalue?.value;
    if (typeof hex === 'string' && /^[0-9a-fA-F]{6}$/.test(hex.replace(/^#/, ''))) return '#' + hex.replace(/^#/, '').toUpperCase();
  }
  return null;
}
function officialLinks(entity) {
  const list = entity?.claims?.P856 || [];
  return list.map(claim => claim?.mainsnak?.datavalue?.value).filter(v => typeof v === 'string');
}
// P154: arquivo de logotipo registrado no Wikidata/Commons. Apenas uma
// referência pública real vira imagem; nunca inventamos logos de marcas.
function wikidataLogo(entity) {
  for (const claim of entity?.claims?.P154 || []) {
    const value=claim?.mainsnak?.datavalue?.value;
    if(typeof value!=='string' || value.length>180 || /[<>\r\n]/.test(value) ||
       !/\.(?:svg|png|jpe?g|webp)$/i.test(value)) continue;
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(value)}?width=80`;
  }
  return null;
}
function makeSite(url, attrs) {
  const valid = normalizeWebsite(url);
  if (!valid || isExcluded(valid.domain)) return null;
  const category = classifySite({ ...attrs, ...valid });
  return {
    ...valid,
    title: attrs.title || valid.domain,
    category,
    description: attrs.description || '',
    sourceTitle: attrs.sourceTitle || '',
    evidence: attrs.evidence || 'Link público',
    official: Boolean(attrs.official),
    mentions: Number(attrs.mentions) || 1,
    color: attrs.color || neutralColor(category),
    colorVerified: Boolean(attrs.color),
    logoUrl: attrs.logoUrl || null,
    logoVerified: Boolean(attrs.logoUrl),
    queryTags: [attrs.query],
    foundAt: Date.now()
  };
}

async function apiGet(base, params, timeoutMs = 9000) {
  const query = new URLSearchParams({ ...params, format: 'json', origin: '*' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}?${query}`, { signal: controller.signal, credentials: 'omit', cache: 'default' });
    if (!response.ok) throw new Error(`Fonte pública respondeu HTTP ${response.status}`);
    const result = await response.json();
    if (result.error) throw new Error(result.error.info || 'Consulta recusada pela fonte');
    return result;
  } finally { clearTimeout(timer); }
}

async function findWikidataSites(term) {
  const results = await apiGet(WIKIDATA, { action: 'wbsearchentities', search: term, language: 'pt', uselang: 'pt', limit: '7', type: 'item' });
  const matches = results.search || [];
  if (!matches.length) return [];
  const ids = matches.map(s => s.id).filter(id => /^Q\d+$/.test(id)).slice(0, 7);
  if (!ids.length) return [];
  const details = await apiGet(WIKIDATA, { action: 'wbgetentities', ids: ids.join('|'), props: 'claims|labels|descriptions', languages: 'pt|en' });
  const sites = [];
  for (const match of matches) {
    const entity = details.entities?.[match.id];
    if (!entity) continue;
    const title = entity.labels?.pt?.value || entity.labels?.en?.value || match.label;
    const description = entity.descriptions?.pt?.value || entity.descriptions?.en?.value || match.description || '';
    for (const url of officialLinks(entity).slice(0, 2)) {
      const s = makeSite(url, { title, description, sourceTitle: title, evidence: 'Site oficial indicado no Wikidata', official: true, color: colorClaim(entity), logoUrl: wikidataLogo(entity), query: term });
      if (s) sites.push(s);
    }
  }
  return sites;
}
async function findWikipediaLinks(term) {
  const listing = await apiGet(WIKIPEDIA, { action: 'query', list: 'search', srsearch: term, srlimit: '5', srnamespace: '0' });
  const pages = listing.query?.search || [];
  const pageids = pages.map(p => p.pageid).filter(Number.isInteger);
  if (!pageids.length) return [];
  const links = await apiGet(WIKIPEDIA, { action: 'query', prop: 'extlinks', pageids: pageids.join('|'), ellimit: 'max', formatversion: '2' });
  const titles = new Map(pages.map(p => [p.pageid, p.title]));
  const sites = [];
  for (const page of links.query?.pages || []) {
    const title = titles.get(page.pageid) || page.title || term;
    for (const link of page.extlinks || []) {
      const value = link.url || link['*'];
      const s = makeSite(value, { sourceTitle: title, evidence: `Link público citado na Wikipédia: ${title}`, query: term });
      if (s) sites.push(s);
    }
  }
  return sites;
}
function mergeSite(old, next) {
  if (!old) return next;
  const result = {
    ...old,
    title: (next.official && !old.official) ? next.title : old.title,
    description: (next.official && !old.official) ? next.description : old.description,
    sourceTitle: old.sourceTitle || next.sourceTitle,
    official: old.official || next.official,
    evidence: (next.official && !old.official) ? next.evidence : old.evidence,
    color: (next.colorVerified && !old.colorVerified) ? next.color : old.color,
    colorVerified: old.colorVerified || next.colorVerified,
    logoUrl: old.logoVerified ? old.logoUrl : (next.logoUrl || old.logoUrl || null),
    logoVerified: Boolean(old.logoVerified || next.logoVerified),
    queryTags: [...new Set([...(old.queryTags || []), ...(next.queryTags || [])])].slice(-25),
    mentions: Math.min(999, (old.mentions || 1) + (next.mentions || 1)),
    foundAt: old.foundAt || next.foundAt
  };
  result.category = classifySite(result);
  if (!result.colorVerified) result.color = neutralColor(result.category);
  return result;
}

function combineSites(candidates) {
  const combined = new Map();
  for (const site of candidates) {
    if (!site) continue;
    const previous = combined.get(site.domain);
    combined.set(site.domain, mergeSite(previous, site));
  }
  return [...combined.values()]
    .sort((a, b) => Number(b.official) - Number(a.official) || b.mentions - a.mentions || a.domain.localeCompare(b.domain))
    .slice(0, MAX_PER_QUERY);
}

export async function discoverSites(term, onProgress = () => {}) {
  const query = normalizeQuery(term);
  if (!query) return { sites: [], fromCache: false, errors: [] };
  const cached = cacheMemory.queries.get(query);
  if (cached && Date.now() - cached.updated < RESEARCH_TTL) {
    const sites = cached.domains.map(domain => cacheMemory.sites.get(domain)).filter(Boolean);
    onProgress('Descobertas salvas no seu navegador (últimas 24 horas).');
    return { sites, fromCache: true, errors: [] };
  }
  onProgress('Pesquisando referências públicas na Wikipédia e no Wikidata…');
  // No máximo 4 requisições (2 por fonte), e somente ao pesquisar.
  const [wikidata, wikipedia] = await Promise.allSettled([findWikidataSites(query), findWikipediaLinks(query)]);
  const errors = [];
  const candidates = [];
  for (const [label, result] of [['Wikidata', wikidata], ['Wikipédia', wikipedia]]) {
    if (result.status === 'fulfilled') candidates.push(...result.value);
    else errors.push(`${label}: ${result.reason?.message || 'indisponível'}`);
  }
  if (errors.length === 2) {
    onProgress('Fontes públicas indisponíveis. Usando apenas as informações já salvas.');
    return { sites: cached?.domains.map(d => cacheMemory.sites.get(d)).filter(Boolean) || [], fromCache: true, errors };
  }
  const fresh = combineSites(candidates);
  const updated = fresh.map(site => mergeSite(cacheMemory.sites.get(site.domain), site));
  for (const site of updated) cacheMemory.sites.set(site.domain, site);
  const saved = { query, updated: Date.now(), domains: updated.map(s => s.domain) };
  cacheMemory.queries.set(query, saved);
  try { await Promise.all([putAll('sites', updated), putAll('queries', [saved])]); }
  catch { onProgress('Não foi possível salvar no navegador; descobertas disponíveis somente nesta sessão.'); }
  onProgress(`${updated.length} site(s) relacionado(s) encontrado(s) em fontes públicas.`);
  return { sites: updated, fromCache: false, errors };
}

export function searchDiscoveries(term, limit = 20) {
  const q = normalizeQuery(term);
  const tokens = q.split(' ').filter(Boolean);
  if (!tokens.length) return [];
  const candidates = [];
  for (const site of cacheMemory.sites.values()) {
    const text = [site.domain, site.title, site.description, ...(site.queryTags || [])].join(' ').toLocaleLowerCase('pt-BR');
    if (!tokens.every(token => text.includes(token))) continue;
    const exact = site.domain.split('.')[0] === q.replaceAll(' ', '');
    const association = (site.queryTags || []).includes(q);
    candidates.push({ ...site, score: (exact ? 100 : 0) + (association ? 65 : 0) + (site.official ? 50 : 0) + Math.min(site.mentions || 1, 20) });
  }
  return candidates.sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain)).slice(0, limit);
}

// Tenta ler a cor dominante do favicon APENAS quando o domínio permite CORS.
// Caso contrário, preserva o tom neutro da categoria, sem afirmar ser cor oficial.
function sampleFavicon(domain, ms = 2600, preferredUrl = null) {
  return sampleLogoColor(preferredUrl || `https://${domain}/favicon.ico`, ms);
}
export async function enrichDiscoveredColors(sites, onChange = () => {}) {
  const candidates = sites.filter(s => !s.colorVerified).slice(0, 6);
  for (const site of candidates) {
    const color = await sampleFavicon(site.domain, 2600, site.logoVerified ? site.logoUrl : null);
    if (!color) continue;
    const current = cacheMemory.sites.get(site.domain);
    if (!current || current.colorVerified) continue;
    const updated = { ...current, color, colorVerified: true, colorEvidence: site.logoVerified ? 'Cor detectada no logotipo disponível no Wikidata' : 'Cor detectada no ícone do site' };
    cacheMemory.sites.set(site.domain, updated);
    try { await putAll('sites', [updated]); } catch { /* continuar com dados em memória */ }
    onChange(updated);
  }
}
