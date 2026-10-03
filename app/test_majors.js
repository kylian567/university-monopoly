// v5.1 专业系统专项验证：33 个专业表完整性 + 主动技询问/发动/结算 + 被动技触发
'use strict';
const assert = require('assert');
const { Room, MAJORS, MAJOR_KEYS } = require('./game');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✅', name); }
  catch (e) { fail++; console.log('  ❌', name, '→', e.message); }
}

function mkRoom(majors) {
  const room = new Room('MAJ' + Math.floor(Math.random() * 900000 + 100000));
  for (let i = 0; i < majors.length; i++) room.join('P' + (i + 1), true);
  room.start();
  for (let i = 0; i < majors.length; i++) {
    room.players[i].major = majors[i];
    room.players[i].skillLeft = MAJORS[majors[i]].uses;
  }
  return room;
}

console.log('\n=== 1. 专业表完整性 ===');
t('MAJOR_KEYS 与 MAJORS 一一对应且无重复', () => {
  const keys = Object.keys(MAJORS);
  assert.strictEqual(keys.length, MAJOR_KEYS.length, `MAJORS=${keys.length} KEYS=${MAJOR_KEYS.length}`);
  assert.strictEqual(new Set(MAJOR_KEYS).size, MAJOR_KEYS.length, 'MAJOR_KEYS 有重复');
  for (const k of keys) assert.ok(MAJOR_KEYS.includes(k), `MAJOR_KEYS 缺 ${k}`);
});
t('每个专业字段齐全（id/name/icon/skill/mode/uses/fx/desc）', () => {
  for (const [k, m] of Object.entries(MAJORS)) {
    assert.strictEqual(m.id, k, `${k} id 不一致`);
    for (const f of ['name', 'icon', 'skill', 'desc', 'fx']) assert.ok(m[f], `${k} 缺 ${f}`);
    assert.ok(m.uses >= 1 && m.uses <= 6, `${k} uses 异常: ${m.uses}`);
    assert.ok(m.mode === 'active' || m.mode === 'passive', `${k} mode 异常: ${m.mode}`);
  }
});
t('主动技专业共 7 个（mech/newe/pharm/auto/mse/music/psych）', () => {
  const act = Object.values(MAJORS).filter(m => m.mode === 'active').map(m => m.id).sort();
  assert.deepStrictEqual(act, ['auto', 'mech', 'mse', 'music', 'newe', 'pharm', 'psych']);
});
t('个数达到 33 种', () => assert.strictEqual(Object.keys(MAJORS).length, 33));

