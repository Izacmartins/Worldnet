import {spawn} from 'node:child_process';
const children=[];
let ending=false;
function stop(code=0){if(ending)return;ending=true;for(const c of children)c.kill('SIGTERM');process.exitCode=code;}
for(const args of [['server/index.js'],['node_modules/vite/bin/vite.js','--host','0.0.0.0',...process.argv.slice(2)]]){
  const child=spawn(process.execPath,[...process.execArgv,...args],{stdio:'inherit',env:process.env});children.push(child);
  child.on('error',error=>{console.error(error.message);stop(1);});
  child.on('exit',code=>stop(code||0));
}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
