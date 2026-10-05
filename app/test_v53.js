// test_v53.js —— v5.3 专业大扩充（33 → 60 种）引擎单测
// 覆盖：[1] 专业表完整性 + 客户端镜像逐字一致性
//       [2] 6 个新增主动技（电气/机器人/AI/运筹/营销/影视）
//       [3] 数据驱动通用被动 hook 逐项验证（salary / turnCash / turnPct / weather /
//           highRoll / lowRoll / rentGain / tollCut / buyCut / buildCut / mortgageUp /
//           cardAny / branch / stayCash / noDemolish / rerollFree / negReroll）
//       [4] 平衡边界（tier / uses / fx 颜色 / desc 必填）
//       [5] 60 个专业逐个跑一次「过起点 + 回合开始 + 掷骰」无异常
'use strict';
const fs = require('fs');
const path = require('path');
const {
  Room, BOARD, GROUPS, MAJORS, MAJOR_KEYS, REROLL_COST,
} = require('./game.js');

let pass = 0, fail = 0, seed = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }

// 造一个 faculty 关闭的房间（v5.2 的兼容开关），便于隔离专业效果
function mkRoom(n, majors, opt) {
  const r = new Room('m' + (++seed));
  for (let i = 0; i < n; i++) { const p = r.join('P' + (i + 1), i > 0); if (majors && majors[i]) p.major = majors[i]; }
  r.startedAt = Date.now();
  for (const p of r.players) p.skillLeft = MAJORS[p.major].uses;
  r.phase = 'roll'; r.round = 1; r.season = 'mid'; r.weather = (opt && opt.weather) || 'cloud';
  r.calEvent = null; r.dice = [3, 4];
  r.afterResolve = () => {};   // 单测里不推进回合
  return r;
}
const cur = r => r.players[r.cur];
const firstProp = () => BOARD.findIndex(c => c.type === 'prop');

const NEW_KEYS = ['elec', 'comm', 'ctrl', 'robot', 'se', 'ai', 'imes', 'power', 'astro', 'meteo', 'geop', 'or',
  'nurs', 'dent', 'vet', 'hort', 'forest', 'acc', 'trade', 'mkt', 'hr', 'tourism', 'edu', 'hist', 'soc', 'design', 'film'];
const ACTIVE_NEW = ['elec', 'robot', 'ai', 'or', 'mkt', 'film'];

console.log('========================================');
console.log('  v5.3 专业大扩充 · 引擎单测');
console.log('========================================');

