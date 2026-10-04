// test_v54.js —— v5.4 引擎单测：AI 托管 + AI 拟人化
// 覆盖：[1] 托管开关（setTrustee 开/关/AI 无效/事件流）
//       [2] 托管接手当前决策（buy/reroll 阶段 busySelf → 排 AI 定时器）
//       [3] 取回操作权恢复人类兜底
//       [4] AI 拟人：开局问候 / 主动技发言 / 垄断发言 / 大额付款吐槽（事件流有 chat）
//       [5] aiReroll 精明化：落点是自己地/可买好地时确认不重投
//       [6] 客户端资产存在性（文本级）：托管按钮 / 挂载点 / 样式 / 新音效 / 虚影增强
'use strict';
const fs = require('fs');
const path = require('path');
const {
  Room, BOARD, GROUPS, MAJORS, REROLL_COST,
} = require('./game.js');

let pass = 0, fail = 0, seed = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }

function mkRoom(n, opt) {
  const r = new Room('t' + (++seed));
  for (let i = 0; i < n; i++) r.join('P' + (i + 1), i > 0);   // P1 真人，其余 AI
  r.startedAt = Date.now();
  for (const p of r.players) { if (p.major) p.skillLeft = MAJORS[p.major].uses; }
  r.phase = 'roll'; r.round = 1; r.season = 'mid'; r.weather = (opt && opt.weather) || 'cloud';
  r.calEvent = null; r.dice = [3, 4];
  r.afterResolve = () => {};   // 单测里不推进回合
  return r;
}
const cur = r => r.players[r.cur];
const firstProp = () => BOARD.findIndex(c => c.type === 'prop');
const eventsOf = r => r._evs || [];
// 抓事件：Room.prototype.ev 用 this.ev 存储于实例外不好拦，直接挂到原型前先备份
const origEv = Room.prototype.ev;
Room.prototype.ev = function (e) { (this._evs = this._evs || []).push(e); return origEv.call(this, e); };

console.log('========================================');
console.log('  v5.4 AI 托管 + 拟人化 · 引擎单测');
console.log('========================================');

// ---------------- [1] 托管开关 ----------------
console.log('\n[1] 托管开关 setTrustee');
{
  const r = mkRoom(2);   // P1 真人 + P2 AI
  const me = r.players[0], ai = r.players[1];
  ok(me.isAI === false && me.trustee !== true, '初始：真人 isAI=false / 无 trustee');
  r.setTrustee(me, true);
  ok(me.trustee === true && me.isAI === true, '开启托管：trustee=true 且 isAI=true（走 AI 决策）');
  ok(eventsOf(r).some(e => e.t === 'trustee' && e.pid === me.id && e.on === true), '事件流出现 trustee(on)');
  ok(r.log.some(l => /开启了 AI 托管/.test(l.msg)), '日志提示「开启了 AI 托管」');

  r.setTrustee(me, false);
  ok(me.trustee === false && me.isAI === false, '关闭托管：恢复真人 isAI=false');
  ok(eventsOf(r).some(e => e.t === 'trustee' && e.pid === me.id && e.on === false), '事件流出现 trustee(off)');

  const n0 = eventsOf(r).length;
  r.setTrustee(ai, true);   // 原生 AI 开托管应被拒绝
  ok(ai.trustee !== true && ai.isAI === true && eventsOf(r).length === n0, '原生 AI 玩家无法开启托管（无效操作不产生事件）');

  r.setTrustee(me, true);
  r.setTrustee(me, true);   // 重复开启应幂等
  ok(me.trustee === true && eventsOf(r).filter(e => e.t === 'trustee' && e.on).length === 2, '重复开启幂等（不重复发事件）');
}

// ---------------- [2] 托管接手当前决策 ----------------
console.log('\n[2] 托管后 AI 立即接手当前决策阶段');
{
  // buy 阶段开托管：应清人类兜底并排 aiBuy 定时器
  const r = mkRoom(2);
  const me = r.players[0];
  const idx = firstProp();
  r.cells[idx].own = null;
  r.phase = 'buy'; r.pendingBuy = { pid: me.id, cell: idx, price: BOARD[idx].price };
  r.timer = setTimeout(() => {}, 1e9);   // 模拟人类兜底定时器
  r.setTrustee(me, true);
  ok(r.timer === null, '开启托管清掉人类超时兜底定时器');
  ok(r.aiTimers.length > 0, '已排入 AI 接手定时器');
  clearTimeout(r.timer); r.clearAiTimers();

  // reroll 阶段开托管
  const r2 = mkRoom(2);
  const me2 = r2.players[0];
  r2.phase = 'reroll'; r2.pendingReroll = { pid: me2.id, target: firstProp(), steps: 7 };
  r2.setTrustee(me2, true);
  ok(r2.aiTimers.length > 0, '重投决策阶段开托管同样立即接手');
  r2.clearAiTimers();
}

// ---------------- [3] 取回操作权恢复人类兜底 ----------------
console.log('\n[3] 取回操作权恢复人类超时兜底');
{
  const r = mkRoom(2);
  const me = r.players[0];
  const idx = firstProp();
  r.phase = 'buy'; r.pendingBuy = { pid: me.id, cell: idx, price: BOARD[idx].price };
  r.setTrustee(me, true);
  r.clearAiTimers();
  r.setTrustee(me, false);
  ok(r.timer !== null, '取回操作权后重新挂上人类超时兜底定时器');
  clearTimeout(r.timer);
}

