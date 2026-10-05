#!/usr/bin/env node
// v7.1 单测：① 租金上调口径修正（只作用于「有建筑的租金」，裸地地皮不变）
//            ② 时光之城：15 次立项**全部**提前
//            ③ 双镜像一致性   ④ 海克斯选择流程的特效与动画结构
'use strict';
const fs = require('fs');
const G = require('./game');

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.error('  ✗ ' + name); } };
const section = (n, t) => console.log(`\n[${n}] ${t}`);

function mkRoom(n = 3, opts) {
  const room = new G.Room('v71' + Math.floor(Math.random() * 1e6), Object.assign({ hex: true, faculty: true, draft: true }, opts || {}));
  for (let i = 0; i < n; i++) room.join('P' + (i + 1), i > 0);
  room.start(); room.clearTimer(); room.clearAiTimers();
  return room;
}
// 中性环境：无风貌 / 无天气 / 无校历 / 无连击 —— 让乘子恒为 1，便于精确比对
function neutral(r) { r.faculty = null; r.season = 'mid'; r.weather = 'cloud'; r.calEvent = null; r.players.forEach(p => { p.combo = 0; }); }

// ================= [1] 租金上调口径（v7.1 修正） =================
section(1, '租金上调口径：只作用于「有建筑的租金」（1~3 栋房 / 旅馆），裸地地皮不变');
{
  const r = mkRoom(2); neutral(r);
  const a = r.players[0];
  const idx = G.BOARD.findIndex(c => c.type === 'prop');
  const gp = G.GROUPS[G.BOARD[idx].g];
  const base = G.BOARD[idx].rent, scl = base / gp.refRent;
  const g = G.BOARD[idx].g;

  // ① 裸地（未建房子）：维持 v6.0 的 ×1.3，不再 ×1.06
  r.cells[idx].own = a.id; r.cells[idx].level = 0;
  const bare = r.calcRent(idx, [2, 5]);
  ok(bare === Math.round(base * 1.3), `裸地租金 = ¥${bare}（${base}×1.3，不含 ×1.06）`);
  ok(bare !== Math.round(base * 1.3 * 1.06), '裸地租金没有被多乘 1.06（v7.0 的口径已修正）');

  // ② 垄断裸地：×2，同样不含 ×1.06
  G.BOARD.forEach((c, i) => { if (c.type === 'prop' && c.g === g) r.cells[i].own = a.id; });
  const mono = r.calcRent(idx, [2, 5]);
  ok(mono === Math.round(base * 2), `垄断裸地租金 = ¥${mono}（${base}×2，不含 ×1.06）`);

  // ③ 有建筑：1 / 2 / 3 栋房与旅馆，全部 ×1.06
  for (let lv = 1; lv <= 4; lv++) {
    r.cells[idx].level = lv;
    const want = Math.round(Math.round(gp.rents[lv - 1] * scl) * 1.06);
    const got = r.calcRent(idx, [2, 5]);
    ok(Math.abs(got - want) <= 1, `${lv === 4 ? '旅馆' : lv + ' 栋房'}租金 = ¥${got}（基准 ${Math.round(gp.rents[lv - 1] * scl)} ×1.06 = ${want}）`);
    ok(got > Math.round(gp.rents[lv - 1] * scl), `${lv === 4 ? '旅馆' : lv + ' 栋房'}确实比 v6.0 上调了`);
  }
  r.cells[idx].level = 0;

  // ④ 非地皮类不受影响
  const tIdx = G.BOARD.findIndex(c => c.type === 'transport');
  G.BOARD.forEach((c, i) => { if (c.type === 'transport') r.cells[i].own = null; });
  r.cells[tIdx].own = a.id;
  ok(r.calcRent(tIdx, [2, 5]) === 800, '机场（持 1 座）租金 ¥800 不受影响');
  const uIdx = G.BOARD.findIndex(c => c.type === 'util');
  G.BOARD.forEach((c, i) => { if (c.type === 'util') r.cells[i].own = null; });
  r.cells[uIdx].own = a.id;
  ok(r.calcRent(uIdx, [2, 5]) === 700, '公用事业（持 1 家 · 点数 7）租金 ¥700 不受影响');

  // ⑤ 盖房价上调保持不变
  ok(G.GROUPS.g1.build === 890 && G.GROUPS.g5.build === 2310 && G.GROUPS.g10.build === 4310,
    '盖房价 ×1.05 保持不变（g1 ¥890 / g5 ¥2310 / g10 ¥4310）');
}