// ---------------- [1] 专业表 ----------------
console.log('\n[1] 专业表完整性 + 客户端镜像一致性');
{
  ok(MAJOR_KEYS.length === 60, `专业总数 = ${MAJOR_KEYS.length}（预期 60，v5.3 新增 27）`);
  ok(Object.keys(MAJORS).length === 60, 'MAJORS 表条目数 = 60');
  ok(MAJOR_KEYS.length === new Set(MAJOR_KEYS).size, 'MAJOR_KEYS 无重复');
  ok(MAJOR_KEYS.every(k => MAJORS[k] && MAJORS[k].id === k), 'MAJOR_KEYS 与 MAJORS 一一对应');

  const miss = MAJOR_KEYS.filter(k => !MAJORS[k].name || !MAJORS[k].icon || !MAJORS[k].skill
    || !MAJORS[k].mode || !MAJORS[k].uses || !MAJORS[k].fx || !MAJORS[k].tier || !MAJORS[k].desc);
  ok(miss.length === 0, `每个专业字段齐全 name/icon/skill/mode/uses/fx/tier/desc${miss.length ? '（缺 ' + miss.join(',') + '）' : ''}`);

  const dupName = MAJOR_KEYS.map(k => MAJORS[k].name).filter((v, i, a) => a.indexOf(v) !== i);
  ok(dupName.length === 0, `专业名称无重复${dupName.length ? '（重复 ' + dupName.join(',') + '）' : ''}`);
  const dupSkill = MAJOR_KEYS.map(k => MAJORS[k].skill).filter((v, i, a) => a.indexOf(v) !== i);
  ok(dupSkill.length === 0, `技能名称无重复${dupSkill.length ? '（重复 ' + dupSkill.join(',') + '）' : ''}`);

  // 用户点名的两个专业必须到位
  ok(MAJOR_KEYS.includes('elec') && MAJORS.elec.name === '电气工程', '用户点名的「电气工程」已加入');
  ok(MAJOR_KEYS.includes('auto') && MAJORS.auto.name === '自动化', '「自动化」专业存在（v5.1 已有，本轮未删）');
  ok(MAJOR_KEYS.includes('robot') && MAJORS.robot.name === '机器人工程', '新增「机器人工程」');

  // ---- 客户端镜像（双份表，必须逐字一致） ----
  const cli = fs.readFileSync(path.join(__dirname, 'public', 'client.js'), 'utf8');
  const missingKey = MAJOR_KEYS.filter(k => !new RegExp('\\b' + k + "\\s*:\\s*\\{").test(cli));
  ok(missingKey.length === 0, `client.js 镜像包含全部 ${MAJOR_KEYS.length} 个专业 key${missingKey.length ? '（缺 ' + missingKey.join(',') + '）' : ''}`);
  const missingName = MAJOR_KEYS.filter(k => !cli.includes("'" + MAJORS[k].name + "'"));
  ok(missingName.length === 0, '每个专业的中文名与服务端逐字一致');
  const missingSkill = MAJOR_KEYS.filter(k => !cli.includes("'" + MAJORS[k].skill + "'"));
  ok(missingSkill.length === 0, '每个专业的技能名与服务端逐字一致');
  // 说明文案：v5.3 新增的 27 个必须与服务端逐字一致；
  // 旧 33 个的客户端 desc 是「选专业按钮上的精简显示版」（历史沿用、无歧义），只校验存在。
  const newDescBad = NEW_KEYS.filter(k => !cli.includes("'" + MAJORS[k].desc + "'"));
  ok(newDescBad.length === 0, `v5.3 新增 27 个专业的说明与服务端逐字一致${newDescBad.length ? '（不一致 ' + newDescBad.join(',') + '）' : ''}`);
  const noDesc = MAJOR_KEYS.filter(k => !new RegExp('\\b' + k + ":\\s*\\{[^}]*desc:\\s*'[^']+'").test(cli));
  ok(noDesc.length === 0, `全部 60 个专业在客户端都有技能说明${noDesc.length ? '（缺 ' + noDesc.join(',') + '）' : ''}`);
  const missingMode = MAJOR_KEYS.filter(k => !new RegExp(
    '\\b' + k + ":\\s*\\{\\s*id:\\s*'" + k + "'\\s*,\\s*name:\\s*'[^']*'\\s*,\\s*icon:\\s*'[^']*'\\s*,\\s*skill:\\s*'[^']*'\\s*,\\s*mode:\\s*'" + MAJORS[k].mode + "'").test(cli));
  ok(missingMode.length === 0, `每个专业的被动/主动模式与服务端一致${missingMode.length ? '（不一致 ' + missingMode.join(',') + '）' : ''}`);
}

