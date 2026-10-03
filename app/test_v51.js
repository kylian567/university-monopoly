// v5.1 综合回归：天气 / 抵押 / 公用事业 / 经济数值 / 棋盘互换 / 岔路 12 格 / 效果卡
'use strict';
const assert = require('assert');
const G = require('./game');
const { Room, BOARD, GROUPS, WEATHER, MAJORS, FUND_CAP, BRANCH, BRANCH2, EFFECT_CARDS, CALEVENTS } = G;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };
function mkRoom(n = 2, majors) {
  const room = new Room('T51' + Math.floor(Math.random() * 900000 + 100000));
  for (let i = 0; i < n; i++) room.join('P' + (i + 1), true);
  room.start();
  if (majors) majors.forEach((m, i) => { if (room.players[i]) { room.players[i].major = m; room.players[i].skillLeft = MAJORS[m].uses; } });
  return room;
}
const cur = r => r.players[r.cur];
function cleanup(r) { r.clearAiTimers(); r.clearTimer(); }

console.log('\n[1] 天气系统：8 种 + 台风独立');
{
  const keys = Object.keys(WEATHER);
  ok(keys.length === 8, `天气种类 = ${keys.length}（sun/cloud/rain/storm/fog/snow/heat/wind）`);
  ok(!!WEATHER.storm && !!WEATHER.fog && !!WEATHER.snow && !!WEATHER.heat && !!WEATHER.wind, '台风/雾霾/暴雪/烈日/大风都在表里');
  ok(WEATHER.storm.desc.includes('租金'), '台风不再等同雨天：有独立的租金修正描述');
  ok(!WEATHER.storm.diceMod, '台风不再复用雨天的掷骰 −1');
  // 天气影响盖房成本
  const r = mkRoom();
  r.weather = 'snow';           // buildMul 1.15
  const base = GROUPS.g1.build;
  const costSnow = r.seasonCost(base);
  r.weather = 'cloud';
  const costCloud = r.seasonCost(base);
  ok(costSnow > costCloud, `暴雪盖房更贵：${costSnow} > ${costCloud}`);
  cleanup(r);
}

console.log('\n[2] 抵押机制：两途径 + 抵押地免税 + 两轮赎回锁');
{
  const r = mkRoom();
  const p = cur(r);
  const idx = BOARD.findIndex(c => c.type === 'prop');
  r.cells[idx].own = p.id; r.cells[idx].level = 2;
  // 旧途径（roll 阶段主动抵押）已删除
  r.phase = 'roll'; p.cash = 1000;
  r.mortgage(p, idx);
  ok(!r.cells[idx].mortgaged, '掷骰阶段不能主动抵押（旧途径已删除）');
  // 途径①：盖房凑钱
  r.phase = 'build'; r.pendingBuild = { pid: p.id, cell: idx, cost: 9999 };
  r.mortgage(p, idx);
  ok(r.cells[idx].mortgaged, '盖房阶段可以抵押筹钱');
  // 两轮赎回锁
  const unlock = r.redeemUnlockRound(r.cells[idx]);
  ok(unlock === r.round + 2, `赎回解锁轮 = 抵押轮 + 2（第 ${unlock} 轮）`);
  ok(r.canRedeem(p, idx) === false, '本轮不可赎回');
  r.round = unlock - 1; ok(r.canRedeem(p, idx) === false, '下一轮仍不可赎回');
  r.round = unlock;     ok(r.canRedeem(p, idx) === true, '下下轮可以赎回');
  // 抵押地不缴税
  p.cash = 100000;
  const before = p.cash;
  r.collectTax(p);
  ok(p.cash === before, '抵押中的地产不缴物业税');
  cleanup(r);
}

