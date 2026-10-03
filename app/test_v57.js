#!/usr/bin/env node
// v5.7 测试：海克斯 · 研究项目（校级/省级/国家级三选一）
'use strict';
const path = require('path');
const fs = require('fs');
const G = require('./game');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg); }
}
function section(n, t) { console.log(`\n[${n}] ${t}`); }

// 从 client.js 提取镜像表并与 game.js 对比（逐字结构比对）
function extractClientMirror() {
  const src = fs.readFileSync(path.join(__dirname, 'public', 'client.js'), 'utf8');
  const start = src.indexOf('const HEX_TIERS = {');
  const endMark = 'for (const k in PROJECTS) PROJECT_KEYS[PROJECTS[k].tier].push(k);';
  const end = src.indexOf(endMark);
  if (start < 0 || end < 0) return null;
  const code = src.slice(start, end + endMark.length);
  const fn = new Function(`${code}; return { HEX_TIERS, PROJECTS };`);
  return fn();
}

// 构造一个开好海克斯的测试房间（2~5 人）
function mkRoom(n = 3, opts) {
  const room = new G.Room('t' + Math.floor(Math.random() * 1e6), Object.assign({ hex: true }, opts || {}));
  for (let i = 0; i < n; i++) room.join('P' + (i + 1), i > 0);
  return room;
}

// ================= [1] 镜像一致性与表完整性 =================
section(1, 'PROJECTS / HEX_TIERS 镜像一致 + 表完整性');
{
  const mir = extractClientMirror();
  ok(!!mir, 'client.js 镜像表可提取');
  if (mir) {
    ok(JSON.stringify(mir.HEX_TIERS) === JSON.stringify(G.HEX_TIERS), 'HEX_TIERS 与服务端逐字一致');
    ok(JSON.stringify(mir.PROJECTS) === JSON.stringify(G.PROJECTS), 'PROJECTS 与服务端逐字一致');
  }
  const tiers = { silver: 0, gold: 0, prism: 0 };
  const ids = new Set();
  let structOK = true;
  for (const k in G.PROJECTS) {
    const pr = G.PROJECTS[k];
    if (ids.has(k)) structOK = false;
    ids.add(k);
    if (!G.HEX_TIERS[pr.tier]) structOK = false;
    if (!pr.icon || !pr.name || !pr.desc) structOK = false;
    tiers[pr.tier]++;
  }
  ok(structOK, '所有项目都有 tier/icon/name/desc 且 id 唯一');
  ok(tiers.silver === 20 && tiers.gold === 20 && tiers.prism === 14, `池子规模 银级20/金级20/彩级14（实际 ${tiers.silver}/${tiers.gold}/${tiers.prism}）`);
  let keysOK = Object.values(G.PROJECT_KEYS).flat().length === Object.keys(G.PROJECTS).length;
  ok(keysOK, 'PROJECT_KEYS 三档分组完整');
  // 同档内效果幅度一致（平衡约束抽查：同名修正在不同项目里的量纲统一）
  ok(G.HEX_TIER_P.length === 3 && G.HEX_TIER_P.every(r => Math.abs(r[0] + r[1] + r[2] - 1) < 1e-9), '三次立项档位概率各自归一');
  ok(JSON.stringify(G.HEX_TRIGGERS) === JSON.stringify([2, 10, 20]), '触发轮次 = 第 2 / 10 / 20 轮');
}

// ================= [2] maybeProject 流程与发牌 =================
section(2, '三选一开启：全员同档、选项不重复、不发已拥有的');
{
  const room = mkRoom(5);
  room.start();
  room.clearTimer(); room.clearAiTimers();
  room.round = 2;
  room.hexDoneRounds.length = 0;
  const opened = room.maybeProject();
  ok(opened && room.phase === 'project', '第 2 轮进入 project 阶段');
  ok(!!room.project && room.project.round === 2, 'project 状态记录了轮次');
  const tier = room.project.tier;
  ok(G.HEX_TIERS[tier], '档位合法：' + G.HEX_TIERS[tier].name);
  const all = [];
  let shapeOK = true;
  for (const p of room.players) {
    const off = room.project.offers[p.id];
    if (!off || off.length !== 3 || new Set(off).size !== 3) shapeOK = false;
    all.push(...off);
  }
  ok(shapeOK, '每人 3 个互不相同的候选');
  ok(new Set(all).size === all.length, `15 张候选全场零重复（5 人 × 3，池 20 个够发）`);
  // 已拥有的项目不会再出现
  room.players[0].hexList = ['stipend'];
  room.players[0].hexList.length; // noop
  room.project = null; room.phase = 'roll';
  room.round = 10; room.hexDoneRounds = [];
  room.maybeProject();
  ok(!room.project.offers[room.players[0].id].includes('stipend'), '已立项的项目不会再次进入候选');
  ok(room.hexDoneRounds.includes(10) && room.hexDoneRounds.length >= 1, '触发轮次去重登记');
  room.clearTimer(); room.clearAiTimers();
}

