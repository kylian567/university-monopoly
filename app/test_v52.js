// test_v52.js —— 校园风貌（v5.2）引擎单测
// 覆盖：风貌表完整性 + 客户端镜像一致性、开局投票与随机抽取、60 个风貌各自的效果与代价、
//      免费轮 / 免租轮、免停留卡、以及"全风貌无异常结算"冒烟。
'use strict';
const fs = require('fs');
const path = require('path');
const {
  Room, BOARD, GROUPS, CHANCE, FACULTY, FACULTY_KEYS, MAJORS, SALARY, FUND_CAP, ENDGAME_ROUND,
} = require('./game.js');

let pass = 0, fail = 0, seed = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }

// 造一个"已经定好风貌"的房间：跳过投票，直接把 faculty 设好并跑一次开局结算
function mkRoom(n, majors, facKey) {
  const r = new Room('t' + (++seed), { faculty: true });
  for (let i = 0; i < n; i++) { const p = r.join('P' + (i + 1), i > 0); if (majors && majors[i]) p.major = majors[i]; }
  r.startedAt = Date.now();
  r.faculty = facKey || 'general';
  r.applyFacultySetup(r.faculty);
  for (const p of r.players) p.skillLeft = MAJORS[p.major].uses;
  r.phase = 'roll'; r.round = 1; r.season = 'mid'; r.weather = 'cloud'; r.calEvent = null; r.dice = [3, 4];
  r.afterResolve = () => {};   // 单元测试里不推进回合，避免被随机事件干扰
  return r;
}
const cur = r => r.players[r.cur];
const price = i => BOARD[i].price;
const firstProp = () => BOARD.findIndex(c => c.type === 'prop');
// 地价基准：用 general（facLandMul = 1）当作对照
const landOf = (k, p) => mkRoom(1, ['agri'], k).landCost(p);

console.log('========================================');
console.log('  v5.2 校园风貌 · 引擎单测');
console.log('========================================');

// ---------------- [1] 风貌表 ----------------
console.log('\n[1] 风貌表完整性 + 客户端镜像一致性');
{
  ok(FACULTY_KEYS.length === 60, `共 ${FACULTY_KEYS.length} 个校园风貌（预期 60 = 23 老 + 6 定调 + 30 娱乐 + 1 拆迁）`);
  const bad = FACULTY_KEYS.filter(k => !FACULTY[k].name || !FACULTY[k].icon || !FACULTY[k].color || !FACULTY[k].lead || !FACULTY[k].cost);
  ok(bad.length === 0, '每个风貌都有 name / icon / color / lead(主效果) / cost(代价)');
  const dupName = FACULTY_KEYS.map(k => FACULTY[k].name).filter((v, i, a) => a.indexOf(v) !== i);
  ok(dupName.length === 0, '风貌名称无重复');
  ok(!FACULTY_KEYS.includes('variable') && !FACULTY_KEYS.some(k => FACULTY[k].name.includes('变数')), '已按要求删去原「变数校区」');

  const cli = fs.readFileSync(path.join(__dirname, 'public', 'client.js'), 'utf8');
  const missingKey = FACULTY_KEYS.filter(k => !new RegExp('\\b' + k + "\\s*:\\s*\\{").test(cli));
  ok(missingKey.length === 0, `client.js 镜像包含全部 ${FACULTY_KEYS.length} 个风貌 key${missingKey.length ? '（缺 ' + missingKey.join(',') + '）' : ''}`);
  const missingName = FACULTY_KEYS.filter(k => !cli.includes("'" + FACULTY[k].name + "'") && !cli.includes('"' + FACULTY[k].name + '"'));
  ok(missingName.length === 0, 'client.js 里每个风貌的中文名与服务端一致（防止双份镜像对不上）');
  const missingLead = FACULTY_KEYS.filter(k => !cli.includes(FACULTY[k].lead));
  ok(missingLead.length === 0, 'client.js 里每个风貌的主效果文案与服务端一致');
}

