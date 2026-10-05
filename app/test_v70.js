#!/usr/bin/env node
// v7.0 单测：效果卡品级系统 / 24 张新卡 / 手动发动与响应 / 海克斯奖励卡三张翻面卡 /
//          重投封顶与轮次涨价 / 缴税分档 / 经济微调 / 城邦影响加强 / 大厅准备
'use strict';
const path = require('path');
const fs = require('fs');
const G = require('./game');

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.error('  ✗ ' + name); } };
const section = (n, t) => console.log(`\n[${n}] ${t}`);

function mkRoom(n = 3, opts) {
  const room = new G.Room('v70' + Math.floor(Math.random() * 1e6), Object.assign({ hex: true, faculty: true, draft: true }, opts || {}));
  for (let i = 0; i < n; i++) room.join('P' + (i + 1), i > 0);
  room.start(); room.clearTimer(); room.clearAiTimers();
  return room;
}

// ================= [1] 效果卡品级系统 =================
section(1, '效果卡池：34 张 · 品级齐全 · 权重 15/25/35/25');
{
  ok(G.EFFECT_CARDS.length === 34, `卡池 34 张（实际 ${G.EFFECT_CARDS.length}）`);
  const ids = G.EFFECT_CARDS.map(c => c.id);
  ok(new Set(ids).size === ids.length, '卡 id 唯一');
  ok(G.EFFECT_CARDS.every(c => ['SSR', 'SR', 'R', 'N'].includes(c.rare)), '每张卡都有合法品级');
  ok(G.EFFECT_CARDS.every(c => c.name && c.icon && c.desc && c.mode), '每张卡都有 name/icon/desc/mode');
  const w = G.CARD_RARITY;
  ok(w.SSR.weight === 15 && w.SR.weight === 25 && w.R.weight === 35 && w.N.weight === 25, '权重 SSR15 / SR25 / R35 / N25');
  // 原有卡定级：免租金卡 / 万能卡 = SR，其余原有 = R
  const byId = id => G.EFFECT_CARDS.find(c => c.id === id) || {};
  ok(byId('medal').rare === 'SR' && byId('joker').rare === 'SR', '免租金卡 / 万能卡 = SR');
  ['skill', 'discount', 'buildcut', 'step', 'cash', 'stayfree', 'finefree', 'steal'].forEach(id =>
    ok(byId(id).rare === 'R', `原有卡 ${id} = R`));
  // 24 张新增卡齐全
  const NEW10 = ['seize', 'demolish', 'repeat', 'forcetax', 'forceroll', 'challenge', 'snatch', 'dismantle', 'backstep', 'reverse'];
  const NEW14 = ['branchcard', 'redeemcard', 'flawless', 'copycard', 'skillfull', 'truce', 'insure', 'funddiv', 'charity', 'investcard', 'rentx2', 'renthalf', 'revive', 'auctionvouch'];
  ok([...NEW10, ...NEW14].every(id => byId(id).name), '24 张新增卡全部入池');
  ok(byId('demolish').rare === 'SSR' && byId('snatch').rare === 'SR' && byId('repeat').rare === 'N'
    && byId('skillfull').rare === 'SSR' && byId('copycard').rare === 'SSR' && byId('revive').rare === 'SSR'
    && byId('flawless').rare === 'R' && byId('charity').mode === 'instant', '关键新卡品级 / 模式正确');
  // 权重抽样（20000 次）
  const cnt = { SSR: 0, SR: 0, R: 0, N: 0 };
  for (let i = 0; i < 20000; i++) cnt[G.drawEffectCard().rare]++;
  const ratio = k => cnt[k] / 20000;
  ok(Math.abs(ratio('SSR') - .15) < .02 && Math.abs(ratio('SR') - .25) < .025
    && Math.abs(ratio('R') - .35) < .03 && Math.abs(ratio('N') - .25) < .025,
    `抽样分布贴合 15/25/35/25（实得 ${(ratio('SSR') * 100).toFixed(1)}/${(ratio('SR') * 100).toFixed(1)}/${(ratio('R') * 100).toFixed(1)}/${(ratio('N') * 100).toFixed(1)}）`);
  // 不重复抽 n 张
  const three = G.drawEffectCards(3);
  ok(three.length === 3 && new Set(three.map(c => c.id)).size === 3, '抽 3 张互不重复');
}

