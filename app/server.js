// 没事就玩大富翁 · 服务器（HTTP 静态文件 + 原生 WebSocket 房间对战）
'use strict';
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Room, FUND_CAP, ENDGAME_ROUND, PCOLOR, HEX_PICK_MS, EFFECT_CARDS } = require('./game');
// v5.5：AI 名字按棋子颜色取叠字名 —— 紫色棋子的 AI 就叫「紫紫」，全场一眼对上号
const AI_NAME_BY_COLOR = { '#E53935': '红红', '#1E88E5': '蓝蓝', '#FDD835': '黄黄', '#43A047': '绿绿', '#8E24AA': '紫紫' };

const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

const rooms = new Map(); // code -> {room, clients: Map<token, ws>}
const SSE_MAX_MS = +(process.env.SSE_MAX_MS || 3 * 60 * 1000); // 单条 SSE 最长存活（到期主动断开，防代理保活导致的连接堆积）
const MAX_SSE_PER_ROOM = +(process.env.MAX_SSE_PER_ROOM || 60); // 单房间 SSE 连接上限
function newCode() { let c; do { c = String(Math.floor(100000 + Math.random() * 900000)); } while (rooms.has(c)); return c; }

function broadcast(roomObj) {
  roomObj.lastActive = Date.now();
  const room = roomObj.room;
  const state = snapshot(room);
  const payload = JSON.stringify({ type: 'state', state });
  let n = 0;
  for (const [k, ws] of roomObj.clients) {
    // 僵尸连接自愈：SSE 底层已断开但 close 未触发时，主动清理，避免无上限累积
    if (ws.sse && ws.res && (ws.res.destroyed || ws.res.writableEnded)) { roomObj.clients.delete(k); continue; }
    if (ws.readyState !== 'open') { roomObj.clients.delete(k); continue; }
    send(ws, payload); n++;
  }
  room.events = []; // 已广播
}
function snapshot(room) {
  return {
    phase: room.phase, round: room.round, cur: room.cur, dice: room.dice,
    fundPool: room.fundPool, fundCap: room.fundCap(), endgame: room.round >= room.salaryStop(), log: room.log.slice(-60),
    season: room.season, weather: room.weather,
    // v5.2：校园风貌（本局风貌 / 候选 / 投票明细 / 抽中的幸运儿 / 免费轮与免租轮）
    faculty: room.faculty || null,
    facultyOptions: (room.facultyOptions || []).slice(),
    facultyMs: (room.phase === 'faculty' && room.facEndsAt) ? Math.max(1000, room.facEndsAt - Date.now()) : undefined,   // v5.12：重连时投票剩余毫秒
    facultyVotes: { ...(room.facultyVotes || {}) },
    facultyLucky: room.facultyLucky || null,
    // v7.5：本届中期突变（中央城邦徽章要显示「变异后的实际效果」）
    mutation: room.mutation ? { kind: room.mutation.kind, facId: room.mutation.facId || null, id: room.mutation.id, name: room.mutation.name, desc: room.mutation.desc } : null,
    facTermStart: room.facTermStart || 1,   // v5.9：本届城邦起始轮（10 轮一届）
    freeRound: room.freeRound || 0,
    freeRentRounds: (room.freeRentRounds || []).slice(),
    // v5.7：研究项目三选一进行中（断线重连按快照把选择浮层补回来）
    project: room.project ? { round: room.project.round, tier: room.project.tier, offers: room.project.offers, picks: { ...(room.project.picks) }, ms: HEX_PICK_MS } : null,
    calEvent: room.calEvent ? { id: room.calEvent.id, name: room.calEvent.name, icon: room.calEvent.icon, desc: room.calEvent.desc, kind: room.calEvent.kind, fx: room.calEvent.fx || null } : null,
    players: room.players.map(p => ({
      id: p.id, name: p.name, isAI: p.isAI, trustee: !!p.trustee, cash: p.cash, pos: p.pos, alive: p.alive, color: p.color,
      voucher: p.voucher, discount: p.discount, skipNext: p.skipNext,
      ready: !!p.ready,                        // v7.0：大厅准备状态
      hand: (p.hand || []).map(h => ({ uid: h.uid, id: h.id })),   // v7.0：手动 / 响应型效果卡手牌
      cardCount: (p.hand || []).length,        // v7.0：手牌张数（他人视角只显示数量）
      rentX2: p.rentX2 || 0, rentHalf: p.rentHalf || 0,   // v7.0：租金翻倍 / 减半
      insure: p.insure || 0, truce: p.truce || 0, auctionVouch: p.auctionVouch || 0,   // v7.0
      revive: p.revive || 0, investCards: (p.investCards || []).length,               // v7.0
      forceReroll: p.forceReroll || 0, backstep: p.backstep || 0, reverseDice: p.reverseDice || 0, branchCard: p.branchCard || 0,   // v7.0
      major: p.major, skillLeft: p.skillLeft, combo: p.combo || 0, ach: p.ach || {},
      shield: !!p.shield, sabotage: p.sabotage || 0,
      medal: p.medal || 0, stayFree: p.stayFree || 0, joker: p.joker || 0,   // v7.5：joker 也下发（查看面板要列全效果卡）
      buffSteps: p.buffSteps || 0, stepBuffs: (p.stepBuffs || []).slice(),
      hexList: (p.hexList || []).slice(),   // v5.7：已立项的研究项目（供他人查看 / 玩家卡片标签）
      hexLeft: { ...(p.hexLeft || {}) },     // v5.13：限次项目的剩余触发次数
      hexRefreshLeft: (p.hexRefreshLeft == null) ? 1 : p.hexRefreshLeft,   // v5.10：刷新机会剩余次数
      fundBanned: !!p.fundBanned,           // v5.8：被教育基金拉黑
      borrow: p.borrow ? { ...p.borrow } : null,   // v7.5：偷师卡借来的技能次数（查看面板展示）
      fineFree: p.fineFree || 0,            // v5.8：免罚款卡张数
      stayFree: p.stayFree || 0,            // v5.8：免停留卡张数
      buildCutCard: p.buildCutCard || 0,    // v5.8：盖房 9 折卡张数
      shieldLock: (room.round - (p.shieldRound || -9)) <= 1,   // v5.8：免罚符购买冷却中
      rerollLock: (p.rerollStreak || 0) >= 2,                  // v5.8：重投连用锁定
      invest: p.invest ? { due: p.invest.due, back: p.invest.back } : null,
      rentBuff: p.rentBuff || 0, defBuff: p.defBuff || 0, buildCutTurn: p.buildCutTurn || 0,
      voice: !!p.voice,   // 是否开着麦（语音房状态，仅用于同步 UI 与建连时机）
    })),
    incomeMul: room.incomeMul ? room.incomeMul() : 1,   // v5.8：非租金收益衰减倍率
    cells: room.cells.map((cs) => ({ ...cs })),
    // v6.0：格子租金预览表（点击地图格子查看详情）
    rentViews: room.cells.map((cs, i) => room.rentView(i)),
    pendingBuy: room.pendingBuy, pendingBuild: room.pendingBuild,
    pendingReroll: room.pendingReroll || null,
    pendingBranch: room.pendingBranch || null, pendingInvest: room.pendingInvest || null,
    pendingSkill: room.pendingSkill || null,
    // v7.0：效果卡 —— 手动发动阶段 / 响应（无懈可击）阶段
    pendingCard: room.pendingCard ? { pid: room.pendingCard.pid } : null,
    pendingNegate: room.pendingNegate ? { pid: room.pendingNegate.pid, card: room.pendingNegate.card, attacker: room.pendingNegate.attacker, name: (room.pendingNegate.card && (EFFECT_CARDS.find(c => c.id === room.pendingNegate.card) || {}).name) || room.pendingNegate.card } : null,
    allReady: room.allReady ? room.allReady() : false,   // v7.0：大厅是否全员就绪
    // v7.0：海克斯奖励卡「三张翻面卡」（每人一份候选，断线重连按快照补回浮层）
    draft: room.draft ? { round: room.draft.round, offers: room.draft.offers, picks: { ...(room.draft.picks) }, ms: 30000 } : null,
    auction: room.auction ? { cell: room.auction.cell, highest: room.auction.highest, bidder: room.auction.bidder } : null,
    raise: room.raise, vote: room.vote,
    events: room.events,
  };
}

