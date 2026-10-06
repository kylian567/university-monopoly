#!/usr/bin/env node
// v7.6 单测：效果卡大扩容（9 张改造 + 8 张新增 = 42 张）+ 通用时机询问链 +
//   万能卡/免停留改主动询问 + 对决平局重投 + 免费轮/免租轮显示 + 烧地/换地等新结算 + 经济微调
//   [1] 卡池 42 张：mode / rare 分布 · 9 张改造卡 · 8 张新卡 · 攻击卡清单
//   [2] 双镜像：game.js 与 client.js 的 EFFECT_CARDS 逐字一致
//   [3] 经济：初始资金 20000 · 建造费 ×1.08 · 租金 ×1.06（GROUPS + BOARD 30 格）
//   [4] 时机询问原语：holdsCard / spendCard / askTiming / answerTiming / answerTimingBy
//   [5] 掷骰后时机卡（加速 / 反向 / 后退 / 强制重投）真实走一遍 doRoll 询问链
//   [6] 租金链：翻倍 / 减半主动询问 · 万能卡免租（yes 路径也收尾回合）· jokerSkip
//   [7] 兵粮寸断：askGrainCut 三条路径 + 教育基金格集成（取消后回合照常收尾）
//   [8] 新卡结算：steal / nanman / arrowrain / leroi / fireattack / alliance / swapReaction / swapSplit / stripLand
//   [9] 对决平局重投：duelDecide 重掷 / 12 次上限改判 / duel_tie 事件
//   [10] 免费轮 / 免租轮：快照下发 freeRounds / 免租轮 calcRent = 0 / 客户端徽章轮次行
'use strict';
const fs = require('fs');
const path = require('path');
const G = require('./game.js');

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.error('  ✗ ' + name); } };
const section = (n, t) => console.log(`\n[${n}] ${t}`);
const src = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

function mkRoom(n = 3, opts) {
  const room = new G.Room('v76' + Math.floor(Math.random() * 1e6), Object.assign({ hex: false, faculty: false, draft: false }, opts || {}));
  for (let i = 0; i < n; i++) room.join('P' + (i + 1), i > 0);
  room.start();
  room.clearTimer(); room.clearAiTimers();
  room.players.forEach(p => { p.isAI = false; });
  room.phase = 'roll';
  return room;
}
// 清掉一切会干扰单测的外界因子（风貌/季节/天气/野生日历事件）
function neutral(r) {
  r.faculty = null; r.season = 'mid'; r.weather = 'cloud'; r.calEvent = null; r.mutation = null; r.mutRoll = null;
}
const hand = (id, uid) => ({ uid: uid || (id + '_' + Math.random().toString(36).slice(2, 7)), id });