// ================= [2] 客户端 EFFECT_CARDS 镜像逐字一致 =================
section(2, '客户端 EFFECT_CARDS 镜像与服务端逐字一致');
{
  const srv = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  const cli = fs.readFileSync(path.join(__dirname, 'public', 'client.js'), 'utf8');
  const grab = (src) => {
    const i = src.indexOf('const EFFECT_CARDS = [');
    if (i < 0) return null;
    const j = src.indexOf('\n];', i);
    return src.slice(src.indexOf('[', i), j + 3).replace(/\r/g, '');
  };
  const a = grab(srv), b = grab(cli);
  ok(!!a && !!b, '两端都能取到 EFFECT_CARDS 表');
  ok(a === b, `两端 EFFECT_CARDS 逐字一致（${(a || '').length} 字节）`);
  ok(G.EFFECT_CARDS.length === 34, '镜像张数 = 34');
}

// ================= [3] 重投骰封顶 4000 + 第 6 轮起每 2 轮自动 +55 =================
section(3, '重投价格：首价 800 + 个人次数 ×70，第 6 轮起每 2 轮 +55，封顶 4000');
{
  const r = mkRoom(2);
  const p = r.players[0];
  r.round = 1; p.rerollCount = 0;
  ok(r.rerollCostFor(p) === 800, `第 1 轮首投 ¥800（实际 ${r.rerollCostFor(p)}）`);
  p.rerollCount = 3;
  ok(r.rerollCostFor(p) === 800 + 70 * 3, `个人第 4 次 ¥${800 + 70 * 3}`);
  p.rerollCount = 0; r.round = 6;
  ok(r.rerollCostFor(p) === 800 + 55, `第 6 轮基础价 +55 → ¥855（实际 ${r.rerollCostFor(p)}）`);
  r.round = 8;
  ok(r.rerollCostFor(p) === 800 + 110, `第 8 轮 +110 → ¥910（实际 ${r.rerollCostFor(p)}）`);
  r.round = 100; p.rerollCount = 99;
  ok(r.rerollCostFor(p) === 4000, `极端叠加封顶 ¥4000（实际 ${r.rerollCostFor(p)}）`);
  // 单调不减
  let prev = 0, mono = true;
  for (let rd = 1; rd <= 120; rd += 1) { r.round = rd; p.rerollCount = 0; const c = r.rerollCostFor(p); if (c < prev) mono = false; prev = c; }
  ok(mono, '价格随轮次单调不减');
}

// ================= [4] 缴税分档：超 10 块地皮部分每块 130 =================
section(4, '物业税：建筑 130/170/200 分档 · 地皮超 10 块每块 +130（不再是 90+130）');
{
  const r = mkRoom(2);
  const p = r.players[0];
  const propIdx = G.BOARD.map((c, i) => ({ c, i })).filter(x => x.c.type === 'prop').map(x => x.i);
  // 10 块裸地 → 0 税
  r.cells.forEach(cs => { cs.own = null; cs.level = 0; cs.mortgaged = false; });
  propIdx.slice(0, 10).forEach(i => { r.cells[i].own = p.id; });
  ok(r.taxFor(p).tax === 0, '10 块裸地免税');
  // 13 块裸地 → 3 × 130 = 390
  propIdx.slice(0, 13).forEach(i => { r.cells[i].own = p.id; });
  const t13 = r.taxFor(p);
  ok(t13.hold === 13 && t13.tax === 3 * 130, `13 块裸地 = 3×130 = ¥390（实际 ¥${t13.tax}）`);
  // 14 块 → 4 × 130 = 520
  propIdx.slice(0, 14).forEach(i => { r.cells[i].own = p.id; });
  ok(r.taxFor(p).tax === 4 * 130, `14 块裸地 = ¥520（实际 ¥${r.taxFor(p).tax}）`);
  // 建筑分档：第 6~10 栋 130
  r.cells.forEach(cs => { cs.own = null; cs.level = 0; cs.mortgaged = false; });
  propIdx.slice(0, 8).forEach(i => { r.cells[i].own = p.id; r.cells[i].level = 1; });
  ok(r.taxFor(p).tax === 3 * 130, `8 栋（超出 6 的 3 栋 ×130）= ¥390（实际 ¥${r.taxFor(p).tax}）`);
  // 15 栋（10 块地皮上堆 15 层）：6~10 五栋×130 + 11~15 五栋×170，地皮不超过 10 块故无地皮税
  r.cells.forEach(cs => { cs.own = null; cs.level = 0; cs.mortgaged = false; });
  propIdx.slice(0, 10).forEach((i, k) => { r.cells[i].own = p.id; r.cells[i].level = k < 5 ? 2 : 1; });
  const t15 = r.taxFor(p);
  ok(t15.bld === 15 && t15.hold === 10 && t15.tax === 5 * 130 + 5 * 170, `15 栋 = 5×130 + 5×170 = ¥${5 * 130 + 5 * 170}（实际 ¥${t15.tax}）`);
  // 18 栋 + 10 块地皮：再加 3×200
  r.cells.forEach(cs => { cs.own = null; cs.level = 0; cs.mortgaged = false; });
  propIdx.slice(0, 10).forEach((i, k) => { r.cells[i].own = p.id; r.cells[i].level = k < 8 ? 2 : 1; });
  const t18 = r.taxFor(p);
  ok(t18.bld === 18 && t18.tax === 5 * 130 + 5 * 170 + 3 * 200, `18 栋 = 5×130+5×170+3×200（实际 ¥${t18.tax}）`);
  // 抵押地不计税
  r.cells.forEach(cs => { cs.own = null; cs.level = 0; cs.mortgaged = false; });
  propIdx.slice(0, 13).forEach(i => { r.cells[i].own = p.id; });
  r.cells[propIdx[0]].mortgaged = true;
  ok(r.taxFor(p).hold === 12 && r.taxFor(p).tax === 2 * 130, '抵押地不计入税基');
}