// ---------------- [2] 投票 + 随机抽取 ----------------
console.log('\n[2] 开局投票 + 随机抽取（照搬"幸运儿"机制，非多数决）');
{
  const r = new Room('vote1', { faculty: true });
  r.join('A'); r.join('B', true); r.join('C', true);
  r.start();
  ok(r.phase === 'faculty', 'start() 后先进入风貌投票阶段');
  ok(r.facultyOptions.length === 3, `候选 3 个：${r.facultyOptions.join(' / ')}`);
  ok(new Set(r.facultyOptions).size === 3, '3 个候选互不重复');
  const k0 = r.facultyOptions[0];
  r.voteFaculty(r.players[0], k0);
  ok(r.facultyVotes['p1'] === k0, '真人投票已记录');
  r.voteFaculty(r.players[0], r.facultyOptions[1]);
  ok(r.facultyVotes['p1'] === k0, '同一玩家不能重复投票');
  // 给 AI 补票（测试里定时器不跑），最后一人投完会自动揭晓
  for (const q of r.players) if (!r.facultyVotes[q.id]) r.voteFaculty(q, r.facultyOptions[1]);
  ok(!!r.faculty, `已揭晓本局风貌：${FACULTY[r.faculty].name}`);
  const lucky = r.players.find(q => q.id === r.facultyLucky);
  ok(!!lucky, `随机抽中的玩家：${lucky && lucky.name}`);
  ok(r.facultyVotes[lucky.id] === r.faculty, '本局风貌 == 被抽中玩家的那一票（随机抽取）');
  ok(r.round === 1 && (r.phase === 'roll' || r.phase === 'skill'), `揭晓后直接进入第 1 轮（当前阶段 ${r.phase}）`);
  ok(Object.keys(r.facultyVotes).length === 3, '所有玩家都有票（未投者由系统补票）');
  r.clearTimer(); r.clearAiTimers();
}

// ---------------- [3] 都市校区 ----------------
console.log('\n[3] 都市校区：工资 ¥2250 / 地价 +3%');
{
  const r = mkRoom(2, ['agri', 'agri'], 'urban');
  ok(r.wageOf() === SALARY + 250, `起点工资 ¥${r.wageOf()}（基准 ¥${SALARY}）`);
  const g = landOf('general', 10000), u = landOf('urban', 10000);
  ok(Math.abs(u - g * 1.03) <= 1, `地价 +3%：¥${g} → ¥${u}`);
}

// ---------------- [4] 园林校区 ----------------
console.log('\n[4] 园林校区：地价 −4% / 工资 ¥1800');
{
  const r = mkRoom(2, ['agri', 'agri'], 'garden');
  const g = landOf('general', 10000), v = landOf('garden', 10000);
  ok(Math.abs(v - g * 0.96) <= 1, `地价 −4%：¥${g} → ¥${v}`);
  ok(r.wageOf() === 1800, `起点工资 ¥${r.wageOf()}`);
}

// ---------------- [5] 百年学府 ----------------
console.log('\n[5] 百年学府：每 3 轮 ¥300 捐款 / 前 3 轮租金 ×0.93');
{
  const r = mkRoom(2, ['agri', 'agri'], 'ancient');
  ok(r.facRentMul() === 0.93, '第 1~3 轮租金 ×0.93');
  r.round = 4;
  ok(r.facRentMul() === 1, '第 4 轮起租金恢复');
  r.round = 3;
  const before = r.players.map(p => p.cash);
  r.applyFacultyRound();
  ok(r.players.every((p, i) => p.cash === before[i] + 300), '第 3 轮校友捐款到账：全场 +¥300');
  const b2 = r.players.map(p => p.cash);
  r.round = 4; r.applyFacultyRound();
  ok(r.players.every((p, i) => p.cash === b2[i]), '第 4 轮不发捐款（每 3 轮一次）');
}

// ---------------- [6] 理工校区 ----------------
console.log('\n[6] 理工校区：升级费 −8% / 卡牌收益 −7%');
{
  const r = mkRoom(2, ['agri', 'agri'], 'tech');
  ok(r.facBuildMul() === 0.92, '建筑升级费 ×0.92');
  ok(r.facCardMoney(1000, 'chance') === 930, `机会卡 ¥1000 → ¥${r.facCardMoney(1000, 'chance')}（−7%）`);
  ok(r.facCardMoney(-1000, 'fate') === -930, `命运卡 −¥1000 → ¥${r.facCardMoney(-1000, 'fate')}（少损 7%）`);
}

