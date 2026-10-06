#!/usr/bin/env node
// v7.5 单测：触发轮前移（41/51 → 40/50）+ 三档海克斯强度平衡与合约次数下调 +
//   无懈可击「全场依次询问」链 + 四张效果卡改为主动询问 + 教育基金受收益衰减 + 突变徽章与效果接线
//   [1] 触发轮 40/50 前移（仍是 12 次 · 严格递增 · 时光之城表不动）
//   [2] 合约次数全面下调（90 张 · 三档配额 · 描述一致 · 关键卡数值 · 无过短）
//   [3] 无懈可击：任何人发动卡 → 全场其他持有者依次询问（被点名目标优先）
//   [4] 复印卡 / 顺手牵羊 / 过河拆桥「一定会被询问」（旧版会因无目标被静默跳过）
//   [5] 教育基金格独领奖池受「非租金收益衰减」影响，少领部分留在池中
//   [6] 突变：第 5 轮触发 · 全部 ops 键都有读取点 · 代表 op 真实生效 · 快照暴露 mutation
//   [7] 前端镜像：浮层可点（pointer-events:auto）· 中央徽章突变态 · 查看面板分区 · 置灰不可用卡
'use strict';
const fs = require('fs');
const path = require('path');
const G = require('./game.js');

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.error('  ✗ ' + name); } };
const section = (n, t) => console.log(`\n[${n}] ${t}`);
const src = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