// ================= [3] 档位概率分布（统计抽样） =================
section(3, '档位概率：第 1 次银多、第 3 次彩明显增多');
{
  const count = { silver: 0, gold: 0, prism: 0 };
  const N = 600;
  for (let i = 0; i < N; i++) {
    const room = mkRoom(2);
    room.start(); room.clearTimer(); room.clearAiTimers();
    room.round = 2; room.maybeProject();
    count[room.project.tier]++;
    room.clearTimer(); room.clearAiTimers();
  }
  ok(count.silver > count.gold && count.gold >= count.prism * 1.2, `第 1 次立项分布合理 银=${count.silver} 金=${count.gold} 彩=${count.prism}`);
  const cnt3 = { silver: 0, gold: 0, prism: 0 };
  for (let i = 0; i < N; i++) {
    const room = mkRoom(2);
    room.start(); room.clearTimer(); room.clearAiTimers();
    room.round = 20; room.maybeProject();
    cnt3[room.project.tier]++;
    room.clearTimer(); room.clearAiTimers();
  }
  ok(cnt3.prism > count.prism && cnt3.prism > cnt3.silver * 0.5, `第 3 次立项棱彩占比显著上升 彩=${cnt3.prism}（第1次=${count.prism}）`);
}

// ================= [4] 选择与结算闭环 =================
section(4, 'pickProject → settleProject → 立项生效 → 回到 roll');
{
  const room = mkRoom(3);
  room.start();
  room.clearTimer(); room.clearAiTimers();
  room.round = 2; room.maybeProject();
  const tier = room.project.tier;
  for (const p of room.players) room.pickProject(p, room.project.offers[p.id][0]);
  ok(room.phase === 'roll' && room.project === null, '全员选完自动结算并回到 roll 阶段');
  ok(room.players.every(p => p.hexList.length === 1), '每人 hexList 各有一条立项记录');
  ok(room.players.every(p => Object.keys(p.hex).length > 0), '效果修正已写入 p.hex');
  const granted = room.players.map(p => G.PROJECTS[p.hexList[0]]);
  ok(granted.every(pr => pr.tier === tier), '发到手的档位与公示档位一致');
  room.clearTimer(); room.clearAiTimers();
  // AI 全自动走一遍
  const room2 = mkRoom(4);
  room2.start(); room2.clearTimer(); room2.clearAiTimers();
  room2.round = 10; room2.maybeProject();
  for (const p of room2.players) room2.aiProject(p);
  ok(room2.phase === 'roll' && room2.players.every(p => p.hexList.length === 1), 'AI 自动三选一也能走完整个流程');
  room2.clearTimer(); room2.clearAiTimers();
}

