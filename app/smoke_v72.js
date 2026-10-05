'use strict';
// v7.2 浏览器实机验收：
//   [1] 客户端 FACULTY 镜像：60 个城邦 + v7.2 关键数值（激进 7 / 温和代表 / 三项特殊 / 免租轮 4）
//   [2] 合成 DOM：城邦推选浮层三张候选卡 → 点击投票 → 名牌贴卡
//   [3] 真实对局：开局推选 → 投票 → 抽签加冕 → 地图中央徽章落位（含 lead/cost 文案）
//   [4] 全程无 JS 报错
// 依赖：已启动 server.js（默认 localhost:3000；BASE_URL 可指向线上），Playwright 在 NODE_PATH 里。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/v72shots';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  try { fs.mkdirSync(SHOT_DIR, { recursive: true }); } catch (e) {}
  const browser = await chromium.launch();
  const shot = (pg, n) => pg.screenshot({ path: path.join(SHOT_DIR, n) }).catch(() => {});
  const errors = [];

  try {
    // ---------- [1] 客户端 FACULTY 镜像 + v7.2 数值 ----------
    console.log('\n[1] 客户端 FACULTY 镜像（60 个城邦 + v7.2 数值）');
    const page = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(800);
    const F = await page.evaluate(() => {
      if (typeof FACULTY === 'undefined') return null;
      const g = k => (FACULTY[k] || {});
      const keys = Object.keys(FACULTY);
      return {
        n: keys.length,
        urban: [g('urban').lead, g('urban').cost].join(' | '),
        finance: [g('finance').lead, g('finance').cost].join(' | '),
        art: [g('art').lead, g('art').cost].join(' | '),
        gala: [g('gala').lead, g('gala').cost].join(' | '),
        freeRent: [g('freeRent').lead, g('freeRent').tag].join(' | '),
        tech: g('tech').lead,
        metro: [g('metro').lead, g('metro').cost].join(' | '),
        gamble: g('gamble').lead,
        biz: [g('biz').lead, g('biz').cost].join(' | '),
        med: g('med').lead,
        park: g('park').lead,
        silent: [g('silent').lead, g('silent').cost].join(' | '),
        garden: [g('garden').lead, g('garden').cost].join(' | '),
        intl: g('intl').lead,
        general: g('general').lead,
        book: g('book').lead,
        life: [g('life').lead, g('life').cost].join(' | '),
        dorm: g('dorm').lead,
        liberal: g('liberal').lead,
        veteran: g('veteran').lead,
        charity: [g('charity').lead, g('charity').cost].join(' | '),
        dicegod: g('dicegod').lead,
        reunion: [g('reunion').lead, g('reunion').cost].join(' | '),
        artfest: [g('artfest').lead, g('artfest').cost].join(' | '),
        ancient: g('ancient').lead,
        lantern: g('lantern').lead,
        hxSilver: g('hxSilver').lead,
      };
    });
    ok(!!F, '客户端 FACULTY 已加载');
    ok(F && F.n === 60, `城邦总数 ${F ? F.n : 0} 个（期望 60）`);

    // 激进档（1/5/34/36/38/42/53）
    ok(/\+500/.test(F.urban) && /¥400/.test(F.urban), `① 都市：${F.urban.slice(0, 46)}…`);
    ok(/12%/.test(F.tech) && /30%/.test(F.tech), `⑤ 理工：${F.tech.slice(0, 40)}…`);
    ok(/0\.70/.test(F.metro) && /1\.20/.test(F.metro), `③⑧ 地铁：${F.metro.slice(0, 40)}…`);
    ok(/1\.6/.test(F.gamble) && /1\.5/.test(F.gamble), `④② 博弈：${F.gamble.slice(0, 36)}…`);
    ok(/62%/.test(F.biz) && /6%/.test(F.biz), `⑤③ 商科：${F.biz.slice(0, 36)}…`);

    // 温和档代表
    ok(/7%/.test(F.garden) && /20%/.test(F.garden), `② 园林：${F.garden.slice(0, 40)}…`);
    ok(/1\.25/.test(F.intl) && /\+¥300/.test(F.intl), `⑦ 国际：${F.intl.slice(0, 40)}…`);
    ok(/450/.test(F.general), `⑪ 综合：${F.general.slice(0, 40)}…`);
    ok(/450/.test(F.book), `⑯ 书香：${F.book.slice(0, 40)}…`);
    ok(/0\.80/.test(F.life) && /250/.test(F.life), `⑰ 生活区：${F.life.slice(0, 40)}…`);
    ok(/1600/.test(F.dorm) && /30%/.test(F.dorm), `㉔ 宿舍：${F.dorm.slice(0, 40)}…`);
    ok(/400/.test(F.liberal), `㉕ 通识：${F.liberal.slice(0, 40)}…`);
    ok(/免租金卡/.test(F.veteran) && /600/.test(F.veteran), `㉖ 老生：${F.veteran.slice(0, 40)}…`);
    ok(/1800/.test(F.charity) && /600/.test(F.charity), `㉗ 公益：${F.charity.slice(0, 44)}…`);
    ok(/\+3 步/.test(F.dicegod) && /−2 步/.test(F.dicegod), `㉘ 骰神：${F.dicegod.slice(0, 40)}…`);
    ok(/0\.85/.test(F.silent) && /18%/.test(F.silent), `㊲ 自习：${F.silent.slice(0, 44)}…`);
    ok(/4500/.test(F.park) && /1 轮/.test(F.park), `⑮ 科技园区：${F.park.slice(0, 40)}…`);
    ok(/1\.2/.test(F.reunion), `㊶ 聚餐：${F.reunion.slice(0, 44)}…`);
    ok(/1000/.test(F.med) && /20%/.test(F.med) && /2000/.test(F.med), `⑪ 医学：${F.med.slice(0, 46)}…`);
    ok(/1200/.test(F.ancient), `③ 百年学府：${F.ancient.slice(0, 46)}…`);
    ok(/1500/.test(F.lantern), `㉙ 灯会：${F.lantern.slice(0, 44)}…`);
    ok(/R 效果卡/.test(F.hxSilver), `海克斯·白银学城：${F.hxSilver.slice(0, 46)}…`);

    // 三项特殊
    ok(/32000/.test(F.finance) && /800/.test(F.finance) && /1\.5/.test(F.finance), `⑨ 金融：${F.finance.slice(0, 52)}…`);
    ok(/降低 1/.test(F.finance) && /建筑与地皮/.test(F.finance), `⑨ 金融代价（建筑与地皮各 −1）：${(F.finance.split('|')[1] || '').trim()}`);
    ok(/多抽 2 张/.test(F.art) && /SR/.test(F.art) && /\+5%/.test(F.art), `⑬ 艺术：${F.art.slice(0, 52)}…`);
    ok(/1200/.test(F.gala) && /1\.04/.test(F.gala), `㊸ 校友日：${F.gala.slice(0, 48)}…`);
    ok(/R 及以上/.test(F.artfest) && /10%/.test(F.artfest), `㊹ 艺术节（必出 R 及以上）：${F.artfest.slice(0, 48)}…`);

    // 免租轮 5 → 4
    ok(/随机 4 轮/.test(F.freeRent) && /这四轮/.test(F.freeRent), `㉓ 免租轮降为 4 轮：${F.freeRent.slice(0, 34)}…`);

    const src = fs.readFileSync(path.join(__dirname, 'public/client.js'), 'utf8');
    const gsrc = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
    ok((gsrc.match(/^\s{1,2}[A-Za-z][A-Za-z0-9]*:\s*\{/gm) || []).length >= 60, 'game.js FACULTY 表行数 ≥ 60');
    ok(/v7\.2/.test(gsrc), 'game.js 含 v7.2 标记注释');
    ok(/FUND_CAP \* 1\.6/.test(gsrc) || /32000/.test(gsrc), 'game.js 金融池上限已落地 32000');
    ok(/0\.62/.test(gsrc) && /1\.06/.test(gsrc), 'game.js 商科抵押 62% / 赎回 6% 已落地');
    await shot(page, '10-lobby.png');

    // ---------- [2] 合成 DOM：推选浮层 ----------
    console.log('\n[2] 城邦推选浮层：三张候选卡 + 投票贴名牌');
    const p2 = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    p2.on('pageerror', e => errors.push('PAGEERROR(推选): ' + e.message));
    await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(700);
    await p2.evaluate(() => {
      try { document.querySelector('#announce').style.display = 'none'; document.querySelector('#intro').style.display = 'none'; } catch (e) {}
      document.querySelector('#lobby').style.display = 'flex';
    });
    await p2.fill('#nameInput', '风貌测试').catch(() => {});
    await p2.click('#btnCreate').catch(() => {});
    await sleep(900);
    const v = await p2.evaluate(() => {
      if (typeof facOpenVote !== 'function') return { err: 'facOpenVote 不存在' };
      if (typeof facCloseUI === 'function') facCloseUI();
      facOpenVote({ options: ['urban', 'finance', 'art'], ms: 30000, termStart: 1 });
      const d = document.querySelector('.fac-layer');
      if (!d) return { err: '浮层未渲染' };
      return {
        cards: d.querySelectorAll('.fv-card').length,
        names: [...d.querySelectorAll('.fv-name')].map(e => e.textContent).join('/'),
        leads: [...d.querySelectorAll('.fv-line')].map(e => e.textContent).length,
        clock: (d.querySelector('#fvClock') || {}).textContent || '',
        big: (d.querySelector('.fv-big') || {}).textContent || '',
        kicker: (d.querySelector('.fv-kicker') || {}).textContent || '',
      };
    });
    ok(!v.err, '推选浮层弹出' + (v.err ? '（' + v.err + '）' : ''));
    ok(v.cards === 3, `三张候选卡（实际 ${v.cards}）`);
    ok(/都市校区/.test(v.names) && /金融校区/.test(v.names) && /艺术校区/.test(v.names), `候选名单：${v.names}`);
    ok(v.leads >= 6, `每张卡都带「主效果 + 代价」两行（共 ${v.leads} 行）`);
    ok(/校园风貌/.test(v.big), `牌匾标题：${v.big.trim()}`);
    ok(/校 园 风 貌 推 选/.test(v.kicker), `届次抬头：${v.kicker.trim()}`);
    await sleep(1200);
    await shot(p2, '20-fac-vote.png');

    const voted = await p2.evaluate(() => {
      const c = document.querySelector('.fv-card[data-key="finance"]');
      if (!c) return { err: '找不到金融卡' };
      c.click();
      // 名牌由服务端 vote 回执（facMarkVote）贴上；合成场景里手动补一次回执再断言
      if (typeof facMarkVote === 'function') facMarkVote({ pid: (typeof myPid !== 'undefined') ? myPid : 'p1', key: 'finance' }, true);
      return {
        picked: c.classList.contains('picked'),
        my: (typeof facMyVote !== 'undefined') ? facMyVote : null,
        chip: !!c.querySelector('.fv-chip'),
        chipTxt: (c.querySelector('.fv-chip') || {}).textContent || '',
      };
    });
    ok(!voted.err && voted.picked, '点击卡片后标记为已投（picked）');
    ok(voted.my === 'finance', `本地记票 facMyVote = ${voted.my}`);
    ok(voted.chip, `卡面贴上投票者名牌（.fv-chip：「${voted.chipTxt}」）`);
    await shot(p2, '21-fac-voted.png');
    await p2.close();

    // ---------- [3] 真实对局：推选 → 加冕 → 徽章落位 ----------
    console.log('\n[3] 真实对局：开局推选 → 抽签加冕 → 中央徽章落位');
    const p3 = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    p3.on('pageerror', e => errors.push('PAGEERROR(对局): ' + e.message));
    await p3.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(700);
    await p3.click('#btnAnnounce'); await sleep(240);
    await p3.click('#btnIntro'); await sleep(240);
    await p3.click('#btnRulesClose').catch(() => {});
    await sleep(220);
    await p3.fill('#nameInput', '验收员');
    await p3.click('#btnCreate'); await sleep(400);
    await p3.click('#btnAddAI'); await sleep(200);
    await p3.evaluate(() => { const b = document.querySelector('#btnReady'); if (b && !b.classList.contains('on')) b.click(); });
    await sleep(700);
    await p3.click('#btnStart');
    await p3.waitForSelector('.fac-layer.show', { timeout: 20000 });
    await sleep(1500);
    const real = await p3.evaluate(() => {
      const d = document.querySelector('.fac-layer');
      return {
        cards: d ? d.querySelectorAll('.fv-card').length : 0,
        names: d ? [...d.querySelectorAll('.fv-name')].map(e => e.textContent).join('/') : '',
      };
    });
    ok(real.cards === 3, `真实对局弹出 3 张候选（实际 ${real.cards}）：${real.names}`);
    await shot(p3, '30-real-vote.png');

    await p3.evaluate(() => { const c = document.querySelector('.fv-card'); if (c) c.click(); });
    await sleep(600);
    // 等抽签加冕结束 → S.faculty 落定
    let t0 = Date.now(), fac = null;
    while (Date.now() - t0 < 60000) {
      fac = await p3.evaluate(() => (typeof S !== 'undefined' && S) ? S.faculty : null);
      if (fac) break;
      await sleep(600);
    }
    ok(!!fac, `抽签加冕完成，本届风貌 = ${fac}`);
    await sleep(2500);
    const badge = await p3.evaluate(() => {
      const g = document.querySelector('#facBadge');
      if (!g) return null;
      const txt = [...g.querySelectorAll('text')].map(e => e.textContent).join(' ');
      return { txt, has: (g.innerHTML || '').length > 50, rects: g.querySelectorAll('rect').length };
    });
    ok(!!badge && badge.has, '地图中央徽章已渲染（#facBadge）');
    ok(!!badge && /本届校园风貌/.test(badge.txt), `徽章抬头：${badge ? badge.txt.slice(0, 40) : ''}…`);
    const facName = await p3.evaluate(() => (FACULTY[(typeof S !== 'undefined' && S) ? S.faculty : ''] || {}).name || '@@');
    ok(!!badge && badge.txt.indexOf(facName) >= 0, `徽章显示本届风貌名「${facName}」`);
    await shot(p3, '40-real-badge.png');

    // 点徽章 → 详情浮层
    const det = await p3.evaluate(() => {
      const g = document.querySelector('#facBadge');
      if (g) g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    });
    await sleep(700);
    const detTxt = await p3.evaluate(() => {
      const d = document.querySelector('.fd-panel') || document.querySelector('.fac-detail');
      return d ? d.innerText.slice(0, 200) : '';
    });
    ok(det && detTxt.length > 20, `点徽章展开详情浮层：${detTxt.replace(/\s+/g, ' ').slice(0, 60)}…`);
    await shot(p3, '50-fac-detail.png');
    await p3.close();

    ok(errors.length === 0, `全程无 JS 报错${errors.length ? '：' + errors.slice(0, 3).join(' | ') : ''}`);
    await page.close();
  } catch (e) {
    fail++; console.log('  ✗ 冒烟异常：' + e.message);
  } finally {
    await browser.close();
  }
  console.log(`\n=== v7.2 实机验收：${pass} 通过 / ${fail} 失败 ===`);
  process.exit(fail ? 1 : 0);
})();