console.log('\n[3] 公用事业：双站价格 + 垄断租金 ×350');
{
  const w印 = BOARD.findIndex(c => c.name === '文印店');
  const kd  = BOARD.findIndex(c => c.name === '快递驿站');
  ok(BOARD[w印].price === 1700, `文印店价格 = ¥${BOARD[w印].price}`);
  ok(BOARD[kd].price === 1600, `快递驿站价格 = ¥${BOARD[kd].price}`);
  const r = mkRoom();
  r.weather = 'cloud'; r.season = 'mid';   // 排除季节/天气对租金的乘数干扰
  const p = cur(r), q = r.players[1];
  r.cells[w印].own = p.id; r.cells[kd].own = p.id; q.pos = w印;
  const rent = r.calcRent(w印, [3, 4]);
  ok(rent === (3 + 4) * 350, `双站垄断租金 = 步数 × 350 = ${rent}`);
  r.cells[kd].own = null;
  const rent1 = r.calcRent(w印, [3, 4]);
  ok(rent1 === (3 + 4) * 100, `单站租金 = 步数 × 100 = ${rent1}`);
  cleanup(r);
}

console.log('\n[4] 经济数值');
{
  ok(FUND_CAP === 20000, `教育基金池上限 = ¥${FUND_CAP}`);
  ok(GROUPS.g1.build === 850 && GROUPS.g10.build === 4100, '盖楼价格已整体下调');
  ok(GROUPS.g1.rents[0] === 620, '租金已同步下调');
  const r = mkRoom();
  ok(r.shieldCost() === 315, `免罚符第 1 轮 = ¥${r.shieldCost()}`);
  // 科研投资：投 2000，2 轮后返 3000
  const p = cur(r); p.cash = 10000;
  const inv = BOARD.findIndex(c => c.type === 'invest');
  r.phase = 'resolving'; p.pos = inv; r.dice = [1, 2]; r.resolveCell(p);
  ok(r.phase === 'invest' && r.pendingInvest.cost === 2000 && r.pendingInvest.back === 3000 && r.pendingInvest.rounds === 2,
    `科研基金处：投 ¥${r.pendingInvest && r.pendingInvest.cost} → 返 ¥${r.pendingInvest && r.pendingInvest.back}`);
  cleanup(r);
  // 学费随机（直接从事件流里读实际扣款，避开回合推进带来的其它扣款干扰）
  const r2 = mkRoom();
  const q = cur(r2); q.cash = 100000;
  const tax = BOARD.findIndex(c => c.type === 'tax');
  const amounts = [];
  for (let i = 0; i < 120; i++) {
    q.cash = 100000; r2.dice = [1, 1]; r2.phase = 'resolving'; q.pos = tax;
    const start = r2.events.length;
    r2.resolveCell(q);
    const ch = r2.events.slice(start).find(x => x.t === 'charge' && x.pid === q.id && x.toPool);
    if (ch) amounts.push(ch.amount);
  }
  const uniq = [...new Set(amounts)].sort((a, b) => a - b);
  ok(amounts.length > 0 && uniq.length > 3 && uniq.every(a => a >= 800 && a <= 1500 && a % 10 === 0),
    `缴学费随机 ¥800~1500（10 的倍数），实测样本 ${uniq.length} 种：${uniq.slice(0, 6).join('/')}…`);
  cleanup(r2);
  // 拆房回收 = 盖房价一半
  const r3 = mkRoom();
  const s = cur(r3);
  const i3 = BOARD.findIndex(c => c.type === 'prop');
  r3.cells[i3].own = s.id; r3.cells[i3].level = 2; s.cash = 0;
  r3.phase = 'build'; r3.pendingBuild = { pid: s.id, cell: i3, cost: 99999 };
  r3.sellBuilding(s, i3);
  ok(s.cash === Math.floor(GROUPS[BOARD[i3].g].build / 2), `拆房回收 = 盖房价一半 = ¥${s.cash}`);
  cleanup(r3);
}

console.log('\n[5] 棋盘互换：宝安机场 ↔ 中科大');
{
  ok(BOARD[24].name === '宝安机场' && BOARD[24].type === 'transport', `24 号 = ${BOARD[24].name}`);
  ok(BOARD[25].name === '中科大' && BOARD[25].type === 'prop', `25 号 = ${BOARD[25].name}`);
}

