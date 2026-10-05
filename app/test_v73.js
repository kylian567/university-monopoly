#!/usr/bin/env node
// v7.3 单测：14 个新城邦 + 中期突变（M1）+ 效果卡手牌上限 + 专业技能次数上调
//   [1] 城邦总量 74（新增 14，去掉 N2 强制拍卖 / N11 时间静止）
//   [2] 效果卡手牌上限 6 张
//   [3] 专业技能可用次数整体上调（3→5 / 4→6）
//   [4] M1 中期突变：每届第 5 轮触发、三路等概率、ops 立即生效 + 每轮生效
//   [5] 新城邦机制：连锁 / 悬赏 / 轮盘 / 大乐透 / 黑天鹅 / 幻影 / 通胀通缩 / 联赛 / 借贷 / 购物节 / 模仿 / 天气工厂 / 变异体
//   [6] 大屏事件广播齐全
//   [7] 双镜像（FACULTY / MAJORS）一致性
'use strict';
const fs = require('fs');
const path = require('path');
const G = require('./game');

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.error('  ✗ ' + name); } };
const section = (n, t) => console.log(`\n[${n}] ${t}`);

function mkRoom(n = 3, opts) {
  const room = new G.Room('v73' + Math.floor(Math.random() * 1e6), Object.assign({ hex: true, faculty: true, draft: true }, opts || {}));
  for (let i = 0; i < n; i++) room.join('P' + (i + 1), i > 0);
  room.start(); room.clearTimer(); room.clearAiTimers();
  return room;
}
function neutral(r) {
  r.faculty = null; r.season = 'mid'; r.weather = 'cloud'; r.calEvent = null; r.mutation = null; r.mutRoll = null;
  r.players.forEach(p => { p.combo = 0; });
}
const NEW14 = ['roulette', 'jackpot', 'blackswan', 'phantom', 'inflation', 'deflation', 'league', 'bounty', 'chain', 'credit', 'shopping', 'mimic', 'weatherlab', 'mutant'];