// ================= [5] 效果钩子逐个验证 =================
section(5, '效果钩子：补贴 / 返现 / 免疫 / 重投 / 双倍工资 / 涅槃');
{
  const room = mkRoom(2);
  const [a, b] = room.players;
  room.start(); room.clearTimer(); room.clearAiTimers();

  // 每轮补贴 + 利息 + 兜底
  a.hex = { turnCash: 700, interestPct: 0.05, interestMin: 15000, interestCap: 1200, floor: 2000 };
  a.cash = 16000;
  const cash0 = a.cash;
  room.applyHexPassives(a);
  ok(a.cash === cash0 + 700 + 835, `定期存款（5% 封顶1200，在补贴后计息）+ 每轮补贴 → +1535（实际 +${a.cash - cash0}）`);
  a.cash = 500;
  room.applyHexPassives(a);
  ok(a.cash === 2000, `风险兜底最后兜到 2000（补贴先进账再被兜平）→ ¥${a.cash}`);

  // 付款返现
  a.hex = { cashbackPct: 0.08, cashbackCap: 300 };
  a.cash = 10000; b.cash = 0;
  room.tryPay(a, 5000, b);
  ok(a.cash === 5000 + 300, `消费返现 8% 封顶 ¥300（付 5000 返 300）`);
  a.cash = 10000;
  room.tryPay(a, 1000, null, true);
  ok(a.cash === 9000 + 80, `付基金池也返现（1000×8%=80）`);

  // 免疫：绝对防御消耗次数，学术保护次之
  a.hex = { immuneCharges: 3, immuneBonus: 2 };
  a.skillLeft = 0;
  ok(room.immune(a, '测试判定') === true && a.hex.immuneCharges === 2, '绝对防御先消耗（3→2）');
  ok(room.immune(a, '测试判定') === true && a.hex.immuneCharges === 1 && a.hex.immuneBonus === 2, '第二次仍消耗绝对防御（2→1），学术保护未动');
  a.hex.immuneCharges = 0;
  ok(room.immune(a, '测试判定') === true && a.hex.immuneBonus === 1, '学术保护顶上（2→1）');
  a.hex = { immuneCharges: 0, immuneBonus: 0 };
  ok(room.immune(a, '测试判定') === false, '没有免疫资源且技能次数为 0 → 不免疫');

  // 重投：情报网打折 + 重投大师免费
  a.hex = { rerollCut: 0.25 };
  ok(room.rerollCostFor(a) === Math.round(1200 * 0.75), '情报网：重投费用 1200→900');
  a.hex = { freeReroll: 1 };
  a.hexFreeUsed = false;
  a.cash = 30000;
  const before = a.cash;
  // 构造 reroll 询问
  room.phase = 'reroll';
  room.pendingReroll = { pid: a.id, cost: 1200, target: null, steps: 7 };
  room.dice = [3, 4];
  room.doReroll(a);
  ok(a.cash === before && a.hexFreeUsed === true, '重投大师：首次重投免费且登记已用');
  room.clearTimer(); room.clearAiTimers();

  // 双倍工资
  a.hex = { salaryX2: 1 };
  const w = room.payWage(a);
  ok(w === G.SALARY * 2, `双倍工资：¥${G.SALARY}→¥${w}`);

  // 涅槃：免债复活
  a.hex = { nirvana: 1 };
  a.alive = true;
  room.phase = 'roll';
  room.raise = null;
  room.bankrupt(a, null);
  ok(a.alive && a.cash === 6000, '涅槃：破产被拦下，带 ¥6000 复活');
  a.hex = {};
  room.clearTimer(); room.clearAiTimers();
  room.clearAiTimers();
}

// ================= [6] 开关兼容：未开 hex 的房间行为不变 =================
section(6, 'hexOn=false（老房间）完全不触发');
{
  const room = new G.Room('t-old');
  room.join('A', true); room.join('B', true);
  room.start();
  room.clearTimer(); room.clearAiTimers();
  room.round = 2;
  ok(room.maybeProject() === false && room.phase !== 'project', '未开启时 maybeProject 不生效');
  ok(room.hexDoneRounds.length === 0, '无副作用');
}

// ================= [7] 客户端资产文本校验 =================
section(7, '客户端接线检查');
{
  const cli = fs.readFileSync(path.join(__dirname, 'public', 'client.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf8');
  const srv = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  ok(cli.includes("case 'project_offer'") && cli.includes("case 'project_pick'") && cli.includes("case 'project_grant'") && cli.includes("case 'hexfx'"), 'handleAnim 挂了 4 个新 case');
  ok(cli.includes("'project_offer', 'project_pick', 'project_grant', 'hexfx'"), 'ANIMATED 集合已登记');
  ok(cli.includes("openPlayerViewer('${p.id}')"), '玩家卡可点击查看他人');
  ok(cli.includes("action: { type: 'pickProject', key }"), '点卡发送 pickProject');
  ok(css.includes('.hx-card.t-prism') && css.includes('.hxp-layer') && css.includes('.hx-bar b.danger'), '样式：三档卡 / 查看浮层 / 倒计时三段变色');
  ok(srv.includes("case 'pickProject'") && srv.includes('hex: true'), '服务端消息接线 + 开房开启 hex');
}

console.log('\n========================================');
console.log(`  v5.7 引擎测试：${pass} 通过 / ${fail} 失败`);
console.log('========================================');
process.exit(fail ? 1 : 0);
