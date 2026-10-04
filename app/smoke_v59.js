'use strict';
// v5.12 / v5.14 浏览器实机验收（手机横竖屏 + 性能节流 + 时长）：
//   [1] 公告版本 v5.14 + client 镜像常量（60s / 70s）+ rotmode / 节流 / 粒子减量标记
//   [2] 手机竖屏打开首页（触屏模拟）：大厅**保持竖屏**，且「创建房间」真能点到（v5.14 修复：以前一进来就转 90° 导致点不到按钮）
//   [3] 竖屏下建房开局 → 进入对局（#game）后才旋转 90°（宽=屏高、高=屏宽，body.rotmode），推选面板占横屏宽度过半
//   [4] 对局内点「🚪 退出」回大厅 → 旋转立即解除，恢复竖屏
//   [5] 手机真横屏（视口 844x390）→ 不旋转
//   [6] 桌面横屏 → 不旋转
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

    console.log('\n[1] 公告版本 + 运行时常量 + v5.14 标记');
    const ann = await page.evaluate(() => (document.querySelector('#intro .announce-logo') || {}).textContent || '');
    ok(/v(?:5\.(?:14|13|12|11)|6\.\d+)/.test(ann), `开局公告标题：${ann}`);
    const marks = await page.evaluate(() => ({
      facMs: typeof FACULTY_VOTE_MS !== 'undefined' ? FACULTY_VOTE_MS : null,
      rotScript: !!document.documentElement.outerHTML.match(/mobileLandscape/) || typeof window.closeHexUI === 'function',
      rotOn: typeof document.body.className === 'string',
    }));
    ok(marks.facMs === 60000, `client 投票时长镜像 ${marks.facMs / 1000}s`);
    const src = fs.readFileSync(path.join(__dirname, 'public/client.js'), 'utf8');
    ok(/HEX_PICK_MS \|\| 70000/.test(src), 'client 海克斯时长兜底 70s');
    ok(/mobileLandscape/.test(src), '横屏模块已内置');
    ok(/inGame = \(\) => gameScr\.style\.display === 'flex'/.test(src) && !/tryLock/.test(src),
      'v5.14：横屏只在 #game 屏生效，且不再全局强锁横屏');
    ok(/ts - lobbyLast < 33/.test(src) && /ts - wxLast < 33/.test(src), '大厅/天气特效 30fps 节流');
    ok(/qN\(74\)/.test(src) && /const FXQ = /.test(src), '触屏粒子减量 FXQ/qN');
    const css = fs.readFileSync(path.join(__dirname, 'public/style.css'), 'utf8');
    ok(/body\.rotmode \{/.test(css) && /pointer:coarse/.test(css), 'rotmode 覆盖样式 + 手机端关毛玻璃');
    // v5.14：公告「下一步」常驻（内容区自己滚动，按钮在滚动区之外）
    const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
    ok((html.match(/<div class="intro-scroll">/g) || []).length === 2, '两份公告各有一个滚动内容区');
    ok(/\.intro-scroll \{ flex:1 1 auto; min-height:0; overflow-y:auto/.test(css.replace(/\s+/g, ' ')),
      '.intro-scroll 独立滚动 + 按钮固定在卡片底部');
    await shot(page, '10-desktop.png');
    await page.close();

    // ---------- [2] 手机竖屏打开首页 → 大厅保持竖屏，按钮可点 ----------
    console.log('\n[2] 手机竖屏打开首页 → 大厅不旋转，且能点到「创建房间」');
    const ctx2 = await browser.newContext({ ...devices['iPhone 13'] });   // 390x844 触屏
    const p2 = await ctx2.newPage();
    const err2 = [];
    p2.on('pageerror', e => err2.push(e.message));
    p2.on('dialog', d => d.accept());   // 「确定退出本局吗？」自动确认
    await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(900);
    // 开局公告是全屏遮罩，先走完「下一步」再看大厅按钮（这正是用户报的场景：大厅要能点）
    await p2.click('#btnAnnounce'); await sleep(300);
    await p2.click('#btnIntro'); await sleep(300);
    const lobby = await p2.evaluate(() => {
      const app = document.getElementById('app');
      const btn = document.getElementById('btnCreate');
      const r = btn.getBoundingClientRect();
      const hit = (r.width > 0 && r.height > 0)
        ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
      return {
        rotModeOn: document.body.classList.contains('rotmode'),
        tf: getComputedStyle(app).transform,
        w: app.offsetWidth, h: app.offsetHeight,
        iw: window.innerWidth, ih: window.innerHeight,
        btnVisible: r.top >= 0 && r.bottom <= window.innerHeight,
        btnHit: !!(hit && (hit === btn || btn.contains(hit))),
      };
    });
    ok(!lobby.rotModeOn && (lobby.tf === 'none' || lobby.tf === ''), '大厅 #app 不再被旋转（v5.14 修复）');
    ok(lobby.w === lobby.iw && lobby.h === lobby.ih, `大厅尺寸 ${lobby.w}x${lobby.h} = 物理竖屏 ${lobby.iw}x${lobby.ih}`);
    ok(lobby.btnVisible && lobby.btnHit, '「创建房间」按钮在竖屏视口内且命中可点');
    await shot(p2, '20-mobile-lobby-portrait.png');

    // ---------- [3] 进入对局后才旋转 ----------
    console.log('\n[3] 建房开局 → 进入对局后 #app 才旋转 90°');
    await p2.fill('#nameInput', '横屏验收');
    await p2.click('#btnCreate'); await sleep(500);
    await p2.click('#btnAddAI'); await sleep(250);
    await p2.click('#btnStart');
    await p2.waitForSelector('.fac-layer.show', { timeout: 12000 });
    await sleep(1200);
    const vote = await p2.evaluate(() => {
      const app = document.getElementById('app');
      const cs = getComputedStyle(app);
      return {
        gameShown: document.getElementById('game').style.display === 'flex',
        rotModeOn: document.body.classList.contains('rotmode'),
        tf: cs.transform, w: app.offsetWidth, h: app.offsetHeight,
        iw: window.innerWidth, ih: window.innerHeight,
        clock: parseInt((document.getElementById('fvClock') || {}).textContent || '0', 10),
        panel: !!document.querySelector('.fv-panel'),
        panelW: (document.querySelector('.fv-panel') || {}).offsetWidth || 0,
      };
    });
    ok(vote.gameShown, '#game 屏已显示');
    ok(vote.rotModeOn, '进入对局后 body.rotmode 已挂上');
    ok(vote.tf.includes('matrix'), `对局内 #app 有旋转变换（${vote.tf.slice(0, 24)}…）`);
    ok(vote.w === vote.ih && vote.h === vote.iw, `对局内 #app 尺寸 ${vote.w}x${vote.h} = 屏高x屏宽（${vote.ih}x${vote.iw}）`);
    ok(vote.panel, '城邦推选浮层正常弹出');
    ok(vote.clock >= 50 && vote.clock <= 60, `推选倒计时 ${vote.clock} 秒（v5.12 起 60s）`);
    ok(vote.panelW > vote.w * 0.5, `推选面板宽度 ${vote.panelW}px 占横屏宽度过半`);
    await p2.evaluate(() => { const c = document.querySelector('.fv-card'); if (c) c.click(); });
    await shot(p2, '30-mobile-game-landscape.png');

    // ---------- [4] 退出对局 → 立刻转回竖屏 ----------
    console.log('\n[4] 对局内点「退出」→ 回大厅立即恢复竖屏');
    await p2.evaluate(() => document.getElementById('btnQuit').click());
    await sleep(900);
    const back = await p2.evaluate(() => {
      const app = document.getElementById('app');
      return {
        gameHidden: document.getElementById('game').style.display === 'none',
        rotModeOn: document.body.classList.contains('rotmode'),
        tf: getComputedStyle(app).transform,
        w: app.offsetWidth, iw: window.innerWidth,
      };
    });
    ok(back.gameHidden, '#game 已隐藏，回到大厅');
    ok(!back.rotModeOn && (back.tf === 'none' || back.tf === ''), '退出对局后旋转解除（MutationObserver 生效）');
    ok(back.w === back.iw, `大厅恢复竖屏宽度 ${back.w} = ${back.iw}`);
    ok(err2.length === 0, `无 JS 报错${err2.length ? '：' + err2[0] : ''}`);
    await ctx2.close();

    // ---------- [5] 手机真横屏（844x390）→ 不旋转 ----------
    console.log('\n[5] 手机真横屏视口 → 不旋转');
    const ctx5b = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    const p5b = await ctx5b.newPage();
    await p5b.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(900);
    const nat = await p5b.evaluate(() => ({
      rotModeOn: document.body.classList.contains('rotmode'),
      tf: getComputedStyle(document.getElementById('app')).transform,
    }));
    ok(!nat.rotModeOn && (nat.tf === 'none' || nat.tf === ''), '真横屏下 #app 保持原样');
    await ctx5b.close();

    // ---------- [6] 桌面横屏 → 不旋转 ----------
    console.log('\n[6] 桌面横屏 → 不旋转');
    const ctx6 = await browser.newContext({ viewport: { width: 1500, height: 940 } });
    const p6 = await ctx6.newPage();
    await p6.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(600);
    const desk = await p6.evaluate(() => ({
      rotModeOn: document.body.classList.contains('rotmode'),
      tf: getComputedStyle(document.getElementById('app')).transform,
    }));
    ok(!desk.rotModeOn && (desk.tf === 'none' || desk.tf === ''), '桌面端完全不受影响');
    await ctx6.close();

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
