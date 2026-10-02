// Run with Node 24 --env-file=.env. Never prints or persists the API key.
// POSTs are never automatically retried: an uncertain submission needs inspection.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(dir, '../../../apps/web/public/art/meshy-resources');
const stateFile = path.join(dir, 'tasks.json');
const names = JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))).filter(item=>item.method==='meshy').map(item=>item.name);
const key = process.env.MESHY_API_KEY;
if (!key) throw Error('MESHY_API_KEY is missing');
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile)) : { settings: {ai_model:'meshy-6-lite', should_texture:true, enable_pbr:true, texture_resolution:'2k', should_remesh:false, target_formats:['glb']}, tasks:{} };
function save() { fs.writeFileSync(stateFile+'.tmp', JSON.stringify(state,null,2));fs.renameSync(stateFile+'.tmp',stateFile); }
async function api(endpoint, body) {
  const response=await fetch('https://api.meshy.ai/openapi/v1/'+endpoint, {
    method:body?'POST':'GET', headers:{Authorization:'Bearer '+key,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000),redirect:'error'
  });
  if(!response.ok) throw Error('Meshy HTTP '+response.status);
  return response.json();
}
async function download(url, name) {
  const u=new URL(url);
  if(u.protocol!=='https:') throw Error('Non-HTTPS model URL');
  // Signed output URL is supplied by Meshy's authenticated task response.
  // API credentials must never be forwarded to asset storage.
  const r=await fetch(u,{signal:AbortSignal.timeout(120000)});
  if(!r.ok) throw Error('Asset download HTTP '+r.status);
  const b=Buffer.from(await r.arrayBuffer());
  if(b.length<20 || b.readUInt32LE(0)!==0x46546c67 || b.readUInt32LE(4)!==2 || b.readUInt32LE(8)!==b.length) throw Error('Invalid GLB download');
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name+'.glb.part'),b);fs.renameSync(path.join(out,name+'.glb.part'),path.join(out,name+'.glb'));
  return b.length;
}
try {
  if(process.argv[2]==='submit') {
    const balance=await api('balance');console.log('Starting API balance:',balance.balance);
    const pending=names.filter(n=>!state.tasks[n]);
    if(balance.balance<pending.length*15) throw Error('Insufficient credits for the remaining planned models');
    state.startBalance ??= balance.balance;save();
    for(const name of pending.slice(0,6)) {
      const image=fs.readFileSync(path.join(dir,'references',name+'.png'));
      state.tasks[name]={status:'SUBMITTING',submittedAt:new Date().toISOString()};save();
      const result=await api('image-to-3d',{...state.settings,image_url:'data:image/png;base64,'+image.toString('base64')});
      if(typeof result.result!=='string') throw Error('Missing task ID; inspect submission before retry');
      state.tasks[name]={...state.tasks[name],id:result.result,status:'PENDING'};save();console.log(name+': submitted '+result.result);
    }
  } else if(process.argv[2]==='poll') {
    for(const name of names) {
      const saved=state.tasks[name];if(!saved?.id){console.log(name+': no confirmed task');continue;}
      if(saved.downloaded){console.log(name+': downloaded');continue;}
      const task=await api('image-to-3d/'+saved.id);
      Object.assign(saved,{status:task.status,progress:task.progress});save();
      if(task.status==='SUCCEEDED') {
        if(!task.model_urls?.glb)throw Error(name+': completed without a GLB URL');
        saved.bytes=await download(task.model_urls.glb,name);saved.downloaded=true;saved.completedAt=new Date().toISOString();save();
      }
      console.log(name+': '+saved.status+' '+(saved.downloaded?saved.bytes+' bytes':String(saved.progress??0)+'%'));
    }
    const balance=await api('balance');state.lastBalance=balance.balance;save();console.log('API balance:',balance.balance);
  } else throw Error('Use submit or poll');
} catch(e) {
  // Do not dump request objects, signed URLs, image data or authentication headers.
  console.error(e.message.startsWith('Meshy HTTP') || e.message.startsWith('Asset download HTTP') ? e.message : 'Operation stopped: '+(e.name==='TypeError'?'network failure':e.message));
  process.exitCode=1;
}
