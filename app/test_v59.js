#!/usr/bin/env node
// v5.10 引擎测试：前五轮限购 / 海克斯刷新 / 定调六城 + 30 娱乐城邦 / 50 新海克斯 / 新钩子 / 时长
'use strict';
const path = require('path');
const fs = require('fs');
const G = require('./game');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
function section(n, t) { console.log(`\n[${n}] ${t}`); }

function mkRoom(n = 2, opts) {
  const room = new G.Room('t' + Math.floor(Math.random() * 1e6), Object.assign({ hex: true, faculty: true }, opts || {}));
  for (let i = 0; i < n; i++) room.join('P' + (i + 1), i > 0);
  room.start(); room.clearTimer(); room.clearAiTimers();
  room.phase = 'roll';
  return room;
}
const unownedProp = r => G.BOARD.findIndex((c, i) => c.type === 'prop' && r.cells[i].own === null);

// ================= [1] 表完整性与镜像 =================
section(1, '城邦 59 / 海克斯 104 / 镜像一致 / 提前触发表');
{
  ok(G.FACULTY_KEYS.length === 59, `城邦共 ${G.FACULTY_KEYS.length} 个（预期 59）`);
  const themes = G.FACULTY_KEYS.filter(k => G.FACULTY[k].hexTheme);
  ok(themes.length === 6 && themes.every(k => JSON.stringify(G.FACULTY[k].terms) === '[1,1]'),
    `海克斯定调六城 ${themes.join('/')}，terms 全为 [1,1]`);
  ok(!G.FACULTY_KEYS.slice(0, 23).some(k => G.FACULTY[k].hexTheme), '老 23 城无 hexTheme 标记');
  const cnt = { silver: 0, gold: 0, prism: 0 };
  for (const k in G.PROJECTS) cnt[G.PROJECTS[k].tier]++;
  const total = Object.keys(G.PROJECTS).length;
  ok(total === 104 && cnt.silver === 40 && cnt.gold === 35 && cnt.prism === 29,
    `海克斯共 ${total} 个（银 ${cnt.silver} / 金 ${cnt.gold} / 彩 ${cnt.prism}）`);
  ok(JSON.stringify(G.HEX_TRIGGERS_EARLY) === JSON.stringify([2, 5, 10, 20, 32, 40]), 'HEX_TRIGGERS_EARLY = 2/5/10/20/32/40');
  // 客户端镜像逐字一致
  const game = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  const cli = fs.readFileSync(path.join(__dirname, 'public/client.js'), 'utf8');
  const span = (src, a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
  const gFac = span(game, 'const FACULTY = {', 'const FACULTY_KEYS = Object.keys(FACULTY);');
  const cFac = span(cli, 'const FACULTY = {', 'const FACULTY_KEYS = Object.keys(FACULTY);');
  const gPrj = span(game, 'const PROJECTS = {', 'const PROJECT_KEYS = {');
  const cPrj = span(cli, 'const PROJECTS = {', 'const PROJECT_KEYS = {');
  ok(gFac === cFac, 'FACULTY 镜像与 game.js 逐字一致');
  ok(gPrj === cPrj, 'PROJECTS 镜像与 game.js 逐字一致');
  // 每个新城邦字段齐全
  const bad = G.FACULTY_KEYS.filter(k => !G.FACULTY[k].name || !G.FACULTY[k].icon || !G.FACULTY[k].color || !G.FACULTY[k].lead || !G.FACULTY[k].cost || !G.FACULTY[k].tag);
  ok(bad.length === 0, `59 城字段齐全${bad.length ? '（缺 ' + bad.join(',') + '）' : ''}`);
  ok(G.HEX_PICK_MS === 52000 && G.FACULTY_VOTE_MS === 40000, `时长：海克斯 ${G.HEX_PICK_MS / 1000}s / 投票 ${G.FACULTY_VOTE_MS / 1000}s`);
}

// ================= [2] 前五轮限购 =================
section(2, '前五轮限购：每回合一块地；已买过则不买也不拍卖；第 6 轮解除');
{
  const r = mkRoom(2, { hex: false });
  const [a, b] = r.players;
  r.round = 2; r.dice = null;
  // ① 已买过 → 不给买也不进拍卖
  let idx = unownedProp(r);
  a.pos = idx; a.boughtThisTurn = true; r.phase = 'roll';
  r.resolveCell(a);
  ok(r.pendingBuy === null && r.auction === null, '限购期已买过：无买地询问、无拍卖');
  ok(r.log.some(l => l.msg.includes('前 5 轮限购')), '播报「前 5 轮限购」');
  // ② 未买过 → 正常询问，放弃才进拍卖
  r.clearTimer(); r.clearAiTimers(); r.phase = 'roll';
  idx = unownedProp(r);
  b.pos = idx; b.boughtThisTurn = false;
  r.resolveCell(b);
  ok(r.phase === 'buy' && r.pendingBuy && r.pendingBuy.pid === b.id, '未买过：正常弹买地询问');
  r.declineBuy(b);
  ok(r.phase === 'auction' && r.auction && r.auction.cell === idx, '放弃购买 → 照常进入拍卖');
  // ③ 限购期已买过者不能参拍
  const hi = r.auction.highest;
  a.boughtThisTurn = true;
  r.bid(a, hi + 500);
  ok(r.auction.highest === hi, '已买过地的玩家出价被拒');
  b.boughtThisTurn = false;
  r.bid(b, hi + 500);
  ok(r.auction.highest === hi + 500, '未买过地的玩家可以出价');
  r.clearTimer(); r.clearAiTimers();
  // 把当前回合指向 b：成交后 afterResolve→endTurn 会轮转到 a 并重置 a，b 的标志得以保留供断言
  r.cur = r.players.indexOf(b);
  // ④ 拍卖成交计入限购额度
  r.auction.bidder = b.id;
  b.hex = {};
  r.endAuction();
  ok(b.boughtThisTurn === true, '拍卖赢家计入本轮限购额度');
  // ⑤ 买地成功计入额度（同理把回合指向 b，避免 endTurn 轮转重置 b）
  b.boughtThisTurn = false;
  r.cur = r.players.indexOf(b);
  idx = unownedProp(r);
  b.pos = idx; r.phase = 'roll'; r.resolveCell(b);
  const price = r.pendingBuy.price; b.cash = Math.max(b.cash, price + 1);
  r.buy(b);
  ok(b.boughtThisTurn === true, '买地成功计入本轮限购额度');
  // ⑥ 同回合再踩无主地 → 再次被限
  r.clearTimer(); r.clearAiTimers(); r.phase = 'roll'; r.dice = null;
  idx = unownedProp(r);
  b.pos = idx;
  r.resolveCell(b);
  ok(r.pendingBuy === null && r.auction === null, '双数再走到无主地：仍被限购（不买不拍卖）');
  // ⑦ 第 6 轮解除
  r.round = 6; r.clearTimer(); r.clearAiTimers(); r.phase = 'roll';
  idx = unownedProp(r);
  b.pos = idx; b.boughtThisTurn = true;
  r.resolveCell(b);
  ok(r.phase === 'buy' && r.pendingBuy && r.pendingBuy.pid === b.id, '第 6 轮起限购解除');
}

// ================= [3] 海克斯刷新 =================
section(3, '海克斯刷新：整局一次，同档换卡，用过即止');
{
  const r = mkRoom(2);
  const [a, b] = r.players;
  r.phase = 'project';
  r.project = { round: 2, tier: 'silver', offers: { [a.id]: ['stipend', 'thrift', 'agent'], [b.id]: ['openbook', 'allowance', 'microlend'] }, picks: {} };
  a.hexRefreshLeft = 1;
  const before = r.project.offers[a.id].slice();
  r.refreshProject(a, 'stipend');
  const after = r.project.offers[a.id];
  ok(!after.includes('stipend') && after.length === 3 && new Set(after).size === 3, `刷新后 ${JSON.stringify(after)}（不含原卡、仍 3 张不重复）`);
  ok(after.every(k => G.PROJECT_KEYS.silver.includes(k)), '换来的仍是同档（银）新卡');
  ok(a.hexRefreshLeft === 0, '刷新机会用完');
  const snap = after.slice();
  r.refreshProject(a, 'thrift');
  ok(JSON.stringify(r.project.offers[a.id]) === JSON.stringify(snap), '第二次刷新被拒（整局一次）');
  // 未选中也可正常立项
  r.pickProject(a, after[0]);
  ok(r.project.picks[a.id] === after[0], '刷新后仍可正常选卡立项');
  void before; void b;
}

// ================= [4] 定调六城 =================
section(4, '定调城邦：前三次强制档位 / 仅 3 次 / 提前触发');
{
  const force = (key, want) => {
    const r = mkRoom(3);
    r.applyFacultySetup(key);
    r.hexDoneRounds = []; r.hexTiers = [];
    r.round = 2; r.phase = 'roll';
    r.maybeProject();
    ok(r.project && r.project.tier === want, `【${G.FACULTY[key].name}】第一次立项档位 = ${want}（实际 ${r.project && r.project.tier}）`);
    r.clearTimer(); r.clearAiTimers();
  };
  force('hxPrism', 'prism');
  force('hxSilver', 'silver');
  force('hxGold', 'gold');
  // 极光之城：银/金/彩各一
  {
    const r = mkRoom(3);
    r.applyFacultySetup('hxMix');
    r.hexDoneRounds = []; r.hexTiers = [];
    const got = [];
    for (const rd of [2, 10, 20]) {
      r.round = rd; r.phase = 'roll';
      r.maybeProject();
      got.push(r.project.tier);
      r.project = null; r.phase = 'roll';
      r.clearTimer(); r.clearAiTimers();
    }
    ok(new Set(got).size === 3 && got.includes('silver') && got.includes('gold') && got.includes('prism'),
      `【极光之城】前三次档位 ${got.join('/')} = 银金彩各一`);
  }
  // 精研之城：只有 3 次
  {
    const r = mkRoom(3);
    r.applyFacultySetup('hex3');
    r.hexDoneRounds = []; r.hexTiers = [];
    ok(r.hexMaxCount === 3, '【精研之城】hexMaxCount = 3');
    for (const rd of [2, 10, 20]) { r.round = rd; r.phase = 'roll'; r.maybeProject(); r.project = null; r.phase = 'roll'; r.clearTimer(); r.clearAiTimers(); }
    r.round = 40; r.phase = 'roll';
    ok(r.maybeProject() === false, '第 4 次立项被取消（第 40 轮不再触发）');
  }
  // 时光之城：第 5 轮即触发
  {
    const r = mkRoom(3);
    r.applyFacultySetup('hexEarly');
    r.hexDoneRounds = []; r.hexTiers = [];
    r.round = 5; r.phase = 'roll';
    ok(r.maybeProject() === true, '【时光之城】第 5 轮触发立项');
    r.clearTimer(); r.clearAiTimers();
  }
  // 普通局不受影响
  {
    const r = mkRoom(3);
    r.round = 5; r.phase = 'roll';
    ok(r.maybeProject() === false, '普通局第 5 轮不触发（仍为 2/10/20/30/40/50）');
  }
}

// ================= [5] 首轮城邦加权 =================
section(5, '首轮推选加权：定调六城约 55%+ 概率进候选；换届轮绝不出现');
{
  const r = mkRoom(3);
  let hit = 0;
  const N = 60;
  for (let i = 0; i < N; i++) {
    r.phase = 'roll';
    r.openFacultyVote(1);
    if (r.facultyOptions.some(k => G.FACULTY[k].hexTheme)) hit++;
    r.clearTimer(); r.clearAiTimers();
  }
  ok(hit / N > 0.45, `定调城邦进候选率 ${hit}/${N}（预期约 64%，加权生效）`);
  r.phase = 'roll';
  r.openFacultyVote(11);
  ok(!r.facultyOptions.some(k => G.FACULTY[k].hexTheme), '第 2 届换届：定调六城不再出现（terms [1,1]）');
  r.clearTimer(); r.clearAiTimers();
}

// ================= [6] 新钩子抽查 =================
section(6, '新钩子：挂科保险 / 报税减免 / 赎回优惠 / 拍卖慧眼 / 收租固定加成与路费立减');
{
  // 挂科保险（gojail 格）
  {
    const r = mkRoom(2, { hex: true });
    const a = r.players[0];
    a.major = 'mech'; a.skillLeft = 0; a.hex = { jailFree: 2 }; a.cash = 20000;
    r.round = 3; r.dice = null; r.phase = 'roll';
    const jailIdx = G.BOARD.findIndex(c => c.type === 'gojail');
    a.pos = jailIdx;
    r.resolveCell(a);
    ok(a.hex.jailFree === 1 && !(a.skipTurns > 0), '挂科保险：免于留级（次数 2→1）');
    ok(r.log.some(l => l.msg.includes('挂科保险')), '播报挂科保险生效');
    r.clearTimer(); r.clearAiTimers();
  }
  // 报税减免
  {
    const r = mkRoom(2);
    const a = r.players[0];
    a.hex = { taxCut: 0.4 }; a.cash = 50000;
    const props = G.BOARD.map((c, i) => i).filter(i => G.BOARD[i].type === 'prop').slice(0, 8);
    for (const i of props) { r.cells[i].own = a.id; r.cells[i].level = 1; }
    const before = a.cash;
    r.collectTax();
    const paid = before - a.cash;
    ok(paid === 264, `物业税 (2×130+2×90)=440 → 40% 减免后 264（实际 ${paid}）`);
  }
  // 赎回优惠
  {
    const r = mkRoom(2);
    const a = r.players[0];
    const idx = G.BOARD.findIndex(c => c.type === 'prop');
    r.cells[idx].own = a.id; r.cells[idx].mortgaged = true; r.cells[idx].mortgageAt = r.round - 5;
    a.hex = { redeemCut: 0.10 }; a.cash = 50000;
    const mp0 = Math.floor(G.BOARD[idx].price / 2);
    const mp1 = mp0 - Math.round(mp0 * 0.10);
    const before = a.cash;
    r.redeem(a, idx);
    ok(before - a.cash === mp1 && !r.cells[idx].mortgaged, `赎回 ¥${mp0} → 优惠后 ¥${mp1}`);
  }
  // 拍卖慧眼
  {
    const r = mkRoom(2);
    const a = r.players[0];
    const idx = unownedProp(r);
    a.hex = { auctionCut: 0.10 }; a.cash = 50000;
    r.phase = 'auction';
    r.auction = { cell: idx, highest: 2000, bidder: a.id, endsAt: Date.now() + 1000, maxBid: {} };
    const before = a.cash;
    r.endAuction();
    ok(before - a.cash === 1800 && r.cells[idx].own === a.id, `拍卖成交 ¥2000 → 慧眼后 ¥1800`);
  }
  // 收租固定加成 + 路费立减
  {
    const r = mkRoom(2, { hex: false });
    const [a, b] = r.players;
    // 固定中性专业且无技能次数：join() 随机 major 会让护理 −35% / 环境 −15% 等被动混入租金结算（CI 上偶发）
    a.major = 'mech'; a.skillLeft = 0; b.major = 'mech'; b.skillLeft = 0;
    const idx = G.BOARD.findIndex(c => c.type === 'prop');
    r.cells[idx].own = b.id; r.cells[idx].level = 0; r.cells[idx].mortgaged = false;
    b.hex = { rentFlat: 80 }; a.hex = { tollFlat: 150 };
    const rent0 = r.calcRent(idx, [2, 5]);
    a.cash = 50000; b.cash = 50000;
    const ac0 = a.cash, bc0 = b.cash;
    r.round = 9; r.dice = [2, 5]; r.phase = 'roll';
    a.pos = idx;
    r.resolveCell(a);
    ok(b.cash - bc0 === rent0 + 80 - 150, `收租方：租金 ${rent0} + 固定 80 − 付方路费立减 150 = ${rent0 + 80 - 150}（实际 +${b.cash - bc0}）`);
    ok(ac0 - a.cash === rent0 + 80 - 150, `付租方：实付 ${rent0 + 80 - 150}（租金 + 收方固定 80 − 路费立减 150）`);
  }
}

// ================= [7] 新 once 类型 =================
section(7, '新 once：stayPack / fundCut / land2');
{
  const r = mkRoom(2);
  const a = r.players[0];
  a.medal = 0; a.stayFree = 0; a.hexList = [];
  r.grantProject(a, 'ticketx');
  ok(a.medal === 1 && a.stayFree === 1, '尾票福利：+1 免租金卡 +1 免停留卡');
  r.fundPool = 5000;
  const c0 = a.cash; a.hexList = a.hexList.filter(k => k !== 'fundseed');
  r.grantProject(a, 'fundseed');
  ok(a.cash - c0 === 600 && r.fundPool === 4400, `种子基金：从池提取 12%（5000→提 600，池 4400）`);
  a.hexList = a.hexList.filter(k => k !== 'goldenland');
  const own0 = r.cells.filter(cs => cs.own === a.id).length;
  r.grantProject(a, 'goldenland');
  const gain = r.cells.filter(cs => cs.own === a.id).length - own0;
  ok(gain >= 1 && gain <= 2, `御赐封地：占得 ${gain} 块无主地（无主地不足时按实际）`);
}

// ================= [8] 娱乐城邦每轮结算抽查 =================
section(8, '娱乐城邦每轮结算：灯会 / 期中周 / 名师 / 老生 / 新生');
{
  // 灯会：每轮全场 +150
  {
    const r = mkRoom(3);
    r.faculty = 'lantern';
    for (const q of r.players) q.cash = 10000;
    r.applyFacultyRound();
    ok(r.players.every(q => q.cash === 10150), '灯会校区：每轮开场全场 +¥150');
  }
  // 期中周：每 5 轮全场各缴 400 进池
  {
    const r = mkRoom(3);
    r.faculty = 'midterm'; r.round = 5;
    for (const q of r.players) q.cash = 10000;
    const pool0 = r.fundPool;
    r.applyFacultyRound();
    ok(r.players.every(q => q.cash === 9600) && r.fundPool === pool0 + 1200, '期中周校区：第 5 轮全场各缴 ¥400');
    r.round = 6; r.applyFacultyRound();
    ok(r.players.every(q => q.cash === 9600), '第 6 轮不再缴');
  }
  // 名师：每 3 轮随机 1 人免费盖房
  {
    const r = mkRoom(3);
    r.faculty = 'professor'; r.round = 3;
    const a = r.players[0];
    const idx = G.BOARD.findIndex(c => c.type === 'prop');
    r.cells[idx].own = a.id; r.cells[idx].level = 0;
    r.applyFacultyRound();
    const sum = r.players.reduce((s, q) => s + r.propCells(q).reduce((x, i) => x + r.cells[i].level, 0), 0);
    ok(sum === 1, `名师校区：第 3 轮随机 1 人免费盖 1 房（总建筑 ${sum}）`);
  }
  // 老生 / 新生一次性结算
  {
    const r = mkRoom(3);
    const a = r.players[0];
    a.medal = 0;
    r.applyFacultySetup('veteran');
    ok(r.players.every(q => q.medal >= 1), '老生校区：当选时全场各领 1 张免租金卡');
    for (const q of r.players) q.cash = 10000;
    r.applyFacultySetup('freshman');
    ok(r.players.every(q => q.cash === 11500), '新生校区：当选时全场各领 ¥1500');
  }
  // 早八 / 观星点数结算
  {
    const r = mkRoom(2);
    r.faculty = 'stampede';
    const a = r.players[0]; a.cash = 10000;
    r.facRollFx(a, 7, false);
    ok(a.cash === 10300, '早八校区：7 点 +¥300');
    r.facRollFx(a, 3, false);
    ok(a.cash === 10150, '早八校区：≤3 点 −¥150');
    r.faculty = 'observatory';
    r.facRollFx(a, 11, false);
    ok(a.cash === 10550, '观星校区：≥10 点 +¥400');
    r.faculty = 'runner';
    r.facRollFx(a, 4, true);
    ok(a.cash === 10800, '校车站校区：双数 +¥250');
  }
  // 地铁：机场便宜 / 驿站贵
  {
    const r = mkRoom(2);
    const tIdx = G.BOARD.findIndex(c => c.type === 'transport');
    r.cells[tIdx].own = r.players[1].id;
    r.faculty = null;
    const base = r.calcRent(tIdx, [2, 5]);
    r.faculty = 'metro';
    const m = r.calcRent(tIdx, [2, 5]);
    ok(Math.abs(m - Math.round(base * 0.85)) <= 1, `地铁校区：机场租金 ${base} → ${m}（×0.85）`);
  }
}

// ================= 结果 =================
console.log('\n========================================');
console.log(`  v5.10 引擎测试：${pass} 通过 / ${fail} 失败`);
console.log('========================================');
process.exit(fail ? 1 : 0);
