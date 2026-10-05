'use strict';
// v4.0 机制单测：直接驱动 Room，验证五大新机制
// 1) 教育基金 3 万上限 + 溢出均分  2) 重掷骰付费重投  3) 江湾支线（岔路B）
// 4) 经济寒冬（第 15 轮停发工资）  5) 教育基金会/特权商店改名与结算
const { Room, BOARD, FUND_CAP, ENDGAME_ROUND, REROLL_COST, START_CASH, BRANCH, BRANCH2 } = require('./game');

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.error('  ✗ ' + name); } };

function mkRoom(n = 4) {
  const r = new Room('T0');
  for (let i = 0; i < n; i++) r.join('P' + i, false);
  // 固定环境变量，避免随机季节/天气/校历/技能干扰
  r.weather = 'cloud'; r.season = 'mid'; r.calEvent = null;
  for (const p of r.players) { p.skillLeft = 0; }
  r.players.forEach((p, i) => { if (i >= 2) p.cash = 300; }); // p3/p4 压低现金
  return r;
}
const cur = r => r.players[r.cur];

// ---------- 1. 教育基金上限 ----------
console.log('\n[1] 教育基金池上限 ¥30000 + 溢出均分');
{
  const r = mkRoom();
  const p0 = r.players[0];
  r.fundPool = 0;
  const cashBefore = r.players.map(p => p.cash);
  r.addToFund(32000);
  ok(r.fundPool === FUND_CAP, `池子封顶 ${FUND_CAP}（实际 ${r.fundPool}）`);
  const share = (32000 - FUND_CAP) / 4;
  ok(r.players.every((p, i) => p.cash === cashBefore[i] + share), `溢出 2000 均分每人 +¥${share}`);
  r.addToFund(500);
  ok(r.fundPool === FUND_CAP, '已达上限后再进账也保持封顶（溢出继续均分）');
}

// ---------- 2. 教育基金会（原免费停车；v5.0 续移到 28 号） ----------
console.log('\n[2] 教育基金会（28号）：走到领走全池');
{
  const r = mkRoom();
  const p0 = cur(r);
  r.fundPool = 7777;
  r.phase = 'resolving';
  p0.pos = 28;
  r.resolveCell(p0);
  ok(p0.cash === START_CASH + 7777, `领取全池 7777（现金 ${p0.cash}）`);
  ok(r.fundPool === 0, '池子清零');
  ok(BOARD[28].name === '教育基金会' && BOARD[28].type === 'parking', '28 号格是「教育基金会」（与长廊入口互换）');
}

// ---------- 3. 重掷骰 ----------
console.log('\n[3] 重掷骰：掷骰后付费重投');
{
  const r = mkRoom();
  const p0 = cur(r);
  p0.pos = 5;
  r.phase = 'roll'; r.dice = null; r.pendingReroll = null;
  r.doRoll(p0);
  if (p0.cash >= REROLL_COST) {
    ok(r.phase === 'reroll' && r.pendingReroll && r.pendingReroll.pid === p0.id, '掷骰后进入 reroll 询问');
    const cashA = p0.cash;
    const d0 = r.dice.slice();
    r.doReroll(p0);
    ok(p0.cash === cashA - REROLL_COST, `扣费 ¥${REROLL_COST}`);
    ok(r.dice[0] + r.dice[1] >= 2, `重投出新点数 ${r.dice[0]}+${r.dice[1]}`);
    ok(r.phase === 'resolving' || r.phase !== 'reroll', '重投后直接执行移动');
  } else {
    ok(r.phase === 'resolving', '现金不足时跳过询问直接走');
  }
}
{
  // confirmRoll：不重投直接走
  const r = mkRoom();
  const p0 = cur(r);
  p0.cash = 20000; p0.pos = 5;
  r.phase = 'roll';
  r.doRoll(p0);
  ok(r.phase === 'reroll', '进入重投询问');
  r.confirmRoll(p0);
  ok(r.phase === 'resolving' && !r.pendingReroll, '「就这样走」正常推进');
}