// ================= [1] 卡池 42 张 =================
section(1, 'v7.6：卡池 34 → 42 张（9 张改造 + 8 张新增）· mode / rare 分布');
{
  ok(G.EFFECT_CARDS.length === 42, `卡池 42 张（实际 ${G.EFFECT_CARDS.length}）`);
  const ids = G.EFFECT_CARDS.map(c => c.id);
  ok(new Set(ids).size === ids.length, '卡 id 唯一');
  const byId = id => G.EFFECT_CARDS.find(c => c.id === id) || {};

  // mode 分布：auto 13 / ask 7 / instant 2 / manual 18 / reactive 2
  const modeCnt = {};
  G.EFFECT_CARDS.forEach(c => modeCnt[c.mode] = (modeCnt[c.mode] || 0) + 1);
  ok(modeCnt.auto === 13 && modeCnt.ask === 7 && modeCnt.instant === 2 && modeCnt.manual === 18 && modeCnt.reactive === 2,
    `mode 分布 auto${modeCnt.auto}/ask${modeCnt.ask}/instant${modeCnt.instant}/manual${modeCnt.manual}/reactive${modeCnt.reactive}（期望 13/7/2/18/2）`);

  // rare 分布：SSR 12 / SR 13 / R 14 / N 3
  const rareCnt = {};
  G.EFFECT_CARDS.forEach(c => rareCnt[c.rare] = (rareCnt[c.rare] || 0) + 1);
  ok(rareCnt.SSR === 12 && rareCnt.SR === 13 && rareCnt.R === 14 && rareCnt.N === 3,
    `rare 分布 SSR${rareCnt.SSR}/SR${rareCnt.SR}/R${rareCnt.R}/N${rareCnt.N}（期望 12/13/14/3）`);

  // 9 张改造卡
  ok(byId('joker').rare === 'SSR' && byId('joker').mode === 'ask', '万能卡：SR→SSR · auto→ask（主动询问）');
  ok(byId('step').mode === 'ask', '加速卡：auto→ask（掷完骰后问是否 +4 步）');
  ok(byId('steal').mode === 'manual' && byId('steal').rare === 'SR', '偷师卡：instant→manual · R→SR');
  ok(byId('forceroll').rare === 'SR' && byId('forceroll').mode === 'ask', '强制重投：N→SR · manual→ask');
  ok(byId('backstep').rare === 'SR' && byId('backstep').mode === 'ask', '后退卡：N→SR · manual→ask');
  ok(byId('reverse').rare === 'SR' && byId('reverse').mode === 'ask', '反向骰子卡：R→SR · manual→ask');
  ok(byId('flawless').rare === 'SSR', '无懈可击：R→SSR');
  ok(byId('challenge').name === '决斗', '强制挑战令改名「决斗」');
  ok(byId('rentx2').mode === 'ask' && byId('renthalf').mode === 'ask', '租金翻倍 / 减半：auto→ask（收租时询问）');

  // 8 张新卡
  const NEW8 = { nanman: 'SR', arrowrain: 'SSR', leroi: 'SR', graincut: 'SR', fireattack: 'SSR', alliance: 'SR', swapReaction: 'SSR', swapSplit: 'SSR' };
  for (const [id, rare] of Object.entries(NEW8)) {
    const c = byId(id);
    ok(c.name && c.rare === rare && c.desc, `新卡 ${id}「${c.name || '?'}」= ${rare}（有 desc）`);
  }
  ok(byId('graincut').mode === 'reactive', '兵粮寸断 = reactive（别人获得非租金收入时响应）');
  ok(['nanman', 'arrowrain', 'leroi', 'fireattack', 'alliance', 'swapReaction', 'swapSplit', 'steal'].every(id => byId(id).mode === 'manual'),
    '新主动卡全部为 manual（进手牌手动发动）');

  // 攻击卡清单（万能卡拦截范围）
  ok(G.ATTACK_CARDS.length === 14 && ['nanman', 'arrowrain', 'fireattack', 'swapReaction', 'swapSplit', 'graincut'].every(id => G.ATTACK_CARDS.includes(id)),
    `ATTACK_CARDS 扩到 14 张并含新攻击卡（实际 ${G.ATTACK_CARDS.length}）`);
}

// ================= [2] 双镜像 EFFECT_CARDS =================
section(2, 'v7.6：client.js 的 EFFECT_CARDS 与 game.js 逐字一致');
{
  const grab = s => {
    const i = s.indexOf('const EFFECT_CARDS = [');
    if (i < 0) return null;
    const j = s.indexOf('\n];', i);
    return s.slice(i, j + 3);
  };
  const a = grab(src('game.js')), b = grab(src('public/client.js'));
  ok(a && b, '两份文件都能提取到 EFFECT_CARDS 表');
  ok(a === b, `两份卡表逐字一致（${a ? a.length : 0} vs ${b ? b.length : 0} 字符）`);
}