function mkRoom(n = 3, opts) {
  const room = new G.Room('v75' + Math.floor(Math.random() * 1e6), Object.assign({ hex: true, faculty: true, draft: true }, opts || {}));
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

// ================= [1] 触发轮 40 / 50 前移 =================
section(1, 'v7.5：立项触发轮第 41/51 → 第 40/50（仍是 12 次，中段更均匀）');
{
  const EXPECT = [2, 8, 15, 23, 32, 40, 50, 62, 74, 86, 98, 110];
  ok(JSON.stringify(G.HEX_TRIGGERS) === JSON.stringify(EXPECT),
    `触发轮 = ${G.HEX_TRIGGERS.join('/')}（共 ${G.HEX_TRIGGERS.length} 次）`);
  ok(G.HEX_TRIGGERS.length === 12 && G.HEX_TRIGGERS.every((v, i, a) => i === 0 || v > a[i - 1]),
    '触发轮严格递增且共 12 次');
  ok(!G.HEX_TRIGGERS.includes(41) && !G.HEX_TRIGGERS.includes(51), '第 41 / 51 轮已不再是触发轮');
  ok(G.HEX_TRIGGERS.includes(40) && G.HEX_TRIGGERS.includes(50), '第 40 / 50 轮成为新触发轮');
  ok(JSON.stringify(G.HEX_TRIGGERS_EARLY) === JSON.stringify([2, 6, 12, 19, 27, 35, 44, 54, 65, 77, 89, 101]),
    '时光之城提前表未改动（12 项）');

  // 引擎行为：40 触发 / 41 不触发 / 50 触发 / 51 不触发
  const mk = r0 => { const r = mkRoom(2, { hex: true }); r.round = r0; r.hexDoneRounds = []; r.phase = 'roll'; r.project = null; return r; };
  const r40 = mk(40); const b40 = r40.maybeProject(); r40.clearTimer(); r40.clearAiTimers();
  ok(b40 === true && !!r40.project, '第 40 轮正常开启三选一');
  const r41 = mk(41); const b41 = r41.maybeProject();
  ok(b41 === false && !r41.project, '第 41 轮不再开启三选一');
  const r50 = mk(50); const b50 = r50.maybeProject(); r50.clearTimer(); r50.clearAiTimers();
  ok(b50 === true && !!r50.project, '第 50 轮正常开启三选一');
  const r51 = mk(51); const b51 = r51.maybeProject();
  ok(b51 === false && !r51.project, '第 51 轮不再开启三选一');
}

// ================= [2] 三档强度平衡 · 合约次数下调 =================
section(2, 'v7.5：三档海克斯强度平衡 —— 合约次数整体下调（立项次数上调后，单卡收益收敛）');
{
  const charged = Object.keys(G.PROJECTS).filter(k => G.PROJECTS[k].charges);
  const cntTier = t => charged.filter(k => G.PROJECTS[k].tier === t).length;
  ok(charged.length === 90 && cntTier('silver') === 33 && cntTier('gold') === 29 && cntTier('prism') === 28,
    `带合约卡仍为 90 张（银 ${cntTier('silver')} / 金 ${cntTier('gold')} / 彩 ${cntTier('prism')}）`);

  // 描述「限 N 轮/次」必须与 charges 一一对应
  const mismatch = [];
  for (const k of charged) {
    const pr = G.PROJECTS[k];
    const m = /限 (\d+) (轮|次)/.exec(pr.desc);
    if (!m || Number(m[1]) !== pr.charges) mismatch.push(k + '(表' + pr.charges + '/描述' + (m ? m[1] : '—') + ')');
  }
  ok(mismatch.length === 0, `90 张合约卡「限 N 轮/次」描述与 charges 全部一致${mismatch.length ? '（不符：' + mismatch.join('，') + '）' : ''}`);

  // 代表性下调（对照 v7.4 基线，逐张确认「次数」与「单次金额」同步收敛）
  const EXP = {
    stipend: [11, 'goCash', 250], allowance: [13, 'turnCash', 220], waterfree: [13, 'turnCash', 185],
    landlord: [14, 'rentFlat', 80], coinbox: [10, 'goCash', 220], openbook: [16, 'cardGain', 110],
    raise: [10, 'goCash', 520], scholarship: [12, 'turnCash', 430], grants: [12, 'turnCash', 420],
    marknote: [11, 'cardGain', 330], tollpass: [13, 'tollBooth', 0], insurance: [13, 'insureEach', 0],
    salaryplus: [8, 'goCash', 820], megahead: [8, 'turnCash', 860], headstart: [10, 'turnCash', 720],
  };
  const bad = [];
  for (const k in EXP) {
    const pr = G.PROJECTS[k];
    if (!pr) { bad.push(k + '(缺卡)'); continue; }
    const [ch, mk, amt] = EXP[k];
    if (pr.charges !== ch) bad.push(`${k} 次数 ${pr.charges}≠${ch}`);
    if (amt && (pr.mods || {})[mk] !== amt) bad.push(`${k} ${mk} ${(pr.mods || {})[mk]}≠${amt}`);
  }
  ok(bad.length === 0, `15 张代表卡次数 / 金额同步下调${bad.length ? '（不符：' + bad.join('，') + '）' : ''}`);

  // 双倍工资（原超标彩卡）二次削弱
  ok(G.PROJECTS.salaryx2.charges === 3 && G.PROJECTS.salaryx2.mods.goCash === 500 && G.PROJECTS.salaryx2.mods.salaryX2 === 1,
    '彩卡「双倍工资」定向削弱至限 3 次 + 过起点 ¥500（原 12 次 / ¥800）');

  // 每轮生效型：全部 ≥8 轮（v7.4 是 ≥12，v7.5 次数下调后放宽到 8）
  const ROUND_MODS = ['turnCash', 'poorCash', 'noLandCash', 'interestPct', 'weatherCash', 'sunCash', 'landmark', 'legacy', 'floor', 'shieldEach', 'freeReroll',
    'growCash', 'richDrain', 'comeback', 'roundPay', 'coinCash', 'taxLevelCut', 'taxCut'];
  const roundType = charged.filter(k => ROUND_MODS.some(mk => ((G.PROJECTS[k].mods) || {})[mk] !== undefined));
  ok(roundType.length >= 24 && roundType.every(k => G.PROJECTS[k].charges >= 8),
    `每轮生效型 ${roundType.length} 张，合约全部 ≥8 轮`);

  // 事件触发型：全部 ≥8 次（双倍工资为定向削弱）—— 同时确保没有 1~2 次的「一碰就断」卡
  const evType = charged.filter(k => ['goCash', 'tollBooth', 'rentFlat', 'fundKick'].some(mk => ((G.PROJECTS[k].mods) || {})[mk] !== undefined));
  const tooShort = evType.filter(k => G.PROJECTS[k].charges < 8 && k !== 'salaryx2');
  ok(evType.length >= 6 && tooShort.length === 0,
    `事件触发型 ${evType.length} 张，除双倍工资外合约全部 ≥8 次${tooShort.length ? '（过短：' + tooShort.join('/') + '）' : ''}`);
  const floor = Math.min(...charged.map(k => G.PROJECTS[k].charges));
  ok(floor === 3 && ['salaryx2', 'longterm', 'jokersupply'].every(k => G.PROJECTS[k].charges === 3),
    `全局合约下限为 3 次，仅 3 张特例卡（最低 ${floor}）`);

  // 三档均值不失控：同档最贵/最便宜 charges 比 ≤ 6（防止某档出现「一枝独秀」）
  const byTier = { silver: [], gold: [], prism: [] };
  charged.forEach(k => byTier[G.PROJECTS[k].tier].push(G.PROJECTS[k].charges));
  const spread = t => Math.max(...byTier[t]) / Math.min(...byTier[t]);
  ok(spread('silver') <= 6 && spread('gold') <= 6 && spread('prism') <= 6,
    `同档 charges 极值比 ≤ 6（银 ${spread('silver').toFixed(1)} / 金 ${spread('gold').toFixed(1)} / 彩 ${spread('prism').toFixed(1)}）`);

  // 双镜像逐字一致
  const g = src('game.js'), c = src(path.join('public', 'client.js'));
  const sp = (s, a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)));
  ok(sp(g, 'const PROJECTS = {', 'const PROJECT_KEYS = {') === sp(c, 'const PROJECTS = {', 'const PROJECT_KEYS = {'),
    'PROJECTS 双镜像（含下调后的 charges）逐字一致');
}

