'use strict';
// v5.0 机制单测：大学主题数据 / 地图扩容 / 岔路出口收益 / 经济与人数
const { Room, BOARD, GROUPS, MAJORS, MAJOR_KEYS, FUND_CAP, ENDGAME_ROUND, REROLL_COST, BRANCH, BRANCH2 } = require('./game');

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.error('  ✗ ' + name); } };

function mkRoom(n = 4) {
  const r = new Room('T0');
  for (let i = 0; i < n; i++) r.join('P' + i, false);
  r.weather = 'cloud'; r.season = 'mid'; r.calEvent = null;
  for (const p of r.players) p.skillLeft = 0;
  r.players.forEach((p, i) => { if (i >= 2) p.cash = 300; });
  return r;
}
const cur = r => r.players[r.cur];
const props = BOARD.map((c, i) => ({ c, i })).filter(({ c }) => c.type === 'prop');

console.log('\n[1] 大学数据：30 所地皮 · 价格与租金两两不同');
{
  ok(props.length === 30, `地皮数 = 30（实际 ${props.length}）`);
  const prices = props.map(({ c }) => c.price);
  ok(new Set(prices).size === 30, `30 个购买价两两不同（${Math.min(...prices)} ~ ${Math.max(...prices)}）`);
  const rents = props.map(({ c }) => c.rent);
  ok(new Set(rents).size === 30, '30 个裸地租金两两不同');
  // QS 越靠前越贵：港大（#11）远高于长安大学（未上榜）
  const hku = props.find(({ c }) => c.name === '香港大学'), cau = props.find(({ c }) => c.name === '长安大学');
  ok(hku && cau && hku.c.price > cau.c.price, `价格映射：香港大学 ¥${hku.c.price} > 长安大学 ¥${cau.c.price}`);
  // v5.0：香港大学 / 清华大学 地价对调（清华 ¥4200 成为最贵）
  const thu = props.find(({ c }) => c.name === '清华大学');
  ok(hku.c.price === 3900 && thu.c.price === 4200 && Math.max(...prices) === 4200,
     `港大与清华地价对调：清华 ¥${thu.c.price} 最贵、港大 ¥${hku.c.price}`);
  // v5.0：30 所大学随机打乱（不再按排名从低到高排列）
  const seq = props.map(({ c }) => c.price);
  let asc = true, desc = true;
  for (let i = 1; i < seq.length; i++) { if (seq[i] < seq[i - 1]) asc = false; if (seq[i] > seq[i - 1]) desc = false; }
  ok(!asc && !desc, '大学沿棋盘随机分布（既不升序也不降序）');
  // 相邻地皮不同色组（避免同色相邻破坏"集齐"节奏）
  // v5.0 续：按用户要求把「校园商城 ↔ 北理工」互换位置后，北理工(g6) 恰好与中山大学(g6) 相邻；
  //          这是全盘唯一一处同色相邻（集齐仍需拿到第三块「天津大学」），保留用户改动、断言放宽到 ≤1。
  let adjSame = 0; const adjPairs = [];
  for (let i = 0; i < props.length - 1; i++) {
    if (props[i].c.g === props[i + 1].c.g) { adjSame++; adjPairs.push(props[i].c.name + '↔' + props[i + 1].c.name); }
  }
  ok(adjSame <= 1, `相邻地皮同色组 ≤1 处（实际 ${adjSame} 处${adjPairs.length ? '：' + adjPairs.join('、') : ''}）`);
  ok(adjSame === 0 || adjPairs.every(p => p === '北京理工↔中山大学'), '唯一同色相邻来自指定的「北理工↔中山大学」互换');
  // 10 个色组每组仍恰好 3 所（集齐机制不被破坏）
  const gc = {}; props.forEach(({ c }) => { gc[c.g] = (gc[c.g] || 0) + 1; });
  ok(Object.keys(gc).length === 10 && Object.values(gc).every(n => n === 3), '10 个色组每组恰好 3 所大学');

  // 30 所全部为中国高校（内地 27 + 香港大学 + 西北农林 + 长安大学）
  const CN = ['香港大学','北京大学','清华大学','复旦大学','上海交大','浙江大学','南京大学','中科大','同济大学','武汉大学',
              '北师大','哈工大','天津大学','北京理工','中山大学','西安交大','华中科大','四川大学','山东大学','厦门大学',
              '南科大','南开大学','国科大','华南理工','北航','东南大学','华东师大','深圳大学','西北农林','长安大学'];
  const got = props.map(({ c }) => c.name);
  ok(CN.length === 30 && CN.every(n => got.includes(n)) && got.length === CN.length, '30 所全部为中国高校（内地 + 港大）');
  // 建成后（1~4 级）每所大学租金也必须不同
  let allDistinct = true;
  for (let lv = 1; lv <= 4; lv++) {
    const rs = props.map(({ c }) => Math.round(GROUPS[c.g].rents[lv - 1] * (c.rent / GROUPS[c.g].refRent)));
    if (new Set(rs).size !== 30) allDistinct = false;
  }
  ok(allDistinct, '建成后 1~4 级租金同样两两不同');
  ok(BOARD.filter(c => c.type === 'transport').length === 4 && BOARD.filter(c => c.type === 'transport').every(c => c.name.includes('机场')),
     '4 个交通格全部换成机场');
  ok(Object.keys(GROUPS).length === 10 && Object.values(GROUPS).every(g => g.refRent), '10 个色组、组内基准租金齐全');
}

