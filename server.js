const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const html=fs.readFileSync(path.join(__dirname,'index.html'));
const srv=http.createServer((q,r)=>{
 if(q.url==='/health'){r.end('ok');return}
 r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(html);
});
const wss=new WebSocketServer({server:srv,maxPayload:2048});
const rooms=new Map();let nid=1;
wss.on('connection',ws=>{
 ws.id=String(nid++);ws.room=null;ws.state=null;ws.last=0;
 ws.on('message',raw=>{
  let m;try{m=JSON.parse(raw)}catch(e){return}
  if(m.t==='join'&&!ws.room){
   const name=String(m.room||'sala1').toLowerCase().replace(/[^a-z0-9_.-]/g,'-').slice(0,36);
   if(!rooms.has(name))rooms.set(name,new Set());
   const set=rooms.get(name);
   if(set.size>=30){ws.close();return}
   ws.room=name;
   for(const o of set)if(o.state)ws.send(JSON.stringify({t:'u',id:o.id,p:o.state}));
   set.add(ws);ws.send(JSON.stringify({t:'ok',id:ws.id}));
  }else if(m.t==='p'&&ws.room&&m.p&&typeof m.p==='object'){
   const now=Date.now();if(now-ws.last<40)return;ws.last=now;
   const p={n:String(m.p.n||'').slice(0,14),h:+m.p.h|0,y:+m.p.y||0,t:+m.p.t||0,l:+m.p.l|0,s:+m.p.s|0,
    st:['play','win','over'].includes(m.p.st)?m.p.st:'play'};
   ws.state=p;const msg=JSON.stringify({t:'u',id:ws.id,p});
   for(const o of rooms.get(ws.room))if(o!==ws&&o.readyState===1)o.send(msg);
  }
 });
 ws.on('close',()=>{
  const set=rooms.get(ws.room);if(!set)return;
  set.delete(ws);const msg=JSON.stringify({t:'l',id:ws.id});
  for(const o of set)if(o.readyState===1)o.send(msg);
  if(!set.size)rooms.delete(ws.room);
 });
});
srv.listen(process.env.PORT||3000,()=>console.log('Servidor listo en el puerto '+(process.env.PORT||3000)));