// ---------------- [7] 综合校区 ----------------
console.log('\n[7] 综合校区：正面卡 +¥200 / 负面卡少损 ¥200');
{
  const r = mkRoom(2, ['agri', 'agri'], 'general');
  ok(r.facCardMoney(1000, 'chance') === 1200, `正面卡 ¥1000 → ¥${r.facCardMoney(1000, 'chance')}`);
  ok(r.facCardMoney(-1000, 'fate') === -800, `负面卡 −¥1000 → ¥${r.facCardMoney(-1000, 'fate')}`);
  ok(r.facCardMoney(-100, 'fate') === 0, '小额负面卡最多减免到 0（不会倒赚）');
}

// ---------------- [8] 商科校区 ----------------
console.log('\n[8] 商科校区：抵押 58% / 赎回 +8% 手续费');
{
  const r = mkRoom(1, ['agri'], 'biz');
  const p = cur(r); p.cash = 30000;
  const ci = firstProp();
  r.cells[ci].own = p.id; r.cells[ci].level = 0;
  r.phase = 'raise'; r.raise = { pid: p.id, need: 999999, creditor: null, toPool: false };
  const c0 = p.cash; r.mortgage(p, ci);
  const got = p.cash - c0;
  ok(got === Math.floor(price(ci) * 0.58), `抵押得 ¥${got}（地价 ${price(ci)} × 58%）`);
  r.round = 3;   // 熬过两轮赎回锁
  const c1 = p.cash; r.redeem(p, ci);
  const paid = c1 - p.cash;
  ok(paid === Math.round(Math.floor(price(ci) * 0.58) * 1.08), `赎回付 ¥${paid}（含 8% 手续费）`);
  ok(r.cells[ci].mortgaged === false, '赎回后抵押状态解除');
}

// ---------------- [9] 国际校区 ----------------
console.log('\n[9] 国际校区：岔路奖励 ×1.12 / 长廊门槛降到 1 块地');
{
  const r = mkRoom(1, ['agri'], 'intl');
  ok(r.facBranch(1000) === 1120, `岔路奖励 ¥1000 → ¥${r.facBranch(1000)}`);
  const p = cur(r);
  r.cells[firstProp()].own = p.id;   // 只有 1 块地
  p.pos = BOARD.findIndex(c => c.type === 'junction');
  r.phase = 'resolving';
  r.resolveCell(p);
  ok(r.phase === 'branch', '持有 1 块地即可触发长廊入口询问（基准需 2 块）');
  r.clearTimer();
}

// ---------------- [10] 文体校区 ----------------
console.log('\n[10] 文体校区：赌注 ×1.2 / 每轮首次重投 8 折 ¥640 / 租金 ×0.96');
{
  const r = mkRoom(2, ['agri', 'agri'], 'sports');
  const p = cur(r);
  p.rerollUsed = false;
  ok(r.rerollCostFor(p) === 640, `每轮首次重投 8 折 ¥${r.rerollCostFor(p)}（基准 ¥800）`);
  p.rerollUsed = true;
  ok(r.rerollCostFor(p) === 800, `本回合再次重投恢复基准价 ¥${r.rerollCostFor(p)}`);
  ok(r.facRentMul() === 0.96, '全场租金 ×0.96');
  // 擂台赌注
  const ci = BOARD.findIndex(c => c.type === 'duel');
  const q = r.players[1]; q.cash = 20000; p.cash = 20000;
  let stake = 0;
  for (let i = 0; i < 40 && !stake; i++) {
    r.events = [];
    r.dice = [3, 4]; r.phase = 'resolving'; r.cur = 0; p.pos = ci;
    r.resolveCell(p);
    const d = r.events.find(e => e.t === 'duel' && e.amount > 0);
    if (d) stake = d.amount;
  }
  ok(stake === 1800 || stake === 0, `擂台赌注 ¥1800（1500 × 1.2）${stake === 0 ? '（本轮未分出胜负，跳过）' : ''}`);
}