// ================= [5] 经济微调：盖房价 ×1.05 / 地皮租金 ×1.06 =================
section(5, '经济：盖房价小幅上调（四舍五入到 10）· 有建筑的租金 ×1.06（v7.1：裸地不上调）');
{
  ok(G.GROUPS.g1.build === 890 && G.GROUPS.g5.build === 2310 && G.GROUPS.g10.build === 4310,
    `盖房价上调：g1 850→890 / g5 2200→2310 / g10 4100→4310`);
  const r = mkRoom(2);
  const propIdx = G.BOARD.map((c, i) => ({ c, i })).filter(x => x.c.type === 'prop').map(x => x.i)[0];
  const a = r.players[0], b = r.players[1];
  r.cells[propIdx].own = a.id; r.cells[propIdx].level = 0;
  r.faculty = null; r.season = 'mid'; r.weather = 'cloud'; r.calEvent = null;
  // v7.1 修正：裸地（地皮）租金**不**上调 —— 维持 v6.0 的「基础租金 ×1.3」
  const base = G.BOARD[propIdx].rent;
  const got = r.calcRent(propIdx, [2, 5]);
  const want = Math.round(base * 1.3);
  ok(Math.abs(got - want) <= 1, `地皮裸地租金 ${base}×1.3 → ${got}（v7.1 不再 ×1.06，期望 ${want}）`);
  ok(got === Math.round(base * 1.3), '裸地租金与 v6.0 完全一致（本次上调不含裸地）');
  // v7.1：上调只作用于「有建筑的租金」—— 1~3 栋房 / 旅馆
  const gp = G.GROUPS[G.BOARD[propIdx].g], scl = base / gp.refRent;
  const b1 = Math.round(gp.rents[0] * scl), b3 = Math.round(gp.rents[2] * scl), b4 = Math.round(gp.rents[3] * scl);
  r.cells[propIdx].level = 1;
  const r1 = r.calcRent(propIdx, [2, 5]);
  ok(Math.abs(r1 - Math.round(b1 * 1.06)) <= 1, `1 栋房租金 ${b1}×1.06 → ${r1}（期望 ${Math.round(b1 * 1.06)}）`);
  r.cells[propIdx].level = 3;
  const r3 = r.calcRent(propIdx, [2, 5]);
  ok(Math.abs(r3 - Math.round(b3 * 1.06)) <= 1, `3 栋房租金 ${b3}×1.06 → ${r3}（期望 ${Math.round(b3 * 1.06)}）`);
  r.cells[propIdx].level = 4;
  const r4 = r.calcRent(propIdx, [2, 5]);
  ok(Math.abs(r4 - Math.round(b4 * 1.06)) <= 1, `旅馆租金 ${b4}×1.06 → ${r4}（期望 ${Math.round(b4 * 1.06)}）`);
  r.cells[propIdx].level = 0;
  // 非地皮类（机场）不加乘子
  const tIdx = G.BOARD.findIndex(c => c.type === 'transport');
  r.cells.forEach((cs, i) => { if (G.BOARD[i].type === 'transport') cs.own = null; });
  r.cells[tIdx].own = a.id;
  const tv = r.calcRent(tIdx, [2, 5]);
  ok(tv === 800, `机场（仅持 1 座）租金不受 1.06 影响（${tv}）`);
  // 公用事业同样不受影响
  const uIdx = G.BOARD.findIndex(c => c.type === 'util');
  r.cells.forEach((cs, i) => { if (G.BOARD[i].type === 'util') cs.own = null; });
  r.cells[uIdx].own = a.id;
  ok(r.calcRent(uIdx, [2, 5]) === 700, `公用事业（持 1 家、点数 7）租金 ¥700 不受 1.06 影响`);
}

