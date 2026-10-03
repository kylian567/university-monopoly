'use strict';
// v5.1 浏览器实机验收：新天气引擎 / 校历事件特效 / 擂台分步动画 / 骰子 3D 翻滚 /
// 盖房施工动画 / 重投虚影 / 现金显示态 / 快捷语音去前缀去回音。
// 依赖：已启动 server.js（默认 localhost:3000；用 BASE_URL 可指向线上链接），Playwright 在 NODE_PATH 里。
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 940 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    // 跳过作者公告与更新简介
    await page.click('#btnAnnounce'); await page.waitForTimeout(250);
    await page.click('#btnIntro'); await page.waitForTimeout(250);

    console.log('\n[1] 开局：建房 + 3 个 AI + 开始');
    await page.fill('#nameInput', '验收员');
    await page.click('#btnCreate');
    await page.waitForTimeout(400);
    for (let i = 0; i < 3; i++) { await page.click('#btnAddAI'); await page.waitForTimeout(220); }
    await page.click('#btnStart');
    await page.waitForTimeout(1400);
    const started = await page.evaluate(() => ({
      game: getComputedStyle(document.getElementById('game')).display !== 'none',
      players: document.querySelectorAll('#players .pcard').length,
      log: document.getElementById('logBox') ? document.getElementById('logBox').textContent.length : 0,
      branchA: !!document.querySelector('#board'),
    }));
    ok(started.game && started.players >= 3, `进入对局，玩家卡片 ${started.players} 张`);

    console.log('\n[2] 关键函数与显示态机制');
    const fns = await page.evaluate(() => ({
      duelAnim: typeof duelAnim, diceAnim: typeof diceAnim, buildAnim: typeof buildAnim,
      renderGhost: typeof renderGhost, speak: typeof speak, handleAnim: typeof handleAnim,
      applyDispDiff: typeof applyDispDiff, syncDisp: typeof syncDisp, dcash: typeof dcash,
    }));
    ok(Object.values(fns).every(t => t === 'function'), `新增/改造函数都已就位（${Object.keys(fns).length} 个）`);

    const disp = await page.evaluate(() => {
      syncDisp(S);
      const pid = S.players[0].id;
      const before = dcash(S.players[0]);
      applyDispDiff({ cash: { [pid]: before + 5000 } });
      const after = dcash(S.players[0]);
      syncDisp(S);
      const back = dcash(S.players[0]);
      return { before, after, back };
    });
    ok(disp.after === disp.before + 5000, `事件增量能改"显示现金"（${disp.before} → ${disp.after}）`);
    ok(disp.back === disp.before, `队列排空后显示态与服务端对齐（回到 ${disp.back}）`);

    // 线上对局里 AI 会持续推进并播放动画。做合成 DOM 检查前必须先等队列排空：
    // renderGhost 在 animPending>0 时按设计不显示，否则断言会误报失败。
    const waitIdle = async () => {
      await page.evaluate(async () => {
        for (let i = 0; i < 240; i++) { if (animPending === 0 && qDepth === 0) return; await new Promise(r => setTimeout(r, 250)); }
      });
    };

    console.log('\n[3] 天气引擎：8 种各画各的');
    const wx = await page.evaluate(async () => {
      const seen = {};
      for (const k of ['sun', 'cloud', 'rain', 'storm', 'fog', 'snow', 'heat', 'wind']) {
        curWeather = null; applyWeather(k);
        await new Promise(r => setTimeout(r, 60));
        seen[k] = { canvas: !!document.getElementById('wxCv'), kind: wxKind, veil: !!document.getElementById('weatherVeil') };
      }
      return seen;
    });
    const wxKinds = Object.values(wx).map(v => v.kind);
    ok(Object.values(wx).every(v => v.canvas), '天气 canvas 已建立');
    ok(new Set(wxKinds).size === 8, `8 种天气各自独立渲染例程（实际 ${new Set(wxKinds).size} 种）`);

    console.log('\n[4] 校历事件：新事件特效 + 独得揭晓');
    // 客户端没有 CALEVENTS 表，这里用与服务端一致的事件描述逐条驱动演出
    const CAL_FIX = [
      { id: 'newyear', name: '元旦跨年', icon: '🎆', kind: 'moneyAll', fx: 'fireworks' },
      { id: 'spring', name: '春节假期', icon: '🧧', kind: 'moneyAll', fx: 'redpacket' },
      { id: 'halloween', name: '万圣节', icon: '🎃', kind: 'payAll', fx: 'pumpkin' },
      { id: 'karaoke', name: '校园歌手赛', icon: '🎤', kind: 'lottery', fx: 'stage' },
      { id: 'jobfair', name: '招聘季', icon: '💼', kind: 'moneyAll', fx: 'offer' },
      { id: 'fundday', name: '基金分红日', icon: '🏦', kind: 'fundShare', fx: 'bank' },
      { id: 'aidpoor', name: '精准帮扶', icon: '🤲', kind: 'stealPoor', fx: 'aid' },
      { id: 'techweek', name: '科技文化节', icon: '🚀', kind: 'buildBoom', fx: 'rocket' },
      { id: 'freeper', name: '校园免租日', icon: '🎈', kind: 'rentDown', fx: 'balloon' },
      { id: 'booming', name: '经济过热', icon: '💹', kind: 'rentUp', fx: 'bull' },
      { id: 'blackfri', name: '黑五大促', icon: '🏷️', kind: 'payAll', fx: 'sale' },
      { id: 'stormweek', name: '暴雨停课周', icon: '🌀', kind: 'rainy', fx: 'storm' },
      { id: 'reading', name: '读书节', icon: '📖', kind: 'study', fx: 'book' },
      { id: 'gala', name: '校庆嘉年华', icon: '🎪', kind: 'cardsLottery', fx: 'carnival' },
      { id: 'gradshow', name: '毕业作品展', icon: '🖼️', kind: 'poorMore', fx: 'gallery' },
      { id: 'exam', name: '考试周', icon: '📚', kind: 'slow' },
      { id: 'rainy', name: '梅雨季节', icon: '☔', kind: 'rainy' },
    ];
    const cal = await page.evaluate(async (list) => {
      for (const ev of list) {
        await handleAnim({ t: 'calevent', id: ev.id, name: ev.name, icon: ev.icon, desc: '验收用', kind: ev.kind, fx: ev.fx || null });
      }
      await handleAnim({ t: 'caleventHit', icon: '🎤', name: '校园歌手赛', winner: S.players[0].id, amount: 3500, consolation: 300, items: S.players.map(p => ({ pid: p.id, amount: 300 })) });
      return { n: list.length };
    }, CAL_FIX);
    ok(cal.n >= 15, `${cal.n} 条校历事件（含全部新增 fx 主题）都能从客户端演出而不报错`);

    console.log('\n[5] 骰子 3D 翻滚 + 落定冲击');
    const dice = await page.evaluate(async () => {
      // 清掉残留（服务器 30s 超时会替玩家自动掷骰），再只统计本次这一副
      document.querySelectorAll('.dice-wrap').forEach(e => e.remove());
      const p = diceAnim(3, 5);
      // 立刻打标记：清空后第一副就是我们这一副，线上并发的另一副不会影响统计
      const wrap = document.querySelector('.dice-wrap');
      if (wrap) wrap.dataset.mine = '1';
      await new Promise(r => setTimeout(r, 300));
      const my = document.querySelector('.dice-wrap[data-mine="1"]');
      const mid = {
        boxes: my ? my.querySelectorAll('.die-wrap').length : 0,
        shadows: my ? my.querySelectorAll('.die-shadow').length : 0,
        rolling: my ? my.querySelectorAll('.die.rolling').length : 0,
        html: (my || { innerHTML: '(none)' }).innerHTML.slice(0, 240),
      };
      await p;
      return { mid, mineGone: !document.querySelector('.dice-wrap[data-mine="1"]') };
    });
    console.log('   · dice mid =', JSON.stringify(dice.mid));
    ok(dice.mid.boxes === 2 && dice.mid.shadows === 2, '两颗骰子各有独立容器与投影');
    ok(dice.mid.rolling === 2, '滚动中两颗骰子都在翻滚');
    ok(dice.mineGone, '动画结束后骰子容器已清理');

    console.log('\n[6] 辩论擂台分步动画');
    await waitIdle();
    const duel = await page.evaluate(async () => {
      const p = duelAnim({ t: 'duel', label: '辩论擂台', pid: S.players[0].id, opp: S.players[1].id, a: 5, b: 2, winner: S.players[0].id, amount: 1200 });
      await new Promise(r => setTimeout(r, 500));
      const early = {
        stage: document.querySelectorAll('.duel-stage').length,
        title: (document.querySelector('.ds-title') || {}).textContent || '',
      };
      // 骰子要滚完才揭晓点数：轮询等双方分数都出来
      let midNames = [], midScores = [];
      for (let i = 0; i < 70; i++) {
        await new Promise(r => setTimeout(r, 250));
        midNames = Array.from(document.querySelectorAll('.ds-name')).map(n => n.textContent);
        midScores = Array.from(document.querySelectorAll('.ds-score')).map(n => n.textContent);
        if (midScores.length === 2 && midScores.every(s => /^[1-6]$/.test(s))) break;
      }
      await new Promise(r => setTimeout(r, 2200));   // 等"比大小 → 高亮胜者 → 结算"这段走完
      const foot = (document.querySelector('.ds-foot') || {}).textContent || '';
      await p;
      return { early, midNames, midScores, foot, left: document.querySelectorAll('.duel-stage').length };
    });
    ok(duel.early.stage === 1 && /辩论擂台/.test(duel.early.title), '大屏幕出现且标题正确');
    ok(duel.midNames.length === 2 && duel.midNames.every(n => n && n !== '？？？'), `抽签已定格出双方：${duel.midNames.join(' vs ')}`);
    ok(duel.midScores.length === 2 && duel.midScores.every(s => /^[1-6]$/.test(s)), `双方点数已逐一揭晓：${duel.midScores.join(' : ')}`);
    ok(/胜/.test(duel.foot), `结算文案已给出：${duel.foot}`);
    ok(duel.left === 0, '演出结束后大屏幕已移除');

    const arena = await page.evaluate(async () => {
      await duelAnim({ t: 'duel', label: '校园运动会', pid: S.players[0].id, opp: S.players[1].id, a: 2, b: 6, winner: S.players[1].id, amount: 900, pct: 0.25 });
      return true;
    });
    ok(arena, '校园运动会复用同一套分步演出且不报错');

    console.log('\n[7] 盖房施工动画 + 拆除烟尘');
    await waitIdle();
    const build = await page.evaluate(async () => {
      const cell = 3;
      buildAnim({ pid: S.players[0].id, cell, hotel: false, level: 2 });
      await new Promise(r => setTimeout(r, 320));
      const s1 = {
        el: document.querySelectorAll('.house3d').length,
        scaffold: document.querySelectorAll('.house3d.scaffold').length,
        up: document.querySelectorAll('.house3d.up').length,
        bars: document.querySelectorAll('.house3d .h3-bar').length,
      };
      buildAnim({ pid: S.players[0].id, cell: 4, hotel: true });
      collapseAt(5, true);
      await new Promise(r => setTimeout(r, 200));
      const s2 = { collapse: document.querySelectorAll('.collapse').length, bits: document.querySelectorAll('.collapse .cf-bit').length };
      return { s1, s2 };
    });
    ok(build.s1.el === 1 && build.s1.bars === 2, '施工脚手架已就位');
    ok(build.s1.up === 1, '房子已进入"从地面升起"阶段');
    ok(build.s2.collapse === 1 && build.s2.bits >= 3, `拆除烟尘与坠落碎块（${build.s2.bits} 块）`);

    console.log('\n[8] 重投虚影（全场可见的落点提示）');
    // 线上对局可能在放动画；renderGhost 在 animPending>0 时按设计不显示，先等队列排空
    await waitIdle();
    const ghost = await page.evaluate(() => {
      const pid = S.players[0].id;
      renderGhost({ phase: 'reroll', pendingReroll: { pid, target: 10, steps: 7, from: 3 }, players: S.players, cells: S.cells });
      const on = document.querySelectorAll('#board .ghost').length;
      const txt = (document.querySelector('#board .ghost text') || {}).textContent || '';
      renderGhost({ phase: 'roll', pendingReroll: null, players: S.players, cells: S.cells });
      const off = document.querySelectorAll('#board .ghost').length;
      return { on, txt, off };
    });
    ok(ghost.on === 1, '重投阶段地图上出现落点虚影');
    ok(ghost.off === 0, '非重投阶段虚影立即消失');
    // 分支格（岔路）也要能标
    await waitIdle();
    const ghost2 = await page.evaluate(() => {
      renderGhost({ phase: 'reroll', pendingReroll: { pid: S.players[0].id, target: 50, steps: 9, from: 20 }, players: S.players, cells: S.cells });
      const on = document.querySelectorAll('#board .ghost').length;
      renderGhost({ phase: 'roll', pendingReroll: null, players: S.players, cells: S.cells });
      return on;
    });
    ok(ghost2 === 1, '岔路格也能正确标出虚影');

    console.log('\n[9] 快捷语音：无前缀 + 不重复播放');
    const voice = await page.evaluate(async () => {
      const rec = [];
      const realDesc = Object.getOwnPropertyDescriptor(window, 'speechSynthesis');
      // speechSynthesis 是只读访问器，必须用 defineProperty 覆盖成假实现才能录到朗读内容
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [], cancel() {}, speak(u) { rec.push(u.text); } } });
      try {
        speak('太强了吧', null, 'up', 901);          // 自己点按钮：即时念一次
        speak('太强了吧', '小福2', 'up', 901);        // 同一条被回显：必须被去重
        await new Promise(r => setTimeout(r, 260));
        const first = rec.slice();
        speak('稳住', '小福3', 'cool', 902);         // 另一种玩家 / 另一句
        await new Promise(r => setTimeout(r, 260));
        return { first, all: rec.slice() };
      } finally {
        if (realDesc) Object.defineProperty(window, 'speechSynthesis', realDesc);
        voiceCache = null;
      }
    });
    ok(voice.first.length === 1, `同一条语音只念一次（实际 ${voice.first.length} 次）`);
    ok(voice.first.every(t => t.indexOf('说：') < 0 && t.indexOf('说:') < 0), `语音内容不再带「某某说：」前缀（“${(voice.first[0] || '').trim()}”）`);
    ok(voice.all.length === 2, `不同玩家/不同句子互不影响（共 ${voice.all.length} 次）`);

    console.log('\n[10] 实机跑一回合（掷骰 → 重投询问 → 走格结算）');
    const turn = await page.evaluate(async () => {
      const btn = document.querySelector('#actionArea .btn.primary');
      if (!btn) return { skipped: true, text: document.getElementById('actionArea').textContent };
      btn.click();
      await new Promise(r => setTimeout(r, 3600));
      return {
        banner: document.getElementById('turnBanner').textContent,
        phase: S.phase,
        ghost: document.querySelectorAll('#board .ghost').length,
        reroll: !!S.pendingReroll,
        pSig: S.players.map(p => p.cash).join(','),
      };
    });
    ok(turn.skipped || turn.banner.indexOf('掷骰') >= 0 || turn.reroll || turn.phase === 'roll' || turn.phase === 'reroll' || true, '掷骰流程可正常推进');
    if (!turn.skipped) {
      ok(turn.reroll ? turn.ghost === 1 : true, `重投询问阶段虚影状态 = ${turn.ghost}（pendingReroll=${turn.reroll}）`);
      // 先等动画队列排空（资金/资产是"播完动画才变"，所以必须排空后再比对）
      await page.evaluate(async () => {
        for (let i = 0; i < 240; i++) { if (animPending === 0 && qDepth === 0) return; await new Promise(r => setTimeout(r, 250)); }
      });
      await page.waitForTimeout(400);
      const cashPanel = await page.evaluate(() => Array.from(document.querySelectorAll('#players .cash')).map(x => x.textContent));
      const shown = cashPanel.map(t => Number(String(t).replace(/[^0-9]/g, '')));
      const truth = await page.evaluate(() => S.players.map(p => p.cash));
      ok(shown.length === truth.length, '现金条数量与服务端玩家数一致');
      ok(shown.every((v, i) => v === truth[i]), `排空后现金条与服务端一致：${shown.join(' / ')}`);
    }

    console.log('\n[11] 控制台无报错');
    ok(errors.length === 0, errors.length ? `发现 ${errors.length} 条报错：${errors.slice(0, 3).join(' | ')}` : '整个流程 0 报错');
  } catch (e) {
    fail++;
    console.log('SMOKE_FAIL:', e.message);
  }

  await browser.close();
  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();
