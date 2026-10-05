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
section(1, '城邦 60 / 海克斯 105 / 镜像一致 / 提前触发表');
{
  ok(G.FACULTY_KEYS.length === 60, `城邦共 ${G.FACULTY_KEYS.length} 个（预期 60 = 59 + 新增「拆迁校区」）`);
  const themes = G.FACULTY_KEYS.filter(k => G.FACULTY[k].hexTheme);
  ok(themes.length === 6 && themes.every(k => JSON.stringify(G.FACULTY[k].terms) === '[1,1]'),
    `海克斯定调六城 ${themes.join('/')}，terms 全为 [1,1]`);
  ok(!G.FACULTY_KEYS.slice(0, 23).some(k => G.FACULTY[k].hexTheme), '老 23 城无 hexTheme 标记');
  const cnt = { silver: 0, gold: 0, prism: 0 };
  for (const k in G.PROJECTS) cnt[G.PROJECTS[k].tier]++;
  const total = Object.keys(G.PROJECTS).length;
  ok(total === 105 && cnt.silver === 40 && cnt.gold === 35 && cnt.prism === 30,
    `海克斯共 ${total} 个（银 ${cnt.silver} / 金 ${cnt.gold} / 彩 ${cnt.prism}）`);
  ok(JSON.stringify(G.HEX_TRIGGERS_EARLY) === JSON.stringify([2, 6, 12, 19, 26, 33, 40, 47, 54, 61, 68, 75, 82, 88, 94]), 'HEX_TRIGGERS_EARLY v7.1 = 2/6/12/19/26/33/40/47/54/61/68/75/82/88/94（15 次全部提前）');
  // 客户端镜像逐字一致
  const game = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  const cli = fs.readFileSync(path.join(__dirname, 'public/client.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, 'public/style.css'), 'utf8');
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
  ok(G.HEX_PICK_MS === 70000 && G.FACULTY_VOTE_MS === 60000, `时长：海克斯 ${G.HEX_PICK_MS / 1000}s / 投票 ${G.FACULTY_VOTE_MS / 1000}s（v5.12）`);
  // v5.12：client 镜像同步 + 横屏模块 + 性能节流点存在
  ok(/FACULTY_VOTE_MS = 60000/.test(cli), 'client 投票时长镜像 60s');
  ok(/HEX_PICK_MS \|\| 70000/.test(cli), 'client 海克斯时长兜底 70s');
  ok(/mobileLandscape/.test(cli) && /body\.rotmode/.test(css) && /qN\(74\)/.test(cli) && /ts - lobbyLast < 33/.test(cli) && /ts - wxLast < 33/.test(cli), '横屏模块 / rotmode 样式 / 30fps 节流 / 粒子减量齐备');
  // v5.14：横屏只在 #game 屏生效（大厅 / 创房 / 公告一律竖屏）
  ok(/getElementById\('game'\)/.test(cli) && /inGame = \(\) => gameScr\.style\.display === 'flex'/.test(cli)
    && /MutationObserver\(fit\)\.observe\(gameScr/.test(cli), 'v5.14 横屏仅在对局屏（#game）启用，并监听屏幕切换');
  ok(!/tryLock/.test(cli) && /unlockLandscape/.test(cli), 'v5.14 去掉全局 pointerdown 强制锁横屏，改为进/出对局时锁定/解锁');
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
    for (const rd of [2, 16, 25]) {
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
    for (const rd of [2, 16, 25]) { r.round = rd; r.phase = 'roll'; r.maybeProject(); r.project = null; r.phase = 'roll'; r.clearTimer(); r.clearAiTimers(); }
    r.round = 40; r.phase = 'roll';
    ok(r.maybeProject() === false, '第 4 次立项被取消（第 40 轮不再触发）');
  }
  // v7.1 时光之城：15 次立项全部提前（第 6 轮即第二次立项；常规表要等到第 8 轮）
  {
    const r = mkRoom(3);
    r.applyFacultySetup('hexEarly');
    r.hexDoneRounds = []; r.hexTiers = [];
    r.round = 6; r.phase = 'roll';
    ok(r.maybeProject() === true, '【时光之城】第 6 轮触发立项（早于常规的第 8 轮）');
    r.clearTimer(); r.clearAiTimers();
    // 逐项校验：15 次提前轮次都严格早于常规表（首轮同为第 2 轮，游戏从第 1 轮开始无法更早）
    ok(G.HEX_TRIGGERS_EARLY.every((v, i) => i === 0 ? v === G.HEX_TRIGGERS[0] : v < G.HEX_TRIGGERS[i]),
      '提前表 15 项逐项早于常规表（第 1 次同为第 2 轮）');
    ok(G.HEX_TRIGGERS_EARLY.every((v, i, a) => i === 0 || v > a[i - 1]), '提前表严格递增');
  }
  // 普通局不受影响
  {
    const r = mkRoom(3);
    r.round = 5; r.phase = 'roll';
    ok(r.maybeProject() === false, '普通局第 5 轮不触发（v7.0 触发轮：2/8/16/25/32/40/49/55/62/70/77/85/91/100/110）');
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
    ok(paid === 234, `物业税 8 栋 ×¥130 = 390 → 40% 减免后 234（实际 ${paid}）`);
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
  ok(a.cash - c0 === 550 && r.fundPool === 4450, `种子基金：从池提取 11%（5000→提 550，池 4450）`);
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
    ok(r.players.every(q => q.cash === 10300), '灯会校区：每轮开场全场 +¥300（v7.2 温和）');
  }
  // 期中周：每 5 轮全场各缴 400 进池
  {
    const r = mkRoom(3);
    r.faculty = 'midterm'; r.round = 5;
    for (const q of r.players) q.cash = 10000;
    const pool0 = r.fundPool;
    r.applyFacultyRound();
    ok(r.players.every(q => q.cash === 9480) && r.fundPool === pool0 + 1560, '期中周校区：第 5 轮全场各缴 ¥520');
    r.round = 6; r.applyFacultyRound();
    ok(r.players.every(q => q.cash === 9480), '第 6 轮不再缴');
  }
  // 名师：每 3 轮随机 1 人免费盖房
  {
    const r = mkRoom(3);
    r.faculty = 'professor'; r.round = 2;
    const a = r.players[0];
    const idx = G.BOARD.findIndex(c => c.type === 'prop');
    r.cells[idx].own = a.id; r.cells[idx].level = 0;
    r.applyFacultyRound();
    const sum = r.players.reduce((s, q) => s + r.propCells(q).reduce((x, i) => x + r.cells[i].level, 0), 0);
    ok(sum === 1, `名师校区：第 2 轮随机 1 人免费盖 1 房（总建筑 ${sum}）`);
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
    ok(r.players.every(q => q.cash === 12400), '新生校区：当选时全场各领 ¥2400（v7.2 温和）');
  }
  // 早八 / 观星点数结算
  {
    const r = mkRoom(2);
    r.faculty = 'stampede';
    const a = r.players[0]; a.cash = 10000;
    r.facRollFx(a, 7, false);
    ok(a.cash === 10750, '早八校区：7 点 +¥750（v7.2 激进）');
    r.facRollFx(a, 3, false);
    ok(a.cash === 10350, '早八校区：≤3 点 −¥400（v7.2 激进）');
    r.faculty = 'observatory';
    r.facRollFx(a, 11, false);
    ok(a.cash === 11150, '观星校区：≥10 点 +¥800（v7.2 温和）');
    r.faculty = 'runner';
    r.facRollFx(a, 4, true);
    ok(a.cash === 11550, '校车站校区：双数 +¥400');
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
    ok(Math.abs(m - Math.round(base * 0.70)) <= 1, `地铁校区：机场租金 ${base} → ${m}（×0.70，v7.2 温和）`);
  }
}

// ================= [9] v5.11：换届触发修复 / 每次立项刷新 / 概率 40/30/30 / 数值削弱 =================
section(9, 'v5.11：换届只在轮次刚开始触发 / 每次立项都有刷新 / 概率与削弱（数值随 v5.14 同步）');
{
  // ① 第 1 轮：玩家回合结束不再触发换届（开局已选过）
  const r1 = mkRoom(2);
  r1.round = 1; r1.cur = 1; r1.phase = 'roll';
  r1.endTurn(); r1.clearTimer(); r1.clearAiTimers();
  ok(r1.phase !== 'faculty' && r1.round === 2, '① 第 1 轮玩家回合结束不触发换届（v5.11 修复）');

  // ② 第 11 轮刚开始（round 10 → 11 的轮转瞬间）触发一次
  const r2 = mkRoom(2);
  r2.round = 10; r2.cur = 1; r2.phase = 'roll';
  r2.endTurn();
  ok(r2.phase === 'faculty' && r2.facTermStart === 11 && r2.round === 11,
    '② 第 11 轮刚开始触发换届投票（facTermStart=11）');
  r2.clearTimer(); r2.clearAiTimers();

  // ③ 第 11 轮内其余玩家回合结束不再重复触发
  const r3 = mkRoom(2);
  r3.round = 11; r3.cur = 0; r3.phase = 'roll';
  r3.endTurn(); r3.clearTimer(); r3.clearAiTimers();
  ok(r3.phase !== 'faculty', '③ 第 11 轮内玩家回合结束不再重复触发');

  // ④ 每次立项三选一都重置刷新机会（原 v5.10 为整局一次）
  const r4 = mkRoom(2);
  r4.players[0].hexRefreshLeft = 0; r4.players[1].hexRefreshLeft = 0;
  r4.hexDoneRounds = []; r4.round = 16; r4.phase = 'roll';
  const opened = r4.maybeProject();
  r4.clearTimer(); r4.clearAiTimers();
  ok(opened && r4.players.every(p => p.hexRefreshLeft === 1),
    '④ 立项开启时全员刷新机会重置为 1（每次立项一次）');

  // ⑤ v6.0：所有立项统一一行概率（不再按「第几次」分档）
  ok(G.HEX_TIER_P.length === 1 && G.HEX_TIER_P[0][0] === 0.43 && G.HEX_TIER_P[0][1] === 0.32 && G.HEX_TIER_P[0][2] === 0.25,
    '⑤ v6.0：所有立项统一 银 43 / 金 32 / 彩 25');

  // ⑥ 全局削弱抽查
  ok(G.PROJECTS.seize.pct === 0.12 && G.PROJECTS.seize.amt === 3600, '⑥ v6.0 彩卡增强：强取豪夺 12%/3600');
  ok(G.PROJECTS.stipend.mods.goCash === 320, '⑥ 勤工俭学 320（v5.14 合约补偿）');
  ok(G.PROJECTS.nirvana.mods.nirvanaCash === 6000 && G.PROJECTS.phoenix2.mods.nirvanaCash === 5200,
    '⑥ v6.0：涅槃 6000 / 浴火重生 5200（复活金额入表）');
  ok(G.MAJORS.mech.desc.includes('+¥1350'), '⑥ 机械 精益制造 1350');
  ok(G.MAJORS.agri.desc.includes('+¥1350') && G.MAJORS.ee.desc.includes('+¥1250'), '⑥ 农学 1350 / 微电子 1250');

  // ⑦ MAJORS 双镜像仍逐字一致
  const game2 = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  const cli2 = fs.readFileSync(path.join(__dirname, 'public/client.js'), 'utf8');
  const span2 = (src, a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
  // ⑦ MAJORS 双镜像数值一致（client 为压缩显示版，校验 desc 中 ¥/％ 数值集合一致）
  const majSpan = src => { const i = src.indexOf('const MAJORS = {'); return src.slice(i, src.indexOf('\n};', i)); };
  const descsOf = (src, compact) => {
    const out = {};
    const re = compact ? /(\w+):\s*\{[^}]*?desc:'([^']*)'/g : /(\w+):\s*\{[^{}]*?desc:\s*'([^']*)'/g;
    let m; while ((m = re.exec(src))) out[m[1]] = m[2];
    return out;
  };
  const gd = descsOf(majSpan(game2), false), cd = descsOf(majSpan(cli2), true);
  const nums = s => (s.match(/¥\d+|\d+(?:\.\d+)?%/g) || []).sort().join(',');
  const bad = Object.keys(gd).filter(k => cd[k] === undefined || nums(gd[k]) !== nums(cd[k]));
  ok(Object.keys(gd).length === 60 && Object.keys(cd).length === 60 && bad.length === 0,
    `⑦ MAJORS 镜像 60 个专业 desc 数值一致${bad.length ? '，不一致：' + bad.join('/') : ''}`);
}

// ================= [10] v5.13：海克斯平衡（限次机制 / 降彩升银 / 描述校准） =================
section(10, 'v5.13：海克斯限次（合约期）/ 抽取降彩升银 / 描述校准（v5.14 追加再平衡）');
{
  // ① 六次概率全面「降彩升银」且各行归一
  const P = G.HEX_TIER_P;
  ok(P.length === 1 && P.every(r => Math.abs(r[0] + r[1] + r[2] - 1) < 1e-9), '① v6.0：统一一行概率且归一');
  ok(P[0][0] === 0.43 && P[0][1] === 0.32 && P[0][2] === 0.25, '① 概率表 = 银 43 / 金 32 / 彩 25（全时段一致）');
  ok(P[0][0] > P[0][1] && P[0][1] > P[0][2], '① 银 > 金 > 彩（校级仍为单次最大盘）');

  // ② charges 字段：34 个项目带合约期，desc 与 charges 一并写入
  const charged = Object.keys(G.PROJECTS).filter(k => G.PROJECTS[k].charges);
  const cntTier = t => charged.filter(k => G.PROJECTS[k].tier === t).length;
  ok(charged.length === 34 && cntTier('silver') === 11 && cntTier('gold') === 6 && cntTier('prism') === 17,
    `② 34 个项目带合约期（银 ${cntTier('silver')} / 金 ${cntTier('gold')} / 彩 ${cntTier('prism')}）`);
  ok(charged.every(k => G.PROJECTS[k].charges > 0 && /限 \d+ (轮|次)/.test(G.PROJECTS[k].desc)),
    '② 每个限次项目 desc 都写明「限 N 轮/次」');

  // ③ 每轮类限次：allowance 12 轮后 turnCash 被移除
  const r = mkRoom(2); const a = r.players[0];
  r.grantProject(a, 'allowance');
  ok(a.hexLeft.allowance === 16 && a.hex.turnCash === 250, '③ 立项登记 16 轮合约 + turnCash 250（v5.14 合约延长）');
  const cashBefore = a.cash;
  for (let i = 0; i < 16; i++) r.applyHexPassives(a);
  ok(a.hexLeft.allowance === 0 && a.hex.turnCash === undefined, '③ 满 16 轮后合约到期，turnCash 修正被移除');
  ok(a.cash >= cashBefore, '③ 合约到期按档位发放结项经费（现金不回退）');

  // ④ 收费站 / 车水马龙 按次计
  const t = mkRoom(2); const tb = t.players[0];
  t.grantProject(tb, 'tollbooth');
  ok(tb.hexLeft.tollbooth === 12 && tb.hex.tollBooth === 260 && tb.hex.tollBoothCap === 880,
    '④ 收费站 12 次 + tollBooth 260（v6.0 封顶 880）');
  for (let i = 0; i < 12; i++) t.hexSpend(tb, t.hexKeyWith(tb, 'tollBooth'));
  ok(tb.hex.tollBooth === undefined && t.hexKeyWith(tb, 'tollBooth') === null, '④ 收费站 12 次收完即止');
  const tk = mkRoom(2); const tc = tk.players[0]; tk.grantProject(tc, 'tollking');
  ok(tc.hexLeft.tollking === 12 && tc.hex.tollBooth === 390 && tc.hex.tollBoothCap === 1180 && tc.hex.rentFlat === 120,
    '④ v6.0 车水马龙 12 次 + 390/1180 + 收租 +120');

  // ⑤ floor 取最大值聚合 + 到期重算
  const f = mkRoom(2); const fp = f.players[0];
  const fc0 = fp.cash;
  f.grantProject(fp, 'safety'); f.grantProject(fp, 'megafloor');
  f.recomputeMaxMods(fp);
  ok(fp.hex.floor === 3400, '⑤ 同时持有兜底：floor 取最大 3400（非相加，v6.0 提线）');
  for (let i = 0; i < 16; i++) f.hexSpend(fp, 'megafloor');
  ok(fp.hex.floor === 2400, '⑤ 终身兜底到期后 floor 回落 2400（风险兜底线）');
  ok(fp.cash - fc0 === G.EXPIRY_STIPEND.prism, `⑤ 终身兜底（彩）到期发结项经费 ¥${G.EXPIRY_STIPEND.prism}`);
  for (let i = 0; i < 16; i++) f.hexSpend(fp, 'safety');
  ok(fp.hex.floor === undefined, '⑤ 风险兜底也到期后 floor 消失');
  ok(fp.cash - fc0 === G.EXPIRY_STIPEND.prism * 2,
    `⑤ 两张彩级合约到期各发结项经费（¥${G.EXPIRY_STIPEND.prism} × 2 = ¥${fp.cash - fc0}）`);
  // 金级项目到期发金级结项经费
  const gc = mkRoom(2); const gp = gc.players[0];
  gc.grantProject(gp, 'grants');
  const gc0 = gp.cash;
  for (let i = 0; i < 14; i++) gc.applyHexPassives(gp);
  ok(gp.hexLeft.grants === 0 && gp.cash - gc0 === 480 * 14 + G.EXPIRY_STIPEND.gold,
    `⑤ 金级「科研津贴」14 轮到期：14×¥480 + 结项经费 ¥${G.EXPIRY_STIPEND.gold}`);

  // ⑥ 描述校准 + 数值微调
  ok(!/补到 ¥1650/.test(G.PROJECTS.safety.desc) && G.PROJECTS.safety.desc.includes('¥2400')
    && G.PROJECTS.megafloor.desc.includes('¥3400'),
    '⑥ v6.0：风险兜底 / 终身兜底描述与实际一致（¥2400 / ¥3400）');
  ok(G.PROJECTS.usedbook.amt === 700 && G.PROJECTS.buildcash.mods.buildCash === 160 && G.PROJECTS.buycash.mods.buyCash === 140,
    '⑥ 二手书摊 700 / 盖房返现 160 / 拿地返现 140');
  ok(G.PROJECTS.talisman.charges === 5 && G.PROJECTS.talisman.mods.shieldCut === 0.30, '⑥ v6.0：平安符改为免罚符 7 折、限 5 轮');
  ok(G.PROJECTS.tollbooth.mods.tollBoothCap === 880 && /¥880/.test(G.PROJECTS.tollbooth.desc)
    && G.PROJECTS.dividends.mods.fundKickCap === 450 && /¥450/.test(G.PROJECTS.dividends.desc),
    '⑥ v6.0：收费站 880 / 基金抽成 450 封顶，描述与结算一致');

  // ⑦ 双镜像（含 charges）逐字一致
  const g3 = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  const c3 = fs.readFileSync(path.join(__dirname, 'public/client.js'), 'utf8');
  const sp3 = (src, a2, b2) => src.slice(src.indexOf(a2), src.indexOf(b2, src.indexOf(a2)));
  ok(sp3(g3, 'const PROJECTS = {', 'const PROJECT_KEYS = {') === sp3(c3, 'const PROJECTS = {', 'const PROJECT_KEYS = {'),
    '⑦ PROJECTS 双镜像（含 charges）逐字一致');

  // ⑧ 快照暴露 hexLeft
  const srv = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  ok(/hexLeft/.test(srv), '⑧ server 快照暴露 hexLeft');
}

// ================= [11] v5.14：合约再平衡（数值 + 机制）/ 彩卡上调 / 第 32 轮 / 竖屏与公告 =================
section(11, 'v5.14：海克斯合约再平衡（数值 + 机制）/ 彩卡上调 / 第 32 轮第四次 / 手机竖屏与公告常驻按钮');
{
  // ① 触发轮改为 v7.0 的 15 次表
  ok(JSON.stringify(G.HEX_TRIGGERS) === JSON.stringify([2, 8, 16, 25, 32, 40, 49, 55, 62, 70, 77, 85, 91, 100, 110]),
    '① v7.0 触发轮 = 2/8/16/25/32/40/49/55/62/70/77/85/91/100/110（共 15 次）');
  const rr = mkRoom(2);
  rr.round = 30; rr.hexDoneRounds = [];
  rr.phase = 'roll'; rr.project = null; rr.clearTimer(); rr.clearAiTimers();
  ok(rr.maybeProject() === false, '① 第 30 轮不再开启三选一');
  rr.round = 32; rr.hexDoneRounds = []; rr.phase = 'roll'; rr.project = null;
  ok(rr.maybeProject() === true, '① 第 32 轮正常开启三选一');
  rr.clearTimer(); rr.clearAiTimers();

  // ② 「每轮生效型」合约一律 ≥12 轮（原先最短 8 轮，中盘就断供）
  const ROUND_MODS = ['turnCash', 'poorCash', 'noLandCash', 'interestPct', 'weatherCash', 'sunCash', 'landmark', 'legacy', 'floor', 'shieldEach', 'freeReroll'];
  const roundType = Object.keys(G.PROJECTS).filter(k => {
    const m = G.PROJECTS[k].mods || {};
    return G.PROJECTS[k].charges && ROUND_MODS.some(mk => m[mk] !== undefined);
  });
  const shortRound = roundType.filter(k => G.PROJECTS[k].charges < 12);
  ok(roundType.length >= 24 && shortRound.length === 0,
    `② 每轮生效型限次项目 ${roundType.length} 个，合约全部 ≥12 轮${shortRound.length ? '（过短：' + shortRound.join('/') + '）' : ''}`);

  // ③ 「事件触发型」（过起点 / 过路费 / 收租加成 / 基金抽成）合约 ≥12 次
  const evType = Object.keys(G.PROJECTS).filter(k => {
    const m = G.PROJECTS[k].mods || {};
    return G.PROJECTS[k].charges && ['goCash', 'tollBooth', 'rentFlat', 'fundKick'].some(mk => m[mk] !== undefined);
  });
  ok(evType.length >= 6 && evType.every(k => G.PROJECTS[k].charges >= 12),
    `③ 事件触发型限次项目 ${evType.length} 个（${evType.join('/')}）合约全部 ≥12 次`);

  // ④ 每张限次卡的 desc 里的「限 N 轮/次」必须与 charges 数字一致（防止改数值忘改描述）
  const mismatch = [];
  for (const k of Object.keys(G.PROJECTS)) {
    const pr = G.PROJECTS[k];
    if (!pr.charges) continue;
    const m = /限 (\d+) (轮|次)/.exec(pr.desc);
    if (!m || Number(m[1]) !== pr.charges) mismatch.push(k + '(表 ' + pr.charges + ' / 描述 ' + (m ? m[1] : '—') + ')');
  }
  ok(mismatch.length === 0, `④ 33+ 张限次卡「限 N 轮/次」描述与 charges 一一对应${mismatch.length ? '（不符：' + mismatch.join('，') + '）' : ''}`);

  // ⑤ 结项经费机制：到期按档位返还，且成功入账
  ok(G.EXPIRY_STIPEND.silver === 300 && G.EXPIRY_STIPEND.gold === 650 && G.EXPIRY_STIPEND.prism === 1300,
    '⑤ 结项经费常量：银 300 / 金 650 / 彩 1300');
  const se = mkRoom(2); const pe = se.players[0];
  se.grantProject(pe, 'waterfree');          // 银：turnCash 185，16 轮
  const c0 = pe.cash;
  for (let i = 0; i < 16; i++) se.applyHexPassives(pe);
  // 逐轮 16 次给过 185（约 2960）+ 结项经费 300，扣除无关技能波动只看「至少拿到结项经费」
  ok(pe.hexLeft.waterfree === 0 && pe.hex.turnCash === undefined && pe.cash - c0 >= 300 + 185 * 16 * 0.9,
    `⑤ 免费开水 16 轮到期 + 结项经费入账（净增 ¥${pe.cash - c0}）`);
  const se2 = mkRoom(2); const pe2 = se2.players[0];
  const evs = [];
  se2.ev = (e) => { evs.push(e); };
  se2.grantProject(pe2, 'headstart');        // 彩：turnCash 640，12 轮
  for (let i = 0; i < 12; i++) se2.applyHexPassives(pe2);
  const expEv = evs.find(e => e.t === 'hex_expire');
  ok(expEv && expEv.key === 'headstart' && expEv.stipend === 1300, '⑤ hex_expire 事件带上 stipend=1300（供前端播报）');

  // ⑥ 双倍工资不再是一张「停薪后即死」的卡
  ok(G.PROJECTS.salaryx2.mods.salaryX2 === 1 && G.PROJECTS.salaryx2.mods.goCash === 800 && G.PROJECTS.salaryx2.charges === 12,
    '⑥ v6.0：双倍工资 = 工资 ×2 + 过起点 +¥800（限 12 次）');
  const wd = mkRoom(2, { hex: true });
  wd.round = 25; wd.hexDoneRounds = [];   // 25 轮在 v7.0 触发表内，且已在停薪线（15 轮）之后
  wd.maybeProject(); wd.clearTimer(); wd.clearAiTimers();
  const offs = Object.values(wd.project.offers).flat();
  ok(!offs.includes('salaryx2'), `⑥ 停薪后候选池不含双倍工资（含 goCash 会被剔除），共 ${offs.length} 张`);

  // ⑦ 前端：限次剩余量展示 + 到期提示
  const cli2 = fs.readFileSync(path.join(__dirname, 'public', 'client.js'), 'utf8');
  const css2 = fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf8');
  ok(/hxp-left/.test(cli2) && /near-end/.test(cli2) && /hxp-chip\.near-end/.test(css2),
    '⑦ 查看面板显示合约剩余量，临近到期高亮');
  ok(/e\.stipend/.test(cli2) && /结项经费/.test(cli2), '⑦ 合约到期播报展示结项经费金额');

  // ⑧ 公告「下一步」常驻：内容区滚动、按钮在滚动容器之外
  const html2 = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  ok((html2.match(/<div class="intro-scroll">/g) || []).length === 2, '⑧ 作者公告 + 版本更新公告各有一个滚动内容区');
  const iCard = html2.slice(html2.indexOf('<div class="announce-card intro-card">'), html2.indexOf('<button id="btnIntro"'));
  const opens = (iCard.match(/<div\b/g) || []).length, closes = (iCard.match(/<\/div>/g) || []).length;
  // 卡片自身的 <div class="announce-card intro-card"> 尚未闭合，故应恰好差 1 个 —— 说明按钮仍在滚动区之外
  ok(opens === closes + 1, `⑧ #intro 卡片内标签闭合正确（${opens} 开 / ${closes} 闭，卡片自身待闭）——按钮位于滚动区之外`);
  ok(/\.intro-scroll \{ flex:1 1 auto; min-height:0; overflow-y:auto/.test(css2.replace(/\s+/g, ' ')),
    '⑧ .intro-scroll 为独立滚动区（flex:1 + overflow-y:auto）');

  // ⑨ 手机横屏只在对局内
  ok(/inGame = \(\) => gameScr\.style\.display === 'flex'/.test(cli2)
    && /MutationObserver\(fit\)\.observe\(gameScr, \{ attributes: true, attributeFilter: \['style'\] \}\)/.test(cli2),
    '⑨ 横屏判定绑定 #game 屏可见性，并在屏幕切换时重算');
  const li = cli2.indexOf('function mobileLandscape');
  const lj = cli2.indexOf('unlockLandscape');
  ok(li > 0 && lj > li && !/pointerdown/.test(cli2.slice(li, li + 3000)), '⑨ 不再在任意点击时强制锁横屏（点大厅按钮不会被转走）');

  // ⑩ 双镜像仍逐字一致
  const g4 = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  const sp4 = (src, a2, b2) => src.slice(src.indexOf(a2), src.indexOf(b2, src.indexOf(a2)));
  ok(sp4(g4, 'const PROJECTS = {', 'const PROJECT_KEYS = {') === sp4(cli2, 'const PROJECTS = {', 'const PROJECT_KEYS = {'),
    '⑩ PROJECTS 双镜像（v5.14 数值）逐字一致');
}

// ================= 结果 =================
console.log('\n========================================');
console.log(`  v5.10 引擎测试：${pass} 通过 / ${fail} 失败`);
console.log('========================================');
process.exit(fail ? 1 : 0);
