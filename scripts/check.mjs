import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()&&!['assets','data'].includes(e.name)?files(path.join(dir,e.name)):e.name.endsWith('.mjs')?[path.join(dir,e.name)]:[]);}
for(const file of ['server.mjs',...['lib','public','scripts','test'].flatMap(files)]){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status)process.exit(result.status);}
console.log('JavaScript syntax checks passed.');