// ---------- 极简 WebSocket 实现（RFC6455） ----------
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function acceptKey(key) { return crypto.createHash('sha1').update(key + GUID).digest('base64'); }
function send(ws, str) {
  if (ws.readyState !== 'open') return;
  try {
    if (ws.raw) { ws.out.push(str); return; }              // HTTP 请求响应收集
    if (ws.sse) { ws.res.write('data: ' + str + '\n\n'); return; } // SSE 降级通道
    const data = Buffer.from(str);
    const len = data.length;
    let head;
    if (len < 126) head = Buffer.from([0x81, len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeUInt32BE(0, 2); head.writeUInt32BE(len, 6); }
    ws.socket.write(Buffer.concat([head, data]));
  } catch (e) { ws.readyState = 'closed'; }   // 写失败即视为已断开，交给清理逻辑回收
}
function parseFrames(buf, onMsg, ws) {
  let i = 0;
  while (i + 2 <= buf.length) {
    const fin = (buf[i] & 0x80) !== 0, op = buf[i] & 0x0f;
    let len = buf[i + 1] & 0x7f, masked = (buf[i + 1] & 0x80) !== 0, off = i + 2;
    if (len === 126) { len = buf.readUInt16BE(off); off += 2; }
    else if (len === 127) { len = Number(buf.readBigUInt64BE(off)); off += 8; }
    if (off + (masked ? 4 : 0) + len > buf.length) break;
    let payload = buf.slice(off + (masked ? 4 : 0), off + (masked ? 4 : 0) + len);
    if (masked) { const mask = buf.slice(off, off + 4); for (let j = 0; j < payload.length; j++) payload[j] ^= mask[j % 4]; }
    if (op === 0x8) { try { ws.socket.end(); } catch (e) {} return i + 2 + len; }
    if (op === 0x9) { // ping -> pong
      const pong = Buffer.alloc(2 + payload.length); pong[0] = 0x8A; pong[1] = payload.length;
      payload.copy(pong, 2); try { ws.socket.write(pong); } catch (e) {}
    } else if (op === 0x1 && onMsg) onMsg(payload.toString());
    i = off + (masked ? 4 : 0) + len;
  }
  return i; // 已消费字节数
}

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  const query = new URL('http://x' + req.url).searchParams;

  // ---------- HTTP 降级 API（WebSocket 被网络拦截时使用；POST/GET 双支持） ----------
  if (url === '/api/action' && (req.method === 'POST' || req.method === 'GET')) {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      let m = null;
      try {
        if (req.method === 'POST') m = JSON.parse(body);
        else {
          const p = query.get('p');
          if (p) m = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
        }
      } catch (e) {}
      if (!m) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"ok":false}'); return; }
      const out = [];
      try {
        const pseudo = { readyState: 'open', raw: true, out, token: m.token || null, roomObj: m.code ? (rooms.get(m.code) || null) : null, socket: { write: () => {} } };
        onMessage(pseudo, JSON.stringify(m));
        // HTTP 伪连接是一次性的，若它曾以自己身份注册进房间客户端列表则移除（不能误删同 token 的真实 WS/SSE 连接）
        if (pseudo.roomObj && pseudo.token && pseudo.roomObj.clients.get(pseudo.token) === pseudo) pseudo.roomObj.clients.delete(pseudo.token);
      } catch (e) { console.error('[api/action] 处理异常已拦截:', e.message); }
      // 动作类消息（带 token）走 discard socket；create/join 的响应在 out 里
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ ok: true, msgs: out.map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean) }));
    });
    return;
  }
  if (url === '/api/stream' && req.method === 'GET') {
    const code = query.get('code'), token = query.get('token');
    const obj = rooms.get(code);
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(': hi\n\n');
    const adapter = { readyState: 'open', sse: true, res, token: null, roomObj: null, socket: null, bornAt: Date.now() };
    // 硬保险①：单条 SSE 最长存活 SSE_MAX_MS，到期主动断开。
    // 线上经 CDN/反向代理时，客户端断开不会切断代理→源站的连接，res 的 close 事件可能永不触发，
    // 靠这个定时器保证连接数有界；EventSource 会自动重连，净连接数不增。
    adapter.lifeTimer = setTimeout(() => { try { res.end(); } catch (e) {} }, SSE_MAX_MS);
    if (obj) {
      // 硬保险②：同房间 SSE 连接上限，超出时淘汰最旧的观战连接
      const sses = [...obj.clients].filter(([, c]) => c.sse);
      if (sses.length >= MAX_SSE_PER_ROOM) {
        const victims = sses.filter(([, c]) => c.spectator)
          .sort((a, b) => (a[1].bornAt || 0) - (b[1].bornAt || 0))
          .slice(0, sses.length - MAX_SSE_PER_ROOM + 1);
        for (const [k, c] of victims) {
          try { c.res.end(); } catch (e) {}
          if (c.lifeTimer) clearTimeout(c.lifeTimer);
          obj.clients.delete(k);
        }
      }
      adapter.roomObj = obj;
      const room = obj.room;
      const p = room.players.find(q => q.token === token);
      if (p) { // 重连夺回
        p.isAI = false; adapter.token = p.token;
        obj.clients.set(p.token, adapter);
        room.addLog(`${p.name} 重新连接`);
        send(adapter, JSON.stringify({ type: 'joined', code, token: p.token, pid: p.id }));
      } else { // 观战
        const key = 'spectator' + Math.random().toString(36).slice(2);
        adapter.token = key;      // 必须赋值，否则 onLeave 无法清理 → 连接泄漏
        adapter.spectator = true;
        obj.clients.set(key, adapter);
        send(adapter, JSON.stringify({ type: 'joined', code, token: key, pid: null }));
      }
      broadcast(obj);
    }
    res.on('close', () => onLeave(adapter));
    return;
  }

  if (url === '/api/health') {
    const conns = [...rooms.values()].reduce((s, o) => s + o.clients.size, 0);
    const body = JSON.stringify({
      ok: true, rooms: rooms.size, conns,
      uptime: Math.round(process.uptime()),
      mem: Math.round(process.memoryUsage().heapUsed / 1048576) + 'MB',
    });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(body);
    return;
  }

  if (url === '/') url = '/index.html';
  const file = path.join(PUB, url.replace(/\.\./g, ''));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Cache-Control': 'no-cache' }); res.end('Not Found'); return; }
    let body = data;
    // HTML 里的静态资源带版本号（取文件 mtime），绕过 CDN 对旧文件的缓存
    if (path.basename(file) === 'index.html') {
      try {
        const vJs = Math.floor(fs.statSync(path.join(PUB, 'client.js')).mtimeMs);
        const vCss = Math.floor(fs.statSync(path.join(PUB, 'style.css')).mtimeMs);
        body = Buffer.from(body.toString('utf8')
          .replace(/client\.js\?v=__V__/g, 'client.js?v=' + vJs)
          .replace(/style\.css\?v=__V__/g, 'style.css?v=' + vCss));
      } catch (e) {}
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  });
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.end(); return; }
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acceptKey(key) + '\r\n\r\n');
  const ws = { socket, readyState: 'open', roomObj: null, token: null };
  let acc = Buffer.alloc(0);
  socket.on('data', chunk => {
    acc = Buffer.concat([acc, chunk]);
    const consumed = parseFrames(acc, str => { try { onMessage(ws, str); } catch (e) { console.error('[ws] 消息处理异常已拦截:', e.message); } }, ws);
    if (consumed > 0) acc = acc.slice(consumed);
  });
  socket.on('close', () => onLeave(ws));
  socket.on('error', () => onLeave(ws));
  ws.pingIv = setInterval(() => { try { if (ws.readyState === 'open') { const ping = Buffer.from([0x89, 0]); ws.socket.write(ping); } } catch (e) {} }, 30000);
});

