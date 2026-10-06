// 离线模拟：4 AI 完整对局，验证规则闭环（无网络、无定时器）
'use strict';
const { Room, BOARD } = require('./game');

// 给 Room 挂一个"手动泵"，把定时逻辑变成同步驱动
function pump(room, maxSteps = 200000) {
  let steps = 0;
  while (room.phase !== 'over' && steps++ < maxSteps) {
    // 直接触发所有挂起的 AI 定时器
    const timers = room.aiTimers.splice(0);
    timers.forEach(clearTimeout);
    if (room.timer) { clearTimeout(room.timer); room.timer = null; }
    // AI 行动
    const p = room.curp();
    if (!p || !p.alive) { room.endTurn(); continue; }
    switch (room.phase) {
      case 'roll': room.doRoll(p); break;
      case 'reroll': p.isAI ? room.aiReroll(p) : room.confirmRoll(p); break;
      case 'buy': p.isAI ? room.aiBuy() : room.declineBuy(p); break;
      case 'build': p.isAI ? room.aiBuild() : room.skipBuild(p); break;
      case 'branch': p.isAI ? room.aiBranch(p) : room.declineBranch(p); break;
      case 'invest': p.isAI ? room.aiInvest(p) : room.declineInvest(p); break;
      case 'skill': p.isAI ? room.aiSkill(p) : room.skipSkill(p); break;
      // v7.0：手动效果卡 —— 待决策者可能是非当前玩家，按 pid 定位
      case 'card': {
        const pc = room.pendingCard;
        const t = pc ? room.players.find(q => q.id === pc.pid) : null;
        if (t) { t.isAI ? room.aiCard(t) : room.skipCard(t); }
        break;
      }
      // v7.0：无懈可击响应 —— 响应方是「被攻击者」而非当前玩家
      case 'negate': {
        const pn = room.pendingNegate;
        const t = pn ? room.players.find(q => q.id === pn.pid) : null;
        if (t) { t.isAI ? room.aiNegate(t, pn.card) : room.useNegate(t, false); }
        break;
      }
      // v7.6：时机询问（加速 / 反向 / 后退 / 强制重投 / 租金翻倍 / 减半 / 万能 / 兵粮寸断）
      case 'ask': {
        const pa = room.pendingAsk;
        const t = pa ? room.players.find(q => q.id === pa.pid) : null;
        if (t) { t.isAI ? room.aiTiming(t) : room.answerTimingBy(t, false); }
        else room.answerTiming(false);
        break;
      }
      case 'auction': room.endAuction(); break;
      // v7.0：海克斯奖励卡「三张翻面卡」—— 全员各自选，选完自动结算
      case 'carddraft': {
        const dr = room.draft;
        if (!dr) { room.settleDraft(); break; }
        const t = room.alive().find(q => dr.picks[q.id] == null);
        if (!t) { room.settleDraft(); break; }
        t.isAI ? room.aiDraft(t) : room.pickDraftCard(t, 0);
        break;
      }
      case 'raise': room.forceSettleRaise(); break;
      case 'resolving': /* doRoll 中 setTimeout(resolveCell) —— 同步替代 */ break;
      default: room.endTurn();
    }
    // doRoll 用了 setTimeout(resolveCell,0)：在泵里手动触发
    drainResolve(room);
  }
  return steps;
}
const origDoRoll = Room.prototype.doRoll;
Room.prototype.doRoll = function (p) {
  const r = origDoRoll.call(this, p);
  return r;
};
function drainResolve(room) { /* resolveCell 已通过 setTimeout(0) 同步执行 */ }

// 把 setTimeout 换成同步执行（仅 resolveCell 用到）
const _setTimeout = global.setTimeout;
global.setTimeout = function (fn, ms) {
  // game.js 中只有 resolveCell 用 setTimeout(0)，AI/回合定时器在 pump 中手动清理
  if (ms === 0) { fn(); return 0; }
  return _setTimeout(fn, 1);
};

const room = new Room('000001', { faculty: true, hex: true, draft: true });
for (let i = 0; i < 4; i++) room.join('AI' + (i + 1), true);
room.start();
const steps = pump(room);
console.log('=== 模拟结束 ===');
console.log('phase:', room.phase, '| 步数:', steps, '| 回合:', room.round);
console.log('log 条数:', room.log.length);
room.players.forEach(p => console.log(`${p.name} alive=${p.alive} cash=${p.cash} pos=${p.pos}`));
const last = room.log.slice(-5);
last.forEach(l => console.log('·', l.msg));
if (room.phase !== 'over') { console.error('❌ 对局未正常结束'); process.exit(1); }
console.log('✅ 模拟通过');
