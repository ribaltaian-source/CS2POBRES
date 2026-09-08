'use strict';

// Zero-dependency LAN game server. The small, authoritative simulation keeps
// the server cheap enough for a homelab device.
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.PORT || 8080);
const TICK_MS = 1000 / 30;
const STATE_EVERY = 2;
const ROOT = path.join(__dirname, 'public');
const MAPS = {
  dockyard: { name: 'Astillero', w: 1200, h: 700, walls: [[520,0,90,235],[520,465,90,235],[170,285,190,90],[840,285,190,90]], spawns: [[100,110],[1100,590]] },
  solar: { name: 'Patio solar', w: 1200, h: 700, walls: [[330,160,160,80],[710,460,160,80],[555,280,90,140],[120,520,170,55],[910,125,170,55]], spawns: [[95,610],[1100,90]] },
  metro: { name: 'Metro', w: 1200, h: 700, walls: [[220,0,90,480],[220,570,90,130],[560,130,90,440],[900,0,90,480],[900,570,90,130]], spawns: [[80,350],[1120,350]] }
};
const WEAPONS = {
  pistol: { name: 'Pistola', damage: 22, cooldown: 330, mag: 12, reload: 900, range: 510, color: '#f6be55' },
  rifle: { name: 'Fusil', damage: 16, cooldown: 105, mag: 25, reload: 1350, range: 590, color: '#75e4ff' },
  smg: { name: 'Subfusil', damage: 11, cooldown: 72, mag: 32, reload: 1200, range: 430, color: '#ff8fc8' }
};
const HEROES = { scout: { name:'Explorador', color:'#65d7ff' }, medic: { name:'Médico', color:'#85ee8d' }, engineer: { name:'Ingeniero', color:'#ffbd5b' } };