function onLeave(ws) {
  ws.readyState = 'closed';
  if (ws.pingIv) clearInterval(ws.pingIv);
  if (ws.lifeTimer) clearTimeout(ws.lifeTimer);
  if (!ws.roomObj || !ws.token) return;
  ws.roomObj.clients.delete(ws.token);
  const room = ws.roomObj.room;
  const p = room.players.find(q => q.token === ws.token);
  if (p && !p.isAI) {
    room.handoverToAI(p); // 掉线托管：转 AI 并立即接管当前行动
  }
  broadcast(ws.roomObj);
}

function onMessage(ws, str) {
  let m; try { m = JSON.parse(str); } catch (e) { return; }
  const roomObj = ws.roomObj;
  if (m.type === 'create' || m.type === 'join') {
    const name = String(m.name || '玩家').slice(0, 8) || '玩家';
    let code = m.code;
    if (m.type === 'create') {
      code = newCode();
      const room = new Room(code, { faculty: true, hex: true, draft: true });   // v5.2：线上房局开启校园风貌；v7.0：开启海克斯奖励卡抽取
      const p = room.join(name);
      if (!p) return;
      const obj = { room, clients: new Map(), createdAt: Date.now(), lastActive: Date.now() };
      rooms.set(code, obj);
      ws.roomObj = obj; ws.token = p.token;
      obj.clients.set(p.token, ws);
      send(ws, JSON.stringify({ type: 'joined', code, token: p.token, pid: p.id }));
      broadcast(obj);
      return;
    }
    const obj = rooms.get(code);
    if (!obj) { send(ws, JSON.stringify({ type: 'error', msg: '房间不存在' })); return; }
    const room = obj.room;
    let p = room.players.find(q => q.token === m.token);
    if (p) { // 重连
      p.isAI = !!p.trustee;   // v5.4：托管中的玩家重连后仍由 AI 代打（未托管则恢复真人）
      ws.roomObj = obj; ws.token = p.token;
      obj.clients.set(p.token, ws);
      room.addLog(`${p.name} 重新连接`);
      send(ws, JSON.stringify({ type: 'joined', code, token: p.token, pid: p.id }));
      broadcast(obj);
      return;
    }
    if (room.phase !== 'lobby') { send(ws, JSON.stringify({ type: 'error', msg: '游戏已开始，只能观战' })); /* 观战 */ 
      ws.roomObj = obj; obj.clients.set('spectator' + Math.random(), ws); broadcast(obj); return; }
    p = room.join(name);
    if (!p) { send(ws, JSON.stringify({ type: 'error', msg: '房间已满（4人）' })); return; }
    ws.roomObj = obj; ws.token = p.token;
    obj.clients.set(p.token, ws);
    send(ws, JSON.stringify({ type: 'joined', code, token: p.token, pid: p.id }));
    broadcast(obj);
    return;
  }
  if (!roomObj) return;
  const room = roomObj.room;
  const p = room.players.find(q => q.token === ws.token);
  if (!p) { // 观战者可参与拍卖？不允许
    return;
  }
  const a = m.action || {};
  let changed = true;
  switch (a.type) {
    case 'addAI': if (room.phase === 'lobby') { const nm = AI_NAME_BY_COLOR[PCOLOR[room.players.length]] || ('小福' + (room.players.length + 1)); const q = room.join(nm, true); if (q) room.addLog(`AI「${q.name}」就位`); } break;
    case 'start': if (room.allReady && room.allReady()) room.start(); else room.addLog('⏳ 还有玩家没点「准备」，无法开始'); break;
    case 'ready': room.setReady(p, a.on === undefined ? true : !!a.on); break;   // v7.0 大厅准备
    case 'useCard': room.useCard(p, a.uid, { target: a.target, cell: a.cell, pick: a.pick }); break;   // v7.0 手动发动效果卡
    case 'skipCard': room.skipCard(p); break;                                        // v7.0 结束手动发动
    case 'useNegate': room.useNegate(p, !!a.yes); break;                             // v7.0 无懈可击卡响应
    case 'pickDraft': room.pickDraftCard(p, a.idx | 0); break;                       // v7.0 海克斯奖励卡三选一
    case 'roll': room.doRoll(p); break;
    case 'buy': room.buy(p); break;
    case 'decline': room.declineBuy(p); break;
    case 'build': room.build(p); break;
    case 'skipBuild': room.skipBuild(p); break;
    case 'bid': room.bid(p, a.amount | 0); break;
    case 'mortgage': room.mortgage(p, a.cell | 0); break;
    case 'redeem': room.redeem(p, a.cell | 0); break;
    case 'sellBuilding': room.sellBuilding(p, a.cell | 0); break;
    case 'voteEnd': room.requestEnd(p); break;
    case 'vote': room.voteEnd(p, !!a.yes); break;
    case 'quit': room.handoverToAI(p); break;
    case 'chat': room.chat(p, a.text); break;
    case 'voice': {   // 开麦/闭麦：只是状态位，随下次广播同步给全场
      const on = !!a.on;
      if (!!p.voice !== on) p.voice = on; else changed = false;   // 无变化不触发广播
      break;
    }
    case 'rtc': {   // 语音信令（SDP / ICE）：服务器不解析，只按 pid 定向转发，避免暴露 token
      const tgt = room.players.find(q => q.id === a.to);
      if (tgt && tgt.token) {
        const c = roomObj.clients.get(tgt.token);
        if (c) send(c, JSON.stringify({ type: 'rtc', from: p.id, data: a.data }));
      }
      changed = false;   // 信令已定向发出，无需全场广播
      break;
    }
    case 'item': room.useItem(p, a.item); break;
    case 'reroll': room.doReroll(p); break;                     // v4.0 重掷骰：付费重投
    case 'confirmRoll': room.confirmRoll(p); break;             // v4.0 重掷骰：就这样走
    case 'enterBranch': room.enterBranch(p); break;             // 学术长廊：进入/路过
    case 'declineBranch': room.declineBranch(p); break;
    case 'buyInvest': room.buyInvest(p); break;                 // 科研投资：投/不投
    case 'declineInvest': room.declineInvest(p); break;
    case 'useSkill': room.useSkill(p); break;                   // v5.1 主动技：发动
    case 'skipSkill': room.skipSkill(p); break;                 // v5.1 主动技：放弃
    case 'voteFaculty': room.voteFaculty(p, String(a.key || '')); break;   // v5.2 校园风貌：投票
    case 'pickProject': room.pickProject(p, String(a.key || '')); break;   // v5.7 研究项目：三选一
    case 'refreshProject': room.refreshProject(p, String(a.key || '')); break;   // v5.10 研究项目：刷新一张
    case 'trustee': room.setTrustee(p, !!a.on); break;   // v5.4 AI 托管：开/关
    case 'major': room.setMajor(p, a.major); break;
    case 'again': // 再来一局
      if (room.phase === 'over') {
        const obj = rooms.get(room.code);
        const { Room: R } = require('./game');
        const nr = new R(room.code, { faculty: true, hex: true, draft: true });
        for (const q of room.players) { const np = nr.join(q.name, q.isAI); if (np && q.major) np.major = q.major; }
        obj.room = nr;
        roomObj.room = nr;
        nr.addLog('新的一局开始！');
      }
      break;
    default: changed = false;
  }
  if (changed) broadcast(roomObj);
}