// ================= [3] 无懈可击：全场依次询问 =================
section(3, 'v7.5：任何人发动效果卡 → 询问全场其他持有「无懈可击卡」的玩家（被点名目标优先）');
{
  // (a) 攻击卡打 B：B 排最前，B 放弃 → 问 C，C 放弃 → 原卡生效
  const r = mkRoom(3, { hex: false }); neutral(r);
  const [a, b, cc] = r.players;
  a.hand = [hand('repeat', 'A1')];        // 强制停留（确定性效果）
  b.hand = [hand('flawless', 'B1')];
  cc.hand = [hand('flawless', 'C1')];
  b.joker = 0;
  const evs = []; r.ev = e => evs.push(e);
  r.phase = 'card'; r.pendingCard = { pid: a.id };
  r.useCard(a, 'A1', { target: b.id });
  ok(r.phase === 'negate' && r.pendingNegate && r.pendingNegate.pid === b.id,
    '先问被点名的目标 B（negateChain 被点名者排最前）');
  ok(r.negateChain && r.negateChain.ids.length === 2 && r.negateChain.ids[0] === b.id && r.negateChain.ids[1] === cc.id,
    '询问队列 = [B, C]（被点名者优先，其余按座位顺序）');
  ok(evs.some(e => e.t === 'ask_negate' && e.pid === b.id && e.card === 'repeat' && e.ms === G.NEGATE_MS),
    '广播 ask_negate 事件（带 NEGATE_MS 响应窗口）');
  const skipTurnsBefore = b.skipTurns || 0;
  r.resolveNegate(false);                  // B 放弃
  ok(r.phase === 'negate' && r.pendingNegate && r.pendingNegate.pid === cc.id, 'B 放弃后继续问 C');
  r.resolveNegate(false);                  // C 也放弃
  ok(r.phase === 'card' && !r.pendingNegate && !r.negateChain, '全部放弃后回到手动发动面板');
  ok((b.skipTurns || 0) === skipTurnsBefore + 1, '原卡正常结算：B 被强制停留 +1');
  ok(evs.some(e => e.t === 'card_act' && e.card === 'repeat') && !evs.some(e => e.t === 'negate'),
    '广播 card_act 且没有 negate 事件');

  // (b) 被点名目标直接用卡 → 原卡失效，无懈可击卡被消耗
  const r2 = mkRoom(2, { hex: false }); neutral(r2);
  const [a2, b2] = r2.players;
  a2.hand = [hand('repeat', 'A2')];
  b2.hand = [hand('flawless', 'B2')];
  const evs2 = []; r2.ev = e => evs2.push(e);
  r2.phase = 'card'; r2.pendingCard = { pid: a2.id };
  const sk2 = b2.skipTurns || 0;
  r2.useCard(a2, 'A2', { target: b2.id });
  ok(r2.phase === 'negate' && r2.pendingNegate.pid === b2.id, '(b) 询问 B');
  r2.resolveNegate(true);
  ok((b2.skipTurns || 0) === sk2, '(b) 用了无懈可击 → 强制停留未生效');
  ok(!b2.hand.some(h => h.id === 'flawless'), '(b) 无懈可击卡被消耗');
  ok(evs2.some(e => e.t === 'negate' && e.pid === b2.id && e.card === 'repeat') && !evs2.some(e => e.t === 'card_act'),
    '(b) 广播 negate 事件且没有 card_act');

  // (c) 无目标的自用卡（后退卡）也会触发询问链
  const r3 = mkRoom(2, { hex: false }); neutral(r3);
  const [a3, b3] = r3.players;
  a3.hand = [hand('backstep', 'A3')];
  b3.hand = [hand('flawless', 'B3')];
  r3.phase = 'card'; r3.pendingCard = { pid: a3.id };
  r3.useCard(a3, 'A3', {});
  ok(r3.phase === 'negate' && r3.pendingNegate.pid === b3.id, '(c) 自用卡（无目标）同样会问全场');

  // (d) 全场都没卡 → 不进入 negate 相位
  const r4 = mkRoom(2, { hex: false }); neutral(r4);
  const [a4, b4] = r4.players;
  a4.hand = [hand('repeat', 'A4')]; b4.hand = [];
  r4.phase = 'card'; r4.pendingCard = { pid: a4.id };
  r4.useCard(a4, 'A4', { target: b4.id });
  ok(r4.phase === 'card' && !r4.pendingNegate, '(d) 无人持有无懈可击 → 直接结算，不进 negate 相位');
}

