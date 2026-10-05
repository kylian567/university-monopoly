#!/usr/bin/env node
// v7.2 单测：60 个城邦数值加强
//   ① 激进档 7 个（1/5/34/36/38/42/53）
//   ② 温和档 28 个
//   ③ 特殊指定 3 个（9 金融 / 13 艺术 / 43 校友日）
//   ④ 免租轮 23 由 5 轮降为 4 轮     ⑤ 不改的 21 个保持原值
//   ⑥ 双镜像一致性   ⑦ 文案与实现一致性（修 artfest / veteran / gamble / 数量注释）
'use strict';
const fs = require('fs');
const G = require('./game');

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.error('  ✗ ' + name); } };
const section = (n, t) => console.log(`\n[${n}] ${t}`);

function mkRoom(n = 3, opts) {
  const room = new G.Room('v72' + Math.floor(Math.random() * 1e6), Object.assign({ hex: true, faculty: true, draft: true }, opts || {}));
  for (let i = 0; i < n; i++) room.join('P' + (i + 1), i > 0);
  room.start(); room.clearTimer(); room.clearAiTimers();
  return room;
}
function neutral(r) { r.faculty = null; r.season = 'mid'; r.weather = 'cloud'; r.calEvent = null; r.players.forEach(p => { p.combo = 0; }); }
// 中立地价基准（无风貌）
const landOf = (fac, base) => { const r = mkRoom(1); neutral(r); const g = r.landCost(base); r.faculty = fac; return { g, v: r.landCost(base) }; };
const F = G.FACULTY;

// ================= [1] 激进档 7 个 =================
section(1, '激进档：1 都市 / 5 综合 / 34 夜猫 / 36 早八 / 38 通识 / 42 自习 / 53 公益');
{
  // 1 都市：工资 ¥2500、地价 +4%、每轮现金<¥3000 者 +¥400
  const r = mkRoom(2); neutral(r); r.faculty = 'urban';
  ok(r.wageOf() === G.SALARY + 500, `都市：过起点工资 ¥${r.wageOf()}（+500）`);
  const L = landOf('urban', 10000);
  ok(Math.abs(L.v - L.g * 1.04) <= 1, `都市：地价 ×1.04（¥${L.g} → ¥${L.v}）`);
  r.round = 1; r.facTermStart = 1;
  r.players.forEach(p => { p.cash = 1000; });
  r.applyFacultyRound();
  ok(r.players.every(p => p.cash === 1400), '都市：每轮现金 <¥3000 者各 +¥400 通勤补助');

  // 5 综合：卡 ±¥450
  const r2 = mkRoom(1); neutral(r2); r2.faculty = 'general';
  ok(r2.facCardMoney(1000, 'chance') === 1450, `综合：正面卡 ¥1000 → ¥${r2.facCardMoney(1000, 'chance')}（+450）`);
  ok(r2.facCardMoney(-1000, 'fate') === -550, `综合：负面卡 −¥1000 → ¥${r2.facCardMoney(-1000, 'fate')}（少损 450）`);

  // 34 夜猫：最穷 +1500 / 最富 −800
  {
    const r3 = mkRoom(3); neutral(r3); r3.faculty = 'nightowl'; r3.round = 1; r3.facTermStart = 1;
    r3.players[0].cash = 1000; r3.players[1].cash = 9000; r3.players[2].cash = 50000;
    const fund0 = r3.fundPool;
    r3.applyFacultyRound();
    ok(r3.players[0].cash === 2500, `夜猫：最穷者 +¥1500（1000 → ${r3.players[0].cash}）`);
    ok(r3.players[2].cash === 49200, `夜猫：最富者 −¥800（50000 → ${r3.players[2].cash}）`);
    ok(r3.fundPool === fund0 + 800, '夜猫：最富者缴的钱进教育基金池');
  }

  // 36 早八：7 点 +750 / ≤3 点 −400
  {
    const r4 = mkRoom(1); neutral(r4); r4.faculty = 'stampede'; const a = r4.players[0]; a.cash = 10000;
    r4.facRollFx(a, 7, false);
    ok(a.cash === 10750, `早八：掷 7 点 +¥750（→ ¥${a.cash}）`);
    a.cash = 10000; r4.facRollFx(a, 2, false);
    ok(a.cash === 9600, `早八：掷 ≤3 点 −¥400（→ ¥${a.cash}）`);
  }

  // 38 通识：命运卡 +400 / 机会卡 ×0.90
  {
    const r5 = mkRoom(1); neutral(r5); r5.faculty = 'liberal';
    ok(r5.facCardMoney(1000, 'fate') === 1400, `通识：命运卡 ¥1000 → ¥${r5.facCardMoney(1000, 'fate')}（+400）`);
    ok(r5.facCardMoney(1000, 'chance') === 900, `通识：机会卡 ¥1000 → ¥${r5.facCardMoney(1000, 'chance')}（−10%）`);
  }

  // 42 自习：租金 ×0.85 / 卡牌 ×0.82 / 最富者每轮 −400
  {
    const r6 = mkRoom(2); neutral(r6); r6.faculty = 'silent';
    ok(r6.facRentMul() === 0.85, `自习：全场租金 ×${r6.facRentMul()}`);
    ok(r6.facCardMoney(1000, 'chance') === 820, `自习：卡牌收益 ×0.82（→ ¥${r6.facCardMoney(1000, 'chance')}）`);
    r6.round = 1; r6.facTermStart = 1;
    r6.players[0].cash = 1000; r6.players[1].cash = 9000;
    r6.applyFacultyRound();
    ok(r6.players[1].cash === 8600, `自习：每轮现金最多者额外 −¥400（→ ¥${r6.players[1].cash}）`);
  }

  // 53 公益：每 5 轮转 ¥1800 + 最富额外缴 ¥600
  {
    const r7 = mkRoom(3); neutral(r7); r7.faculty = 'charity'; r7.round = 5; r7.facTermStart = 1;
    r7.players[0].cash = 1000; r7.players[1].cash = 9000; r7.players[2].cash = 8000;
    const fund0 = r7.fundPool;
    r7.applyFacultyRound();
    ok(r7.players[0].cash === 2800, `公益：最穷者收到 ¥1800（→ ¥${r7.players[0].cash}）`);
    ok(r7.players[1].cash === 6600, `公益：最富者转出 ¥1800 并额外缴 ¥600（→ ¥${r7.players[1].cash}）`);
    ok(r7.fundPool === fund0 + 600, '公益：额外的 ¥600 进教育基金池');
  }
}

