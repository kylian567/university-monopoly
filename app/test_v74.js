#!/usr/bin/env node
// v7.4 单测：海克斯大规模扩池（105 → 152）+ 立项次数 15 → 12 + 合约制扩张 + 新机制接线
//   [1] 卡池 152（银 56 / 金 51 / 彩 45）/ 触发轮 12 次 / 提前表 12 次 / 双镜像
//   [2] 新增 mods 键的数据面与读取点齐备
//   [3] 每轮型新卡：阶梯津贴 / 长线投资 / 终身教职 / 万能卡补给 / 午夜赌局 / 梭哈一把 / 绝地反击 / 学术侦探
//   [4] 事件型新卡：晨跑打卡 / 通勤补助 / 反向护盾 / 盲盒达人 / 连击大师 / 精准收租 / 税务筹划 / 抗衰减护盾
//   [5] once: hexcopy（学术镜像）
//   [6] hexSpendMods：同一张卡一次结算最多扣 1 点
//   [7] 强度护栏：单张卡硬顶 amount × charges 不超标
'use strict';
const fs = require('fs');
const path = require('path');
const G = require('./game');

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.error('  ✗ ' + name); } };
const section = (n, t) => console.log(`\n[${n}] ${t}`);

function mkRoom(n = 3, opts) {
  const room = new G.Room('v74' + Math.floor(Math.random() * 1e6), Object.assign({ hex: true, faculty: true, draft: true }, opts || {}));
  for (let i = 0; i < n; i++) room.join('P' + (i + 1), i > 0);
  room.start(); room.clearTimer(); room.clearAiTimers();
  room.phase = 'roll';
  return room;
}
const withRandom = (v, fn) => { const o = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = o; } };