// ================= [3] 经济微调 =================
section(3, 'v7.6：初始资金 26666→20000 · 建造费 ×1.08 · 租金 ×1.06（GROUPS 全表 + BOARD 30 格）');
{
  ok(G.START_CASH === 20000, `初始资金 = ¥${G.START_CASH}（v7.6：26666 → 20000）`);
  // 建造费 = v7.0 的 ×1.05 表再 ×1.08（四舍五入到 10）
  const EXPECT_BUILD = { g1: 960, g2: 1360, g3: 1760, g4: 2100, g5: 2490, g6: 2890, g7: 3290, g8: 3630, g9: 4030, g10: 4650 };
  let buildOk = true;
  for (const [g, v] of Object.entries(EXPECT_BUILD)) if (G.GROUPS[g].build !== v) buildOk = false;
  ok(buildOk, `建造费全表 ×1.08（g1 ¥${G.GROUPS.g1.build} … g10 ¥${G.GROUPS.g10.build}）`);
  // 租金 = v7.0 的 ×1.06 表再 ×1.06（四舍五入到 10）
  const EXPECT_RENTS = {
    g1: [660, 1490, 3070, 5790], g2: [890, 2060, 4290, 8020], g3: [1170, 2700, 5600, 10450],
    g4: [1400, 3260, 6810, 12780], g5: [1670, 3920, 8120, 15200], g6: [1960, 4570, 9420, 17720],
    g7: [2240, 5230, 10820, 20250], g8: [2520, 5870, 12220, 22850], g9: [2890, 6720, 13900, 26020], g10: [3260, 7560, 15670, 29380],
  };
  let rentOk = true;
  for (const [g, v] of Object.entries(EXPECT_RENTS)) if (JSON.stringify(G.GROUPS[g].rents) !== JSON.stringify(v)) rentOk = false;
  ok(rentOk, `GROUPS 租金四档全表 ×1.06（g1 首档 ¥${G.GROUPS.g1.rents[0]} … 顶档 ¥${G.GROUPS.g10.rents[3]}）`);
  // BOARD 30 格裸地租金 ×1.06（华中科大 560→594 / 长安大学 180→191）
  const props = G.BOARD.filter(c => c.type === 'prop');
  ok(props.length === 30, 'BOARD 共 30 块地皮');
  const hua = props.find(c => c.name.includes('华中')); const chang = props.find(c => c.name.includes('长安'));
  ok(hua && hua.rent === 594, `华中科大裸地租金 560→${hua && hua.rent}`);
  ok(chang && chang.rent === 191, `长安大学裸地租金 180→${chang && chang.rent}`);
}

// ================= [4] 时机询问原语 =================
section(4, 'v7.6：holdsCard / spendCard / askTiming / answerTiming（手牌 + 计数器双通道）');
{
  const r = mkRoom(2); neutral(r);
  const [a, b] = r.players;
  // holdsCard：手牌与计数器都算「持有」
  r.addHandCard(a, 'step');
  a.joker = 2;
  ok(r.holdsCard(a, 'step') && r.holdsCard(a, 'joker'), 'holdsCard：手牌 / 计数器都能命中');
  ok(!r.holdsCard(b, 'step'), '没卡的人 holdsCard = false');
  // spendCard：优先扣计数器
  r.spendCard(a, 'joker');
  ok(a.joker === 1, 'spendCard 扣计数器（joker 2→1）');
  r.spendCard(a, 'step');
  ok((a.hand || []).length === 0, 'spendCard 扣手牌（step 移除）');
  // askTiming：没卡 → false + 同步 onNo
  let noCb = 0;
  const ret0 = r.askTiming(a, 'step', {}, null, () => noCb++);
  ok(ret0 === false && noCb === 1, 'askTiming 无卡：返回 false 且同步回调 onNo');
  // askTiming：有卡 → phase 'ask' + pendingAsk + 事件
  r.addHandCard(a, 'backstep');
  const evs = [];
  const _ev = r.ev.bind(r); r.ev = e => { evs.push(e.t); return _ev(e); };
  let yesCb = 0, noCb2 = 0;
  const ret1 = r.askTiming(a, 'backstep', { detail: '测试' }, () => yesCb++, () => noCb2++);
  ok(ret1 === true && r.phase === 'ask' && r.pendingAsk && r.pendingAsk.card === 'backstep' && r.pendingAsk.pid === a.id,
    'askTiming 有卡：进入 ask 相位并挂起 pendingAsk');
  ok(evs.includes('ask_timing'), '广播 ask_timing 事件');
  // answerTiming(true)：消耗卡 + 回调 onYes + 退出 ask 相位
  r.answerTiming(true);
  ok(yesCb === 1 && (a.hand || []).length === 0 && r.phase !== 'ask' && !r.pendingAsk,
    'answerTiming(true)：卡被消耗 · onYes 回调 · pendingAsk 清空');
  // answerTimingBy：非本人应答无效
  r.addHandCard(a, 'step');
  r.askTiming(a, 'step', {}, () => yesCb++, () => noCb2++);
  r.answerTimingBy(b, true);
  ok(r.pendingAsk && r.pendingAsk.card === 'step', 'answerTimingBy 非被问者应答：无效（pendingAsk 仍在）');
  r.answerTimingBy(a, false);
  ok(noCb2 === 1 && !r.pendingAsk && (a.hand || []).length === 1, 'answerTimingBy 本人拒绝：onNo 回调 · 卡保留');
  r.clearTimer(); r.clearAiTimers();
}