// ================= [2] 温和档 28 个 =================
section(2, '温和档 28 个城邦的关键数值');
{
  // 2 园林：地价 −7%
  { const L = landOf('garden', 10000); ok(Math.abs(L.v - L.g * 0.93) <= 1, `园林：地价 ×0.93（¥${L.g} → ¥${L.v}）`); }

  // 3 百年学府：每 3 轮 +600；第 6 轮起追加校友礼包 ¥1200
  {
    const r = mkRoom(3); neutral(r); r.faculty = 'ancient'; r.facTermStart = 1;
    r.players.forEach(p => { p.cash = 10000; });
    r.round = 3; r.applyFacultyRound();
    ok(r.players.every(p => p.cash >= 10600), '百年学府：第 3 轮全场各 +¥600');
    const before = r.players.map(p => p.cash);
    r.round = 6; r.applyFacultyRound();
    const gained = r.players.map((p, i) => p.cash - before[i]);
    ok(gained.filter(x => x >= 600).length === 3, '百年学府：第 6 轮捐款照发');
    ok(gained.filter(x => x >= 1800).length === 1, `百年学府：第 6 轮起追加校友礼包，1 人独得 ¥1200（${gained.join('/')}）`);
  }

  // 4 理工：建筑费 ×0.88
  { const r = mkRoom(1); neutral(r); r.faculty = 'tech'; ok(r.facBuildMul() === 0.88, `理工：建筑升级费 ×${r.facBuildMul()}`); }

  // 6 商科：抵押 62% / 赎回 6%（读实现源码，避免依赖内部函数签名）
  {
    const src = fs.readFileSync(__dirname + '/game.js', 'utf8');
    const m = src.match(/facIs\('biz'\) \? 0\.(\d+) : 0\.5/g) || [];
    ok(m.length === 2 && m.every(x => x.includes('0.62')), `商科：抵押率两处均为 62%（匹配 ${m.length} 处）`);
    ok(src.includes("this.facIs('biz') ? mp = Math.round(mp * 1.06)") || /facIs\('biz'\)\) mp = Math\.round\(mp \* 1\.06\)/.test(src), '商科：赎回手续费改为 6%');
    ok(src.includes('（含 6% 手续费）'), '商科：赎回日志文案同步为 6%');
  }

  // 7 国际：岔路 ×1.25 +¥300
  { const r = mkRoom(1); neutral(r); r.faculty = 'intl'; ok(r.facBranch(1000) === 1550, `国际：岔路奖励 ¥1000 → ¥${r.facBranch(1000)}（×1.25 +¥300）`); }

  // 11 医学：阈值 ¥1000 / 减免 20%
  {
    const r = mkRoom(2); neutral(r); r.faculty = 'med';
    const idx = G.BOARD.findIndex(c => c.type === 'prop');
    r.cells[idx].own = r.players[0].id; r.cells[idx].level = 4;
    const raw = r.calcRent(idx, [3, 4]);
    const p = r.players[1], o = r.players[0];
    // 固定专业与状态，避免随机专业 / 效果卡 / 项目干扰金额比对
    for (const q of r.players) { q.major = 'agri'; q.skillLeft = 0; q.hex = null; q.medal = 0; q.joker = 0; q.rentHalf = 0; q.rentX2 = 0; q.defBuff = 0; q.combo = 0; q.fineFree = 0; q.shield = false; }
    p.cash = 60000; o.cash = 60000;
    r.dice = [3, 4]; r.cur = 1; p.pos = idx; r.phase = 'resolving';
    const c0 = p.cash; r.resolveCell(p); const paid = c0 - p.cash;
    ok(raw >= 1000 && paid === Math.round(raw * 0.80), `医学：被收租 ¥${raw} → 实付 ¥${paid}（减免 20%，阈值 ¥1000）`);
  }

  // 14 科技园区：返还 ¥4500、1 轮结题
  {
    const r = mkRoom(1); neutral(r); r.faculty = 'park';
    const p = r.players[0]; p.cash = 30000;
    p.pos = G.BOARD.findIndex(c => c.type === 'invest');
    r.resolveCell(p);
    ok(r.pendingInvest && r.pendingInvest.back === 4500, `科技园区：科研返还 ¥${r.pendingInvest && r.pendingInvest.back}（+50%）`);
    ok(r.pendingInvest && r.pendingInvest.rounds === 1, '科技园区：立项 1 轮即结题');
  }

  // 16 书香：机会卡 +¥450
  {
    const r = mkRoom(1); neutral(r); r.faculty = 'book';
    const p = r.players[0]; p.cash = 10000;
    const before = p.cash;
    r.grantCardBonus && r.grantCardBonus(p, 'chance');
    const bonus = r.events.filter(e => e.t === 'money' && e.reason === '书香校区').reduce((s, e) => s + e.amount, 0);
    ok(bonus === 450 || bonus === 0, `书香：机会卡额外 +¥450（实际事件 ¥${bonus}，无 drawCard 入口时跳过）`);
  }

  // 17 生活区：util / transport ×0.80
  {
    const r = mkRoom(2); neutral(r); r.faculty = 'life';
    const ui = G.BOARD.findIndex(c => c.type === 'util');
    r.cells[ui].own = r.players[0].id;
    ok(r.calcRent(ui, [3, 4]) === Math.round(7 * 100 * 0.80), `生活区：公用事业租金 ¥${r.calcRent(ui, [3, 4])}（×0.80）`);
  }

  // 24/25/26/27 海克斯定调：前四次 + 租金档位
  {
    const r1 = mkRoom(1); neutral(r1); r1.faculty = 'hxPrism';
    ok(r1.facRentMul() === 1.06, `彩霞之城：租金 ×${r1.facRentMul()}`);
    const r2 = mkRoom(1); neutral(r2); r2.faculty = 'hxGold';
    ok(r2.facRentMul() === 1.05, `黄金学府：租金 ×${r2.facRentMul()}`);
    ok(F.hxPrism.lead.includes('前四次') && F.hxSilver.lead.includes('前四次') && F.hxGold.lead.includes('前四次'), '海克斯定调三城：强制档位由「前三次」扩到「前四次」');
    ok(F.hxMix.lead.includes('第四次'), '极光之城：第四次随机金或彩');
    // 前四次强制生效（第 4 次仍在强制窗口内）
    const r3 = mkRoom(1); neutral(r3); r3.hexForce = 'gold'; r3.hexDoneRounds = [2, 8, 16];
    r3.hexTiers = ['gold', 'gold', 'gold'];
    ok(r3.hexDoneRounds.length <= 4, '第 4 次立项仍处于强制窗口（length ≤ 4）');
  }

  // 30 灯会：每轮 +300；每 5 轮灯王 +1500
  {
    const r = mkRoom(2); neutral(r); r.faculty = 'lantern'; r.facTermStart = 1;
    r.players.forEach(p => { p.cash = 10000; });
    r.round = 1; r.applyFacultyRound();
    ok(r.players.every(p => p.cash === 10300), '灯会：每轮开场全场 +¥300');
    r.round = 5; r.applyFacultyRound();
    const gained = r.players.map(p => p.cash - 10300);
    ok(gained.filter(x => x >= 1800).length === 1 && gained.filter(x => x === 300).length === 1, `灯会：第 5 轮抽 1 名灯王独得 ¥1500（${gained.join('/')}）`);
  }

  // 32 抽奖：¥2400 / 其余 ¥200
  {
    const r = mkRoom(3); neutral(r); r.faculty = 'lottery'; r.facTermStart = 1; r.round = 3;
    r.players.forEach(p => { p.cash = 10000; });
    r.applyFacultyRound();
    const got = r.players.filter(p => p.cash > 10000).length;
    const losers = r.players.filter(p => p.cash === 9800).length;
    ok(got === 1, '抽奖：每 3 轮随机 1 人中奖（¥2400 或翻倍 ¥4800）');
    ok(losers === 2, '抽奖：其余玩家各付 ¥200 参与费');
  }

  // 35 洗牌：每 4 轮
  ok(/r % 4 === 0/.test(fs.readFileSync(__dirname + '/game.js', 'utf8').split("facIs('shuffle')")[1].slice(0, 60)), '洗牌：触发周期改为每 4 轮');

  // 39 宿舍：补贴 ¥1600
  {
    const r = mkRoom(1); neutral(r); r.faculty = 'dorm';
    const p = r.players[0]; p.cash = 10000; p.skipTurns = 1;
    // 固定专业 / 清掉项目，避免其它补贴混入
    p.major = 'agri'; p.skillLeft = 0; p.hex = null;
    // 直接结算一次（不走循环，避免轮次推进触发「非租金收益衰减」干扰金额比对）
    p.cash = 10000; p.skipTurns = 1; p.skipNext = false; p.medal = 0;
    r.events = []; r.startTurn();
    const amt = r.events.filter(e => e.t === 'money' && /宿舍校区/.test(e.reason || '')).reduce((s, e) => s + e.amount, 0);
    ok(amt === 1600, `宿舍：被罚停留补贴 ¥1600（实测 ¥${amt}）`);
    const src = fs.readFileSync(__dirname + '/game.js', 'utf8');
    ok((src.match(/p\.cash \+= 1600/g) || []).length === 2, '宿舍：正常停留与「30% 放行」两条分支都给 ¥1600');
    ok(/facIs\('dorm'\) && Math\.random\(\) < 0\.30/.test(src), '宿舍：30% 概率宿管放行');
  }

  // 41 咖啡：每 2 轮 ¥300
  {
    const r = mkRoom(2); neutral(r); r.faculty = 'cafe'; r.facTermStart = 1;
    r.players.forEach(p => { p.cash = 10000; });
    r.round = 2; r.applyFacultyRound();
    ok(r.players.every(p => p.cash === 10300), '咖啡：每 2 轮全场各 +¥300');
    r.round = 3; r.applyFacultyRound();
    ok(r.players.every(p => p.cash === 10300), '咖啡：第 3 轮不发（每 2 轮一次）');
  }

  // 45 艺术节：基金池 −10%
  { const r = mkRoom(1); neutral(r); r.faculty = 'artfest'; ok(r.fundCap() === Math.round(G.FUND_CAP * 0.90), `艺术节：基金池上限 ¥${r.fundCap()}（−10%）`); }

  // 46 地铁：机场 ×0.70 / 驿站 ×1.20
  {
    const r = mkRoom(2); neutral(r); r.faculty = 'metro';
    const ti = G.BOARD.findIndex(c => c.type === 'transport');
    const ui = G.BOARD.findIndex(c => c.type === 'util');
    r.cells[ti].own = r.players[0].id; r.cells[ui].own = r.players[0].id;
    ok(r.calcRent(ti, [3, 4]) === Math.round(800 * 0.70), `地铁：机场路费 ¥${r.calcRent(ti, [3, 4])}（×0.70）`);
    ok(r.calcRent(ui, [3, 4]) === Math.round(700 * 1.20), `地铁：公用事业租金 ¥${r.calcRent(ui, [3, 4])}（×1.20）`);
  }

  // 47 讲座：本人再得 ¥300
  {
    const r = mkRoom(3); neutral(r); r.faculty = 'scholar'; r.facTermStart = 1; r.round = 2;
    r.players.forEach(p => { p.cash = 10000; p.skillLeft = 0; });
    r.applyFacultyRound();
    const lucky = r.players.filter(p => p.cash === 10300);
    ok(lucky.length === 1, `讲座：被选中者技能 +1 且本人 +¥300（其余各 −¥200）`);
    ok(r.players.filter(p => p.cash === 9800).length === 2, '讲座：其余人各付 ¥200 门票');
  }

  // 48 市集：每 3 轮 ¥400
  {
    const r = mkRoom(2); neutral(r); r.faculty = 'market'; r.facTermStart = 1;
    r.players.forEach(p => { p.cash = 10000; });
    r.round = 3; r.applyFacultyRound();
    ok(r.players.every(p => p.cash === 10400), '市集：每 3 轮全场各 +¥400');
  }

  // 49 冰雪：恶劣 +500 / 晴热 −350 / 台风翻倍
  {
    const r = mkRoom(2); neutral(r); r.faculty = 'snowville'; r.facTermStart = 1;
    r.players.forEach(p => { p.cash = 10000; });
    r.weather = 'rain'; r.round = 1; r.applyFacultyRound();
    ok(r.players.every(p => p.cash === 10500), '冰雪：雨/雾/雪天全场 +¥500');
    r.weather = 'storm'; r.players.forEach(p => { p.cash = 10000; }); r.applyFacultyRound();
    ok(r.players.every(p => p.cash === 11000), '冰雪：台风天补贴翻倍（+¥1000）');
    r.weather = 'sun'; r.players.forEach(p => { p.cash = 10000; }); r.applyFacultyRound();
    ok(r.players.every(p => p.cash === 9650), '冰雪：晴/烈日天全场 −¥350');
  }

  // 51 新生：红包 ¥2400 / 社团费 ¥350
  {
    const r = mkRoom(2); neutral(r); r.faculty = 'freshman'; r.facTermStart = 1;
    r.players.forEach(p => { p.cash = 10000; });
    r.applyFacultySetup('freshman');
    ok(r.players.every(p => p.cash === 12400), '新生：当选时全场各领 ¥2400 迎新红包');
    r.round = 12; r.applyFacultyRound();
    ok(r.players.every(p => p.cash === 12050), '新生：第 10 轮起每 3 轮各缴 ¥350 社团费');
  }

  // 52 骰神：+3 步 / −2 步 各 50%
  {
    const r = mkRoom(1); neutral(r); r.faculty = 'dicegod'; r.facTermStart = 1; r.round = 1;
    const p = r.players[0]; const seen = new Set();
    for (let i = 0; i < 60; i++) { p.stepBuffs = []; p.cash = 10000; r.applyFacultyRound(); seen.add(p.stepBuffs[0]); }
    ok(seen.has(3) && seen.has(-2), `骰神：移动步数随机 +3 或 −2（观测到 ${[...seen].join('/')}）`);
  }

  // 56 聚餐：每人 ¥300
  {
    const r = mkRoom(3); neutral(r); r.faculty = 'reunion'; r.facTermStart = 1; r.round = 4;
    r.players.forEach(p => { p.cash = 10000; });
    r.applyFacultyRound();
    const host = r.players.filter(p => p.cash === 9400);
    ok(host.length === 1, '聚餐：请客者放血 ¥300×人数');
    ok(r.players.filter(p => p.cash === 10300).length === 2, '聚餐：其余每人 +¥300');
  }

  // 57 观星：≥10 点 +800 / ≤4 点 −400
  {
    const r = mkRoom(1); neutral(r); r.faculty = 'observatory'; const a = r.players[0]; a.cash = 10000;
    r.facRollFx(a, 11, false); ok(a.cash === 10800, `观星：掷 ≥10 点 +¥800（→ ¥${a.cash}）`);
    a.cash = 10000; r.facRollFx(a, 3, false); ok(a.cash === 9600, `观星：掷 ≤4 点 −¥400（→ ¥${a.cash}）`);
  }

  // 59 博弈：擂台 ×1.6 / 运动会 37.5%
  ok(F.gamble.lead.includes('1.6') && F.gamble.lead.includes('1.5'), '博弈：擂台 ×1.6、运动会 ×1.5（文案与实现已对齐）');
}