// ================= [4] 四张卡「一定会被询问」 =================
section(4, 'v7.5：复印卡 / 顺手牵羊 / 过河拆桥「自己回合开始一定询问」，无懈可击「别人发动时询问」');
{
  // (a) 只有复印卡、且手上没有可复制的卡 → 旧版会静默跳过，新版必须询问
  const r = mkRoom(2, { hex: false }); neutral(r);
  const a = r.players[0];
  a.hand = [hand('copycard', 'K1')];
  const opened = r.openCardPrompt(a);
  ok(opened === true && r.phase === 'card' && r.pendingCard && r.pendingCard.pid === a.id,
    '复印卡：即使暂时没有可复制的卡，回合开始也一定询问');
  ok(r.cardUsable(a, 'copycard') === false, '（同时：此刻确实「不可用」，前端会置灰但玩家仍看得到询问）');
  r.clearTimer(); r.clearAiTimers();

  // (b) 顺手牵羊 / 过河拆桥：对手手上没卡也一定询问
  const r2 = mkRoom(2, { hex: false }); neutral(r2);
  const a2 = r2.players[0]; a2.hand = [hand('snatch', 'K2')];
  r2.players[1].hand = [];
  ok(r2.openCardPrompt(a2) === true && r2.phase === 'card', '顺手牵羊：对手没有可偷的卡也一定询问');
  r2.clearTimer(); r2.clearAiTimers();
  const r3 = mkRoom(2, { hex: false }); neutral(r3);
  const a3 = r3.players[0]; a3.hand = [hand('dismantle', 'K3')];
  r3.players[1].hand = [];
  ok(r3.openCardPrompt(a3) === true && r3.phase === 'card', '过河拆桥：对手没有可弃的卡也一定询问');
  r3.clearTimer(); r3.clearAiTimers();

  // (c) 只有响应型（无懈可击）→ 不在自己回合里主动问
  const r4 = mkRoom(2, { hex: false }); neutral(r4);
  const a4 = r4.players[0]; a4.hand = [hand('flawless', 'K4')];
  ok(r4.openCardPrompt(a4) === false && r4.phase !== 'card', '无懈可击卡是响应型，不在自己回合面板里出现');
  r4.clearTimer(); r4.clearAiTimers();

  // (d) 四张卡的描述文案已改为「询问」口径
  const EC = {}; G.EFFECT_CARDS.forEach(c => EC[c.id] = c);
  ok(/自己回合开始时询问是否发动/.test(EC.copycard.desc) && /复制/.test(EC.copycard.desc)
    && /无懈可击卡与复印卡不可复制/.test(EC.copycard.desc), '复印卡 desc 写明「自己回合开始时询问 + 选一张复制」');
  ok(/自己回合开始时询问是否发动/.test(EC.snatch.desc) && /偷走/.test(EC.snatch.desc), '顺手牵羊 desc 写明「自己回合开始时询问」');
  ok(/自己回合开始时询问是否发动/.test(EC.dismantle.desc) && /弃掉/.test(EC.dismantle.desc), '过河拆桥 desc 写明「自己回合开始时询问」');
  ok(/任何人（含自己）发动任何效果卡时都会询问你是否响应/.test(EC.flawless.desc) && /完全失效/.test(EC.flawless.desc)
    && /被点名时优先询问你/.test(EC.flawless.desc), '无懈可击 desc 写明「任何人发动都询问你（v7.6：含自己）」');
}