// ================= [5] 掷骰后时机卡 =================
section(5, 'v7.6：掷完骰后问「加速 / 反向 / 后退」—— 真实 doRoll → askTiming → answerTiming → 移动');
{
  const r = mkRoom(2); neutral(r);
  const a = r.curp();                       // 拿真正当场的人（doRoll 有 curp 校验）
  a.skillLeft = 0; a.stepBuffs = []; a.branchCard = 0; a.reverseDice = 0; a.backstep = 0; a.rollStepBonus = 0;
  a.rerollUsed = true;                      // 跳过「花 ¥1200 重投」询问，直达 execRoll
  r.addHandCard(a, 'step');
  r.addHandCard(a, 'backstep');
  const evs = [];
  const _ev = r.ev.bind(r); r.ev = e => { evs.push(e); return _ev(e); };
  r.doRoll(a);
  ok(r.phase === 'ask' && r.pendingAsk && r.pendingAsk.card === 'step',
    '掷完骰：先问加速卡（pendingAsk = step）');
  // 用「加速」→ 应进入下一个询问（后退卡）
  r.answerTiming(true);
  ok(r.phase === 'ask' && r.pendingAsk && r.pendingAsk.card === 'backstep',
    '加速发动后：接着问后退卡（askChain 依次问）');
  // 拒绝后退 → 正常移动
  r.answerTiming(false);
  const mv = evs.find(e => e.t === 'move');
  ok(!!mv, '两个询问都处理完后正常移动（move 事件）');
  ok(!(a.hand || []).some(h => h.id === 'step') && (a.hand || []).some(h => h.id === 'backstep'),
    '加速卡被消耗 · 后退卡保留');
  ok(a.rollStepBonus === 0 && a.rollAskDone === 0, 'rollStepBonus 已入账并归零 · rollAskDone 复位');
  r.clearTimer(); r.clearAiTimers();
  // 反向骰子：点数 = 14 − 实际点数（直接构造 pendingAsk 回调验证 flag 生效段）
  const r2 = mkRoom(2); neutral(r2);
  const a2 = r2.curp(); a2.skillLeft = 0; a2.stepBuffs = []; a2.branchCard = 0; a2.rerollUsed = true;
  r2.addHandCard(a2, 'reverse');
  const evs2 = [];
  const _ev2 = r2.ev.bind(r2); r2.ev = e => { evs2.push(e); return _ev2(e); };
  r2.doRoll(a2);
  ok(r2.pendingAsk && r2.pendingAsk.card === 'reverse', '持有反向卡：掷完骰后询问');
  r2.answerTiming(true);
  const cardAct = evs2.find(e => e.t === 'card_act' && e.card === 'reverse');
  ok(!!cardAct && /→/.test(cardAct.detail || ''), `反向发动：${cardAct ? cardAct.detail : ''}`);
  ok(!!evs2.find(e => e.t === 'move'), '反向后正常移动');
  r2.clearTimer(); r2.clearAiTimers();
}