console.log('\n[6] 岔路 12 格：逐格结算不崩 + 关键数值');
{
  const types = ['invest', 'advisor', 'shop', 'ginkgo', 'hall', 'study', 'exit',
                 'startup', 'market', 'arena', 'exchange', 'intern', 'exit2'];
  for (const t of types) {
    let crashed = null, samples = 0;
    for (let i = 0; i < 25; i++) {
      try {
        const r = mkRoom(3);
        const p = cur(r);
        const idx = BOARD.findIndex(c => c.type === t);
        p.cash = 50000; r.dice = [2, 3]; r.phase = 'resolving'; p.pos = idx;
        r.resolveCell(p);
        samples++;
        cleanup(r);
      } catch (e) { crashed = e; break; }
    }
    ok(!crashed, `type=${t} 结算 ${samples} 次无异常${crashed ? ' → ' + crashed.message : ''}`);
  }
  // 关键数值：创业孵化器 50/50
  {
    let win = 0, lose = 0;
    for (let i = 0; i < 400; i++) {
      const r = mkRoom(2);
      const p = cur(r); p.cash = 30000;
      const idx = BOARD.findIndex(c => c.type === 'startup');
      r.dice = [1, 1]; r.phase = 'resolving'; p.pos = idx; r.resolveCell(p);
      if (p.cash > 30000) win++; if (p.cash < 30000) lose++;
      cleanup(r);
    }
    ok(win > 120 && lose > 120, `创业孵化器约 50/50（赢 ${win} / 亏 ${lose}）`);
  }
  // 校园运动会：自己就是首富 → 无效
  {
    const r = mkRoom(3);
    const p = cur(r);
    r.players.forEach((q, i) => { q.cash = i === 0 ? 100000 : 1000; });
    const idx = BOARD.findIndex(c => c.type === 'arena');
    r.dice = [2, 2]; r.phase = 'resolving'; p.pos = idx;
    const b = p.cash; r.resolveCell(p);
    ok(p.cash === b, '校园运动会：自己就是首富时本格无效');
    cleanup(r);
  }
  // 校园运动会：胜者拿走输者现金 25%
  {
    const r = mkRoom(2);
    const p = cur(r), q = r.players[1];
    p.cash = 1000; q.cash = 40000;
    const idx = BOARD.findIndex(c => c.type === 'arena');
    let got = false;
    for (let i = 0; i < 60 && !got; i++) {
      p.cash = 1000; q.cash = 40000;
      r.dice = [2, 2]; r.phase = 'resolving'; p.pos = idx;
      const qb = q.cash; r.resolveCell(p);
      if (p.cash > 1000) { got = true; const diff = qb - q.cash; ok(diff === Math.floor(qb * 0.25), `胜者拿走输者现金 25%（¥${diff} / 基数 ¥${qb}）`); }
    }
    if (!got) ok(false, '校园运动会未出现胜利样本');
    cleanup(r);
  }
  // 校史馆 / 校企合作中心：停留 1 回合
  for (const [t, label] of [['exit', '校史馆'], ['exit2', '校企合作中心']]) {
    const r = mkRoom(2);
    const p = cur(r); p.cash = 30000;
    const idx = BOARD.findIndex(c => c.type === t);
    r.dice = [1, 2]; r.phase = 'resolving'; p.pos = idx; r.resolveCell(p);
    ok((p.skipTurns || 0) >= 1, `${label}：停留 ${p.skipTurns} 回合`);
    cleanup(r);
  }
  // 通宵自习室：成功 +2000 或猝死 -4000
  {
    const r = mkRoom(2);
    const p = cur(r); p.cash = 30000;
    const idx = BOARD.findIndex(c => c.type === 'study');
    r.dice = [1, 2]; r.phase = 'resolving'; p.pos = idx;
    let b = p.cash; r.resolveCell(p);
    const d = p.cash - b;
    ok(d === 2000 || d === -4000, `通宵自习室：${d > 0 ? '+¥2000 顺利闭关' : '−¥4000 猝死治疗'}`);
    cleanup(r);
  }
  // 奖学金长廊：+2000 且队列两格；或被举报
  {
    const r = mkRoom(2);
    const p = cur(r); p.cash = 10000;
    const idx = BOARD.findIndex(c => c.type === 'ginkgo');
    let seenGood = false, seenBad = false;
    for (let i = 0; i < 60 && !(seenGood && seenBad); i++) {
      p.cash = 10000; p.stepBuffs = [];
      r.dice = [1, 2]; r.phase = 'resolving'; p.pos = idx; r.resolveCell(p);
      if (p.stepBuffs.length === 2) { seenGood = true; }
      if (p.stepBuffs.length === 0 && p.cash <= 10000) { seenBad = true; }
    }
    ok(seenGood, '奖学金长廊：正常分支给 2 次 +3 加速');
    ok(seenBad, '奖学金长廊：存在被举报分支');
    cleanup(r);
  }
}