// ================= [5] 教育基金受收益衰减 + 余款留池 =================
section(5, 'v7.5：独吞教育基金奖池也受「非租金收益衰减」影响，少领走的部分留在池中');
{
  const pid = G.BOARD.findIndex(c => c.type === 'parking');
  ok(pid >= 0, `棋盘上存在教育基金格（index ${pid}）`);
  const run = (round, pool) => {
    const r = mkRoom(2, { hex: false }); neutral(r);
    const a = r.players[0];
    r.round = round; r.fundPool = pool;
    a.pos = pid; a.fundBanned = false;
    const evs = []; r.ev = e => evs.push(e);
    a.cash = 0;
    r.endTurn = () => {}; r.schedule = () => {}; r.dice = [1, 2];
    r.resolveCell(a);
    return { gain: a.cash, left: r.fundPool, ev: evs.find(e => e.t === 'jackpot') };
  };
  const early = run(5, 10000);
  ok(early.gain === 10000 && early.left === 0 && early.ev.decayMul === 1,
    `第 5 轮（无衰减）：领走全部 ¥${early.gain}，池清零`);
  const mid = run(20, 10000);          // 15 轮后 ×0.7
  ok(mid.gain === 7000 && mid.left === 3000 && mid.ev.poolLeft === 3000,
    `第 20 轮（×0.7）：领走 ¥${mid.gain}，剩余 ¥${mid.left} 留在池中`);
  const late = run(30, 10000);         // 25 轮后 ×0.5
  ok(late.gain === 5000 && late.left === 5000, `第 30 轮（×0.5）：领走 ¥${late.gain}，剩余 ¥${late.left} 留池`);
  const end = run(45, 10000);          // 40 轮后 ×0.25
  ok(end.gain === 2500 && end.left === 7500, `第 45 轮（×0.25）：领走 ¥${end.gain}，剩余 ¥${end.left} 留池`);
  ok(mid.ev && mid.ev.amount === 7000 && mid.ev.cell === pid, 'jackpot 事件同时带 amount 与 poolLeft（供前端播报）');
}

