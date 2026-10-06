#!/usr/bin/env node
// v7.7 单测：① 效果卡总量上限 6 张（手牌 + 计数器，同名多张按张数计）
//            ② 火攻只烧「房子最少」的地皮（优先无房 → 全部有房才取最低层数）
//            ③ 万箭齐发：受击方本人抉择「缴 ¥2200 / 自己挑一块地皮拆」
//   [1] heldCardCount 口径 + 闸门（满 6 退回 / 用掉一张后恢复 / 即时型不占位）
//   [2] 火攻最低层数规则（Lv0 优先 · 全有房取 Lv1 · 指定非最低层无效）
//   [3] askChoice / answerChoice / answerChoiceBy / aiChoice 原语
//   [4] 万箭齐发整条链（逐人询问 · 缴钱 / 拆指定地皮 · 无地直接缴 · 收尾回 card 相位）
//   [5] 双镜像与前端：client.js 描述同步 + choiceSync + .ch-layer CSS + server 路由
'use strict';
const fs = require('fs');
const path = require('path');
const G = require('./game.js');

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.error('  ✗ ' + name); } };
const section = (n, t) => console.log(`\n[${n}] ${t}`);
const src = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

function mkRoom(n = 3, opts) {
  const room = new G.Room('v77' + Math.floor(Math.random() * 1e6), Object.assign({ hex: false, faculty: false, draft: false }, opts || {}));
  for (let i = 0; i < n; i++) room.join('P' + (i + 1), i > 0);
  room.start();
  room.clearTimer(); room.clearAiTimers();
  room.players.forEach(p => { p.isAI = false; });
  room.phase = 'roll';
  return room;
}
function neutral(r) {
  r.faculty = null; r.season = 'mid'; r.weather = 'cloud'; r.calEvent = null; r.mutation = null; r.mutRoll = null;
}
const props = r => G.BOARD.map((c, i) => i).filter(i => G.BOARD[i].type === 'prop');

// ================= [1] 效果卡总量上限 6 张 =================
section(1, 'v7.7：效果卡上限 6 张 —— 手牌 + 计数器合计，同名多张按张数计');
{
  const r = mkRoom(2); neutral(r);
  const [a] = r.players;
  // 用户口径：3 张免租金卡 + 2 张免停留卡 + 1 张万能卡 = 6 张（已满）
  a.medal = 3; a.stayFree = 2; a.joker = 1; a.hand = [];
  ok(r.heldCardCount(a) === 6, `3 免租金 + 2 免停留 + 1 万能 = 6 张（实际 ${r.heldCardCount(a)}）`);

  const evs = [];
  const _ev = r.ev.bind(r); r.ev = e => { evs.push(e.t); return _ev(e); };
  // 满仓后再来一张「免租金卡」→ 被退回
  const before = a.medal;
  r.applyEffectCard(a, G.EFFECT_CARDS.find(c => c.id === 'medal'));
  ok(a.medal === before && evs.includes('hand_full'), '满 6 张：再获得免租金卡被退回（medal 不增 + hand_full 事件）');

  // 满仓后手动型卡（进手牌）同样被退回
  r.applyEffectCard(a, G.EFFECT_CARDS.find(c => c.id === 'seize'));
  ok(!(a.hand || []).some(h => h.id === 'seize'), '满 6 张：手动发动型卡也进不来（手牌不变）');

  // 用掉一张（免租金卡被消耗）→ 立刻有空位
  a.medal--;
  ok(r.heldCardCount(a) === 5, '用掉 1 张免租金卡 → 持有量 5（有空位了）');
  r.applyEffectCard(a, G.EFFECT_CARDS.find(c => c.id === 'seize'));
  ok((a.hand || []).some(h => h.id === 'seize') && r.heldCardCount(a) === 6, '空出 1 位后可以再获得 1 张（回到 6）');
  r.ev = _ev;

  // 即时结算型不占位：满仓时现金红包 / 技能刷新 照常结算
  const r2 = mkRoom(2); neutral(r2);
  const [b] = r2.players;
  b.hand = []; b.medal = 6;
  ok(r2.heldCardCount(b) === 6, '凑满 6 张（6 张免租金卡）');
  const cash0 = b.cash;
  r2.applyEffectCard(b, G.EFFECT_CARDS.find(c => c.id === 'cash'));
  ok(b.cash > cash0, '满仓时「现金红包」仍照常到账（即时型不占位）');
  b.skillLeft = 0;
  r2.applyEffectCard(b, G.EFFECT_CARDS.find(c => c.id === 'skillfull'));
  ok((b.skillLeft || 0) >= 0, '「技能刷新卡」不受上限影响');

  // 占位集合口径
  ok(G.SLOT_CARDS.has('medal') && G.SLOT_CARDS.has('joker') && G.SLOT_CARDS.has('stayfree') && G.SLOT_CARDS.has('finefree'),
    'SLOT_CARDS：免租金 / 万能 / 免停留 / 免罚款 都占位');
  ok(['cash', 'charity', 'skillfull', 'funddiv', 'investcard', 'skill'].every(id => !G.SLOT_CARDS.has(id)),
    '即时结算型（现金红包 / 慈善捐 / 技能刷新 / 基金分红 / 投资券 / 技能次数）不占位');
  ok(G.HAND_CAP === 6, 'HAND_CAP = 6');
}