// ---------------- [11] 金融校区 ----------------
console.log('\n[11] 金融校区：池上限 ¥25000 / 每轮注资 ¥500 / 税基门槛降 1');
{
  const r = mkRoom(2, ['agri', 'agri'], 'finance');
  ok(r.fundCap() === 25000, `基金池上限 ¥${r.fundCap()}（基准 ¥${FUND_CAP}）`);
  r.fundPool = 0; r.applyFacultyRound();
  ok(r.fundPool === 500, `银行每轮自动注资 ¥${r.fundPool}`);
  // v6.0 分档税：6 块地 / 9 级建筑，门槛 6（金融降为 5）→ 每栋 ¥130，5 栋起征 = ¥650
  const p = cur(r); p.cash = 30000;
  BOARD.map((c, i) => i).filter(i => BOARD[i].type === 'prop').slice(0, 6)
    .forEach((i, k) => { r.cells[i].own = p.id; r.cells[i].level = k < 3 ? 2 : 1; });
  r.round = 2; r.collectTax();
  const tax = 30000 - p.cash;
  ok(tax === 650, `税基门槛降 1（≥5 即计税）：缴税 ¥${tax}（5 栋 × ¥130）`);
}

// ---------------- [12] 改革校区 ----------------
console.log('\n[12] 改革校区：每轮 +¥300 / 租金 ×1.06');
{
  const r = mkRoom(2, ['agri', 'agri'], 'reform');
  ok(r.facRentMul() === 1.06, '全场租金 ×1.06');
  const before = r.players.map(p => p.cash);
  r.applyFacultyRound();
  ok(r.players.every((p, i) => p.cash === before[i] + 300), '全场每轮开局 +¥300');
}

// ---------------- [13] 医学校区 ----------------
console.log('\n[13] 医学校区：大额租金减免 10% / 罚款类 +20%');
{
  const r = mkRoom(2, ['agri', 'agri'], 'med');
  ok(r.facFine(1200) === 1440, `补考费 ¥1200 → ¥${r.facFine(1200)}`);
  ok(r.facFine(800) === 960, `学费 ¥800 → ¥${r.facFine(800)}`);
  // 大额租金：造一块旅馆让租金 ≥1500
  const owner = r.players[0], pay = r.players[1];
  pay.cash = 60000; owner.cash = 60000;
  const idx = firstProp();
  r.cells[idx].own = owner.id; r.cells[idx].level = 4;
  const raw = r.calcRent(idx, [3, 4]);
  r.dice = [3, 4]; r.cur = 1; pay.pos = idx; r.phase = 'resolving';
  const c0 = pay.cash;
  r.resolveCell(pay);
  const paid = c0 - pay.cash;
  ok(raw >= 1500 ? paid === Math.round(raw * 0.9) : paid === raw, `被收租 ¥${raw} → 实付 ¥${paid}（减免 10%）`);
}

// ---------------- [14] 农业校区 ----------------
console.log('\n[14] 农业校区：过起点额外 +¥300 / 升级费 +3%');
{
  const r = mkRoom(2, ['agri', 'agri'], 'agri');
  ok(r.wageOf() === SALARY + 300, `过起点 ¥${r.wageOf()}（工资 ¥${SALARY} + 额外 ¥300）`);
  ok(r.facBuildMul() === 1.03, '建筑升级费 ×1.03');
}

// ---------------- [15] 艺术校区 ----------------
console.log('\n[15] 艺术校区：效果卡多抽 1 张 / 地价 +4%');
{
  const r = mkRoom(1, ['agri'], 'art');
  const p = cur(r);
  p.pos = BOARD.findIndex(c => c.type === 'jail');
  r.phase = 'resolving'; r.events = [];
  r.resolveCell(p);
  const ev = r.events.find(e => e.t === 'draw');
  ok(ev && ev.n >= 2, `校园商城盲盒抽到 ${ev && ev.n} 张（基准 1~2 张，艺术校区 +1）`);
  const g = landOf('general', 10000), a = landOf('art', 10000);
  ok(Math.abs(a - g * 1.04) <= 1, `地价 +4%：¥${g} → ¥${a}`);
}