// ================= [6] 突变：触发 + 效果接线 + 快照 =================
section(6, 'v7.5：城邦突变「真的会触发」—— 第 5 轮发动 · 全部 ops 键都有读取点 · 快照暴露 mutation');
{
  // (a) 第 5 轮触发、第 4 轮不触发、同一届只触发一次
  const r0 = mkRoom(2, { hex: false }); neutral(r0);
  r0.faculty = 'urban'; r0.facTermStart = 1; r0.round = 4; r0.maybeMutation();
  ok(!r0.mutation, '第 4 轮不触发突变');
  r0.round = 5; r0.maybeMutation();
  ok(r0.mutation && r0.mutRoll, '第 5 轮触发突变（三路抽卡）');
  ok(r0.mutation.kind && r0.mutation.id && r0.mutation.name && r0.mutation.desc && r0.mutation.ops,
    '突变对象带 kind / id / name / desc / ops（前端中央徽章要直接展示）');
  ok(r0.mutRoll.options.length === 3 && r0.mutRoll.options.map(o => o.kind).join(',') === 'general,buff,nerf',
    '三路选项 = 通用 / 专属强化 / 专属反转');
  const before = r0.mutation; r0.maybeMutation();
  ok(r0.mutation === before, '同一届只触发一次突变');

  // (b) 收集全部 ops 键（通用池 + 74 城邦 ×2 专属），逐个确认在 game.js 里有读取点
  const keys = new Set();
  const take = list => list.forEach(s => Object.keys(s.o || {}).forEach(k => keys.add(k)));
  take(G.MUT_GENERAL);
  let specTotal = 0;
  const specBad = [];
  for (const fid of G.FACULTY_KEYS) {
    const sp = G.MUT_SPECIAL[fid];
    if (!Array.isArray(sp) || sp.length !== 2) specBad.push(fid);
    else { specTotal += sp.length; take(sp); }
  }
  const gsrc = src('game.js');
  // 读取点：既可能是 this.mut().KEY / o.KEY，也可能是把 this.mut() 存进局部别名后 X.KEY（如 cfm/ltm/prm…）
  const aliases = new Set(['o']);
  const are = /([A-Za-z_$][\w$]*)\s*=\s*this\.mut\(\)/g;
  let am; while ((am = are.exec(gsrc))) aliases.add(am[1]);
  const hit = k => gsrc.includes(`mut().${k}`) || [...aliases].some(a => gsrc.includes(`${a}.${k}`));
  const missing = [...keys].filter(k => !hit(k));
  ok(G.MUT_GENERAL.length >= 8, `通用突变池 ${G.MUT_GENERAL.length} 条`);
  ok(specBad.length === 0 && specTotal === 148, `74 个城邦各带 2 条专属突变（共 ${specTotal} 条）${specBad.length ? '（缺/多：' + specBad.join(',') + '）' : ''}`);
  ok(keys.size >= 100, `突变 ops 词表覆盖 ${keys.size} 个键`);
  ok(missing.length === 0, `全部 ops 键都有读取点（突变效果确实会生效）${missing.length ? '（缺：' + missing.join(',') + '）' : ''}`);
  ok(G.FACULTY_KEYS.length === 74, `城邦共 ${G.FACULTY_KEYS.length} 个（每个城邦都有专属突变）`);

  // (c) 代表 op 实际生效：地王令（无主地价 ×1.3）
  const r6 = mkRoom(2, { hex: false }); neutral(r6);
  const base = r6.landCost(10000);
  r6.mutation = { kind: 'general', facId: null, id: 'G3', name: '地王令', desc: 'x', ops: { vacantLandMul: 1.3 } };
  ok(r6.landCost(10000) === Math.round(base * 1.3), `地王令使无主地价 ×1.3（${base} → ${r6.landCost(10000)}）`);
  // 通胀风暴（全场租金 ×1.15）真实作用于有建筑格子
  const r7 = mkRoom(2, { hex: false }); neutral(r7);
  const oi = G.BOARD.findIndex(c => c.type === 'prop');
  r7.cells[oi].own = r7.players[0].id; r7.cells[oi].level = 3;
  const rent0 = r7.calcRent(oi, 7);
  r7.mutation = { kind: 'general', facId: null, id: 'G1', name: '通胀风暴', desc: 'x', ops: { rentMul: 1.15 } };
  const rent1 = r7.calcRent(oi, 7);
  ok(rent1 > rent0 && Math.abs(rent1 - Math.round(rent0 * 1.15)) <= 1, `通胀风暴使租金 ×1.15（${rent0} → ${rent1}）`);

  // (d) 快照暴露 mutation（中央徽章数据源）
  const srv = src('server.js');
  ok(/mutation:\s*room\.mutation/.test(srv) && /facId/.test(srv) && /kind/.test(srv),
    'server 快照暴露 mutation（kind / facId / id / name / desc）');
}

