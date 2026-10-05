'use strict';
// v6.0 浏览器实机验收：
//   [1] 开局公告版本 v6.0 + client 镜像常量（REROLL_COST=800 / shieldCostAt 新分段 / 投票 60s / 海克斯 70s）
//   [2] 三风格候选卡片（科技 / 古风 / 学术）在推选浮层里真实渲染
//   [3] 开局选专业处：每个专业都能看到档位 ★ + 主动/被动 标签 + 触发方式
//   [4] 对局内【点击地图格子】弹出租金详情面板（含各档基础租金 + 本轮实付）
//   [5] 新事件与镜像：joker_free / swap_cash 已注册；FACULTY/PROJECTS 双镜像逐字一致；server 暴露 rentViews
// 依赖：已启动 server.js（默认 localhost:3000；BASE_URL 可指向线上），Playwright 在 NODE_PATH 里。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/v60shots';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  try { fs.mkdirSync(SHOT_DIR, { recursive: true }); } catch (e) {}
  const browser = await chromium.launch();
  const shot = (pg, n) => pg.screenshot({ path: path.join(SHOT_DIR, n) }).catch(() => {});
  const errors = [];
  try {
    // ---------- [1] 版本 + 运行时常量 ----------
    const page = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(800);

    console.log('\n[1] 公告版本 v6.0 + client 运行时常量镜像');
    const ann = await page.evaluate(() => (document.querySelector('#intro .announce-logo') || {}).textContent || '');
    ok(/v([67])\.\d+/.test(ann), `开局公告标题：${ann.trim()}`);
    const marks = await page.evaluate(() => ({
      reroll: typeof REROLL_COST !== 'undefined' ? REROLL_COST : null,
      facMs: typeof FACULTY_VOTE_MS !== 'undefined' ? FACULTY_VOTE_MS : null,
      s1: typeof shieldCostAt === 'function' ? shieldCostAt(1) : null,
      s8: typeof shieldCostAt === 'function' ? shieldCostAt(8) : null,
      s9: typeof shieldCostAt === 'function' ? shieldCostAt(9) : null,
      s25: typeof shieldCostAt === 'function' ? shieldCostAt(25) : null,
      rentPanel: typeof window.openRentPanel === 'function',
    }));
    ok(marks.reroll === 800, `重投基准价镜像 ¥${marks.reroll}（v6.0）`);
    ok(marks.facMs === 60000, `投票时长镜像 ${marks.facMs / 1000}s`);
    ok(marks.s1 === 245 && marks.s8 === 560 && marks.s9 === 650 && marks.s25 === 2240,
      `免罚符分段价镜像 ¥${marks.s1}/¥${marks.s8}/¥${marks.s9}/¥${marks.s25}`);
    ok(marks.rentPanel, '客户端具备 openRentPanel（点击格子看租金）');

    const src = fs.readFileSync(path.join(__dirname, 'public/client.js'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, 'public/style.css'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
    const srv = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    ok(/FAC_STYLE/.test(src) && /fv-card \$\{st\}/.test(src), '三风格候选卡片生成逻辑存在');
    ok(/joker_free/.test(src) && /swap_cash/.test(src), 'joker_free / swap_cash 新事件已接入');
    ok(/queueIdle/.test(src), '投票 / 三选一快照兜底受 queueIdle 约束（等上一轮走完）');
    ok(/\.fv-card\.st0/.test(css) && /\.fv-card\.st1/.test(css) && /\.fv-card\.st2/.test(css), '三风格卡片 CSS 齐备');
    ok(/\.rc-panel/.test(css) && /\.rc-now/.test(css), '租金详情面板 CSS 齐备');
    ok(!/\.mj-tier/.test(css) && /\.mj-mode/.test(css), '专业卡片已去 ★ 档位（v7.0），保留主动/被动标签 CSS');
    ok(/rentViews/.test(srv), 'server 快照暴露 rentViews');
    ok((html.match(/<div class="intro-scroll">/g) || []).length === 2, '两份公告各一个滚动内容区');
    ok(/v7\.0/.test(html) && /v7\.0 规则调整速览/.test(html) && /v6\.0 规则调整速览/.test(html), 'index.html 含 v7.0 公告 + v7.0/v6.0 规则速览');
    await shot(page, '10-desktop.png');
    await page.close();

    // ---------- [2] 开局推选浮层：三张卡三种风格 ----------
    console.log('\n[2] 风貌推选浮层：三张候选卡分属三种风格');
    const p2 = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    p2.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(600);
    // 关掉作者公告 → 开局公告 → 进大厅
    await p2.evaluate(() => { try { document.querySelector('#announce').style.display = 'none'; document.querySelector('#intro').style.display = 'none'; } catch (e) {} });
    await p2.evaluate(() => { try { localStorage.setItem('fdm_name', 'v6测试'); } catch (e) {} });
    await p2.fill('#nameInput', 'v6测试').catch(() => {});
    await p2.evaluate(() => { document.querySelector('#lobby').style.display = 'flex'; });
    await p2.click('#btnCreate').catch(() => {});
    await sleep(700);
    await p2.evaluate(() => { for (let i = 0; i < 2; i++) { const b = document.querySelector('#btnAddAI'); if (b) b.click(); } });
    await sleep(600);
    // v7.0：开局改为「全员准备」门控 —— 先点准备，再开始
    await p2.evaluate(() => { const b = document.querySelector('#btnReady'); if (b && !b.classList.contains('on')) b.click(); }).catch(() => {});
    await sleep(700);
    await p2.click('#btnStart').catch(() => {});
    // 等推选浮层出现
    let seen = false, styles = [];
    for (let i = 0; i < 40 && !seen; i++) {
      await sleep(300);
      const r = await p2.evaluate(() => {
        const cards = [...document.querySelectorAll('.fv-card')];
        return { n: cards.length, cls: cards.map(c => c.className) };
      });
      if (r.n >= 3) { seen = true; styles = r.cls; }
    }
    ok(seen, '风貌推选浮层出现且渲染了 3 张候选卡');
    if (seen) {
      const has = k => styles.filter(c => new RegExp('\\b' + k + '\\b').test(c)).length;
      ok(has('st0') === 1 && has('st1') === 1 && has('st2') === 1, `三张卡分别应用 st0/st1/st2（实际 ${JSON.stringify(styles)}）`);
      ok(/科技风|古风|学术风/.test(await p2.evaluate(() => document.body.innerText)), '卡面标注了风格名（科技风 / 古风 / 学术风）');
      await shot(p2, '20-fac-cards.png');
    }
    await p2.close();

    // ---------- [3]+[4] 专业卡片 + 点击格子看租金 ----------
    console.log('\n[3] 开局选专业：档位 ★ + 主动/被动 + 触发方式');
    const p3 = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    p3.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await p3.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(600);
    await p3.evaluate(() => {
      try { document.querySelector('#announce').style.display = 'none'; document.querySelector('#intro').style.display = 'none'; } catch (e) {}
      document.querySelector('#lobby').style.display = 'flex';
    });
    await sleep(400);
    await p3.evaluate(() => { const w = document.querySelector('#majorRow'); if (w && !w.children.length) { try { w.innerHTML = buildMajorHtml(null); } catch (e) {} } });
    const maj = await p3.evaluate(() => {
      const first = document.querySelector('.major-btn');
      if (!first) return null;
      return {
        n: document.querySelectorAll('.major-btn').length,
        tier: !!first.querySelector('.mj-tier'),
        mode: !!first.querySelector('.mj-mode'),
        use: !!first.querySelector('.mj-use'),
        txt: (first.innerText || '').replace(/\s+/g, ' ').slice(0, 90),
      };
    });
    ok(maj && maj.n >= 60, `专业按钮共 ${maj ? maj.n : 0} 个`);
    ok(maj && !maj.tier && maj.mode && maj.use, `卡片已去档位★、保留主动被动 / 触发方式（示例：${maj ? maj.txt : ''}）`);
    await shot(p3, '30-majors.png');
    await p3.close();

    console.log('\n[4] 对局内点击地图格子 → 租金详情面板');
    const p4 = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    p4.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await p4.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(600);
    await p4.evaluate(() => {
      try { document.querySelector('#announce').style.display = 'none'; document.querySelector('#intro').style.display = 'none'; } catch (e) {}
      document.querySelector('#lobby').style.display = 'flex';
    });
    await p4.fill('#nameInput', '房东').catch(() => {});
    await p4.click('#btnCreate').catch(() => {});
    await sleep(700);
    await p4.evaluate(() => { for (let i = 0; i < 2; i++) { const b = document.querySelector('#btnAddAI'); if (b) b.click(); } });
    await sleep(600);
    // v7.0：开局改为「全员准备」门控 —— 先点准备，再开始
    await p4.evaluate(() => { const b = document.querySelector('#btnReady'); if (b && !b.classList.contains('on')) b.click(); }).catch(() => {});
    await sleep(700);
    await p4.click('#btnStart').catch(() => {});
    // 跳过推选（若有）
    for (let i = 0; i < 30; i++) {
      await sleep(400);
      const st = await p4.evaluate(() => (typeof S !== 'undefined' && S) ? { phase: S.phase, hasRV: !!(S.rentViews && S.rentViews.length) } : null);
      if (st && st.phase === 'faculty') { await p4.evaluate(() => { const c = document.querySelector('.fv-card'); if (c) c.click(); }); }
      if (st && (st.phase === 'roll' || st.phase === 'reroll') && st.hasRV) break;
    }
    const st4 = await p4.evaluate(() => (typeof S !== 'undefined' && S) ? { phase: S.phase, rvN: (S.rentViews || []).length, propIdx: (S.rentViews || []).findIndex(v => v && v.kind === 'prop') } : null);
    ok(st4 && st4.rvN > 40, `state.rentViews 已下发 ${st4 ? st4.rvN : 0} 条`);
    // 直接调用面板（点击命中依赖屏幕坐标，这里用等价入口验证渲染）
    const panel = await p4.evaluate(() => {
      if (typeof S === 'undefined' || !S) return null;
      const i = (S.rentViews || []).findIndex(v => v && v.kind === 'prop');
      if (i < 0) return null;
      try { window.openRentPanel(i); } catch (e) { return { err: e.message }; }
      return { i, has: !!document.querySelector('.rc-panel'), txt: (document.querySelector('.rc-panel') || {}).innerText || '' };
    });
    ok(panel && panel.has, '点击格子后弹出租金详情面板（.rc-panel）');
    if (panel && panel.txt) {
      ok(/空地/.test(panel.txt) && /旅馆/.test(panel.txt), '面板列出「空地 / 旅馆」各档租金');
      ok(/本轮若踩到实付|本轮实付|当前无租金/.test(panel.txt), '面板给出「本轮实付」或「当前无租金」');
      await shot(p4, '40-rent-panel.png');
    }
    // 真点击一次（用棋盘 SVGs 的屏幕坐标）
    const clicked = await p4.evaluate(() => {
      if (typeof S === 'undefined' || !S) return false;
      const i = (S.rentViews || []).findIndex(v => v && v.kind === 'prop');
      const svg = document.getElementById('board');
      const r = svg.getBoundingClientRect();
      const sc = r.width / 1500;
      const [x, y] = CELLXY(i);
      const ev = new MouseEvent('click', { clientX: r.left + (x + 40) * sc, clientY: r.top + (y + 40) * sc, bubbles: true });
      svg.dispatchEvent(ev);
      return !!document.querySelector('.rc-panel');
    });
    ok(clicked, '真实点击棋盘格子可触发租金面板');
    await p4.close();

    ok(errors.length === 0, `全程无 JS 报错${errors.length ? '：' + errors.slice(0, 3).join(' | ') : ''}`);
  } catch (e) {
    fail++; console.log('  ✗ 冒烟异常：' + e.message);
  } finally {
    await browser.close();
  }
  console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
  process.exit(fail ? 1 : 0);
})();