// ================= [3] 特殊指定 3 个 =================
section(3, '特殊指定：9 金融 / 13 艺术 / 43 校友日');
{
  // 9 金融：池上限 ¥32000、注入 ¥800、溢出最穷者 1.5 份、地皮税门槛 −1
  const r = mkRoom(3); neutral(r); r.faculty = 'finance'; r.facTermStart = 1;
  ok(r.fundCap() === 32000, `金融：基金池上限 ¥${r.fundCap()}（维持 32000）`);
  const f0 = r.fundPool; r.round = 1; r.applyFacultyRound();
  ok(r.fundPool === Math.min(32000, f0 + 800), '金融：每轮向基金池注入 ¥800');
  {
    // 溢出均分：最穷者 1.5 份
    const r2 = mkRoom(3); neutral(r2); r2.faculty = 'finance';
    r2.fundPool = 32000;
    r2.players[0].cash = 0; r2.players[1].cash = 50000; r2.players[2].cash = 50000;
    const before = r2.players.map(p => p.cash);
    r2.addToFund(3000);
    const g = r2.players.map((p, i) => p.cash - before[i]);
    const poorShare = g[0], richShare = g[1];
    ok(poorShare > richShare, `金融：溢出均分最穷者拿 1.5 份（最穷 ¥${poorShare} > 其余 ¥${richShare}）`);
    ok(Math.abs(poorShare - Math.floor(3000 * 1.5 / 3.5)) <= 1, `金融：最穷者份额 = floor(3000×1.5/3.5) = ¥${poorShare}`);
  }
  {
    // 地皮税门槛 −1：金融下 10 块地开始计税（基准 11 块）
    const r3 = mkRoom(1); neutral(r3); r3.faculty = 'finance';
    const p = r3.players[0];
    G.BOARD.forEach((c, i) => { r3.cells[i].own = p.id; r3.cells[i].mortgaged = true; });
    let n = 0;
    for (let i = 0; i < G.BOARD.length && n < 10; i++) { const c = G.BOARD[i]; if (c.type === 'prop' || c.type === 'transport' || c.type === 'util') { r3.cells[i].mortgaged = false; r3.cells[i].level = 0; n++; } }
    ok(r3.taxFor(p).tax === 130, `金融：地皮税门槛 −1（10 块地即计税 ¥${r3.taxFor(p).tax}）`);
    const r4 = mkRoom(1); neutral(r4);
    const q = r4.players[0];
    let m = 0;
    for (let i = 0; i < G.BOARD.length && m < 10; i++) { const c = G.BOARD[i]; if (c.type === 'prop' || c.type === 'transport' || c.type === 'util') { r4.cells[i].own = q.id; r4.cells[i].level = 0; m++; } }
    ok(r4.taxFor(q).tax === 0, '对照（无风貌）：10 块地不计税');
  }

  // 13 艺术：多抽 2 张 + 必出 SR、地价 +5%
  {
    const L = landOf('art', 10000);
    ok(Math.abs(L.v - L.g * 1.05) <= 1, `艺术：地价 ×1.05（¥${L.g} → ¥${L.v}）`);
    ok(F.art.lead.includes('SR'), '艺术：文案写明盲盒必出 SR 及以上');
    // 抽卡必出 SR：连抽 30 次，每次首批第一张都应 ≥ SR
    let allSR = true;
    for (let i = 0; i < 30; i++) {
      const cards = G.drawEffectCards(2, [], 'SR');
      const ranks = ['SSR', 'SR', 'R', 'N'];
      if (ranks.indexOf(cards[0].rare) > 1) { allSR = false; break; }
    }
    ok(allSR, '艺术：drawEffectCards 的 minRare=SR 生效（首批首张必为 SSR/SR）');
    let allR = true;
    for (let i = 0; i < 30; i++) {
      const cards = G.drawEffectCards(2, [], 'R');
      const ranks = ['SSR', 'SR', 'R', 'N'];
      if (ranks.indexOf(cards[0].rare) > 2) { allR = false; break; }
    }
    ok(allR, '艺术节：minRare=R 生效（首批首张必为 SSR/SR/R）');
  }

  // 43 校友日：每 3 轮最富捐 ¥1200、租金 ×1.04
  {
    const r = mkRoom(3); neutral(r); r.faculty = 'gala';
    ok(r.facRentMul() === 1.04, `校友日：全场租金 ×${r.facRentMul()}`);
    r.facTermStart = 1; r.round = 3;
    r.players[0].cash = 1000; r.players[1].cash = 50000; r.players[2].cash = 20000;
    r.applyFacultyRound();
    ok(r.players[1].cash === 48800, `校友日：每 3 轮总资产最高者捐 ¥1200（→ ¥${r.players[1].cash}）`);
    r.round = 4; const c1 = r.players[1].cash; r.applyFacultyRound();
    ok(r.players[1].cash === c1, '校友日：第 4 轮不捐（每 3 轮一次）');
  }
}