// 定时兜底：AI 定时器在 game.js 内部，但广播需要触发 —— 轮询每个房间状态变化
setInterval(() => {
  for (const obj of rooms.values()) {
    if (obj.room.phase !== 'lobby' && obj.room.events.length) broadcast(obj);
  }
}, 120);

// SSE 心跳，防止代理掐断空闲连接（顺带清理僵尸连接）
setInterval(() => {
  for (const obj of rooms.values()) {
    for (const [k, c] of obj.clients) {
      if (!c.sse) continue;
      if (c.res && (c.res.destroyed || c.res.writableEnded)) { obj.clients.delete(k); continue; }
      if (c.readyState === 'open') { try { c.res.write(': hb\n\n'); } catch (e) { obj.clients.delete(k); } }
    }
  }
}, 15000);

// ---------- 房间回收：无连接的空房间超过时限即销毁，防止内存/定时器无上限累积 ----------
const ROOM_TTL = +(process.env.ROOM_TTL_MS || 5 * 60 * 1000);      // 空房间最长保留 5 分钟
const ROOM_TTL_OVER = Math.min(ROOM_TTL, 2 * 60 * 1000); // 已结束的空房间保留 2 分钟
const SWEEP_MS = +(process.env.SWEEP_MS || 30000);       // 回收扫描间隔
setInterval(() => {
  const now = Date.now();
  for (const [code, obj] of rooms) {
    if (obj.clients.size > 0) continue;                       // 有人在线，保留
    const idle = now - (obj.lastActive || obj.createdAt || 0);
    const ttl = obj.room.phase === 'over' ? ROOM_TTL_OVER : ROOM_TTL;
    if (idle > ttl) {
      try { obj.room.clearTimer(); obj.room.clearAiTimers(); } catch (e) {}
      rooms.delete(code);
    }
  }
  // 保险阀：房间数异常膨胀时，优先清掉最久无连接的房间
  if (rooms.size > 400) {
    const idleRooms = [...rooms.entries()]
      .filter(([, o]) => o.clients.size === 0)
      .sort((a, b) => (a[1].lastActive || 0) - (b[1].lastActive || 0));
    for (const [code, obj] of idleRooms.slice(0, rooms.size - 300)) {
      try { obj.room.clearTimer(); obj.room.clearAiTimers(); } catch (e) {}
      rooms.delete(code);
    }
  }
}, SWEEP_MS);

// ---------- 看门狗：监控事件循环阻塞与资源水位，异常时留痕（便于事后定位） ----------
let _lastTick = Date.now();
setInterval(() => {
  const drift = Date.now() - _lastTick - 20000;   // 预期 20s，漂移即阻塞
  _lastTick = Date.now();
  const conns = [...rooms.values()].reduce((s, o) => s + o.clients.size, 0);
  const mem = Math.round(process.memoryUsage().heapUsed / 1048576);
  if (drift > 1500 || rooms.size > 200 || conns > 300 || mem > 400) {
    console.log(`[watch] rooms=${rooms.size} conns=${conns} loopDrift=${drift}ms mem=${mem}MB`);
  }
}, 20000);

// 进程级兜底：任何未捕获异常（含 AI 定时器内）都记录并继续运行，绝不崩溃
process.on('uncaughtException', e => console.error('[uncaught] 已拦截:', e && e.message));
process.on('unhandledRejection', e => console.error('[unhandledRejection] 已拦截:', e && (e.message || e)));

server.listen(PORT, () => console.log(`没事就玩大富翁服务器已启动: http://localhost:${PORT}`));