// ---------------- [16] 科技园区 ----------------
console.log('\n[16] 科技园区：科研返还 +20% / 机会卡 −10%');
{
  const r = mkRoom(1, ['agri'], 'park');
  const p = cur(r); p.cash = 30000;
  p.pos = BOARD.findIndex(c => c.type === 'invest');
  r.phase = 'resolving';
  r.resolveCell(p);
  ok(r.pendingInvest && r.pendingInvest.back === 3600, `科研立项 2 轮后返还 ¥${r.pendingInvest && r.pendingInvest.back}（基准 ¥3000）`);
  r.clearTimer();
  ok(r.facCardMoney(1000, 'chance') === 900, `机会卡 ¥1000 → ¥${r.facCardMoney(1000, 'chance')}（−10%）`);
  ok(r.facCardMoney(1000, 'fate') === 1000, '命运卡收益不受影响（只砍机会卡）');
}

// ---------------- [17] 师范校区 ----------------
console.log('\n[17] 师范校区：每 10 轮发免停留卡 / 免停留卡抵消停留');
{
  const r = mkRoom(2, ['agri', 'agri'], 'normal');
  ok(r.facRentMul() === 0.97, '全场租金 ×0.97');
  r.round = 10; r.applyFacultyRound();
  ok(r.players.every(p => p.stayFree === 1), '第 10 轮全场各领 1 张「免停留卡」');
  const p = r.players[0];
  const stayed = r.applyStay(p, 1, '挂科留级');
  ok(stayed === false && p.stayFree === 0, '免停留卡抵消一次停留');
  const stayed2 = r.applyStay(p, 1, '再来一次');
  ok(stayed2 === true && p.skipTurns >= 1, '卡用完后照常被停留');
  const p2 = r.players[1];
  p2.stayFree = 1;
  p2.pos = BOARD.findIndex(c => c.type === 'gojail');
  r.phase = 'resolving'; r.dice = [3, 4];
  const c0 = p2.cash;
  r.resolveCell(p2);
  ok(p2.stayFree === 0 && c0 - p2.cash === 1200, '挂科留级：免停留卡免掉停留，但补考费照付');
}

// ---------------- [18] 书香校区 ----------------
console.log('\n[18] 书香校区：机会卡 +¥250 / 命运卡负面 +10%');
{
  const r = mkRoom(1, ['agri'], 'book');
  const p = cur(r);
  ok(r.facCardMoney(-1000, 'fate') === -1100, `命运卡 −¥1000 → ¥${r.facCardMoney(-1000, 'fate')}`);
  r.events = [];
  r.drawCard(p, CHANCE, 'chance');
  const bonus = r.events.filter(e => e.t === 'money' && e.reason === '书香校区').reduce((s, e) => s + e.amount, 0);
  ok(bonus === 250, `抽到机会卡额外 +¥${bonus}`);
}

// ---------------- [19] 生活区校区 ----------------
console.log('\n[19] 生活区校区：公用事业/机场 ×0.92 / 地价 +3%');
{
  const r = mkRoom(2, ['agri', 'agri'], 'life');
  const owner = r.players[0];
  const ui = BOARD.findIndex(c => c.type === 'util');
  const ti = BOARD.findIndex(c => c.type === 'transport');
  r.cells[ui].own = owner.id; r.cells[ti].own = owner.id;
  const utilRent = r.calcRent(ui, [3, 4]);
  ok(utilRent === Math.round(7 * 100 * 0.92), `公用事业租金（1 家 ×100）= ¥${utilRent}（已 ×0.92）`);
  const trRent = r.calcRent(ti, [3, 4]);
  ok(trRent === Math.round(800 * 0.92), `机场路费（1 座 ¥800，v5.9）= ¥${trRent}（已 ×0.92）`);
  const g = landOf('general', 10000), l = landOf('life', 10000);
  ok(Math.abs(l - g * 1.03) <= 1, `地价 +3%：¥${g} → ¥${l}`);
  // 对照：普通风貌下不加成
  const r2 = mkRoom(2, ['agri', 'agri'], 'general');
  r2.cells[ui].own = r2.players[0].id; r2.cells[ti].own = r2.players[0].id;
  ok(r2.calcRent(ui, [3, 4]) === 700 && r2.calcRent(ti, [3, 4]) === 800, '对照（综合校区）：文印 ¥700 / 机场 ¥800（v5.9）');
}

