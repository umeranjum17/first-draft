// Owned public-page stand-in for the reference journey. It explicitly grants reference capture permission.
import { createServer } from 'node:http';
export const permission='Anonymous automated browsers may store screenshots of this entire website privately as visual design references. Do not copy our text or assets into generated designs.';
export function referenceFixture() {
  const requests=[];
  const server=createServer((req,res)=>{
    requests.push({url:req.url,ua:req.headers['user-agent'],cookie:!!req.headers.cookie,authorization:!!req.headers.authorization});
    const send=(type,body)=>{res.writeHead(200,{'content-type':type});res.end(body);};
    if(req.url==='/robots.txt')return send('text/plain','User-agent: *\nAllow: /\n');
    if(req.url==='/terms')return send('text/html',`<!doctype html><title>Reference permission</title><h1>Reference permission</h1><p>${permission}</p>`);
    if(req.url==='/style.css')return send('text/css','*{box-sizing:border-box}body{margin:0;background:#080808;color:#fafafa;font:16px/1.5 Arial,sans-serif}header{display:flex;justify-content:space-between;padding:22px 24px;border-bottom:1px solid #333}nav{color:#aaa}main{max-width:1080px;margin:auto;padding:64px 24px}small{color:#aaa;letter-spacing:.1em}h1{font-size:clamp(42px,7vw,88px);line-height:1.05;letter-spacing:-.055em;font-weight:600;margin:24px 0}p{max-width:520px;color:#999}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:16px;margin-top:40px}.cards article{border:1px solid #333;border-radius:12px;padding:24px}.cards h2{font-size:20px;margin:0 0 8px}a{color:inherit}footer{padding:24px;border-top:1px solid #333;color:#999}');
    return send('text/html','<!doctype html><html><head><title>Umer Reference Lab</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><header><b>Umer Reference Lab</b><nav>Patterns / Notes</nav></header><main><small>REFERENCE COLLECTION</small><h1>Quiet structure.<br>Clear decisions.</h1><p>A local, permissioned source for testing visual references. This is not the real Vercel site.</p><div class="cards"><article><h2>Precise type</h2><p>Large headings and measured contrast.</p></article><article><h2>Room to think</h2><p>Thin rules and generous space.</p></article></div></main><footer><a href="/terms">Terms</a></footer></body></html>');
  });
  return {server,requests,start:()=>new Promise(ok=>server.listen(0,'127.0.0.1',()=>ok(`http://127.0.0.1:${server.address().port}`))),close:()=>{server.closeAllConnections();server.close();}};
}
