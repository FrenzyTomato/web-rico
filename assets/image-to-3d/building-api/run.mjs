// Resume the saved 18-building batch, at most six submitted tasks at a time.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const stateURL=new URL('tasks.json',import.meta.url);
const names=JSON.parse(fs.readFileSync(new URL('manifest.json',import.meta.url))).map(x=>x.name);
let previous='';
function run(mode){
  const result=spawnSync(process.execPath,[new URL('generate.mjs',import.meta.url).pathname,mode],{encoding:'utf8',env:process.env,timeout:600000});
  if(result.status!==0)throw Error('Batch '+mode+' stopped: '+(result.stderr||'process failure'));
}
for(let round=0;round<80;round++){
  let state=JSON.parse(fs.readFileSync(stateURL));
  if(Object.values(state.tasks).some(t=>!t.id || ['FAILED','CANCELED'].includes(t.status)))throw Error('A task requires inspection; no automatic regeneration');
  const active=Object.values(state.tasks).some(t=>!t.downloaded);
  if(!active && names.some(n=>!state.tasks[n]))run('submit');
  run('poll');
  state=JSON.parse(fs.readFileSync(stateURL));
  const summary=names.filter(n=>state.tasks[n]).map(n=>n+': '+(state.tasks[n].downloaded?'saved':state.tasks[n].status+' '+state.tasks[n].progress+'%')).join('\n');
  if(summary!==previous){console.log(summary);previous=summary;}
  if(names.every(n=>state.tasks[n]?.downloaded)){console.log('All 18 saved. Remaining credits:',state.lastBalance);break;}
  if(round===79)throw Error('Polling limit reached; saved tasks can be resumed');
  await new Promise(r=>setTimeout(r,15000));
}
