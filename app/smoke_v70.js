'use strict';
// v7.0 浏览器实机验收：
//   [1] 公告版本 v7.0 + client 运行时镜像（EFFECT_CARDS 34 张 / CARD_RARITY 15-25-35-25 / DRAFT_MS）
//   [2] 开局选专业：去掉 ★ 档位、技能介绍完整不截断（无 line-clamp、scrollHeight 未被裁）
//   [3] 大厅「准备」按钮：未全员准备时「开始游戏」禁用；准备后开启并可开局
//   [4] 海克斯奖励卡三张翻面卡浮层：3 张卡背 → 点击 → 一起翻开 → 显示获得
//   [5] 手动发动面板（含目标选择）+ 无懈可击响应框
//   [6] 效果卡发动全屏特效：品级配色 / 卡面 / 光轴
// 依赖：已启动 server.js（默认 localhost:3000；BASE_URL 可指向线上），Playwright 在 NODE_PATH 里。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/v70shots';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  try { fs.mkdirSync(SHOT_DIR, { recursive: true }); } catch (e) {}
  const browser = await chromium.launch();
  const shot = (pg, n) => pg.screenshot({ path: path.join(SHOT_DIR, n) }).catch(() => {});
  const errors = [];
  const openLobby = async (pg, name) => {
    await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(700);
    await pg.evaluate(() => {
      try { document.querySelector('#announce').style.display = 'none'; document.querySelector('#intro').style.display = 'none'; } catch (e) {}
      document.querySelector('#lobby').style.display = 'flex';
    });
    await pg.fill('#nameInput', name).catch(() => {});
  };
  try {
    // ---------- [1] 版本 + 运行时常量 ----------
    console.log('\n[1] 公告版本 v7.0 + client 运行时常量镜像');
    const page = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(800);
    const ann = await page.evaluate(() => (document.querySelector('#intro .announce-logo') || {}).textContent || '');
    ok(/v7\.0/.test(ann), `开局公告标题：${ann.trim()}`);
    const marks = await page.evaluate(() => ({
      cards: (typeof EFFECT_CARDS !== 'undefined') ? EFFECT_CARDS.length : null,
      ssr: (typeof EFFECT_CARDS !== 'undefined') ? EFFECT_CARDS.filter(c => c.rare === 'SSR').length : null,
      w: (typeof CARD_RARITY !== 'undefined') ? [CARD_RARITY.SSR.weight, CARD_RARITY.SR.weight, CARD_RARITY.R.weight, CARD_RARITY.N.weight].join('/') : null,
      rarFn: typeof rarOf === 'function',
      draftOpen: typeof cardDraftOpen === 'function',
      panelSync: typeof cardPanelSync === 'function',
      negateSync: typeof negateSync === 'function',
      cardAct: typeof cardActFx === 'function',
      readyBtn: !!document.querySelector('#btnReady'),
      draftMs: (typeof DRAFT_MS_UI === 'undefined') ? 30000 : DRAFT_MS_UI,
    }));
    ok(marks.cards === 34, `客户端效果卡镜像 ${marks.cards} 张`);
    ok(marks.ssr >= 6, `SSR 卡 ${marks.ssr} 张`);
    ok(marks.w === '15/25/35/25', `品级权重镜像 ${marks.w}`);
    ok(marks.rarFn && marks.draftOpen && marks.panelSync && marks.negateSync && marks.cardAct, '客户端 v7.0 渲染入口齐全');
    ok(marks.readyBtn, '大厅存在「准备」按钮');

    const src = fs.readFileSync(path.join(__dirname, 'public/client.js'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, 'public/style.css'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
    ok(!/mj-tier/.test(src), '选专业界面已去掉 ★ 档位');
    ok(/const EFFECT_CARDS = \[/.test(src), 'client 镜像了 EFFECT_CARDS 表');
    ok(/\.cd-slot\.flipped/.test(css) && /cfx-ray/.test(css) && /\.ready-bar/.test(css), '翻卡 / 光轴 / 准备栏样式齐备');
    ok(/v7\.0/.test(html), 'index.html 已更新到 v7.0 公告');
    await shot(page, '10-desktop.png');
    await page.close();

    // ---------- [2] 选专业界面 ----------
    console.log('\n[2] 开局选专业：去档位 + 技能介绍完整');
    const p2 = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
    p2.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await openLobby(p2, 'v7测试');
    await sleep(300);
    await p2.evaluate(() => { const w = document.querySelector('#majorRow'); if (w && !w.children.length) { try { w.innerHTML = buildMajorHtml(null); } catch (e) {} } });
    const maj = await p2.evaluate(() => {
      const all = [...document.querySelectorAll('.major-btn')];
      const first = all[0];
      if (!first) return null;
      const sk = first.querySelector('.mj-skill');
      // 找一个最长的技能介绍，检查是否被截断
      let worst = null;
      for (const b of all) {
        const s = b.querySelector('.mj-skill');
        if (!s) continue;
        const clip = s.scrollHeight > s.clientHeight + 1;
        if (!worst || (s.innerText || '').length > (worst.len || 0)) worst = { len: (s.innerText || '').length, clip };
      }
      const cs = getComputedStyle(sk);
      return {
        n: all.length,
        tier: !!first.querySelector('.mj-tier'),
        mode: !!first.querySelector('.mj-mode'),
        use: !!first.querySelector('.mj-use'),
        clamp: cs.webkitLineClamp || cs.lineClamp || 'none',
        worst,
      };
    });
    ok(maj && maj.n >= 60, `专业按钮共 ${maj ? maj.n : 0} 个`);
    ok(maj && !maj.tier, '不再渲染档位 ★');
    ok(maj && maj.mode && maj.use, '仍保留 主动/被动 + 触发方式说明');
    ok(maj && maj.clamp === 'none', `技能介绍不再 line-clamp（实际 ${maj ? maj.clamp : '-'}）`);
    ok(maj && maj.worst && !maj.worst.clip, `最长技能介绍（${maj && maj.worst ? maj.worst.len : 0} 字）完整显示未被裁切`);
    await shot(p2, '20-majors.png');
    await p2.close();

    // ---------- [3] 大厅准备按钮 ----------
    console.log('\n[3] 大厅「准备」：未全员准备时不能开始');
    const p3 = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
    p3.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await openLobby(p3, '准备测试');
    await p3.click('#btnCreate').catch(() => {});
    await sleep(800);
    await p3.evaluate(() => { const b = document.querySelector('#btnAddAI'); if (b) b.click(); });
    await sleep(700);
    const s1 = await p3.evaluate(() => ({
      disabled: document.querySelector('#btnStart').disabled,
      hint: (document.querySelector('#readyHint') || {}).textContent || '',
      btnReady: !!(document.querySelector('#btnReady') || {}).textContent,
    }));
    ok(s1.btnReady, '准备按钮已渲染');
    ok(s1.disabled === true, '自己还没准备 → 「开始游戏」禁用');
    ok(/全员|已准备/.test(s1.hint), `提示文案：${s1.hint.trim()}`);
    await p3.click('#btnReady').catch(() => {});
    await sleep(700);
    const s2 = await p3.evaluate(() => ({
      disabled: document.querySelector('#btnStart').disabled,
      allReady: (typeof S !== 'undefined' && S) ? S.allReady : null,
      mine: (typeof S !== 'undefined' && S) ? (S.players.find(p => p.id === myPid) || {}).ready : null,
      hint: (document.querySelector('#readyHint') || {}).textContent || '',
    }));
    ok(s2.mine === true, '点击后自己进入「已准备」');
    ok(s2.allReady === true && s2.disabled === false, '真人 + AI 全部就绪 → 「开始游戏」可用');
    await shot(p3, '30-ready.png');
    // 开局并等待进入对局
    await p3.click('#btnStart').catch(() => {});
    let inGame = false;
    for (let i = 0; i < 30 && !inGame; i++) {
      await sleep(400);
      const st = await p3.evaluate(() => (typeof S !== 'undefined' && S) ? S.phase : null);
      if (st && st !== 'lobby') inGame = true;
    }
    ok(inGame, '全员准备后可正常开局（离开 lobby）');
    await p3.close();

    // ---------- [4] 三张翻面卡浮层 ----------
    console.log('\n[4] 海克斯奖励卡：三张翻面卡 → 选一张 → 一起翻开');
    const p4 = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    p4.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await openLobby(p4, '翻卡');
    await sleep(400);
    const draft = await p4.evaluate(() => {
      // 合成 DOM 检查：直接用假 offers 调 cardDraftOpen
      const offers = {
        'p1': [{ id: 'demolish', name: '拆迁令', icon: '🏚️', rare: 'SSR', desc: 'SSR 测试卡' },
               { id: 'seize', name: '夺金券', icon: '🧲', rare: 'R', desc: 'R 测试卡' },
               { id: 'repeat', name: '留级通知单', icon: '📵', rare: 'N', desc: 'N 测试卡' }],
      };
      try { window.myPidTest = 'p1'; } catch (e) {}
      return { ok: typeof cardDraftOpen === 'function', html: offers };
    });
    ok(draft.ok, 'cardDraftOpen 可调用');
    // 用真实 myPid 触发：先创建房间拿到 myPid，再构造 draft 事件
    await p4.click('#btnCreate').catch(() => {});
    await sleep(900);
    const drafted = await p4.evaluate(() => {
      if (typeof S === 'undefined' || !S || !S.players || !myPid) return null;
      const fake = ['demolish', 'seize', 'repeat'].map((id, i) => {
        const c = EFFECT_CARDS.find(x => x.id === id) || { id, name: id, icon: '🃏', rare: 'R', desc: '' };
        return { id: c.id, name: c.name, icon: c.icon, rare: c.rare, desc: c.desc };
      });
      try { cardDraftOpen({ round: 16, offers: { [myPid]: fake }, ms: 30000 }); } catch (e) { return { err: e.message }; }
      const slots = [...document.querySelectorAll('.cd-slot')];
      return {
        n: slots.length,
        backs: document.querySelectorAll('.cf-back').length,
        fronts: document.querySelectorAll('.cd-front .cf-face').length,
        flipped: document.querySelectorAll('.cd-slot.flipped').length,
        title: (document.querySelector('.cd-big') || {}).textContent || '',
      };
    });
    ok(drafted && !drafted.err, '翻卡浮层成功弹出' + (drafted && drafted.err ? '（' + drafted.err + '）' : ''));
    ok(drafted && drafted.n === 3, `渲染 3 个卡位（实际 ${drafted ? drafted.n : 0}）`);
    ok(drafted && drafted.backs === 3 && drafted.fronts === 3, '每张卡都有背面 + 正面（翻面结构）');
    ok(drafted && drafted.flipped === 0, '初始全部背面朝上');
    ok(drafted && /翻\s*面\s*卡/.test(drafted.title), `标题：${drafted ? drafted.title : ''}`);
    await shot(p4, '40-draft-face-down.png');
    // 点击第一张 → 三张一起翻开
    await p4.evaluate(() => { const s = document.querySelector('.cd-slot'); if (s) s.click(); });
    await sleep(2800);   // 揭晓动画约 1.9s（PACE=1.45），留足余量
    const after = await p4.evaluate(() => ({
      flipped: document.querySelectorAll('.cd-slot.flipped').length,
      win: document.querySelectorAll('.cd-slot.win').length,
      picked: (document.querySelector('.cd-picked') || {}).textContent || '',
    }));
    ok(after.flipped === 3, `点击后三张一起翻开（实际 ${after.flipped} 张）`);
    ok(after.win === 1, '所选那张高亮（win）');
    ok(/你获得/.test(after.picked), `揭晓文案：${after.picked.trim()}`);
    await shot(p4, '41-draft-revealed.png');
    await p4.evaluate(() => { try { cardDraftClose(); } catch (e) {} });
    await p4.close();

    // ---------- [5] 手动发动面板 + 无懈可击响应框 ----------
    console.log('\n[5] 手动发动面板 + 无懈可击响应框');
    const p5 = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    p5.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await openLobby(p5, '手牌');
    await p5.click('#btnCreate').catch(() => {});
    await sleep(900);
    // 加 1 个 AI 作为「可指定目标」（否则无人可指，目标名单为空是正确行为）
    await p5.evaluate(() => { const b = document.querySelector('#btnAddAI'); if (b) b.click(); });
    await sleep(900);
    const hand = await p5.evaluate(() => {
      if (typeof S === 'undefined' || !S || !myPid) return null;
      // 合成快照：轮到自己 + 手上 3 张可发动手牌
      S.phase = 'card';
      S.pendingCard = { pid: myPid };
      const me = S.players.find(p => p.id === myPid);
      me.hand = [{ uid: 1, id: 'seize' }, { uid: 2, id: 'demolish' }, { uid: 3, id: 'backstep' }];
      S.cur = S.players.indexOf(me);
      try { cardPanelSync(); } catch (e) { return { err: e.message }; }
      return {
        has: !!document.querySelector('.cardp'),
        cards: document.querySelectorAll('.cardp-card').length,
        skip: !!document.querySelector('#cardpSkip'),
        rar: [...document.querySelectorAll('.cp-rar')].map(e => e.textContent).join(','),
      };
    });
    ok(hand && !hand.err, '手动发动面板弹出' + (hand && hand.err ? '（' + hand.err + '）' : ''));
    ok(hand && hand.cards === 3, `渲染 3 张手牌（实际 ${hand ? hand.cards : 0}）`);
    ok(hand && hand.skip, '有「跳过，直接掷骰」按钮');
    ok(hand && /传说|史诗|稀有|普通/.test(hand.rar), `手牌显示品级（${hand ? hand.rar : ''}）`);
    await shot(p5, '50-hand-panel.png');
    // 点击需要目标的卡 → 目标选择
    const tgt = await p5.evaluate(() => {
      const btn = [...document.querySelectorAll('.cardp-card')].find(b => b.dataset.id === 'seize');
      if (btn) btn.click();
      return { has: !!document.querySelector('.cardp-targets'), n: document.querySelectorAll('.ct-btn').length };
    });
    ok(tgt.has, '需要指定对手的卡弹出目标名单');
    ok(tgt.n >= 1, `目标候选 ${tgt.n} 个`);
    await shot(p5, '51-hand-targets.png');
    // 无懈可击响应框
    const ng = await p5.evaluate(() => {
      if (typeof S === 'undefined' || !S) return null;
      try { closeCardPanel(); } catch (e) {}
      S.phase = 'negate';
      S.pendingNegate = { pid: myPid, card: 'demolish', attacker: (S.players.find(p => p.id !== myPid) || {}).id || 'p2', name: '拆迁令' };
      try { negateSync(); } catch (e) { return { err: e.message }; }
      const box = document.querySelector('.ng-box');
      return { has: !!box, txt: box ? box.innerText : '', yes: !!document.querySelector('#ngYes'), no: !!document.querySelector('#ngNo') };
    });
    ok(ng && ng.has, '无懈可击响应框弹出');
    ok(ng && ng.yes && ng.no, '提供「使用 / 不用」两个按钮');
    ok(ng && /无懈可击/.test(ng.txt) && /拆迁令/.test(ng.txt), `提示文案含卡名：${ng ? ng.txt.replace(/\s+/g, ' ').slice(0, 60) : ''}`);
    await shot(p5, '52-negate.png');
    await p5.close();

    // ---------- [6] 效果卡发动全屏特效 ----------
    console.log('\n[6] 效果卡发动全屏特效（品级配色）');
    const p6 = await browser.newPage({ viewport: { width: 1500, height: 940 } });
    p6.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await openLobby(p6, '特效');
    await p6.click('#btnCreate').catch(() => {});
    await sleep(900);
    const fx = await p6.evaluate(async () => {
      if (typeof S === 'undefined' || !S || !myPid) return null;
      const runs = [];
      for (const [card, rare] of [['demolish', 'SSR'], ['seize', 'R'], ['repeat', 'N']]) {
        const pr = cardActFx({ pid: myPid, card, rare, detail: '测试发动' });
        await new Promise(r => setTimeout(r, 260));
        const lay = document.querySelector('.cfx-layer');
        runs.push({
          rare,
          has: !!lay,
          cls: lay ? lay.className : '',
          faceCls: (document.querySelector('.cfx-layer .cf-face') || {}).className || '',
          rays: document.querySelectorAll('.cfx-layer .cfx-ray').length,
          name: (document.querySelector('.cfx-layer .cf-name') || {}).textContent || '',
        });
        await pr;
      }
      return runs;
    });
    ok(fx && fx.length === 3, '依次发动 3 张不同品级的卡');
    if (fx) {
      ok(fx.every(r => r.has), '每次都弹出全屏特效层（.cfx-layer）');
      ok(/rar-SSR/.test(fx[0].faceCls) && /rar-R\b/.test(fx[1].faceCls) && /rar-N/.test(fx[2].faceCls),
        `卡面按品级套色（${fx.map(r => r.faceCls.split(' ').pop()).join(' / ')}）`);
      ok(fx[0].rays > fx[2].rays, `SSR 光轴 ${fx[0].rays} 条 > N 光轴 ${fx[2].rays} 条（越高级越华丽）`);
      ok(fx.every(r => r.name), `特效里显示了卡名（${fx.map(r => r.name).join(' / ')}）`);
    }
    await shot(p6, '60-cardfx.png');
    await p6.close();

    ok(errors.length === 0, `全程无 JS 报错${errors.length ? '：' + errors.slice(0, 3).join(' | ') : ''}`);
  } catch (e) {
    fail++; console.log('  ✗ 冒烟异常：' + e.message);
  } finally {
    await browser.close();
  }
  console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
  process.exit(fail ? 1 : 0);
})();