console.log('\n=== 2. 主动技：每个主动技专业都能被询问并正确结算 ===');
const ACTIVE = ['mech', 'newe', 'pharm', 'auto', 'mse', 'music', 'psych'];
for (const key of ACTIVE) {
  t(`${MAJORS[key].name}·${MAJORS[key].skill} 询问→发动→效果生效`, () => {
    const room = mkRoom([key, 'agri']);
    const p = room.players[0];
    const opp = room.players[1];
    room.cur = 0;
    p.cash = 20000; p.skillLeft = MAJORS[key].uses;
    room.phase = 'roll'; room.pendingSkill = null; p.skillUsedThisTurn = false;
    const ok = room.openSkillPrompt(p);
    assert.strictEqual(ok, true, '未进入主动技询问');
    assert.strictEqual(room.phase, 'skill');
    assert.ok(room.pendingSkill && room.pendingSkill.pid === p.id);
    const cashBefore = p.cash;
    room.useSkill(p);
    assert.strictEqual(room.phase, 'roll', '发动后应回到 roll');
    assert.strictEqual(p.skillLeft, MAJORS[key].uses - 1, '次数未扣');
    // 各技能的具体断言
    if (key === 'mech') { assert.ok(p.cash >= cashBefore + 1500, 'mech 未 +1500'); assert.ok(p.buildCutTurn > 0, 'mech 未设盖房折扣'); }
    if (key === 'newe') { assert.ok(p.cash > cashBefore, 'newe 未加现金'); assert.ok(p.rentBuff > 0, 'newe 未设收租加成'); }
    if (key === 'pharm') { assert.ok(p.cash >= cashBefore + 600, 'pharm 未 +600'); assert.ok(p.defBuff > 0, 'pharm 未设减免'); }
    if (key === 'auto') { assert.ok(p.buffSteps >= 2, 'auto 未加步数'); assert.ok(p.autoBonus, 'auto 未开落点奖励'); }
    if (key === 'mse') { assert.ok(p.rentBuff >= 0.6, 'mse 未设收租加成'); }
    if (key === 'music') { assert.ok(p.cash >= cashBefore + 1000, 'music 未 +1000'); assert.ok(opp.cash < 30000, 'music 未让对手付费'); }
    if (key === 'psych') { assert.ok(p.cash > cashBefore, 'psych 未抽到钱'); }
    room.clearAiTimers(); room.clearTimer();
  });
}
t('主动技：跳过时不扣次数但本回合不再追问', () => {
  const room = mkRoom(['mech', 'agri']);
  const p = room.players[0];
  room.cur = 0; room.phase = 'roll'; p.skillUsedThisTurn = false; p.skillLeft = 4;
  room.openSkillPrompt(p);
  room.skipSkill(p);
  assert.strictEqual(p.skillLeft, 4, '跳过不应扣次数');
  assert.strictEqual(p.skillUsedThisTurn, true, '应标记本回合已询问');
  const again = room.openSkillPrompt(p);
  assert.strictEqual(again, false, '同回合不应再次询问');
  room.clearAiTimers(); room.clearTimer();
});
t('被动技专业 openSkillPrompt 直接跳过询问', () => {
  const room = mkRoom(['agri', 'mech']);
  const p = room.players[0];
  room.cur = 0; room.phase = 'roll';
  assert.strictEqual(room.openSkillPrompt(p), false);
  assert.strictEqual(room.phase, 'roll');
  room.clearAiTimers(); room.clearTimer();
});

console.log('\n=== 3. 主动技加成在收租时生效（rentBuff / defBuff） ===');
t('收租方 rentBuff 生效：租金被放大', () => {
  const room = mkRoom(['mse', 'agri']);
  const owner = room.players[0], victim = room.players[1];
  // 找一块 prop 给 owner
  const { BOARD } = require('./game');
  const idx = BOARD.findIndex(c => c.type === 'prop');
  room.cells[idx].own = owner.id; room.cells[idx].level = 2;
  owner.rentBuff = 0.6; owner.skillLeft = 0;
  const base = room.calcRent(idx, [3, 4]);
  victim.pos = idx; victim.cash = 50000;
  room.phase = 'resolving'; room.dice = [3, 4];
  room.cur = 1; room.resolveCell(victim);
  const paid = 50000 - victim.cash;
  assert.ok(paid > base, `收租未放大: base=${base} paid=${paid}`);
  room.clearAiTimers(); room.clearTimer();
});
t('付租方 defBuff 生效：租金被减免', () => {
  const room = mkRoom(['agri', 'pharm']);
  const owner = room.players[0], victim = room.players[1];
  const { BOARD } = require('./game');
  const idx = BOARD.findIndex(c => c.type === 'prop');
  room.cells[idx].own = owner.id; room.cells[idx].level = 2;
  owner.skillLeft = 0; owner.major = 'agri';
  victim.defBuff = 0.6; victim.skillLeft = 0;
  const base = room.calcRent(idx, [3, 4]);
  victim.pos = idx; victim.cash = 50000;
  room.phase = 'resolving'; room.dice = [3, 4];
  room.cur = 1; room.resolveCell(victim);
  const paid = 50000 - victim.cash;
  assert.ok(paid < base, `租金未减免: base=${base} paid=${paid}`);
  room.clearAiTimers(); room.clearTimer();
});