// ================= [6] 海克斯触发轮 = 15 次 =================
section(6, '海克斯触发轮：2/8/16/25/32/40/49/55/62/70/77/85/91/100/110（共 15 次）');
{
  ok(G.HEX_TRIGGERS.length === 15, `触发轮共 15 次（实际 ${G.HEX_TRIGGERS.length}）`);
  ok(JSON.stringify(G.HEX_TRIGGERS) === JSON.stringify([2, 8, 16, 25, 32, 40, 49, 55, 62, 70, 77, 85, 91, 100, 110]),
    '触发轮数值与需求一致');
  ok(G.HEX_TRIGGERS.every((v, i, a) => i === 0 || v > a[i - 1]), '触发轮严格递增');
  ok(JSON.stringify(G.HEX_TRIGGERS_EARLY) === JSON.stringify([2, 6, 12, 19, 26, 33, 40, 47, 54, 61, 68, 75, 82, 88, 94]),
    'v7.1 时光之城提前表 = 2/6/12/19/26/33/40/47/54/61/68/75/82/88/94（15 次全部提前）');
  ok(G.HEX_TRIGGERS_EARLY.every((v, i) => i === 0 ? v === G.HEX_TRIGGERS[0] : v < G.HEX_TRIGGERS[i]),
    '提前表 15 项逐项早于常规表');
}

// ================= [7] 城邦影响加强抽查 =================
section(7, '城邦加强：数值上调 + 机制提高频率');
{
  const r = mkRoom(3);
  const F = G.FACULTY;
  ok(F.lantern.lead.includes('220'), '灯会校区 150 → 220');
  ok(F.midterm.lead.includes('520'), '期中周校区 400 → 520');
  ok(F.professor.lead.includes('每 2 轮'), '名师校区 每 3 轮 → 每 2 轮');
  ok(F.freshman.lead.includes('2000'), '新生校区 1500 → 2000');
  ok(F.stampede.lead.includes('450') && F.stampede.cost.includes('220'), '早八校区 300/−150 → 450/−220');
  ok(F.observatory.lead.includes('600') && F.observatory.cost.includes('300'), '观星校区 400/−220 → 600/−300');
  ok(F.runner.lead.includes('400'), '校车站校区 250 → 400');
  ok(F.metro.lead.includes('0.80'), '地铁校区 机场 ×0.85 → ×0.80');
  // 实际结算
  const q = r.players[0];
  r.faculty = 'lantern';
  for (const x of r.players) x.cash = 10000;
  r.applyFacultyRound();
  ok(r.players.every(x => x.cash === 10220), '灯会实际结算 +¥220');
  r.faculty = 'stampede'; q.cash = 10000;
  r.facRollFx(q, 7, false);
  ok(q.cash === 10450, '早八 7 点实际 +¥450');
  r.faculty = 'runner';
  r.facRollFx(q, 4, true);
  ok(q.cash === 10850, '校车站双数实际 +¥400');
}

// ================= [8] 大厅准备 =================
section(8, '大厅：准备按钮 · 全员就绪才能开始');
{
  const r = new G.Room('v70lob', { hex: true, faculty: true, draft: true });
  r.join('A', false); r.join('B', false);
  ok(r.allReady() === false, '两人都未准备 → 未就绪');
  r.setReady(r.players[0], true);
  ok(r.allReady() === false, '只有 1 人准备 → 未就绪');
  ok(r.players[0].ready === true && r.players[1].ready === false, '准备状态记录在玩家身上');
  r.setReady(r.players[1], true);
  ok(r.allReady() === true, '两人都准备 → 就绪');
  r.setReady(r.players[0], false);
  ok(r.allReady() === false, '取消准备 → 未就绪');
  const r2 = new G.Room('v70lob2', { hex: true, faculty: true, draft: true });
  r2.join('A', false); r2.join('AI', true);
  ok(r2.players[1].ready === true, 'AI 加入即视为已准备');
  ok(r2.allReady() === false, '仅 1 名真人未准备 → 仍未就绪');
  r2.setReady(r2.players[0], true);
  ok(r2.allReady() === true, '真人准备 + AI → 就绪');
}

