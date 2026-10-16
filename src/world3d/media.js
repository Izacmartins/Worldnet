import * as THREE from 'three';

const HOSTS=new Set(['avatars.githubusercontent.com','covers.openlibrary.org','upload.wikimedia.org','thumb.wikimedia.org']);
export function mediaUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&HOSTS.has(u.hostname)?u.href:null;}catch{return null;}}

// Bounded, shared CORS image loader. Only nearby full-detail chunks acquire
// media. Pending work is cancelled on eviction; no movie or audio is loaded.
export class MediaPool{
  constructor({limit=20,concurrency=2}={}){this.entries=new Map();this.queue=[];this.active=0;this.limit=limit;this.concurrency=concurrency;this.enabled=true;this.disposed=false;}
  acquire(value,onReady){
    const url=mediaUrl(value);if(!url||!this.enabled||this.disposed)return ()=>{};
    let entry=this.entries.get(url);
    if(!entry){entry={url,listeners:new Set(),state:'queued',used:performance.now()};this.entries.set(url,entry);this.queue.push(entry);}
    entry.used=performance.now();entry.listeners.add(onReady);
    if(entry.texture)onReady(entry.texture);
    this.pump();
    return ()=>{entry.listeners.delete(onReady);entry.used=performance.now();this.trim();};
  }
  pump(){
    if(this.disposed)return;
    while(this.active<this.concurrency&&this.queue.length){
      const entry=this.queue.shift();
      if(!this.entries.has(entry.url)||!entry.listeners.size){this.entries.delete(entry.url);continue;}
      entry.state='loading';this.active++;
      const img=new Image();entry.image=img;img.crossOrigin='anonymous';img.referrerPolicy='no-referrer';img.decoding='async';
      let finished=false;
      const finish=ok=>{
        if(finished)return;finished=true;clearTimeout(entry.timer);img.onload=img.onerror=null;this.active--;entry.state=ok?'ready':'failed';
        if(ok&&!this.disposed&&this.entries.has(entry.url)){
          // Downsample before the GPU upload (some provider avatars are large).
          const scale=Math.min(1,512/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));
          c.getContext('2d').drawImage(img,0,0,c.width,c.height);
          const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;entry.texture=texture;
          for(const fn of entry.listeners)fn(texture);
        }
        this.trim();this.pump();
      };
      entry.cancel=()=>{finish(false);img.src='';};
      img.onload=()=>finish(true);img.onerror=()=>finish(false);entry.timer=setTimeout(entry.cancel,7000);img.src=entry.url;
    }
  }
  trim(){
    const unused=[...this.entries.values()].filter(e=>!e.listeners.size).sort((a,b)=>a.used-b.used);
    while(this.entries.size>this.limit&&unused.length){const entry=unused.shift();this.entries.delete(entry.url);entry.cancel?.();entry.texture?.dispose();}
  }
  dispose(){this.disposed=true;for(const entry of this.entries.values()){entry.cancel?.();entry.texture?.dispose();}this.entries.clear();this.queue=[];}
}