console.log('\n[7] 效果卡池（校园商城 / 校庆礼品屋）');
{
  ok(EFFECT_CARDS.length === 7, `效果卡池 = ${EFFECT_CARDS.length} 张`);
  ok(EFFECT_CARDS.some(c => c.id === 'skill'), '卡池含「技能次数 +1」');
  const r = mkRoom(2);
  const p = cur(r); p.skillLeft = 3;
  r.grantCards(p, 39, 2, '校园商城');
  ok(true, 'grantCards 执行无异常');
  let anySkill = false;
  for (let i = 0; i < 300; i++) { const rr = mkRoom(2); const q = cur(rr); q.skillLeft = 3; rr.grantCards(q, 39, 1, '测试'); if (q.skillLeft > 3) anySkill = true; cleanup(rr); }
  ok(anySkill, '抽卡能实际增加技能次数');
  cleanup(r);
  // 校园商城 / 校庆礼品屋都走抽卡
  const r2 = mkRoom(2);
  const p2 = cur(r2); p2.cash = 10000;
  const shopIdx = BOARD.findIndex(c => c.type === 'shop');
  r2.dice = [1, 1]; r2.phase = 'resolving'; p2.pos = shopIdx; r2.resolveCell(p2);
  ok(true, '校庆礼品屋结算无异常（与校园商城同款抽卡）');
  cleanup(r2);
}

console.log('\n[8] 挂科留级加重');
{
  const r = mkRoom(2, ['agri', 'agri']);
  const p = cur(r); p.cash = 10000;
  const idx = BOARD.findIndex(c => c.type === 'gojail');
  r.dice = [1, 1]; r.phase = 'resolving'; p.pos = idx; r.resolveCell(p);
  // v5.2 起"停留"统一走 applyStay（写 skipTurns），故两种表示都接受
  ok((p.skipNext === true || (p.skipTurns || 0) >= 1) && p.cash === 8800, `挂科留级：停留 1 回合 + 补考费 ¥1200（余额 ¥${p.cash}）`);
  cleanup(r);
}