// ================= [2] 火攻：只烧房子最少的地皮 =================
section(2, 'v7.7：火攻 —— 优先烧无房地皮；全部有房才取最低层数（Lv1 → Lv2 …）');
{
  const r = mkRoom(2); neutral(r);
  const [a, b] = r.players;
  const P = props(r);
  // 三块：Lv0 / Lv1 / Lv2，重复 30 次都只能烧到 Lv0 那块
  const [c0, c1, c2] = [P[0], P[1], P[2]];
  let bad = 0;
  for (let k = 0; k < 30; k++) {
    r.cells[c0].own = b.id; r.cells[c0].level = 0;
    r.cells[c1].own = b.id; r.cells[c1].level = 1;
    r.cells[c2].own = b.id; r.cells[c2].level = 2;
    r.resolveCardEffect(a, 'fireattack', b, {});
    if (r.cells[c0].own !== null || r.cells[c1].own !== b.id || r.cells[c2].own !== b.id) bad++;
  }
  ok(bad === 0, `有空地时只烧 Lv0 那块（30 次全部命中，误烧 ${bad} 次）`);

  // 指定「非最低层」的格子无效 —— 仍烧最低层
  r.cells[c0].own = b.id; r.cells[c0].level = 0;
  r.cells[c1].own = b.id; r.cells[c1].level = 1;
  r.cells[c2].own = b.id; r.cells[c2].level = 2;
  const msg = r.resolveCardEffect(a, 'fireattack', b, { cell: c2 });
  ok(r.cells[c0].own === null && r.cells[c2].own === b.id, `指定 Lv2 也无效，仍烧 Lv0（${msg}）`);

  // 名下全部有房 → 只能烧最低层数（Lv1）
  let bad2 = 0;
  for (let k = 0; k < 30; k++) {
    r.cells[c0].own = b.id; r.cells[c0].level = 1;
    r.cells[c1].own = b.id; r.cells[c1].level = 2;
    r.cells[c2].own = b.id; r.cells[c2].level = 3;
    r.resolveCardEffect(a, 'fireattack', b, {});
    if (r.cells[c0].own !== null || r.cells[c1].own !== b.id) bad2++;
  }
  ok(bad2 === 0, `全部有房：只烧最低的 Lv1（30 次全部命中，误烧 ${bad2} 次）`);

  // 全是 Lv2 → 只能烧 Lv2
  r.cells[c0].own = b.id; r.cells[c0].level = 2;
  r.cells[c1].own = b.id; r.cells[c1].level = 2;
  r.cells[c2].own = b.id; r.cells[c2].level = 2;
  r.resolveCardEffect(a, 'fireattack', b, {});
  const burned = [c0, c1, c2].filter(i => r.cells[i].own === null);
  ok(burned.length === 1 && [c0, c1, c2].filter(i => r.cells[i].own === b.id).length === 2,
    `全是 Lv2：只能烧掉其中一块（烧掉 ${burned.length} 块，剩 2 块仍在名下）`);

  // 自付 ¥500 + 化为无主（含抵押清除）
  const r2 = mkRoom(2); neutral(r2);
  const [x, y] = r2.players;
  const idx = props(r2)[5];
  r2.cells[idx].own = y.id; r2.cells[idx].level = 0; r2.cells[idx].mortgaged = true;
  const before = x.cash;
  r2.resolveCardEffect(x, 'fireattack', y, {});
  ok(x.cash === before - 500 && r2.cells[idx].own === null && r2.cells[idx].mortgaged === false,
    '火攻：自付 ¥500 · 地皮化为无主 · 抵押状态清除');
}