// ================= [1] 卡池 / 触发轮 / 镜像 =================
section(1, 'v7.4：卡池 152（银 56 / 金 51 / 彩 45）· 触发轮 12 次 · 提前表 12 次 · 双镜像');
{
  const cnt = { silver: 0, gold: 0, prism: 0 };
  for (const k in G.PROJECTS) cnt[G.PROJECTS[k].tier]++;
  const total = Object.keys(G.PROJECTS).length;
  ok(total === 152 && cnt.silver === 56 && cnt.gold === 51 && cnt.prism === 45,
    `海克斯共 ${total} 个（银 ${cnt.silver} / 金 ${cnt.gold} / 彩 ${cnt.prism}）`);
  ok(G.PROJECT_KEYS.silver.length === 56 && G.PROJECT_KEYS.gold.length === 51 && G.PROJECT_KEYS.prism.length === 45,
    'PROJECT_KEYS 三档分组与 tier 一致');
  ok(JSON.stringify(G.HEX_TRIGGERS) === JSON.stringify([2, 8, 15, 23, 32, 40, 50, 62, 74, 86, 98, 110]),
    '触发轮 12 次 = 2/8/15/23/32/40/50/62/74/86/98/110');
  ok(G.HEX_TRIGGERS.length === 12 && G.HEX_TRIGGERS.every((v, i, a) => i === 0 || v > a[i - 1]), '触发轮严格递增且共 12 次');
  ok(JSON.stringify(G.HEX_TRIGGERS_EARLY) === JSON.stringify([2, 6, 12, 19, 27, 35, 44, 54, 65, 77, 89, 101]),
    '时光之城提前表 12 次 = 2/6/12/19/27/35/44/54/65/77/89/101');
  ok(G.HEX_TRIGGERS_EARLY.every((v, i) => i === 0 ? v === G.HEX_TRIGGERS[0] : v < G.HEX_TRIGGERS[i]),
    '提前表 12 项逐项早于常规表（第 1 次同为第 2 轮）');

  // 所有卡必须有完整字段且 key 唯一
  let shapeOK = true;
  const seen = new Set();
  for (const k in G.PROJECTS) {
    const pr = G.PROJECTS[k];
    if (!pr.tier || !pr.icon || !pr.name || !pr.desc || seen.has(pr.name)) shapeOK = false;
    seen.add(pr.name);
  }
  ok(shapeOK, '152 张卡 tier/icon/name/desc 齐备且名称唯一');

  // 双镜像逐字一致
  const g = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  const c = fs.readFileSync(path.join(__dirname, 'public', 'client.js'), 'utf8');
  const sp = (src, a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
  ok(sp(g, 'const PROJECTS = {', 'const PROJECT_KEYS = {') === sp(c, 'const PROJECTS = {', 'const PROJECT_KEYS = {'),
    'PROJECTS 双镜像（含 47 张新卡）逐字一致');

  // 限次卡 desc 与 charges 一一对应
  const mismatch = [];
  for (const k of Object.keys(G.PROJECTS)) {
    const pr = G.PROJECTS[k];
    if (!pr.charges) continue;
    const m = /限 (\d+) (轮|次)/.exec(pr.desc);
    if (!m || Number(m[1]) !== pr.charges) mismatch.push(k);
  }
  ok(mismatch.length === 0, `限次卡「限 N 轮/次」描述与 charges 全部对应${mismatch.length ? '（不符：' + mismatch.join('，') + '）' : ''}`);

  // 新卡存在性抽查
  const NEW47 = ['tahelp', 'sevenrun', 'commute', 'boxer', 'couponback', 'landlord', 'sparestax', 'nightguard', 'expressline',
    'scooter', 'handout', 'coinbox', 'bulkbuy', 'toolbox', 'raincoat', 'brightside',
    'ladderpay', 'longterm', 'detective', 'comeback', 'allin', 'coinflip', 'cramnight', 'coinvest', 'alleyboss',
    'combomaster', 'marknote', 'sniperent', 'taxplan', 'ticketpack', 'sponsor2', 'refund2',
    'tenured', 'rentcompound', 'decayguard', 'jokersupply', 'reflectshield', 'negotiator', 'mortgage80', 'estateking',
    'mirrorhex', 'secondwind', 'windfall', 'hegemony', 'cardstorm', 'usury', 'alumninet2'];
  ok(NEW47.length === 47 && NEW47.every(k => !!G.PROJECTS[k]), `v7.4 新增 47 张卡全部在册（实际命中 ${NEW47.filter(k => G.PROJECTS[k]).length}）`);
}

// ================= [2] 新 mods 键与读取点 =================
section(2, 'v7.4 新增 mods 键：数据面写入 + 引擎读取点齐备');
{
  const NEWKEYS = ['sevenCash', 'payRentCash', 'cardBonus', 'growCash', 'cycleCash', 'richDrain', 'comeback', 'roundPay',
    'coinCash', 'comboUp', 'rentDoublePct', 'taxLevelCut', 'lateBloom', 'decayCut', 'jokerEvery', 'rentReflect'];
  const used = {};
  for (const k in G.PROJECTS) for (const m in (G.PROJECTS[k].mods || {})) used[m] = (used[m] || 0) + 1;
  const miss = NEWKEYS.filter(k => !used[k]);
  ok(miss.length === 0, `16 个新键均已在 PROJECTS 中被使用${miss.length ? '（缺：' + miss.join('/') + '）' : ''}`);

  const src = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  const bodyStart = src.indexOf('const PROJECT_KEYS = {');
  const code = src.slice(bodyStart);
  const noRead = NEWKEYS.filter(k => !new RegExp('hx\\.' + k + '|hex\\.' + k + '|\\\'' + k + '\\\'').test(code));
  ok(noRead.length === 0, `16 个新键在 PROJECT_KEYS 之后都有读取/消耗点${noRead.length ? '（缺：' + noRead.join('/') + '）' : ''}`);

  // ROUND_MODS / 自定义消耗表位置正确
  ok(/const ROUND_MODS = \[[\s\S]*?'growCash'[\s\S]*?'taxCut'\]/.test(src), 'ROUND_MODS 已纳入 v7.4 每轮型键（growCash…taxCut）');
  ok(/const CUSTOM_MODS = \['cycleCash', 'lateBloom', 'jokerEvery'\]/.test(src), 'CUSTOM_MODS 把周期型键排除在逐轮消耗之外');
  ok(/hexSpendMods\(p, mods\) \{/.test(src) && /for \(const key of \(p\.hexList \|\| \[\]\)\)/.test(src),
    'hexSpendMods(p, mods) 批量消耗辅助方法存在');
  ok(/hexSpendMods\(p, \['lowRollCash', 'highRollCash', 'doubleCash', 'sevenCash'\]\)/.test(src),
    '点数类津贴（含 sevenCash）在 doRoll 内统一消耗');
  ok(/hexSpendMods\(owner, \['rentGainPct', 'rentFlat'\]\)/.test(src) && /hexSpendMods\(owner, \['rentDoublePct'\]\)/.test(src),
    '收租加成与精准收租在收租结算点消耗');
  ok(/hexSpendMods\(p, \['rentReflect'\]\)/.test(src) && /hexSpendMods\(p, \['payRentCash'\]\)/.test(src),
    '反向护盾 / 通勤补助在被收租结算点消耗');
  ok(/hexSpendMods\(p, \['cardBonus'\]\)/.test(src) && /hexSpendMods\(p, \['cashbackPct'\]\)/.test(src),
    '盲盒达人 / 快递返点在开盒与付款点消耗');
  ok(/hexSpendMods\(p, \['buyCut'\]\)/.test(src) && /hexSpendMods\(p, \['buildCut'\]\)/.test(src),
    '限次买地 / 盖房折扣在对应结算点消耗');
  ok(/once !== 'hexcopy'/.test(src) && /case 'hexcopy':/.test(src), '学术镜像（once: hexcopy）已实现并排除自复制');
}

// ================= [3] 每轮型新卡 =================
section(3, '每轮 / 周期型新卡：阶梯津贴 / 长线投资 / 终身教职 / 万能卡补给 / 午夜赌局 / 梭哈 / 绝地反击 / 学术侦探');
{
  // 阶梯津贴：每轮 +200，每 6 轮 +40，上限 400
  {
    const r = mkRoom(2, { hex: false }); const a = r.players[0];
    a.hexList = []; a.hexLeft = {}; a.hex = {}; a.cash = 0;
    r.grantProject(a, 'ladderpay');
    ok(a.hexLeft.ladderpay === 13 && a.hex.growCash === 200 && a.hex.growCap === 400, '阶梯津贴：合约 13 轮 + growCash 200 / 上限 400');
    const seq = [];
    for (const rd of [1, 7, 13, 19, 25, 31, 37]) {
      a.cash = 0; r.round = rd; r.applyHexPassives(a);
      seq.push(a.cash);
    }
    ok(JSON.stringify(seq) === JSON.stringify([200, 240, 280, 320, 360, 400, 400]),
      `阶梯津贴逐轮 200/240/280/320/360/400/400（实得 ${seq.join('/')}）`);
    ok(a.hexLeft.ladderpay === 13 - 7, `阶梯津贴按轮消耗合约（剩 ${a.hexLeft.ladderpay}）`);
  }
  // 长线投资：每 10 轮返 1300，限 3 次
  {
    const r = mkRoom(2, { hex: false }); const a = r.players[0];
    a.hexList = []; a.hexLeft = {}; a.hex = {}; a.cash = 0;
    r.grantProject(a, 'longterm');
    const evs = []; const o = r.ev.bind(r); r.ev = e => { evs.push(e); o(e); };
    r.round = 10; a.cash = 0; r.applyHexPassives(a);
    const after10 = a.cash;
    r.round = 11; a.cash = 0; r.applyHexPassives(a);
    const after11 = a.cash;
    r.round = 20; a.cash = 0; r.applyHexPassives(a);
    r.round = 30; a.cash = 0; r.applyHexPassives(a);
    r.ev = o;
    ok(after10 === 1300 && after11 === 0, `长线投资只在第 10 轮发钱（10→${after10}，11→${after11}）`);
    ok(a.hexLeft.longterm === 0 && evs.some(e => e.t === 'hex_expire' && e.key === 'longterm'), '第 3 次返还后合约到期并派发结项经费');
    ok(evs.filter(e => e.t === 'hex_expire' && e.key === 'longterm')[0].stipend === G.EXPIRY_STIPEND.gold, '金卡结项经费 650');
  }
  // 终身教职：第 50 轮起才生效，且只在此后消耗合约
  {
    const r = mkRoom(2, { hex: false }); const a = r.players[0];
    a.hexList = []; a.hexLeft = {}; a.hex = {}; a.cash = 0;
    r.grantProject(a, 'tenured');
    r.round = 49; a.cash = 0; r.applyHexPassives(a);
    ok(a.cash === 0 && a.hexLeft.tenured === 10, '第 49 轮终身教职尚未生效、也不消耗合约');
    r.round = 50; a.cash = 0; r.applyHexPassives(a);
    ok(a.cash === 1000 && a.hexLeft.tenured === 9, '第 50 轮起每轮 +¥1000 并按轮消耗合约');
  }
  // 万能卡补给：每 8 轮 1 张，限 3 次
  {
    const r = mkRoom(2, { hex: false }); const a = r.players[0];
    a.hexList = []; a.hexLeft = {}; a.hex = {}; a.joker = 0;
    r.grantProject(a, 'jokersupply');
    for (const rd of [8, 16, 24, 32]) { r.round = rd; r.applyHexPassives(a); }
    ok(a.joker === 3 && a.hexLeft.jokersupply === 0, `每 8 轮发 1 张、共 3 张（实际 ${a.joker} 张）`);
  }
  // 午夜赌局：概率命中给 2600，否则 −600
  {
    const r = mkRoom(2, { hex: false }); const a = r.players[0];
    a.hexList = []; a.hexLeft = {}; a.hex = {}; a.cash = 10000; r.round = 5;
    r.grantProject(a, 'coinflip'); a.cash = 10000;
    withRandom(0.05, () => r.applyHexPassives(a));
    ok(a.cash === 10000 + 2200, '午夜赌局 22% 命中时 +¥2200');
    a.cash = 10000;
    withRandom(0.90, () => r.applyHexPassives(a));
    ok(a.cash === 10000 - 700, '午夜赌局未命中时 −¥700');
  }
  // 梭哈一把：立刻 +6600，之后每轮 −330
  {
    const r = mkRoom(2, { hex: false }); const a = r.players[0];
    a.hexList = []; a.hexLeft = {}; a.hex = {}; a.cash = 0; r.round = 5;
    r.grantProject(a, 'allin');
    ok(a.cash === 6600 && a.hex.roundPay === 330, '梭哈一把：立项立得 ¥6600，登记每轮 −330');
    r.applyHexPassives(a);
    ok(a.cash === 6600 - 330 && a.hexLeft.allin === 9, '梭哈一把每轮还款 ¥330 并消耗合约');
  }
  // 绝地反击：仅总资产垫底时补
  {
    const r = mkRoom(2, { hex: false }); const a = r.players[0], b = r.players[1];
    a.hexList = []; a.hexLeft = {}; a.hex = {}; r.round = 5;
    r.grantProject(a, 'comeback');
    b.cash = 99999; a.cash = 0; r.applyHexPassives(a);
    const low = a.cash;
    a.cash = 0; b.cash = 0; r.applyHexPassives(a);
    const notLast = a.cash;
    ok(low === 620 && notLast === 0, `绝地反击：垫底 +620（${low}）/ 非垫底 0（${notLast}）`);
  }
  // 学术侦探：从总资产最高者处抽 320
  {
    const r = mkRoom(2, { hex: false }); const a = r.players[0], b = r.players[1];
    a.hexList = []; a.hexLeft = {}; a.hex = {}; r.round = 5;
    r.grantProject(a, 'detective');
    b.cash = 5000; a.cash = 0; r.applyHexPassives(a);
    ok(a.cash === 320 && b.cash === 5000 - 320, '学术侦探每轮从最富者处抽 ¥320');
  }
}

// ================= [4] 事件型新卡 =================
section(4, '事件触发型新卡：晨跑打卡 / 通勤补助 / 反向护盾 / 盲盒达人 / 连击大师 / 精准收租 / 税务筹划 / 抗衰减护盾');
{
  // 晨跑打卡：掷出 7 点
  {
    const r = mkRoom(2, { hex: false }); const a = r.players[0], b = r.players[1];
    a.hexList = []; a.hexLeft = {}; a.hex = {}; a.cash = 0; b.cash = 0;
    r.grantProject(a, 'sevenrun');
    r.cur = r.players.indexOf(a); r.phase = 'roll';
    r.rollDice = () => [3, 4];
    r.avoidDupLanding = (p, x, y) => [x, y];
    r.execRoll = () => {};
    a.cash = 0;
    r.doRoll(a);
    r.clearTimer(); r.clearAiTimers();
    ok(a.cash === 200 && a.hexLeft.sevenrun === 10, `掷出 7 点 +¥200 并消耗合约（现金 ${a.cash} / 剩 ${a.hexLeft.sevenrun}）`);
  }
  // 通勤补助 + 反向护盾：被收租时的联动
  {
    const r = mkRoom(2, { hex: false });
    const [a, b] = r.players;
    a.major = 'mech'; a.skillLeft = 0; b.major = 'mech'; b.skillLeft = 0;
    r.faculty = null;
    const idx = G.BOARD.findIndex(c => c.type === 'prop');
    r.cells[idx].own = b.id; r.cells[idx].level = 0; r.cells[idx].mortgaged = false;
    a.hex = { payRentCash: 150, rentReflect: 360 };
    b.hex = {};
    const rent0 = r.calcRent(idx, [2, 5]);
    a.cash = 50000; b.cash = 50000;
    const ac0 = a.cash, bc0 = b.cash;
    a.pos = idx; r.round = 9; r.dice = [2, 5]; r.phase = 'roll';
    r.resolveCell(a);
    r.clearTimer(); r.clearAiTimers();
    ok(b.cash - bc0 === rent0 - 360, `反向护盾：收租方净收 租金 ${rent0} − 360 = ${rent0 - 360}（实际 ${b.cash - bc0}）`);
    ok(ac0 - a.cash === rent0 - 360 - 150, `付租方净付 租金 ${rent0} − 360 护盾 − 150 通勤补助 = ${rent0 - 360 - 150}（实际 ${ac0 - a.cash}）`);
  }
  // 盲盒达人：开盒多抽
  {
    const r = mkRoom(2, { hex: false }); const a = r.players[0];
    a.hex = { cardBonus: 1 };
    const evs = []; const o = r.ev.bind(r); r.ev = e => { evs.push(e); o(e); };
    r.grantCards(a, 0, 1, '测试');
    r.ev = o;
    const d = evs.find(e => e.t === 'draw');
    ok(d && d.n === 2, `盲盒达人：基础 1 张 + 额外 1 张 = ${d ? d.n : '?'} 张`);
    ok(a.hex.cardBonus === 1, '无合约的临时数据面保持（未登记 hexList 时不被消耗）');
  }
  // 连击大师：连击倍率上限 1.3 → 1.6
  {
    const r = mkRoom(2, { hex: false });
    const [a, b] = r.players;
    a.major = 'mech'; a.skillLeft = 0; b.major = 'mech'; b.skillLeft = 0;
    r.faculty = null; r.season = 'mid'; r.weather = 'cloud'; r.calEvent = null; r.mutation = null;
    const idx = G.BOARD.findIndex(c => c.type === 'prop');
    r.cells[idx].own = a.id; r.cells[idx].level = 3;
    a.combo = 0; a.hex = {};
    const base = r.calcRent(idx, [2, 5]);
    a.combo = 3;
    const c3 = r.calcRent(idx, [2, 5]);
    a.hex = { comboUp: 0.30 };
    const c3b = r.calcRent(idx, [2, 5]);
    ok(Math.abs(c3 / base - 1.3) < 0.02, `三连收租基准 ×1.3（实得 ×${(c3 / base).toFixed(3)}）`);
    ok(Math.abs(c3b / base - 1.6) < 0.02, `连击大师把上限抬到 ×1.6（实得 ×${(c3b / base).toFixed(3)}）`);
  }
  // 精准收租：概率翻倍
  {
    const r = mkRoom(2, { hex: false });
    const [a, b] = r.players;
    a.major = 'mech'; a.skillLeft = 0; b.major = 'mech'; b.skillLeft = 0;
    r.faculty = null;
    const idx = G.BOARD.findIndex(c => c.type === 'prop');
    r.cells[idx].own = b.id; r.cells[idx].level = 0; r.cells[idx].mortgaged = false;
    b.hex = { rentDoublePct: 0.20 }; a.hex = {};
    const rent0 = r.calcRent(idx, [2, 5]);
    a.cash = 50000; b.cash = 50000;
    const bc0 = b.cash;
    a.pos = idx; r.round = 9; r.dice = [2, 5]; r.phase = 'roll';
    withRandom(0.05, () => r.resolveCell(a));
    r.clearTimer(); r.clearAiTimers();
    ok(b.cash - bc0 === rent0 * 2, `精准收租命中：本笔租金 ×2（${rent0} → ${b.cash - bc0}）`);
  }
  // 税务筹划：建筑级数 −2 计税
  {
    const r = mkRoom(2, { hex: false }); const a = r.players[0];
    r.faculty = null;
    const cells = G.BOARD.map((c, i) => i).filter(i => G.BOARD[i].type === 'prop').slice(0, 8);
    for (const i of cells) { r.cells[i].own = a.id; r.cells[i].level = 1; r.cells[i].mortgaged = false; }
    a.hex = {};
    const t0 = r.taxFor(a);
    a.hex = { taxLevelCut: 2 };
    const t1 = r.taxFor(a);
    ok(t0.bld === 8 && t0.tax === 390, `8 栋建筑基准物业税 ¥390（实际 ${t0.tax}）`);
    ok(t1.tax === 130, `税务筹划按 6 栋计税 → ¥130（实际 ${t1.tax}）`);
  }
  // 抗衰减护盾：衰减扣减减半
  {
    const r = mkRoom(2, { hex: false }); const a = r.players[0];
    r.round = 20;   // incomeMul = 0.7
    const m = r.incomeMul();
    a.hex = {}; a.cash = 10000;
    r.ev({ t: 'money', pid: a.id, amount: 1000, reason: '测试奖金' });
    const cutFull = 10000 - a.cash;
    a.cash = 10000; a.hex = { decayCut: 0.5 };
    r.ev({ t: 'money', pid: a.id, amount: 1000, reason: '测试奖金' });
    const cutHalf = 10000 - a.cash;
    ok(cutFull === Math.round(1000 * (1 - m)) && cutHalf === Math.round(1000 * (1 - m) * 0.5),
      `抗衰减护盾把扣减砍半（${cutFull} → ${cutHalf}，倍率 ×${m}）`);
  }
}

// ================= [5] once: hexcopy =================
section(5, 'once: hexcopy —— 学术镜像立即复制他人一项研究项目（含全新合约）');
{
  const r = mkRoom(2, { hex: false });
  const [a, b] = r.players;
  b.hexList = ['ladderpay']; b.hexLeft = { ladderpay: 13 };
  b.hex = { growCash: 200, growStep: 40, growEvery: 6, growCap: 400 };
  a.hexList = []; a.hexLeft = {}; a.hex = {};
  r.grantProject(a, 'mirrorhex');
  ok(a.hexList.includes('mirrorhex') && a.hexList.includes('ladderpay'), '学术镜像把目标项目并入自己的 hexList');
  ok(a.hexLeft.ladderpay === 13 && a.hex.growCash === 200 && a.hex.growCap === 400, '复制来的项目带全新合约与完整 mods');
  // 无人可复制 → 补偿
  const r2 = mkRoom(2, { hex: false });
  const a2 = r2.players[0];
  r2.players[1].hexList = []; a2.hexList = []; a2.hexLeft = {}; a2.hex = {}; a2.cash = 0;
  r2.grantProject(a2, 'mirrorhex');
  ok(a2.cash === 1800, `无人可复制时改为 +¥1800（实际 ${a2.cash}）`);
}

// ================= [6] hexSpendMods =================
section(6, 'hexSpendMods：同一张卡在一次结算里最多扣 1 点合约');
{
  const r = mkRoom(2, { hex: false }); const a = r.players[0];
  a.hexList = []; a.hexLeft = {}; a.hex = {};
  r.grantProject(a, 'highjump');   // 掷出 ≥9 点 +380 / 双数再 +180，同一张卡两个 mods
  ok(a.hexLeft.highjump === 10, '竞技状态合约 10 次');
  r.hexSpendMods(a, ['highRollCash', 'doubleCash']);
  ok(a.hexLeft.highjump === 9, `双 mods 命中一次只扣 1 点（剩 ${a.hexLeft.highjump}）`);
  a.hexLeft.highjump = 1;
  r.hexSpendMods(a, ['highRollCash']);
  ok(a.hexLeft.highjump === 0 && a.hex.highRollCash === undefined && a.hex.doubleCash === undefined, '合约归零后 mods 被完整移除');
}

// ================= [7] 强度护栏 =================
section(7, '强度护栏：47 张新卡整局资金影响上界（amount × charges）落在档位预算内');
{
  // 档位预算（整局硬顶，含未触发的余量）：银 3000 / 金 7000 / 彩 10500（v7.5 次数下调后重算）
  const BUDGET = { silver: 3000, gold: 7000, prism: 10500 };
  // 每张新卡的「单次触发上限 × 合约次数」；概率型按期望折算，纯功能型记 0（v7.5 合约次数）
  const BOUND = {
    // 银
    tahelp: 0,            sevenrun: 200 * 11,   commute: 150 * 13,   boxer: 0,
    couponback: 130 * 11, landlord: 80 * 14,    sparestax: 0,        nightguard: 180 * 11,
    expressline: 90 * 13, scooter: 120 * 13,    handout: 110 * 16,   coinbox: 220 * 10,
    bulkbuy: 120 * 10,    toolbox: 140 * 10,    raincoat: 260 * 11,  brightside: 220 * 10,
    // 金
    ladderpay: 400 * 13,  longterm: 1300 * 3,   detective: 320 * 10, comeback: 620 * 11,
    allin: 6600,          coinflip: 2200 * 0.22 * 11, cramnight: 520 * 11, coinvest: 520 * 11,
    alleyboss: 260 * 11,  combomaster: 0,       marknote: 330 * 11,  sniperent: 1522 * 0.20 * 11,
    taxplan: 260 * 10,    ticketpack: 0,        sponsor2: 70 * 11,   refund2: 2600,
    // 彩
    tenured: 1000 * 10,   rentcompound: 1522 * 0.22 * 13, decayguard: 0, jokersupply: 0,
    reflectshield: 360 * 11, negotiator: 1522 * 0.28 * 11, mortgage80: 0, estateking: 70 * 10,
    mirrorhex: 0,         secondwind: 0,        windfall: 4200 * 0.12 * 11, hegemony: 4500 + 420 * 10,
    cardstorm: 0,         usury: 900 * 10,      alumninet2: 620 * 10,
  };
  const over = [];
  for (const k in BOUND) {
    const pr = G.PROJECTS[k];
    if (!pr) { over.push(k + '(缺卡)'); continue; }
    if (BOUND[k] > BUDGET[pr.tier]) over.push(`${k}(${pr.tier} ${Math.round(BOUND[k])} > ${BUDGET[pr.tier]})`);
  }
  ok(Object.keys(BOUND).length === 47, `护栏表覆盖 47 张新卡（实际 ${Object.keys(BOUND).length}）`);
  ok(over.length === 0, `全部新卡上界 ≤ 档位预算${over.length ? '（超：' + over.join('，') + '）' : ''}`);

  // 档位内均值不得被单卡拉开——同档最贵 / 最便宜上界比 ≤ 16（与既有棱彩「地标经济 960」同量级）
  const byTier = { silver: [], gold: [], prism: [] };
  for (const k in BOUND) byTier[G.PROJECTS[k].tier].push(BOUND[k]);
  const spread = t => {
    const v = byTier[t].filter(x => x > 0);
    if (v.length < 2) return 1;
    return Math.max(...v) / Math.min(...v);
  };
  const worst = Math.max(spread('silver'), spread('gold'), spread('prism'));
  ok(worst <= 16, `同档内最高 / 最低上界比 ≤ 16（实为 ${worst.toFixed(1)}，纯功能型卡不计入）`);

  // 限次卡硬顶与 desc 一致性（防止改数值忘改描述）
  ok(G.PROJECTS.ladderpay.charges === 13 && G.PROJECTS.raincoat.charges === 11 && G.PROJECTS.tenured.charges === 10,
    '代表卡合约次数与设计一致（阶梯津贴 13 / 雨衣常备 11 / 终身教职 10）');
}

console.log('\n========================================');
console.log(`  v7.4 单测：${pass} 通过 / ${fail} 失败`);
console.log('========================================');
process.exit(fail ? 1 : 0);