// ================= [2] 时光之城：12 次全部提前 =================
section(2, '时光之城：12 次立项全部提前（2/6/12/19/27/35/44/54/65/77/89/101）');
{
  const E = G.HEX_TRIGGERS_EARLY, N = G.HEX_TRIGGERS;
  ok(E.length === 12 && N.length === 12, `两张表都是 12 次（提前 ${E.length} / 常规 ${N.length}）`);
  ok(JSON.stringify(E) === JSON.stringify([2, 6, 12, 19, 27, 35, 44, 54, 65, 77, 89, 101]),
    `提前表数值 = ${E.join('/')}`);
  ok(E.every((v, i) => i === 0 ? v === N[0] : v < N[i]),
    '12 项逐项早于常规表（第 1 次同为第 2 轮 —— 游戏从第 1 轮开始，无法更早）');
  ok(E.every((v, i, arr) => i === 0 || v > arr[i - 1]), '提前表严格递增（无重复、无回退）');
  ok(E[11] === 101 && N[11] === 110, `最后一次提前 9 轮（第 ${E[11]} 轮 vs 常规第 ${N[11]} 轮）`);
  ok(E.every((v, i, arr) => i === 0 || v - arr[i - 1] >= 4), '相邻两次间隔均 ≥4 轮（不挤在同一轮）');

  const F = G.FACULTY.hexEarly;
  ok(F.lead.includes('全部提前') && F.lead.includes('2/6/12'), `时光之城 lead 写明「全部提前」并列出轮次（${F.lead.slice(0, 24)}…）`);
  ok(F.cost.includes('101'), `时光之城 cost 随动：第 101 轮后无立项（${F.cost}）`);

  // 实跑：第 6 轮触发（常规要等第 8 轮）；第 8 轮在提前表里已不存在
  const r = mkRoom(3); r.applyFacultySetup('hexEarly'); r.hexDoneRounds = []; r.hexTiers = [];
  r.round = 6; r.phase = 'roll';
  ok(r.maybeProject() === true, '【时光之城】第 6 轮触发立项（常规表要到第 8 轮）');
  r.clearTimer(); r.clearAiTimers(); r.project = null; r.phase = 'roll';
  r.hexDoneRounds = []; r.hexTiers = []; r.round = 8;
  ok(r.maybeProject() === false, '【时光之城】第 8 轮不再触发（提前表里没有 8）');
  r.clearTimer(); r.clearAiTimers();

  const r2 = mkRoom(3); r2.hexDoneRounds = []; r2.hexTiers = []; r2.round = 8; r2.phase = 'roll';
  ok(r2.maybeProject() === true, '对照组：常规局第 8 轮照常触发');
  r2.clearTimer(); r2.clearAiTimers();
}

// ================= [3] 双镜像一致性 =================
section(3, '双镜像：game.js 与 public/client.js 的 FACULTY 时光之城条目逐字一致');
{
  const g = fs.readFileSync(__dirname + '/game.js', 'utf8');
  const c = fs.readFileSync(__dirname + '/public/client.js', 'utf8');
  const grab = s => (s.match(/hexEarly: \{[^\n]*\}/) || [''])[0];
  ok(grab(g).length > 0 && grab(g) === grab(c), '时光之城条目两处逐字一致');
  ok(!/hexEarly[^\n]*第 2\/5\/10/.test(g) && !/hexEarly[^\n]*第 2\/5\/10/.test(c), '旧的 2/5/10 文案已清除');
  ok(/第 101 轮后就再也没有立项机会/.test(g) && /第 101 轮后就再也没有立项机会/.test(c), '两处 cost 都是「第 101 轮后」');
}

// ================= [4] 海克斯选择流程：特效与动画结构 =================
section(4, '海克斯选择流程：特效与动画结构（v7.1 美化）');
{
  const c = fs.readFileSync(__dirname + '/public/client.js', 'utf8');
  const css = fs.readFileSync(__dirname + '/public/style.css', 'utf8');
  ['.hx-rays', '.hx-orbit', '.hx-badge', '.hx-sheen', '.hx-aura', '.hx-cand', '.hx-pillar', '.hx-stamp', '.hx-grant']
    .forEach(k => ok(css.includes(k), `CSS 已定义 ${k}`));
  ['hx-rays', 'hx-orbit', 'hx-badge', 'hx-pillar', 'hx-stamp', 'hx-grant', 'hg-seal']
    .forEach(k => ok(c.includes(k), `client.js 会渲染 ${k}`));
  ok(/silver: 10, gold: 14, prism: 20/.test(c), '背景放射光轴按档位：银 10 / 金 14 / 彩 20 条');
  ok(/hxBadge/.test(css) && /hxStamp/.test(css) && /hxPillar/.test(css) && /hxSeal/.test(css), '四个关键 keyframes 齐全（徽章/印章/光柱/印章）');
  ok(/\.hx-stamp\.on/.test(css) && /\.hx-pillar\.on/.test(css), '印章与光柱由 .on 类触发');
  ok(/hxOrbit/.test(css) && /hxRay\b/.test(css), '光环旋转与光轴呼吸动画已定义');
  ok(/querySelector\('\.hx-pillar'\)/.test(c) && /querySelector\('\.hx-stamp'\)/.test(c), '点击立项时依次点亮光柱 → 印章');
  ok(/confettiBurst\(46\)/.test(c) || /confettiBurst\(\d+\)/.test(c), '彩卡立项有彩带');
  ok(/\.hx-card:hover \.hx-aura/.test(css), '卡面悬停光晕');
}

console.log(`\n=== v7.1 单测：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail ? 1 : 0);
