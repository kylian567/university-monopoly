'use strict';
// v5.7 浏览器实机验收（海克斯 · 研究项目）：
//   [1] 开局公告已是 v5.7 + 运行时镜像（PROJECTS 54 项 / HEX_TIERS 3 档 / 新音效）
//   [2] 建房开局 → 风貌投票快速通过 → 走完第 1 轮 → 第 2 轮自动弹出「研究项目」三选一浮层
//   [3] 点卡立项 → 全员结算 → 横幅播报 → hexList 各 1 条 → 回到 roll 阶段
//   [4] 点击右侧玩家名 → 查看浮层（研究项目 / 技能卡 / 资产）→ 可关闭
//   [5] 全程无 JS 报错
// 依赖：已启动 server.js（默认 localhost:3000；BASE_URL 可指向线上），Playwright 在 NODE_PATH 里。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/v57shots';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  try { fs.mkdirSync(SHOT_DIR, { recursive: true }); } catch (e) {}
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 940 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  const shot = n => page.screenshot({ path: path.join(SHOT_DIR, n) }).catch(() => {});

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(700);

    console.log('\n[1] 公告版本 + 运行时镜像');
    const ann = await page.evaluate(() => (document.querySelector('#intro .announce-logo') || {}).textContent || '');
    ok(/v5\.[78]/.test(ann), `开局公告标题：${ann}`);
    await page.click('#btnAnnounce'); await sleep(240);
    await page.click('#btnIntro'); await sleep(240);
    await page.click('#btnRulesClose').catch(() => {});
    await sleep(220);
    const mir = await page.evaluate(() => ({
      projects: Object.keys(PROJECTS).length,
      tiers: Object.keys(HEX_TIERS).length,
      silver: PROJECT_KEYS.silver.length, gold: PROJECT_KEYS.gold.length, prism: PROJECT_KEYS.prism.length,
      sfx: Object.keys(SFX).length,
      hexSfx: ['hexRise', 'hexFlip', 'hexPick', 'hexHit', 'hexPrism'].every(k => typeof SFX[k] === 'function'),
      viewer: typeof window.openPlayerViewer,
    }));
    ok(mir.projects === 54, `PROJECTS 镜像 ${mir.projects} 项（预期 54）`);
    ok(mir.tiers === 3 && `${mir.silver}/${mir.gold}/${mir.prism}` === '20/20/14', `三档池 ${mir.silver}/${mir.gold}/${mir.prism}`);
    ok(mir.hexSfx, '5 个海克斯音效已挂载');
    ok(mir.viewer === 'function', 'openPlayerViewer 已挂到 window');

    console.log('\n[2] 建房开局，快速走到第 2 轮');
    await page.fill('#nameInput', '验收员');
    await page.click('#btnCreate'); await sleep(400);
    await page.click('#btnAddAI'); await sleep(200);
    await page.click('#btnStart');
    await page.waitForSelector('.fac-layer.show', { timeout: 10000 });
    await sleep(1200);
    await page.evaluate(() => { const c = document.querySelector('.fv-card'); if (c) c.click(); });   // 我先投票，AI 随后跟票即可提前结算
    // 等风貌结算完（phase 变 roll）
    let t0 = Date.now();
    while (Date.now() - t0 < 45000) {   // v5.8：投票 28s，等待随之加长
      const ph = await page.evaluate(() => (typeof S !== 'undefined' && S) ? S.phase : null);
      if (ph === 'roll') break;
      await sleep(500);
    }
    const ph1 = await page.evaluate(() => S.phase);
    ok(ph1 === 'roll', `风貌投票完成，进入第 1 轮（phase=${ph1}）`);

    // 我的回合：掷骰 → 重投询问选「就这样走」
    await page.evaluate(() => act({ type: 'roll' }));
    await sleep(2600);
    await page.evaluate(() => { try { act({ type: 'confirmRoll' }); } catch (e) {} });
    // 等 AI 走完第 1 轮 → 第 2 轮触发 project_offer
    t0 = Date.now();
    let opened = false;
    while (Date.now() - t0 < 90000) {
      opened = await page.evaluate(() => !!document.querySelector('.hx-layer'));
      if (opened) break;
      // 若轮到我（第 1 轮没触发重投询问），自动掷骰推进
      await page.evaluate(() => {
        try { if (S && S.phase === 'roll' && S.players[S.cur].id === myPid) act({ type: 'roll' }); } catch (e) {}
      });
      await sleep(1200);
      await page.evaluate(() => { try { act({ type: 'confirmRoll' }); } catch (e) {} });
      await sleep(800);
    }
    ok(opened, '第 2 轮弹出「研究项目」三选一浮层');
    if (!opened) throw new Error('三选一浮层未出现');
    await sleep(2200);
    const pick0 = await page.evaluate(() => ({
      tier: (document.querySelector('.hx-big') || {}).textContent || '',
      cards: document.querySelectorAll('.hx-card').length,
      clock: parseInt((document.getElementById('hxClock') || {}).textContent || '0', 10),
    }));
    ok(pick0.cards === 3, `浮层有 ${pick0.cards} 张项目卡`);
    ok(/校级|省级|国家级/.test(pick0.tier), `档位横幅：${pick0.tier.trim()}`);
    ok(pick0.clock >= 28 && pick0.clock <= 38, `倒计时 ${pick0.clock} 秒（从容选择，v5.8 起 38s）`);
    await shot('01-hex-pick.png');

    console.log('\n[3] 点卡立项 → 结算横幅 → 回到 roll');
    await page.evaluate(() => { const c = document.querySelector('.hx-card'); if (c) c.click(); });
    await sleep(900);
    const picked = await page.evaluate(() => ({
      picked: document.querySelectorAll('.hx-card.picked').length,
      waiting: !!document.querySelector('.hx-layer.waiting'),
    }));
    ok(picked.picked === 1 && picked.waiting, '点卡后锁定 + 进入等待其他玩家');
    // 等 AI 补选 + 结算（grants 播横幅、浮层关闭）
    t0 = Date.now();
    let granted = 0;
    while (Date.now() - t0 < 60000) {
      granted = await page.evaluate(() => [...document.querySelectorAll('.announce')].filter(a => /立项/.test(a.textContent)).length);
      if (granted >= 1) break;
      await sleep(700);
    }
    ok(granted >= 1, '出现「立项」结算横幅');
    await shot('02-hex-grant.png');
    t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      const st = await page.evaluate(() => ({
        phase: S.phase,
        mine: (S.players.find(p => p.id === myPid) || {}).hexList || [],
        ai: (S.players.find(p => p.isAI) || {}).hexList || [],
        overlay: !!document.querySelector('.hx-layer'),
      }));
      if (st.phase === 'roll' && st.mine.length === 1 && st.ai.length === 1 && !st.overlay) { ok(true, `结算完成：双方各立项 1 个，回到 roll（我=${JSON.stringify(st.mine)}）`); break; }
      await sleep(700);
      if (Date.now() - t0 > 28000) ok(false, `结算未完成：phase=${st.phase} hexList=${JSON.stringify(st.mine)}/${JSON.stringify(st.ai)}`);
    }
    const stillThere = await page.evaluate(() => document.querySelectorAll('.hx-layer').length);
    ok(stillThere === 0, '选择浮层已随结算关闭');

    console.log('\n[4] 点击右侧玩家名 → 查看浮层');
    await page.evaluate(() => { const c = document.querySelector('#players .pcard:not(.dead)'); if (c) c.click(); });
    await sleep(600);
    const viewer = await page.evaluate(() => ({
      open: !!document.querySelector('.hxp-layer.show'),
      secs: [...document.querySelectorAll('.hxp-sec-t')].map(e => e.textContent),
      chips: document.querySelectorAll('.hxp-chip').length,
      closeBtn: !!document.getElementById('hxpClose'),
    }));
    ok(viewer.open, '查看浮层已打开');
    ok(viewer.secs.length === 3 && /研究项目/.test(viewer.secs[0]) && /技能卡/.test(viewer.secs[1]) && /资产/.test(viewer.secs[2]), `三个分区：${viewer.secs.join(' / ')}`);
    ok(viewer.chips >= 1, `项目/技能胶囊 ${viewer.chips} 枚`);
    await shot('03-viewer.png');
    await page.click('#hxpClose'); await sleep(500);
    const closed = await page.evaluate(() => document.querySelectorAll('.hxp-layer').length);
    ok(closed === 0, '点击关闭后浮层移除');

    console.log('\n[5] 控制台无报错');
    const real = errors.filter(e => !/favicon|net::ERR_/i.test(e));
    ok(real.length === 0, real.length ? `发现报错：${real.slice(0, 3).join(' | ')}` : '无 JS 报错');
  } catch (e) {
    fail++;
    console.log('  ✗ 异常中断：' + (e && e.message));
    await shot('99-error.png');
  }
  await browser.close();
  console.log('\n========================================');
  console.log(`  实机验收：${pass} 通过 / ${fail} 失败`);
  console.log(`  截图目录：${SHOT_DIR}`);
  console.log('========================================');
  process.exit(fail ? 1 : 0);
})();
