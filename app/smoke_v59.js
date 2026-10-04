'use strict';
// v5.12 浏览器实机验收（手机横屏 + 性能节流 + 时长）：
//   [1] 公告版本 v5.12 + client 镜像常量（60s / 70s）+ rotmode / 节流 / 粒子减量标记
//   [2] 桌面横屏视口：#app 不旋转
//   [3] 手机竖屏视口（触屏模拟）：#app 旋转 90°，宽=屏高、高=屏宽，body.rotmode；大厅 canvas 跟随量宽
//   [4] 竖屏模拟下建房开局无 JS 报错（横屏布局可用）
//   [5] 手机真横屏（视口 844x390）：不旋转
// 依赖：已启动 server.js（默认 localhost:3000；BASE_URL 可指向线上），Playwright 在 NODE_PATH 里。
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/v59shots';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  try { fs.mkdirSync(SHOT_DIR, { recursive: true }); } catch (e) {}
  const browser = await chromium.launch();
  const shot = (pg, n) => pg.screenshot({ path: path.join(SHOT_DIR, n) }).catch(() => {});

  try {
    // ---------- [1] 版本 + 静态标记 ----------
    const page = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    const errors = [];
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(700);

    console.log('\n[1] 公告版本 + 运行时常量 + v5.12 标记');
    const ann = await page.evaluate(() => (document.querySelector('#intro .announce-logo') || {}).textContent || '');
    ok(/v5\.(13|12|11)/.test(ann), `开局公告标题：${ann}`);
    const marks = await page.evaluate(() => ({
      facMs: typeof FACULTY_VOTE_MS !== 'undefined' ? FACULTY_VOTE_MS : null,
      rotScript: !!document.documentElement.outerHTML.match(/mobileLandscape/) || typeof window.closeHexUI === 'function',
      rotOn: typeof document.body.className === 'string',
    }));
    ok(marks.facMs === 60000, `client 投票时长镜像 ${marks.facMs / 1000}s`);
    const src = fs.readFileSync(path.join(__dirname, 'public/client.js'), 'utf8');
    ok(/HEX_PICK_MS \|\| 70000/.test(src), 'client 海克斯时长兜底 70s');
    ok(/mobileLandscape/.test(src), '横屏模块已内置');
    ok(/ts - lobbyLast < 33/.test(src) && /ts - wxLast < 33/.test(src), '大厅/天气特效 30fps 节流');
    ok(/qN\(74\)/.test(src) && /const FXQ = /.test(src), '触屏粒子减量 FXQ/qN');
    const css = fs.readFileSync(path.join(__dirname, 'public/style.css'), 'utf8');
    ok(/body\.rotmode \{/.test(css) && /pointer:coarse/.test(css), 'rotmode 覆盖样式 + 手机端关毛玻璃');
    await shot(page, '10-desktop.png');
    await page.close();

    // ---------- [2] 手机竖屏（触屏模拟）→ 应旋转 ----------
    console.log('\n[2] 手机竖屏视口 → #app 自动旋转 90°');
    const ctx2 = await browser.newContext({ ...devices['iPhone 13'] });   // 390x844 触屏
    const p2 = await ctx2.newPage();
    const err2 = [];
    p2.on('pageerror', e => err2.push(e.message));
    await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(900);
    const rot = await p2.evaluate(() => {
      const app = document.getElementById('app');
      const cs = getComputedStyle(app);
      const cv = document.getElementById('lobbyWxCv');
      return {
        tf: cs.transform, w: app.offsetWidth, h: app.offsetHeight,
        bodyCls: document.body.className,
        rotModeOn: document.body.classList.contains('rotmode'),
        cvW: cv ? cv.width : -1, cvH: cv ? cv.height : -1,
        iw: window.innerWidth, ih: window.innerHeight,
      };
    });
    ok(rot.rotModeOn, 'body.rotmode 已挂上');
    ok(rot.tf.includes('matrix'), `#app 有旋转变换（${rot.tf.slice(0, 24)}…）`);
    ok(rot.w === rot.ih && rot.h === rot.iw, `#app 尺寸 ${rot.w}x${rot.h} = 屏高x屏宽（${rot.ih}x${rot.iw}）`);
    ok(rot.cvW === rot.w && rot.cvH === rot.h, `大厅特效 canvas 已跟随量宽 ${rot.cvW}x${rot.cvH}`);
    await shot(p2, '20-mobile-portrait-rotated.png');

    // ---------- [3] 竖屏旋转状态下建房开局无报错 ----------
    console.log('\n[3] 旋转状态下建房开局（横屏布局可用）');
    await p2.click('#btnAnnounce'); await sleep(300);   // 关掉版本公告（手机端它覆盖全屏）
    await p2.click('#btnIntro'); await sleep(300);
    await p2.fill('#nameInput', '横屏验收');
    await p2.click('#btnCreate'); await sleep(500);
    await p2.click('#btnAddAI'); await sleep(250);
    await p2.click('#btnStart');
    await p2.waitForSelector('.fac-layer.show', { timeout: 12000 });
    await sleep(1000);
    const vote = await p2.evaluate(() => ({
      clock: parseInt((document.getElementById('fvClock') || {}).textContent || '0', 10),
      panel: !!document.querySelector('.fv-panel'),
      panelW: (document.querySelector('.fv-panel') || {}).offsetWidth || 0,
    }));
    ok(vote.panel, '城邦推选浮层正常弹出');
    ok(vote.clock >= 50 && vote.clock <= 60, `推选倒计时 ${vote.clock} 秒（v5.12 起 60s）`);
    ok(vote.panelW > rot.w * 0.5, `推选面板宽度 ${vote.panelW}px 占横屏宽度过半`);
    await p2.evaluate(() => { const c = document.querySelector('.fv-card'); if (c) c.click(); });
    await shot(p2, '30-mobile-game-landscape.png');
    ok(err2.length === 0, `无 JS 报错${err2.length ? '：' + err2[0] : ''}`);
    await ctx2.close();

    // ---------- [4] 手机真横屏（844x390）→ 不旋转 ----------
    console.log('\n[4] 手机真横屏视口 → 不旋转');
    const ctx4 = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    const p4 = await ctx4.newPage();
    await p4.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(900);
    const nat = await p4.evaluate(() => ({
      rotModeOn: document.body.classList.contains('rotmode'),
      tf: getComputedStyle(document.getElementById('app')).transform,
    }));
    ok(!nat.rotModeOn && (nat.tf === 'none' || nat.tf === ''), '真横屏下 #app 保持原样');
    await ctx4.close();

    // ---------- [5] 桌面横屏 → 不旋转 ----------
    console.log('\n[5] 桌面横屏 → 不旋转');
    const ctx5 = await browser.newContext({ viewport: { width: 1500, height: 940 } });
    const p5 = await ctx5.newPage();
    await p5.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(600);
    const desk = await p5.evaluate(() => ({
      rotModeOn: document.body.classList.contains('rotmode'),
      tf: getComputedStyle(document.getElementById('app')).transform,
    }));
    ok(!desk.rotModeOn && (desk.tf === 'none' || desk.tf === ''), '桌面端完全不受影响');
    await ctx5.close();

  } catch (e) {
    fail++;
    console.log('  ✗ 异常：', e.message);
  }
  await browser.close();
  console.log('\n========================================');
  console.log(`  实机验收：${pass} 通过 / ${fail} 失败`);
  console.log(`  截图目录：${SHOT_DIR}`);
  console.log('========================================');
  process.exit(fail ? 1 : 0);
})();