// ================= [7] 前端镜像 =================
section(7, 'v7.5：浮层可点（pointer-events:auto）· 中央徽章突变态 · 查看面板效果卡分区 · 置灰不可用卡');
{
  const css = src(path.join('public', 'style.css'));
  const cli = src(path.join('public', 'client.js'));

  // 浮层可点：挂在 #fxLayer(pointer-events:none) 下的两层必须自己打开 auto
  const cdRule = (css.match(/\.cd-layer \{[^}]*\}/) || [''])[0];
  const ngRule = (css.match(/\.ng-layer \{[^}]*\}/) || [''])[0];
  ok(/pointer-events:\s*auto/.test(cdRule), '「三张翻面卡」浮层 .cd-layer 声明 pointer-events:auto（修复点不动）');
  ok(/pointer-events:\s*auto/.test(ngRule), '「无懈可击」响应框 .ng-layer 声明 pointer-events:auto');

  // 中央徽章突变态
  ok(/#facBadge\.fac-mut/.test(css) && /@keyframes facMutPulse/.test(css), 'style.css 提供 #facBadge.fac-mut 脉冲动画');
  ok(/fac-mut/.test(cli) && /已变异/.test(cli) && /🧬/.test(cli) && /突变/.test(cli),
    '中央城邦徽章在突变后改写为「已变异 + 🧬 突变效果描述 + 突变角标」');
  ok(/S\.mutation/.test(cli) && /mutTag/.test(cli), '徽章读取快照 mutation（无突变则回落常规风貌）');

  // 查看面板分区 + 效果卡列全
  ok(/function heldEffectCards/.test(cli) && /HOLD_SOURCES/.test(cli), '新增 heldEffectCards / HOLD_SOURCES（手牌 + 保留型计数器折算）');
  ok(/🃏 效果卡/.test(cli) && /🎓 专业与技能/.test(cli) && /🧪 研究项目/.test(cli),
    '点名字查看面板分区：研究项目 / 专业与技能 / 效果卡');
  ok(/hand\.map\(h =>/.test(cli) && /c\.desc/.test(cli), '效果卡分区逐张带效果描述（c.desc）');

  // 置灰不可用卡
  ok(/function cardUsableUI/.test(cli) && /data-ok/.test(cli) && /cp-no/.test(cli) && /\.cardp-card\.dim/.test(css),
    '手动卡面板：无合法目标的卡置灰（cardUsableUI + .dim + 「暂无可作用目标」）');

  // 无懈可击响应框文案更新
  ok(/发动了「/.test(cli) && /无懈可击卡/.test(cli) && /完全失效/.test(cli), '响应框文案已改为「XX 发动了…你手握无懈可击卡」');
}

// ================= [8] 快照完整性（查看面板数据源）=================
section(8, 'v7.5：快照下发查看面板所需的全部效果卡计数字段');
{
  const srv = src('server.js');
  const need = ['medal', 'stayFree', 'joker', 'fineFree', 'buildCutCard', 'discount', 'stepBuffs',
    'rentX2', 'rentHalf', 'insure', 'truce', 'auctionVouch', 'revive', 'investCards', 'borrow', 'hand'];
  const miss = need.filter(k => !srv.includes(k));
  ok(miss.length === 0, `server 快照覆盖全部保留型计数器字段${miss.length ? '（缺：' + miss.join(',') + '）' : ''}`);
}

console.log('\n========================================');
console.log(`  v7.5 单测：${pass} 通过 / ${fail} 失败`);
console.log('========================================');
process.exit(fail ? 1 : 0);