// ================= [6] 租金链 =================
section(6, 'v7.6：收租时问翻倍 / 减半 · 万能卡免租（免租路径也收尾回合）· jokerSkip');
{
  // askRentCards：owner 持翻倍券 → yes 后 finalRent ×2 且卡消耗
  const r = mkRoom(2); neutral(r);
  const [a, b] = r.players;
  b.rentX2 = 1;
  r.addHandCard(b, 'rentx2');
  let got = 0;
  const entered = r.askRentCards(b, a, 1000, v => { got = v; });
  ok(entered === true && r.phase === 'ask', '收租方有翻倍券：进入询问');
  r.answerTiming(true);
  ok(got === 2000 && b.rentX2 === 0 && !r.holdsCard(b, 'rentx2'), '翻倍发动：finalRent 2000 · 计数器与手牌同扣');
  r.clearTimer(); r.clearAiTimers();

  // 拒绝 → 原租金
  const r1 = mkRoom(2); neutral(r1);
  const [a1, b1] = r1.players;
  b1.rentHalf = 1;
  r1.addHandCard(b1, 'renthalf');
  let got1 = 0;
  r1.askRentCards(a1, b1, 1000, v => { got1 = v; });
  r1.answerTiming(false);
  ok(got1 === 1000 && b1.rentHalf === 1, '减半拒绝：finalRent 不变 · 卡保留');
  r1.clearTimer(); r1.clearAiTimers();

  // 无卡 → false，调用方自结
  const r2 = mkRoom(2); neutral(r2);
  ok(r2.askRentCards(r2.players[0], r2.players[1], 500, () => {}) === false, '双方都没有租金卡：返回 false');

  // 完整租金链：付租方持万能卡 → 询问 → 用 = 免租 + 回合收尾（endTurn 被调）
  const r3 = mkRoom(2); neutral(r3);
  const [a3, b3] = r3.players;
  const idx = G.BOARD.findIndex(c => c.type === 'prop');
  r3.cells[idx].own = b3.id; r3.cells[idx].level = 0;
  a3.pos = idx; a3.cash = 50000; b3.cash = 50000; a3.joker = 1; a3.combo = 0;
  r3.round = 6; r3.endTurn = () => { r3._ended = true; };
  r3.resolveCell(a3);
  ok(r3.phase === 'ask' && r3.pendingAsk && r3.pendingAsk.card === 'joker', '踩地付租：先问付租方是否用万能卡');
  r3.answerTiming(true);
  ok(a3.cash === 50000 && b3.cash === 50000 && a3.joker === 0, '万能卡发动：双方现金不变 · 卡消耗');
  ok(r3._ended === true, '免租路径也正常收尾回合（endTurn 被调用）');
  r3.clearTimer(); r3.clearAiTimers();

  // 拒绝万能卡 → 照付租金，且 tryPay 不再自动吃卡（jokerSkip）
  const r4 = mkRoom(2); neutral(r4);
  const [a4, b4] = r4.players;
  r4.cells[idx].own = b4.id; r4.cells[idx].level = 0;
  a4.pos = idx; a4.cash = 50000; b4.cash = 50000; a4.joker = 1;
  r4.round = 6; r4.endTurn = () => {};
  r4.resolveCell(a4);
  r4.answerTiming(false);
  ok(a4.joker === 1 && a4.cash < 50000, `拒绝后照付租金（¥${50000 - a4.cash}）且万能卡未被自动消耗`);
  r4.clearTimer(); r4.clearAiTimers();
}