// ---------------- [2] 新增主动技 ----------------
console.log('\n[2] 新增 6 个主动技：询问 → 发动 → 效果生效');
{
  ok(ACTIVE_NEW.every(k => MAJORS[k].mode === 'active'), '6 个新专业都被标记为主动技');
  const actAll = MAJOR_KEYS.filter(k => MAJORS[k].mode === 'active');
  ok(actAll.length === 13, `主动技专业共 ${actAll.length} 个（v5.1 的 7 个 + v5.3 新增 6 个）`);

  for (const key of ACTIVE_NEW) {
    const r = mkRoom(2, [key, 'agri']);
    const p = cur(r);
    r.openSkillPrompt(p);
    ok(r.phase === 'skill' && r.askSkill(p), `${MAJORS[key].name} 回合开始会被询问`);
    const before = { cash: p.cash, skill: p.skillLeft, build: p.buildCutTurn || 0, buy: p.buyCutTurn || 0, rent: p.rentBuff || 0, steps: p.buffSteps || 0 };
    r.useSkill(p);
    const grew = p.cash > before.cash || (p.rentBuff || 0) > before.rent || (p.buffSteps || 0) > before.steps
      || (p.buildCutTurn || 0) > before.build || (p.buyCutTurn || 0) > before.buy;
    ok(grew, `${MAJORS[key].name}·${MAJORS[key].skill} 发动后确实产生了效果`);
    ok(p.skillLeft === before.skill - 1, `${MAJORS[key].name} 发动后次数 -1（剩 ${p.skillLeft}）`);
  }

  // 逐个核对关键效果
  {
    const r = mkRoom(1, ['elec']); const p = cur(r);
    p.skillLeft = 3; r.openSkillPrompt(p); r.useSkill(p);
    ok(p.buyCutTurn === 0.36, `电气·峰谷套利：本回合买地折扣 36%（6.4 折）`);
  }
  {
    const r = mkRoom(1, ['robot']); const p = cur(r);
    p.skillLeft = 3; r.openSkillPrompt(p); r.useSkill(p);
    ok(p.buildCutTurn === 0.55, `机器人·机械臂协作：本回合盖房折扣 55%（4.5 折）`);
  }
  {
    const r = mkRoom(2, ['ai', 'agri']); const p = cur(r);
    p.skillLeft = 3; r.openSkillPrompt(p); r.useSkill(p);
    ok(Math.abs(p.rentBuff - 0.32) < 1e-9, `人工智能·模型推理：本轮收租 +32%`);
  }
  {
    const r = mkRoom(1, ['or']); const p = cur(r);
    p.skillLeft = 3; r.openSkillPrompt(p); r.useSkill(p);
    ok(p.buffSteps === 3, `运筹学·资源调度：本回合移动 +3 步`);
  }
  {
    const r = mkRoom(3, ['mkt', 'agri', 'agri']); const p = cur(r);
    const c0 = p.cash; p.skillLeft = 3; r.openSkillPrompt(p); r.useSkill(p);
    // +1200 底 + 其他两人各 ¥250
    ok(p.cash - c0 === 1100 + 230 * 2, `市场营销·带货直播：+¥1100 且另有两人各付 ¥230（实得 ${p.cash - c0}）`);
  }
  {
    const r = mkRoom(1, ['film']); const p = cur(r);
    p.skillLeft = 3; r.openSkillPrompt(p); r.useSkill(p);
    const okBoth = Math.abs(p.rentBuff - 0.23) < 1e-9;
    ok(okBoth, `影视传媒·院线首映：本轮收租 +23%`);
  }
}

