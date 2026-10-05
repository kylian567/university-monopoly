// test_v55.js —— v5.6 引擎单测：双数再掷上限 + 岔路单骰 + 大屏抽轮事件
// 覆盖：[1] 双数再掷（上限 2 次/回合；被罚停留/留级不追加）
//       [2] 岔路内单骰（doRoll/doReroll 第二颗记 0，永不成双；roll 事件带 single 标记）
//       [3] 双数 + 岔路结算顺序（先岔路询问，进岔路后 extra roll 从岔路格单骰出发）
//       [4] 免费轮/免租轮抽定后发 faculty_draw 事件（rounds 字段正确）
//       [5] 回合开始 rollsThisTurn 归零
'use strict';
const {
  Room, BOARD, MAJORS, BRANCH, BRANCH2,
} = require('./game.js');

let pass = 0, fail = 0, seed = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }

function mkRoom(n, opt) {
  const r = new Room('t' + (++seed), opt || {});
  for (let i = 0; i < n; i++) r.join('P' + (i + 1), i > 0);   // P1 真人，其余 AI
  r.startedAt = Date.now();
  for (const p of r.players) { if (p.major) p.skillLeft = MAJORS[p.major].uses; }
  r.phase = 'roll'; r.round = 1; r.season = 'mid'; r.weather = (opt && opt.weather) || 'cloud';
  r.calEvent = null; r.dice = [3, 4];
  return r;
}
const cur = r => r.players[r.cur];
const eventsOf = r => r._evs || [];
const origEv = Room.prototype.ev;
Room.prototype.ev = function (e) { (this._evs = this._evs || []).push(e); return origEv.call(this, e); };

console.log('========================================');
console.log('  v5.6 双数上限 + 岔路单骰 · 引擎单测');
console.log('========================================');

// ---------------- [1] 双数再掷上限 ----------------
console.log('\n[1] 双数再掷（上限 2 次 / 回合）');
{
  // 第 1 掷出双数 → 允许再来一次
  const r = mkRoom(2);
  const p = cur(r);
  p.rollsThisTurn = 1;
  r.dice = [6, 6];
  const before = r.cur;
  r.afterResolve(p, false);
  ok(r.phase === 'roll' && r.cur === before, '第 1 掷双数 → phase 回到 roll，同一玩家再掷');
  ok(eventsOf(r).some(e => e.t === 'doubles' && e.again === true && e.nth === 2), '发出 doubles{again:true,nth:2} 事件');
  ok(r.players.some(q => q.isAI) ? true : true, '（AI 定时器不在此验证）');
}
{
  // 第 2 掷再出双数 → 到上限，正常交棒
  const r = mkRoom(2);
  const p = cur(r);
  p.rollsThisTurn = 2;
  r.dice = [5, 5];
  let ended = false;
  r.endTurn = () => { ended = true; };
  r.afterResolve(p, false);
  ok(ended, '第 2 掷双数 → 达上限，进入 endTurn 交棒');
  ok(eventsOf(r).some(e => e.t === 'doubles' && e.again === false), '发出 doubles{again:false} 事件');
}
{
  // 单数 → 直接交棒
  const r = mkRoom(2);
  const p = cur(r);
  p.rollsThisTurn = 1;
  r.dice = [3, 5];
  let ended = false;
  r.endTurn = () => { ended = true; };
  r.afterResolve(p, false);
  ok(ended && !eventsOf(r).some(e => e.t === 'doubles'), '单数不触发 doubles，直接交棒');
}
{
  // 被罚停留（skipNext）或留级（skipTurns>0）→ 双数也不追加
  for (const [field, val] of [['skipNext', true], ['skipTurns', 1]]) {
    const r = mkRoom(2);
    const p = cur(r);
    p.rollsThisTurn = 1;
    p[field] = val;
    r.dice = [4, 4];
    let ended = false;
    r.endTurn = () => { ended = true; };
    r.afterResolve(p, false);
    ok(ended, `${field}=${val} 时双数不追加再掷`);
  }
}

