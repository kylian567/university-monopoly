'use strict';
// v7.1 浏览器实机验收：
//   [1] 公告/HTML 版本 v7.1 + 客户端 FACULTY 时光之城镜像（全部提前）
//   [2] 海克斯选择流程：放射光轴 / 三层光环 / 档位徽章 / 候选序号 / 扫光 / 悬停光晕
//   [3] 档位差异：银 10 轴 / 金 14 轴 / 彩 20 轴 + 徽章 t-prism
//   [4] 点击立项：光柱落下 → 印章盖下 → 其余卡置灰
//   [5] 结算横幅内嵌「立项卡面 + 印章」
// 依赖：已启动 server.js（默认 localhost:3000；BASE_URL 可指向线上），Playwright 在 NODE_PATH 里。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/v71shots';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  try { fs.mkdirSync(SHOT_DIR, { recursive: true }); } catch (e) {}
  const browser = await chromium.launch();
  const shot = (pg, n) => pg.screenshot({ path: path.join(SHOT_DIR, n) }).catch(() => {});
  const errors = [];

  // 在大厅里合成打开「研究项目三选一」浮层（大厅不跑对局 state 分支，浮层不会被快照兜底关掉）
  const openHex = (pg, tier, round) => pg.evaluate(([tier, round]) => {
    if (typeof closeHexUI === 'function') closeHexUI();
    const keys = Object.keys(PROJECTS).slice(0, 3);
    const pid = (typeof myPid !== 'undefined' && myPid != null) ? myPid : null;
    projectOpenPick({ round: round, tier: tier, offers: { [String(pid)]: keys }, picks: {}, ms: 60000 });
    const d = document.querySelector('.hx-layer');
    if (!d) return { has: false };
    const card = d.querySelector('.hx-card');
    return {
      has: true,
      rays: d.querySelectorAll('.hx-rays .hx-ray').length,
      orbit: d.querySelectorAll('.hx-orbit i').length,
      badge: !!d.querySelector('.hx-badge'),
      badgeCls: (d.querySelector('.hx-badge') || {}).className || '',
      cards: d.querySelectorAll('.hx-card').length,
      cand: (d.querySelector('.hx-cand') || {}).textContent || '',
      sheen: d.querySelectorAll('.hx-card > .hx-sheen').length,
      aura: d.querySelectorAll('.hx-card > .hx-aura').length,
      pillar: d.querySelectorAll('.hx-card > .hx-pillar').length,
      stamp: d.querySelectorAll('.hx-card > .hx-stamp').length,
      tierCls: (d.querySelector('.hx-panel') || {}).className || '',
      card0: !!card,
    };
  }, [tier, round]);

  try {
    // ---------- [1] 版本 + 镜像 ----------
    console.log('\n[1] 版本 v7.1 + 客户端时光之城镜像');
    const page = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(800);
    const ann = await page.evaluate(() => (document.querySelector('#intro .announce-logo') || {}).textContent || '');
    ok(/v7\.[1-4]/.test(ann), `开局公告标题：${ann.trim()}`);
    const sub = await page.evaluate(() => (document.querySelector('.announce-sub') || {}).textContent || '');
    ok(/v7\.[1-4]/.test(sub), `副标题版本号：${sub.trim()}`);

    const mir = await page.evaluate(() => {
      const F = (typeof FACULTY !== 'undefined') ? FACULTY.hexEarly : null;
      return { lead: F ? F.lead : null, cost: F ? F.cost : null, name: F ? F.name : null };
    });
    ok(mir.name === '时光之城', `客户端镜像到 ${mir.name}`);
    ok(/全部提前/.test(mir.lead || ''), `lead 写明「全部提前」：${(mir.lead || '').slice(0, 30)}…`);
    ok(/2\/6\/12/.test(mir.lead || '') && /89\/101/.test(mir.lead || ''), 'lead 列出完整 12 个提前轮次（v7.4）');
    ok(/101/.test(mir.cost || ''), `cost 随动为第 101 轮后无立项：${mir.cost}`);

    const src = fs.readFileSync(path.join(__dirname, 'public/client.js'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, 'public/style.css'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
    ok(/v7\.[1-4]/.test(html), 'index.html 已更新到 v7.x');
    ok(/hx-rays/.test(src) && /hx-orbit/.test(src) && /hx-badge/.test(src), 'client.js 已渲染光轴/光环/徽章');
    ok(/hxBadge/.test(css) && /hxStamp/.test(css) && /hxPillar/.test(css) && /hxSeal/.test(css), 'CSS 四个关键 keyframes 齐备');
    await shot(page, '10-lobby.png');

    // ---------- [2] 海克斯选择流程（银档） ----------
    console.log('\n[2] 海克斯选择流程美化（银档）');
    const s = await openHex(page, 'silver', 8);
    ok(s.has, '三选一浮层已弹出');
    ok(s.rays === 10, `银档背景放射光轴 ${s.rays} 条（期望 10）`);
    ok(s.orbit === 3, `三层旋转光环已渲染（${s.orbit} 个）`);
    ok(s.badge && /t-silver/.test(s.badgeCls), `档位徽章已渲染（${s.badgeCls}）`);
    ok(s.cards === 3, `三张候选卡（实际 ${s.cards}）`);
    ok(/候选 1/.test(s.cand), `卡面候选序号徽章：${s.cand.trim()}`);
    ok(s.sheen === 3 && s.aura === 3, `每张卡都有扫光与悬停光晕（${s.sheen}/${s.aura}）`);
    ok(s.pillar === 3 && s.stamp === 3, '每张卡都预置了光柱与印章节点');
    await sleep(1200);
    await shot(page, '20-hex-silver.png');

    // ---------- [3] 档位差异 ----------
    console.log('\n[3] 档位差异：银 10 / 金 14 / 彩 20 轴');
    const g = await openHex(page, 'gold', 16);
    ok(g.rays === 14, `金档放射光轴 ${g.rays} 条（期望 14）`);
    ok(/t-gold/.test(g.badgeCls), `金档徽章：${g.badgeCls}`);
    await shot(page, '30-hex-gold.png');
    const pr = await openHex(page, 'prism', 25);
    ok(pr.rays === 20, `彩档放射光轴 ${pr.rays} 条（期望 20）`);
    ok(/t-prism/.test(pr.badgeCls), `彩档徽章：${pr.badgeCls}`);
    ok(/t-prism/.test(pr.tierCls), `面板按彩档套色：${pr.tierCls}`);
    await sleep(1200);
    await shot(page, '40-hex-prism.png');

    // ---------- [4] 点击立项：光柱 + 印章 ----------
    console.log('\n[4] 点击立项：光柱落下 → 印章盖下');
    await openHex(page, 'gold', 32);
    await sleep(600);
    const clicked = await page.evaluate(() => {
      const d = document.querySelector('.hx-layer');
      const c = d && d.querySelector('.hx-card');
      if (!c) return { okClick: false };
      c.click();
      return { okClick: true, picked: c.classList.contains('picked') };
    });
    ok(clicked.okClick && clicked.picked, '点击后该卡标记为已立项（picked）');
    await sleep(500);   // 光柱 180ms 后印章盖下
    const fx = await page.evaluate(() => {
      const d = document.querySelector('.hx-layer');
      if (!d) return { gone: true };
      const c = d.querySelector('.hx-card.picked');
      return {
        gone: false,
        pillarOn: !!(c && c.querySelector('.hx-pillar.on')),
        stampOn: !!(c && c.querySelector('.hx-stamp.on')),
        waiting: d.classList.contains('waiting'),
        stampTxt: c ? getComputedStyle(c.querySelector('.hx-stamp'), '::before').content : '',
      };
    });
    ok(!fx.gone && fx.pillarOn, '光柱已点亮（.hx-pillar.on）');
    ok(!fx.gone && fx.stampOn, '印章已盖下（.hx-stamp.on）');
    ok(!fx.gone && fx.waiting, '其余卡进入置灰等待态（.waiting）');
    ok(/已/.test(fx.stampTxt || ''), `印章文字：${fx.stampTxt}`);
    await shot(page, '50-hex-picked.png');

    // ---------- [5] 真实对局：第 2 轮立项全流程 + 结算卡面 ----------
    console.log('\n[5] 真实对局：第 2 轮立项全流程（含结算内嵌卡面）');
    const p5 = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    p5.on('pageerror', e => errors.push('PAGEERROR(对局): ' + e.message));
    await p5.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(700);
    await p5.click('#btnAnnounce'); await sleep(240);
    await p5.click('#btnIntro'); await sleep(240);
    await p5.click('#btnRulesClose').catch(() => {});
    await sleep(220);
    await p5.fill('#nameInput', '验收员');
    await p5.click('#btnCreate'); await sleep(400);
    await p5.click('#btnAddAI'); await sleep(200);
    await p5.evaluate(() => { const b = document.querySelector('#btnReady'); if (b && !b.classList.contains('on')) b.click(); });
    await sleep(700);
    await p5.click('#btnStart');
    await p5.waitForSelector('.fac-layer.show', { timeout: 15000 });
    await sleep(1200);
    await p5.evaluate(() => { const c = document.querySelector('.fv-card'); if (c) c.click(); });
    let t0 = Date.now();
    while (Date.now() - t0 < 45000) {
      const ph = await p5.evaluate(() => (typeof S !== 'undefined' && S) ? S.phase : null);
      if (ph === 'roll') break;
      await sleep(500);
    }
    // 走完第 1 轮 → 第 2 轮触发 project_offer
    t0 = Date.now();
    let opened = false;
    while (Date.now() - t0 < 90000) {
      opened = await p5.evaluate(() => !!document.querySelector('.hx-layer'));
      if (opened) break;
      await p5.evaluate(() => { try { if (S && S.phase === 'roll' && S.players[S.cur].id === myPid) act({ type: 'roll' }); } catch (e) {} });
      await sleep(1200);
      await p5.evaluate(() => { try { act({ type: 'confirmRoll' }); } catch (e) {} });
      await sleep(800);
      // 通用解堵：轮到我但停在询问相位就选"否"，避免回合卡死（v7.0 多了 card 相位）
      await p5.evaluate(() => {
        try {
          if (!S || S.players[S.cur].id !== myPid) return;
          if (S.phase === 'buy') act({ type: 'decline' });
          else if (S.phase === 'build') act({ type: 'skipBuild' });
          else if (S.phase === 'skill') act({ type: 'skipSkill' });
          else if (S.phase === 'invest') act({ type: 'declineInvest' });
          else if (S.phase === 'branch') act({ type: 'declineBranch' });
          else if (S.phase === 'card') act({ type: 'skipCard' });
        } catch (e) {}
      });
      await sleep(400);
    }
    ok(opened, '真实对局第 2 轮弹出「研究项目」三选一浮层');
    if (opened) {
      await sleep(2000);
      const real = await p5.evaluate(() => {
        const d = document.querySelector('.hx-layer');
        return {
          rays: d ? d.querySelectorAll('.hx-rays .hx-ray').length : 0,
          orbit: d ? d.querySelectorAll('.hx-orbit i').length : 0,
          badge: !!(d && d.querySelector('.hx-badge')),
          cand: d ? d.querySelectorAll('.hx-cand').length : 0,
          sheen: d ? d.querySelectorAll('.hx-card > .hx-sheen').length : 0,
          cards: d ? d.querySelectorAll('.hx-card').length : 0,
        };
      });
      ok(real.rays >= 10, `真实对局背景放射光轴 ${real.rays} 条`);
      ok(real.orbit === 3, `真实对局三层旋转光环（${real.orbit} 个）`);
      ok(real.badge, '真实对局档位徽章已渲染');
      ok(real.cards === 3 && real.cand === 3, `三张候选卡都有序号徽章（${real.cand}/${real.cards}）`);
      ok(real.sheen === 3, `三张候选卡都有扫光（${real.sheen}）`);
      await shot(p5, '70-real-hex.png');

      const pk = await p5.evaluate(() => {
        const c = document.querySelector('.hx-card');
        if (!c) return { clicked: false };
        c.click();
        return { clicked: true, picked: c.classList.contains('picked') };
      });
      ok(pk.clicked && pk.picked, '真实对局点卡即锁定（picked）');
      await sleep(380);
      const sr = await p5.evaluate(() => {
        const c = document.querySelector('.hx-card.picked');
        return c ? { gone: false, pillar: !!c.querySelector('.hx-pillar.on'), stamp: !!c.querySelector('.hx-stamp.on') } : { gone: true };
      });
      ok(sr.gone || sr.pillar, '真实对局光柱已点亮（若已结算关闭亦算通过）');
      ok(sr.gone || sr.stamp, '真实对局印章已盖下（若已结算关闭亦算通过）');
      await shot(p5, '80-real-picked.png');

      // 等结算横幅（横幅里内嵌立项卡面 + 「立项」红章）
      t0 = Date.now();
      let grant = null;
      while (Date.now() - t0 < 60000) {
        grant = await p5.evaluate(() => {
          const el = document.querySelector('.announce .hx-grant');
          if (!el) return null;
          return {
            name: (el.querySelector('.hg-name') || {}).textContent || '',
            tier: (el.querySelector('.hg-tier') || {}).textContent || '',
            seal: (el.querySelector('.hg-seal') || {}).textContent || '',
            cls: el.className,
          };
        });
        if (grant) break;
        await sleep(500);
      }
      ok(!!grant, '结算横幅内嵌「立项卡面」（.hx-grant）');
      if (grant) {
        ok((grant.name || '').length > 0, `卡面项目名：${grant.name}`);
        ok((grant.seal || '').indexOf('立项') >= 0, `红色印章：${grant.seal}`);
        ok(/t-(silver|gold|prism)/.test(grant.cls || ''), `按档位套色：${grant.cls}`);
      }
      await shot(p5, '90-real-grant.png');
    }
    await p5.close();

    ok(errors.length === 0, `全程无 JS 报错${errors.length ? '：' + errors.join(' | ') : ''}`);
    await page.close();
  } catch (e) {
    fail++; console.log('  ✗ 异常：' + e.message);
  } finally {
    await browser.close();
    console.log(`\n=== v7.1 实机验收：${pass} 通过 / ${fail} 失败 ===`);
    process.exit(fail ? 1 : 0);
  }
})();