// ================= [9] 手动发动效果卡 =================
section(9, '手动发动：夺金券 / 拆迁令 / 顺手牵羊 / 过河拆桥 / 后退卡');
{
  const r = mkRoom(3);
  const [a, b] = r.players;
  a.hand = []; a.handSeq = 0;
  // 夺金券：抽 ¥800
  r.addHandCard(a, 'seize');
  r.phase = 'card'; r.pendingCard = { pid: a.id }; r.cur = 0;
  a.cash = 5000; b.cash = 4000;
  r.useCard(a, a.hand[0].uid, { target: b.id });
  ok(a.cash === 5800 && b.cash === 3200, `夺金券 ¥800（我方 ${a.cash} / 对方 ${b.cash}）`);
  ok(a.hand.length === 0, '发动后手牌消耗');
  // 拆迁令：拆 1 层
  const pi = G.BOARD.map((c, i) => ({ c, i })).filter(x => x.c.type === 'prop').map(x => x.i)[0];
  r.cells[pi].own = b.id; r.cells[pi].level = 2;
  r.addHandCard(a, 'demolish');
  r.phase = 'card'; r.pendingCard = { pid: a.id };
  r.useCard(a, a.hand[0].uid, { target: b.id, cell: pi });
  ok(r.cells[pi].level === 1, `拆迁令拆掉 1 层（剩 Lv${r.cells[pi].level}）`);
  // 顺手牵羊：偷一张卡
  b.hand = []; b.handSeq = 0;
  r.addHandCard(b, 'rentx2');   // auto 类：计数在 b.rentX2
  r.addHandCard(a, 'snatch');
  r.phase = 'card'; r.pendingCard = { pid: a.id };
  const before = (a.rentX2 || 0);
  r.useCard(a, a.hand[0].uid, { target: b.id });
  ok(b.rentX2 === 0 && a.rentX2 === before + 1, `顺手牵羊把「租金翻倍券」偷到手（我方 ${a.rentX2} 张）`);
  // 过河拆桥：弃一张
  b.medal = 2;
  r.addHandCard(a, 'dismantle');
  r.phase = 'card'; r.pendingCard = { pid: a.id };
  r.useCard(a, a.hand[0].uid, { target: b.id });
  const bLeft = b.medal + (b.hand || []).length + (b.fineFree || 0) + (b.stayFree || 0) + (b.joker || 0);
  ok(b.medal === 1, `过河拆桥弃掉 1 张（对方免租金卡 ${b.medal}）`);
  // 后退卡 / 反向骰子卡 / 岔路卡：只设置标记
  r.addHandCard(a, 'backstep'); r.phase = 'card'; r.pendingCard = { pid: a.id };
  r.useCard(a, a.hand[0].uid, {});
  ok(a.backstep === 1, '后退卡设置 backstep 标记');
  r.addHandCard(a, 'reverse'); r.phase = 'card'; r.pendingCard = { pid: a.id };
  r.useCard(a, a.hand[0].uid, {});
  ok(a.reverseDice === 1, '反向骰子卡设置 reverseDice 标记');
  r.addHandCard(a, 'branchcard'); r.phase = 'card'; r.pendingCard = { pid: a.id };
  r.useCard(a, a.hand[0].uid, {});
  ok(a.branchCard === 1, '岔路卡设置 branchCard 标记');
  r.clearTimer(); r.clearAiTimers();
}