function localNetwork() {
  const desired = process.env.LAN_IP;
  for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) {
    if (n.family === 'IPv4' && !n.internal && (!desired || n.address === desired)) {
      const mask = n.netmask.split('.').map(Number); const ip = n.address.split('.').map(Number);
      return { ip:n.address, mask, base: ip.map((v,i) => v & mask[i]) };
    }
  }
  throw new Error(desired ? `LAN_IP ${desired} no corresponde a una interfaz IPv4.` : 'No se encontró una interfaz IPv4 de red. Define LAN_IP.');
}
const LAN = localNetwork();
function allowed(ip) {
  ip = ip.replace(/^::ffff:/, '');
  if (ip === '127.0.0.1' || ip === '::1') return true;
  const bits = ip.split('.').map(Number);
  return bits.length === 4 && bits.every(Number.isFinite) && bits.every((v,i) => (v & LAN.mask[i]) === LAN.base[i]);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function distance(a,b) { return Math.hypot(a.x-b.x, a.y-b.y); }
function insideWall(x,y,r,wall) { const [wx,wy,ww,wh] = wall; return x+r>wx && x-r<wx+ww && y+r>wy && y-r<wy+wh; }
function lineBlocked(a,b,walls) {
  // Sampled line is sufficient for this deliberately small arena game.
  const d = distance(a,b), steps = Math.ceil(d / 12);
  for(let i=1;i<steps;i++) { const x=a.x+(b.x-a.x)*i/steps, y=a.y+(b.y-a.y)*i/steps; if(walls.some(w=>insideWall(x,y,2,w))) return true; }
  return false;
}
function player(id, name, hero='scout', weapon='rifle', bot=false) {
  return { id, name:(name||'Agente').slice(0,16), hero:HEROES[hero]?hero:'scout', weapon:WEAPONS[weapon]?weapon:'rifle', bot, x:0,y:0,angle:0,hp:100,ammo:WEAPONS[weapon]?.mag || 25,score:0, input:{}, nextShot:0,reloadAt:0,skillAt:0,shieldUntil:0,dashUntil:0,deadUntil:0 };
}
let room = { map:'dockyard', players:new Map(), host:null, round:1, winner:null, resetAt:0 };
const clients = new Map();

function encodeFrame(text) { const data=Buffer.from(text); const n=data.length; let head; if(n<126) head=Buffer.from([0x81,n]); else { head=Buffer.alloc(4); head[0]=0x81; head[1]=126; head.writeUInt16BE(n,2); } return Buffer.concat([head,data]); }
function send(ws, object) { if (!ws.destroyed) ws.write(encodeFrame(JSON.stringify(object))); }
function broadcast(object) { for(const ws of clients.keys()) send(ws,object); }
function publicPlayer(p) { return {id:p.id,name:p.name,hero:p.hero,weapon:p.weapon,bot:p.bot,x:Math.round(p.x),y:Math.round(p.y),angle:p.angle,hp:p.hp,ammo:p.ammo,score:p.score,shield:p.shieldUntil>Date.now(),dead:p.deadUntil>Date.now()}; }
function snapshot() { const map=MAPS[room.map]; return {type:'state', map:room.map, mapData:{name:map.name,w:map.w,h:map.h,walls:map.walls}, players:[...room.players.values()].map(publicPlayer), round:room.round, winner:room.winner}; }
function spawn(p, index) { const s=MAPS[room.map].spawns[index%2]; Object.assign(p,{x:s[0],y:s[1],hp:100,ammo:WEAPONS[p.weapon].mag,deadUntil:0,shieldUntil:0,dashUntil:0,reloadAt:0}); }
function resetRound() { room.round++; room.winner=null; room.resetAt=0; [...room.players.values()].forEach(spawn); broadcast({type:'notice', text:'Nueva ronda'}); }
function validPosition(p,x,y) { const m=MAPS[room.map]; return x>=16&&y>=16&&x<=m.w-16&&y<=m.h-16&&!m.walls.some(w=>insideWall(x,y,16,w)); }
function shoot(p, now) {
  const w=WEAPONS[p.weapon]; if(p.deadUntil>now||p.reloadAt>now||p.nextShot>now) return;
  if(p.ammo<=0) { p.reloadAt=now+w.reload; return; }
  p.ammo--; p.nextShot=now+w.cooldown;
  const target=[...room.players.values()].filter(q=>q!==p&&!q.deadUntil).sort((a,b)=>distance(p,a)-distance(p,b))[0];
  if(!target || distance(p,target)>w.range || lineBlocked(p,target,MAPS[room.map].walls)) return;
  const forward=Math.cos(p.angle)*(target.x-p.x)+Math.sin(p.angle)*(target.y-p.y);
  const cross=Math.abs(Math.cos(p.angle)*(target.y-p.y)-Math.sin(p.angle)*(target.x-p.x));
  if(forward<0 || cross>42) return;
  const damage=target.shieldUntil>now ? Math.ceil(w.damage*.42) : w.damage;
  target.hp-=damage; broadcast({type:'hit', x:target.x,y:target.y,damage});
  if(target.hp<=0) { target.hp=0; target.deadUntil=now+2400; p.score++; room.winner=p.id; room.resetAt=now+2800; broadcast({type:'notice', text:`${p.name} gana la ronda`}); }
}
function useSkill(p,now) { if(p.skillAt>now||p.deadUntil>now) return; p.skillAt=now+6500; if(p.hero==='scout') p.dashUntil=now+420; else if(p.hero==='medic') p.hp=Math.min(100,p.hp+35); else p.shieldUntil=now+2800; }
function botThink(p, now) { const foe=[...room.players.values()].find(q=>q!==p); if(!foe||foe.deadUntil>now||p.deadUntil>now)return; const dx=foe.x-p.x,dy=foe.y-p.y,d=Math.hypot(dx,dy); p.angle=Math.atan2(dy,dx); p.input={up: d>230&&dy<0, down:d>230&&dy>0, left:d>230&&dx<0, right:d>230&&dx>0, shoot:d<500}; if(p.hp<35&&p.hero==='medic')useSkill(p,now); if(d<120&&p.hero==='scout')useSkill(p,now); }
function tick() {
  const now=Date.now(); if(room.resetAt&&now>=room.resetAt) resetRound();
  for(const p of room.players.values()) {
    if(p.bot) botThink(p,now); if(p.deadUntil>now) continue;
    if(p.reloadAt&&now>=p.reloadAt) {p.reloadAt=0;p.ammo=WEAPONS[p.weapon].mag;}
    const i=p.input||{}, speed=(p.dashUntil>now?540:220)*TICK_MS/1000; let dx=(i.right?1:0)-(i.left?1:0),dy=(i.down?1:0)-(i.up?1:0); if(dx&&dy){dx*=.707;dy*=.707;} const nx=p.x+dx*speed,ny=p.y+dy*speed; if(validPosition(p,nx,p.y))p.x=nx;if(validPosition(p,p.x,ny))p.y=ny;
    if(i.shoot) shoot(p,now);
  }
  if(++tick.count%STATE_EVERY===0) broadcast(snapshot());
}
tick.count=0; setInterval(tick,TICK_MS);

function join(ws,msg) {
  if(room.players.size>=2) return send(ws,{type:'error',text:'La sala ya tiene dos combatientes.'});
  if(msg.map&&MAPS[msg.map]&&room.players.size===0) room.map=msg.map;
  const p=player(crypto.randomUUID(),msg.name,msg.hero,msg.weapon); room.players.set(p.id,p); clients.set(ws,p);
  if(!room.host)room.host=p.id; spawn(p,room.players.size-1); send(ws,{type:'welcome',id:p.id,heroes:HEROES,weapons:WEAPONS,maps:Object.fromEntries(Object.entries(MAPS).map(([id,m])=>[id,m.name]))}); broadcast({type:'notice',text:`${p.name} entró en la sala`});
}
function handle(ws,msg) { const p=clients.get(ws); if(msg.type==='join'&&!p)return join(ws,msg); if(!p)return; if(msg.type==='input') p.input={up:!!msg.up,down:!!msg.down,left:!!msg.left,right:!!msg.right,shoot:!!msg.shoot}; else if(msg.type==='aim'&&Number.isFinite(msg.angle))p.angle=msg.angle; else if(msg.type==='skill')useSkill(p,Date.now()); else if(msg.type==='bot'&&p.id===room.host&&room.players.size===1){const b=player('bot-'+Date.now(),'Bot Centinela',msg.hero||'engineer',msg.weapon||'smg',true);room.players.set(b.id,b);spawn(b,1);broadcast({type:'notice',text:'Bot añadido'});} }
function leave(ws) { const p=clients.get(ws); if(!p)return; clients.delete(ws);room.players.delete(p.id); if(room.host===p.id)room.host=[...room.players.keys()][0]||null; if(room.players.size===0)room={map:'dockyard',players:new Map(),host:null,round:1,winner:null,resetAt:0}; else broadcast({type:'notice',text:`${p.name} salió`}); }
function websocket(req,socket) {
  const key=req.headers['sec-websocket-key']; if(!key)return socket.destroy(); const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64'); socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n'); let buffer=Buffer.alloc(0); socket.on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]); while(buffer.length>=2){const opcode=buffer[0]&15,n=buffer[1]&127,masked=(buffer[1]&128)!==0;let offset=2,len=n;if(n===126){if(buffer.length<4)return;len=buffer.readUInt16BE(2);offset=4;}if(!masked||buffer.length<offset+4+len)return;const mask=buffer.subarray(offset,offset+4),data=buffer.subarray(offset+4,offset+4+len);for(let i=0;i<data.length;i++)data[i]^=mask[i%4];buffer=buffer.subarray(offset+4+len);if(opcode===8){socket.end();return;}if(opcode!==1)continue;try{handle(socket,JSON.parse(data.toString()));}catch{}}}); socket.on('close',()=>leave(socket));socket.on('error',()=>leave(socket)); }
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const ip=req.socket.remoteAddress||'';if(!allowed(ip)){res.writeHead(403);return res.end('Solo red local');}let url=req.url==='/'?'/index.html':decodeURIComponent(req.url.split('?')[0]);const file=path.resolve(ROOT,'.'+url);if(!file.startsWith(ROOT)||!fs.existsSync(file)){res.writeHead(404);return res.end('No encontrado');}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);});
server.on('upgrade',(req,socket)=>{if(!allowed(req.socket.remoteAddress||'')){socket.destroy();return;}if(req.url!=='/ws'){socket.destroy();return;}websocket(req,socket);});
server.listen(PORT,'0.0.0.0',()=>console.log(`LAN Strike Lite listo en http://${LAN.ip}:${PORT} (subred local únicamente)`));