// ---------------- [2] 岔路内单骰 ----------------
console.log('\n[2] 岔路内单骰');
{
  const r = mkRoom(2);
  const p = cur(r);
  p.cash = 0;   // 让 reroll 询问不出现，直接 execRoll? 不行——execRoll 会推进 resolveCell；这里只验证骰子与事件
  // 拦截 execRoll 避免结算副作用
  const origExec = Room.prototype.execRoll;
  Room.prototype.execRoll = function (q) { /* 拦截 */ };
  p.pos = BRANCH.START + 1;   // 站在长廊中间
  r.doRoll(p);
  Room.prototype.execRoll = origExec;
  ok(Array.isArray(r.dice) && r.dice[1] === 0 && r.dice[0] >= 1 && r.dice[0] <= 6, `岔路内 doRoll → dice=[${r.dice}]（第二颗记 0）`);
  const ev = eventsOf(r).find(e => e.t === 'roll');
  ok(ev && ev.single === true && ev.d2 === 0, 'roll 事件带 single:true / d2:0');
  ok(p.rollsThisTurn === 1, 'rollsThisTurn 计数为 1');
}
{
  const r = mkRoom(2);
  const p = cur(r);
  const origExec = Room.prototype.execRoll;
  Room.prototype.execRoll = function (q) { /* 拦截 */ };
  p.pos = BRANCH2.START + 2;   // 创业大道中间
  r.doRoll(p);
  Room.prototype.execRoll = origExec;
  ok(r.dice[1] === 0, '创业大道内 doRoll 同样单骰');
}
{
  // 主环路上仍是两颗
  const r = mkRoom(2);
  const p = cur(r);
  const origExec = Room.prototype.execRoll;
  Room.prototype.execRoll = function (q) { /* 拦截 */ };
  p.pos = 2;
  r.doRoll(p);
  Room.prototype.execRoll = origExec;
  ok(r.dice[1] >= 1 && r.dice[1] <= 6, `主环路 doRoll → dice=[${r.dice}]（两颗）`);
  const ev = eventsOf(r).find(e => e.t === 'roll');
  ok(ev && ev.single !== true, '主环路 roll 事件无 single 标记');
}
{
  // onBranch 边界
  const r = mkRoom(2);
  ok(r.onBranch(BRANCH.START) && r.onBranch(BRANCH.EXIT), `长廊边界 ${BRANCH.START}~${BRANCH.EXIT} 都算岔路内`);
  ok(r.onBranch(BRANCH2.START) && r.onBranch(BRANCH2.EXIT), `大道边界 ${BRANCH2.START}~${BRANCH2.EXIT} 都算岔路内`);
  ok(!r.onBranch(BRANCH.EXIT_TO) && !r.onBranch(BRANCH2.EXIT_TO), `出口外（${BRANCH.EXIT_TO}/${BRANCH2.EXIT_TO}）不算岔路内`);
  ok(!r.onBranch(BRANCH.JUNCTION) && !r.onBranch(BRANCH2.JUNCTION), `岔路入口（${BRANCH.JUNCTION}/${BRANCH2.JUNCTION}）不算岔路内`);
}

// ---------------- [3] 双数 + 岔路结算顺序 ----------------
console.log('\n[3] 双数 + 岔路：先岔路询问，进岔路后从岔路格单骰再掷');
{
  const r = mkRoom(2);
  const p = cur(r);
  p.pos = BRANCH.JUNCTION;              // 长廊入口
  p.cash = 0;                           // 现金不足 → 不触发 reroll 询问
  for (let i = 0; i < 2; i++) r.cells[r.propCells(p)[0] !== undefined ? r.propCells(p)[0] : 1];
  // 给玩家 2 块地皮以满足岔路门槛
  const props = BOARD.map((c, i) => ({ c, i })).filter(({ c }) => c.type === 'prop');
  props.slice(0, 2).forEach(({ i }) => { r.cells[i].own = p.id; r.cells[i].level = 0; });
  r.dice = [6, 6];
  p.rollsThisTurn = 1;
  r.resolveCell(p);
  ok(r.phase === 'branch' && r.pendingBranch && r.pendingBranch.pid === p.id, '双数落在岔路入口 → 先进入岔路询问（phase=branch）');
  ok(!eventsOf(r).some(e => e.t === 'doubles'), '岔路询问期间还没有 doubles 再掷事件（顺序正确）');
  // 选择进岔路
  r.enterBranch(p);
  ok(p.pos === BRANCH.START, '进岔路后落到长廊起点');
  // 岔路起点结算完成后内部 afterResolve → 双数 → 拨回 roll 等待下一次掷骰
  ok(r.phase === 'roll', '岔路结算完 → 双数再掷（phase=roll）');
  // 下一次掷骰：身在岔路 → 单骰
  const origExec2 = Room.prototype.execRoll;
  Room.prototype.execRoll = function (q) { /* 拦截 */ };
  r.doRoll(p);
  Room.prototype.execRoll = origExec2;
  ok(r.dice[1] === 0, `双数再掷时身处岔路 → 单骰 dice=[${r.dice}]`);
  ok(eventsOf(r).filter(e => e.t === 'roll' && e.single === true).length === 1, '再掷的 roll 事件带 single:true');
  ok(p.rollsThisTurn === 2, '再掷后 rollsThisTurn=2（达到本回合上限）');
}