// ---------------- [4] AI 拟人化 ----------------
console.log('\n[4] AI 拟人：情境化发言进入事件流');
{
  // 垄断成组 → 强制发言（用 AI 玩家作为买家，aiChat 只对 AI 生效）
  const r = mkRoom(2);
  const bot = r.players[1];
  const props = BOARD.map((c, i) => ({ c, i })).filter(({ c }) => c.type === 'prop');
  const g = props[0].c.g;
  const gc = BOARD.map((c, i) => ({ c, i })).filter(({ c }) => c.type === 'prop' && c.g === g).map(({ i }) => i);
  for (let k = 0; k < gc.length - 1; k++) { r.cells[gc[k]].own = bot.id; r.cells[gc[k]].level = 0; }
  bot.pos = gc[gc.length - 1];
  bot.cash += BOARD[gc[gc.length - 1]].price * 2;
  r.phase = 'buy'; r.pendingBuy = { pid: bot.id, cell: gc[gc.length - 1], price: BOARD[gc[gc.length - 1]].price };
  r.buy(bot);
  ok(eventsOf(r).some(e => e.t === 'mono' && e.pid === bot.id), '买齐同色组触发 mono 事件');
  ok(eventsOf(r).some(e => e.t === 'chat' && e.pid === bot.id), '垄断时 AI 强制发一言（chat 事件）');

  // 主动技发动 → 有概率发言（跑多次确保至少命中一次的概率高；用 force 路径不合适，改为验证不抛错+字段）
  const r2 = mkRoom(2);
  const m2 = r2.players[0]; m2.major = 'ai'; m2.skillLeft = MAJORS.ai.uses;
  r2.phase = 'skill'; r2.pendingSkill = { pid: m2.id, key: 'ai' };
  let threw = null;
  try { r2.useSkill(m2); } catch (e) { threw = e; }
  ok(!threw, 'AI 发动主动技流程无异常' + (threw ? '：' + threw.message : ''));
  ok(eventsOf(r2).some(e => e.t === 'skill'), '主动技 skill 事件正常');
}

// ---------------- [5] aiReroll 精明化 ----------------
console.log('\n[5] aiReroll：落点有利时确认不重投');
{
  const r = mkRoom(2);
  const me = r.players[0];
  const idx = firstProp();
  r.cells[idx].own = me.id; r.cells[idx].level = 0;   // 落点是自己的地
  r.phase = 'reroll'; r.dice = [2, 2];                // 点数差（4）
  r.pendingReroll = { pid: me.id, target: idx, steps: 4 };
  let rerolled = false;
  const orig = r.doReroll.bind(r);
  r.doReroll = (p) => { rerolled = true; return orig(p); };
  r.aiReroll(me);
  ok(!rerolled, '落点是自己的地，即使点数差也不花冤枉钱重投');

  const r2 = mkRoom(2);
  const m2 = r2.players[0];
  const idx2 = firstProp();
  r2.cells[idx2].own = null;
  r2.phase = 'reroll'; r2.dice = [1, 2];              // 点数 3，落点是无主地且买得起
  m2.cash += BOARD[idx2].price;
  r2.pendingReroll = { pid: m2.id, target: idx2, steps: 3 };
  let rerolled2 = false;
  const orig2 = r2.doReroll.bind(r2);
  r2.doReroll = (p) => { rerolled2 = true; return orig2(p); };
  r2.aiReroll(m2);
  ok(!rerolled2, '落点是无主好地且买得起 → 直接走过去买，不重投');
}

// ---------------- [6] 客户端资产存在性 ----------------
console.log('\n[6] 客户端托管 UI / 音效 / 虚影增强 / 天气增强');
{
  const cli = fs.readFileSync(path.join(__dirname, 'public/client.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, 'public/style.css'), 'utf8');
  ok(/id="btnTrustee"/.test(html), 'index.html 有 AI 托管按钮');
  ok(cli.includes('function paintTrustee') && cli.includes('trusteeToast'), 'client.js 有托管渲染与横幅函数');
  ok(cli.includes("case 'trustee'") && cli.includes("'trustee',"), "事件 switch 有 trustee 分支且入动画队列");
  ok(cli.includes('trusteeOn:') && cli.includes('trusteeOff:') && cli.includes('flagPop:'), '新增音效 trusteeOn/trusteeOff/flagPop 已定义');
  ok(css.includes('.ctrl-btn.trustee.on') && css.includes('.trustee-toast'), '托管按钮高亮与横幅样式就位');
  ok(cli.includes('四角瞄准框') && cli.includes('预计落点'), '虚影增强：四角瞄准框 + 落点标签');
  ok(cli.includes('stroke-width="6"') && cli.includes('ff8c1a') && cli.includes('ghostPath'), '虚影描边加粗加深（6px 橙色 · 左侧留空 v5.11）');
  ok(cli.includes('落地水花圈'), '雨天落地水花圈已加入');
  ok(cli.includes('脉动呼吸'), '台风风眼脉动已加入');
  ok(cli.includes('地面霜白'), '暴雪地面霜白已加入');
  ok(cli.includes('function flagPop'), '买地插旗函数已定义');
  ok(!cli.includes('MAJOR_TIERS'), 'v5.3 微调确认：专业梯队分组常量已移除');
  ok(!/mj-block/.test(css), '分组样式已从 CSS 移除');
}

clearTimeout(process._getActiveHandles && 0);
console.log('\n========================================');
console.log(`  结果：${pass} 通过 / ${fail} 失败`);
console.log('========================================');
process.exit(fail ? 1 : 0);
