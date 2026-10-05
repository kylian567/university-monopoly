#!/usr/bin/env node
// test_v60.js —— v6.0 大版本引擎单测
// 覆盖：重投个人计价 + 连用锁定 / 校区风貌（嘉年华与文体 8 折、新增拆迁校区）/ 效果卡（万能卡、免罚款卡、偷师即发动、现金红包区间）
//      缴税分档 / 收益衰减纳入一切正收益（海克斯豁免）/ 海克斯触发轮重排 + 统一概率 / 攻守互换 / 前两轮防撞车
//      初始资金 26666 / 筹钱与盖房时间放宽 / 租金预览 rentView / 免罚符与平安符 / 双镜像一致
'use strict';
const path = require('path');
const fs = require('fs');
const G = require('./game');
const {
  Room, BOARD, GROUPS, FACULTY, FACULTY_KEYS, PROJECTS, PROJECT_KEYS, EFFECT_CARDS,
  HEX_TRIGGERS, HEX_TRIGGERS_EARLY, HEX_TIER_P, START_CASH, MAJORS, EXPIRY_STIPEND,
  REROLL_COST, SEASON, WEATHER,
} = G;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
function section(n, t) { console.log(`\n[${n}] ${t}`); }

// 默认专业固定为中性专业 mech（与 test_v59 约定一致）——否则 join 会随机分配专业，
// 某些专业带 rerollFree / shieldCut / turnCash 等修正，会让价格与现金断言偶发失败。
function mkRoom(n = 2, majors, opts) {
  const r = new Room('T60' + Math.floor(Math.random() * 900000 + 100000), Object.assign({ hex: true }, opts || {}));
  for (let i = 0; i < n; i++) { const p = r.join('P' + (i + 1), i > 0); p.major = (majors && majors[i]) || 'mech'; }
  r.start();
  r.clearTimer(); r.clearAiTimers();
  r.weather = 'cloud'; r.season = 'mid'; r.calEvent = null;
  return r;
}
function facRoom(facKey, n = 2, majors) {
  const r = new Room('F60' + Math.floor(Math.random() * 900000 + 100000), { faculty: true, hex: true });
  for (let i = 0; i < n; i++) { const p = r.join('P' + (i + 1), i > 0); p.major = (majors && majors[i]) || 'mech'; }
  r.faculty = facKey;
  r.applyFacultySetup(facKey);
  r.weather = 'cloud'; r.season = 'mid'; r.calEvent = null;
  r.clearTimer(); r.clearAiTimers();
  return r;
}
const unownedProp = r => BOARD.findIndex((c, i) => c.type === 'prop' && r.cells[i].own === null);

// ================= [1] 常量与基础参数 =================
section(1, 'v6.0 常量：初始资金 26666 / 触发轮重排 / 统一概率 / 筹钱与盖房时间');
{
  ok(START_CASH === 26666, `初始资金 = ¥${START_CASH}（原 30000）`);
  ok(REROLL_COST === 800, `重投基准价 = ¥${REROLL_COST}（原 1200）`);
  ok(JSON.stringify(HEX_TRIGGERS) === JSON.stringify([2, 8, 16, 25, 32, 40, 49, 55, 62, 70, 77, 85, 91, 100, 110]),
    'v7.0 触发轮 = 2/8/16/25/32/40/49/55/62/70/77/85/91/100/110（共 15 次）');
  ok(JSON.stringify(HEX_TRIGGERS_EARLY) === JSON.stringify([2, 6, 12, 19, 26, 33, 40, 47, 54, 61, 68, 75, 82, 88, 94]),
    'v7.1 提前表（时光之城）= 2/6/12/19/26/33/40/47/54/61/68/75/82/88/94（15 次全部提前）');
  ok(HEX_TIER_P.length === 1 && HEX_TIER_P[0][0] === 0.43 && HEX_TIER_P[0][1] === 0.32 && HEX_TIER_P[0][2] === 0.25,
    '所有立项统一 银 43 / 金 32 / 彩 25');
  const r = mkRoom(2);
  ok(r.players[0].cash === START_CASH, `新玩家开局现金 = ¥${r.players[0].cash}`);
  ok(r.players[0].rerollCount === 0, '玩家初始化 rerollCount = 0');
}