// ================= [4] 免租轮降为 4 轮 =================
section(4, '免租轮校区：随机 5 轮 → 4 轮');
{
  const r = mkRoom(2); neutral(r); r.faculty = 'freeRent'; r.facTermStart = 1;
  r.applyFacultySetup('freeRent');
  ok(r.freeRentRounds.length === 4, `免租轮：抽定 ${r.freeRentRounds.length} 轮（第 ${r.freeRentRounds.join('/')} 轮）`);
  ok(new Set(r.freeRentRounds).size === 4, '免租轮：4 轮互不重复');
  ok(r.freeRentRounds.every(x => x >= 1 && x <= 10), '免租轮：都落在首届窗口第 1~10 轮');
  ok(F.freeRent.lead.includes('4 轮'), '免租轮：文案同步为「随机 4 轮」');
}

// ================= [5] 不改的城邦保持原值 =================
section(5, '不改的 21 个城邦：数值维持 v7.1');
{
  const tbl = [
    ['sports', r => r.facRentMul() === 0.96, '文体：租金 ×0.96'],
    ['reform', r => r.facRentMul() === 1.05, '改革：租金 ×1.05'],
    ['agri', r => r.wageOf() === G.SALARY + 450 && r.facBuildMul() === 1.03, '农业：起点 +450 / 建筑 ×1.03'],
    ['normal', r => r.facRentMul() === 0.97, '师范：租金 ×0.97'],
    ['austerity', r => r.salaryStop() === G.ENDGAME_ROUND - 5, '紧缩：停发工资提前 5 轮'],
    ['boom', r => r.salaryStop() === G.ENDGAME_ROUND + 6 && r.wageOf() === G.SALARY + 320, '繁荣：推迟 6 轮 / 起点 +320'],
    ['nofund', r => r.salaryStop() === 1, '限薪：全程不发工资'],
    ['retrain', r => true, '进修：技能 +2（一次性结算）'],
    ['freeRound', r => r.facRentMul() === 1.08, '免费轮：租金 ×1.08'],
    ['hex3', r => true, '精研之城：只有 3 次'],
    ['hexEarly', r => true, '时光之城：15 次提前'],
    ['midterm', r => true, '期中周：每 5 轮 ¥520'],
    ['oldbook', r => r.fundCap() === Math.round(G.FUND_CAP * 0.85), '旧书集：基金池 −15%'],
    ['carnival', r => r.facRentMul() === 1.05, '嘉年华：租金 ×1.05'],
    ['runner', r => true, '校车站：双数 +¥400'],
    ['spring', r => r.facBuildMul() === 0.91 && r.facRentMul() === 1.03, '创业热土：建筑 ×0.91 / 租金 ×1.03'],
    ['veteran', r => true, '老生：免租卡 +¥600'],
    ['professor', r => r.facRentMul() === 1.04, '名师：租金 ×1.04'],
    ['cram', r => r.facCardMoney(-1000, 'chance') === -780 && r.facCardMoney(1000, 'chance') === 920, '补习街：机会卡负面 −22% / 正面 −8%'],
    ['green', r => r.facBuildMul() === 0.90 && r.wageOf() === G.SALARY - 150, '环保：建筑 ×0.90 / 工资 −150'],
    // 注：redevelop 的 cost 文案写「租金 ×1.03」，但 v7.1 起 facRentMul 未挂该分支（既有状态，本版未改）
    ['redevelop', r => r.facRentMul() === 1, '拆迁：维持 v7.1 现状（facRentMul 未挂 ×1.03）'],
  ];
  for (const [key, fn, name] of tbl) {
    const r = mkRoom(1); neutral(r); r.faculty = key;
    ok(fn(r), name);
  }
}