// ---------- 4. 创业大道支线 ----------
console.log('\n[4] 创业大道（36号入口 → 55~61 → 出口回39号校园商城）');
{
  const r = mkRoom();
  const p0 = cur(r);
  p0.cash = 20000; p0.pos = 36;
  r.phase = 'resolving';
  r.resolveCell(p0);
  ok(r.phase === 'branch' && r.pendingBranch && r.pendingBranch.line === 'B', '现金充足触发支线询问(line B)');
  r.enterBranch(p0);
  ok(p0.pos === BRANCH2.START, `进入支线首格 ${BRANCH2.START}（实际 ${p0.pos}）`);
}
{
  // v4.2：江湾支线无门槛——现金不足也能进
  const r = mkRoom();
  const p0 = cur(r);
  p0.cash = 500; p0.pos = 36;
  r.phase = 'resolving';
  r.resolveCell(p0);
  ok(r.phase === 'branch' && r.pendingBranch && r.pendingBranch.line === 'B', '无门槛：现金不足同样触发询问');
  r.declineBranch(p0);
  ok(r.phase !== 'branch' && !r.pendingBranch, '选择走大路正常离开');
}
{
  // v5.0 续：创业大道 55→56→…→61；61 出口领 ¥2500 但停留 2 回合，下一格沿主路线回 39 校园商城
  const r = mkRoom();
  ok(r.nextOf(55) === 56 && r.nextOf(60) === 61 && r.nextOf(61) === 39, 'nextOf 创业大道链正确');
  const p0 = cur(r);
  p0.cash = 20000; p0.pos = 61; p0.skipTurns = 0;
  r.phase = 'resolving';
  r.resolveCell(p0);
  ok(p0.pos === 61 && p0.cash === 22000, `61 号校企合作中心出口 +¥2000（现金 ${p0.cash}）`);
  ok(p0.skipTurns === 1, `61 号需停留 1 回合（skipTurns=${p0.skipTurns}）`);
  ok(BOARD[39].name === '校园商城', '39 号格是「校园商城」（61 的下一格）');
  // 学术长廊出口 54：领 1 张免租金卡 + 停留 1 回合，下一格是 28 教育基金会
  const p1 = r.players[1];
  p1.pos = 54; p1.medal = 0; p1.skipTurns = 0; r.phase = 'resolving';
  const c1 = p1.cash;
  r.resolveCell(p1);
  ok(p1.pos === 54 && p1.cash === c1 && p1.medal === 1, `54 号校史馆领 1 张免租金卡（medal=${p1.medal}，现金不变）`);
  ok(p1.skipTurns === 1, `54 号需停留 1 回合（skipTurns=${p1.skipTurns}）`);
  ok(r.nextOf(54) === 28 && BOARD[28].name === '教育基金会', '54 的下一格是 28「教育基金会」');
  // 学术长廊门槛 2 块地皮（入口在 20 号）
  ok(BRANCH.NEED === 2, `学术长廊门槛 ≥${BRANCH.NEED} 块地皮`);
  const p2 = r.players[2];
  p2.pos = 20; r.phase = 'resolving';
  r.resolveCell(p2);
  ok(r.phase !== 'branch', '0 块地皮时进不了学术长廊');
}
{
  // 创业大道四格类型结算不抛错
  const types = [55, 56, 57, 58];
  let err = null;
  for (const pos of types) {
    const r = mkRoom();
    const p0 = cur(r);
    p0.cash = 20000; p0.pos = pos;
    r.phase = 'resolving';
    try { r.resolveCell(p0); } catch (e) { err = e; }
  }
  ok(!err, '创业孵化器/跳蚤市场/校园运动会/国际交流站结算无异常' + (err ? '：' + err.message : ''));
}