// ================= [3] askChoice 原语 =================
section(3, 'v7.7：askChoice / answerChoice / answerChoiceBy / aiChoice');
{
  const r = mkRoom(3); neutral(r);
  const [a, b, c] = r.players;
  let picked = null;
  const ret = r.askChoice(b, { kind: 'test', title: '测试', desc: '选一个', options: [{ key: 'x', label: 'X' }, { key: 'y', label: 'Y' }] }, k => { picked = k; });
  ok(ret === true && r.phase === 'choice' && r.pendingChoice && r.pendingChoice.pid === b.id, 'askChoice：进入 choice 相位并挂起 pendingChoice');
  // 非被问者应答无效
  r.answerChoiceBy(a, 'x');
  ok(!!r.pendingChoice && picked === null, 'answerChoiceBy：非被问者应答无效');
  // 本人应答 y
  r.answerChoiceBy(b, 'y');
  ok(picked === 'y' && !r.pendingChoice, 'answerChoiceBy：本人应答 → 回调收到 y 且清挂起');
  // 无效 key → 回退第一个选项
  let picked2 = null;
  r.askChoice(c, { kind: 'test', options: [{ key: 'm', label: 'M' }, { key: 'n', label: 'N' }] }, k => { picked2 = k; });
  r.answerChoice('zzz');
  ok(picked2 === 'm', 'answerChoice 传了不存在的 key → 回退第一个选项');
  // 无选项 / 无玩家 → 同步回调 null，不挂起
  let picked3 = 'init';
  const ret3 = r.askChoice(c, { kind: 'test', options: [] }, k => { picked3 = k; });
  ok(ret3 === false && picked3 === null && !r.pendingChoice, '无选项：同步回调 null，不进入 choice 相位');
}

// ================= [4] 万箭齐发：受击方本人抉择 =================
section(4, 'v7.7：万箭齐发 —— 逐人询问「缴 ¥2200 / 自己挑一块地皮拆」');
{
  const r = mkRoom(3); neutral(r);
  const [a, b, c] = r.players;
  const P = props(r);
  // b 有两块地 + 有钱；c 没有地
  r.cells[P[0]].own = b.id; r.cells[P[0]].level = 0;
  r.cells[P[1]].own = b.id; r.cells[P[1]].level = 1;
  b.cash = 5000;
  c.cash = 3000;

  r.resolveCardEffect(a, 'arrowrain', null, {});
  ok(r.phase === 'choice' && r.pendingChoice && r.pendingChoice.pid === b.id, '发动后先问第一个受击方 b（phase=choice）');
  const opts = (r.pendingChoice.payload.options || []);
  ok(opts.length === 3 && opts[0].key === 'pay' && opts[1].key === 'land:' + P[0] && opts[2].key === 'land:' + P[1],
    `选项 = 缴 ¥2200 + 两块地皮（层数少 → 价格低排序，实际 ${opts.map(o => o.key).join('|')}）`);
  ok(/万箭齐发/.test(r.pendingChoice.payload.title || ''), '浮层标题带「万箭齐发」');

  // b 选择「自己拆 P[1]（那块有房子的）」
  const cashB = b.cash, cashA = a.cash;
  r.answerChoiceBy(b, 'land:' + P[1]);
  ok(r.cells[P[1]].own === null && r.cells[P[0]].own === b.id, '受击方自己挑的地皮被拆（另一块保留）');
  ok(b.cash === cashB, '选择拆地 → 受击方自己不动现金（缴钱才会转移）');
  // 接着问 c：名下无地 → 直接缴钱，不再询问
  ok(r.pendingChoice === null && r.phase === 'card', 'c 名下无地 → 自动缴钱并结束流程（回到 card 相位）');
  ok(c.cash === 3000 - 2200 && a.cash === cashA + 2200, `无地者直接缴 ¥2200 给发动者（c=${c.cash}）`);

  // 现金不足 2200 的地主：只能拆地（选项里没有 pay）
  const r2 = mkRoom(2); neutral(r2);
  const [x, y] = r2.players;
  const Q = props(r2);
  r2.cells[Q[0]].own = y.id; r2.cells[Q[0]].level = 0;
  r2.cells[Q[2]].own = y.id; r2.cells[Q[2]].level = 0;
  y.cash = 900;
  r2.resolveCardEffect(x, 'arrowrain', null, {});
  const o2 = (r2.pendingChoice.payload.options || []);
  ok(o2.length === 2 && !o2.some(o => o.key === 'pay'), `现金不足 ¥2200：只给拆地选项（实际 ${o2.map(o => o.key).join('|')}）`);
  ok(/必须自己挑一块地皮拆掉/.test(r2.pendingChoice.payload.desc || ''), '文案说明「必须拆地」');
  r2.answerChoiceBy(y, 'land:' + Q[2]);
  ok(r2.cells[Q[2]].own === null && r2.cells[Q[0]].own === y.id && y.cash === 900, '拆的是受击方挑的那一块，现金不变');

  // 选择缴钱的路径
  const r3 = mkRoom(2); neutral(r3);
  const [m, n] = r3.players;
  const R = props(r3);
  r3.cells[R[0]].own = n.id; r3.cells[R[0]].level = 0;
  n.cash = 4000; const m0 = m.cash;
  r3.resolveCardEffect(m, 'arrowrain', null, {});
  r3.answerChoiceBy(n, 'pay');
  ok(n.cash === 4000 - 2200 && m.cash === m0 + 2200 && r3.cells[R[0]].own === n.id, '选择缴 ¥2200：钱转给发动者，地皮保留');

  // AI 受击方：走 aiChoice 自动决策（不会卡住流程）
  const r4 = mkRoom(2); neutral(r4);
  const [p1, p2] = r4.players;
  p2.isAI = true;
  const S = props(r4);
  r4.cells[S[0]].own = p2.id; r4.cells[S[0]].level = 0;
  p2.cash = 4000;
  r4.resolveCardEffect(p1, 'arrowrain', null, {});
  ok(r4.phase === 'choice' && !!r4.pendingChoice, 'AI 受击方同样挂起抉择（等待 AI 定时器）');
  r4.aiChoice(p2);
  ok(!r4.pendingChoice && r4.phase === 'card', 'aiChoice 后流程结束（回到 card 相位，不挂死）');
}