// ================= [7] 兵粮寸断 =================
section(7, 'v7.6：兵粮寸断 —— askGrainCut 三条路径 + 教育基金格集成');
{
  const r = mkRoom(2); neutral(r);
  const [a, b] = r.players;
  let applied = 0, finished = 0;
  const apply = () => applied++;
  const finish = () => finished++;
  // 无持有者 → false，不回调
  ok(r.askGrainCut(a, 1000, '测试收入', apply, finish) === false && applied === 0 && finished === 0,
    '无持有者：返回 false，apply / finish 都不调用');
  // 有持有者 → 拒绝 → apply + finish
  r.addHandCard(b, 'graincut');
  ok(r.askGrainCut(a, 1000, '测试收入', apply, finish) === true && r.phase === 'ask', '有持有者：进入询问');
  r.answerTiming(false);
  ok(applied === 1 && finished === 1, '拒绝：apply + finish 各一次（收入照发，回合收尾）');
  // 有持有者 → 发动 → 只 finish
  let applied2 = 0, finished2 = 0;
  r.addHandCard(b, 'graincut');
  r.askGrainCut(a, 1000, '测试收入', () => applied2++, () => finished2++);
  r.answerTiming(true);
  ok(applied2 === 0 && finished2 === 1, '发动：收入被取消（apply 不调）· finish 仍调用（回合收尾）');
  r.clearTimer(); r.clearAiTimers();

  // 教育基金格集成：b 持兵粮寸断 → a 领奖前被询问 → 取消后 a 一分不得、endTurn 照常
  const r2 = mkRoom(2); neutral(r2);
  const [a2, b2] = r2.players;
  const pid = G.BOARD.findIndex(c => c.type === 'parking');
  r2.round = 5; r2.fundPool = 10000; a2.pos = pid; a2.cash = 0;
  r2.addHandCard(b2, 'graincut');
  let ended2 = false; r2.endTurn = () => { ended2 = true; };
  r2.resolveCell(a2);
  ok(r2.phase === 'ask' && r2.pendingAsk && r2.pendingAsk.card === 'graincut', '领教育基金前：询问持有者是否取消');
  r2.answerTiming(true);
  ok(a2.cash === 0 && r2.fundPool === 10000, '取消成立：a2 一分未领 · 奖池原封不动');
  ok(ended2 === true, '取消后回合照常收尾');
  r2.clearTimer(); r2.clearAiTimers();
}