// ================= [10] 响应式：无懈可击卡 =================
section(10, '响应：进攻卡给目标一次「万能卡 / 无懈可击卡」的响应机会');
{
  const r = mkRoom(2);
  const [a, b] = r.players;
  a.cash = 5000; b.cash = 5000;
  // 无懈可击：b 手上有，响应后攻击失效
  b.hand = []; b.handSeq = 0;
  r.addHandCard(b, 'flawless');
  r.addHandCard(a, 'seize');
  r.phase = 'card'; r.pendingCard = { pid: a.id };
  r.useCard(a, a.hand[0].uid, { target: b.id });
  ok(r.phase === 'negate' && r.pendingNegate && r.pendingNegate.pid === b.id, '进攻卡触发 negate 相位询问被攻击方');
  const before = { a: a.cash, b: b.cash };
  r.useNegate(b, true);
  ok(a.cash === before.a && b.cash === before.b, '使用无懈可击卡 → 夺金券完全失效（双方现金不变）');
  ok(b.hand.filter(h => h.id === 'flawless').length === 0, '无懈可击卡被消耗');
  r.clearTimer(); r.clearAiTimers();
  // 放弃响应 → 正常结算
  const r2 = mkRoom(2);
  const [a2, b2] = r2.players;
  a2.cash = 5000; b2.cash = 5000;
  b2.hand = []; b2.handSeq = 0;
  r2.addHandCard(b2, 'flawless');
  r2.addHandCard(a2, 'seize');
  r2.phase = 'card'; r2.pendingCard = { pid: a2.id };
  r2.useCard(a2, a2.hand[0].uid, { target: b2.id });
  r2.useNegate(b2, false);
  ok(a2.cash === 5800 && b2.cash === 4200, '放弃响应 → 夺金券正常生效（¥800）');
  ok(b2.hand.some(h => h.id === 'flawless'), '放弃响应的无懈可击卡保留');
  r2.clearTimer(); r2.clearAiTimers();
  // 万能卡自动抵消（不进入 negate 相位）
  const r3 = mkRoom(2);
  const [a3, b3] = r3.players;
  a3.cash = 5000; b3.cash = 5000; b3.joker = 1;
  r3.addHandCard(a3, 'seize');
  r3.phase = 'card'; r3.pendingCard = { pid: a3.id };
  r3.useCard(a3, a3.hand[0].uid, { target: b3.id });
  ok(r3.phase !== 'negate' && b3.joker === 0 && b3.cash === 5000, '万能卡自动抵消（不进询问，现金不变）');
  r3.clearTimer(); r3.clearAiTimers();
}

// ================= [11] 海克斯奖励卡：三张翻面卡 =================
section(11, '海克斯奖励卡：每位存活玩家三张翻面卡随机抽一张');
{
  const r = mkRoom(3);
  r.round = 16; r.hexDoneRounds = []; r.phase = 'roll'; r.project = null;
  ok(r.maybeProject() === true, '第 16 轮开启立项');
  for (const p of r.players) r.pickProject(p, r.project.offers[p.id][0]);
  ok(r.phase === 'carddraft' && !!r.draft, '立项结算后进入 carddraft 阶段（附赠奖励卡）');
  const alive = r.alive();
  ok(alive.every(p => (r.draft.offers[p.id] || []).length === 3), '每位存活玩家 3 张候选');
  ok(alive.every(p => new Set(r.draft.offers[p.id].map(c => c.id)).size === 3), '同一玩家的 3 张互不重复');
  const all = alive.flatMap(p => r.draft.offers[p.id].map(c => c.id));
  ok(all.length === alive.length * 3, `共发出 ${all.length} 张候选（每人 3 张 · 各人抽到的可以不同）`);
  ok(r.draft.offers[alive[0].id].every(c => c.rare), '候选卡带品级（前端按品级展示）');
  // 逐个选择
  const handBefore = alive.map(p => (p.hand || []).length + (p.medal || 0) + (p.rentX2 || 0) + (p.joker || 0) + (p.insure || 0));
  r.pickDraftCard(alive[0], 0);
  ok(r.draft && r.pickDraftCard(alive[0], 1) === undefined && r.draft.picks[alive[0].id] === 0, '同一玩家不能重复抽');
  for (const p of alive.slice(1)) r.pickDraftCard(p, 1);
  ok(r.draft === null && r.phase !== 'carddraft', '全员选完自动结算并离开 carddraft');
  ok(r.log.some(l => String(l.msg || l).includes('海克斯奖励卡')), '日志记录了奖励卡环节');
  r.clearTimer(); r.clearAiTimers();
  // AI 自动选：优先高品级
  const r2 = mkRoom(3);
  r2.draft = { round: 1, offers: {}, picks: {} };
  const ai = r2.players[0];
  r2.draft.offers[ai.id] = [{ id: 'repeat', rare: 'N' }, { id: 'demolish', rare: 'SSR' }, { id: 'seize', rare: 'R' }];
  r2.phase = 'carddraft';
  r2.aiDraft(ai);
  ok(r2.draft.picks[ai.id] === 1, 'AI 优先选最高品级的卡（SSR）');
  r2.clearTimer(); r2.clearAiTimers();
  // 超时兜底不卡死
  const r3 = mkRoom(3);
  r3.round = 16; r3.hexDoneRounds = []; r3.phase = 'roll'; r3.project = null;
  r3.maybeProject();
  for (const p of r3.players) r3.pickProject(p, r3.project.offers[p.id][0]);
  ok(r3.phase === 'carddraft', '进入奖励卡阶段');
  r3.settleDraft();
  ok(r3.draft === null && r3.phase !== 'carddraft', 'settleDraft 兜底后离开奖励卡阶段并推进回合');
  r3.clearTimer(); r3.clearAiTimers();
}