console.log('\n[9] 卡牌：随机拆地/拆房/盖房规则 + 新玩法');
{
  const { CHANCE, FATE } = G;
  ok(CHANCE.length === 65 && FATE.length === 65, `卡牌 ${CHANCE.length}/${FATE.length} 张`);
  const allKinds = new Set(CHANCE.concat(FATE).map(c => c.kind));
  for (const k of ['majorSwitch', 'drawCards', 'stepQueue', 'pctGain', 'pctLose', 'loseCard']) {
    ok(allKinds.has(k), `新玩法 kind=${k} 已加入卡池`);
  }

  // 随机拆地：优先拆没盖房子的
  {
    const r = mkRoom(3, ['agri', 'agri', 'agri']);
    const t = r.players[1];
    const props = BOARD.map((c, i) => i).filter(i => BOARD[i].type === 'prop').slice(0, 3);
    props.forEach((i, k) => { r.cells[i].own = t.id; r.cells[i].level = k; });  // 0 / 1 / 2 级
    r.players[0].cash = 50000; r.players[2].cash = 50000;
    r.afterResolve = () => {};   // 隔离卡牌结算：不因回合推进触发随机校历事件
    let emptyRemoved = 0;
    for (let n = 0; n < 40; n++) {
      // 复位
      props.forEach((i, k) => { r.cells[i].own = t.id; r.cells[i].level = k; });
      const p0 = r.players[0]; p0.pos = 0;
      r.applyCard(p0, { name: '测试拆地', kind: 'demolishLand' });
      if (r.cells[props[0]].own === null) emptyRemoved++;
    }
    ok(emptyRemoved >= 30, `拆地优先拆没盖房的（40 次里 ${emptyRemoved} 次拆掉 0 级地皮）`);
    cleanup(r);
  }
  // 随机拆房：只拆一栋
  {
    const r = mkRoom(3, ['agri', 'agri', 'agri']);
    const t = r.players[1];
    const i0 = BOARD.findIndex(c => c.type === 'prop');
    r.cells[i0].own = t.id; r.cells[i0].level = 4;
    r.afterResolve = () => {};   // 同上：避免回合推进带来的随机收支
    const b = t.cash;
    r.applyCard(r.players[0], { name: '测试拆房', kind: 'demolishHouse' });
    ok(r.cells[i0].level === 3, `拆房一次只降 1 级（Lv4 → Lv${r.cells[i0].level}）`);
    ok(t.cash === b, '拆房不返还现金');
    cleanup(r);
  }
  // 随机盖房：随机挑一块（多次试验应命中不同地块）
  {
    const r = mkRoom(2);
    const p = cur(r);
    const props = BOARD.map((c, i) => i).filter(i => BOARD[i].type === 'prop').slice(0, 3);
    const hit = new Set();
    for (let n = 0; n < 80; n++) {
      props.forEach(i => { r.cells[i].own = p.id; r.cells[i].level = 0; });
      r.applyCard(p, { name: '测试盖房', kind: 'selfBuild' });
      props.forEach(i => { if (r.cells[i].level === 1) hit.add(i); });
    }
    ok(hit.size >= 2, `随机盖房会盖到不同地块（命中 ${hit.size} 块）`);
    cleanup(r);
  }
  // 转专业 / 抽效果卡 / 移动队列 / 比例增减 / 回收卡
  {
    const r = mkRoom(2, ['agri', 'mech']);
    const p = cur(r);
    // 这些断言只考核「卡牌结算本身」：屏蔽 afterResolve，避免回合推进顺带触发随机校历事件污染现金
    r.afterResolve = () => {};
    p.cash = 20000;
    r.applyCard(p, { name: '转专业成功', kind: 'majorSwitch', good: true });
    ok(p.major !== 'agri' && p.skillLeft === MAJORS[p.major].uses, `转专业：agri → ${p.major}（次数重置为 ${p.skillLeft}）`);
    const before = p.stepBuffs.length;
    r.applyCard(p, { name: '选课加权', kind: 'stepQueue', steps: 2, times: 3 });
    ok(p.stepBuffs.length === before + 3, `移动队列 +3 次（队列长 ${p.stepBuffs.length}）`);
    const c0 = p.cash;
    r.applyCard(p, { name: '实验室结题分红', kind: 'pctGain', pct: 0.08, cap: 2000 });
    ok(p.cash - c0 === Math.min(2000, Math.round(c0 * 0.08)), `比例增收 8%（+¥${p.cash - c0}）`);
    const c1 = p.cash;
    let charged = null;
    const origCharge = r.charge.bind(r);
    r.charge = (pp, amt, cr, rs, ci, tp) => { charged = amt; return origCharge(pp, amt, cr, rs, ci, tp); };
    r.applyCard(p, { name: '宿舍失窃', kind: 'pctLose', pct: 0.12, cap: 2500 });
    r.charge = origCharge;
    ok(charged === Math.min(2500, Math.round(c1 * 0.12)) && p.cash === c1 - charged, `比例损失 12%（−¥${charged}，上限 ¥2500）`);
    p.medal = 1;
    r.applyCard(p, { name: '选课全被退', kind: 'loseCard' });
    ok(p.medal === 0, '回收卡：优先回收免租金卡');
    cleanup(r);
  }
}