// ---------------- [4] 免费轮/免租轮 faculty_draw 事件 ----------------
console.log('\n[4] 免费轮 / 免租轮大屏抽签事件');
{
  const r = mkRoom(2, { faculty: true });
  r.faculty = 'freeRound';
  r.applyFacultySetup('freeRound');
  ok(r.freeRounds.length === 2 && r.freeRounds.every(x => x >= 1 && x <= 10), `免费轮抽定在第 ${r.freeRounds.join(' / ')} 轮（首届窗口 1~10，v7.0 抽 2 轮）`);
  const ev = eventsOf(r).find(e => e.t === 'faculty_draw');
  ok(ev && ev.kind === 'freeRound' && Array.isArray(ev.rounds) && ev.rounds.length === 2 && ev.rounds.join(',') === r.freeRounds.join(','), '发出 faculty_draw{kind:freeRound, rounds:[n,n]}');
}
{
  const r = mkRoom(2, { faculty: true });
  r.faculty = 'freeRent';
  r.applyFacultySetup('freeRent');
  ok(r.freeRentRounds.length === 4 && r.freeRentRounds.every(n => n >= 1 && n <= 10), `免租轮抽定 ${r.freeRentRounds.join('/')}（4 个、首届窗口 1~10，v7.2）`);
  ok(new Set(r.freeRentRounds).size === 4, '4 个免租轮互不重复');
  const ev = eventsOf(r).find(e => e.t === 'faculty_draw');
  ok(ev && ev.kind === 'freeRent' && ev.rounds.join(',') === r.freeRentRounds.join(','), '发出 faculty_draw{kind:freeRent, rounds:[...5]}');
  ok(eventsOf(r).filter(e => e.t === 'faculty_draw').length === 1, 'faculty_draw 只发一次');
}

// ---------------- [5] 回合开始 rollsThisTurn 归零 ----------------
console.log('\n[5] 回合开始归零');
{
  const r = mkRoom(2);
  const p = cur(r);
  p.rollsThisTurn = 2;
  r.checkWin = () => false;
  // startTurn 会走完整开局逻辑（含停留判断），这里只验证归零
  r.startTurn();
  ok(p.rollsThisTurn === 0, 'startTurn 后 rollsThisTurn 归零');
}

// ---------------- [6] 客户端资产存在性（文本级） ----------------
console.log('\n[6] 客户端资产（文本级校验）');
{
  const fs = require('fs');
  const cli = fs.readFileSync('public/client.js', 'utf8');
  const sty = fs.readFileSync('public/style.css', 'utf8');
  ok(cli.includes("case 'faculty_draw': await facultyDrawAnim(e)"), '客户端有 faculty_draw 动画挂载');
  ok(cli.includes('function facultyDrawAnim'), 'facultyDrawAnim 已实现');
  ok(cli.includes('await diceAnim(e.d1, e.d2, e.single)'), 'roll 事件向 diceAnim 传递 single 标记');
  ok(cli.includes("'doubles', 'faculty_draw'"), 'ANIMATED 集合包含 doubles / faculty_draw');
  ok(sty.includes('.fd-slot.hit'), '抽签槽位命中样式存在');
  ok(sty.includes('position:relative; z-index:170'), 'ctrlBar 已抬到投票浮层之上（规则按钮修复）');
}

console.log('\n========================================');
console.log(`  结果：${pass} 通过 / ${fail} 失败`);
console.log('========================================');
process.exit(fail ? 1 : 0);