// ================= [12] 自动 / 即时型新卡结算 =================
section(12, '自动 / 即时型：基金分红券 / 投资券 / 慈善捐 / 复活卡 / 资产保护卡 / 免战牌');
{
  const r = mkRoom(2);
  const [a, b] = r.players;
  // 基金分红券
  r.fundPool = 10000; a.cash = 1000;
  r.applyEffectCard(a, G.EFFECT_CARDS.find(c => c.id === 'funddiv'));
  ok(a.cash === 2500 && r.fundPool === 8500, `基金分红券 15% 保底（+¥1500 / 池 -¥1500）`);
  // 投资券
  a.cash = 5000; r.round = 10;
  r.applyEffectCard(a, G.EFFECT_CARDS.find(c => c.id === 'investcard'));
  ok(a.cash === 3000 && a.investCards.length === 1 && a.investCards[0].due === 15, '投资券投入 ¥2000，第 15 轮返还');
  // 慈善捐（即时）
  a.cash = 5000; r.fundPool = 0;
  r.applyEffectCard(a, G.EFFECT_CARDS.find(c => c.id === 'charity'));
  ok(a.cash === 4500 && r.fundPool === 1500, '慈善捐：自己缴 ¥500，基金池 +¥1500');
  // 资产保护卡
  a.insure = 1; a.cash = 1000;
  ok(r.checkLandInsure(a, '测试拆楼') === true && a.cash === 2500 && a.insure === 0, '资产保护卡理赔 ¥1500');
  // 免战牌
  a.truce = 1;
  ok(r.tryTruce(a, '擂台') === true && a.truce === 0, '免战牌拒绝一次挑战');
  // 复活卡：破产时自动发动，带 ¥3000 回来
  const r2 = mkRoom(2);
  const [x, y] = r2.players;
  x.revive = 1; x.cash = 0;
  x.medal = 0; x.hand = [];
  r2.cells.forEach(cs => { if (cs.own === x.id) { cs.own = null; cs.level = 0; } });
  r2.bankrupt(x, y);
  ok(x.alive === true && x.cash === 3000 && x.revive === 0, `复活卡自动发动：破产后带着 ¥3000 复活（现金 ${x.cash}）`);
  r2.clearTimer(); r2.clearAiTimers();
}

// ================= [13] 手持卡枚举 / 移除（供偷卡、拆卡使用） =================
section(13, '持有卡枚举与移除：手牌 + 各类计数器 + 折扣 + 移动加成');
{
  const r = mkRoom(2);
  const a = r.players[0];
  a.hand = []; a.handSeq = 0;
  r.addHandCard(a, 'seize');
  a.medal = 1; a.joker = 1; a.stepBuffs = [3]; a.discount = true; a.rentX2 = 2; a.revive = 1;
  const L = r.heldCardList(a);
  const srcs = new Set(L.map(x => x.src));
  ok(srcs.has('hand') && srcs.has('medal') && srcs.has('joker') && srcs.has('stepBuffs') && srcs.has('discount') && srcs.has('rentX2') && srcs.has('revive'),
    `枚举覆盖 hand/medal/joker/stepBuffs/discount/rentX2/revive（共 ${L.length} 张）`);
  const before = L.length;
  r.removeHeldCard(a, L.find(x => x.src === 'rentX2'));
  ok(r.heldCardList(a).length === before - 1 && a.rentX2 === 1, '按 src 精确移除（租金翻倍券 2 → 1）');
  r.removeHeldCard(a, r.heldCardList(a).find(x => x.src === 'stepBuffs'));
  ok(a.stepBuffs.length === 0, '移除 stepBuffs 队列项');
  r.removeHeldCard(a, r.heldCardList(a).find(x => x.src === 'discount'));
  ok(a.discount === false, '移除折扣卡');
  r.clearTimer(); r.clearAiTimers();
}

// ================= [14] 服务器协议与快照 =================
section(14, '服务端：快照暴露 hand / pendingCard / pendingNegate / draft / allReady · 动作路由齐全');
{
  const srv = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  ok(/pendingCard: room\.pendingCard/.test(srv), '快照含 pendingCard');
  ok(/pendingNegate: room\.pendingNegate/.test(srv), '快照含 pendingNegate');
  ok(/allReady: room\.allReady/.test(srv), '快照含 allReady');
  ok(/draft: room\.draft/.test(srv), '快照含 draft（奖励卡浮层重连可恢复）');
  ok(/hand: \(p\.hand \|\| \[\]\)/.test(srv), '快照含 hand（手动发动手牌）');
  ok(/case 'useCard'/.test(srv) && /case 'skipCard'/.test(srv) && /case 'useNegate'/.test(srv)
    && /case 'pickDraft'/.test(srv) && /case 'ready'/.test(srv), '动作路由 useCard/skipCard/useNegate/pickDraft/ready 齐全');
  ok(/draft: true/.test(srv), '线上建房开启 draft 开关');
  ok(/room\.allReady && room\.allReady\(\)/.test(srv), 'start 动作受「全员准备」门控');
}