// ================= [8] 新卡结算 =================
section(8, 'v7.6：八张新卡 + 偷师卡的真实结算（resolveCardEffect）');
{
  // steal 偷师：对方 -1 我 +1（对方专业随机 —— 主动技进 borrow，被动技进 skillLeft，总量 +1 即可）
  {
    const r = mkRoom(2); neutral(r);
    const [a, b] = r.players;
    b.skillLeft = 2; a.skillLeft = 0; a.borrow = {};
    const msg = r.resolveCardEffect(a, 'steal', b, {});
    const gained = a.skillLeft + Object.values(a.borrow || {}).reduce((s, v) => s + v, 0);
    ok(b.skillLeft === 1 && gained === 1, `偷师卡：对方 2→${b.skillLeft} · 我方总量 +1（${gained}）（${msg}）`);
  }
  // nanman：有钱缴 ¥1000，没钱下一轮免租
  {
    const r = mkRoom(3); neutral(r);
    const [a, b, c] = r.players;
    b.cash = 5000; c.cash = 200;
    const baseA = a.cash;
    const msg = r.resolveCardEffect(a, 'nanman', null, {});
    ok(b.cash === 4000 && a.cash === baseA + 1000 && c.rentFreeRound === r.round + 1,
      `南蛮入侵：b 缴 ¥1000 · c 现金不足 → 第 ${c.rentFreeRound} 轮免收租`);
    // 免租轮 calcRent = 0
    const idx = G.BOARD.findIndex(x => x.type === 'prop');
    r.cells[idx].own = c.id; r.cells[idx].level = 2;
    r.round = c.rentFreeRound;
    ok(r.calcRent(idx, [1, 2]) === 0, 'rentFreeRound 当轮：calcRent = 0');
    r.round = c.rentFreeRound + 1;
    ok(r.calcRent(idx, [1, 2]) > 0, '过了免租轮：恢复收租');
  }
  // leroi：自己停留一回合
  {
    const r = mkRoom(2); neutral(r);
    const [a] = r.players;
    r.resolveCardEffect(a, 'leroi', null, {});
    ok((a.skipTurns || 0) >= 1, '乐不思蜀：自己下一回合停留');
  }
  // fireattack：自扣 ¥500 + 烧地（own=null / level=0）
  {
    const r = mkRoom(2); neutral(r);
    const [a, b] = r.players;
    const idx = G.BOARD.findIndex(x => x.type === 'prop');
    r.cells[idx].own = b.id; r.cells[idx].level = 2; r.cells[idx].mortgaged = true;
    const before = a.cash;
    const msg = r.resolveCardEffect(a, 'fireattack', b, { cell: idx });
    ok(r.cells[idx].own === null && r.cells[idx].level === 0 && r.cells[idx].mortgaged === false,
      `火攻：地皮化为无主 · 房子清零 · 解除抵押（${msg}）`);
    ok(a.cash === before - 500, '火攻自付 ¥500');
  }
  // alliance：各得 ¥1000
  {
    const r = mkRoom(2); neutral(r);
    const [a, b] = r.players;
    const baseA = a.cash, baseB = b.cash;
    r.resolveCardEffect(a, 'alliance', b, {});
    ok(a.cash === baseA + 1000 && b.cash === baseB + 1000, '远交近攻：双方各 +¥1000');
  }
  // swapReaction：目标拆 1 层 + 另一格盖 1 层
  {
    const r = mkRoom(2); neutral(r);
    const [a, b] = r.players;
    const props = G.BOARD.map((c, i) => ({ c, i })).filter(x => x.c.type === 'prop');
    const dc = props[0].i, bc = props[1].i;
    r.cells[dc].own = b.id; r.cells[dc].level = 2;
    r.cells[bc].own = b.id; r.cells[bc].level = 0;
    const msg = r.resolveCardEffect(a, 'swapReaction', b, { cell: dc, cell2: bc });
    ok(r.cells[dc].level === 1 && r.cells[bc].level === 1, `置换反应：拆 2→1 · 盖 0→1（${msg}）`);
  }
  // swapSplit：双方互换无房地皮
  {
    const r = mkRoom(2); neutral(r);
    const [a, b] = r.players;
    const props = G.BOARD.map((c, i) => ({ c, i })).filter(x => x.c.type === 'prop');
    const mc = props[0].i, tc = props[1].i;
    r.cells[mc].own = a.id; r.cells[mc].level = 0;
    r.cells[tc].own = b.id; r.cells[tc].level = 0;
    r.resolveCardEffect(a, 'swapSplit', b, { myCell: mc, cell: tc });
    ok(r.cells[mc].own === b.id && r.cells[tc].own === a.id, '复分解反应：双方无房地皮互换');
  }
  // arrowrain：没钱的地主被拆地
  {
    const r = mkRoom(2); neutral(r);
    const [a, b] = r.players;
    const idx = G.BOARD.findIndex(x => x.type === 'prop');
    r.cells[idx].own = b.id; r.cells[idx].level = 0; b.cash = 100;
    const msg = r.resolveCardEffect(a, 'arrowrain', null, {});
    ok(r.cells[idx].own === null && b.cash === 100, `万箭齐发：身无分文 → 拆一块地皮（${msg}）`);
  }
}