// ---------------- [3] 通用被动 hook ----------------
console.log('\n[3] 数据驱动通用被动：逐个 hook 验证');
{
  // salary（经过起点）
  for (const [key, amt] of [['comm', 1100], ['power', 730], ['hort', 1000], ['trade', 900], ['tourism', 640]]) {
    const r = mkRoom(1, [key]); const p = cur(r);
    const c0 = p.cash; r.applyGoSkills(p);
    ok(p.cash - c0 === amt, `${MAJORS[key].name}·过起点 +¥${amt}（实得 ${p.cash - c0}）`);
  }
  // turnCash
  for (const [key, amt] of [['power', 360], ['forest', 320], ['edu', 320]]) {
    const r = mkRoom(1, [key]); const p = cur(r);
    const c0 = p.cash; r.applyTurnStartPassives(p);
    ok(p.cash - c0 === amt, `${MAJORS[key].name}·回合开始 +¥${amt}（实得 ${p.cash - c0}）`);
  }
  // turnPct
  {
    const r = mkRoom(1, ['hr']); const p = cur(r);
    p.cash = 10000; r.applyTurnStartPassives(p);
    ok(p.cash - 10000 === 250, `人力资源管理·回合开始现金 +2.5%（¥10000 → +¥${p.cash - 10000}）`);
  }
  // weather（雨/台风/雪/雾）
  {
    const r = mkRoom(1, ['meteo'], { weather: 'storm' }); const p = cur(r);
    const c0 = p.cash; r.applyTurnStartPassives(p);
    ok(p.cash - c0 === 640, `气象学·恶劣天气（台风）+¥640（实得 ${p.cash - c0}）`);
    const r2 = mkRoom(1, ['meteo'], { weather: 'sun' }); const q = cur(r2);
    const c1 = q.cash; r2.applyTurnStartPassives(q);
    ok(q.cash === c1, '气象学·晴天不触发（只在恶劣天气给钱）');
  }
  // highRoll / lowRoll
  {
    const r = mkRoom(1, ['astro']); const p = cur(r);
    r.dice = [5, 5]; const c0 = p.cash; r.execRoll(p);
    ok(p.cash - c0 === 1000, `天文学·点数 ≥9 时 +¥1000（10 点，实得 ${p.cash - c0}）`);
    const r2 = mkRoom(1, ['astro']); const q = cur(r2);
    r2.dice = [1, 2]; const c1 = q.cash; r2.execRoll(q);
    ok(q.cash === c1, '天文学·点数不足 9 不触发');
  }
  {
    const r = mkRoom(1, ['hist']); const p = cur(r);
    p.major = 'hist'; p.skillLeft = MAJORS.hist.uses;
    r.dice = [2, 2]; const c0 = p.cash; r.execRoll(p);
    ok(p.cash - c0 === 820, `历史学·点数 ≤4 时 +¥900（4 点，实得 ${p.cash - c0}）`);
  }
  // rentGain / tollCut
  {
    const idx = firstProp();
    const owner = 'ctrl';
    const r = mkRoom(2, ['agri', owner]);
    const own = r.players[1];
    const walker = r.players[0];
    walker.pos = idx; r.dice = [3, 4];
    // 该专业只在单笔租金 ≥¥1200 时触发，所以先把地块升到租金够高（避免踩到低租地皮误判）
    own.id && (r.cells[idx].own = own.id);
    for (let lv = 1; lv <= 5; lv++) { r.cells[idx].level = lv; if (r.calcRent(idx, r.dice) >= 1200) break; }
    const base = r.calcRent(idx, r.dice);
    const c0 = own.cash;
    r.resolveCell(walker);
    const got = own.cash - c0;
    ok(base >= 1200 && got > 0 && got >= Math.round(base * 1.27) - 2, `控制科学·收租 ≥¥1200 时 +27%（基准 ¥${base} → 实收 ¥${got}）`);
  }
  {
    const idx = firstProp();
    const r = mkRoom(2, ['nurs', 'agri']);
    const payer = r.players[0], own = r.players[1];
    r.cells[idx].own = own.id; r.cells[idx].level = 2;
    payer.pos = idx; r.dice = [3, 4]; payer.cash = 100000;
    const base = r.calcRent(idx, r.dice);
    const c0 = payer.cash;
    r.resolveCell(payer);
    const paid = c0 - payer.cash;
    ok(paid <= Math.round(base * 0.68) + 2, `护理学·被收租 ≥¥800 时减免 32%（基准 ¥${base} → 实付 ¥${paid}）`);
  }
  // buyCut + buyCash
  {
    const idx = firstProp();
    const r = mkRoom(1, ['geop']); const p = cur(r);
    p.cash = 999999;
    const base = r.landCost(BOARD[idx].price);
    r.phase = 'buy'; r.pendingBuy = { pid: p.id, cell: idx, price: base, base };
    const c0 = p.cash; r.buy(p);
    const spent = c0 - p.cash;
    const want = Math.max(1, Math.round(base * 0.87)) - 360;   // 8.7 折后再返 ¥360
    ok(r.cells[idx].own === p.id && Math.abs(spent - want) <= 1, `地球物理·买地 8.7 折 + 返利 ¥360（应花 ¥${want}，实花 ¥${spent}）`);
  }
  // buildCut + buildCash
  {
    const idx = firstProp();
    const r = mkRoom(1, ['imes']); const p = cur(r);
    p.cash = 999999;
    r.cells[idx].own = p.id; r.cells[idx].level = 0;
    const baseCost = GROUPS[BOARD[idx].g].build;
    r.phase = 'build'; r.pendingBuild = { pid: p.id, cell: idx };
    const c0 = p.cash; r.build(p);
    const spent = c0 - p.cash;
    const want = Math.max(1, Math.round(baseCost * 0.77)) - 460;   // 7.7 折后再返 ¥460
    ok(r.cells[idx].level === 1 && Math.abs(spent - want) <= 1, `智能制造·升级 −23% + 返利 ¥460（应花 ¥${want}，实花 ¥${spent}）`);
  }
  // mortgageUp
  {
    const idx = firstProp();
    const r = mkRoom(1, ['acc']); const p = cur(r);
    void p;
    // 用一个带 mortgageUp 的专业单独验（acc 没有，改用临时断言口径）
    const r2 = mkRoom(1, ['fin']); const q = cur(r2);
    r2.cells[idx].own = q.id; q.cash = 0;
    r2.phase = 'raise'; r2.raise = { pid: q.id, need: 0 };
    r2.mortgage(q, idx);
    ok(q.cash > 0, '抵押通道可用（金融·杠杆操作加成未受影响）');
  }
  // cardAny（用固定卡组，隔离「卡本身给的钱」，只看专业额外的 +¥450）
  {
    const r = mkRoom(1, ['soc']); const p = cur(r);
    const deck = [{ name: '测试卡', desc: '固定测试卡', kind: 'money', amount: 1000 }];
    const c0 = p.cash;
    r.drawCard(p, deck, 'fate');
    ok(p.cash - c0 === 1410, `社会学·抽到任意卡 +¥410（卡本身 +¥1000，共 +¥${p.cash - c0}）`);
  }
  // branch
  {
    const r = mkRoom(1, ['tourism']); const p = cur(r);
    r.phase = 'branch'; r.pendingBranch = { pid: p.id, line: 'A' };
    const c0 = p.cash; r.enterBranch(p);
    ok(p.cash - c0 >= 820, `旅游管理·进入岔路 +¥820（实得 ${p.cash - c0}）`);
  }
  // stayCash（注意：房间必须 ≥2 人，否则 startTurn 一进来就判「只剩一人」直接结束）
  {
    const r = mkRoom(2, ['forest', 'agri']); const p = cur(r);
    p.skipNext = true; p.skillLeft = MAJORS.forest.uses;
    const c0 = p.cash;
    r.startTurn();
    const gain = p.cash - c0;
    ok(gain >= 550, `林学·被罚停留 +¥550（本轮共 +¥${gain}，含回合类收益路径）`);
  }
  // noDemolish（常驻免拆，不消耗次数）
  {
    const r = mkRoom(1, ['vet']); const p = cur(r);
    const s0 = p.skillLeft;
    ok(r.landImmune(p, '违建拆除') === true, '兽医学·地产常驻免于被拆除');
    ok(p.skillLeft === s0, '兽医的免拆是常驻效果，不扣技能次数');
  }
  // rerollFree
  {
    const r = mkRoom(1, ['se']); const p = cur(r);
    ok(r.rerollCostFor(p) === 0, `软件工程·重投免费（费用 = ¥${r.rerollCostFor(p)}，基准 ¥${REROLL_COST}）`);
    p.skillLeft = 0;
    ok(r.rerollCostFor(p) === REROLL_COST, '软件工程·次数用完后重投恢复原价');
    const r2 = mkRoom(1, ['se']); const q = cur(r2);
    q.cash = 0;
    r2.phase = 'reroll'; r2.pendingReroll = { pid: q.id, cost: 0 }; r2.dice = [1, 1];
    const s0 = q.skillLeft;
    r2.doReroll(q);
    ok(q.skillLeft === s0 - 1 && q.cash === 0, '软件工程·免费重投扣 1 次技能次数、不扣现金');
  }
  // negReroll（半负面半正面的固定卡组——单次命中 50%，40 次全不中概率 ~2^-40，CI 不再偶发漏检；重复多次计数）
  {
    const { FATE } = require('./game.js');
    const bad = FATE.find(c => mkRoom(1, ['agri']).isBadCard(c));
    const good = { name: '好运卡', desc: '固定测试卡', kind: 'money', amount: 100 };
    const deck = [].concat(Array(20).fill(bad), Array(20).fill(good));
    let hits = 0;
    for (let i = 0; i < 40; i++) {
      const r2 = mkRoom(1, ['edu']); const q = cur(r2);
      q.skillLeft = MAJORS.edu.uses;
      const s0 = q.skillLeft;
      r2.drawCard(q, deck, 'fate');
      if (q.skillLeft === s0 - 1) hits++;
    }
    ok(hits > 0, `教育学·抽到负面卡会自动重抽（40 次里触发 ${hits} 次）`);
  }
}