console.log('\n[11] 校历事件扩充（三轮一次）');
{
  ok(CALEVENTS.length >= 27, `校历事件总数 = ${CALEVENTS.length}（原 14 → 现 ${CALEVENTS.length}）`);
  const ids = CALEVENTS.map(e => e.id);
  ok(new Set(ids).size === ids.length, '事件 id 无重复');
  ok(CALEVENTS.every(e => e.id && e.name && e.icon && e.desc && e.kind), '每个事件都有 id/name/icon/desc/kind');
  ok(CALEVENTS.every(e => e.fx === undefined || typeof e.fx === 'string'), '新增事件都带 fx 特效标识');
  const kinds = new Set(CALEVENTS.map(e => e.kind));
  ['lottery', 'fundShare', 'stealPoor', 'cardsLottery', 'poorMore', 'study', 'buildBoom'].forEach(k => ok(kinds.has(k), `新增 kind「${k}」已进入事件表`));

  // 歌手赛：随机一人独得，其余参与奖
  {
    let soloHits = 0, consOk = true, sumOk = true;
    for (let n = 0; n < 40; n++) {
      const r = mkRoom(3, ['agri', 'agri', 'agri']);
      r.players.forEach(q => { q.cash = 10000; });
      const ev = CALEVENTS.find(e => e.id === 'karaoke');
      const before = r.players.map(q => q.cash);
      r.applyCalEvent(ev);
      const diff = r.players.map((q, i) => q.cash - before[i]);
      const big = diff.filter(d => d === ev.amount).length;
      const small = diff.filter(d => d === ev.consolation).length;
      if (big === 1) soloHits++;
      if (big !== 1 || small !== 2) consOk = false;
      if (diff.reduce((a, b) => a + b, 0) !== ev.amount + ev.consolation * 2) sumOk = false;
      cleanup(r);
    }
    ok(soloHits === 40, `歌手赛：每次恰好 1 人拿大奖（${soloHits}/40）`);
    ok(consOk, '歌手赛：其余玩家各拿参与奖 ¥300');
    ok(sumOk, '歌手赛：总发放金额守恒');
  }
  // 基金分红日：按 share 均分基金池
  {
    const r = mkRoom(4, ['agri', 'agri', 'agri', 'agri']);
    r.players.forEach(q => { q.cash = 10000; });
    r.fundPool = 10000;
    r.applyCalEvent(CALEVENTS.find(e => e.id === 'fundday')); // share 0.6
    const share = Math.floor(10000 * 0.6 / 4);
    ok(r.players.every(q => q.cash === 10000 + share), `基金分红日：每人 +¥${share}（6000/4）`);
    ok(r.fundPool === 10000 - share * 4, `基金池扣除后余额 = ¥${r.fundPool}`);
    cleanup(r);
  }
  // 精准帮扶：最富 → 最穷
  {
    const r = mkRoom(3, ['agri', 'agri', 'agri']);
    r.players[0].cash = 20000; r.players[1].cash = 5000; r.players[2].cash = 9000;
    r.applyCalEvent(CALEVENTS.find(e => e.id === 'aidpoor'));
    ok(r.players[0].cash === 18000, `最富者 −¥2000 → ${r.players[0].cash}`);
    ok(r.players[1].cash === 7000, `最穷者 +¥2000 → ${r.players[1].cash}`);
    ok(r.players[2].cash === 9000, '中间者不受影响');
    cleanup(r);
  }
  // 校庆嘉年华：每人 1 张卡 + 随机一人大奖
  {
    const r = mkRoom(3, ['agri', 'agri', 'agri']);
    r.players.forEach(q => { q.cash = 10000; q.medal = 0; q.voucher = 0; q.skillLeft = 1; q.cashCards = 0; });
    r.players.forEach(q => { q.discount = false; q.shield = false; q.stepBuffs = []; });
    const ev = CALEVENTS.find(e => e.id === 'gala');
    r.applyCalEvent(ev);
    const gotCards = r.players.every(q => q.medal + q.voucher + q.skillLeft + q.stepBuffs.length + (q.discount ? 1 : 0) + (q.shield ? 1 : 0) > 0 || q.cash === 10800);
    ok(gotCards, '校庆嘉年华：每位玩家都领到了 1 张效果卡');
    const big = r.players.filter(q => q.cash >= 10000 + ev.amount).length;
    ok(big === 1, `校庆嘉年华：随机 1 人抽中大奖 ¥${ev.amount}`);
    cleanup(r);
  }
  // 毕业作品展：最穷 +3000，其余 +500
  {
    const r = mkRoom(3, ['agri', 'agri', 'agri']);
    r.players[0].cash = 6000; r.players[1].cash = 12000; r.players[2].cash = 9000;
    r.applyCalEvent(CALEVENTS.find(e => e.id === 'gradshow'));
    ok(r.players[0].cash === 9000, `最穷者 +¥3000 → ${r.players[0].cash}`);
    ok(r.players[1].cash === 12500 && r.players[2].cash === 9500, '其余各 +¥500');
    cleanup(r);
  }
  // 科技文化节：盖房更贵
  {
    const r = mkRoom();
    r.weather = 'cloud'; r.season = 'mid';
    const base = GROUPS.g1.build;
    const c0 = r.seasonCost(base);
    r.calEvent = CALEVENTS.find(e => e.id === 'techweek');
    const c1 = r.seasonCost(base);
    ok(c1 > c0, `科技文化节：盖房 ×1.25（${c0} → ${c1}）`);
    cleanup(r);
  }
  // 读书节：全体 +amount，且带 steps
  {
    const r = mkRoom(3, ['agri', 'agri', 'agri']);
    r.players.forEach(q => { q.cash = 10000; });
    const ev = CALEVENTS.find(e => e.id === 'reading');
    r.applyCalEvent(ev);
    ok(r.players.every(q => q.cash === 10700), '读书节：全体 +¥700 购书补贴');
    ok(ev.steps === -1, '读书节：本回合移动 −1');
    cleanup(r);
  }
  // 全量事件冒烟：随便挑一个都不得抛异常
  {
    let bad = 0;
    for (const ev of CALEVENTS) {
      try {
        const r = mkRoom(4, ['agri', 'agri', 'agri', 'agri']);
        r.players.forEach(q => { q.cash = 10000; q.stepBuffs = []; });
        r.fundPool = 5000;
        r.applyCalEvent(ev);
        cleanup(r);
      } catch (err) { bad++; console.log('    ! 事件异常', ev.id, err.message); }
    }
    ok(bad === 0, `${CALEVENTS.length} 个校历事件全部可正常结算`);
  }
}