// ---------- 5. 经济寒冬 ----------
console.log('\n[5] 经济寒冬：第 15 轮起停发工资');
{
  const r = mkRoom();
  ok(ENDGAME_ROUND === 15 && r.salaryOn() === true, `ENDGAME_ROUND=${ENDGAME_ROUND}，第 1 轮正常发工资`);
  r.round = 15;
  ok(r.salaryOn() === false, '第 15 轮 salaryOn=false');
  const p0 = r.players[0];
  p0.pos = 46; p0.cash = 10000;
  r.round = 15;
  r.dice = [1, 1];       // 定点：46→47→0，恰好停在起点（无卡牌干扰）
  r.execRoll(p0);
  // 等待 execRoll 的 setTimeout(0)
  setTimeout(() => {
    ok(p0.cash === 10000, `寒冬期过起点不发工资（现金 ${p0.cash}）`);
    // 对照：寒冬前过起点发工资
    const r2 = mkRoom();
    const q = r2.players[0];
    q.pos = 46; q.cash = 10000;
    r2.dice = [1, 1];
    r2.execRoll(q);
    setTimeout(() => {
      ok(q.cash === 10000 + 2000, `寒冬前过起点领 ¥2000（现金 ${q.cash}）`);
      // ---------- 6. v4.1：重投限一次 / 交通 2000 / 免罚符涨价 / 特权商店免费卡 ----------
      console.log('\n[6] v4.1：重投每回合一次 · 交通 2000 · 免罚符涨价 · 特权商店免租金卡');
      ok(BOARD.filter(c => c.type === 'transport').every(c => c.price === 2000), '全部交通格价格 2000');
      const r3 = mkRoom();
      // v5.1：免罚符分段价整体再降一档（1~8 轮 / 9~20 轮 / 21 轮起）
      const shieldAt = r => { const n = Math.max(1, r); return n <= 8 ? 200 + 45 * n : (n <= 20 ? 560 + 90 * (n - 8) : 1640 + 120 * (n - 20)); };
      ok(r3.shieldCost() === shieldAt(r3.round), `免罚符价格 = 分段价 = ¥${r3.shieldCost()}`);
      const _r8 = mkRoom(); _r8.round = 8; const _r9 = mkRoom(); _r9.round = 9; const _r25 = mkRoom(); _r25.round = 25;
      ok(_r8.shieldCost() === 560 && _r9.shieldCost() === 650 && _r25.shieldCost() === 2240,
        `免罚符分段连续：第8轮¥${_r8.shieldCost()} → 第9轮¥${_r9.shieldCost()} → 第25轮¥${_r25.shieldCost()}`);
      ok(_r8.shieldCost() < 350 + 130 * 8 && _r25.shieldCost() < 350 + 130 * 25, '分段价整体低于原线性价');
      const s0 = cur(r3);
      s0.cash = 999999; r3.phase = 'roll';
      const sc = s0.cash;
      r3.useItem(s0, 'shield');
      ok(s0.shield === true && s0.cash === sc - shieldAt(r3.round), '购入免罚符按分段价扣款');
      // 重投每回合限一次
      const r4 = mkRoom();
      const u = r4.players[0];
      u.cash = 99999; u.pos = 5; u.rerollUsed = false;
      r4.phase = 'roll'; r4.doRoll(u);
      ok(r4.phase === 'reroll', '本回合首次掷骰进入重投询问');
      r4.doReroll(u);
      ok(u.rerollUsed === true, '重投后标记 rerollUsed');
      r4.phase = 'roll'; r4.doRoll(u);
      ok(r4.phase === 'resolving', '同回合内不再询问重投');
      r4.startTurn();
      ok(r4.curp().rerollUsed === false, '新回合开始时重置');
      // 校园商城（39 号）免费领卡，不可叠加
      const r5 = mkRoom();
      const w = cur(r5);
      w.medal = 0; w.voucher = 0; w.pos = 39; w.stepBuffs = []; w.discount = false; w.shield = false; r5.phase = 'resolving';
      const wc = w.cash, ws = w.skillLeft;
      r5.resolveCell(w);
      // v5.1：校园商城改为随机抽 1~2 张效果卡（免租金卡 / 免租券 / 技能次数 +1 / 8折卡 / 加速卡 / 现金 / 免罚符）
      // v5.3：补上 discount（8折卡）与 shield（免罚符）两种不带计数的卡，消除随机抽卡造成的偶发误报
      // v5.8：卡池 9 张——voucher/shield 已移出，新增 fineFree（免罚款）/ buildCutCard（盖房9折）/ stayFree（免停留）
      // v6.0：卡池新增「万能卡」joker，判定式必须一并覆盖
      // v7.0：手动 / 响应型效果卡改为进手牌（hand），判定式一并覆盖
      const gained = w.medal > 0 || w.voucher > 0 || w.skillLeft > ws || w.stepBuffs.length > 0 || w.cash > wc || w.discount || w.shield
        || w.fineFree > 0 || w.buildCutCard > 0 || w.stayFree > 0 || (w.joker || 0) > 0
        || (w.rentX2 || 0) > 0 || (w.rentHalf || 0) > 0 || (w.insure || 0) > 0 || (w.truce || 0) > 0
        || (w.auctionVouch || 0) > 0 || (w.revive || 0) > 0 || (w.investCards || []).length > 0
        || (w.hand || []).length > 0;
      ok(gained, `踩校园商城抽到效果卡（medal=${w.medal} voucher=${w.voucher} 技能+${w.skillLeft - ws} 加速×${w.stepBuffs.length} 现金${w.cash - wc >= 0 ? '+' : ''}${w.cash - wc}）`);
      console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
      process.exit(fail ? 1 : 0);
    }, 30);
  }, 30);
}
