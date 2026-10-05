'use strict';
// v5.8 浏览器实机验收（收益衰减 / 连击重做 / 第四次海克斯 / 看板扩容 / 大厅美化）：
//   [1] 开局公告已是 v5.8 + 运行时镜像（SFX 102 / 新音效 decay·investFail·steal / 大厅装饰层）
//   [2] 建房开局 → 风貌投票快速通过 → 进入第 1 轮，中央看板出现「收益衰减」常驻行
//   [3] 点击右侧玩家名 → 查看浮层（hxp-rich 两行胶囊）→ 可关闭
//   [4] 全程无 JS 报错
// 依赖：已启动 server.js（默认 localhost:3000；BASE_URL 可指向线上），Playwright 在 NODE_PATH 里。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/v58shots';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  try { fs.mkdirSync(SHOT_DIR, { recursive: true }); } catch (e) {}
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 940 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
  const shot = n => page.screenshot({ path: path.join(SHOT_DIR, n) }).catch(() => {});

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(700);

    console.log('\n[1] 公告版本 + 运行时镜像 + 大厅美化');
    const ann = await page.evaluate(() => (document.querySelector('#intro .announce-logo') || {}).textContent || '');
    ok(/v(?:5\.(?:14|13|12)|6\.\d+|7\.\d+)/.test(ann), `开局公告标题：${ann}`);
    const annSub = await page.evaluate(() => (document.querySelector('.announce-sub') || {}).textContent || '');
    ok(/v7\.[0-4]/.test(annSub), `作者公告版本号：${annSub.trim()}`);
    await page.click('#btnAnnounce'); await sleep(240);
    await page.click('#btnIntro'); await sleep(240);
    await page.click('#btnRulesClose').catch(() => {});
    await sleep(220);
    const rt = await page.evaluate(() => ({
      sfx: Object.keys(SFX).length,
      newSfx: ['decay', 'investFail', 'steal'].every(k => typeof SFX[k] === 'function'),
      deco: document.querySelectorAll('.lobby-deco span').length,
    }));
    ok(rt.sfx === 104, `音效表 ${rt.sfx} 种（预期 104 · v7.0 加 pow/cardCharity）`);
    ok(rt.newSfx, '3 个新音效 decay / investFail / steal 已挂载');
    ok(rt.deco >= 6, `大厅漂浮装饰 ${rt.deco} 枚`);

    console.log('\n[2] 建房开局，进入第 1 轮，中央看板衰减行');
    await page.fill('#nameInput', '验收员');
    await page.click('#btnCreate'); await sleep(400);
    await page.click('#btnAddAI'); await sleep(200);
    // v7.0：开局改为「全员准备」门控 —— 先点准备，再开始
    await page.evaluate(() => { const b = document.querySelector('#btnReady'); if (b && !b.classList.contains('on')) b.click(); }).catch(() => {});
    await sleep(700);
    await page.click('#btnStart');
    await page.waitForSelector('.fac-layer.show', { timeout: 10000 });
    await sleep(1200);
    await page.evaluate(() => { const c = document.querySelector('.fv-card'); if (c) c.click(); });   // 我先投票，AI 随后跟票即可提前结算
    let t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      const ph = await page.evaluate(() => (typeof S !== 'undefined' && S) ? S.phase : null);
      if (ph === 'roll' || ph === 'skill') break;   // 轮到我时可能先弹主动技询问（skill），也算进入对局
      await sleep(500);
    }
    const ph1 = await page.evaluate(() => S.phase);
    ok(ph1 === 'roll' || ph1 === 'skill', `风貌投票完成，进入第 1 轮（phase=${ph1}）`);
    // 中央看板：decayText 常驻行 + renderPanel 已填充 + 卡片加高
    const panel = await page.evaluate(() => {
      const g = id => { const el = document.getElementById(id); return el ? (el.textContent || '') : null; };
      const y = id => { const el = document.getElementById(id); return el ? el.getAttribute('y') : null; };
      return {
        decay: g('decayText'),
        decayY: y('decayText'),
        season: g('seasonText'),
        pool: g('poolText'),
        ghost: [...document.querySelectorAll('linearGradient')].some(x => (x.getAttribute('id') || '').includes('ghost')),
        card: typeof CTR_CARD !== 'undefined' ? CTR_CARD : null,
        sign: [...document.querySelectorAll('#board text, svg text')].some(t => (t.textContent || '').trim() === 'by fangzhongxing'),
      };
    });
    ok(panel.decay != null && /收益衰减|×100%|×70%/.test(panel.decay), `看板衰减行已填充：「${(panel.decay || '').trim()}」`);
    ok(panel.season && panel.pool, `季节 / 基金池行已渲染（${(panel.season || '').trim()}）`);
    ok(panel.card && panel.card.h >= 380, `中央看板已扩容（h=${panel.card && panel.card.h}）`);
    ok(panel.sign, '中央看板含作者署名 by fangzhongxing（v5.9）');
    await shot('01-panel.png');

    console.log('\n[3] 点击右侧玩家名 → 查看浮层（两行胶囊）');
    await page.evaluate(() => { const c = document.querySelector('#players .pcard:not(.dead)'); if (c) c.click(); });
    await sleep(600);
    const viewer = await page.evaluate(() => ({
      open: !!document.querySelector('.hxp-layer.show'),
      secs: [...document.querySelectorAll('.hxp-sec-t')].map(e => e.textContent),
      rich: document.querySelectorAll('.hxp-chip.hxp-rich').length,
      closeBtn: !!document.getElementById('hxpClose'),
    }));
    ok(viewer.open, '查看浮层已打开');
    ok(viewer.secs.length === 3, `三个分区：${viewer.secs.join(' / ')}`);
    ok(viewer.rich >= 1, `两行效果胶囊（hxp-rich）${viewer.rich} 枚`);
    await shot('02-viewer.png');
    await page.click('#hxpClose'); await sleep(500);
    const closed = await page.evaluate(() => document.querySelectorAll('.hxp-layer').length);
    ok(closed === 0, '点击关闭后浮层移除');

    console.log('\n[4] 控制台无报错');
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
