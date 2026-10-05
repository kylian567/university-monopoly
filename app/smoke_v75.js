'use strict';
// v7.5 浏览器实机验收：
//   [1] 版本号 v7.5（index.html）＋ 客户端 PROJECTS 镜像 152 + 带合约 90 + desc↔charges 一一对应
//       + 触发轮 12 次且第 41/51 已前移为 40/50
//   [2] 「三张翻面卡」奖励浮层真实可点（.cd-layer pointer-events:auto → 点一下真的选中）
//   [3] 「无懈可击」响应框真实可点（.ng-layer pointer-events:auto → 按钮能点）
//   [4] 点名字看资产：面板分区（研究项目 / 专业与技能 / 效果卡）与效果卡逐张带描述
//   [5] 真实对局：开局 → 推选 → 若干轮（无 JS 报错）
//   [6] 全程无 JS 报错
// 依赖：已启动 server.js（默认 localhost:3000；BASE_URL 可指向线上），Playwright 在 NODE_PATH 里。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/v75shots';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  try { fs.mkdirSync(SHOT_DIR, { recursive: true }); } catch (e) {}
  const browser = await chromium.launch();
  const shot = (pg, n) => pg.screenshot({ path: path.join(SHOT_DIR, n) }).catch(() => {});
  const errors = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(900);
    // 让对局容器可见（#fxLayer 在 #game 之内，大厅阶段它是 display:none，浮层会 0×0 点不到）
    await page.evaluate(() => {
      try {
        const hide = id => { const e = document.querySelector(id); if (e) e.style.display = 'none'; };
        hide('#announce'); hide('#intro'); hide('#rules');
        const lo = document.querySelector('#lobby'); if (lo) lo.style.display = 'none';
        const g = document.querySelector('#game'); if (g) g.style.display = 'flex';
      } catch (e) {}
    });
    await page.evaluate(() => { try { speed = 0.14; } catch (e) {} });

    // ---------- [1] 版本号 + 镜像 + 触发轮 ----------
    console.log('\n[1] 版本号 v7.5 + 客户端 PROJECTS 镜像（152 张 / 合约 90）+ 触发轮 40·50');
    const htmlTxt = await page.evaluate(() => document.documentElement.outerHTML);
    ok(/v7\.5/.test(htmlTxt), 'index.html 含 v7.5 版本号');
    const P = await page.evaluate(() => {
      if (typeof PROJECTS === 'undefined') return null;
      const tiers = { silver: 0, gold: 0, prism: 0 };
      const charged = { silver: 0, gold: 0, prism: 0 };
      const badDesc = [];
      for (const k in PROJECTS) {
        const p = PROJECTS[k] || {};
        if (tiers[p.tier] !== undefined) tiers[p.tier]++;
        if (p.charges) {
          if (charged[p.tier] !== undefined) charged[p.tier]++;
          const m = /限\s*(\d+)\s*(轮|次)/.exec(p.desc || '');
          if (!m || +m[1] !== p.charges) badDesc.push(k + '(charges=' + p.charges + ',desc=' + (p.desc || '').slice(0, 26) + ')');
        }
      }
      const keys = { silver: 0, gold: 0, prism: 0 };
      if (typeof PROJECT_KEYS === 'object') for (const t in PROJECT_KEYS) if (keys[t] !== undefined) keys[t] = PROJECT_KEYS[t].length;
      return { n: Object.keys(PROJECTS).length, tiers, charged, badDesc, keys,
        salaryx2: (PROJECTS.salaryx2 || {}), stipend: (PROJECTS.stipend || {}) };
    });
    ok(!!P, '客户端 PROJECTS 已加载');
    ok(P && P.n === 152, `项目池 ${P ? P.n : 0} 张（v7.5 期望 152）`);
    ok(P && P.tiers.silver === 56 && P.tiers.gold === 51 && P.tiers.prism === 45,
      `三档数量 银 ${P ? P.tiers.silver : 0} / 金 ${P ? P.tiers.gold : 0} / 彩 ${P ? P.tiers.prism : 0}（期望 56/51/45）`);
    ok(P && P.keys.silver === 56 && P.keys.gold === 51 && P.keys.prism === 45,
      `PROJECT_KEYS 分组 银 ${P ? P.keys.silver : 0} / 金 ${P ? P.keys.gold : 0} / 彩 ${P ? P.keys.prism : 0}`);
    ok(P && P.charged.silver === 33 && P.charged.gold === 29 && P.charged.prism === 28,
      `带合约卡 银 ${P ? P.charged.silver : 0} / 金 ${P ? P.charged.gold : 0} / 彩 ${P ? P.charged.prism : 0}（共 ${P ? (P.charged.silver + P.charged.gold + P.charged.prism) : 0}，期望 90）`);
    ok(P && P.badDesc.length === 0, `desc↔charges 一一对应${P && P.badDesc.length ? '（不符 ' + P.badDesc.length + '：' + P.badDesc.slice(0, 3).join(' | ') + '）' : ''}`);
    ok(P && P.salaryx2.charges === 3 && P.salaryx2.mods && P.salaryx2.mods.goCash === 500,
      `v7.5 平衡：双倍工资限 ${P ? P.salaryx2.charges : '-'} 次 / 过起点 ¥${P && P.salaryx2.mods ? P.salaryx2.mods.goCash : '-'}（期望 3 / 500）`);
    ok(P && P.stipend.charges === 11 && P.stipend.mods && P.stipend.mods.goCash === 250,
      `v7.5 平衡：勤工俭学限 ${P ? P.stipend.charges : '-'} 次 / ¥${P && P.stipend.mods ? P.stipend.mods.goCash : '-'}（期望 11 / 250）`);

    // 触发轮（服务端常量：直接读 game.js）
    const gsrc = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
    const trigM = /const HEX_TRIGGERS = \[([^\]]+)\]/.exec(gsrc);
    const trig = trigM ? trigM[1].split(',').map(s => +s.trim()).filter(n => !isNaN(n)) : [];
    const trigE = /const HEX_TRIGGERS_EARLY = \[([^\]]+)\]/.exec(gsrc);
    const trigEN = trigE ? trigE[1].split(',').filter(s => s.trim()).length : 0;
    ok(trig.length === 12 && trigEN === 12, `触发轮 ${trig.length} 次 / 时光之城提前 ${trigEN} 次（期望各 12）`);
    ok(trig.includes(40) && trig.includes(50) && !trig.includes(41) && !trig.includes(51),
      `第 41/51 轮已前移为 40/50（实际 ${trig.join('/')}）`);
    const cliSrc = fs.readFileSync(path.join(__dirname, 'public', 'client.js'), 'utf8');
    ok(JSON.stringify(trig) === JSON.stringify([2, 8, 15, 23, 32, 40, 50, 62, 74, 86, 98, 110]),
      '触发轮 = 2/8/15/23/32/40/50/62/74/86/98/110');
    ok(/pointer-events:\s*auto/.test((fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf8').match(/\.cd-layer \{[^}]*\}/) || [''])[0]),
      'CSS 上 .cd-layer 已声明 pointer-events:auto');
    await shot(page, '10-lobby.png');

    // ---------- [2] 三张翻面卡浮层真实可点 ----------
    console.log('\n[2] 「三张翻面卡」奖励浮层：真实可点（v7.5 修复点）');
    await page.evaluate(() => {
      S = { players: [{ id: 'a', name: '甲', pos: 5, cash: 10000, hexList: [], joker: 0 }], phase: 'carddraft', round: 8, hostId: 'a' };
      myPid = 'a';
      try { cardDraftOpen({ round: 8, offers: { a: [{ id: 'seize' }, { id: 'medal' }, { id: 'joker' }] }, ms: 30000 }); } catch (e) { window.__cdErr = e.message; }
    });
    await sleep(900);
    const cd = await page.evaluate(() => {
      const d = document.querySelector('.cd-layer');
      if (!d) return null;
      const slots = [...d.querySelectorAll('.cd-slot')];
      return {
        n: slots.length,
        pe: getComputedStyle(d).pointerEvents,
        slotPE: slots[0] ? getComputedStyle(slots[0]).pointerEvents : null,
        titles: [...d.querySelectorAll('.cd-big, .cd-sub')].map(x => x.textContent).join(' | '),
      };
    });
    ok(cd && cd.n === 3, `翻面卡浮层渲染 3 张（实际 ${cd ? cd.n : 0}）`);
    ok(cd && cd.pe === 'auto', `.cd-layer 计算样式 pointer-events = ${cd ? cd.pe : '-'}（v7.5 修复前是 none）`);
    ok(cd && cd.slotPE !== 'none', `.cd-slot 计算样式 pointer-events = ${cd ? cd.slotPE : '-'}`);
    // 真·点击：Playwright 会做命中测试，pointer-events:none 时必然超时失败
    let clicked = false;
    try { await page.click('.cd-slot', { timeout: 5000 }); clicked = true; } catch (e) { clicked = false; }
    await sleep(500);
    const chosen = await page.evaluate(() => {
      const d = document.querySelector('.cd-layer');
      return d ? { chosen: d.classList.contains('chosen'), mine: !!d.querySelector('.cd-slot.mine') } : null;
    });
    ok(clicked, 'Playwright 命中测试通过：翻面卡可以被真实点击');
    ok(chosen && chosen.chosen && chosen.mine, '点击后浮层进入 chosen 态并标出所选卡');
    await shot(page, '2-draft-clickable.png');
    await page.evaluate(() => { try { cardDraftClose(); } catch (e) { const d = document.querySelector('.cd-layer'); if (d) d.remove(); } });
    await sleep(400);
    ok(await page.evaluate(() => !document.querySelector('.cd-layer')), '翻面卡浮层已收起');

    // ---------- [3] 无懈可击响应框真实可点 ----------
    console.log('\n[3] 「无懈可击」响应框：真实可点（同源修复）');
    await page.evaluate(() => {
      S = {
        players: [
          { id: 'a', name: '甲', color: '#f00', pos: 5, cash: 10000, joker: 0, hand: [{ uid: 'f1', id: 'flawless' }] },
          { id: 'b', name: '乙', color: '#0f0', pos: 9, cash: 8000, joker: 0, hand: [] },
        ],
        phase: 'negate', round: 9, hostId: 'a',
        pendingNegate: { pid: 'a', card: 'seize', attacker: 'b', target: 'a', name: '强取豪夺' },
      };
      myPid = 'a';
      try { negateSync(); } catch (e) { window.__ngErr = e.message; }
    });
    await sleep(700);
    const ng = await page.evaluate(() => {
      const d = document.querySelector('.ng-layer');
      if (!d) return null;
      return {
        pe: getComputedStyle(d).pointerEvents,
        txt: (d.querySelector('.ng-txt') || {}).textContent || '',
        hasYes: !!d.querySelector('#ngYes'), hasNo: !!d.querySelector('#ngNo'),
        yes: (d.querySelector('#ngYes') || {}).textContent || '',
      };
    });
    ok(ng && ng.pe === 'auto', `.ng-layer 计算样式 pointer-events = ${ng ? ng.pe : '-'}（v7.5 修复前是 none）`);
    ok(ng && ng.hasYes && ng.hasNo, '响应框两个按钮就位（使用 / 放过）');
    ok(ng && /目标是 TA/.test(ng.txt), '被点名时文案标出「（目标是 TA）」');
    ok(ng && /完全失效/.test(ng.txt), '响应框文案说明「可以让这张卡完全失效」');
    let ngClicked = false;
    try { await page.click('#ngNo', { timeout: 5000 }); ngClicked = true; } catch (e) { ngClicked = false; }
    ok(ngClicked, 'Playwright 命中测试通过：响应框按钮可以被真实点击');
    await shot(page, '3-negate-clickable.png');

    // ---------- [4] 查看面板：效果卡分区 ----------
    console.log('\n[4] 点名字看资产：研究项目 / 专业与技能 / 效果卡 分区');
    const pv = await page.evaluate(() => {
      S = {
        players: [{
          id: 'a', name: '甲', color: '#f00', pos: 5, cash: 12000, skillLeft: 3, major: 'mech',
          joker: 1, medal: 2, fineFree: 1, rentX2: 1, stayFree: 0,
          hexList: ['ladderpay', 'longterm'], hexLeft: { ladderpay: 12, longterm: 2 },
          hand: [{ uid: 'h1', id: 'snatch' }, { uid: 'h2', id: 'copycard' }],
          borrow: null, alive: true,
        }],
        phase: 'play', round: 20, hostId: 'a', mutation: null,
        cells: BOARD.map(() => ({ own: null, level: 0, mortgaged: false, hp: 0 })),
      };
      myPid = 'a';
      try { openPlayerViewer('a'); } catch (e) { return { err: e.message }; }
      const d = document.querySelector('.hxp-layer');
      if (!d) return { present: false };
      const secs = [...d.querySelectorAll('.hxp-sec-t')].map(x => x.textContent.trim());
      const chips = [...d.querySelectorAll('.hxp-chip.hxp-rich')].map(x => ({ b: (x.querySelector('b') || {}).textContent || '', i: (x.querySelector('i') || {}).textContent || '' }));
      return { present: true, secs, chips, html: d.innerHTML };
    });
    if (pv.err) {
      ok(false, '查看面板渲染异常：' + pv.err);
    } else if (pv.present) {
      ok(pv.secs.some(s => /研究项目/.test(s)) && pv.secs.some(s => /专业与技能/.test(s)) && pv.secs.some(s => /🃏 效果卡/.test(s)),
        `面板分区齐备：${pv.secs.join(' / ')}`);
      const hand = pv.chips.filter(c => /顺手牵羊|复印卡/.test(c.b));
      ok(hand.length === 2, `手牌效果卡上屏（${hand.map(h => h.b).join('、')}）`);
      const res = pv.chips.filter(c => /万能卡|免租金卡|免罚款卡|租金翻倍/.test(c.b));
      ok(res.length >= 3, `保留型效果卡折算上屏（${res.map(h => h.b).join('、')}）`);
      ok(pv.chips.some(c => /顺手牵羊/.test(c.b) && /偷走/.test(c.i)), '效果卡逐张带效果描述（顺手牵羊 → 偷走…）');
      await shot(page, '4-player-viewer.png');
      await page.evaluate(() => { try { closePlayerViewer(); } catch (e) { const d = document.querySelector('.hxp-layer'); if (d) d.remove(); } });
      await sleep(400);
      ok(await page.evaluate(() => !document.querySelector('.hxp-layer')), '查看面板已关闭');
    } else {
      ok(false, '查看面板未渲染');
    }

    // ---------- [5] 真实对局无报错 ----------
    console.log('\n[5] 真实对局：开局 → 推选 → 若干轮（无 JS 报错）');
    const p3 = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    p3.on('pageerror', e => errors.push('PAGEERROR(对局): ' + e.message));
    await p3.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(700);
    await p3.click('#btnAnnounce').catch(() => {}); await sleep(200);
    await p3.click('#btnIntro').catch(() => {}); await sleep(200);
    await p3.click('#btnRulesClose').catch(() => {});
    await sleep(200);
    await p3.fill('#nameInput', 'v75验收').catch(() => {});
    await p3.click('#btnCreate').catch(() => {}); await sleep(400);
    await p3.click('#btnAddAI').catch(() => {}); await sleep(300);
    await p3.evaluate(() => { const b = document.querySelector('#btnReady'); if (b && !b.classList.contains('on')) b.click(); });
    await sleep(600);
    await p3.click('#btnStart').catch(() => {});
    await p3.waitForSelector('.fac-layer.show', { timeout: 25000 }).catch(() => {});
    await sleep(1200);
    await p3.evaluate(() => { const c = document.querySelector('.fv-card'); if (c) c.click(); });
    await sleep(6000);
    await p3.evaluate(() => { const b = document.querySelector('#btnTrust'); if (b) b.click(); });
    await sleep(2500);
    const alive = await p3.evaluate(() => (typeof S !== 'undefined' && S) ? { phase: S.phase, round: S.round } : null);
    ok(!!alive, `真实对局已推进（phase=${alive ? alive.phase : '-'} round=${alive ? alive.round : '-'}）`);
    await shot(p3, '50-real-game.png');
    await p3.close();

    // ---------- [6] 报错汇总 ----------
    console.log('\n[6] JS 报错检查');
    const real = errors.filter(e => !/favicon|ERR_|net::|Failed to load resource/i.test(e));
    ok(real.length === 0, `无 JS 报错${real.length ? '：' + real.slice(0, 4).join(' || ') : ''}`);
  } catch (err) {
    fail++;
    console.error('  ✗ 冒烟脚本异常：', err && err.message);
    console.error(err && err.stack);
  } finally {
    await browser.close();
  }

  console.log('\n========================================');
  console.log(`  v7.5 冒烟：${pass} 通过 / ${fail} 失败`);
  console.log('========================================');
  process.exit(fail ? 1 : 0);
})();