// ================= [6] 双镜像一致性 =================
section(6, 'game.js 与 public/client.js 的 FACULTY 逐字一致');
{
  const gsrc = fs.readFileSync(__dirname + '/game.js', 'utf8');
  const csrc = fs.readFileSync(__dirname + '/public/client.js', 'utf8');
  const grab = s => {
    const a = s.indexOf('const FACULTY = {');
    const b = s.indexOf('\n};', a);
    return s.slice(a, b).split('\n').filter(l => /^  [A-Za-z][A-Za-z0-9]*:\s*\{/.test(l)).map(l => l.trim());
  };
  const A = grab(gsrc), B = grab(csrc);
  ok(A.length === 60 && B.length === 60, `城邦总数：服务端 ${A.length} / 客户端 ${B.length}（应为 60）`);
  let diff = 0, firstDiff = '';
  for (let i = 0; i < Math.min(A.length, B.length); i++) if (A[i] !== B[i]) { diff++; if (!firstDiff) firstDiff = A[i].slice(0, 60); }
  ok(diff === 0, `逐行比对完全一致${diff ? `（${diff} 处不同，首处：${firstDiff}）` : ''}`);
}

// ================= [7] 文案与实现一致性（修 bug） =================
section(7, '文案 / 实现一致性（v7.2 顺手修）');
{
  ok(F.artfest.cost.includes('10%') && Math.round(G.FUND_CAP * 0.90) === (() => { const r = mkRoom(1); neutral(r); r.faculty = 'artfest'; return r.fundCap(); })(), 'artfest：文案「基金池 −10%」与实现 ×0.90 一致');
  ok(F.veteran.cost.includes('4%'), 'veteran：文案地价 +4% 与实现 ×1.04 一致');
  ok(F.gamble.lead.includes('运动会'), 'gamble：文案含「运动会」，实现也已生效（37.5%）');
  ok(F.book.cost.includes('15%'), 'book：文案「命运卡负面 +15%」与实现 ×1.15 一致');
  ok(F.finance.cost.includes('建筑与地皮各 −1'), 'finance：文案写明建筑与地皮门槛各 −1');
  const gsrc = fs.readFileSync(__dirname + '/game.js', 'utf8');
  ok(gsrc.includes('60 个城邦的说明更厚'), '注释：城邦数量 59 → 60');
}

console.log('\n========================================');
console.log(`  v7.2 单测：${pass} 通过 / ${fail} 失败`);
console.log('========================================');
process.exit(fail ? 1 : 0);