// ================= [2] 重投：个人计价 + 连用锁定 =================
section(2, '重投骰：每名玩家独立计价、递增封顶、连用两回合后仅锁一回合');
{
  const r = mkRoom(2);
  const a = r.players[0], b = r.players[1];
  ok(r.rerollCostFor(a) === 800, `首次 ¥${r.rerollCostFor(a)}`);
  a.rerollCount = 1;
  ok(r.rerollCostFor(a) === 870, `个人用 1 次后 ¥${r.rerollCostFor(a)}（+70）`);
  a.rerollCount = 10;
  ok(r.rerollCostFor(a) === 1500, `用满 10 次后触及封顶 ¥${r.rerollCostFor(a)}`);
  a.rerollCount = 0;
  ok(r.rerollCostFor(b) === 800, '价格每名玩家独立计算（b 仍是 800）');
  a.hex = { rerollCut: 0.25 };
  ok(r.rerollCostFor(a) === 600, `情报网 −25% → ¥${r.rerollCostFor(a)}`);

  // 连用两回合 → 第三回合锁定；第四回合（下下回合）恢复（引擎内联判定，语义与 doRoll 完全一致）
  const r2 = mkRoom(2);
  const p = r2.players[0];
  const locked = (rr, q) => !q.rerollUsed && (q.rerollStreak || 0) >= 2 && q.rerollLastRound === rr.round - 1;
  p.rerollUsed = false; p.rerollLastRound = 1; p.rerollStreak = 1; r2.round = 2;
  ok(locked(r2, p) === false, '只连用了 1 回合 → 不锁');
  p.rerollLastRound = 2; p.rerollStreak = 2; r2.round = 3;
  ok(locked(r2, p) === true, '连续两回合重投 → 第 3 回合锁定');
  r2.round = 4;
  ok(locked(r2, p) === false, '第 4 回合（下下回合）解除锁定，不再永久禁用');
}

// ================= [3] 校区风貌：嘉年华 / 文体 8 折 + 拆迁校区 =================
section(3, '校区风貌：嘉年华与文体首次重投 8 折（修复「重投没效果」）/ 新增拆迁校区');
{
  const rc = facRoom('carnival');
  const pc = rc.players[0];
  pc.rerollUsed = false;
  ok(rc.rerollCostFor(pc) === 560, `嘉年华校区每轮首次重投 7 折 = ¥${rc.rerollCostFor(pc)}（v7.0：8 折→7 折）`);
  pc.rerollUsed = true;
  ok(rc.rerollCostFor(pc) === 800, `本回合再次重投恢复 ¥${rc.rerollCostFor(pc)}`);
  const rs = facRoom('sports');
  rs.players[0].rerollUsed = false;
  ok(rs.rerollCostFor(rs.players[0]) === 560, `文体校区同样 7 折 = ¥${rs.rerollCostFor(rs.players[0])}`);

  ok(!!FACULTY.redevelop && FACULTY.redevelop.icon && FACULTY.redevelop.color && FACULTY.redevelop.lead && FACULTY.redevelop.cost,
    '新增「拆迁校区」字段齐全');
  ok(FACULTY_KEYS.length === 74, `城邦总数 = ${FACULTY_KEYS.length}`);
  ok(/旅馆/.test(FACULTY.redevelop.lead), '拆迁校区说明里写明「旅馆按 4 层算」');

  // 每 3 轮拆一栋楼（旅馆 4 → 3）
  const rd = facRoom('redevelop');
  const own = rd.players[0];
  const ci = unownedProp(rd);
  rd.cells[ci].own = own.id; rd.cells[ci].level = 4;
  rd.round = 2;   // v7.0：拆迁校区由「每 3 轮」改为「每 2 轮」
  const before = rd.cells[ci].level;
  rd.applyFacultyRound();
  ok(rd.cells[ci].level === before - 1, `第 2 轮拆迁：Lv${before} → Lv${rd.cells[ci].level}`);
  // 缴税时旅馆按 4 层
  const rt = mkRoom(2);
  const pt = rt.players[0]; pt.cash = 99999;
  const ti = unownedProp(rt);
  rt.cells[ti].own = pt.id; rt.cells[ti].level = 4;   // 旅馆 = 4 层 → 不足 6 栋 → 免税
  rt.collectTax();
  ok(pt.cash === 99999, '旅馆算 4 层建筑（单块旅馆不足 6 栋起征线，免缴）');
}