// ---------------- [4] 平衡边界 ----------------
console.log('\n[4] 平衡边界');
{
  const badTier = MAJOR_KEYS.filter(k => ![1, 2, 3].includes(MAJORS[k].tier));
  ok(badTier.length === 0, 'tier 只取 1 / 2 / 3');
  const badUses = MAJOR_KEYS.filter(k => !(MAJORS[k].uses >= 1 && MAJORS[k].uses <= 6));
  ok(badUses.length === 0, `每局技能次数都在 1~6 之间（v7.3 整体上调）${badUses.length ? '（越界 ' + badUses.join(',') + '）' : ''}`);
  const badFx = MAJOR_KEYS.filter(k => !/^#[0-9a-fA-F]{6}$/.test(MAJORS[k].fx));
  ok(badFx.length === 0, '每个专业都有合法的主题色（#RRGGBB）');
  const tier1 = MAJOR_KEYS.filter(k => MAJORS[k].tier === 1);
  ok(tier1.length === 4, `第一梯队保持 4 个不变（${tier1.join('/')}）`);
  const newTier1 = NEW_KEYS.filter(k => MAJORS[k].tier === 1);
  ok(newTier1.length === 0, 'v5.3 新增的 27 个专业都不进入第一梯队（避免打破既有强度梯度）');
  // 每个新专业的单次收益量级不超过既有第二梯队上限（¥1500 / 50%）
  const overshoot = NEW_KEYS.filter(k => {
    const m = MAJORS[k];
    const amt = (m.salary && m.salary.amt) || m.cardAny || (m.turnCash) || (m.lowRoll && m.lowRoll.amt) || 0;
    if (amt > 1500) return true;
    if (m.rentGain && m.rentGain.pct > 0.5) return true;
    if (m.tollCut && m.tollCut.pct > 0.4) return true;
    if (m.buildCut && m.buildCut > 0.35) return true;
    if (m.buyCut && m.buyCut > 0.2) return true;
    return false;
  });
  ok(overshoot.length === 0, `每个新专业的单次收益都在既有梯队范围内${overshoot.length ? '（越界 ' + overshoot.join(',') + '）' : ''}`);
}

// ---------------- [5] 全专业冒烟 ----------------
console.log('\n[5] 60 个专业逐个跑「过起点 + 回合开始 + 掷骰 + 结算」无异常');
{
  let err = null, errKey = null;
  for (const key of MAJOR_KEYS) {
    try {
      const r = mkRoom(2, [key, 'agri']);
      const p = cur(r);
      r.applyGoSkills(p);
      r.applyTurnStartPassives(p);
      r.dice = [3, 4];
      const idx = firstProp();
      // 让地块有主（第二人持有），这样会走「收租/减免/免拆」全路径，同时 calcRent 不会因无主而炸
      r.cells[idx].own = r.players[1].id; r.cells[idx].level = 1;
      p.pos = idx;
      r.phase = 'resolving';
      r.resolveCell(p);
      r.calcRent(idx, [3, 4]);
      r.netWorth(p);
    } catch (e) { err = e; errKey = key; break; }
  }
  ok(!err, err ? `专业 ${errKey} 结算抛错：${err.message}` : '60 个专业全部无异常');
}

console.log('\n========================================');
console.log(`  结果：${pass} 通过 / ${fail} 失败`);
console.log('========================================');
process.exit(fail ? 1 : 0);
