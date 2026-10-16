import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';

// Persistent addresses are allocated once. Query ranking never changes them.
export class ResourceStore {
  constructor(filename) {
    if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true});
    this.db=new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS resources(id TEXT PRIMARY KEY, data TEXT NOT NULL, x INTEGER NOT NULL, y INTEGER NOT NULL, UNIQUE(x,y));
      CREATE VIRTUAL TABLE IF NOT EXISTS resource_search USING fts5(id UNINDEXED,title,description,domain,url);
      CREATE TABLE IF NOT EXISTS query_cache(query TEXT PRIMARY KEY, data TEXT NOT NULL, saved_at INTEGER NOT NULL);`);
  }
  decode(row){return row?{...JSON.parse(row.data),world:{x:row.x,y:row.y}}:null;}
  get(id){return this.decode(this.db.prepare('SELECT * FROM resources WHERE id=?').get(id));}
  upsert(resource) {
    const old=this.get(resource.id);
    // A bare URL must not erase titles and provenance already obtained from a source.
    const next=old&&resource.metadataStatus==='url-only'&&old.metadataStatus==='sourced'?old:{...old,...resource};
    next.firstSeenAt=old?.firstSeenAt||Date.now();
    next.updatedAt=Date.now();
    delete next.world;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      let world=old?.world;
      if(!world){
        const n=this.db.prepare('SELECT COUNT(*) AS n FROM resources').get().n;
        // Separate content district: outside the legacy catalog/discovery radius.
        world={x:400+Number(n)%64,y:Math.floor(Number(n)/64)};
      }
      this.db.prepare('INSERT INTO resources VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(next.id,JSON.stringify(next),world.x,world.y);
      this.db.prepare('DELETE FROM resource_search WHERE id=?').run(next.id);
      this.db.prepare('INSERT INTO resource_search VALUES(?,?,?,?,?)').run(next.id,next.title,next.description,next.domain,next.url);
      this.db.exec('COMMIT');
      return {...next,world};
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  search(query,limit=30) {
    const terms=query.normalize('NFKC').match(/[\p{L}\p{N}_]+/gu)?.slice(0,16)||[];
    if(!terms.length)return [];
    const match=terms.map(t=>'"'+t+'"*').join(' AND ');
    return this.db.prepare(`SELECT r.* FROM resource_search JOIN resources r ON r.id=resource_search.id
      WHERE resource_search MATCH ? ORDER BY bm25(resource_search,0,5,2,3,1) LIMIT ?`).all(match,limit).map(r=>this.decode(r));
  }
  list(limit=200,offset=0){return this.db.prepare('SELECT * FROM resources ORDER BY rowid LIMIT ? OFFSET ?').all(limit,offset).map(r=>this.decode(r));}
  count(){return Number(this.db.prepare('SELECT COUNT(*) AS n FROM resources').get().n);}
  cached(query,now=Date.now()) {
    const row=this.db.prepare('SELECT * FROM query_cache WHERE query=?').get(query);
    return row?{...JSON.parse(row.data),savedAt:row.saved_at,stale:now-row.saved_at>60*60*1000}:null;
  }
  cache(query,data) {
    this.db.prepare('INSERT OR REPLACE INTO query_cache VALUES(?,?,?)').run(query,JSON.stringify(data),Date.now());
    this.db.exec('DELETE FROM query_cache WHERE query IN (SELECT query FROM query_cache ORDER BY saved_at DESC LIMIT -1 OFFSET 500)');
  }
  close(){this.db.close();}
}