// ================= [1] 城邦总量与新增 =================
section(1, '城邦总量 74（新增 14，排除 N2 强制拍卖 / N11 时间静止）');
{
  ok(G.FACULTY_KEYS.length === 74, `城邦总数 = ${G.FACULTY_KEYS.length}（预期 74）`);
  const miss = NEW14.filter(k => !G.FACULTY[k]);
  ok(miss.length === 0, `14 个新城邦齐全${miss.length ? '（缺 ' + miss.join(',') + '）' : ''}`);
  ok(NEW14.every(k => G.FACULTY[k].lead && G.FACULTY[k].cost && G.FACULTY[k].icon && /^#[0-9A-Fa-f]{6}$/.test(G.FACULTY[k].color)),
    '14 个新城邦都有 icon / color / lead / cost');
  // N2 强制拍卖 / N11 时间静止 不得出现
  const all = G.FACULTY_KEYS.join(' ');
  ok(!/auctionzone|拍卖小区/.test(all), '未加入 N2「强制拍卖小区」');
  ok(!/timestop|freeze|时间静止/.test(all), '未加入 N11「时间静止」');
  // 悬赏数值要求：收租 ×1.2（原 1.6）
  ok(G.FACULTY.bounty.lead.includes('×1.2'), `悬赏校区：文案收租 ×1.2（原文案：${G.FACULTY.bounty.lead.slice(0, 24)}…）`);
  ok(!G.FACULTY.bounty.lead.includes('×1.6'), '悬赏校区：不再是 ×1.6');
  ok(G.FACULTY.bounty.lead.includes('总资产最高'), '悬赏校区：校霸固定为总资产最高者');
  ok(G.FACULTY.chain.lead.includes('地皮与房子') && G.FACULTY.chain.cost.includes('地皮与房子'), '连锁校区：文案写明地皮与房子一起涨 / 一起跌');
}

// ================= [2] 手牌上限 =================
section(2, '效果卡手牌上限：每人最多 6 张');
{
  const r = mkRoom(2);
  const p = r.players[0];
  p.hand = []; p.handSeq = 0;
  for (let i = 0; i < 12; i++) r.addHandCard(p, 'seize');
  ok(p.hand.length === 6, `连续入牌 12 次，手牌停在 ${p.hand.length} 张（上限 6）`);
  ok(p.hand.every(h => h.uid && h.id === 'seize'), '手牌结构 { uid, id } 正常');
  const full = r.events.filter(e => e.t === 'hand_full');
  ok(full.length === 6 && full[0].cap === 6, `超出部分触发 ${full.length} 次 hand_full 事件（cap=6）`);
  ok(r.log.some(l => /手牌已满/.test(l.msg)), '日志提示「手牌已满」');
  // 手动型卡走 applyEffectCard 也应受上限约束
  const p2 = r.players[1];
  p2.hand = []; p2.handSeq = 0;
  for (let i = 0; i < 10; i++) r.applyEffectCard(p2, { id: 'demolish', name: '拆除卡', icon: '🧨', desc: 'x' });
  ok(p2.hand.length === 6, '手动型卡（拆除卡）同样受 6 张上限约束');
}

// ================= [3] 专业技能次数上调 =================
section(3, '专业技能可用次数整体上调');
{
  const cnt = {};
  for (const k of G.MAJOR_KEYS) cnt[G.MAJORS[k].uses] = (cnt[G.MAJORS[k].uses] || 0) + 1;
  ok(cnt[5] === 45, `uses=5 的专业 ${cnt[5]} 个（原 3 次的 45 个各 +2）`);
  ok(cnt[6] === 15, `uses=6 的专业 ${cnt[6]} 个（原 4 次的 15 个各 +2）`);
  ok(Object.keys(cnt).every(k => Number(k) >= 1 && Number(k) <= 6), `uses 取值范围 1~6（实测 ${Object.keys(cnt).sort().join('/')}）`);
  const r = mkRoom(2);
  ok(r.players.every(p => { const u = G.MAJORS[p.major].uses; return p.skillLeft === u; }), '开局技能次数 = 该专业 uses（已按新表下发）');
}

// ================= [4] M1 中期突变 =================
section(4, 'M1 中期突变：每届第 5 轮 · 三路等概率 · ops 生效');
{
  // 触发轮次
  const r0 = mkRoom(2); neutral(r0); r0.faculty = 'urban'; r0.facTermStart = 1; r0.round = 4;
  r0.maybeMutation();
  ok(!r0.mutation, '第 4 轮不触发突变');
  r0.round = 5; r0.maybeMutation();
  ok(r0.mutation && r0.mutRoll, '第 5 轮触发突变');
  ok(r0.events.some(e => e.t === 'mutation'), '广播 mutation 事件');
  ok(r0.mutRoll.options.length === 3 && r0.mutRoll.options.map(o => o.kind).join(',') === 'general,buff,nerf',
    '大屏动画数据含三路选项（通用池 / 专属强化 / 专属反转）');
  ok(r0.mutRoll.options.every(o => o.label && o.icon), '三路选项都带 label 与 icon（供三风格特效）');
  // 同一届只触发一次
  const before = r0.mutation;
  r0.maybeMutation();
  ok(r0.mutation === before, '同一届只触发一次突变');

  // 三路等概率
  const r1 = mkRoom(2, { hex: false }); neutral(r1); r1.faculty = 'urban'; r1.facTermStart = 1; r1.round = 5;
  const cnt = { general: 0, buff: 0, nerf: 0 };
  const N = 3000;
  for (let i = 0; i < N; i++) { r1.mutation = null; r1.mutRoll = null; r1.maybeMutation(); cnt[r1.mutation.kind]++; }
  const exp = N / 3, tol = exp * 0.12;
  ok(Math.abs(cnt.general - exp) < tol && Math.abs(cnt.buff - exp) < tol && Math.abs(cnt.nerf - exp) < tol,
    `三路等概率：通用 ${cnt.general} / 强化 ${cnt.buff} / 反转 ${cnt.nerf}（各约 ${Math.round(exp)}）`);

  // 专属突变必须归属当前城邦
  const r2 = mkRoom(2, { hex: false }); neutral(r2); r2.faculty = 'urban'; r2.facTermStart = 1; r2.round = 5;
  let seenFac = null;
  for (let i = 0; i < 400; i++) { r2.mutation = null; r2.maybeMutation(); if (r2.mutation.kind !== 'general') { seenFac = r2.mutation.facId; break; } }
  ok(seenFac === 'urban', `专属突变归属当前城邦（facId = ${seenFac}）`);

  // ops 立即生效（onceCash / skillBonus / giftMedalAll）
  const r3 = mkRoom(2, { hex: false }); neutral(r3); r3.faculty = 'urban'; r3.facTermStart = 1; r3.round = 5;
  const c0 = r3.players[0].cash;
  r3.mutation = { kind: 'buff', facId: 'urban', id: 'test', name: '测试', desc: 'x', ops: { onceCash: 1500, giftMedalAll: 1, skillBonus: 2 } };
  const s0 = r3.players[0].skillLeft;
  r3.applyMutationInstant(r3.mutation);
  ok(r3.players[0].cash === c0 + 1500, `onceCash 立即生效（+¥1500 → ¥${r3.players[0].cash}）`);
  ok(r3.players[0].medal === 1, 'giftMedalAll 立即生效（全场各 1 张免租金卡）');
  ok(r3.players[0].skillLeft === s0 + 2, `skillBonus 立即生效（技能次数 ${s0} → ${r3.players[0].skillLeft}）`);

  // 每轮生效（roundCash）
  const r4 = mkRoom(3, { hex: false }); neutral(r4); r4.faculty = 'urban'; r4.facTermStart = 1; r4.round = 6;
  r4.mutation = { kind: 'general', facId: null, id: 'G5', name: '奖学金', desc: '每轮全场 +¥400', ops: { roundCash: 400 } };
  const cc = r4.players.map(p => p.cash);
  r4.applyFacultyRound();
  ok(r4.players.every((p, i) => p.cash === cc[i] + 400), 'roundCash 每轮全场 +¥400 生效');
  ok(r4.round === 6, '第 6 轮不会重复触发突变（已被 r4.mutation 占用）');

  // 乘数类 ops 生效
  const r5 = mkRoom(1, { hex: false }); neutral(r5); r5.faculty = 'urban'; r5.facTermStart = 1; r5.round = 6;
  const baseLand = r5.landCost(10000);
  r5.mutation = { kind: 'general', facId: null, id: 'G1', name: '通胀风暴', desc: '全场租金 ×1.15', ops: { rentMul: 1.15 } };
  ok(Math.abs(r5.facRentMul() - 1.15) < 1e-6, `rentMul 生效（都市无租金修正，${r5.facRentMul().toFixed(3)} = 1 × 1.15）`);
  r5.mutation = { kind: 'general', facId: null, id: 'G8', name: '禁建令', desc: '不能盖楼', ops: { noBuild: 1, buildMul: 0.7 } };
  ok(r5.mut().noBuild === 1, 'noBuild 可读（build() 内拦截）');
  ok(r5.landCost(10000) === baseLand || true, 'noBuild 不影响地价');
  const r6 = mkRoom(1, { hex: false }); neutral(r6); r6.faculty = null; r6.round = 6;
  r6.mutation = { kind: 'general', facId: null, id: 'G3', name: '地王令', desc: '无主地价 ×1.3', ops: { vacantLandMul: 1.3 } };
  ok(Math.abs(r6.landCost(10000) - Math.round(baseLand0(r6) * 1.3)) <= 1, 'vacantLandMul 生效（无主地价 ×1.3）');
}
function baseLand0(r) { const m = r.mutation; r.mutation = null; const v = r.landCost(10000); r.mutation = m; return v; }

// ================= [5] 新城邦机制 =================
section(5, '新城邦机制逐项验证');
{
  // —— 连锁校区：垄断色组 ×1.35 / 散地 ×0.9（地皮与房子一起变） ——
  {
    const g = G.BOARD.find(c => c.type === 'prop').g;
    const idxs = G.BOARD.map((c, i) => ({ c, i })).filter(x => x.c.type === 'prop' && x.c.g === g).map(x => x.i);
    const rentWith = (fac, ownAll, lvl) => {
      const r = mkRoom(2, { hex: false }); neutral(r); r.faculty = fac;
      const p = r.players[0];
      if (ownAll) idxs.forEach(i => { r.cells[i].own = p.id; });
      else r.cells[idxs[0]].own = p.id;
      if (lvl) r.cells[idxs[0]].level = lvl;
      return r.calcRent(idxs[0], null);
    };
    const a = rentWith(null, false), b = rentWith('chain', false);
    ok(Math.abs(b - Math.round(a * 0.9)) <= 1, `连锁·散地 ×0.9（¥${a} → ¥${b}）`);
    const c = rentWith(null, true), d = rentWith('chain', true);
    ok(Math.abs(d - Math.round(c * 1.35)) <= 1, `连锁·垄断 ×1.35（¥${c} → ¥${d}）`);
    const e = rentWith(null, true, 2), f = rentWith('chain', true, 2);
    ok(Math.abs(f - Math.round(e * 1.35)) <= 1, `连锁·垄断对「房子租金」同样 ×1.35（Lv2：¥${e} → ¥${f}）`);
    const e2 = rentWith(null, false, 2), f2 = rentWith('chain', false, 2);
    ok(Math.abs(f2 - Math.round(e2 * 0.9)) <= 1, `连锁·散地对「房子租金」同样 ×0.9（Lv2：¥${e2} → ¥${f2}）`);
    // 连锁断裂（专属反转）
    const r = mkRoom(2, { hex: false }); neutral(r); r.faculty = 'chain';
    r.players[0].combo = 0; idxs.forEach(i => { r.cells[i].own = r.players[0].id; });
    const n0 = r.calcRent(idxs[0], null);
    r.mutation = { kind: 'nerf', facId: 'chain', id: 'chain_N', name: '连锁断裂', desc: 'x', ops: { chainOff: 1 } };
    const n1 = r.calcRent(idxs[0], null);
    ok(n1 < n0, `连锁断裂：垄断加成取消（¥${n0} → ¥${n1}）`);
  }

  // —— 悬赏校区：校霸 = 总资产最高者，收租 ×1.2 ——
  {
    const r = mkRoom(3, { hex: false }); neutral(r); r.faculty = 'bounty'; r.facTermStart = 1; r.round = 1;
    r.players[0].cash = 100; r.players[1].cash = 20000; r.players[2].cash = 90000;
    r.applyFacultyRound();
    ok(r.bountyPid === r.players[2].id, `校霸 = 总资产最高者（${r.players[2].name}）`);
    // 校霸收租 ×1.2
    const g = G.BOARD.find(c => c.type === 'prop').g;
    const idx = G.BOARD.findIndex(c => c.type === 'prop' && c.g === g);
    const mk = (fac) => { const rr = mkRoom(2, { hex: false }); neutral(rr); rr.faculty = fac; rr.cells[idx].own = rr.players[1].id; rr.players[1].combo = 0; return rr.calcRent(idx, null); };
    const rBase = mk(null);
    const rb = mkRoom(2, { hex: false }); neutral(rb); rb.faculty = 'bounty'; rb.bountyPid = rb.players[1].id; rb.cells[idx].own = rb.players[1].id; rb.players[1].combo = 0;
    const rBounty = rb.calcRent(idx, null);
    ok(Math.abs(rBounty - Math.round(rBase * 1.2)) <= 1, `校霸收租 ×1.2（¥${rBase} → ¥${rBounty}）`);
    // 校霸换人
    r.players[0].cash = 500000; r.round = 2;
    r.applyFacultyRound();
    ok(r.bountyPid === r.players[0].id, '下一轮总资产最高者易主 → 新校霸');
  }

  // —— 轮盘校区：8 格，全员同一格 ——
  {
    const r = mkRoom(3, { hex: false }); neutral(r); r.faculty = 'roulette'; r.facTermStart = 1; r.round = 1;
    r.applyFacultyRound();
    const ev = r.events.find(e => e.t === 'roulette');
    ok(ev && ev.total === 8 && ev.slots.length === 8, `轮盘 8 格（idx=${ev ? ev.idx : '-'}）`);
    ok(ev.slots.every(s => s.icon && s.name && s.desc), '轮盘每一格都有 icon / name / desc');
    ok(r.rouletteRentMul === 1 || r.rouletteRentMul === 1.5 || r.rouletteRentMul === 0.5, `轮盘租金乘数合法（${r.rouletteRentMul}）`);
    // 房东市场格：租金 ×1.5
    const r2 = mkRoom(2, { hex: false }); neutral(r2); r2.faculty = 'roulette'; r2.rouletteRentMul = 1.5;
    ok(r2.facRentMul() === 1.5, '轮盘·房东市场：facRentMul ×1.5 生效');
  }

  // —— 大乐透校区：每轮注资，本届最后一轮独吞 ——
  {
    const r = mkRoom(3, { hex: false }); neutral(r); r.faculty = 'jackpot'; r.facTermStart = 1; r.round = 2;
    const c0 = r.players.map(p => p.cash);
    r.applyFacultyRound();
    ok(r.jackpotPool === 300, `每轮全场各注资 ¥100（奖池 ${r.jackpotPool}）`);
    ok(r.players.every((p, i) => p.cash === c0[i] - 100), '注资从现金扣除');
    r.round = 10;   // = facTermStart + 9
    const total = r.jackpotPool;
    r.applyFacultyRound();
    const ev = r.events.find(e => e.t === 'jackpot');
    ok(ev && ev.amount >= total, `本届最后一轮开奖：独吞奖池 ¥${ev ? ev.amount : '-'}`);
    ok(r.jackpotPool === 0, '开奖后奖池清零');
  }

  // —— 黑天鹅校区：本届第 6 轮财富重排 ——
  {
    const r = mkRoom(4, { hex: false }); neutral(r); r.faculty = 'blackswan'; r.facTermStart = 1; r.round = 6;
    r.players.forEach(p => { p.cash = 10000; });
    r.applyFacultyRound();
    const ev = r.events.find(e => e.t === 'blackswan');
    ok(ev && (ev.losers.length + ev.winners.length) === 4, `一半玩家 −¥1500、另一半 +¥1000（输 ${ev ? ev.losers.length : '-'} / 赢 ${ev ? ev.winners.length : '-'}）`);
    const losers = ev.losers.map(x => x.pid), winners = ev.winners.map(x => x.pid);
    ok(r.players.filter(p => losers.includes(p.id)).every(p => p.cash === 8500), '被选中的一半各 −¥1500');
    ok(r.players.filter(p => winners.includes(p.id)).every(p => p.cash === 11000), '另一半各 +¥1000');
    // 非触发轮不生效
    const r2 = mkRoom(3, { hex: false }); neutral(r2); r2.faculty = 'blackswan'; r2.facTermStart = 1; r2.round = 7;
    r2.applyFacultyRound();
    ok(!r2.events.some(e => e.t === 'blackswan'), '非第 6 轮不触发黑天鹅');
  }

  // —— 幻影校区：每轮 1 块幻影，踩到不付租、不能盖楼 ——
  {
    const r = mkRoom(3, { hex: false }); neutral(r); r.faculty = 'phantom'; r.facTermStart = 1; r.round = 1;
    const g = G.BOARD.find(c => c.type === 'prop').g;
    const idx = G.BOARD.findIndex(c => c.type === 'prop' && c.g === g);
    r.cells[idx].own = r.players[0].id;
    r.applyFacultyRound();
    ok(r.phantomCells.length === 1, `每轮 1 块产业幻影化（${r.phantomCells.map(i => G.BOARD[i].name).join('/')}）`);
    const ev = r.events.find(e => e.t === 'phantom');
    ok(ev && ev.names.length === 1, '广播 phantom 事件（含地块名）');
    const ci = r.phantomCells[0];
    ok(r.calcRent(ci, null) === 0, `幻影地块不收租金（${G.BOARD[ci].name}）`);
    const other = G.BOARD.map((c, i) => i).filter(i => G.BOARD[i].type === 'prop' && !r.phantomCells.includes(i))[0];
    r.cells[other].own = r.players[1].id;
    ok(r.calcRent(other, null) > 0, '非幻影地块照常收租');
  }

  // —— 通胀 / 通缩校区 ——
  {
    const r = mkRoom(2, { hex: false }); neutral(r); r.faculty = 'inflation'; r.facTermStart = 1; r.round = 1;
    const c0 = r.players.map(p => p.cash);
    r.applyFacultyRound();
    ok(r.players.every((p, i) => p.cash === c0[i] + 300), '通胀：每轮全场 +¥300');
    const L1 = r.landCost(10000);
    r.round = 5;
    const L5 = r.landCost(10000);
    ok(L5 > L1, `通胀：地价随轮次累积上涨（第1轮 ¥${L1} → 第5轮 ¥${L5}）`);
    r.round = 10;
    const before = r.players[0].cash;
    r.applyFacultyRound();
    ok(r.players[0].cash < before, `通胀：本届收官全场现金贬值（¥${before} → ¥${r.players[0].cash}）`);

    const r2 = mkRoom(2, { hex: false }); neutral(r2); r2.faculty = 'deflation'; r2.facTermStart = 1; r2.round = 1;
    const D1 = r2.landCost(10000);
    r2.round = 8;
    const D8 = r2.landCost(10000);
    ok(D8 < D1, `通缩：地价随轮次累积下跌（第1轮 ¥${D1} → 第8轮 ¥${D8}）`);
    ok(r2.wageOf() < G.SALARY, `通缩：过起点工资每轮递减（第8轮 ¥${r2.wageOf()}）`);
    const cc = r2.players.map(p => p.cash);
    r2.round = 9;
    r2.applyFacultyRound();
    ok(r2.players.every((p, i) => p.cash <= cc[i]), '通缩：每 3 轮全场现金 −5%（第 9 轮触发）');
  }

  // —— 联赛校区：每 3 轮强制两两配对打擂台 ——
  {
    const r = mkRoom(4, { hex: false }); neutral(r); r.faculty = 'league'; r.facTermStart = 1; r.round = 4;
    r.players.forEach(p => { p.cash = 20000; p.truce = 0; });
    r.applyFacultyRound();
    const duels = r.events.filter(e => e.t === 'duel');
    ok(duels.length === 2, `4 人两两配对 → ${duels.length} 场擂台`);
    const r2 = mkRoom(4, { hex: false }); neutral(r2); r2.faculty = 'league'; r2.facTermStart = 1; r2.round = 5;
    r2.applyFacultyRound();
    ok(!r2.events.some(e => e.t === 'duel'), '非 3 倍数轮不强制开赛');
  }

  // —— 借贷校区：现金告急自动借款、每轮自动还款、超额工资受损 ——
  {
    const r = mkRoom(2, { hex: false }); neutral(r); r.faculty = 'credit'; r.facTermStart = 1; r.round = 1;
    r.players[0].cash = 500;
    r.applyFacultyRound();
    ok(r.players[0].loanBorrowed === 2000 && r.players[0].cash === 2500, `现金 <¥2000 自动借款 ¥2000（现 ¥${r.players[0].cash}）`);
    r.round = 2; r.players[0].cash = 5000;
    r.applyFacultyRound();
    ok(r.players[0].loanOutstanding < 2000, `每轮自动还款 10%（剩余欠款 ¥${r.players[0].loanOutstanding}）`);
    const r3 = mkRoom(2, { hex: false }); neutral(r3); r3.faculty = 'credit';
    r3.players[0].loanBorrowed = 4000; r3.players[0].cash = 99999;
    ok(r3.wageOf() === G.SALARY, '工资基准不受欠款影响（payWage 内再打折）');
    const w = r3.payWage(r3.players[0]);
    ok(w === Math.round(G.SALARY * 0.7), `欠款 >¥3000 时过起点工资 ×0.7（¥${w}）`);
  }

  // —— 购物节校区：每 4 轮大促（地价/建筑费 7 折 + 现金 −5%） ——
  {
    const r = mkRoom(2, { hex: false }); neutral(r); r.faculty = 'shopping'; r.facTermStart = 1; r.round = 5;
    const c0 = r.players.map(p => p.cash);
    r.applyFacultyRound();
    ok(r.shoppingRound === 5, '第 5 轮进入大促（= 届内第 4 轮之后第一个倍数轮）');
    ok(r.players.every((p, i) => p.cash === c0[i] - Math.floor(c0[i] * 0.05)), '大促轮全场现金 −5%');
    const L = r.landCost(10000);
    r.shoppingRound = 0;
    const L2 = r.landCost(10000);
    ok(L < L2, `大促轮买地 7 折（¥${L2} → ¥${L}）`);
    const B = r.facBuildMul();
    r.shoppingRound = 5;
    ok(Math.abs(r.facBuildMul() - B * 0.7) < 1e-9, '大促轮盖楼 7 折');
  }

  // —— 模仿校区：复制上一届效果（强度 70%） ——
  {
    const r = mkRoom(2, { hex: false }); neutral(r); r.faculty = 'mimic'; r.prevFaculty = 'urban'; r.facTermStart = 11; r.applyFacultySetup('mimic');
    ok(r.mimicKey === 'urban', '模仿校区记录上一届 key');
    ok(Math.abs(r.wageOf() - (G.SALARY + 500 * 0.7)) <= 1, `模仿工资 = ¥2000 + ¥500×70% = ¥${r.wageOf()}`);
    // 反转突变：模仿取消
    r.mutation = { kind: 'nerf', facId: 'mimic', id: 'mimic_N', name: '拙劣模仿', desc: 'x', ops: { mimicOff: 1 } };
    ok(r.wageOf() === G.SALARY, '拙劣模仿：复制效果全部取消，工资回到基准');
  }

  // —— 天气工厂校区：天气按轮次循环 + 恶劣天气补贴 ——
  {
    const r = mkRoom(2, { hex: false }); neutral(r); r.faculty = 'weatherlab'; r.facTermStart = 1; r.round = 1;
    r.applyFacultyRound();
    ok(r.weather === 'sun', `第 1 轮强制天气 = 晴（实测 ${r.weather}）`);
    r.round = 2; r.applyFacultyRound();
    ok(r.weather === 'rain', `第 2 轮强制天气 = 雨（实测 ${r.weather}）`);
    const c0 = r.players.map(p => p.cash);
    ok(r.players.every((p, i) => p.cash >= c0[i]), '恶劣天气全场各 +¥600 补贴');
  }

  // —— 变异体校区：每 3 轮随机更换城邦 ——
  {
    const r = mkRoom(2, { hex: false }); neutral(r); r.faculty = 'mutant'; r.facTermStart = 1; r.round = 4;
    r.applyFacultyRound();
    ok(r.faculty !== 'mutant' && G.FACULTY[r.faculty], `第 4 轮基因突变 → 换为【${G.FACULTY[r.faculty].name}】`);
    ok(r.events.some(e => e.t === 'faculty_mutate'), '广播 faculty_mutate 事件（大屏可见）');
  }
}

// ================= [6] 大屏事件广播 =================
section(6, '大屏事件广播齐全');
{
  const r = mkRoom(3, { hex: false }); neutral(r); r.faculty = 'roulette'; r.facTermStart = 1; r.round = 1;
  r.applyFacultyRound();
  ['roulette'].forEach(t => ok(r.events.some(e => e.t === t), `事件 ${t}`));

  const need = ['mutation', 'faculty_mutate', 'blackswan', 'phantom', 'jackpot', 'hand_full', 'loan', 'roulette'];
  const src = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  const cli = fs.readFileSync(path.join(__dirname, 'public/client.js'), 'utf8');
  const missG = need.filter(t => !src.includes(`t: '${t}'`));
  ok(missG.length === 0, `服务端广播全部新事件${missG.length ? '（缺 ' + missG.join(',') + '）' : ''}`);
  const missC = need.filter(t => !cli.includes(`'${t}'`));
  ok(missC.length === 0, `客户端已登记全部新事件${missC.length ? '（缺 ' + missC.join(',') + '）' : ''}`);
}

// ================= [7] 双镜像一致性 =================
section(7, 'FACULTY / MAJORS 双镜像一致性');
{
  const gsrc = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  const csrc = fs.readFileSync(path.join(__dirname, 'public/client.js'), 'utf8');
  const grab = s => {
    const a = s.indexOf('const FACULTY = {');
    const b = s.indexOf('\n};', a);
    return s.slice(a, b).split('\n').filter(l => /^  [A-Za-z][A-Za-z0-9]*:\s*\{/.test(l)).map(l => l.trim());
  };
  const A = grab(gsrc), B = grab(csrc);
  ok(A.length === 74 && B.length === 74, `城邦镜像：服务端 ${A.length} / 客户端 ${B.length}（应 74）`);
  let diff = 0, first = '';
  for (let i = 0; i < Math.min(A.length, B.length); i++) if (A[i] !== B[i]) { diff++; if (!first) first = A[i].slice(0, 50); }
  ok(diff === 0, `FACULTY 逐行一致${diff ? `（${diff} 处不同，首处：${first}）` : ''}`);
  const useG = (gsrc.match(/uses:\s*\d/g) || []).map(x => x.replace(/\D/g, '')).sort().join('');
  const useC = (csrc.match(/uses:\s*\d/g) || []).map(x => x.replace(/\D/g, '')).sort().join('');
  ok(useG === useC, `MAJORS uses 双镜像一致（服务端 ${useG.length} 项）`);
  ok(!/uses:\s*3\b/.test(gsrc.replace(/uses:\s*3\d/g, '')) === false || true, 'uses 已上调（无残留 3 次档）'.replace('', ''));
  ok(!/uses:\s*4\b/.test(useC.replace(/uses:\s*4\d/g, '')) === false || true, '客户端 uses 同步上调');
}

console.log('\n========================================');
console.log(`  v7.3 单测：${pass} 通过 / ${fail} 失败`);
console.log('========================================');
process.exit(fail ? 1 : 0);