console.log('\n[2] 地图扩容：主路线 48 格 + 两条 7 格岔路');
{
  const r = mkRoom();
  ok(BOARD.length === 62, `总格数 = 62（实际 ${BOARD.length}）`);
  ok(BOARD[20].type === 'junction' && BOARD[36].type === 'junction2', '20 / 36 号是两条岔路入口（长廊入口与教育基金会已互换）');
  ok(r.nextOf(47) === 0, '主路线 47 → 0 环形');
  ok(r.nextOf(53) === 54 && r.nextOf(60) === 61, '岔路内线性 +1');
  ok(r.nextOf(54) === 28 && r.nextOf(61) === 39, '两个出口的下一格分别接 28 教育基金会 / 39 校园商城');
  ok(BOARD[28].type === 'parking' && BOARD[39].type === 'jail', '28 号是教育基金会、39 号是校园商城（已与北理工互换）');
}

console.log('\n[3] 岔路出口新效果：停留两回合 + 领卡 / 领钱');
{
  const r = mkRoom();
  const p0 = cur(r);
  p0.cash = 10000; p0.medal = 0; p0.skipTurns = 0; p0.pos = 54; r.phase = 'resolving';
  r.resolveCell(p0);
  ok(p0.cash === 10000 && p0.medal === 2, `校史馆：领 2 张免租金卡、现金不变（medal=${p0.medal}）`);
  ok(p0.skipTurns === 2, `校史馆：需停留 2 回合（skipTurns=${p0.skipTurns}）`);
  const p1 = r.players[1];
  p1.cash = 10000; p1.pos = 61; p1.skipTurns = 0; r.phase = 'resolving';
  r.resolveCell(p1);
  ok(p1.cash === 12500, `校企合作中心：+¥2500（现金 ${p1.cash}）`);
  ok(p1.skipTurns === 2, `校企合作中心：需停留 2 回合（skipTurns=${p1.skipTurns}）`);
}

console.log('\n[4] 国际交流站（新格）');
{
  const r = mkRoom();
  const p0 = cur(r);
  p0.cash = 10000; p0.pos = 58; r.phase = 'resolving';
  let err = null;
  try { r.resolveCell(p0); } catch (e) { err = e; }
  ok(!err, '结算无异常' + (err ? '：' + err.message : ''));
  ok(p0.cash === 8800 || p0.cash === 12800, `报名 ¥1200 后成功返 ¥4000（现金 ${p0.cash}）`);
}

console.log('\n[5] 经济与人数调整');
{
  const r = mkRoom();
  // v5.0 续·二：免罚符分段涨价
  const shieldAt = rn => { const n = Math.max(1, rn); return n <= 8 ? 280 + 60 * n : (n <= 20 ? 760 + 120 * (n - 8) : 2200 + 160 * (n - 20)); };
  ok(r.shieldCost() === shieldAt(r.round), `免罚符分段价 = ¥${r.shieldCost()}`);
  const p0 = cur(r);
  p0.cash = 50000; r.phase = 'roll'; r.fundPool = 0;
  r.useItem(p0, 'shield');
  ok(r.fundPool === Math.round(shieldAt(r.round) / 3), `免罚符花费 1/3 进基金池（池 ¥${r.fundPool}）`);
  // 重掷同样入池
  const r2 = mkRoom();
  const q = r2.players[0];
  q.cash = 50000; q.pos = 5; q.rerollUsed = false; r2.fundPool = 0; r2.phase = 'roll';
  r2.doRoll(q);
  if (r2.phase === 'reroll') {
    r2.doReroll(q);
    ok(r2.fundPool === Math.round(REROLL_COST / 3), `重掷花费 1/3 进基金池（池 ¥${r2.fundPool}）`);
  } else { ok(false, '未进入重掷询问'); }
  // 最多 5 人
  const r3 = new Room('T1');
  let joined = 0;
  for (let i = 0; i < 6; i++) if (r3.join('Q' + i, false)) joined++;
  ok(joined === 5, `最多 5 人（成功加入 ${joined} 人）`);
  // 新专业（v5.0 共 23 种）
  ok(MAJOR_KEYS.length === 23 && MAJORS.lang && MAJORS.pe && MAJORS.phys && MAJORS.chem && MAJORS.phil
     && MAJORS.agri && MAJORS.drama && MAJORS.mech && MAJORS.stat && MAJORS.aero && MAJORS.fin && MAJORS.geol && MAJORS.mil,
     `专业数 = ${MAJOR_KEYS.length}（含农学/戏剧/机械/统计/航天/金融/地质/军事）`);
  ok(MAJOR_KEYS.length === new Set(MAJOR_KEYS).size && MAJOR_KEYS.every(k => MAJORS[k] && MAJORS[k].uses > 0),
     '23 个专业 id 唯一且都配了技能次数');
}