// ---------------- [20] 紧缩校区 ----------------
console.log('\n[20] 紧缩校区：免征物业税 / 提前 5 轮停发工资');
{
  const r = mkRoom(2, ['agri', 'agri'], 'austerity');
  ok(r.salaryStop() === ENDGAME_ROUND - 5, `停发工资轮次：第 ${r.salaryStop()} 轮（基准第 ${ENDGAME_ROUND} 轮）`);
  r.round = ENDGAME_ROUND - 5;
  ok(r.salaryOn() === false, `第 ${r.round} 轮起不再发工资`);
  r.round = ENDGAME_ROUND - 5 - 1;
  ok(r.salaryOn() === true, '第 9 轮仍正常发工资');
  const p = cur(r); p.cash = 30000;
  BOARD.map((c, i) => i).filter(i => BOARD[i].type === 'prop').slice(0, 8)
    .forEach((i, k) => { r.cells[i].own = p.id; r.cells[i].level = k < 4 ? 2 : 1; });
  r.collectTax();
  ok(p.cash === 30000, '本局免征物业税：大户也不缴税');
}

// ---------------- [21] 繁荣校区 ----------------
console.log('\n[21] 繁荣校区：推迟 5 轮停发 / 过起点额外 +¥200 / 地价 +6%');
{
  const r = mkRoom(2, ['agri', 'agri'], 'boom');
  ok(r.salaryStop() === ENDGAME_ROUND + 5, `停发工资推迟到第 ${r.salaryStop()} 轮`);
  r.round = ENDGAME_ROUND;
  ok(r.salaryOn() === true, `第 ${ENDGAME_ROUND} 轮（基准的停发点）仍在发工资`);
  ok(r.wageOf() === SALARY + 200, `过起点 ¥${r.wageOf()}`);
  const g = landOf('general', 10000), b = landOf('boom', 10000);
  ok(Math.abs(b - g * 1.06) <= 1, `地价 +6%：¥${g} → ¥${b}`);
}

// ---------------- [22] 限薪校区 ----------------
console.log('\n[22] 限薪校区：全程停发工资 / 地价 −12%、升级费 −10%');
{
  const r = mkRoom(2, ['agri', 'agri'], 'nofund');
  ok(r.salaryStop() === 1, `停发工资：第 ${r.salaryStop()} 轮起（即全程不发）`);
  ok(r.salaryOn() === false, '第 1 轮起就不发工资');
  ok(r.facLandMul() === 0.88, '地价 ×0.88（−12%）');
  ok(r.facBuildMul() === 0.90, '升级费 ×0.90（−10%）');
}

// ---------------- [23] 进修校区 ----------------
console.log('\n[23] 进修校区：开局所有人技能次数 +1');
{
  const r = new Room('rt1', { faculty: true });
  r.join('A'); r.join('B');
  r.players[0].major = 'mech'; r.players[1].major = 'cs';
  for (const p of r.players) p.skillLeft = MAJORS[p.major].uses;
  const before = r.players.map(p => p.skillLeft);
  r.applyFacultySetup('retrain');
  ok(r.players.every((p, i) => p.skillLeft === before[i] + 1),
    `技能次数 ${before.join('/')} → ${r.players.map(p => p.skillLeft).join('/')}`);
}

