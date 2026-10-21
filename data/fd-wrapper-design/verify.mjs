// Native Chromium/CDP journey; no packages, accounts, models, or installed browser state.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const dir = resolve('data/fd-wrapper-design'), out = `${dir}/evidence`, runtime = `${dir}/runtime`;
mkdirSync(out, {recursive:true}); mkdirSync(runtime, {recursive:true});
const fixture = `${dir}/fixtures/notes.html`, extra = `${runtime}/notes-alt.html`;
writeFileSync(extra, readFileSync(fixture));
const processes = [];
const launch = (cmd, args, match, env = process.env) => new Promise((ok, fail) => {
  const child = spawn(cmd, args, {env, stdio:['ignore','pipe','pipe']}); processes.push(child);
  let log = ''; const take = (chunk) => { log += chunk; const found = log.match(match); if(found) ok(found[1]); };
  child.stdout.on('data',take); child.stderr.on('data',take); child.once('error',fail); child.once('exit',code=>fail(new Error(`${cmd} exited ${code}: ${log}`)));
});
let ws, serial=0; const pending=new Map(), childSessions=new Map(), clips=[]; let record=false;
try {
  const base = await launch(process.execPath,['src/cli.mjs','view',fixture,extra,'--host','127.0.0.1','--port','0'], /"url":"([^"]+)"/, {...process.env,FIRST_DRAFT_HOME:runtime});
  const endpoint = await launch('/usr/bin/chromium',['--headless','--no-sandbox','--disable-extensions','--disable-dev-shm-usage','--remote-debugging-port=0',`--user-data-dir=${runtime}/chrome`,'about:blank'], /DevTools listening on (ws:\/\/\S+)/);
  ws = new WebSocket(endpoint); await new Promise((ok,fail)=>{ws.onopen=ok;ws.onerror=fail;});
  const send = (method,params={},sessionId) => new Promise((ok,fail)=>{const id=++serial;pending.set(id,{ok,fail});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  ws.onmessage = ({data}) => { const m=JSON.parse(data); if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.fail(new Error(JSON.stringify(m.error))):p.ok(m.result);}
    if(m.method==='Page.screencastFrame'){if(record){const f=`${runtime}/clip-${clips.length}.jpg`;writeFileSync(f,Buffer.from(m.params.data,'base64'));clips.push({file:f,time:m.params.metadata.timestamp});}send('Page.screencastFrameAck',{sessionId:m.params.sessionId},m.sessionId);}
  };
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const c=(m,p={})=>send(m,p,sessionId);
  await c('Page.enable'); await c('Runtime.enable');
  const evaluate = async expression => {const r=await c('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text+JSON.stringify(r.exceptionDetails.exception));return r.result.value;};
  const settle=()=>evaluate(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  const open=async path=>{await c('Page.navigate',{url:base+path});for(let i=0;i<100;i++){if(await evaluate(`document.readyState==='complete' && !!document.querySelector('#app>*')`))break;await new Promise(r=>setTimeout(r,50));}await settle();};
  const click=async selector=>{const r=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing target');e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()`);await c('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...r});await c('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...r});await settle();};
  const key=async name=>{await c('Input.dispatchKeyEvent',{type:'keyDown',key:name});await c('Input.dispatchKeyEvent',{type:'keyUp',key:name});await settle();};
  const shot=async name=>{await settle();const expected=await evaluate(`[...document.querySelectorAll('iframe')].filter(f=>f.getClientRects().length).length`);let ready=expected===0;
    for(let i=0;i<100&&!ready;i++){const children=(await send('Target.getTargets')).targetInfos.filter(t=>t.type==='iframe'&&t.parentId===targetId);ready=children.length===expected;
      for(const t of children){if(!childSessions.has(t.targetId))childSessions.set(t.targetId,(await send('Target.attachToTarget',{targetId:t.targetId,flatten:true})).sessionId);const r=await send('Runtime.evaluate',{expression:`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(document.readyState==='complete' && document.body.innerText.length>20))))`,awaitPromise:true,returnByValue:true},childSessions.get(t.targetId));if(!r.result.value)ready=false;}
      if(!ready)await new Promise(r=>setTimeout(r,50));}assert.ok(ready,`${name}: live iframe content not ready`);await settle();const {data}=await c('Page.captureScreenshot',{format:'png'});writeFileSync(`${out}/${name}.png`,Buffer.from(data,'base64'));};
  const viewport=async(width,theme)=>{await c('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await c('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme}]});};
  await viewport(1280,'light');await open('?wrapper=studio#/o/1');
  if(process.argv.includes('--diagnose')){await new Promise(r=>setTimeout(r,500));console.log(JSON.stringify({tree:await c('Page.getFrameTree'),targets:await send('Target.getTargets')},null,2));}
  else if(process.argv.includes('--blank')){
    for(const theme of ['light','dark']){await viewport(390,theme);await open('#/o/1');
      await evaluate(`document.querySelector('.canvas').scrollIntoView({block:'end'});window.scrollTo(0,document.documentElement.scrollHeight)`);await new Promise(r=>setTimeout(r,1500));await settle();
      const info=await evaluate(`[...document.querySelectorAll('iframe')].map(f=>{const r=f.getBoundingClientRect();return{label:f.title,top:Math.round(r.top),height:Math.round(r.height),visible:r.bottom>0&&r.top<innerHeight}})`);
      console.log(JSON.stringify({theme,scrollY:await evaluate('scrollY'),innerHeight:await evaluate('innerHeight'),info}));
      const {data}=await c('Page.captureScreenshot',{format:'png'});writeFileSync(`${out}/before-390-scrolled-${theme}.png`,Buffer.from(data,'base64'));}
  }
  else if(process.argv.includes('--repro')){const before=await evaluate(`document.querySelector('.wl-brief').getBoundingClientRect().width`);await click('.wl-header button:last-child');const after=await evaluate(`document.querySelector('.wl-brief').getBoundingClientRect().width`);assert.notEqual(after,before,'Studio Brief must collapse the desktop panel');console.log('Brief collapse PASS');}
  else {
    for(const theme of ['light','dark'])for(const width of [1280,390]){
      await viewport(width,theme);
      for(const route of ['#/o/1','#/wrappers','?wrapper=studio#/o/1','?wrapper=focus#/o/1']){
        await open(route);const name=route.includes('studio')?'studio':route.includes('focus')?'focus':route.includes('wrappers')?'picker':'before';
        const metrics=await evaluate(`(()=>{const r=document.querySelector('.wrapper-lab');return{width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,small:r?[...r.querySelectorAll('button,a,p,span,textarea,select')].filter(e=>e.getClientRects().length&&parseFloat(getComputedStyle(e).fontSize)<16).map(e=>e.textContent):[]}})()`);
        assert.equal(metrics.overflow,false,`${name}: horizontal overflow`);assert.deepEqual(metrics.small,[],`${name}: shell text under 16px`);
        await shot(`${name}-${width}-${theme}`);console.log(JSON.stringify({capture:`${name}-${width}-${theme}`,metrics}));
        if(['studio','focus'].includes(name)){
          await click('.wl-header button:last-child');await shot(`${name}-brief-${width}-${theme}`);await click('.wl-header button:last-child');
          await click('.wl-toolbar>button');await shot(`${name}-notes-${width}-${theme}`);await click('.wl-toolbar>button');
          await click('.wl-header button:first-of-type');await shot(`${name}-empty-${width}-${theme}`);
        }
      }
    }
    await viewport(1280,'light'); await open('#/wrappers');
    record=true;await c('Page.startScreencast',{format:'jpeg',quality:75,maxWidth:1280,maxHeight:900,everyNthFrame:1});
    for(const width of [1280,390])for(const direction of ['studio','focus']){
      await viewport(width,'light');await open('#/wrappers');await click(`a[href='?wrapper=${direction}#/o/1']`);
      if(width===390 && direction==='studio')await click('.wl-header button:last-child');
      await click('.wl-composer textarea');await c('Input.insertText',{text:'Umer: make the next iteration feel a little calmer.'});await click('.wl-composer button');
      assert.match(await evaluate(`document.querySelector('.wl-log').textContent`),/Umer: make the next iteration/);
      await shot(`${direction}-saved-${width}`);if(width===390 && direction==='studio')await click('.wl-header button:last-child');
      await click('.wl-toolbar>button');assert.equal(await evaluate(`document.querySelector('.wl-comments').hidden`),false);await click('.wl-toolbar>button');
      await click('.wl-devices button:last-child');assert.equal(await evaluate(`document.querySelector('.scaled-inner').style.width`),'390px');
      await click('.wl-toolbar select');await key('ArrowDown');await key('Enter');assert.match(await evaluate(`location.hash`),/o\/2/);
      await click('.wl-header button:first-of-type');assert.equal(await evaluate(`!!document.querySelector('.wl-empty')`),true);
      await click('.wl-empty a');await click('.wl-toolbar a');assert.match(await evaluate('location.hash'),/play/);await shot(`${direction}-play-${width}`);
      await click('.bar>a');await click('.wl-back');assert.equal(await evaluate(`!!document.querySelector('.wl-picker')`),true);
    }
    await c('Page.stopScreencast');record=false;
    if(clips.length){writeFileSync(`${runtime}/recording.txt`,clips.map((f,i)=>`file '${f.file}'\nduration ${Math.max(.05,(clips[i+1]?.time??f.time+.5)-f.time)}`).join('\n'));console.log(`RECORDING ${runtime}/recording.txt`);}
    console.log('PASS: native wrapper matrix and picker/Back/brief/notes/device/selection/empty/Play journey');
  }
} finally {
  if(ws?.readyState===1)ws.close();
  for(const child of processes.reverse()){if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,3000))]);if(child.exitCode===null)child.kill('SIGKILL');}}
}