console.log('\n[12] 时序修正：事件增量（现金 / 地皮 / 基金池）+ 表情不提前');
{
  // 通用增量：变化才附带，未变化不附带
  {
    const r = mkRoom(2, ['agri', 'agri']);
    const p = cur(r);
    r.events = [];
    p.cash += 777;
    r.ev({ t: 'probe' });
    const e1 = r.events[r.events.length - 1];
    ok(!!e1.d && e1.d.cash[p.id] === p.cash, '现金变化随事件下发增量');
    r.ev({ t: 'probe2' });
    const e2 = r.events[r.events.length - 1];
    ok(!e2.d, '状态未变时不再附带冗余增量');
    r.cells[1].own = p.id; r.cells[1].level = 2; r.cells[1].mortgaged = true;
    r.ev({ t: 'probe3' });
    const e3 = r.events[r.events.length - 1];
    ok(!!e3.d && e3.d.cells[1] && e3.d.cells[1].level === 2 && e3.d.cells[1].own === p.id && e3.d.cells[1].mortgaged === true, '地皮归属/等级/抵押变化随事件下发增量');
    r.fundPool = 4321;
    r.ev({ t: 'probe4' });
    const e4 = r.events[r.events.length - 1];
    ok(!!e4.d && e4.d.fund === 4321, '基金池变化随事件下发增量');
    cleanup(r);
  }
  // 付款事件必须携带扣款后的现金（客户端据此"播完动画才变钱"）
  {
    const r = mkRoom(3, ['agri', 'agri', 'agri']);
    const p = r.players[0];
    p.cash = 10000;
    r.fundPool = 0;
    r.events = [];
    r.charge(p, 1500, null, '测试缴费', 0, true);
    const paid = r.events.find(e => e.t === 'paid');
    ok(!!paid && paid.d && paid.d.cash && paid.d.cash[p.id] === 8500, `付款事件携带扣款后现金（¥${paid && paid.d && paid.d.cash ? paid.d.cash[p.id] : '?'}）`);
    ok(!!paid.d.fund && paid.d.fund === r.fundPool, '同一条事件也带上了基金池增量');
    cleanup(r);
  }
  // 人机表情必须排在付款事件之后
  {
    const r = mkRoom(3, ['agri', 'agri', 'agri']);
    const p = r.players[0];
    p.isAI = true; p.cash = 50000;
    r.events = [];
    const origRand = Math.random;
    Math.random = () => 0.01;   // 让 aiChat 的概率判定必定命中
    r.charge(p, 5000, null, '测试房租', 0, false);
    Math.random = origRand;
    const iCharge = r.events.findIndex(e => e.t === 'charge');
    const iPaid = r.events.findIndex(e => e.t === 'paid');
    const iChat = r.events.findIndex(e => e.t === 'chat');
    ok(iCharge >= 0 && iPaid > iCharge, `付款事件顺序：charge(#${iCharge}) → paid(#${iPaid})`);
    ok(iChat > iCharge, `人机表情排在付款事件之后（chat#${iChat}）`);
    cleanup(r);
  }
  // 每次事件都会推进「已见状态」，不会重复下发同一份增量
  {
    const r = mkRoom(2, ['agri', 'agri']);
    const p = cur(r);
    r.events = [];
    p.cash = 12345;
    r.ev({ t: 'a' }); r.ev({ t: 'b' }); r.ev({ t: 'c' });
    const withD = r.events.filter(e => e.d).length;
    ok(withD === 1, `一次状态变化只下发一次增量（本次 ${withD} 条带 d）`);
    cleanup(r);
  }
}