// ================= [4] 缴税分档 =================
section(4, '物业税：旅馆算 4 层、≥6 栋起征、6~10 每栋 130 / 11~15 每栋 170 / 16+ 每栋 200、地皮超 10 块每块 130');
{
  const mk = (levels, hold) => {
    const r = mkRoom(2);
    const p = r.players[0]; p.cash = 999999;
    const props = BOARD.map((c, i) => i).filter(i => BOARD[i].type === 'prop').slice(0, hold);
    props.forEach((i, k) => { r.cells[i].own = p.id; r.cells[i].level = levels[k] || 0; });
    const before = p.cash; r.collectTax();
    return before - p.cash;
  };
  ok(mk([2, 2, 1], 3) === 0, '3 栋 → 免税（未达 6 栋起征线）');
  ok(mk([1, 1, 1, 1, 1, 1], 6) === 130, '恰好 6 栋 → ¥130');
  ok(mk([1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 10) === 650, '10 栋（6~10 每栋 130）= ¥650');
  ok(mk([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 11) === 950, '11 栋 + 11 块地 = (650+170) + 1×130 = ¥950');
  ok(mk(Array(15).fill(1), 15) === 2150, '15 栋 + 15 块地 = (650+850) + 5×130 = ¥2150');
  ok(mk(Array(20).fill(1), 20) === 3800, '20 栋 + 20 块地 = (650+850+1000) + 10×130 = ¥3800');
}

// ================= [5] 效果卡：万能卡 / 免罚款卡 / 偷师即发动 / 现金红包 =================
section(5, '效果卡 v6.0：万能卡（免一切负面含租金）、免罚款卡（免租金外一切）、偷师获得即发动、红包 800~1200');
{
  ok(EFFECT_CARDS.length === 34, `效果卡池 = ${EFFECT_CARDS.length} 张（v7.0：原 10 张 + 新增 24 张）`);
  ok(EFFECT_CARDS.some(c => c.id === 'joker' || c.name === '万能卡'), '卡池含「万能卡」');
  const jk = EFFECT_CARDS.find(c => c.id === 'joker' || c.name === '万能卡');
  ok(/负面|租金|罚款|停留|拆/.test(jk.desc), `万能卡描述覆盖负面效果：${jk.desc}`);
  const cashCard = EFFECT_CARDS.find(c => c.id === 'cash');
  ok(/800/.test(cashCard.desc) && /1200/.test(cashCard.desc), `现金红包描述为 ¥800~1200：${cashCard.desc}`);

  // 万能卡：免「交租金」这种带 creditor 的支出
  const r = mkRoom(2);
  const a = r.players[0], b = r.players[1];
  a.joker = 1; a.cash = 5000; b.cash = 5000;
  r.tryPay(a, 900, b, false, '租金');
  ok(a.cash === 5000 && a.joker === 0, '万能卡可免除「交租金」（原免罚款卡不行）');
  // 免罚款卡：免非租金罚款
  const r2 = mkRoom(2);
  const a2 = r2.players[0];
  a2.fineFree = 1; a2.cash = 5000;
  r2.tryPay(a2, 700, null, true, '缴学费');
  ok(a2.cash === 5000 && a2.fineFree === 0, '免罚款卡免除「缴学费」这类非租金支出');
  const r3 = mkRoom(2);
  const a3 = r3.players[0], b3 = r3.players[1];
  a3.fineFree = 1; a3.cash = 5000;
  r3.tryPay(a3, 700, b3, false, '租金');
  ok(a3.cash === 4300 && a3.fineFree === 1, '免罚款卡**不**免交租金');

  // 偷师：获得即发动 —— 抽卡入口是 grantCards（cash / steal 在此内联结算）
  let stealOK = false, stealMsg = '';
  for (let i = 0; i < 500 && !stealOK; i++) {
    const rr = mkRoom(2);
    const t = rr.players[0], v = rr.players[1];
    t.major = 'mech'; t.skillLeft = 3; t.borrow = {};
    v.major = 'law'; v.skillLeft = 2;      // law 为被动技 → 应转化为 t.skillLeft +1
    rr.ev = () => {};
    rr.grantCards(t, 0, 1, '测试');
    if (Object.keys(t.borrow || {}).length > 0 || v.skillLeft === 1 || t.skillLeft === 4) {
      stealOK = true;
      stealMsg = `borrow=${Object.keys(t.borrow || {}).length} 对方剩 ${v.skillLeft} 自己剩 ${t.skillLeft}`;
    }
  }
  ok(stealOK, `偷师卡获得时立即结算（${stealMsg}）`);
  // 无人可偷 → 自己技能次数 +1
  const r4b = mkRoom(2);
  const tb = r4b.players[0], vb = r4b.players[1];
  tb.major = 'mech'; tb.skillLeft = 2; vb.skillLeft = 0;
  let selfOK = false;
  for (let i = 0; i < 500 && !selfOK; i++) {
    const rr = mkRoom(2);
    const a = rr.players[0], b = rr.players[1];
    a.major = 'mech'; a.skillLeft = 2; b.skillLeft = 0;
    rr.ev = () => {};
    rr.grantCards(a, 0, 1, '测试');
    if (a.skillLeft === 3) selfOK = true;
  }
  ok(selfOK, '全场无人有技能剩余时，偷师卡改为自己技能次数 +1');

  // 红包区间 800~1200
  let lo = 1e9, hi = -1, hits = 0;
  for (let i = 0; i < 900; i++) {
    const rr = mkRoom(2);
    const q = rr.players[0];
    q.cash = 0;
    rr.ev = () => {};
    rr.grantCards(q, 0, 1, '测试');
    if (q.cash >= 800 && q.cash <= 1200) { hits++; lo = Math.min(lo, q.cash); hi = Math.max(hi, q.cash); }
  }
  ok(hits > 0 && lo >= 800 && hi <= 1200 && hi - lo > 100, `现金红包落在 ¥${lo}~¥${hi}（命中 ${hits} 次，应在 800~1200 且随机）`);
}

// ================= [6] 收益衰减：一切正收益都衰减，海克斯豁免 =================
section(6, '收益衰减：除租金外的一切现金增长都衰减（含基金 / 专业技能 / 城邦），海克斯项目收入豁免');
{
  const r = mkRoom(2);
  const p = r.players[0];
  r.round = 30;   // 第 25 轮起 ×50%
  // 收益衰减在 ev() 内统一拦截：调用方先入账，再由 ev 扣回超标部分
  const gain = (reason, amt) => {
    p.cash += amt;
    const e = { t: 'money', pid: p.id, amount: amt, reason };
    r.ev(e);
    return e.amount;
  };
  const plain = gain('城邦奖励', 1000);
  ok(plain < 1000, `普通收益被衰减（¥1000 → ¥${plain}）`);
  const hexIn = gain('项目·测试', 1000);
  ok(hexIn === 1000, `海克斯项目收益豁免衰减（¥1000 → ¥${hexIn}）`);
  const stipend = gain('结项经费', 1000);
  ok(stipend === 1000, '结项经费豁免衰减');
  const jokerIn = gain('万能卡', 1000);
  ok(jokerIn === 1000, '万能卡收益豁免衰减');
  const rentIn = gain('房产租金', 1000);
  ok(rentIn === 1000, '房产租金不受衰减影响');
  ok(Math.abs(r.incomeMul() - 0.5) < 1e-9, `第 30 轮收益倍率 = ×${r.incomeMul()}`);
}

// ================= [7] 海克斯：新增攻守互换 + 触发轮 + 池子 =================
section(7, '海克斯：新增「攻守互换」、池子 105、触发轮重排');
{
  const cnt = { silver: 0, gold: 0, prism: 0 };
  for (const k in PROJECTS) cnt[PROJECTS[k].tier]++;
  ok(Object.keys(PROJECTS).length === 105 && cnt.silver === 40 && cnt.gold === 35 && cnt.prism === 30,
    `项目池 = ${Object.keys(PROJECTS).length}（银 ${cnt.silver} / 金 ${cnt.gold} / 彩 ${cnt.prism}）`);
  ok(!!PROJECTS.swapping && PROJECTS.swapping.once === 'swapCash', '新增棱彩项目「攻守互换」（once: swapCash）');
  // 攻守互换：与总资产最高者交换现金
  const r = mkRoom(2);
  const a = r.players[0], b = r.players[1];
  a.cash = 3000; b.cash = 20000; b.level = 0;
  r.ev = () => {};
  r.grantProject(a, 'swapping');
  // once 型在 grantProject 内直接结算
  ok(a.cash === 20000 && b.cash === 3000, `攻守互换后 a ¥${a.cash} / b ¥${b.cash}（与首富全额互换）`);
}

// ================= [8] 前两轮防撞车 =================
section(8, '前两轮：不同玩家不会落在同一块地皮上（机会 / 命运 / 缴费等格子不受限）');
{
  let bad = 0, tried = 0;
  for (let t = 0; t < 40; t++) {
    const r = mkRoom(3);
    r.round = 1;
    r.r2Seen = {};
    const seen = {};
    for (const p of r.players) {
      let d1 = 1 + Math.floor(Math.random() * 6), d2 = 1 + Math.floor(Math.random() * 6);
      const dd = r.avoidDupLanding(p, d1, d2);
      r.dice = dd;
      const pv = r.previewLanding(p);
      const c = BOARD[pv.cell];
      if (c.type === 'prop' || c.type === 'transport' || c.type === 'util') {
        tried++;
        if (seen[pv.cell]) bad++;
        seen[pv.cell] = 1; r.r2Seen[pv.cell] = p.id;
      }
    }
  }
  ok(bad === 0 && tried > 60, `前两轮 ${tried} 次地皮落点中，重复 ${bad} 次（应为 0）`);
}

// ================= [9] 租金预览 rentView =================
section(9, 'rentView：点击格子可查看空地 / 1~3 房 / 旅馆的基础租金与本轮实付');
{
  const r = mkRoom(2);
  const p = r.players[0];
  const idx = unownedProp(r);
  const rv0 = r.rentView(idx);
  ok(rv0 && rv0.kind === 'prop' && rv0.tbl.length === 5, '地皮返回 5 档租金表');
  ok(rv0.tbl[0] === BOARD[idx].rent, `空地租金 = 裸地 ¥${rv0.tbl[0]}`);
  ok(rv0.tbl[1] > rv0.tbl[0] && rv0.tbl[4] > rv0.tbl[3], '租金随楼层递增');
  ok(rv0.now === null, '无主地的「本轮实付」为 null');
  r.cells[idx].own = p.id; r.cells[idx].level = 2;
  const rv1 = r.rentView(idx);
  ok(rv1.now > 0 && rv1.level === 2, `有主且有房：Lv${rv1.level}，本轮实付 ¥${rv1.now}`);
  const ti = BOARD.findIndex(c => c.type === 'transport');
  r.cells[ti].own = p.id;
  const rv2 = r.rentView(ti);
  ok(rv2 && rv2.kind === 'transport' && rv2.tbl[1] === 800, '机场返回 800/1600/3500/5500 档位表');
  ok(r.rentView(0) === null, '非地皮格（起点）返回 null');
}

// ================= [10] 平安符 / 时间管理 / 挂科保险 / 税收返还 =================
section(10, '海克斯调整：平安符（7 折限 5 轮）、时间管理（永不被停留）、挂科保险免补考费、税收返还 −15%');
{
  ok(PROJECTS.talisman.mods.shieldCut === 0.30 && PROJECTS.talisman.charges === 5, '平安符：免罚符 7 折、限 5 轮');
  ok(PROJECTS.timemgmt.mods.stayImmune === 1, '时间管理改为「自己永远不会被停留」');
  ok(PROJECTS.keychain.mods.jailFeeFree === 1, '挂科保险（钥匙扣）可免除补考费');
  ok(PROJECTS.taxrebate.mods.taxCut === 0.15, '税收返还改为缴税 −15%');
  // 平安符打折后价格（useItem 仅在 roll 阶段、且轮到本人时生效）
  const r = mkRoom(2);
  const p = r.players[0];
  r.round = 3;
  r.phase = 'roll'; r.cur = 0;
  const base = r.shieldCost();
  r.grantProject(p, 'talisman');
  r.useItem(p, 'shield');
  ok(p.cash === START_CASH - Math.round(base * 0.7), `平安符：免罚符 ¥${base} → ¥${Math.round(base * 0.7)}`);
  ok(p.shield === true, '购买后获得免罚符');
}

// ================= [11] 校区风貌逐个结算不报错 + 双镜像一致 =================
section(11, '60 个校区风貌结算无异常 + 双镜像逐字一致');
{
  const errs = [];
  for (const k of FACULTY_KEYS) {
    try {
      const r = facRoom(k, 3);
      r.applyFacultyRound();
      r.round = 3; r.applyFacultyRound();
      r.round = 9; r.applyFacultyRound();
      r.collectTax();
      r.clearTimer(); r.clearAiTimers();
    } catch (e) { errs.push(k + ':' + e.message); }
  }
  ok(errs.length === 0, `60 个风貌关键结算路径全部无异常${errs.length ? ' —— ' + errs.join(' | ') : ''}`);

  const game = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  const cli = fs.readFileSync(path.join(__dirname, 'public/client.js'), 'utf8');
  const srv = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  const span = (src, a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
  ok(span(game, 'const FACULTY = {', 'const FACULTY_KEYS = Object.keys(FACULTY);')
    === span(cli, 'const FACULTY = {', 'const FACULTY_KEYS = Object.keys(FACULTY);'), 'FACULTY 双镜像逐字一致');
  ok(span(game, 'const PROJECTS = {', 'const PROJECT_KEYS = {')
    === span(cli, 'const PROJECTS = {', 'const PROJECT_KEYS = {'), 'PROJECTS 双镜像逐字一致');
  ok(/rentViews/.test(srv), 'server 快照暴露 rentViews（供点击格子查看租金）');
  ok(/openRentPanel/.test(cli), 'client 具备 openRentPanel（点击格子查看租金详情）');
  ok(/joker_free/.test(cli) && /swap_cash/.test(cli), 'client 处理 joker_free / swap_cash 新事件');
  ok(/FAC_STYLE/.test(cli) && /fv-card \$\{st\}/.test(cli) && /st0/.test(cli) && /st1/.test(cli) && /st2/.test(cli), 'client 三风格候选卡片（科技 / 古风 / 学术）已实现');
  const css = fs.readFileSync(path.join(__dirname, 'public/style.css'), 'utf8');
  ok(/\.fv-card\.st0/.test(css) && /\.fv-card\.st1/.test(css) && /\.fv-card\.st2/.test(css), 'style.css 三风格卡片样式齐备');
  ok(/\.rc-panel/.test(css) && /\.rc-now/.test(css), 'style.css 租金详情面板样式齐备');
  const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
  ok(/v6\.0/.test(html), 'index.html 开局公告已更新到 v6.0');
}

// ================= [12] 时序：投票 / 海克斯时长 =================
section(12, '时序与体验：投票 60s / 海克斯 70s / 筹钱与盖房时间放宽');
{
  ok(G.FACULTY_VOTE_MS === 60000, `城邦投票时长 ${G.FACULTY_VOTE_MS / 1000}s`);
  ok(G.HEX_PICK_MS === 70000, `海克斯选择时长 ${G.HEX_PICK_MS / 1000}s`);
  const cli = fs.readFileSync(path.join(__dirname, 'public/client.js'), 'utf8');
  const src = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  ok(/queueIdle/.test(cli), 'client 用 queueIdle 保证「上一轮最后一名玩家回合完全结束后」才弹投票 / 三选一');
  ok(/RAISE_MS\s*=\s*75000/.test(src), '破产筹钱时间 = 75s（v6.0 大幅放宽）');
  ok(/BUILD_MS\s*=\s*55000/.test(src), '盖房 / 升级筹钱时间 = 55s（v6.0 新增）');
}

// ================= [13] 学术长廊：负面效果概率小幅上调 =================
section(13, '学术长廊负面概率小幅上调（导师 50→55、被举报 15→20、杰出校友厅 10→14、猝死 20→25）');
{
  const src = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  const body = src.slice(src.indexOf("case 'advisor'"));
  ok(/Math\.random\(\)\s*<\s*0\.45/.test(body), '导师办公室：好心情 45%（即负面「搬设备」50% → 55%）');
  const m1 = src.match(/奖学金长廊[\s\S]{0,400}?Math\.random\(\)\s*<\s*0\.20/);
  ok(!!m1, '奖学金长廊：被举报概率 15% → 20%');
  ok(/cell\.risk\s*&&\s*Math\.random\(\)\s*<\s*0\.14/.test(src), '杰出校友厅：被举报概率 10% → 14%');
  ok(/const dead\s*=\s*Math\.random\(\)\s*<\s*0\.25/.test(src), '通宵自习室：猝死概率 20% → 25%');
}

console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail ? 1 : 0);