// ---------------- [24] 免费轮校区 ----------------
console.log('\n[24] 免费轮校区：随机 1 轮买地、盖楼免费');
{
  const r = mkRoom(1, ['agri'], 'freeRound');
  ok(r.freeRound >= 1 && r.freeRound <= 10, `抽中免费轮：第 ${r.freeRound} 轮（首届窗口 1~10，v5.9）`);
  r.round = 1;
  ok(r.isFreeRound() === (r.freeRound === 1), `第 1 轮免费判定与抽中轮次一致（抽中第 ${r.freeRound} 轮）`);
  r.round = r.freeRound;
  ok(r.isFreeRound() === true, `第 ${r.round} 轮进入免费轮`);
  const p = cur(r);
  const ci = firstProp();
  p.pos = ci; r.phase = 'resolving'; r.cells[ci].own = null;
  r.resolveCell(p);
  ok(r.pendingBuy && r.pendingBuy.price === 0, `免费轮买地价格 ¥${r.pendingBuy && r.pendingBuy.price}`);
  // 盖楼免费
  r.pendingBuy = null;
  r.cells[ci].own = p.id; r.cells[ci].level = 1;
  r.phase = 'build';
  r.pendingBuild = { pid: p.id, cell: ci, cost: r.seasonCost(GROUPS[BOARD[ci].g].build) };
  const c0 = p.cash; r.build(p);
  ok(p.cash === c0 && r.cells[ci].level === 2, `免费轮盖楼不花钱（Lv2，现金仍 ¥${p.cash}）`);
  // 非免费轮照常收费
  r.round = r.freeRound + 1; r.cells[ci].level = 2;
  r.phase = 'build';
  r.pendingBuild = { pid: p.id, cell: ci, cost: r.seasonCost(GROUPS[BOARD[ci].g].build) };
  const c1 = p.cash; r.build(p);
  ok(p.cash < c1, `第 ${r.round} 轮（非免费轮）盖楼正常扣费 ¥${c1 - p.cash}`);
  ok(r.facRentMul() === 1.08, '代价：全场租金 ×1.08');
}

// ---------------- [25] 免租轮校区 ----------------
console.log('\n[25] 免租轮校区：随机 4 轮全场免租');
{
  const r = mkRoom(2, ['agri', 'agri'], 'freeRent');
  ok(r.freeRentRounds.length === 4, `抽中 4 个免租轮：第 ${r.freeRentRounds.join(' / ')} 轮`);
  ok(new Set(r.freeRentRounds).size === 4, '4 个免租轮互不重复');
  ok(r.freeRentRounds.every(x => x >= 1 && x <= 10), '免租轮都落在首届窗口第 1~10 轮之间（v5.9）');
  ok(r.facRentMul() === 1.05, '代价：其余轮次租金 ×1.05');
  const owner = r.players[0], pay = r.players[1];
  pay.cash = 20000;
  const ci = firstProp();
  r.cells[ci].own = owner.id;
  r.cur = 1; r.dice = [3, 4];
  r.round = r.freeRentRounds[0];
  const c0 = pay.cash;
  r.phase = 'resolving'; pay.pos = ci;
  r.resolveCell(pay);
  ok(pay.cash === c0, `免租轮（第 ${r.round} 轮）踩到别人的地一分不付`);
  const other = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find(x => !r.freeRentRounds.includes(x));
  r.round = other;
  const c1 = pay.cash;
  r.phase = 'resolving';
  r.resolveCell(pay);
  ok(pay.cash < c1, `第 ${other} 轮（非免租轮）照常付租金 ¥${c1 - pay.cash}`);
}

// ---------------- [26] 全风貌冒烟 ----------------
console.log('\n[26] 60 个风貌全部无异常结算');
{
  const errs = [];
  for (const k of FACULTY_KEYS) {
    try {
      const r = mkRoom(3, ['agri', 'agri', 'agri'], k);
      r.wageOf(); r.facLandMul(); r.facBuildMul(); r.facRentMul(); r.fundCap();
      r.facBranch(1000); r.facFine(1000); r.rerollCostFor(cur(r));
      r.facCardMoney(1000, 'chance'); r.facCardMoney(-1000, 'fate');
      r.salaryStop(); r.salaryOn(); r.isFreeRound(); r.isFreeRentRound();
      r.round = 5; r.applyFacultyRound();
      const p = cur(r);
      p.pos = 0; r.phase = 'resolving'; r.resolveCell(p);       // 起点
      r.clearTimer(); r.clearAiTimers();
      r.round = k === 'freeRound' ? r.freeRound : 6;
      p.cash = 30000; p.pos = firstProp(); r.cells[firstProp()].own = null;
      r.phase = 'resolving'; r.resolveCell(p);                  // 无主地产
      r.clearTimer(); r.clearAiTimers();
    } catch (e) { errs.push(k + '(' + e.message + ')'); }
  }
  ok(errs.length === 0, `60 个风貌的关键结算路径全部无异常${errs.length ? ' —— ' + errs.join(' | ') : ''}`);
}

console.log('\n========================================');
console.log(`  结果：${pass} 通过 / ${fail} 失败`);
console.log('========================================');
process.exit(fail ? 1 : 0);