// ================= [15] 前端：品级 / 三张翻面卡 / 手动面板 / 响应框 =================
section(15, '前端：品级样式 · 三张翻面卡 · 手动发动面板 · 无懈可击响应框 · 大厅准备');
{
  const cli = fs.readFileSync(path.join(__dirname, 'public', 'client.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf8');
  // 专业去档位 + 技能介绍完整展开
  ok(!/mj-tier/.test(cli), '选专业界面已去掉 ★ 档位标记');
  ok(!/mj-tier/.test(css) && !/\.major-btn\s+\.mj-skill[^}]*line-clamp/.test(css), '样式表里档位样式已移除、技能介绍不再截断');
  // 品级
  ok(/const RAR_UI = \{/.test(cli) && /rarOf/.test(cli) && /cardFaceHtml/.test(cli), '客户端有品级表与卡面渲染');
  ok(/\.cf-face\.rar-SSR/.test(css) && /\.cf-face\.rar-SR/.test(css), 'SSR/SR 卡面有独立美术');
  // 三张翻面卡
  ok(/function cardDraftOpen/.test(cli) && /function revealDraft/.test(cli) && /\.cd-slot\.flipped/.test(css),
    '三张翻面卡动画（翻面 + 一起揭开）已实现');
  ok(/cdWin/.test(css) && /cfSheen/.test(css) && /cfxRay/.test(css), '卡牌动效含闪光 / 光轴 / 选中弹跳');
  ok(/act\(\{ type: 'pickDraft'/.test(cli), '翻卡选择回传 pickDraft');
  // 手动发动 / 响应
  ok(/function cardPanelSync/.test(cli) && /case 'skipCard'|type: 'skipCard'/.test(cli), '手动发动面板 + 跳过按钮');
  ok(/function negateSync/.test(cli) && /useNegate/.test(cli), '无懈可击响应框');
  ok(/card_act/.test(cli) && /case 'card_act'/.test(cli), '卡牌发动全屏特效事件已接线');
  ok(/'card_draft_offer'/.test(cli) && /'card_draft_done'/.test(cli), '奖励卡事件进入动画队列');
  // 大厅准备
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  ok(/id="btnReady"/.test(html), '大厅有准备按钮');
  ok(/function renderLobby/.test(cli) && /btnStart\.disabled = S\.players\.length < 2 \|\| !allReady/.test(cli),
    '未全员准备时「开始游戏」禁用');
  ok(/\.ready-bar/.test(css) && /\.player-item\.ready/.test(css), '准备栏与玩家就绪态样式');
}

// ================= [16] 兼容开关：未开启 draft 时不改变旧流程 =================
section(16, '兼容：未开 draft 的房局 settleProject 直接回到掷骰');
{
  const r = new G.Room('v70off', { hex: true, faculty: true });   // 不带 draft
  r.join('A', false); r.join('B', true);
  r.start(); r.clearTimer(); r.clearAiTimers();
  r.round = 16; r.hexDoneRounds = []; r.phase = 'roll'; r.project = null;
  r.maybeProject();
  for (const p of r.players) r.pickProject(p, r.project.offers[p.id][0]);
  ok(r.phase !== 'carddraft' && r.draft === null, '未开启 draft → 不进入 carddraft（旧测试行为不变）');
  r.clearTimer(); r.clearAiTimers();
  // 未开 hex 时也不会触发
  const r2 = new G.Room('v70off2', { draft: true });
  r2.join('A', false); r2.join('B', true);
  r2.start(); r2.clearTimer(); r2.clearAiTimers();
  r2.round = 16; r2.phase = 'roll';
  ok(r2.maybeProject() === false && r2.draft === null, '未开 hex → 立项与奖励卡都不触发');
  r2.clearTimer(); r2.clearAiTimers();
}

console.log('\n========================================');
console.log(`  v7.0 引擎测试：${pass} 通过 / ${fail} 失败`);
console.log('========================================');
process.exit(fail ? 1 : 0);