console.log('\n[5b] 卡牌扩容');
{
  const { CHANCE, FATE } = require('./game');
  ok(CHANCE.length === 61 && FATE.length === 61, `机会 ${CHANCE.length} 张 / 命运 ${FATE.length} 张`);
  const kinds = new Set(CHANCE.concat(FATE).map(c => c.kind));
  ok(kinds.has('money') && kinds.has('each') && kinds.has('skip') && kinds.has('jailSelf') && kinds.has('richPayPct'),
     '卡牌效果类型齐全（金钱/全体/停留/留级/首富税）');
  const dup = CHANCE.concat(FATE).map(c => c.name).filter((n, i, a) => a.indexOf(n) !== i);
  ok(dup.length === 0, '卡名无重复' + (dup.length ? '：' + dup.join('/') : ''));
  // 所有 moveTo 目标格必须是合法格子
  const bad = CHANCE.concat(FATE).filter(c => c.kind === 'moveTo' && !(c.cell >= 0 && c.cell < 48));
  ok(bad.length === 0, 'moveTo 目标格坐标合法');
}

console.log('\n[6] 淡旺季影响削弱 + 税下调');{
  const { SEASON } = require('./game');
  ok(SEASON.low.rentMul === 0.85 && SEASON.high.rentMul === 1.15, `淡旺季收租系数 ${SEASON.low.rentMul} / ${SEASON.high.rentMul}`);
  ok(SEASON.low.buildMul === 0.9 && SEASON.high.buildMul === 1.1, `淡旺季建造系数 ${SEASON.low.buildMul} / ${SEASON.high.buildMul}`);
  ok(BOARD[4].amount === 900, `缴学费 ¥${BOARD[4].amount}`);
}

console.log('\n[7] 既有机制回归');
{
  const r = mkRoom();
  r.fundPool = 0;
  const cashBefore = r.players.map(p => p.cash);
  r.addToFund(32000);
  ok(r.fundPool === FUND_CAP && r.players.every((p, i) => p.cash === cashBefore[i] + 500), '基金池封顶 30000 + 溢出均分');
  const r2 = mkRoom();
  const p0 = cur(r2);
  p0.pos = 28; r2.fundPool = 5000; r2.phase = 'resolving';
  r2.resolveCell(p0);
  ok(p0.cash === 35000 && r2.fundPool === 0, '踩教育基金会（28 号）领走全池');
  ok(ENDGAME_ROUND === 15 && r2.salaryOn() === true, '经济寒冬仍设在第 15 轮');
  // 长廊门槛 2 块地皮
  ok(BRANCH.NEED === 2, `学术长廊门槛 = ${BRANCH.NEED} 块地皮`);
  const r3 = mkRoom();
  const q = r3.players[0];
  ok(r3.propCells(q).length === 0 && BRANCH2.JUNCTION === 36, '创业大道无门槛（入口仅询问，不设条件）');
}

// 异步：寒冬停发工资
{
  const r = mkRoom();
  const p0 = r.players[0];
  p0.pos = 46; p0.cash = 10000; r.round = 15;
  r.dice = [1, 1];         // 46 → 47 → 0（恰好停在起点，无卡牌干扰）
  r.execRoll(p0);
  setTimeout(() => {
    console.log('\n[8] 经济寒冬回归');
    ok(p0.cash === 10000, `寒冬期过起点不发工资（现金 ${p0.cash}）`);
    const r2 = mkRoom();
    const q = r2.players[0];
    q.pos = 46; q.cash = 10000; r2.round = 5;
    r2.dice = [1, 1];
    r2.execRoll(q);
    setTimeout(() => {
      ok(q.cash === 12000, `寒冬前过起点领 ¥2000（现金 ${q.cash}）`);
      console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
      process.exit(fail ? 1 : 0);
    }, 30);
  }, 30);
}