console.log('\n=== 4. 被动技抽样验证 ===');
t('微电子 过起点 +¥1400', () => {
  const room = mkRoom(['ee', 'agri']);
  const p = room.players[0]; p.cash = 10000; p.pos = 46; p.skillLeft = 3;
  room.weather = 'cloud'; room.phase = 'roll'; room.cur = 0; room.dice = [1, 1];
  room.execRoll(p);
  assert.ok(p.cash >= 10000 + 2000 + 1400, `ee 未生效: cash=${p.cash}`);
  room.clearAiTimers(); room.clearTimer();
});
t('农学 过起点 +¥1500', () => {
  const room = mkRoom(['agri', 'ee']);
  const p = room.players[0]; p.cash = 10000; p.pos = 46; p.skillLeft = 3;
  room.weather = 'cloud'; room.phase = 'roll'; room.cur = 0; room.dice = [1, 1];
  room.execRoll(p);
  assert.ok(p.cash >= 10000 + 2000 + 1500, `agri 未生效: cash=${p.cash}`);
  room.clearAiTimers(); room.clearTimer();
});
t('海洋科学 过起点 +¥1200', () => {
  const room = mkRoom(['marine', 'ee']);
  const p = room.players[0]; p.cash = 10000; p.pos = 46; p.skillLeft = 3;
  room.weather = 'cloud'; room.phase = 'roll'; room.cur = 0; room.dice = [1, 1];
  room.execRoll(p);
  assert.ok(p.cash >= 10000 + 2000 + 1200, `marine 未生效: cash=${p.cash}`);
  room.clearAiTimers(); room.clearTimer();
});
t('机械 常驻盖房 −10%（不消耗次数）', () => {
  const room = mkRoom(['mech', 'agri']);
  const p = room.players[0];
  const { BOARD, GROUPS } = require('./game');
  const idx = BOARD.findIndex(c => c.type === 'prop');
  room.cells[idx].own = p.id; room.cells[idx].level = 0;
  p.cash = 100000; p.skillLeft = 4;
  room.phase = 'build'; room.pendingBuild = { pid: p.id, cell: idx, cost: GROUPS[BOARD[idx].g].build };
  room.cur = 0;
  room.build(p);
  assert.strictEqual(room.cells[idx].level, 1);
  assert.strictEqual(p.skillLeft, 4, '常驻折扣不应消耗技能次数');
  room.clearAiTimers(); room.clearTimer();
});
t('食品科学 停留回合 +¥700', () => {
  const room = mkRoom(['food', 'agri']);
  const p = room.players[0]; p.cash = 10000; p.skipNext = true; p.skillLeft = 4;
  room.cur = 0;
  room.phase = 'roll';
  // 直接调 startTurn 触发停留分支
  room.startTurn();
  assert.ok(p.cash >= 10700, `food 未生效: cash=${p.cash}`);
  room.clearAiTimers(); room.clearTimer();
});
t('药学 主动技后 defBuff 在本轮内保持、下一次自己回合清零', () => {
  const room = mkRoom(['pharm', 'agri']);
  const p = room.players[0];
  room.cur = 0; room.phase = 'roll'; p.skillLeft = 3; p.skillUsedThisTurn = false;
  room.openSkillPrompt(p); room.useSkill(p);
  assert.ok(p.defBuff > 0);
  // 模拟一整轮后回到自己
  room.cur = 1; room.phase = 'roll'; room.startTurn();   // 对手回合不清理
  assert.ok(p.defBuff > 0, '对手回合不应清掉 defBuff');
  room.cur = 0; room.phase = 'roll'; room.startTurn();   // 自己回合清理
  assert.strictEqual(p.defBuff, 0, '自己回合应清掉 defBuff');
  room.clearAiTimers(); room.clearTimer();
});

console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail ? 1 : 0);