// ================= [5] 前端 / 服务端接轨 =================
section(5, 'v7.7：client.js 双镜像 · choiceSync 浮层 · .ch-layer 样式 · server 路由');
{
  const cj = src('public/client.js');
  const gj = src('game.js');
  const grab = s => { const i = s.indexOf('const EFFECT_CARDS = ['); const j = s.indexOf('\n];', i); return s.slice(i, j); };
  ok(grab(gj) === grab(cj), '双镜像：EFFECT_CARDS 逐字一致（含 v7.7 新描述）');
  ok(/由受击方本人抉择/.test(cj), 'client.js 万箭齐发描述已同步（受击方本人抉择）');
  ok(/房子最少的地皮/.test(cj), 'client.js 火攻描述已同步（只烧房子最少的地皮）');
  ok(/function choiceSync\(\)/.test(cj) && /choiceSync\(\);/.test(cj), 'client.js 有 choiceSync 且已挂进渲染循环');
  ok(/type: 'answerChoice'/.test(cj), 'client.js 点击选项发出 answerChoice');
  const css = src('public/style.css');
  ok(/\.ch-layer\s*\{[^}]*pointer-events:auto/.test(css), '.ch-layer 显式 pointer-events:auto（#fxLayer 下不声明会点不动）');
  ok(/\.ch-btn\s*\{/.test(css) && /\.ch-opts\s*\{/.test(css), '.ch-opts / .ch-btn 样式齐备');
  const sv = src('server.js');
  ok(/case 'answerChoice': room\.answerChoiceBy/.test(sv), 'server.js 路由 answerChoice');
  ok(/pendingChoice: room\.pendingChoice \?/.test(sv), 'server.js 快照下发 pendingChoice（断线重连补浮层）');
  const sm = src('simulate.js');
  ok(/case 'choice':/.test(sm), 'simulate.js 支持 choice 相位（模拟对局不会卡死）');
}

console.log(`\n========================================\n  v7.7 单测：${pass} 通过 / ${fail} 失败\n========================================\n`);
process.exit(fail ? 1 : 0);
