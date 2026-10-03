'use strict';
// v5.2 浏览器实机验收：校园风貌的全流程 —— 开局投票浮层 → 三候选卡 → 点击投票 →
// 抽签滚筒（第三幕）→ 加冕大徽章（第四幕）→ 地图中央常驻徽章 → 点击展开详情浮层。
// 依赖：已启动 server.js（默认 localhost:3000；BASE_URL 可指向线上链接），Playwright 在 NODE_PATH 里。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/v52shots';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };

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
    await page.waitForTimeout(700);
    await page.click('#btnAnnounce'); await page.waitForTimeout(220);
    await page.click('#btnIntro'); await page.waitForTimeout(220);

    console.log('\n[1] 建房 + 3 个 AI + 开局 → 应先弹出「校园风貌推选」浮层');
    await page.fill('#nameInput', '验收员');
    await page.click('#btnCreate');
    await page.waitForTimeout(400);
    for (let i = 0; i < 3; i++) { await page.click('#btnAddAI'); await page.waitForTimeout(200); }
    await page.click('#btnStart');
    await page.waitForSelector('.fac-layer.show', { timeout: 8000 });
    await page.waitForTimeout(1300);   // 等浮层淡入与三张卡翻正
    const vote = await page.evaluate(() => ({
      cards: document.querySelectorAll('.fac-layer .fv-card').length,
      names: [...document.querySelectorAll('.fac-layer .fv-card .fv-name')].map(e => e.textContent),
      title: (document.querySelector('.fac-layer .fv-big') || {}).textContent || '',
      hasBar: !!document.querySelector('#fvBarFill'),
      clock: (document.querySelector('#fvClock') || {}).textContent || '',
      fixed: getComputedStyle(document.querySelector('.fac-layer')).position,
      inView: document.querySelector('.fac-layer').getBoundingClientRect().width > 400,
    }));
    ok(vote.cards === 3, `投票浮层列出 3 个候选：${vote.names.join(' / ')}`);
    ok(vote.title.includes('校园风貌'), `浮层标题：${vote.title}`);
    ok(vote.hasBar && Number(vote.clock) > 0, `倒计时在跑（剩余 ${vote.clock} 秒）`);
    ok(vote.fixed === 'fixed' && vote.inView, `浮层铺满整屏（position:${vote.fixed}）`);
    await shot('01-vote.png');

    console.log('\n[2] 点击一张候选卡投票');
    await page.click('.fac-layer .fv-card:nth-child(2)');
    await page.waitForTimeout(500);
    const voted = await page.evaluate(() => ({
      picked: document.querySelectorAll('.fac-layer .fv-card.picked').length,
      chips: document.querySelectorAll('.fac-layer .fv-chip').length,
    }));
    ok(voted.picked === 1, '我投的那张卡被标记为已投');
    ok(voted.chips >= 1, `票数名牌已出现（${voted.chips} 枚）`);

    console.log('\n[3] 第三幕：抽签滚筒（随机抽一位玩家）');
    await page.waitForSelector('.fac-layer.lottery', { timeout: 20000 });
    await page.waitForSelector('.fv-draw.show', { timeout: 8000 });
    await page.waitForTimeout(900);
    const rollTxt = await page.evaluate(() => (document.querySelector('#fvRoll') || {}).textContent || '');
    ok(rollTxt.length > 0 && rollTxt !== '—', `滚筒正在滚动玩家名字：${rollTxt}`);
    await shot('02-draw.png');
    await page.waitForSelector('#fvRoll.hit', { timeout: 15000 });
    const hitName = await page.evaluate(() => (document.querySelector('#fvRoll') || {}).textContent || '');
    ok(hitName.length > 0, `抽中玩家已定格：${hitName}`);
    await page.waitForSelector('.fac-layer .fv-card.lucky', { timeout: 8000 });
    const lucky = await page.evaluate(() => document.querySelectorAll('.fac-layer .fv-card.lucky').length);
    ok(lucky === 1, '被抽中玩家所投的那张卡高亮显示');
    ok(await page.evaluate(() => document.querySelectorAll('.fac-layer .fv-card.dim').length) === 2, '其余两张候选被压暗');

    console.log('\n[4] 第四幕：加冕大徽章');
    await page.waitForSelector('.fv-crown.show', { timeout: 15000 });
    await page.waitForTimeout(900);   // 等加冕徽章的升起动画落定（opacity/scale 过渡 .6s）
    const crown = await page.evaluate(() => ({
      name: (document.querySelector('.fv-crown .fc-name') || {}).textContent || '',
      ico: (document.querySelector('.fv-crown .fc-ico') || {}).textContent || '',
      lines: [...document.querySelectorAll('.fv-crown .fc-line')].map(e => e.textContent),
      by: (document.querySelector('.fv-crown .fc-by') || {}).textContent || '',
      op: getComputedStyle(document.querySelector('.fv-crown')).opacity,
    }));
    ok(crown.name.length > 0 && Number(crown.op) > 0.9, `加冕徽章已升起：${crown.ico} ${crown.name}`);
    ok(crown.lines.length === 2, `徽章同时写明主效果与代价：${crown.lines.join(' ｜ ')}`);
    ok(crown.by.includes('选票'), `点明由谁的选票决定：${crown.by}`);
    await shot('03-crown.png');

    console.log('\n[5] 徽章落到地图中央，永久常驻');
    await page.waitForFunction(() => !document.querySelector('.fac-layer'), { timeout: 20000 });
    await page.waitForTimeout(400);
    const badge = await page.evaluate(() => {
      const g = document.getElementById('facBadge');
      const txt = g ? g.textContent : '';
      const b = g ? g.getBBox() : null;
      const card = { x: 430, y: 288, w: 640, h: 356 };
      return {
        exists: !!g, kids: g ? g.childElementCount : 0, txt,
        inside: b ? (b.x >= card.x - 4 && b.x + b.width <= card.x + card.w + 4) : false,
        cx: b ? b.x + b.width / 2 : 0, cy: b ? b.y + b.height / 2 : 0,
        boardCx: 750, boardCy: 466,
      };
    });
    const stateMatch = await page.evaluate(() => {
      const nm = (S && S.faculty && FACULTY[S.faculty]) ? FACULTY[S.faculty].name : null;
      return { key: S ? S.faculty : null, name: nm, badgeTxt: document.getElementById('facBadge').textContent };
    });
    ok(badge.exists && badge.kids >= 6, `中央徽章已渲染（${badge.kids} 个图形元素）`);
    ok(badge.inside, '徽章完整落在中央看板范围内（不会被挤到看板外）');
    ok(Math.abs(badge.cx - badge.boardCx) < 40 && Math.abs(badge.cy - badge.boardCy) < 200, `徽章居中于地图中央（x=${badge.cx.toFixed(0)}，看板中心 750）`);
    ok(stateMatch.name && badge.txt.includes(stateMatch.name), `徽章内容 == 本局风貌「${stateMatch.name}」`);
    await shot('04-badge.png');

    console.log('\n[6] 点击徽章展开详情浮层');
    await page.evaluate(() => document.getElementById('facBadge').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await page.waitForSelector('.fac-detail.show', { timeout: 5000 });
    const detail = await page.evaluate(() => ({
      cells: document.querySelectorAll('.fac-detail .fd-cell').length,
      on: document.querySelectorAll('.fac-detail .fd-cell.on').length,
      phone: FACULTY_KEYS.length,
      name: (document.querySelector('.fac-detail .fd-name') || {}).textContent || '',
    }));
    ok(detail.cells === 23, `详情浮层列出全部 ${detail.cells} 个校园风貌`);
    ok(detail.on === 1, '当前本局风貌被高亮标记');
    ok(detail.name.length > 0, `详情浮层显示本局风貌：${detail.name}`);
    await shot('05-detail.png');
    await page.click('.fac-detail .fd-close');
    await page.waitForTimeout(600);
    ok(await page.evaluate(() => !document.querySelector('.fac-detail')), '详情浮层可正常关闭');

    console.log('\n[7] 引擎与前端镜像一致性（运行时）');
    const mirror = await page.evaluate(() => {
      const bad = FACULTY_KEYS.filter(k => !FACULTY[k] || !FACULTY[k].name);
      return { n: FACULTY_KEYS.length, bad: bad.length, facUses: typeof facOpenVote };
    });
    ok(mirror.n === 23 && mirror.bad === 0, `前端 FACULTY 镜像 ${mirror.n} 项齐全`);
    ok(mirror.facUses === 'function', '风貌演出函数已挂到全局');

    console.log('\n[8] 控制台无报错');
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