// ================= [9] 对决平局重投 =================
section(9, 'v7.6：duelDecide —— 平局自动重掷 · 12 次上限强制改判 · duel_tie 事件');
{
  const r = mkRoom(2); neutral(r);
  const [a, b] = r.players;
  // 直接分出胜负：不平局时不重掷
  let ties = 0;
  const _ev = r.ev.bind(r); r.ev = e => { if (e.t === 'duel_tie') ties++; return _ev(e); };
  let [x, y] = r.duelDecide(6, 3, '测试', a.id, b.id);
  ok(x === 6 && y === 3 && ties === 0, '非平局：直接返回，无 duel_tie');
  // 恒平局（random 恒 0 → 每次重掷都是 1,1）→ 12 次后强制改判
  const savedRandom = Math.random;
  Math.random = () => 0;
  ties = 0;
  const [ra, rb] = r.duelDecide(1, 1, '测试', a.id, b.id);
  Math.random = savedRandom;
  ok(ties === 12, `连续 12 次平局都重掷（duel_tie ×${ties}）`);
  ok(ra !== rb, `第 13 次不再掷：裁判改判 ${ra} : ${rb}`);
}

// ================= [10] 免费轮 / 免租轮快照与显示 =================
section(10, 'v7.6：免费轮 / 免租轮具体轮次 —— 快照下发 + 中央徽章轮次行 + 免租轮 calcRent = 0');
{
  const r = mkRoom(2, { faculty: true });
  ok(Array.isArray(r.freeRounds) && Array.isArray(r.freeRentRounds), '引擎持有 freeRounds / freeRentRounds 数组');
  // 快照下发
  const sv = src('server.js');
  ok(/freeRounds:\s*\(room\.freeRounds \|\| \[\]\)\.slice\(\)/.test(sv), 'server.js 快照含 freeRounds（数组下发）');
  ok(/freeRentRounds:\s*\(room\.freeRentRounds \|\| \[\]\)\.slice\(\)/.test(sv), 'server.js 快照含 freeRentRounds');
  // 免租轮：isFreeRentRound 命中时租金段直接按 0 结算（判定在 resolveCell 租金入口处）
  const r2 = mkRoom(2, { faculty: true });
  neutral(r2);
  const [a2, b2] = r2.players;
  const idx = G.BOARD.findIndex(c => c.type === 'prop');
  r2.cells[idx].own = b2.id; r2.cells[idx].level = 1;
  r2.faculty = 'freeRent'; r2.freeRentRounds = [r2.round];
  ok(r2.isFreeRentRound() === true, '免租轮：isFreeRentRound() = true');
  ok(/if \(this\.isFreeRentRound\(\)\) \{/.test(src('game.js')), '租金入口：免租轮直接免单（isFreeRentRound 分支）');
  r2.freeRentRounds = [];
  ok(r2.isFreeRentRound() === false && r2.calcRent(idx, [1, 2]) > 0, '非免租轮：恢复租金');
  // 客户端：徽章轮次行 + 详情面板用数组
  const cli = src('public/client.js');
  ok(/frRounds/.test(cli) && /frRentRounds/.test(cli) && /fac-badge-round/.test(cli), '客户端徽章含免费轮 / 免租轮轮次行（fac-badge-round）');
  ok(/S\.freeRounds && S\.freeRounds\.length/.test(cli) && /S\.freeRentRounds && S\.freeRentRounds\.length/.test(cli), '详情面板以数组渲染轮次');
  ok(/免费轮 第|🎟️/.test(cli) && /🕊️/.test(cli), '轮次行文案含 🎟️ 免费轮 / 🕊️ 免租轮');
  // 样式
  const css = src('public/style.css');
  ok(/\.fac-badge-round/.test(css), 'style.css 含 .fac-badge-round 样式');
}

// ================= 汇总 =================
console.log(`\n========== v7.6 单测：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail ? 1 : 0);