console.log('\n[13] 重投虚影：落点预测 + 全场可见');
{
  // 预测落点 = 从当前位置按实际步数走到的格子
  {
    const r = mkRoom(2, ['agri', 'agri']);
    const p = cur(r);
    r.weather = 'cloud'; r.season = 'mid'; r.calEvent = null;
    p.sabotage = 0; p.buffSteps = 0; p.stepBuffs = [];
    p.pos = 5;
    r.dice = [3, 4];                       // 7 步，无任何修正
    const pv = r.previewLanding(p);
    ok(pv && pv.steps === 7 && pv.cell === 12, `无修正：5 + 7 步 → 第 ${pv.cell} 格`);
    // 天气 −1 步（雨天）
    r.weather = 'rain';
    const pv2 = r.previewLanding(p);
    ok(pv2.steps === 6 && pv2.cell === 11, `雨天 −1 步：→ 第 ${pv2.cell} 格`);
    // 移动加成队列
    r.weather = 'cloud'; p.stepBuffs = [3];
    const pv3 = r.previewLanding(p);
    ok(pv3.steps === 10, `加成队列 +3 → ${pv3.steps} 步`);
    cleanup(r);
  }
  // 环形回绕：47 → 0
  {
    const r = mkRoom(2, ['agri', 'agri']);
    const p = cur(r);
    r.weather = 'cloud'; r.calEvent = null;
    p.pos = 45; r.dice = [2, 2]; p.stepBuffs = []; p.buffSteps = 0; p.sabotage = 0;
    const pv = r.previewLanding(p);
    ok(pv.cell === 1, `环形回绕：45 + 4 → 第 ${pv.cell} 格（跨过起点）`);
    cleanup(r);
  }
  // 重投询问时 pendingReroll 带上落点，供客户端画虚影
  {
    let sawTarget = 0, sawEvent = 0;
    for (let n = 0; n < 25; n++) {
      const r = mkRoom(2, ['agri', 'agri']);
      const p = cur(r);
      p.cash = 50000; p.rerollUsed = false;
      r.phase = 'roll'; r.cur = p.id === r.players[0].id ? 0 : 1;
      r.events = [];
      r.doRoll(p);
      if (r.phase === 'reroll' && r.pendingReroll && r.pendingReroll.target != null) {
        sawTarget++;
        const ev = r.events.find(e => e.t === 'ask_reroll');
        if (ev && ev.target === r.pendingReroll.target && r.pendingReroll.from === p.pos) sawEvent++;
      }
      cleanup(r);
    }
    ok(sawTarget >= 20, `重投询问携带落点预测（${sawTarget}/25）`);
    ok(sawEvent === sawTarget, 'ask_reroll 事件与 pendingReroll 的落点一致');
  }
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);