// 没事就玩大富翁 · 客户端
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// ---------- 棋盘几何（v5.0：主路线改「环形」，16 列 × 10 行 = 48 格；棋盘为宽长方形 1500 × 940） ----------
const VIEWW = 1500, VIEWH = 940;         // 棋盘画布尺寸（宽长方形，给地图更多横向空间）
const COLS = 16, ROWS = 10;              // 环形外圈列数 / 行数
const CW = VIEWW / COLS, CH = VIEWH / ROWS;  // 格子宽 93.75 / 高 94 —— 接近正方形，名称与价格能放大
const PAD = 0;
const GX = c => PAD + c * CW;            // grid col -> x
const GY = r => PAD + r * CH;            // grid row -> y
const CS = CW;                           // 兼容旧引用（横向尺寸）
// 环形顺序：0 左上角 → 顶行向右 → 右列向下 → 底行向左 → 左列向上 → 回 0
const CELLGRID = (() => {
  const g = {};
  for (let i = 0; i <= COLS - 1; i++) g[i] = [i, 0];                      // 0..15  顶行 →
  for (let i = 16; i <= 16 + (ROWS - 3); i++) g[i] = [COLS - 1, i - 15];  // 16..23 右列 ↓
  for (let i = 24; i <= 24 + COLS - 1; i++) g[i] = [COLS - 1 - (i - 24), ROWS - 1]; // 24..39 底行 ←
  for (let i = 40; i <= 47; i++) g[i] = [0, ROWS - 1 - (i - 39)];         // 40..47 左列 ↑
  return g;
})();

const BOARD = [
  {name:'起点',type:'start'},{name:'华中科大',type:'prop',g:'g5',price:2100},{name:'山东大学',type:'prop',g:'g4',price:1900},
  {name:'命运',type:'fate'},{name:'缴学费',type:'tax',amount:900},{name:'浦东机场',type:'transport',price:2000},
  {name:'浙江大学',type:'prop',g:'g9',price:3450},{name:'厦门大学',type:'prop',g:'g4',price:1800},{name:'机会',type:'chance'},
  {name:'北航',type:'prop',g:'g2',price:1300},{name:'北京理工',type:'prop',g:'g6',price:2400},{name:'中山大学',type:'prop',g:'g6',price:2300},
  {name:'文印店',type:'util',price:1700},{name:'香港大学',type:'prop',g:'g10',price:3900},{name:'四川大学',type:'prop',g:'g5',price:2000},
  {name:'白云机场',type:'transport',price:2000},{name:'西北农林',type:'prop',g:'g1',price:900},{name:'命运',type:'fate'},
  {name:'南京大学',type:'prop',g:'g8',price:3300},{name:'南开大学',type:'prop',g:'g3',price:1600},{name:'长廊入口',type:'junction'},
  {name:'东南大学',type:'prop',g:'g2',price:1200},{name:'机会',type:'chance'},{name:'北京大学',type:'prop',g:'g10',price:4050},
  {name:'宝安机场',type:'transport',price:2000},{name:'中科大',type:'prop',g:'g8',price:3150},{name:'天津大学',type:'prop',g:'g6',price:2500},
  {name:'华东师大',type:'prop',g:'g2',price:1100},{name:'教育基金会',type:'parking'},{name:'华南理工',type:'prop',g:'g3',price:1400},
  {name:'挂科留级',type:'gojail'},{name:'深圳大学',type:'prop',g:'g1',price:1000},{name:'北师大',type:'prop',g:'g7',price:2700},
  {name:'同济大学',type:'prop',g:'g8',price:3000},{name:'武汉大学',type:'prop',g:'g7',price:2850},{name:'大兴机场',type:'transport',price:2000},
  {name:'大道入口',type:'junction2'},{name:'南科大',type:'prop',g:'g4',price:1700},{name:'快递驿站',type:'util',price:1600},
  {name:'校园商城',type:'jail'},{name:'清华大学',type:'prop',g:'g10',price:4200},{name:'国科大',type:'prop',g:'g3',price:1500},
  {name:'上海交大',type:'prop',g:'g9',price:3600},{name:'长安大学',type:'prop',g:'g1',price:800},{name:'辩论擂台',type:'duel'},
  {name:'西安交大',type:'prop',g:'g5',price:2200},{name:'复旦大学',type:'prop',g:'g9',price:3750},{name:'哈工大',type:'prop',g:'g7',price:2600},
  // ---- 学术长廊 48~54（右侧上层小地图） ----
  {name:'科研基金处',type:'invest'},{name:'教授工作室',type:'advisor'},{name:'校庆礼品屋',type:'shop'},
  {name:'奖学金长廊',type:'ginkgo'},{name:'杰出校友厅',type:'hall'},{name:'通宵自习室',type:'study'},{name:'校史馆',type:'exit'},
  // ---- 创业大道 55~61（右侧下层小地图） ----
  {name:'创业孵化器',type:'startup'},{name:'毕业跳蚤市场',type:'market'},{name:'校园运动会',type:'arena'},
  {name:'国际交流站',type:'exchange'},{name:'创业基金厅',type:'hall'},{name:'实习直通车',type:'intern'},{name:'校企合作中心',type:'exit2'},
];
// 岔路格位置（1500 × 940 坐标空间）：两条支线横排在棋盘正中央的上、下两排
const BR_W = 132, BR_H = 108, BR_GAP = 8;
const BR_X0 = (VIEWW - (7 * BR_W + 6 * BR_GAP)) / 2;   // 第一格左边 x（整排居中）
const BR_CX = k => BR_X0 + BR_W / 2 + k * (BR_W + BR_GAP);
const BR_ROW_A = 204, BR_ROW_B = 722;                  // 两排的中心 y
const BRANCH_POS = {};
for (let k = 0; k < 7; k++) BRANCH_POS[48 + k] = [BR_CX(k), BR_ROW_A];   // 学术长廊 48~54
for (let k = 0; k < 7; k++) BRANCH_POS[55 + k] = [BR_CX(k), BR_ROW_B];   // 创业大道 55~61
// 中央看板（季节 / 天气 / 基金池 / 轮次 / 校历）
const CTR_CARD = { x: 430, y: 288, w: 640, h: 356 };
const POOL_PT = () => [CTR_CARD.x + CTR_CARD.w / 2, CTR_CARD.y + 240];   // v5.6：基金池胶囊中心（金币飞入目标点）
const BANK_PT = () => [PAD + CW / 2, -20];

const GROUPS = { g1:'#A1887F', g2:'#90CAF9', g3:'#F48FB1', g4:'#FFB74D', g5:'#E57373', g6:'#E8D06F', g7:'#A5D6A7', g8:'#4DB6AC', g9:'#9FA8DA', g10:'#B39DDB' };
// ---------- 与服务端同步的机制常量 ----------
const REROLL_COST = 1200;      // 重掷骰：掷骰后花 ¥1200 重投一次
const ENDGAME_ROUND = 15;      // 第 15 轮起「经济寒冬」：银行停发工资
const FUND_CAP = 20000;        // 教育基金上限（v5.1：30000 → 20000），溢出均分
// 免罚符价格（必须与服务端 Room.shieldCost() 保持一致）：v5.1 起分段价整体再下调约 8%
//   1~8 轮 260+55×轮 ｜ 9~20 轮 700+110×(轮−8) ｜ 21 轮起 2020+150×(轮−20)
function shieldCostAt(round) {
  const r = Math.max(1, round || 1);
  if (r <= 8) return 260 + 55 * r;
  if (r <= 20) return 700 + 110 * (r - 8);
  return 2020 + 150 * (r - 20);
}
const ITEMS = {
  shield: { id:'shield', name:'免罚符', icon:'🛡️', desc:'本回合踩到他人地产免租，仅当轮有效，价格分段随轮数上涨' },
};
const SEASON = {
  low:  { key:'low',  name:'淡季', icon:'🍂', rentMul:0.85, buildMul:0.9, color:'#378ADD' },
  mid:  { key:'mid',  name:'平季', icon:'🌤️', rentMul:1.0, buildMul:1.0, color:'#888780' },
  high: { key:'high', name:'旺季', icon:'🔥', rentMul:1.15, buildMul:1.1, color:'#BA7517' },
};
// v5.1：与服务端 WEATHER 保持一致（8 种天气，各有独立修正与独立视觉特效）
const WEATHER = {
  sun:   { key:'sun',   name:'晴天', icon:'☀️', diceMod: 1,  desc:'掷骰 +1 步' },
  cloud: { key:'cloud', name:'阴天', icon:'☁️', diceMod: 0,  desc:'无特殊影响' },
  rain:  { key:'rain',  name:'雨天', icon:'🌧️', diceMod: -1, desc:'掷骰 −1 步' },
  storm: { key:'storm', name:'台风', icon:'🌪️', diceMod: 0,  rentMul: 0.7,  desc:'全场租金 ×0.7' },
  fog:   { key:'fog',   name:'雾霾', icon:'🌫️', diceMod: 0,  rentMul: 0.9,  desc:'能见度低，全场租金 ×0.9' },
  snow:  { key:'snow',  name:'暴雪', icon:'❄️', diceMod: -1, buildMul: 1.15, desc:'掷骰 −1 步，盖房 ×1.15' },
  heat:  { key:'heat',  name:'烈日', icon:'🔥', diceMod: 0,  rentMul: 1.1,  desc:'消费旺盛，全场租金 ×1.1' },
  wind:  { key:'wind',  name:'大风', icon:'💨', diceMod: 1,  rentMul: 0.95, buildMul: 1.1, desc:'顺风 +1 步，租金 ×0.95，盖房 ×1.1' },
};
const MAJORS = {
  mech: { id:'mech', name:'机械', icon:'⚙️', skill:'精益制造', mode:'active', uses:4, fx:'#e8734a', tier:1, desc:'发动后本回合盖房 −50% 并立刻 +¥1500；常驻盖房 −10%' },
  newe: { id:'newe', name:'新能源材料与器件', icon:'🔋', skill:'储能放大', mode:'active', uses:3, fx:'#2fb87a', tier:1, desc:'发动后 +现金 12%（≤¥4000），本轮收租 +40%；常驻过起点 +¥1000' },
  fin:  { id:'fin',  name:'金融', icon:'💰', skill:'杠杆操作', mode:'passive', uses:4, fx:'#d8a531', tier:1, desc:'抵押地产时多拿 50% 现金' },
  cs:   { id:'cs',   name:'计算机', icon:'💻', skill:'算法优化', mode:'passive', uses:3, fx:'#4a90d9', tier:1, desc:'掷骰不足 7 点时自动重掷取更优' },
  econ: { id:'econ', name:'经管', icon:'📈', skill:'资本运作', mode:'passive', uses:3, fx:'#c9a227', tier:2, desc:'单笔收租 ≥¥1500 时 +50%' },
  med:  { id:'med',  name:'医学', icon:'🩺', skill:'妙手回春', mode:'passive', uses:3, fx:'#e05a71', tier:2, desc:'被收租 ≥¥1000 时减免 40%' },
  pharm:{ id:'pharm',name:'药学', icon:'💊', skill:'对症下药', mode:'active', uses:3, fx:'#57c1a0', tier:2, desc:'发动后 +¥600，本轮内被收租减免 60%' },
  law:  { id:'law',  name:'法学', icon:'⚖️', skill:'法律援助', mode:'passive', uses:3, fx:'#8a6fd1', tier:2, desc:'免疫 3 次不利判定' },
  arch: { id:'arch', name:'建筑', icon:'🏗️', skill:'造价管理', mode:'passive', uses:3, fx:'#d08531', tier:2, desc:'升级房产时费用 −35%' },
  chem: { id:'chem', name:'化学', icon:'🧪', skill:'催化加成', mode:'passive', uses:3, fx:'#7bbf3f', tier:2, desc:'单笔收租 ≥¥1000 时 +40%' },
  auto: { id:'auto', name:'自动化', icon:'🤖', skill:'流水线', mode:'active', uses:3, fx:'#5a7fd6', tier:2, desc:'发动后本回合移动 +2 步；落在自己地产再 +¥900' },
  ee:   { id:'ee',   name:'微电子', icon:'🔌', skill:'信号增益', mode:'passive', uses:4, fx:'#00a8b5', tier:2, desc:'每次经过起点 +¥1400' },
  math: { id:'math', name:'数学', icon:'📐', skill:'精算砍价', mode:'passive', uses:3, fx:'#5f9ea0', tier:2, desc:'买入地产时 8 折' },
  agri: { id:'agri', name:'农学', icon:'🌾', skill:'春华秋实', mode:'passive', uses:3, fx:'#8fbf4a', tier:2, desc:'每次经过起点 +¥1500' },
  stat: { id:'stat', name:'统计', icon:'📊', skill:'数据洞察', mode:'passive', uses:4, fx:'#4f9ad1', tier:2, desc:'掷骰点数 ≤5 时 +¥800' },
  pe:   { id:'pe',   name:'体育', icon:'🏀', skill:'体能优势', mode:'passive', uses:4, fx:'#e0803f', tier:2, desc:'掷骰点数 ≤5 时多走 2 步并 +¥400' },
  phil: { id:'phil', name:'哲学', icon:'🏛️', skill:'批判思维', mode:'passive', uses:3, fx:'#8a7f9a', tier:2, desc:'免疫 3 次不利判定' },
  mil:  { id:'mil',  name:'军事', icon:'🎖️', skill:'战术压制', mode:'passive', uses:3, fx:'#7d8a3a', tier:2, desc:'擂台点数 +1；获胜再 +¥500' },
  phys: { id:'phys', name:'物理', icon:'⚛️', skill:'守恒定律', mode:'passive', uses:3, fx:'#3f7fd6', tier:2, desc:'被收租 ≥¥1200 时减免 35%' },
  lang: { id:'lang', name:'外国语', icon:'🌍', skill:'多语种优势', mode:'passive', uses:3, fx:'#c86a3f', tier:2, desc:'抽到正面机会卡时 +¥900' },
  art:  { id:'art',  name:'艺术', icon:'🎨', skill:'灵感迸发', mode:'passive', uses:3, fx:'#d1568f', tier:2, desc:'抽到正面机会卡时 +¥800' },
  mse:  { id:'mse',  name:'材料科学', icon:'🧱', skill:'相变强化', mode:'active', uses:3, fx:'#9a7b5a', tier:2, desc:'发动后本轮自己地产收租 +60%' },
  env:  { id:'env',  name:'环境科学', icon:'♻️', skill:'循环利用', mode:'passive', uses:4, fx:'#3fa76a', tier:2, desc:'每次被收租都减免 15%（无门槛）' },
  civil:{ id:'civil',name:'土木工程', icon:'🏗️', skill:'基建加固', mode:'passive', uses:3, fx:'#a8823f', tier:2, desc:'自己的地产免于被拆除；盖房 −20%' },
  geol: { id:'geol', name:'地质', icon:'🗺️', skill:'勘探评估', mode:'passive', uses:3, fx:'#8a7b52', tier:3, desc:'买入无主地产时 9 折' },
  aero: { id:'aero', name:'航天', icon:'🛰️', skill:'一飞冲天', mode:'passive', uses:3, fx:'#5468a8', tier:3, desc:'进入岔路时 +¥1000' },
  bio:  { id:'bio',  name:'生命科学', icon:'🧬', skill:'细胞增殖', mode:'passive', uses:4, fx:'#5aa9d6', tier:3, desc:'回合开始时现金 +4%' },
  drama:{ id:'drama',name:'戏剧', icon:'🎭', skill:'全场入戏', mode:'passive', uses:3, fx:'#b04a9a', tier:3, desc:'抽到任意机会/命运卡时 +¥500' },
  music:{ id:'music',name:'音乐', icon:'🎵', skill:'共鸣演出', mode:'active', uses:3, fx:'#d1619a', tier:3, desc:'发动后 +¥1000，其他玩家各付你 ¥300' },
  psych:{ id:'psych',name:'心理学', icon:'🧠', skill:'读心术', mode:'active', uses:3, fx:'#7a5fc1', tier:3, desc:'发动后从总资产最高者处抽走 ¥1200' },
  news: { id:'news', name:'新闻', icon:'📰', skill:'独家爆料', mode:'passive', uses:3, fx:'#8a8f96', tier:3, desc:'抽到负面卡时自动重抽一次' },
  food: { id:'food', name:'食品科学', icon:'🍜', skill:'能量补给', mode:'passive', uses:4, fx:'#d1873f', tier:3, desc:'每次被罚停留休整时 +¥700' },
  marine:{id:'marine',name:'海洋科学', icon:'🌊', skill:'深海资源', mode:'passive', uses:3, fx:'#2f8fbf', tier:3, desc:'每次经过起点 +¥1200' },
  // ===== v5.3 新增 27 个专业（覆盖面更广：工科 / 理科 / 医农生 / 人文社科 / 艺术设计）=====
  // 与服务端 game.js 的 MAJORS 逐字同步；test_v53.js 会做镜像一致性校验
  elec:  { id:'elec', name:'电气工程', icon:'⚡', skill:'峰谷套利', mode:'active', uses:3, fx:'#f0b429', tier:2, desc:'发动后立刻 +¥1300，本回合买地 6 折' },
  comm:  { id:'comm', name:'通信工程', icon:'📡', skill:'信号覆盖', mode:'passive', uses:4, fx:'#3aa0d8', tier:2, desc:'每次经过起点 +¥1200；每抽到任意卡 +¥300' },
  ctrl:  { id:'ctrl', name:'控制科学', icon:'🎛️', skill:'闭环调节', mode:'passive', uses:3, fx:'#5b7fd1', tier:2, desc:'单笔收租 ≥¥1200 时 +30%；被收租 ≥¥1200 时减免 25%' },
  robot: { id:'robot', name:'机器人工程', icon:'🦾', skill:'机械臂协作', mode:'active', uses:3, fx:'#e2663f', tier:2, desc:'发动后本回合盖房 −60%，并立刻 +¥1000' },
  se:    { id:'se', name:'软件工程', icon:'⌨️', skill:'敏捷迭代', mode:'passive', uses:4, fx:'#4a90d9', tier:2, desc:'每局 4 次免费重投骰子（不用付 ¥900）' },
  ai:    { id:'ai', name:'人工智能', icon:'🧠', skill:'模型推理', mode:'active', uses:3, fx:'#7a5fc1', tier:2, desc:'发动后本轮收租 +35%，并从总资产最高者处取 ¥800' },
  imes:  { id:'imes', name:'智能制造', icon:'🏭', skill:'柔性产线', mode:'passive', uses:3, fx:'#7b8fa8', tier:2, desc:'升级房产 −25%；每次升级成功再 +¥500' },
  power: { id:'power', name:'能源与动力', icon:'🔥', skill:'热机循环', mode:'passive', uses:4, fx:'#e07a3f', tier:2, desc:'每轮开局 +¥400；每次经过起点 +¥800' },
  astro: { id:'astro', name:'天文学', icon:'🔭', skill:'眺望星河', mode:'passive', uses:3, fx:'#5468a8', tier:2, desc:'掷骰点数 ≥9 时自动 +¥1100' },
  meteo: { id:'meteo', name:'气象学', icon:'🌦️', skill:'预报风向', mode:'passive', uses:4, fx:'#4f9ad1', tier:2, desc:'恶劣天气（雨/台风/雪/雾）里自己回合开始 +¥700' },
  geop:  { id:'geop', name:'地球物理', icon:'🌏', skill:'地层探测', mode:'passive', uses:3, fx:'#8a7b52', tier:2, desc:'买入无主地产 85 折；每买下一块地再 +¥400' },
  or:    { id:'or', name:'运筹学', icon:'🧮', skill:'资源调度', mode:'active', uses:3, fx:'#5f9ea0', tier:2, desc:'发动后立刻 +¥900，本回合移动 +3 步' },
  nurs:  { id:'nurs', name:'护理学', icon:'💉', skill:'悉心看护', mode:'passive', uses:4, fx:'#e05a9a', tier:2, desc:'被收租 ≥¥800 时自动减免 35%' },
  dent:  { id:'dent', name:'口腔医学', icon:'🦷', skill:'牙科门诊', mode:'passive', uses:3, fx:'#57c1c0', tier:2, desc:'单笔收租 ≥¥1200 时自动 +45%' },
  vet:   { id:'vet', name:'兽医学', icon:'🐾', skill:'牲畜保险', mode:'passive', uses:3, fx:'#8fbf4a', tier:2, desc:'自己的地产免于被拆除；每次被收租减免 12%' },
  hort:  { id:'hort', name:'园艺学', icon:'🌷', skill:'嫁接育种', mode:'passive', uses:3, fx:'#d1568f', tier:3, desc:'每次经过起点 +¥1100；升级房产 −12%' },
  forest:{ id:'forest', name:'林学', icon:'🌲', skill:'封山育林', mode:'passive', uses:3, fx:'#3fa76a', tier:3, desc:'每轮开局 +¥350；被罚停留休整时 +¥600' },
  acc:   { id:'acc', name:'会计学', icon:'🧾', skill:'精算审计', mode:'passive', uses:3, fx:'#c9a227', tier:2, desc:'买入地产 85 折；被收租 ≥¥1000 时减免 25%' },
  trade: { id:'trade', name:'国际贸易', icon:'🚢', skill:'跨境套利', mode:'passive', uses:4, fx:'#2f8fbf', tier:2, desc:'每次经过起点 +¥1000；每抽到任意卡 +¥350' },
  mkt:   { id:'mkt', name:'市场营销', icon:'📣', skill:'带货直播', mode:'active', uses:3, fx:'#e0803f', tier:2, desc:'发动后立刻 +¥1200，其他每位玩家再各付你 ¥250' },
  hr:    { id:'hr', name:'人力资源管理', icon:'🧑‍💼', skill:'团队激励', mode:'passive', uses:3, fx:'#a8823f', tier:3, desc:'回合开始时现金 +3%；被罚停留休整时 +¥700' },
  tourism:{ id:'tourism', name:'旅游管理', icon:'🧳', skill:'导游外快', mode:'passive', uses:3, fx:'#c86a3f', tier:3, desc:'进入岔路时 +¥900；每次经过起点 +¥700' },
  edu:   { id:'edu', name:'教育学', icon:'📚', skill:'因材施教', mode:'passive', uses:4, fx:'#9a7b5a', tier:3, desc:'每轮开局 +¥350；抽到负面卡时自动重抽（4 次）' },
  hist:  { id:'hist', name:'历史学', icon:'🏺', skill:'考古发现', mode:'passive', uses:3, fx:'#a8823f', tier:3, desc:'掷骰点数 ≤4 时发掘出文物 +¥900；买入无主地产 9 折' },
  soc:   { id:'soc', name:'社会学', icon:'🧑‍🤝‍🧑', skill:'田野调查', mode:'passive', uses:3, fx:'#8a7f9a', tier:3, desc:'每抽到一张机会 / 命运卡 +¥450' },
  design:{ id:'design', name:'工业设计', icon:'🖌️', skill:'人机工学', mode:'passive', uses:3, fx:'#d1619a', tier:3, desc:'升级房产 −18%；买入地产 −8%' },
  film:  { id:'film', name:'影视传媒', icon:'🎬', skill:'院线首映', mode:'active', uses:3, fx:'#b04a9a', tier:2, desc:'发动后立刻 +¥1500，本轮自己收租 +25%' },
};
// ---------- v5.2：校园风貌（与服务端 game.js 的 FACULTY 表逐字同步，改一边必须改另一边） ----------
// 开场随机 3 候选 → 全体投票 → 随机抽一名玩家，他的那一票成为本局风貌，全场共享、贯穿整局。
const FACULTY = {
  urban:    { name: '都市校区',   icon: '🏙️', color: '#4A90D9', lead: '经过起点工资 ¥2250（+250）',           cost: '所有地皮买入价 +3%',              tag: '钱来得快，地也贵' },
  garden:   { name: '园林校区',   icon: '🌳', color: '#6FAE3F', lead: '所有地皮买入价 −4%',                  cost: '经过起点工资 ¥1800（−200）',       tag: '便宜是便宜，就是远' },
  ancient:  { name: '百年学府',   icon: '🏛️', color: '#C8941F', lead: '每 3 轮全场各领 ¥300 校友捐款',         cost: '第 1~3 轮全场租金 ×0.93',          tag: '底蕴要慢慢显' },
  tech:     { name: '理工校区',   icon: '🔬', color: '#2E7BC4', lead: '全场建筑升级费 −8%',                  cost: '机会 / 命运卡的金钱收益 −7%',       tag: '自己动手，丰衣足食' },
  general:  { name: '综合校区',   icon: '🎓', color: '#9A968C', lead: '正面卡 +¥200、负面卡少损失 ¥200',       cost: '无——但也没有爆发点',              tag: '什么都有点，什么都不极致' },
  biz:      { name: '商科校区',   icon: '💼', color: '#A9682B', lead: '抵押可拿地价 58%（基准 50%）',          cost: '赎回时多付 8% 手续费',             tag: '银行永远在你身边，也永远在收你的钱' },
  intl:     { name: '国际校区',   icon: '🌏', color: '#1FA37A', lead: '岔路奖励 ×1.12、长廊入口门槛降到 1 块地', cost: '主路机会卡的收益 −15%',            tag: '世界那么大，出去看看' },
  sports:   { name: '文体校区',   icon: '🎪', color: '#E2564F', lead: '擂台/运动会赌注 ×1.2、每轮首次重投 ¥900', cost: '全场租金 ×0.96',                  tag: '打球要花钱，打架要命' },
  finance:  { name: '金融校区',   icon: '🏦', color: '#D9A32B', lead: '基金池上限 ¥25000、每轮注入 ¥500',      cost: '物业税起征门槛降低 1',              tag: '池子大了，谁都想跳进去' },
  reform:   { name: '改革校区',   icon: '⚡', color: '#E07A45', lead: '全场每轮开局 +¥300',                  cost: '全场租金 ×1.06',                    tag: '速战速决，谁都别想慢慢发育' },
  med:      { name: '医学校区',   icon: '🩺', color: '#D9648F', lead: '单笔被收租 ≥¥1500 时减免 10%',         cost: '罚款类支出 +20%',                   tag: '治得了大病，治不了穷' },
  agri:     { name: '农业校区',   icon: '🌾', color: '#8FC24F', lead: '经过起点额外领 ¥300',                 cost: '建筑升级费 +3%',                    tag: '春种秋收，急不来' },
  art:      { name: '艺术校区',   icon: '🎨', color: '#8E86E0', lead: '效果卡盲盒每次多抽 1 张',               cost: '地皮买入价 +4%',                    tag: '灵感多，钱少' },
  park:     { name: '科技园区',   icon: '🚀', color: '#6B60C9', lead: '科研基金会返还 +20%（净赚 ¥1200）',     cost: '机会卡的收益 −10%',                 tag: '立项要靠硬实力' },
  normal:   { name: '师范校区',   icon: '🎯', color: '#2BB88C', lead: '每过 10 轮全场各得 1 张「免停留卡」',    cost: '全场租金 ×0.97',                    tag: '老师总是手下留情' },
  book:     { name: '书香校区',   icon: '📚', color: '#B04B2C', lead: '每抽到一张机会卡 +¥250',               cost: '命运卡的负面金额 +10%',             tag: '书中自有黄金屋，也有催款单' },
  life:     { name: '生活区校区', icon: '🍜', color: '#E88A6F', lead: '文印店/快递租金、机场路费 ×0.92',       cost: '地皮买入价 +3%',                    tag: '生活便利，就是有点挤' },
  austerity:{ name: '紧缩校区',   icon: '⏰', color: '#6E6C66', lead: '本局免征物业税',                       cost: '银行提前 5 轮停发工资（第 10 轮起）', tag: '勒紧腰带过日子' },
  boom:     { name: '繁荣校区',   icon: '🌇', color: '#C99A3F', lead: '停发工资推迟 5 轮、过起点额外 +¥200',   cost: '所有地皮买入价 +6%',                tag: '日子还长，先涨个价' },
  nofund:   { name: '限薪校区',   icon: '🏚️', color: '#9B3A3A', lead: '全场地价 −12%、升级费 −10%',           cost: '银行全程停发起点工资',              tag: '没有工资，全凭本事' },
  retrain:  { name: '进修校区',   icon: '📖', color: '#5548B0', lead: '开局所有人技能次数 +1',                 cost: '所有地皮买入价 +3%',                tag: '多学一门手艺' },
  freeRound:{ name: '免费轮校区', icon: '🎟️', color: '#4E9B2A', lead: '随机 1 轮全场买地、盖楼完全免费',       cost: '全场租金 ×1.08',                    tag: '那一轮，随便花' },
  freeRent: { name: '免租轮校区', icon: '🕊️', color: '#3FBF9E', lead: '随机 4 轮全场所有人免交租金',           cost: '其余轮次全场租金 ×1.05',            tag: '这四轮，谁也别想收租' },
};
const FACULTY_KEYS = Object.keys(FACULTY);
const FACULTY_VOTE_MS = 24000;   // v5.5：与服务端同步拉长（原 15s），看清楚再投

const CELLXY = i => { const [c, r] = CELLGRID[i]; return [GX(c), GY(r)]; };
const cellCenter = i => {
  if (BRANCH_POS[i]) return BRANCH_POS[i];   // 岔路格用中央小地图坐标
  const [x, y] = CELLXY(i); return [x + CS / 2, y + CS / 2];
};

// ---------- 状态 ----------
let ws = null, myToken = null, myPid = null, roomCode = null;
let S = null;               // 最新 state
let animQ = Promise.resolve();
let boardBuilt = false, tokenEls = {}, buildEls = {};
// 地图上展示的市场状态：只在动画队列真正播到 season/weather/calevent 时才更新。
// 绝不直接读服务端最新快照 —— 否则本轮四个玩家还没走完，地图就提前显示下一轮的季节/天气/节日。
let dispSeason = 'mid', dispWeather = 'cloud', dispCal = null, dispReady = false;
let curWeather = null;   // 已应用的天气（避免重复重建效果）
// v5.1：显示态（现金 / 地皮 / 基金池）—— 服务端会给每个事件附带增量 d，
// 客户端在「播完该事件动画」之后才套用，所以资金/资产的变化永远晚于动画，
// 并且评论区、资产面板、玩家现金条在同一时刻一起刷新（不再提前剧透）。
let dispCash = null, dispCells = null, dispFund = null;
function syncDisp(state) {
  if (!state) return;
  dispCash = {}; dispFund = state.fundPool;
  for (const p of state.players) dispCash[p.id] = p.cash;
  dispCells = {};
  (state.cells || []).forEach((cs, i) => { dispCells[i] = { own: cs.own, level: cs.level || 0, mortgaged: !!cs.mortgaged, mortgageAt: cs.mortgageAt || 0 }; });
}
function applyDispDiff(d) {
  if (!d) return;
  if (d.cash && dispCash) for (const k in d.cash) dispCash[k] = d.cash[k];
  if (d.fund != null) dispFund = d.fund;
  if (d.cells && dispCells) for (const k in d.cells) dispCells[k] = d.cells[k];
}
// 取"当前应该显示"的现金 / 地皮（尚未播到就沿用旧值）
function dcash(p) { return (dispCash && dispCash[p.id] != null) ? dispCash[p.id] : (p ? p.cash : 0); }
function dcell(i) {
  if (dispCells && dispCells[i]) return dispCells[i];
  return (S && S.cells) ? S.cells[i] : { own: null, level: 0, mortgaged: false, mortgageAt: 0 };
}

// ---------- 音效引擎（WebAudio 合成，零素材） ----------
let audioCtx = null, soundOn = true;
function ac() {
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function tone({ f = 440, t = 'sine', d = 0.15, v = 0.2, when = 0, slide = 0 }) {
  if (!soundOn) return;
  const ctx = ac(); if (!ctx) return;
  try {
    const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + when;
    o.type = t; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t0 + d);
    g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
    o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + d + 0.05);
  } catch (e) {}
}
function noiseFx({ d = 0.2, v = 0.15, when = 0, hp = 800 }) {
  if (!soundOn) return;
  const ctx = ac(); if (!ctx) return;
  try {
    const len = Math.max(1, Math.ceil(ctx.sampleRate * d)), buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const fl = ctx.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = hp;
    const g = ctx.createGain(); g.gain.value = v;
    src.connect(fl); fl.connect(g); g.connect(ctx.destination);
    src.start(ctx.currentTime + when);
  } catch (e) {}
}
const SFX = {
  click: () => tone({ f: 620, t: 'triangle', d: 0.06, v: 0.1 }),
  dice: () => { for (let i = 0; i < 8; i++) noiseFx({ d: 0.045, v: 0.14, when: i * 0.15, hp: 1800 }); },
  diceLand: () => { tone({ f: 200, t: 'triangle', d: 0.13, v: 0.22 }); tone({ f: 315, t: 'triangle', d: 0.12, v: 0.16, when: 0.06 }); },
  // v5.3：骰子落定「轻轻一磕」—— 替代原来的重物落地 thud（用户反馈落地那下太重太吵）
  diceSettle: () => { noiseFx({ d: 0.04, v: 0.1, hp: 2600 }); tone({ f: 520, slide: -150, t: 'triangle', d: 0.09, v: 0.11 }); },
  // v5.4 新增：托管开关 + 买地插旗
  trusteeOn: () => [392, 494, 587, 784].forEach((f, i) => tone({ f, t: 'sine', d: 0.18, v: 0.16, when: i * 0.09 })),
  trusteeOff: () => [784, 587, 494].forEach((f, i) => tone({ f, t: 'sine', d: 0.14, v: 0.14, when: i * 0.08 })),
  flagPop: () => { noiseFx({ d: 0.05, v: 0.2, hp: 700 }); tone({ f: 300, slide: 240, t: 'triangle', d: 0.12, v: 0.18 }); },
  step: () => tone({ f: 480 + Math.random() * 260, t: 'square', d: 0.045, v: 0.05 }),
  buy: () => [523, 659, 784].forEach((f, i) => tone({ f, t: 'triangle', d: 0.14, v: 0.2, when: i * 0.09 })),
  pay: () => tone({ f: 420, slide: -200, t: 'sawtooth', d: 0.28, v: 0.13 }),
  gain: () => tone({ f: 620, slide: 340, t: 'sine', d: 0.22, v: 0.16 }),
  build: () => { noiseFx({ d: 0.07, v: 0.22, hp: 250 }); tone({ f: 170, t: 'square', d: 0.1, v: 0.2, when: 0.02 }); },
  hotel: () => [523, 659, 784, 1047].forEach((f, i) => tone({ f, t: 'triangle', d: 0.2, v: 0.22, when: i * 0.13 })),
  card: () => noiseFx({ d: 0.28, v: 0.12, hp: 1100 }),
  jackpot: () => [660, 880, 1100, 1320, 1760].forEach((f, i) => tone({ f, t: 'sine', d: 0.16, v: 0.2, when: i * 0.08 })),
  jail: () => tone({ f: 320, slide: -170, t: 'square', d: 0.45, v: 0.16 }),
  bankrupt: () => [420, 330, 260, 170].forEach((f, i) => tone({ f, t: 'sawtooth', d: 0.24, v: 0.15, when: i * 0.19 })),
  mortgage: () => tone({ f: 260, slide: -90, t: 'triangle', d: 0.22, v: 0.15 }),
  redeem: () => [440, 660].forEach((f, i) => tone({ f, t: 'triangle', d: 0.13, v: 0.15, when: i * 0.1 })),
  win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone({ f, t: 'triangle', d: 0.24, v: 0.22, when: i * 0.15 })),
  turn: () => tone({ f: 880, t: 'sine', d: 0.08, v: 0.07 }),
  stay: () => tone({ f: 300, t: 'sine', d: 0.2, v: 0.1 }),
  seasonUp: () => [392, 523, 659, 784].forEach((f, i) => tone({ f, t: 'triangle', d: 0.2, v: 0.2, when: i * 0.1 })),
  seasonDown: () => [494, 415, 349, 262].forEach((f, i) => tone({ f, t: 'triangle', d: 0.22, v: 0.17, when: i * 0.11 })),
  seasonMid: () => [523, 523].forEach((f, i) => tone({ f, t: 'sine', d: 0.16, v: 0.13, when: i * 0.14 })),
  calevent: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f, t: 'square', d: 0.18, v: 0.15, when: i * 0.1 })),
  ach: () => [784, 988, 1319, 1568].forEach((f, i) => tone({ f, t: 'triangle', d: 0.22, v: 0.22, when: i * 0.11 })),
  tax: () => { noiseFx({ d: 0.12, v: 0.16, hp: 400 }); tone({ f: 180, t: 'square', d: 0.16, v: 0.15, when: 0.04 }); },
  combo: n => { const k = Math.max(1, Math.min(3, n - 1)); for (let i = 0; i < k; i++) tone({ f: 660 * Math.pow(1.22, i), t: 'triangle', d: 0.16, v: 0.2, when: i * 0.09 }); },
  duel: () => { for (let i = 0; i < 3; i++) noiseFx({ d: 0.08, v: 0.2, when: i * 0.12, hp: 300 }); tone({ f: 150, t: 'sawtooth', d: 0.4, v: 0.2, when: 0.3 }); },
  skill: () => [880, 1175].forEach((f, i) => tone({ f, t: 'sine', d: 0.14, v: 0.16, when: i * 0.08 })),
  item: () => { tone({ f: 988, t: 'triangle', d: 0.1, v: 0.18 }); tone({ f: 1319, t: 'sine', d: 0.14, v: 0.14, when: 0.06 }); },
  chatHi: () => tone({ f: 740, slide: 200, t: 'sine', d: 0.12, v: 0.12 }),
  chatLo: () => tone({ f: 340, slide: -120, t: 'sine', d: 0.16, v: 0.12 }),
  chatMid: () => tone({ f: 560, t: 'triangle', d: 0.1, v: 0.1 }),
  // 拆除：崩落 + 碎石
  demolish: () => { for (let i = 0; i < 4; i++) noiseFx({ d: 0.1, v: 0.24, when: i * 0.07, hp: 260 }); tone({ f: 120, slide: -60, t: 'sawtooth', d: 0.5, v: 0.2, when: 0.12 }); },
  // 白得施工队：轻快上行 + 锤击
  gift: () => { noiseFx({ d: 0.06, v: 0.2, hp: 320 }); [659, 880, 1109].forEach((f, i) => tone({ f, t: 'triangle', d: 0.16, v: 0.18, when: 0.05 + i * 0.09 })); },
  // ---- v5.0 续：新增音效 ----
  whoosh: () => noiseFx({ d: 0.2, v: 0.08, hp: 2400 }),
  bell: () => { tone({ f: 1568, t: 'sine', d: 0.5, v: 0.13 }); tone({ f: 2093, t: 'sine', d: 0.42, v: 0.075, when: 0.02 }); },
  coin: () => { for (let i = 0; i < 4; i++) tone({ f: 1180 + i * 190, t: 'triangle', d: 0.07, v: 0.095, when: i * 0.05 }); },
  level: () => [659, 880, 1175].forEach((f, i) => tone({ f, t: 'triangle', d: 0.16, v: 0.17, when: i * 0.08 })),
  // ---------- v5.0 续·二 新增音效 ----------
  // 号角：集齐色组 / 成就达成（三连上行 + 长尾泛音）
  fanfare: () => {
    [[523, 0], [659, 0.11], [784, 0.22], [1047, 0.33]].forEach(([f, w]) => tone({ f, t: 'triangle', d: 0.3, v: 0.2, when: w }));
    tone({ f: 1568, t: 'sine', d: 0.7, v: 0.1, when: 0.44 });
  },
  // 金属撞击：擂台对决开打（噪声瞬态 + 金属泛音）
  clash: () => {
    noiseFx({ d: 0.09, v: 0.26, hp: 1200 });
    [1046, 1318, 1568].forEach((f, i) => tone({ f, t: 'square', d: 0.22, v: 0.09, when: i * 0.008 }));
    tone({ f: 180, slide: -70, t: 'sawtooth', d: 0.34, v: 0.2, when: 0.02 });
  },
  // 闪光叮咚：抽卡 / 领到道具
  sparkle: () => { [1318, 1760, 2093].forEach((f, i) => tone({ f, t: 'sine', d: 0.18, v: 0.1, when: i * 0.055 })); },
  // 轻弹：次要提示音
  pop: () => tone({ f: 880, slide: 420, t: 'sine', d: 0.1, v: 0.12 }),
  // 重物落地：盖房起手
  thud: () => { noiseFx({ d: 0.09, v: 0.24, hp: 220 }); tone({ f: 140, slide: -40, t: 'sine', d: 0.22, v: 0.22, when: 0.01 }); },
  // 鼓点：对决前的紧张铺垫
  drumroll: () => { for (let i = 0; i < 9; i++) noiseFx({ d: 0.05, v: 0.1 + i * 0.014, when: i * 0.07, hp: 340 }); },
  // 低鸣：失败 / 破产提示
  buzzer: () => { tone({ f: 196, t: 'square', d: 0.34, v: 0.14 }); tone({ f: 185, t: 'square', d: 0.34, v: 0.13, when: 0.02 }); },
  // 盖章：买地 / 抵押成交
  stamp: () => { noiseFx({ d: 0.06, v: 0.22, hp: 500 }); tone({ f: 300, slide: -110, t: 'triangle', d: 0.14, v: 0.2, when: 0.01 }); },
  // 扫频上/下：季节、转场、拆房
  sweepUp: () => { for (let i = 0; i < 7; i++) tone({ f: 420 * Math.pow(1.16, i), t: 'sine', d: 0.09, v: 0.09, when: i * 0.045 }); },
  sweepDown: () => { for (let i = 0; i < 7; i++) tone({ f: 900 / Math.pow(1.15, i), t: 'sine', d: 0.1, v: 0.09, when: i * 0.045 }); },
  // 滴答：决策倒计时
  tick: () => tone({ f: 1320, t: 'square', d: 0.03, v: 0.05 }),
  // 金币雨：垄断 / 领基金池
  coinRain: () => { for (let i = 0; i < 11; i++) tone({ f: rnd(1000, 1900), t: 'triangle', d: 0.06, v: 0.075, when: i * 0.055 }); },
  // ---------- v5.1 新增音效（天气 / 场景专用） ----------
  // 风声：宽频噪声 + 缓慢下滑，像风从远处扫过
  wind: () => { for (let i = 0; i < 5; i++) noiseFx({ d: 0.5, v: 0.055 + i * 0.008, when: i * 0.13, hp: 700 + i * 320 }); },
  // 雷声：低频轰鸣 + 长尾噪声（台风）
  thunder: () => { noiseFx({ d: 0.9, v: 0.1, hp: 90 }); tone({ f: 70, slide: -28, t: 'sawtooth', d: 1.0, v: 0.16, when: 0.05 }); },
  // 雪落：极轻的高频颗粒，安静
  snow: () => { for (let i = 0; i < 7; i++) tone({ f: rnd(1900, 2700), t: 'sine', d: 0.12, v: 0.035, when: i * 0.11 }); },
  // 雾：低沉持续的嗡鸣，闷
  fog: () => { tone({ f: 116, t: 'sine', d: 0.9, v: 0.07 }); tone({ f: 174, t: 'sine', d: 0.8, v: 0.045, when: 0.05 }); },
  // 蝉鸣：烈日下的高频颤音
  heat: () => { for (let i = 0; i < 10; i++) tone({ f: 2600 + (i % 3) * 180, t: 'sawtooth', d: 0.06, v: 0.026, when: i * 0.06 }); },
  // 光晕：晴天转场的明亮泛音
  sunshine: () => { [784, 1047, 1319].forEach((f, i) => tone({ f, t: 'sine', d: 0.5, v: 0.07, when: i * 0.1 })); },
  // ---------- v5.1 新增音效（校历节日 / 全局事件专用） ----------
  // 跨年烟火：一串升空爆裂
  fireworks: () => { for (let i = 0; i < 7; i++) { noiseFx({ d: 0.18, v: 0.1, when: i * 0.2, hp: 1300 }); tone({ f: 640 + (i % 3) * 220, t: 'sine', d: 0.42, v: 0.07, when: i * 0.2 + 0.02 }); } },
  // 红包：喜庆上行
  redpacket: () => [784, 988, 1175, 1568].forEach((f, i) => tone({ f, t: 'triangle', d: 0.2, v: 0.18, when: i * 0.09 })),
  // 歌手赛：开麦报幕
  stage: () => { noiseFx({ d: 0.1, v: 0.18, hp: 900 }); [523, 659, 880, 1047, 1319].forEach((f, i) => tone({ f, t: 'square', d: 0.16, v: 0.13, when: 0.06 + i * 0.08 })); },
  // 银行分红：点钞串
  bank: () => { tone({ f: 220, t: 'sine', d: 0.3, v: 0.16 }); for (let i = 0; i < 9; i++) tone({ f: 1200 + i * 120, t: 'triangle', d: 0.05, v: 0.07, when: i * 0.05 }); },
  // 帮扶转移：温暖双音
  aid: () => { tone({ f: 620, slide: 260, t: 'sine', d: 0.3, v: 0.14 }); tone({ f: 930, t: 'sine', d: 0.24, v: 0.1, when: 0.16 }); },
  // 火箭：发射嘶鸣
  rocket: () => { noiseFx({ d: 0.6, v: 0.13, hp: 400 }); tone({ f: 160, slide: 900, t: 'sawtooth', d: 0.7, v: 0.14 }); },
  // 画展：竖琴琶音
  gallery: () => [659, 831, 988, 1319].forEach((f, i) => tone({ f, t: 'sine', d: 0.24, v: 0.13, when: i * 0.11 })),
  // 嘉年华：欢快跳音
  carnival: () => { for (let i = 0; i < 8; i++) tone({ f: 700 + (i % 4) * 180, t: 'square', d: 0.1, v: 0.11, when: i * 0.09 }); },
  // 万圣节：阴森下滑
  pumpkin: () => { tone({ f: 300, slide: -140, t: 'sawtooth', d: 0.5, v: 0.12 }); noiseFx({ d: 0.2, v: 0.1, hp: 500 }); },
  // offer 雨：轻快提示
  offer: () => { noiseFx({ d: 0.14, v: 0.1, hp: 1500 }); [880, 1047].forEach((f, i) => tone({ f, t: 'triangle', d: 0.14, v: 0.14, when: i * 0.1 })); },
  // 牛市：连续上行
  bull: () => [523, 659, 784, 988, 1175].forEach((f, i) => tone({ f, t: 'triangle', d: 0.14, v: 0.16, when: i * 0.07 })),
  // 气球：轻盈飘散
  balloon: () => [1047, 1319, 1568].forEach((f, i) => tone({ f, t: 'sine', d: 0.26, v: 0.09, when: i * 0.12 })),
  // 大促：降价叮咚
  sale: () => { noiseFx({ d: 0.12, v: 0.14, hp: 1600 }); [1319, 988].forEach((f, i) => tone({ f, t: 'square', d: 0.12, v: 0.13, when: i * 0.1 })); },
  // 翻书：纸页沙沙
  book: () => { noiseFx({ d: 0.22, v: 0.07, hp: 2600 }); tone({ f: 660, t: 'sine', d: 0.3, v: 0.08 }); },
  // 暴雨停课：闷雷
  storm: () => { noiseFx({ d: 0.7, v: 0.1, hp: 120 }); tone({ f: 90, slide: -40, t: 'sawtooth', d: 0.8, v: 0.14, when: 0.04 }); },
  // ---------- v5.2 新增音效（校园风貌专用） ----------
  // 牌匾升起：低频冲击 + 金属余韵（第一幕开场）
  facRise: () => {
    noiseFx({ d: 0.16, v: 0.2, hp: 260 });
    tone({ f: 110, slide: 55, t: 'sawtooth', d: 0.7, v: 0.19 });
    [523, 784].forEach((f, i) => tone({ f, t: 'sine', d: 0.5, v: 0.09, when: 0.18 + i * 0.12 }));
  },
  // 卡片翻入：清脆三连（第二幕）
  facFlip: n => tone({ f: 660 + Math.max(0, Math.min(3, n || 0)) * 120, t: 'triangle', d: 0.12, v: 0.14 }),
  // 投票落槌：一记定音（玩家投票）
  facVote: () => { noiseFx({ d: 0.05, v: 0.18, hp: 700 }); tone({ f: 420, slide: 180, t: 'triangle', d: 0.16, v: 0.18 }); },
  // 抽签滚动：密集棘轮声（第三幕）
  facRoll: () => tone({ f: 1500, t: 'square', d: 0.028, v: 0.05 }),
  // 加冕：宏大号角 + 长尾（第四幕）
  facCrown: () => {
    [[392, 0], [523, 0.12], [659, 0.24], [784, 0.36], [1047, 0.5]].forEach(([f, w]) => tone({ f, t: 'triangle', d: 0.42, v: 0.19, when: w }));
    tone({ f: 1568, t: 'sine', d: 1.1, v: 0.09, when: 0.62 });
    noiseFx({ d: 0.4, v: 0.08, hp: 1800, when: 0.5 });
  },
  // 徽章落位：清亮钟声
  facBadge: () => { tone({ f: 1175, t: 'sine', d: 0.55, v: 0.13 }); tone({ f: 1760, t: 'sine', d: 0.45, v: 0.085, when: 0.03 }); },
  // 全场提醒（免费轮 / 免租轮）：三声警铃
  facAlarm: () => { for (let i = 0; i < 3; i++) { tone({ f: 880, t: 'square', d: 0.16, v: 0.13, when: i * 0.22 }); tone({ f: 1320, t: 'sine', d: 0.14, v: 0.09, when: i * 0.22 + 0.05 }); } },
  // 免停留卡：轻快双音
  stayFree: () => { [740, 988].forEach((f, i) => tone({ f, t: 'triangle', d: 0.16, v: 0.15, when: i * 0.1 })); noiseFx({ d: 0.1, v: 0.09, hp: 2000 }); },
  // ---------- v5.3 新增音效（技能演出 / 美术动效专用） ----------
  // 主动技发动：上行号角 + 高频泛音（比被动技的 skill 更有仪式感）
  skillCast: () => {
    noiseFx({ d: 0.14, v: 0.12, hp: 1800 });
    [[659, 0], [880, 0.09], [1175, 0.18]].forEach(([f, w]) => tone({ f, t: 'triangle', d: 0.26, v: 0.19, when: w }));
    tone({ f: 1760, t: 'sine', d: 0.5, v: 0.085, when: 0.26 });
  },
  // 扫描光束：由低到高的窄带扫频
  beam: () => { for (let i = 0; i < 9; i++) tone({ f: 420 * Math.pow(1.19, i), t: 'sine', d: 0.07, v: 0.075, when: i * 0.032 }); },
  // 盖楼落成：短促木质敲击 + 上行落实
  chip: () => { noiseFx({ d: 0.05, v: 0.2, hp: 900 }); tone({ f: 420, slide: -80, t: 'triangle', d: 0.11, v: 0.16, when: 0.01 }); [620, 830].forEach((f, i) => tone({ f, t: 'sine', d: 0.13, v: 0.1, when: 0.07 + i * 0.06 })); },
  // 升级光柱：由下往上的明亮琶音
  upgrade: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f, t: 'sine', d: 0.18, v: 0.12, when: i * 0.055 })); },
  // 金币飞出：一串细碎金属声
  coinFly: () => { for (let i = 0; i < 6; i++) tone({ f: 1100 + (i % 3) * 240, t: 'triangle', d: 0.05, v: 0.07, when: i * 0.038 }); },
  // 法槌：裁定 / 加盖印章
  gavel: () => { noiseFx({ d: 0.07, v: 0.24, hp: 640 }); tone({ f: 240, slide: -90, t: 'square', d: 0.2, v: 0.16, when: 0.01 }); },
  // 危机心跳：两下低频（破产前 / 现金告急）
  pulse: () => { tone({ f: 92, t: 'sine', d: 0.2, v: 0.16 }); tone({ f: 86, t: 'sine', d: 0.24, v: 0.12, when: 0.26 }); },
  // 闪光：一声清脆高频
  glint: () => { tone({ f: 2637, t: 'sine', d: 0.14, v: 0.075 }); tone({ f: 3520, t: 'sine', d: 0.1, v: 0.04, when: 0.03 }); },
  // 低频掠过：转场 / 大事件前的铺垫
  whooshLow: () => { noiseFx({ d: 0.3, v: 0.1, hp: 380 }); tone({ f: 120, slide: 150, t: 'sine', d: 0.32, v: 0.09 }); },
  // 加冕：皇冠落顶（金属 + 长尾）
  crown: () => {
    noiseFx({ d: 0.1, v: 0.16, hp: 1400 });
    [784, 1047, 1319, 1568].forEach((f, i) => tone({ f, t: 'triangle', d: 0.24, v: 0.14, when: i * 0.07 }));
    tone({ f: 2093, t: 'sine', d: 0.62, v: 0.07, when: 0.28 });
  },
  // 回暖 / 翻盘：由暗转亮的两段
  revive: () => { [330, 494, 659, 988].forEach((f, i) => tone({ f, t: 'sine', d: 0.2, v: 0.12, when: i * 0.08 })); },
  // 轮次开场：一声轻钟
  roundBell: () => { tone({ f: 1319, t: 'sine', d: 0.34, v: 0.075 }); tone({ f: 1976, t: 'sine', d: 0.26, v: 0.04, when: 0.02 }); },
};


// ---------- 连接层（WebSocket 优先，失败自动降级 HTTP SSE） ----------
let mode = 'ws';          // 'ws' | 'http'
let outbox = [];          // WS 未就绪时的消息队列
let wsTries = 0;
let es = null;            // EventSource（HTTP 模式）
let quitFlag = false;     // 一键退出后置 true：不再渲染旧房间广播

function setConn(txt, warn) {
  const el = $('connStatus');
  if (!el) return;
  if (!txt) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.textContent = txt;
  el.style.color = warn ? '#d9534f' : '#888';
}

function handleMessage(m) {
  if (m.type === 'joined') {
    myToken = m.token; myPid = m.pid; roomCode = m.code; quitFlag = false; setConn(''); openStream();
    try { localStorage.setItem('fdm_session', JSON.stringify({ code: m.code, token: m.token })); } catch (e) {}
    // 声明自己的开麦状态：刷新页面后 micOn 归零，顺便把服务器上的「幽灵麦」清掉；
    // 断线重连时 micOn 仍在，正好把状态补回去，不会出现麦标闪断。
    act({ type: 'voice', on: !!micOn });
  }
  else if (m.type === 'state') onState(m.state);
  else if (m.type === 'rtc') onRtc(m.from, m.data);
  else if (m.type === 'error') {
    // 自动重连失败（房间已解散等）→ 清除会话，回到大厅
    try { localStorage.removeItem('fdm_session'); } catch (e) {}
    teardownVoice();   // 房间没了，语音连接一并收干净
    $('lobbyErr').textContent = m.msg;
    $('lobby-home').style.display = 'block';
    $('lobby-room').style.display = 'none';
    $('game').style.display = 'none';
    S = null; roomCode = null; myToken = null; visLog = []; logRendered = 0; logForce = true;
  }
}

function connect() {
  if (mode !== 'ws') return;
  // 该网络上次就被迫走了 HTTP 模式 → 这次直接用，不等 WS 超时
  let sm = null; try { sm = localStorage.getItem('fdm_mode'); } catch (e) {}
  if (sm === 'http') { switchHttp(); return; }
  setConn('连接服务器中…');
  let opened = false;
  try { ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`); }
  catch (e) { switchHttp(); return; }
  ws.onopen = () => { opened = true; wsTries = 0; setConn(''); try { localStorage.removeItem('fdm_mode'); } catch (e) {} flushOutbox(); };
  ws.onmessage = e => handleMessage(JSON.parse(e.data));
  ws.onclose = () => {
    if (mode !== 'ws') return;
    wsTries++;
    if (wsTries >= 3) { switchHttp(); return; }
    setConn('重连中…');
    setTimeout(connect, 1200);
  };
  ws.onerror = () => {};
  // 看门狗：5 秒还没握上手就换通道
  setTimeout(() => { if (mode === 'ws' && !opened) { try { ws.close(); } catch (e) {} } }, 5000);
}

function switchHttp() {
  if (mode === 'http') return;
  mode = 'http';
  try { localStorage.setItem('fdm_mode', 'http'); } catch (e) {}
  setConn('已切换兼容模式（HTTP）');
  openStream();
  // 排队中的消息（如自动重连）改走 HTTP 通道发出
  const q = outbox; outbox = [];
  for (const obj of q) httpSend(obj);
}

function openStream() {
  if (mode !== 'http' || !roomCode || es) return;
  es = new EventSource(`/api/stream?code=${roomCode}&token=${encodeURIComponent(myToken || '')}`);
  es.onmessage = e => handleMessage(JSON.parse(e.data));
  es.onerror = () => setConn('重连中…');
}

function flushOutbox() {
  while (outbox.length && ws && ws.readyState === 1) ws.send(JSON.stringify(outbox.shift()));
}

function send(obj) {
  if (mode === 'http') {
    httpSend(obj);
    return;
  }
  if (ws && ws.readyState === 1) { ws.send(JSON.stringify(obj)); return; }
  // 未就绪：入队等待，并给用户提示（首条 create/join 提示更有意义）
  outbox.push(obj);
  if (outbox.length === 1) setConn('连接服务器中…请稍候');
}

const b64url = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let httpChan = 'post'; // 记住可用的通道，避免每次重新试错

async function httpSend(obj, attempt = 0) {
  const chans = httpChan === 'post' ? ['post', 'post', 'get', 'get'] : ['get', 'get', 'post', 'post'];
  const chan = chans[Math.min(attempt, 3)];
  try {
    const body = { ...obj, code: roomCode, token: myToken };
    let r;
    if (chan === 'get') {
      r = await fetch('/api/action?p=' + b64url(JSON.stringify(body)), { cache: 'no-store' });
    } else {
      r = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    const j = await r.json();
    if (j && j.ok) {
      httpChan = chan;
      for (const m of (j.msgs || [])) handleMessage(m);
      return;
    }
    throw new Error('服务端返回异常');
  } catch (e) {
    if (attempt < 3) {
      setConn('网络抖动，正在重试(' + (attempt + 1) + '/4)…');
      await new Promise(r => setTimeout(r, 700 + attempt * 600));
      return httpSend(obj, attempt + 1);
    }
    setConn('网络异常', true);
    $('lobbyErr').textContent = '网络异常：' + (e && e.message ? e.message : '请求失败') + '（已尝试 POST/GET 各两次，请检查网络或换网重试）';
  }
}

// ---------- 会话保持：刷新页面自动回到上次房间 ----------
let savedSession = null;
try { savedSession = JSON.parse(localStorage.getItem('fdm_session') || 'null'); } catch (e) {}
if (savedSession && savedSession.code && savedSession.token) {
  outbox.push({ type: 'join', code: savedSession.code, token: savedSession.token, name: (localStorage.getItem('fdm_name') || '玩家') });
  const ni = $('nameInput'); if (ni && !ni.value) ni.value = localStorage.getItem('fdm_name') || '';
}
const act = a => send({ action: a });

// ---------- 音效开关与全局点击音 ----------
// 一键退出：AI 接管，无需投票
$('btnQuit').onclick = () => {
  if (!S || S.phase === 'lobby' || S.phase === 'over') return;
  if (!confirm('确定退出本局吗？\n\n退出后由 AI 替你继续打完，无需其他玩家同意，\n你随时可以创建/加入新的对局。')) return;
  stopMic(true);                                   // 退出即闭麦并断开所有语音连接
  act({ type: 'quit' });
  try { localStorage.removeItem('fdm_session'); } catch (e) {}
  quitFlag = true;
  S = null; roomCode = null; myToken = null; visLog = []; logRendered = 0; logForce = true;
  dispReady = false; dispSeason = 'mid'; dispWeather = 'cloud'; dispCal = null; curWeather = null;
  facCloseUI(); facBadgeKey = null; facCeremonyBusy = false;   // v5.2：收掉风貌浮层、清掉中央徽章
  tokSig = ''; actionsSig = null; assetsSig = null; buildSig = '';
  $('game').style.display = 'none';
  $('lobby').style.display = 'flex';
  $('lobby-home').style.display = 'block';
  $('lobby-room').style.display = 'none';
  $('lobbyErr').textContent = '已退出对局，AI 正替你继续。开个新房间即可开始下一局。';
  setConn('');
  SFX.click();
};
$('btnSpeed').onclick = () => {
  speed = speed === 1 ? 0.5 : 1;
  $('btnSpeed').textContent = speed === 1 ? '🐢' : '🐇';
  SFX.click();
  try { localStorage.setItem('fdm_speed', speed === 1 ? 'slow' : 'fast'); } catch (e) {}
};
try { if (localStorage.getItem('fdm_speed') === 'fast') $('btnSpeed').textContent = '🐇'; } catch (e) {}
$('btnSound').onclick = () => {
  soundOn = !soundOn;
  $('btnSound').textContent = soundOn ? '🔊' : '🔇';
  if (soundOn) SFX.click();
  try { localStorage.setItem('fdm_sound', soundOn ? '1' : '0'); } catch (e) {}
};
try { if (localStorage.getItem('fdm_sound') === '0') { soundOn = false; $('btnSound').textContent = '🔇'; } } catch (e) {}

// ---------- v5.4：AI 托管 ----------
function trusteeMe() {
  const me = S && S.players && S.players.find(p => p.id === myPid);
  return me ? !!me.trustee : false;
}
function paintTrustee() {
  const b = $('btnTrustee'); if (!b) return;
  const on = trusteeMe();
  const inGame = S && S.phase !== 'lobby' && S.phase !== 'over';
  b.style.display = inGame ? '' : 'none';
  b.classList.toggle('on', on);
  b.textContent = on ? '🤖 托管中' : '🤖 托管';
  b.title = on ? '点一下取回操作权，恢复自己手动操作' : 'AI 托管：开启后你的回合由 AI 代打，随时可点一下取回操作权';
}
$('btnTrustee').onclick = () => {
  if (!S || S.phase === 'lobby' || S.phase === 'over') return;
  const me = S.players.find(p => p.id === myPid);
  if (!me || !me.alive) return;
  const on = !me.trustee;
  if (on && !confirm('开启 AI 托管？\n\n开启后你的回合由 AI 代打（买地 / 盖房 / 技能等全自动），\n随时再点一下「取回操作权」即可恢复手动。')) return;
  act({ type: 'trustee', on });
};
// 托管状态横幅提示（谁开了 / 谁取回了，全场可见）
function trusteeToast(e) {
  const who = ownerName(e.pid);
  const layer = $('fxLayer'); if (!layer) return;
  const d = document.createElement('div');
  d.className = 'trustee-toast' + (e.on ? ' on' : '');
  d.innerHTML = e.on ? `🤖 ${esc(who)} 开启了 AI 托管` : `🙋 ${esc(who)} 取回了操作权`;
  layer.appendChild(d);
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show')));
  setTimeout(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 420); }, 2400);
  if (e.on) { SFX.trusteeOn(); } else { SFX.trusteeOff(); }
}
document.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('.btn') && e.target.id !== 'btnSound') SFX.click();
});

// ---------- 聊天 / 表情（含 AI 参与） ----------
function sendChat(text) {
  const t = String(text == null ? '' : text).trim();
  if (!t) return;
  if (!S || !myPid || S.phase === 'lobby' || S.phase === 'over') return;
  act({ type: 'chat', text: t.slice(0, 30) });
}
document.querySelectorAll('.emo').forEach(b => { b.onclick = () => sendChat(b.dataset.e); });
// 快捷语言：点一下就发一句，并同步「配音」（浏览器语音合成，中文）
// v5.0 续·二：扩到 4 组 × 8 句 = 32 句，并按「语气」给每句配不同的语速 / 音调 / 音量
const QUICK_SET = new Set(
  Array.from(document.querySelectorAll('#quickRow .quick')).map(b => b.dataset.q)
);
// 文本 → 语气：自己和别人发同一句时用同一种念法
const QUICK_TONE = {};
document.querySelectorAll('#quickRow .quick').forEach(b => { QUICK_TONE[b.dataset.q] = b.dataset.tone || 'normal'; });
// 分组切换：一次只显示一组，32 句也不会把聊天框撑爆
const qTabs = Array.from(document.querySelectorAll('#quickTabs .qt'));
const qGroups = Array.from(document.querySelectorAll('#quickRow .qgroup'));
qTabs.forEach(t => {
  t.onclick = () => {
    const g = t.dataset.g;
    qTabs.forEach(x => x.classList.toggle('on', x === t));
    qGroups.forEach(x => x.classList.toggle('on', x.dataset.g === g));
    if (soundOn) SFX.pop();
  };
});
document.querySelectorAll('#quickRow .quick').forEach(b => {
  b.onclick = () => { sendChat(b.dataset.q); speak(b.dataset.q, null, b.dataset.tone, myPid); };
});
$('btnChat').onclick = () => { const v = $('chatInput').value; if (v && v.trim()) { sendChat(v); $('chatInput').value = ''; } };
$('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('btnChat').click(); } });

// ---------- 快捷语音配音（Web Speech API，零素材；带"语气"） ----------
// 同一句话换一组语速 / 音调 / 音量，听感上就不像机读，而像真人在说
const TONE = {
  normal: { rate: 1.12, pitch: 1.06, vol: 0.95 },
  up:     { rate: 1.24, pitch: 1.20, vol: 1.00 },   // 兴奋 / 得意
  cool:   { rate: 1.00, pitch: 0.90, vol: 0.95 },   // 淡定 / 挑衅
  angry:  { rate: 1.28, pitch: 1.04, vol: 1.00 },   // 生气
  sad:    { rate: 0.86, pitch: 0.84, vol: 0.90 },   // 沮丧 / 求饶
  soft:   { rate: 0.95, pitch: 1.00, vol: 0.88 },   // 温和 / 客气
  warn:   { rate: 1.16, pitch: 1.12, vol: 1.00 },   // 警告
};
// ---------- 可选：接入「豆包（火山引擎）语音合成」，音色更自然、更有情绪 ----------
// 默认用浏览器自带中文语音（零素材、零流量、断网可用）。
// 想换成豆包音色：让后端（server.js）暴露一个 /tts?text=&voice= 代理转发到火山语音合成接口，
// 然后在 index.html 里加一行 <script>window.TTS_REMOTE = { url:'/tts', voice:'zh_female_...', emotion:'happy' }</script>。
// 未配置 / 请求失败 → 自动回退浏览器语音，游戏照常。
function speakRemote(line, t) {
  const cfg = (typeof window !== 'undefined') && window.TTS_REMOTE;
  if (!cfg || !cfg.url) return false;
  try {
    const q = new URLSearchParams({ text: line, tone: (t && t.name) || 'normal', voice: cfg.voice || '', emotion: cfg.emotion || '' });
    const a = new Audio(cfg.url + (cfg.url.includes('?') ? '&' : '?') + q.toString());
    a.volume = t ? t.vol : 0.95;
    const pr = a.play();
    if (pr && pr.catch) pr.catch(() => {});
    ttsSeq++;   // 记录一次远端播放，避免和本地语音叠音
    return true;
  } catch (e) { return false; }
}
let ttsSeq = 0;
let voiceCache = null;
// 中文音色优先级：macOS 上更"像人"的几个声音排前面，其余按语言兜底
const VOICE_PREFER = ['Tingting', '婷婷', 'Meijia', '美佳', 'Yu-shu', '语舒', 'Li-mu', 'Xiao-xiao', 'Yue', 'Google 普通话', 'Xiaoxiao', 'Yunxi'];
function pickVoice() {
  if (voiceCache) return voiceCache;
  try {
    const vs = window.speechSynthesis.getVoices() || [];
    const zh = vs.filter(v => /zh[-_]CN|zh[-_]Hans|Chinese|普通话/i.test(v.lang + ' ' + v.name));
    let best = null;
    for (const p of VOICE_PREFER) { best = zh.find(v => (v.name || '').includes(p)); if (best) break; }
    if (!best) best = zh.find(v => v.localService) || zh[0];
    voiceCache = best || vs.find(v => /^zh/i.test(v.lang)) || null;
  } catch (e) { voiceCache = null; }
  return voiceCache;
}
try { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => { voiceCache = null; pickVoice(); }; } catch (e) {}
// v5.1：同一句语音的「防重播」窗口 —— 自己点一次、别人那边也只应响一次。
// WS/SSE 双通道、状态重推都可能让同一条 chat 事件到场两次，这里按「谁+内容」在 1.6s 内只念一遍。
const ttsSeen = new Map();
function ttsOnce(key) {
  const now = Date.now();
  const last = ttsSeen.get(key);
  ttsSeen.set(key, now);
  if (ttsSeen.size > 40) { for (const [k, t] of ttsSeen) if (now - t > 4000) ttsSeen.delete(k); }
  return last === undefined || (now - last) > 1600;
}
function speak(text, who, tone, pid) {
  if (!soundOn || !text) return;
  if (!ttsOnce(`${pid == null ? 'me' : pid}|${text}`)) return;   // 已念过 → 直接跳过，避免回音/叠音
  const key = tone || QUICK_TONE[text] || 'normal';
  const t = Object.assign({ name: key }, TONE[key] || TONE.normal);
  // v5.1：不再有「某某说：」前缀 —— 所有人听到的就是语音内容本身（谁发的看气泡/日志就行）
  // 标点会让朗读更"有语气"：给不带标点的短句补一个句末语气标点
  const line = /[。！？!?…~～]$/.test(text) ? text : text + (t.name === 'up' ? '！' : (t.name === 'sad' || t.name === 'soft' ? '……' : '。'));
  if (speakRemote(line, t)) return;
  try {
    const synth = window.speechSynthesis; if (!synth) return;
    const u = new SpeechSynthesisUtterance(line);
    const v = pickVoice(); if (v) u.voice = v;
    u.lang = 'zh-CN'; u.rate = t.rate; u.pitch = t.pitch; u.volume = t.vol;
    // 先取消上一句（同一时间只留一句），再在下一个事件循环里开口 ——
    // 立刻 cancel()+speak() 在部分浏览器上会把同一句念两遍（就是用户听到的"回音"）。
    synth.cancel();
    setTimeout(() => { try { synth.speak(u); } catch (e) {} }, 60);
  } catch (e) {}
}


// ---------- 开麦语音（WebRTC mesh；信令复用现有 WS/HTTP 通道） ----------
// 规则：房间里只要有一方开着麦，双方就建立连接——开麦的一侧发送自己的音轨，另一端作为听众接收。
// 这样「没开麦的人」也能听到别人说话，符合开麦直觉，又不用双向各自按一次。
// 信令按「玩家 id」寻址经服务器转发，客户端之间不交换 token，避免身份被冒用。
// 协商冲突用 perfect negotiation 化解：id 小的为发起方(impolite)，id 大的为礼让方(polite)。
const RTC_CFG = {
  iceServers: [
    { urls: 'stun:stun.qq.com:3478' },
    { urls: 'stun:stun.miwifi.com:3478' },
    { urls: 'stun:stun.chat.bilibili.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 2,
};
const pidNum = x => { const m = String(x == null ? '' : x).match(/\d+/); return m ? parseInt(m[0], 10) : 0; };

let micOn = false, micStream = null, micBusy = false;
let micAnalyser = null, micBuf = null, micLevel = 0, micSpeaking = false;
const peers = new Map();      // pid -> { pc, tr, src, gain, analyser, buf, polite, makingOffer, ignoreOffer, dead }
const peerRetry = new Map();  // pid -> 已重建次数（上限 3，防止打不通时无限重连）
const VOICE_TH = 0.045;       // 说话判定阈值（RMS）
const voiceTo = (pid, data) => act({ type: 'rtc', to: pid, data });

async function toggleMic() {
  if (micBusy) return;
  if (myPid == null) { toast('观战状态无法开麦，加入对局后即可'); return; }
  if (micOn) { stopMic(); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('当前环境不支持麦克风（需要 HTTPS 或 localhost 打开本页）'); return;
  }
  micBusy = true;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
  } catch (e) {
    micBusy = false;
    const n = e && e.name;
    toast(n === 'NotAllowedError' ? '麦克风被拒绝：请在地址栏允许本站使用麦克风后重试'
      : n === 'NotFoundError' ? '没找到麦克风设备'
        : '麦克风打开失败：' + ((e && e.message) || n || '未知错误'));
    return;
  }
  micBusy = false;
  micOn = true;
  const ctx = ac();                       // 复用音效的 AudioContext：只做电平检测，不接扬声器（否则自听啸叫）
  if (ctx && ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) {} }
  try {
    micAnalyser = ctx.createAnalyser(); micAnalyser.fftSize = 512;
    micBuf = new Uint8Array(micAnalyser.fftSize);
    ctx.createMediaStreamSource(micStream).connect(micAnalyser);
  } catch (e) { micAnalyser = null; micBuf = null; }
  act({ type: 'voice', on: true });
  paintVoice(); syncPeers();   // 建连时会把音轨直接 addTrack 进去
  toast('🎤 已开麦，房间里的人都能听到你说话');
}

function teardownVoice() {
  micOn = false;
  if (micStream) { try { micStream.getTracks().forEach(t => t.stop()); } catch (e) {} micStream = null; }
  micAnalyser = null; micBuf = null; micLevel = 0; micSpeaking = false;
  for (const pid of [...peers.keys()]) destroyPeer(pid);
  paintVoice(); paintSpeaking();
}

function stopMic(silent) {
  if (!micOn && !micStream) return;
  teardownVoice();
  if (myPid != null) act({ type: 'voice', on: false });
  syncPeers();   // 闭麦后仍要保留「别人开着麦」的聆听连接
  if (!silent) toast('🔇 已闭麦');
}

// 和谁建连：除自己外、同样「开着麦」的人。双方都开麦才进语音房——
// 没开麦的人不会被强制收听到别人的声音（避免突然出声打扰），但能从卡片上看到谁在麦上。
function syncPeers() {
  if (myPid == null || !S || !Array.isArray(S.players)) return;
  const want = new Set();
  for (const p of S.players) {
    if (p.id === myPid) continue;
    if (p.voice && micOn) want.add(p.id);
  }
  for (const pid of [...peers.keys()]) if (!want.has(pid)) destroyPeer(pid);
  for (const pid of want) if (!peers.has(pid)) createPeer(pid);
  paintVoice();
}

function createPeer(pid) {
  if (typeof RTCPeerConnection === 'undefined') return null;
  let pc;
  try { pc = new RTCPeerConnection(RTC_CFG); } catch (e) { return null; }
  const pr = {
    pid, pc, polite: pidNum(myPid) > pidNum(pid),
    // 发起方唯一化：只有 id 小的一侧主动发起协商，另一侧等对方 offer 再应答案，
    // 从根本上避免双方同时 offer 造成的 glare（否则可能协商成功却挂不上远端音轨）。
    initiator: pidNum(myPid) < pidNum(pid), gotRemote: false,
    makingOffer: false, ignoreOffer: false, dead: false,
    src: null, el: null, analyser: null, buf: null, level: 0, speaking: false,  };
  peers.set(pid, pr);
  try {
    // 双方都开麦才会建连，所以这里一定拿得到音轨；直接 addTrack，
    // 让 offer/answer 天然是 sendrecv，双向都能出声，不必再做二次重协商。
    if (micOn && micStream) for (const t of micStream.getAudioTracks()) pc.addTrack(t, micStream);
  } catch (e) {}
  pc.onnegotiationneeded = async () => {
    if (pr.dead) return;
    if (!pr.initiator && !pr.gotRemote) return;   // 被动方首轮不主动出价，等对方先来
    try {
      pr.makingOffer = true;
      await pc.setLocalDescription();
      voiceTo(pid, { desc: pc.localDescription });
    } catch (e) {} finally { pr.makingOffer = false; }
  };
  pc.onicecandidate = e => { if (e.candidate && !pr.dead) voiceTo(pid, { cand: e.candidate }); };
  pc.ontrack = e => attachRemote(pr, e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]));
  pc.onconnectionstatechange = () => {
    if (pr.dead) return;
    const st = pc.connectionState;
    pr.state = st;
    if (st === 'connected') peerRetry.delete(pid);
    else if (st === 'failed') retryPeer(pid);
    paintVoice();
  };
  return pr;
}

function destroyPeer(pid) {
  const pr = peers.get(pid); if (!pr) return;
  pr.dead = true;
  peers.delete(pid);
  try {
    pr.pc.onnegotiationneeded = null; pr.pc.onicecandidate = null;
    pr.pc.ontrack = null; pr.pc.onconnectionstatechange = null;
    pr.pc.close();
  } catch (e) {}
  try { if (pr.src) pr.src.disconnect(); } catch (e) {}
  try { if (pr.analyser) pr.analyser.disconnect(); } catch (e) {}
  try { if (pr.el) { pr.el.srcObject = null; pr.el.pause(); } } catch (e) {}
  paintVoice();
}

function retryPeer(pid) {
  const n = peerRetry.get(pid) || 0;
  destroyPeer(pid);
  if (n >= 3) return;                     // 三次打不通就放弃（多为严格 NAT），不再刷连接
  peerRetry.set(pid, n + 1);
  setTimeout(() => syncPeers(), 1000 + n * 1500);
}

// 远端音频：用 <audio> 元素播放（最稳，不受 AudioContext 挂起/自动播放策略牵连），
// 另外挂一个分析器做「谁在说话」的电平检测。
function attachRemote(pr, stream) {
  try {
    if (!pr.el) { pr.el = new Audio(); pr.el.autoplay = true; pr.el.playsInline = true; }
    pr.el.srcObject = stream;
    const pp = pr.el.play(); if (pp && pp.catch) pp.catch(() => {});
  } catch (e) {}
  // 音轨还是 muted 时建 source node，可能一直输出静音 → 等它真的出声再挂
  const t = stream.getAudioTracks()[0];
  const build = () => buildRemoteAnalyser(pr, stream);
  if (t && t.muted) {
    try { t.addEventListener('unmute', build, { once: true }); } catch (e) {}
    setTimeout(build, 1200);   // 兜底：个别实现不触发 unmute
  } else build();
}

function buildRemoteAnalyser(pr, stream) {
  if (pr.dead || pr.analyser) return;
  const ctx = ac(); if (!ctx) return;
  try {
    pr.src = ctx.createMediaStreamSource(stream);
    pr.analyser = ctx.createAnalyser(); pr.analyser.fftSize = 512;
    pr.buf = new Uint8Array(pr.analyser.fftSize);
    pr.src.connect(pr.analyser);   // 只做分析，不接扬声器（播放交给 <audio>）
  } catch (e) { pr.src = null; pr.analyser = null; }
}

async function onRtc(from, data) {
  if (myPid == null || !data) return;
  let pr = peers.get(from);
  if (!pr) {
    // 对方主动连我，说明两边都在麦上（服务器已限定只有对局玩家能发信令）；
    // 不做 voice 二次校验，避免与 state 广播的到达顺序产生竞态。
    const op = S && S.players ? S.players.find(p => p.id === from) : null;
    if (!op) return;
    pr = createPeer(from);
    if (!pr) return;
  }
  const pc = pr.pc;
  try {
    if (data.desc) {
      const offerCollision = data.desc.type === 'offer' && (pr.makingOffer || pc.signalingState !== 'stable');
      pr.ignoreOffer = !pr.polite && offerCollision;
      if (pr.ignoreOffer) return;
      if (data.desc.type === 'offer') pr.gotRemote = true;   // 被动方从此可以正常参与重协商
      await pc.setRemoteDescription(data.desc);
      if (data.desc.type === 'offer') {
        await pc.setLocalDescription();
        voiceTo(from, { desc: pc.localDescription });
      }
    } else if (data.cand) {
      try { await pc.addIceCandidate(data.cand); }
      catch (e) { if (!pr.ignoreOffer) throw e; }
    }
  } catch (e) {}
}

// 开麦状态画到 UI（低频：开关麦、进出房间时才调用）
function paintVoice() {
  const b1 = $('btnMic'), b2 = $('btnMic2');
  if (b1) {
    b1.classList.toggle('live', micOn);
    b1.textContent = micOn ? '🎙️' : '🎤';
    b1.title = micOn ? '正在开麦：点击闭麦' : '开麦语音：点一下开启麦克风，房间里的人就能听到你';
  }
  if (b2) { b2.classList.toggle('on', micOn); b2.textContent = micOn ? '🔇 闭麦' : '🎤 开麦'; }
  const bar = $('voiceBar');
  if (bar) {
    const others = (S && S.players) ? S.players.filter(p => p.id !== myPid && p.voice).length : 0;
    if (!micOn && others === 0) bar.style.display = 'none';
    else {
      bar.style.display = 'block';
      bar.classList.toggle('live', micOn);
      if (!micOn) bar.textContent = `🎙️ ${others} 人在麦上 · 点 🎤 加入语音`;
      else if (others === 0) bar.textContent = '🎙️ 你已开麦 · 等其他人开麦即可通话';
      else {
        const ok = [...peers.values()].filter(p => p.pc.connectionState === 'connected').length;
        bar.textContent = `🎙️ 语音中 · 麦上 ${others + 1} 人` + (peers.size ? ` · 已接通 ${ok}/${peers.size}` : ' · 连接中…');
      }
    }
  }
}

// 说话高亮（高频：只切 class，不重建 DOM；没人在麦上时一次清干净就收工）
let spokeAny = false;
function paintSpeaking() {
  const list = (S && S.players) || [];
  if (!list.some(p => p.voice)) {
    if (!spokeAny) return;
    spokeAny = false;
    document.querySelectorAll('.pcard.speaking, .player-item.speaking, .vmic.speaking')
      .forEach(el => el.classList.remove('speaking'));
    return;
  }
  spokeAny = true;
  for (const p of list) {
    const on = !!((p.id === myPid ? micSpeaking : (peers.get(p.id) || {}).speaking) && p.voice);
    const card = document.querySelector(`.pcard[data-pid="${p.id}"]`);
    if (card) card.classList.toggle('speaking', on);
    const item = document.querySelector(`.player-item[data-pid="${p.id}"]`);
    if (item) item.classList.toggle('speaking', on);
    const ic = document.querySelector(`.vmic[data-vmic="${p.id}"]`);
    if (ic) ic.classList.toggle('speaking', on);
  }
}

function voiceLevel(an, buf) {
  if (!an || !buf) return 0;
  try {
    an.getByteTimeDomainData(buf);
    let s = 0;
    for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; }
    return Math.sqrt(s / buf.length);
  } catch (e) { return 0; }
}

// 220ms 一轮电平采样：说话立即点亮，说完自然回落（带衰减，避免闪烁）
setInterval(() => {
  if (myPid == null || (!micOn && peers.size === 0)) return;
  if (micAnalyser) {
    micLevel = Math.max(voiceLevel(micAnalyser, micBuf), micLevel * 0.55);
    micSpeaking = micLevel > VOICE_TH;
  }
  for (const pr of peers.values()) {
    if (!pr.analyser) { pr.speaking = false; continue; }
    pr.level = Math.max(voiceLevel(pr.analyser, pr.buf), pr.level * 0.55);
    pr.speaking = pr.level > VOICE_TH;
  }
  paintSpeaking();
}, 220);

$('btnMic').onclick = toggleMic;
$('btnMic2').onclick = toggleMic;
// 自动播放被拦时，任何一次页面点击都补一次播放（开麦本身也是手势，正常情况不会触发）
document.addEventListener('click', () => {
  for (const pr of peers.values()) {
    if (pr.el && pr.el.paused) { const pp = pr.el.play(); if (pp && pp.catch) pp.catch(() => {}); }
  }
}, true);
window.addEventListener('beforeunload', () => { if (micStream) { try { micStream.getTracks().forEach(t => t.stop()); } catch (e) {} } });


// ---------- 大厅 ----------
$('btnCreate').onclick = () => { const n = $('nameInput').value.trim(); if (!n) return $('lobbyErr').textContent = '先给自己起个名字'; try { localStorage.setItem('fdm_name', n); } catch (e) {} send({ type: 'create', name: n }); };
$('btnJoin').onclick = () => { const n = $('nameInput').value.trim(); const c = $('codeInput').value.trim(); if (!n) return $('lobbyErr').textContent = '先给自己起个名字'; if (!/^\d{6}$/.test(c)) return $('lobbyErr').textContent = '房间号是 6 位数字'; try { localStorage.setItem('fdm_name', n); } catch (e) {} send({ type: 'join', code: c, name: n }); };
$('btnAddAI').onclick = () => act({ type: 'addAI' });
$('btnStart').onclick = () => act({ type: 'start' });
$('btnCopy').onclick = () => { navigator.clipboard.writeText(`${location.origin}?room=${roomCode}`).then(() => { $('btnCopy').textContent = '已复制 ✓'; setTimeout(() => $('btnCopy').textContent = '复制邀请链接', 1500); }); };

// URL 带房间号 → 预填
if (location.search.includes('room=')) { const c = location.search.split('room=')[1].slice(0, 6); $('codeInput').value = c; }

// ---------- 状态处理 ----------
function onState(state) {
  if (quitFlag) return;    // 已一键退出：忽略旧房间广播（观战者无 roomCode，仍正常渲染）
  const firstFrame = (S === null);
  if (roomCode && S === null) { $('lobby').style.display = 'none'; $('game').style.display = 'flex'; $('roomCode').textContent = roomCode; }
  S = state;
  paintTrustee();   // v5.4：托管按钮状态随快照刷新
  syncPeers(); paintVoice();   // 语音房随最新玩家名单增删连接
  if (firstFrame && Array.isArray(state.log)) { visLog = state.log.map(l => l.msg); logRendered = 0; logForce = true; }   // 首次进入：先用完整历史打底
  if (firstFrame) {
    dispSeason = state.season || 'mid'; dispWeather = state.weather || 'cloud'; dispCal = state.calEvent || null; dispReady = true;
    tokSig = ''; actionsSig = null; assetsSig = null; buildSig = ''; ghostSig = '';
    syncDisp(state);
  }
  const wasLobby = state.phase === 'lobby';
  if (wasLobby) overShown = false;   // 新一局允许再次触发结算页
  $('lobby').style.display = wasLobby ? 'flex' : 'none';
  $('game').style.display = wasLobby ? 'none' : 'flex';
  if (wasLobby) { $('lobby-home').style.display = 'none'; $('lobby-room').style.display = 'block'; $('roomCode').textContent = roomCode; renderLobby(); }
  else {
    for (const e of state.events) {
      // v5.1：只有「自己发的」聊天即时显示（否则要等动画播完才看到自己的话）；
      // 其他人（含 AI）的聊天/表情必须排队顺播，避免抢在移动与结算动画之前剧透结果。
      if (e.t === 'chat' && e.pid === myPid) {
        chatFx(e);
        visLog.push(`💬 ${e.name}：${e.text}`);
        renderLog();
        continue;
      }
      queueAnim(e);
    }
    render(state);
    // v5.2：断线重连 / 中途加入时，服务端不会再补发 faculty_offer —— 按快照把投票浮层补回来
    const hasChosen = (state.events || []).some(e => e.t === 'faculty_chosen');
    if (state.phase === 'faculty' && (state.facultyOptions || []).length) facOpenVote({ options: state.facultyOptions, ms: 12000 });
    else if (!hasChosen && !facCeremonyBusy) facCloseUI();
  }
}
function renderLobby() {
  $('playerList').innerHTML = S.players.map(p => {
    const mj = MAJORS[p.major] || {};
    return `<div class="player-item" data-pid="${p.id}"><span class="dot" style="background:${p.color}"></span>${p.voice ? `<span class="vmic on" data-vmic="${p.id}">🎤</span>` : ''}${esc(p.name)}${p.isAI ? '<span class="tag">AI</span>' : ''}${p.id === myPid ? '<span class="tag">你</span>' : ''}${mj.name ? `<span class="mj-tag">${mj.icon}${esc(mj.name)}</span>` : ''}</div>`;
  }).join('');
  paintSpeaking();
  $('btnStart').disabled = S.players.length < 2;
  const me = S.players.find(p => p.id === myPid);
  const row = $('majorRow');
  if (row) {
    // v5.3：专业扩到 60 种 —— 平铺样式不变，仅新增搜索；用签名守卫避免每次状态推送都重建 DOM
    // （否则正在输入的搜索词与滚动位置会被重置）
    const sig = (me ? me.major : '') + ':' + S.players.length;
    if (sig !== majorRowSig) { majorRowSig = sig; row.innerHTML = buildMajorHtml(me); filterMajors($('majorSearch') ? $('majorSearch').value : ''); }
  }
  const mh = $('majorHint');
  if (mh && me) {
    const m = MAJORS[me.major] || {};
    const how = m.mode === 'active' ? '轮到你时会弹窗询问是否发动' : '满足条件时自动发动';
    mh.textContent = `你的专业：${m.name || '—'} · 技能「${m.skill || ''}」${how}（每局 ${m.uses} 次）`;
  }
}
// v5.3：专业扩到 60 种 —— 布局与 v5.2 之前的平铺样式完全一致，仅新增搜索；
// 用签名守卫避免每次状态推送都重建 DOM（否则正在输入的搜索词与滚动位置会被重置）
let majorRowSig = '';
function buildMajorHtml(me) {
  return Object.values(MAJORS).map(m => `<button class="major-btn ${me && me.major === m.id ? 'sel' : ''}" data-txt="${esc((m.name + ' ' + m.skill + ' ' + m.desc + ' ' + m.id).toLowerCase())}" onclick="act({type:'major',major:'${m.id}'})">
        <span class="mj-name">${m.icon} ${esc(m.name)} · ${esc(m.skill)}</span>
        <span class="mj-skill">${esc(m.desc)}（每局 ${m.uses} 次）</span>
      </button>`).join('');
}
// 搜索过滤：隐藏不匹配的专业按钮
function filterMajors(q) {
  const row = $('majorRow'); if (!row) return;
  q = String(q || '').trim().toLowerCase();
  row.querySelectorAll('.major-btn').forEach(btn => {
    const hit = !q || (btn.dataset.txt || '').includes(q);
    btn.style.display = hit ? '' : 'none';
  });
}
window.filterMajors = filterMajors;

// ---------- 动画队列 ----------
const ANIMATED = new Set(['roll', 'move', 'card', 'buy', 'build', 'charge', 'money', 'mortgage', 'redeem', 'gojail', 'stay', 'jackpot', 'bankrupt', 'turn', 'quit', 'season', 'weather', 'calevent', 'caleventHit', 'tax', 'ach', 'skill', 'duel', 'item', 'shield', 'medal', 'voucher', 'medalBuy', 'medalGain', 'combo', 'demolish', 'cardBuild', 'calwave', 'gift', 'buff', 'invest', 'rollpay', 'draw', 'major_switch', 'endgame', 'mono', 'trustee',
  // v5.2：校园风貌
  'faculty_offer', 'faculty_vote', 'faculty_chosen', 'faculty_round', 'faculty_wave', 'facfx', 'stay_free', 'stay_free_gain', 'free_rent',
  // v5.6：双数再掷提示 + 免费轮/免租轮大屏抽签
  'doubles', 'faculty_draw']);
let animPending = 0;   // 排队中的动画数；>0 时 renderTokens 冻结，防止棋子瞬移
let visLog = [];       // 已"播放"的日志：按事件流逐步出现，与地图动画严格同节奏（不超前、不滞后）
let logRendered = 0;   // visLog 中已渲染的下标数（增量渲染，避免每次重排 200+ 行）
let logForce = false;  // 需要整体重建（重连 / 重置 / 与服务端对齐）
let qDepth = 0;        // 排队等待播放的事件数（自适应节奏的依据：越积压越快，追平后回到从容）
let dispLag = 0;       // 屏幕比服务端真实状态滞后的毫秒数（由日志事件时间戳推算，用于调校节奏）
function queueAnim(e) {
  const isAnim = ANIMATED.has(e.t);
  if (isAnim) animPending++;
  qDepth++;
  animQ = animQ.then(() => handleAnim(e)).catch(err => { try { console.error('anim err', err); } catch (e2) {} }).then(() => {
    qDepth--;
    applyDispDiff(e && e.d);   // v5.1：动画播完才套用这次的现金/地皮/基金池增量
    if (!S) return;
    if (isAnim) animPending--;
    renderTokens(S);
    renderPanel(S);   // 每播完一条就刷新：对话区/现金紧跟地图节奏，不再等整轮结束
  });
}
// 节奏控制：1 = 从容（默认，所有动画放慢），0.5 = 快速
let speed = 1;
try { if (localStorage.getItem('fdm_speed') === 'fast') speed = 0.5; } catch (e) {}
// 全局基准节拍：整体再放慢，让每个过程都看得清（所有动画时长都经 sp/sleep/st 走这里）
const PACE = 1.45;
// 自适应追帧：客户端播放速度天生慢于服务端推进速度，若队列积压过多就临时加速追平，
// 追平后立刻回到从容节奏 —— 既保证"看得清"，又不会越播越落后、越玩越卡。
function paceScale() {
  if (qDepth >= 14) return 0.35;
  if (qDepth >= 9) return 0.5;
  if (qDepth >= 4) return 0.65;
  if (qDepth >= 2) return 0.85;
  return 1;
}
const sp = ms => Math.max(28, Math.round(ms * speed * PACE * paceScale()));
const sleep = ms => new Promise(r => setTimeout(r, sp(ms)));
const st = (fn, ms) => setTimeout(fn, sp(ms));
// 大字播报横幅：谁踩到谁家、付了多少钱，慢速展示让大家看清
function announce(html, ms = 1800) {
  const d = document.createElement('div');
  d.className = 'announce'; d.innerHTML = html;
  $('fxLayer').appendChild(d);
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show')));
  st(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 380); }, ms);
  return sleep(ms + 300);   // 横幅停留并等淡出，动画队列在此期间暂停
}
async function handleAnim(e) {
  if (!S) return;   // 已退出/重置后不再播动画
  switch (e.t) {
    case 'log': { visLog.push(e.msg); if (e.ts) dispLag = Date.now() - e.ts; break; }
    case 'roll': SFX.pop(); await diceAnim(e.d1, e.d2, e.single); break;
    case 'doubles': {   // v5.6：掷出双数 —— 全场横幅提示"再来一次"
      SFX.glint(); SFX.dice();
      const who = ownerName(e.pid);
      announce(e.again ? `🎲 <span class="who">${esc(who)}</span> 掷出双数！再来一次（本回合第 ${e.nth} 掷）` : `🎲 <span class="who">${esc(who)}</span> 掷出双数，但一回合最多掷两次`, 1500);
      break;
    }
    case 'faculty_draw': await facultyDrawAnim(e); break;   // v5.6：免费轮/免租轮大屏抽签
    case 'move': await moveAnim(e); break;
    case 'card': {
      SFX.card(); SFX.sparkle();
      const isFate = e.type === 'fate';
      fxBurst(playerCell(e.pid), { kind: 'spark', n: 20, speed: 3.4, size: 3.4, life: 40,
        color: isFate ? ['#1D9E75', '#6fd6ad', '#bff0dc'] : ['#AF7AC5', '#d5aae8', '#f0dcf8'], wave: { r: 54, color: isFate ? '#1D9E75' : '#AF7AC5' } });
      await cardAnim(e);
      break;
    }
    case 'buy': {
      SFX.buy(); SFX.stamp(); SFX.flagPop(); fxAt(e.cell, `<div class="floaty minus">-¥${e.price}</div>`); pulseCell(e.cell, e.mortgageBuy ? '#b0aca4' : '#2e7d32');
      if (!e.mortgageBuy) flagPop(e.cell, (S.players.find(p => p.id === e.pid) || {}).color);   // v5.4：买地插旗（抵押买回不插旗）
      fxBurst(e.cell, { kind: 'spark', n: 12, speed: 2.6, size: 2.8, life: 34, color: '#5cc98a', wave: { r: 40, color: '#2e7d32' } });
      flyCoin(playerCell(e.pid), cellCenter(e.cell), 3);   // 付款金币从买家飞向地块
      await announce(`<span class="who">${esc(ownerName(e.pid))}</span> ${e.auction ? '🔨 拍得' : (e.mortgageBuy ? '💰 买走抵押地' : '买下')}「${esc(BOARD[e.cell].name)}」 <span class="amt">¥${e.price}</span>`, 1750);
      break;
    }
    case 'build': {
      const grp = (BOARD[e.cell] && BOARD[e.cell].g) ? GROUPS[BOARD[e.cell].g] : '#e8b04b';
      if (e.hotel) {
        SFX.hotel(); SFX.fanfare(); SFX.coinRain(); SFX.crown(); confettiBurst(90); fxCoinRain(34);
        flashScreen('radial-gradient(circle at 50% 50%, rgba(255,228,140,.5), rgba(255,214,90,0) 62%)', 620);
        fxBurst(e.cell, { kind: 'star', n: 22, speed: 4.2, size: 5.4, life: 54, color: ['#ffd76a', '#fff1c2', '#e8b04b'], wave: { r: 92, color: '#e8b04b', life: 48 } });
        upgradePillar(e.cell, '#e8b04b');
        crownAt(e.cell, '#e8b04b');
      } else {
        SFX.build(); SFX.level(); SFX.chip(); SFX.upgrade();
        fxBurst(e.cell, { kind: 'star', n: 14, speed: 3.2, size: 4.2, life: 42, color: [grp, '#ffd76a', '#ffffff'], lift: 0.6, wave: { r: 62, color: grp } });
        upgradePillar(e.cell, grp);
      }
      buildAnim(e);
      await announce(`<span class="who">${esc(ownerName(e.pid))}</span> 在「${esc(BOARD[e.cell].name)}」${e.hotel ? '🏨 开出旅馆！' : '盖起一栋房 🏠'}`, e.hotel ? 2100 : 1600);
      break;
    }
    case 'charge': {
      SFX.pay(); SFX.coinFly();
      if (e.creditor != null) fxAt(e.cell, `<div class="floaty minus">-¥${e.amount}</div>`);
      shakePlayer(e.pid);
      // 付款方溅出红色"破财"碎屑；收款方溅出金色火花（一眼看清钱往哪走）
      fxBurst(playerCell(e.pid), { kind: 'spark', n: 10, speed: 2.4, size: 2.6, life: 30, color: ['#e2574c', '#ff9a8f'], dir: e.creditor != null ? Math.atan2(playerPt(e.creditor)[1] - playerPt(e.pid)[1], playerPt(e.creditor)[0] - playerPt(e.pid)[0]) : undefined });
      if (e.creditor != null) fxBurst(playerPt(e.creditor), { kind: 'coin', n: 7, speed: 2.6, size: 4.2, life: 40, color: ['#e8b04b', '#f5d071'], gravity: 0.24 });
      const to = (e.creditor != null) ? ownerName(e.creditor) : null;
      const place = BOARD[e.cell] ? `「${esc(BOARD[e.cell].name)}」` : '';
      const label = to ? `踩到 <span class="who">${esc(to)}</span> 的${place}` : (e.toPool ? '把钱缴入教育基金池' : '支付');
      // 金币飞行：付给其他玩家→飞向其棋子；进基金池→飞向基金池；付银行→飞向棋盘外
      flyCoin(playerCell(e.pid), to ? playerPt(e.creditor) : (e.toPool ? POOL_PT() : BANK_PT()), 5);
      await announce(`💸 <span class="who">${esc(ownerName(e.pid))}</span> ${label}<br>${esc(e.reason || '费用')} <span class="amt">¥${e.amount}</span>`, 2250);
      break;
    }
    case 'money': { SFX.gain(); SFX.pop(); fxAt(playerCell(e.pid), `<div class="floaty plus">+¥${e.amount}</div>`); flyCoin(POOL_PT(), cellCenter(playerCell(e.pid)), 3); fxBurst(playerCell(e.pid), { kind: 'coin', n: 6, speed: 2.2, size: 3.8, life: 34, color: ['#e8b04b', '#f5d071', '#8ee6b3'], gravity: 0.22 }); await sleep(560); break; }
    case 'mortgage': {
      SFX.mortgage(); SFX.stamp(); pulseCell(e.cell, '#888');
      fxAt(e.cell, '<div class="floaty lockfloat">🔒</div>');
      fxBurst(e.cell, { kind: 'spark', n: 10, speed: 2.2, size: 2.8, life: 30, color: ['#9a938a', '#c7c1b6'], wave: { r: 44, color: '#888' } });
      await announce(`🔒 ${esc(ownerName(e.pid))} 抵押「${esc(BOARD[e.cell].name)}」${e.unlockRound ? `<br><span style="font-size:13px;opacity:.85">抵押锁定期：第 ${e.unlockRound} 轮起才能赎回</span>` : ''}`, 1650);
      break;
    }
    case 'redeem': { SFX.redeem(); SFX.bell(); pulseCell(e.cell, '#e8b04b'); fxBurst(e.cell, { kind: 'star', n: 12, speed: 2.6, size: 3.6, life: 36, color: ['#f5d071', '#fff3c4'], wave: { r: 52, color: '#e8b04b' } }); await announce(`🔓 ${esc(ownerName(e.pid))} 赎回「${esc(BOARD[e.cell].name)}」`, 1350); break; }
    case 'gojail': { SFX.jail(); SFX.sweepDown(); fxBurst(playerCell(e.pid), { kind: 'shard', n: 12, speed: 3, size: 3.6, life: 44, color: ['#8d8d8d', '#b23b3b', '#6d6d6d'], gravity: 0.3 }); await announce(`📉 <span class="who">${esc(ownerName(e.pid))}</span> 挂科留级，休整一回合！`, 1550); break; }
    case 'stay': { SFX.stay(); await announce(`💤 ${esc(ownerName(e.pid))} 停留一回合${e.left > 0 ? `（还要停留 ${e.left} 回合）` : ''}`, 1250); break; }
    case 'jackpot': { SFX.jackpot(); SFX.fanfare(); SFX.coinRain(); confettiBurst(); fxCoinRain(30); flashScreen('radial-gradient(circle at 50% 46%, rgba(255,232,160,.45), rgba(255,214,90,0) 64%)', 600); flyCoin(POOL_PT(), cellCenter(playerCell(e.pid)), 8); await announce(`🎓 <span class="who">${esc(ownerName(e.pid))}</span> 领取教育基金 <span class="amt">¥${e.amount}</span>！`, 1950); break; }
    case 'endgame': { SFX.seasonDown(); flashScreen('linear-gradient(180deg, rgba(150,200,255,.4), rgba(120,160,220,0))', 900); await announce(`❄️ <b>经济寒冬来临！</b><br>第 ${e.round} 轮起银行停发工资`, 2300); break; }
    case 'bankrupt': {
      // v5.3：破产不再晃屏（用户反馈整屏晃太晕）—— 改成心跳低鸣 + 全屏灰化慢镜 + 红色冲击
      SFX.bankrupt(); SFX.buzzer(); SFX.pulse();
      flashScreen('radial-gradient(circle at 50% 50%, rgba(200,40,40,.42), rgba(120,0,0,0) 62%)', 760);
      greyMoment();
      fxBurst(playerCell(e.pid), { kind: 'shard', n: 26, speed: 4.6, size: 5, life: 64, color: ['#8a1c1c', '#c0392b', '#5b5b5b', '#3f3f3f'], gravity: 0.34 });
      await announce(`💀 <span class="who">${esc(ownerName(e.pid))}</span> 破产出局！`, 1850);
      break;
    }
    case 'quit': { await announce(`🤖 <span class="who">${esc(ownerName(e.pid))}</span> 退出对局，AI 已接管`, 1600); break; }
    case 'trustee': { trusteeToast(e); await announce(e.on ? `🤖 <span class="who">${esc(ownerName(e.pid))}</span> 开启了 AI 托管，回合由 AI 代打` : `🙋 <span class="who">${esc(ownerName(e.pid))}</span> 取回了操作权`, 1600); break; }
    // 市场状态只在这里（真正轮到播这条事件时）才写进地图显示，保证"一轮全部走完才更新"
    case 'season': { dispCal = null; dispSeason = e.season; SFX.whoosh(); await seasonAnim(e); break; }
    case 'weather': {
      dispWeather = e.w;
      const WX = WEATHER[e.w] || {};
      const snd = { sun: SFX.sunshine, cloud: SFX.whoosh, rain: SFX.wind, fog: SFX.fog, snow: SFX.snow, heat: SFX.heat, wind: SFX.wind }[e.w];
      if (snd) snd();
      if (e.w === 'storm') { SFX.wind(); SFX.thunder(); }
      applyWeather(e.w);
      const tint = { sun: 'rgba(255,206,86,.30)', cloud: 'rgba(150,150,160,.20)', rain: 'rgba(120,165,220,.30)', storm: 'rgba(70,66,120,.45)', fog: 'rgba(210,216,218,.34)', snow: 'rgba(200,225,250,.36)', heat: 'rgba(255,150,70,.30)', wind: 'rgba(160,205,190,.24)' }[e.w] || 'rgba(255,255,255,.16)';
      flashScreen(`linear-gradient(180deg, ${tint}, rgba(255,255,255,0) 72%)`, 620);
      await weatherBanner(e.w);
      break;
    }
    case 'calevent': {
      dispCal = { icon: e.icon, name: e.name, desc: e.desc };
      const bad = ['payAll', 'richTax', 'slow', 'rainy', 'buildBoom'].includes(e.kind);
      const good = ['moneyAll', 'poorBonus', 'bailout', 'lottery', 'fundShare', 'stealPoor', 'cardsLottery', 'poorMore', 'study'].includes(e.kind);
      // v5.1：为不同校历事件配不同的入场特效（不再全部共用一套礼花）
      const FXMAP = {
        fireworks: () => { SFX.fireworks(); confettiBurst(96); fxCoinRain(26); flashScreen('radial-gradient(circle at 50% 40%, rgba(255,220,140,.42), rgba(255,180,90,0) 68%)', 840); },
        redpacket: () => { SFX.redpacket(); confettiBurst(72); fxCoinRain(32); flashScreen('radial-gradient(circle at 50% 46%, rgba(255,96,96,.34), rgba(200,30,30,0) 70%)', 740); },
        pumpkin:   () => { SFX.pumpkin(); flashScreen('radial-gradient(circle at 50% 50%, rgba(200,120,20,.34), rgba(120,60,0,0) 68%)', 720); },
        stage:     () => { SFX.stage(); confettiBurst(62); flashScreen('radial-gradient(circle at 50% 40%, rgba(220,120,220,.36), rgba(160,60,200,0) 70%)', 780); },
        offer:     () => { SFX.offer(); confettiBurst(52); },
        bank:      () => { SFX.bank(); SFX.coinRain(); fxCoinRain(34); flashScreen('radial-gradient(circle at 50% 50%, rgba(120,200,255,.34), rgba(60,120,200,0) 70%)', 780); },
        aid:       () => { SFX.aid(); flashScreen('radial-gradient(circle at 50% 50%, rgba(120,220,160,.32), rgba(40,150,90,0) 70%)', 720); },
        rocket:    () => { SFX.rocket(); flashScreen('linear-gradient(0deg, rgba(255,180,90,.28), rgba(120,90,255,0) 72%)', 820); },
        balloon:   () => { SFX.balloon(); confettiBurst(44); },
        bull:      () => { SFX.bull(); fxCoinRain(30); flashScreen('radial-gradient(circle at 50% 46%, rgba(255,96,96,.3), rgba(160,20,20,0) 68%)', 720); },
        sale:      () => { SFX.sale(); },
        storm:     () => { SFX.storm(); SFX.thunder(); flashScreen('linear-gradient(180deg, rgba(70,66,120,.42), rgba(40,40,80,0) 72%)', 840); },
        carnival:  () => { SFX.carnival(); confettiBurst(84); flashScreen('radial-gradient(circle at 50% 42%, rgba(255,200,80,.36), rgba(255,120,40,0) 70%)', 780); },
        gallery:   () => { SFX.gallery(); confettiBurst(48); },
        book:      () => { SFX.book(); },
      };
      const fn = e.fx && FXMAP[e.fx];
      if (fn) fn();
      if (bad) SFX.buzzer();
      else if (!fn) { if (good) { SFX.calevent(); confettiBurst(46); } else SFX.seasonMid(); }
      await announce(`${e.icon} 校历事件【${esc(e.name)}】<br>${esc(e.desc)}`, 2100);
      break;
    }
    // v5.1：校历事件「一人独得 / 一人特殊」的揭晓演出（歌手赛冠军、嘉年华大奖、作品展最高价…）
    case 'caleventHit': {
      SFX.jackpot(); SFX.fanfare(); SFX.coinRain();
      confettiBurst(96); fxCoinRain(36);
      flashScreen('radial-gradient(circle at 50% 46%, rgba(255,232,160,.46), rgba(255,190,60,0) 68%)', 800);
      if (e.winner != null) {
        pulseCell(playerCell(e.winner), '#e8b04b');
        setTimeout(() => fxBurst(playerCell(e.winner), { kind: 'star', n: 22, speed: 3.8, size: 5, life: 52, color: ['#ffd76a', '#fff1c2', '#ffffff'], wave: { r: 84, color: '#e8b04b' } }), 120);
      }
      const others = (e.items || []).filter(it => it.pid !== e.winner);
      for (const it of others) if (it.amount > 0) fxAt(playerCell(it.pid), `<div class="floaty plus">+¥${it.amount}</div>`);
      const list = others.length ? `<br>${others.map(it => `<span class="who">${esc(ownerName(it.pid))}</span> +¥${it.amount}`).join(' · ')}` : '';
      await announce(`${e.icon || '🎊'} <b>${esc(e.name)}</b><br>🏆 <span class="who">${e.winner != null ? esc(ownerName(e.winner)) : '—'}</span> 独得 <span class="amt">¥${e.amount}</span>${list}`, 2350);
      break;
    }
    case 'tax': {
      SFX.tax(); SFX.gavel();
      const its = e.items || [];
      its.forEach(it => pulseCell(playerCell(it.pid), '#8a6d1a'));
      if (its.length) flyCoin(playerCell(its[0].pid), POOL_PT(), 4);
      const who = its.map(it => `<span class="who">${esc(ownerName(it.pid))}</span> ¥${it.amount}`).join(' · ');
      await announce(`🏛️ 物业税（大户）：${who}<br>共 <span class="amt">¥${e.total}</span> 入教育基金池`, 1900);
      break;
    }
    // 校历全员结算：合并成一条播报，避免连播多条横幅
    case 'calwave': {
      if (e.gain) SFX.gain(); else SFX.pay();
      for (const it of (e.items || [])) {
        if (e.gain) fxAt(playerCell(it.pid), `<div class="floaty plus">+¥${it.amount}</div>`);
        else shakePlayer(it.pid);
      }
      const list = (e.items || []).map(it => `<span class="who">${esc(ownerName(it.pid))}</span> ${e.gain ? '+' : '−'}¥${it.amount}`).join(' · ');
      await announce(`${e.icon || '📅'} ${esc(e.name)}<br>${list}`, 1900);
      break;
    }
    case 'ach': { SFX.ach(); SFX.fanfare(); confettiBurst(70); fxBurst(playerCell(e.pid), { kind: 'star', n: 20, speed: 3.8, size: 5, life: 52, color: ['#ffd76a', '#fff1c2', '#7a1522'], wave: { r: 84, color: '#e8b04b' } }); await achBanner(e); break; }
    case 'mono': {
      // 集齐同色 3 所 → 金色礼花 + 三格同时脉冲 + 全屏金光 + 号角 + v5.3 皇冠落顶
      SFX.fanfare(); SFX.coinRain(); SFX.ach(); SFX.crown();
      const gcol = GROUPS[e.g] || '#e8b04b';
      confettiBurst(110); fxCoinRain(38);
      flashScreen(`radial-gradient(circle at 50% 50%, ${gcol}88, ${gcol}00 66%)`, 780);
      pulseGroup(e.cells, '#e8b04b');
      (e.cells || []).forEach((c, k) => setTimeout(() => { fxBurst(c, { kind: 'star', n: 16, speed: 3.6, size: 4.6, life: 48, color: ['#ffd76a', gcol, '#ffffff'], lift: 0.8, wave: { r: 70, color: '#e8b04b' } }); upgradePillar(c, gcol); }, k * 150));
      if (e.cells && e.cells.length) crownAt(e.cells[Math.floor(e.cells.length / 2)], gcol);
      await announce(`🏆 <b>垄断达成！</b><br><span class="who">${esc(ownerName(e.pid))}</span> 集齐 ${esc((e.g || '').toUpperCase())} 色组：${(e.names || []).map(n => esc(n)).join(' · ')}<br>裸地租金 <span class="amt">×3</span>`, 2500);
      break;
    }
    // ---------- v5.2：校园风貌 ----------
    case 'faculty_offer': { facOpenVote(e); break; }        // 15 秒投票期：浮层自带倒计时，不占用动画队列
    case 'faculty_vote': { facMarkVote(e); break; }
    case 'faculty_chosen': { await facultyCeremony(e); break; }
    case 'faculty_round': { await facultyRoundBanner(e); break; }
    case 'faculty_wave': {
      SFX.gain(); SFX.coin();
      for (const it of (e.items || [])) { fxAt(playerCell(it.pid), `<div class="floaty plus">+¥${it.amount}</div>`); flyCoin(POOL_PT(), cellCenter(playerCell(it.pid)), 2); }
      const list = (e.items || []).map(it => `<span class="who">${esc(ownerName(it.pid))}</span> +¥${it.amount}`).join(' · ');
      await announce(`${e.icon || '🏫'} <b>${esc(e.name)}</b>（校园风貌）<br>${list}`, 1950);
      break;
    }
    case 'stay_free_gain': {
      SFX.stayFree(); SFX.sparkle();
      fxBurst(playerCell(e.pid), { kind: 'star', n: 14, speed: 3, size: 4, life: 42, color: ['#2BB88C', '#8ee6b3', '#fff1c2'], lift: 0.7, wave: { r: 58, color: '#2BB88C' } });
      await announce(`🎯 <span class="who">${esc(ownerName(e.pid))}</span> 领到一张「免停留卡」（现有 ${e.count} 张）`, 1450);
      break;
    }
    case 'stay_free': {
      SFX.stayFree(); SFX.bell();
      fxAt(playerCell(e.pid), '<div class="floaty stayfree">🎯 免停留</div>');
      fxBurst(playerCell(e.pid), { kind: 'star', n: 13, speed: 2.8, size: 3.8, life: 40, color: ['#8ee6b3', '#ffffff', '#e8b04b'], lift: 0.6, wave: { r: 54, color: '#2BB88C' } });
      await announce(`🎯 <span class="who">${esc(ownerName(e.pid))}</span> 用掉一张「免停留卡」<br>免去「${esc(e.why || '停留')}」（还剩 ${e.left || 0} 张）`, 1700);
      break;
    }
    case 'free_rent': {
      SFX.facBadge(); SFX.sparkle();
      pulseCell(e.cell, '#3FBF9E');
      fxBurst(e.cell, { kind: 'petal', n: 16, speed: 2.6, size: 4.4, life: 48, color: ['#8ee6b3', '#d8fff0', '#3FBF9E'], lift: 0.9, wave: { r: 62, color: '#3FBF9E' } });
      await announce(`🕊️ <b>免租轮</b>：<span class="who">${esc(ownerName(e.pid))}</span> 踩到 <span class="who">${esc(ownerName(e.owner))}</span> 的「${esc(BOARD[e.cell] ? BOARD[e.cell].name : '')}」<br>本轮全场免租，<span class="amt">一分不用付</span>`, 1950);
      break;
    }
    case 'facfx': {
      SFX.facBadge();
      const fcol = (FACULTY[(S && S.faculty)] || {}).color || '#e8b04b';
      pulseCell(playerCell(e.pid), fcol);
      fxAt(playerCell(e.pid), `<div class="floaty facfloat">${esc(e.name || '校园风貌')}</div>`);
      fxBurst(playerCell(e.pid), { kind: 'spark', n: 10, speed: 2.4, size: 2.8, life: 32, color: [fcol, '#ffffff'], wave: { r: 46, color: fcol } });
      await announce(`${(FACULTY[(S && S.faculty)] || {}).icon || '🏫'} <b>${esc(e.name || '校园风貌')}</b><br>${esc(e.detail || '')}`, 1550);
      break;
    }
    case 'skill': { await skillFx(e); break; }
    case 'combo': { SFX.combo(e.n); comboPop(e.pid, e.n); break; }
    case 'chat': {
      // v5.1：他人的聊天/表情排队顺播 —— 播到这一条才出现气泡与日志，不会提前剧透
      if (e.pid === myPid) break;
      chatFx(e);
      visLog.push(`💬 ${e.name}：${e.text}`);
      renderLog();
      await sleep(420);
      break;
    }
    case 'duel': { await duelAnim(e); break; }
    case 'demolish': {
      SFX.demolish(); SFX.sweepDown(); SFX.gavel();
      const nm = e.name || (BOARD[e.cell] ? BOARD[e.cell].name : '');
      if (e.self) shakePlayer(e.pid);
      // 拆房：木屑 + 砖块碎块（带重力翻滚）+ 尘土环 + 轻微震屏
      fxBurst(e.cell, { kind: 'shard', n: e.kind === 'land' ? 30 : 22, speed: e.kind === 'land' ? 4.6 : 3.8, size: 4.6, life: 62, color: ['#a9764a', '#8d6e63', '#c8a97e', '#6d5a4a'], gravity: 0.34, wave: { r: 70, color: '#b07a52' } });
      fxBurst(e.cell, { kind: 'petal', n: 12, speed: 2.4, size: 4, life: 46, color: ['#cbbda6', '#ded4c2'], gravity: 0.09 });
      flashScreen('radial-gradient(circle at 50% 50%, rgba(180,120,70,.3), rgba(150,100,60,0) 60%)', 520);
      if (e.kind === 'land') { pulseCell(e.cell, '#b23b3b'); dustAt(e.cell); confettiBurst(26); collapseAt(e.cell, true); }
      else { pulseCell(e.cell, '#c0392b'); dustAt(e.cell); collapseAt(e.cell, false); }
      await announce(`${e.kind === 'land' ? '🏗️🏚️' : '🚧'} ${e.self ? '' : '<span class="who">' + esc(ownerName(e.pid)) + '</span> 的'}「${esc(nm)}」被<b>拆除${e.kind === 'land' ? '地皮' : '一栋房'}</b>${e.kind === 'house' ? ` <span class="amt">→Lv${e.level}</span>` : ''}`, 2150);
      break;
    }
    case 'cardBuild': {
      if (e.hotel) { SFX.hotel(); SFX.fanfare(); confettiBurst(80); fxCoinRain(22); } else { SFX.gift(); SFX.thud(); }
      fxBurst(e.cell, { kind: 'star', n: e.hotel ? 20 : 13, speed: 3.4, size: e.hotel ? 5 : 4, life: 46, color: ['#ffd76a', '#8ee6b3', '#ffffff'], lift: 0.7, wave: { r: e.hotel ? 82 : 58, color: '#8ee6b3' } });
      buildAnim({ pid: e.pid, cell: e.cell, hotel: false });
      await announce(`${e.help ? '🤝' : '🎁'} <span class="who">${esc(ownerName(e.pid))}</span> 白得施工队，「${esc(BOARD[e.cell].name)}」升到 Lv${e.level}${e.hotel ? ' —— 旅馆落成！🏨' : ' 🏠'}`, e.hotel ? 2000 : 1550);
      break;
    }
    case 'item': { SFX.item(); SFX.sparkle(); await announce(`🎒 <span class="who">${esc(ownerName(e.pid))}</span> 使用道具「${esc(e.name)}」${e.detail ? `（${esc(e.detail)}）` : ''}`, 1400); break; }
    case 'shield': { SFX.item(); await announce(e.lost ? `🛡️ <span class="who">${esc(ownerName(e.pid))}</span> 的免罚符失效了` : `🛡️ <span class="who">${esc(ownerName(e.pid))}</span> 的免罚符生效，免租！`, 1400); break; }
    case 'medal': { SFX.item(); await announce(e.lost ? `🎫 <span class="who">${esc(ownerName(e.pid))}</span> 的免租金卡被回收` : `🎫 <span class="who">${esc(ownerName(e.pid))}</span> 的免租金卡生效，免租！`, 1400); break; }
    case 'voucher': { SFX.item(); await announce(e.lost ? `🎟️ <span class="who">${esc(ownerName(e.pid))}</span> 的免租券被回收` : `🎫 <span class="who">${esc(ownerName(e.pid))}</span> 的免租券生效，免租！`, 1400); break; }
    case 'major_switch': {
      const mj = MAJORS[e.to] || {};
      SFX.card(); SFX.sparkle();
      fxBurst(playerCell(e.pid), { kind: 'star', n: 18, speed: 3.4, size: 4.2, life: 46, color: e.good ? ['#8ee6b3', '#ffffff', '#ffd76a'] : ['#b0a0d0', '#dcd2f0', '#8a7f9a'], wave: { r: 68, color: e.good ? '#37a86a' : '#8a6fd1' } });
      flashScreen(e.good ? 'radial-gradient(circle at 50% 45%, rgba(110,220,160,.34), rgba(110,220,160,0) 70%)' : 'radial-gradient(circle at 50% 45%, rgba(150,120,200,.34), rgba(150,120,200,0) 70%)', 620);
      await announce(`${e.good ? '🎉' : '🌀'} <span class="who">${esc(ownerName(e.pid))}</span> ${e.good ? '转专业成功' : '被强制转专业'}：${(MAJORS[e.from] || {}).name || '?'} → <b>${mj.icon || ''}${esc(mj.name || '')}</b>`, 1900);
      break;
    }
    case 'medalBuy': { SFX.item(); await announce(e.price > 0 ? `🏅 <span class="who">${esc(ownerName(e.pid))}</span> 购入免租金牌（¥${e.price}）` : `🎫 <span class="who">${esc(ownerName(e.pid))}</span> 在校园商城免费领到一张「免租金卡」`, 1300); break; }
    case 'gift': { SFX.item(); await announce(`🎁 <span class="who">${esc(ownerName(e.pid))}</span> 在神秘商店获得「${e.item === 'shield' ? '免罚符 🛡️' : '免租券 🎫'}」`, 1400); break; }
    case 'medalGain': { SFX.bell(); SFX.coin(); SFX.sparkle(); confettiBurst(46); fxBurst(playerCell(e.pid), { kind: 'star', n: 16, speed: 3.2, size: 4.4, life: 46, color: ['#ffd76a', '#fff1c2', '#8ee6b3'], lift: 0.7, wave: { r: 66, color: '#e8b04b' } }); await announce(`🎫 <span class="who">${esc(ownerName(e.pid))}</span> 领取 ${e.count} 张「免租金卡」（可保留）`, 1500); break; }
    case 'buff': { const sd = e.steps >= 0 ? `+${e.steps}` : `${e.steps}`; await announce(`👟 <span class="who">${esc(ownerName(e.pid))}</span> 的移动加成生效：${sd} 步${e.left ? `（还剩 ${e.left} 次）` : ''}`, 1400); break; }
    case 'invest': { SFX.item(); await announce(`🔬 <span class="who">${esc(ownerName(e.pid))}</span> 投入科研经费 ¥${e.cost}，到期返还 ¥${e.back}`, 1500); break; }
    case 'rollpay': { await rollPayAnim(e); break; }
    case 'draw': { await drawCardsAnim(e); break; }
    case 'turn': {
      // v5.3：轮到谁，谁的棋子脚下亮一圈本人主题色光环；轮到自己时再补一声轻钟
      SFX.turn();
      if (e.pid === myPid) SFX.roundBell();
      const tp = S.players.find(p => p.id === e.pid);
      pulseCell(playerCell(e.pid), (tp && tp.color) || '#e8b04b');
      render(); await sleep(520); break;
    }
    case 'land': await sleep(320); break;
    default: await sleep(90);   // 纯信息型事件（paid/log 等）不占用节拍
  }
}
// v5.1：岔路格子「抽取过程」全场演出 —— 选项转盘快速轮换 → 减速 → 定格结果
function rollPayAnim(e) {
  return new Promise(res => {
    const list = e.options || [];
    const d = document.createElement('div');
    d.className = 'rollpay';
    d.innerHTML = `<div class="rp-title">🎲 ${esc(e.title || '随机结果')}</div>
      <div class="rp-opts">${list.map(s => `<div class="rp-opt">${esc(s)}</div>`).join('')}</div>
      <div class="rp-who">${esc(ownerName(e.pid))}</div>`;
    $('fxLayer').appendChild(d);
    const nodes = [...d.querySelectorAll('.rp-opt')];
    requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show')));
    let i = 0, ticks = 0;
    const total = 13 + Math.max(0, e.idx || 0) * 2;
    const finish = () => {
      nodes.forEach(n => n.classList.remove('on'));
      const win = nodes[e.idx] || nodes[0];
      if (win) win.classList.add('on', e.tone === 'bad' ? 'bad' : 'good');
      if (e.tone === 'bad') {
        SFX.buzzer();
        flashScreen('radial-gradient(circle at 50% 42%, rgba(226,87,76,.36), rgba(226,87,76,0) 70%)', 560);
      } else {
        SFX.sweepUp(); SFX.sparkle();
        flashScreen('radial-gradient(circle at 50% 42%, rgba(110,220,160,.34), rgba(110,220,160,0) 70%)', 560);
      }
      st(() => d.classList.remove('show'), 1150);
      setTimeout(() => { d.remove(); res(); }, sp(1150) + 420);
    };
    const step = () => {
      nodes.forEach(n => n.classList.remove('on'));
      if (nodes[i]) { nodes[i].classList.add('on'); if (nodes.length > 1) SFX.tick(); }
      i = (i + 1) % Math.max(1, nodes.length);
      ticks++;
      if (ticks < total) setTimeout(step, sp(ticks > total - 7 ? 88 + (ticks - (total - 7)) * 40 : 60));
      else finish();
    };
    setTimeout(step, sp(110));
  });
}
// v5.1：效果卡抽取演出 —— 卡片依次翻入
function drawCardsAnim(e) {
  return new Promise(res => {
    SFX.gift(); SFX.card();
    const n = e.n || 1;
    const wrap = document.createElement('div');
    wrap.className = 'drawcards';
    wrap.innerHTML = `<div class="dc-title">🎁 ${esc(ownerName(e.pid))} 在${esc(e.label || '校园商城')}抽到 ${n} 张效果卡</div>
      <div class="dc-row">${(e.cards || []).map((c, i) => `<div class="dc" style="animation-delay:${(i * 0.22).toFixed(2)}s"><div class="dc-ico">${c.icon || '🎁'}</div><div class="dc-name">${esc(c.name)}</div><div class="dc-desc">${esc(c.desc || '')}</div></div>`).join('')}</div>`;
    $('fxLayer').appendChild(wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('show')));
    for (let i = 0; i < n; i++) setTimeout(() => SFX.sparkle(), sp(220 + i * 280));
    const hold = 1150 + n * 320;
    fxBurst(playerCell(e.pid), { kind: 'star', n: 14, speed: 3.0, size: 4.0, life: 42, color: ['#ffd76a', '#fff1c2', '#8ee6b3'], lift: 0.6 });
    st(() => wrap.classList.remove('show'), hold);
    setTimeout(() => { wrap.remove(); res(); }, sp(hold) + 420);
  });
}
const ownerName = pid => (S.players.find(p => p.id === pid) || {}).name || '?';
const playerCell = pid => (S.players.find(p => p.id === pid) || {}).pos ?? 0;

// ---------- 新机制特效 ----------
function shade(hex, amt) {
  try {
    const n = parseInt(hex.slice(1), 16);
    const cl = v => Math.max(0, Math.min(255, v));
    return '#' + ((cl((n >> 16) + amt) << 16) | (cl(((n >> 8) & 255) + amt) << 8) | cl((n & 255) + amt)).toString(16).padStart(6, '0');
  } catch (e) { return hex; }
}
// 季节切换：市场大卡翻入 + 对应音效
async function seasonAnim(e) {
  const SZ = SEASON[e.season] || {};
  if (e.season === 'high') SFX.seasonUp(); else if (e.season === 'low') SFX.seasonDown(); else SFX.seasonMid();
  const d = document.createElement('div');
  d.className = 'season-card';
  d.style.background = `linear-gradient(160deg, ${SZ.color || '#888'}, ${shade(SZ.color || '#888780', -46)})`;
  d.innerHTML = `${SZ.icon} 市场进入「${SZ.name}」<div class="sc-sub">收租 ×${SZ.rentMul} · 买地盖房 ×${SZ.buildMul}</div>`;
  $('fxLayer').appendChild(d);
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show')));
  await sleep(1750);
  d.classList.remove('show');
  setTimeout(() => d.remove(), 420);
  await sleep(300);
}
// v5.1：天气专属横幅 —— 每种天气一套配色 + 大图标 + 效果说明，切入动画与色调闪光配套
const WX_TINT = {
  sun:   { a: '#FFD86B', b: '#E8A93A' }, cloud: { a: '#B9BEC6', b: '#8A9099' },
  rain:  { a: '#8FB6E0', b: '#4C7DBE' }, storm: { a: '#7A78A8', b: '#3A3766' },
  fog:   { a: '#CFD5D8', b: '#9AA3A8' }, snow:  { a: '#CFE4FA', b: '#8FB6E0' },
  heat:  { a: '#FFB26B', b: '#E8813A' }, wind:  { a: '#A9D8C8', b: '#5FA890' },
};
function weatherBanner(w) {
  return new Promise(res => {
    const W = WEATHER[w] || {}, c = WX_TINT[w] || { a: '#C7C7C7', b: '#8A9099' };
    const d = document.createElement('div');
    d.className = 'weather-card';
    d.style.background = `linear-gradient(155deg, ${c.a}, ${c.b})`;
    d.innerHTML = `<div class="wc-ico">${W.icon || '🌤️'}</div><div class="wc-name">${esc(W.name || '')}</div><div class="wc-sub">${esc(W.desc || '无特殊影响')}</div>`;
    $('fxLayer').appendChild(d);
    requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show')));
    st(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 420); res(); }, 1700);
  });
}
function achBanner(e) {
  return new Promise(res => {
    const d = document.createElement('div');
    d.className = 'ach-banner';
    d.innerHTML = `🏅 成就达成 · ${esc(e.name)}<div class="ach-sub">${esc(ownerName(e.pid))} — ${esc(e.desc)}</div><div class="ach-amt">+¥${e.reward}</div>`;
    $('fxLayer').appendChild(d);
    requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show')));
    st(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 400); res(); }, 2350);
  });
}
// ============================================================================
// v5.2：校园风貌 —— ① 开局投票浮层 ② 四幕抽取演出 ③ 地图中央常驻徽章
// 与服务端事件一一对应：faculty_offer / faculty_vote / faculty_chosen / faculty_round
// ============================================================================
let facVoteEl = null, facVoteClock = null, facMyVote = null, facVoteSig = '';
let facBadgeKey = null;      // 中央徽章当前渲染的风貌 key（避免重复重建导致动画闪断）
let facCeremonyBusy = false; // 抽取演出播放中：禁止 onState 把浮层收掉

function facCloseUI() {
  clearInterval(facVoteClock);
  if (facVoteEl) { facVoteEl.remove(); facVoteEl = null; }
  facVoteSig = ''; facMyVote = null;
}

// 单个候选卡（含主效果 / 代价 / 标语 / 投票人槽位）
function facCardHtml(k, i) {
  const f = FACULTY[k] || {};
  return `<div class="fv-card" data-key="${k}" style="--fc:${f.color || '#9A968C'};animation-delay:${(0.5 + i * 0.42).toFixed(2)}s">
      <div class="fv-ico">${f.icon || '🏫'}</div>
      <div class="fv-name">${esc(f.name || k)}</div>
      <div class="fv-line"><span class="fv-tag">主效果</span>${esc(f.lead || '')}</div>
      <div class="fv-line cost"><span class="fv-tag bad">代价</span>${esc(f.cost || '')}</div>
      <div class="fv-tagline">「${esc(f.tag || '')}」</div>
      <div class="fv-voters"></div>
      <div class="fv-picked">✔ 你投了它</div>
    </div>`;
}

// 第一幕 + 第二幕：牌匾升起 → 三张候选卡 3D 翻入 → 开始 15 秒投票倒计时
function facOpenVote(e) {
  const opts = (e && e.options) || [];
  const sig = opts.join(',');
  if (facVoteEl && facVoteSig === sig) return;   // 同一批候选已在展示，不重复弹
  if (facVoteEl) { facVoteEl.remove(); facVoteEl = null; }
  clearInterval(facVoteClock);
  facVoteSig = sig;
  const ms = (e && e.ms) || FACULTY_VOTE_MS;
  const d = document.createElement('div');
  d.className = 'fac-layer';
  d.innerHTML = `<div class="fv-panel">
      <div class="fv-glow"></div><div class="fv-beam"></div><i class="fv-mote m1"></i><i class="fv-mote m2"></i><i class="fv-mote m3"></i><i class="fv-mote m4"></i><i class="fv-mote m5"></i><i class="fv-mote m6"></i>
      <div class="fv-plaque"><div class="fv-plaque-in">
        <div class="fv-kicker">本 局 · 校 园 风 貌 推 选</div>
        <div class="fv-big">🏫 校园风貌</div>
        <div class="fv-hint">三 位 候 选 · 全 场 各 投 一 票 · <b>随 机 抽 一 位 玩 家</b>，他投的那一个即本局风貌<br>全场共享 · 贯穿整局 15 轮</div>
      </div></div>
      <div class="fv-row">${opts.map(facCardHtml).join('')}</div>
      <div class="fv-timer"><i class="fv-bar"><b id="fvBarFill"></b></i><span>剩余 <em id="fvClock">${Math.max(1, Math.round(ms / 1000))}</em> 秒 · 点击卡片投票</span></div>
    </div>`;
  $('fxLayer').appendChild(d);
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show')));
  facVoteEl = d;
  facMyVote = null;
  SFX.facRise();
  setTimeout(() => { try { SFX.glint(); SFX.sparkle(); } catch (e) {} }, sp(360));   // v5.5：牌匾定场后的星光点缀
  opts.forEach((k, i) => setTimeout(() => { if (facVoteEl) SFX.facFlip(i); }, sp(520 + i * 400)));
  // 倒计时（真实时间，不随播放倍速缩放）
  let left = Math.max(1, Math.round(ms / 1000));
  const total = left;
  const fill = d.querySelector('#fvBarFill'), clock = d.querySelector('#fvClock');
  if (fill) fill.style.width = '100%';
  facVoteClock = setInterval(() => {
    left--;
    const pct = Math.max(0, Math.min(100, (left / total) * 100));
    if (clock) clock.textContent = String(Math.max(0, left));
    if (fill) {
      fill.style.width = pct.toFixed(1) + '%';
      // v5.5：倒计时分三段变色 —— 金 → 橙 → 红，最后 5 秒进入"紧迫"心跳模式
      fill.classList.toggle('warn', pct <= 55 && pct > 26);
      fill.classList.toggle('danger', pct <= 26);
      const timerEl = fill.closest('.fv-timer');
      if (timerEl) timerEl.classList.toggle('urgent', left > 0 && left <= 5);
    }
    if (left > 0 && left <= 5) SFX.tick();
    if (left <= 0) clearInterval(facVoteClock);
  }, 1000);
  // 点击投票
  d.querySelectorAll('.fv-card').forEach(card => {
    // v5.5：悬停轻响 + 微光提示，让"选卡"这件事更有手感
    card.addEventListener('mouseenter', () => { if (!facMyVote && !d.classList.contains('lottery')) SFX.click(); });
    card.onclick = () => {
      if (facMyVote) { SFX.click(); return; }
      facMyVote = card.dataset.key;
      card.classList.add('picked');
      SFX.facVote();
      fxBurst(cellCenter(0), { kind: 'spark', n: 8, speed: 2, size: 2.6, life: 26, color: [(FACULTY[facMyVote] || {}).color || '#e8b04b', '#ffffff'] });
      send({ action: { type: 'voteFaculty', key: facMyVote } });
    };
  });
  // 断线重连：把已有票补画上去
  if (S && S.facultyVotes) for (const pid in S.facultyVotes) facMarkVote({ pid, key: S.facultyVotes[pid] }, true);
}

// 有人投票：在他投的那张卡上贴一枚名牌
function facMarkVote(e, silent) {
  const d = facVoteEl;
  if (!d) return;
  if (e.pid === myPid) { facMyVote = e.key; }
  const card = d.querySelector(`.fv-card[data-key="${e.key}"]`);
  if (!card) return;
  const box = card.querySelector('.fv-voters');
  if (box && !box.querySelector(`[data-pid="${e.pid}"]`)) {
    const chip = document.createElement('i');
    chip.className = 'fv-chip' + (e.pid === myPid ? ' me' : '');
    chip.dataset.pid = e.pid;
    chip.textContent = e.pid === myPid ? '我' : ownerName(e.pid);
    box.appendChild(chip);
  }
  card.classList.add('hasvote');
  if (e.pid === myPid) card.classList.add('picked');
  if (!silent && e.pid !== myPid) SFX.facFlip(1);
}

// 第三幕 + 第四幕：抽签滚筒 → 抽中玩家 → 加冕 → 徽章落到地图中央
function facultyCeremony(e) {
  return new Promise(async res => {
    facCeremonyBusy = true;
    clearInterval(facVoteClock);
    const f = FACULTY[e.key] || {};
    const col = f.color || '#9A968C';
    if (!facVoteEl) facOpenVote({ options: [e.key], ms: 1 });
    const d = facVoteEl;
    const luckyName = e.lucky != null ? ownerName(e.lucky) : '？';
    d.classList.add('lottery');
    d.querySelectorAll('.fv-card').forEach(c => c.classList.add('frozen'));
    const luckyCard = d.querySelector(`.fv-card[data-key="${e.key}"]`);
    // 第三幕：抽签滚筒（把「谁来定」这件事慢放给所有人看）
    const box = document.createElement('div');
    box.className = 'fv-draw';
    box.innerHTML = `<div class="fv-draw-t">🎲 随 机 抽 签</div>
      <div class="fv-draw-roll" id="fvRoll">—</div>
      <div class="fv-draw-s">抽中谁的选票，就用谁的选择</div>`;
    const panel = d.querySelector('.fv-panel');
    if (panel) panel.appendChild(box);
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('show')));
    SFX.whooshLow(); SFX.drumroll();
    const roll = box.querySelector('#fvRoll');
    const names = ((S && S.players) || []).filter(p => p.alive).map(p => p.name);
    if (!names.length) names.push(luckyName);
    const total = 17;
    for (let i = 0; i < total; i++) {
      if (roll) roll.textContent = names[i % names.length];
      SFX.facRoll();
      await sleep(i >= total - 6 ? 96 + (i - (total - 6)) * 40 : 64);
    }
    if (roll) { roll.textContent = luckyName; roll.classList.add('hit'); }
    SFX.facCrown();
    flashScreen(`radial-gradient(circle at 50% 46%, ${hexA(col, .34)}, ${hexA(col, 0)} 68%)`, 900);
    await sleep(1000);
    // 高亮他投的那张卡，其余压暗
    if (luckyCard) { luckyCard.classList.add('lucky'); SFX.sparkle(); }
    d.querySelectorAll('.fv-card').forEach(c => { if (c !== luckyCard) c.classList.add('dim'); });
    await sleep(820);
    // 第四幕：加冕大徽章
    const crown = document.createElement('div');
    crown.className = 'fv-crown';
    crown.style.setProperty('--fc', col);
    crown.innerHTML = `<div class="fc-ring"></div>
      <div class="fc-ico">${f.icon || '🏫'}</div>
      <div class="fc-name">${esc(f.name || e.key)}</div>
      <div class="fc-tag">本 局 校 园 风 貌 · 全 场 共 享</div>
      <div class="fc-line"><b>主效果</b>${esc(f.lead || '')}</div>
      <div class="fc-line bad"><b>代价</b>${esc(f.cost || '')}</div>
      <div class="fc-quote">「${esc(f.tag || '')}」</div>
      <div class="fc-by">由 <b>${esc(luckyName)}</b> 的选票决定</div>`;
    if (panel) panel.appendChild(crown);
    confettiBurst(120); fxCoinRain(26);
    SFX.facCrown(); SFX.sparkle(); SFX.glint();
    requestAnimationFrame(() => requestAnimationFrame(() => crown.classList.add('show')));
    await sleep(2900);
    // 落位：写入地图中央的常驻徽章
    if (S) S.faculty = e.key;
    renderFacultyBadge(true);
    d.classList.remove('show');
    setTimeout(() => { if (facVoteEl === d) { d.remove(); facVoteEl = null; facVoteSig = ''; } }, 700);
    await sleep(620);
    if (e.lucky != null) {
      pulseCell(playerCell(e.lucky), col);
      fxBurst(playerCell(e.lucky), { kind: 'star', n: 18, speed: 3.4, size: 4.6, life: 48, color: [col, '#ffffff', '#ffd76a'], lift: 0.8, wave: { r: 74, color: col } });
    }
    await sleep(420);
    facCeremonyBusy = false;
    res();
  });
}

// 每轮开场提醒：免费轮 / 免租轮 —— 全屏大字，所有人一眼看见
function facultyRoundBanner(e) {
  return new Promise(res => {
    const free = e.kind === 'freeRound';
    const col = free ? '#4E9B2A' : '#3FBF9E';
    const d = document.createElement('div');
    d.className = 'fac-round';
    d.style.setProperty('--fc', col);
    d.innerHTML = `<div class="fr-in">
        <div class="fr-hot">${free ? '🎟️' : '🕊️'}</div>
        <div class="fr-title">${esc(e.title || '')}</div>
        <div class="fr-sub">${esc(e.sub || '')}</div>
        <div class="fr-note">第 ${e.round} 轮${e.left ? ` · 本局还剩 ${e.left} 个免租轮` : ''}</div>
      </div>`;
    $('fxLayer').appendChild(d);
    requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show')));
    SFX.facAlarm();
    if (free) { SFX.fanfare(); confettiBurst(96); fxCoinRain(28); }
    else { SFX.facBadge(); confettiBurst(64); }
    flashScreen(`radial-gradient(circle at 50% 50%, ${hexA(col, .34)}, ${hexA(col, 0)} 68%)`, 900);
    st(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 560); res(); }, 2650);
  });
}

// v5.6：免费轮 / 免租轮 —— 大屏抽签动画（加冕演出结束后紧跟播放，全场见证抽到第几轮）
function facultyDrawAnim(e) {
  return new Promise(async res => {
    const isFR = e.kind === 'freeRound';
    const rounds = (e.rounds || []).slice();
    const col = isFR ? '#4E9B2A' : '#3FBF9E';
    const d = document.createElement('div');
    d.className = 'fac-layer fd-draw-layer';
    d.innerHTML = `<div class="fv-panel fd-draw-panel" style="--fc:${col}">
        <div class="fv-glow"></div><div class="fv-beam"></div>
        <div class="fd-t">${isFR ? '🎟️ 免 费 轮 · 抽 签' : '🕊️ 免 租 轮 · 抽 签'}</div>
        <div class="fd-sub">本局风貌附带的轮次抽取 · 全场共同见证</div>
        <div class="fd-slots">${rounds.map((_, i) => `<div class="fd-slot${isFR ? ' big' : ''}" id="fdSlot${i}">？</div>`).join('')}</div>
        <div class="fd-note">${isFR ? '抽中的那一轮：全场买地皮、盖楼完全免费' : '抽中的四轮：全场踩到谁的地都不用交租金'}</div>
      </div>`;
    $('fxLayer').appendChild(d);
    requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show')));
    SFX.facRise();
    await sleep(sp(750));
    for (let i = 0; i < rounds.length; i++) {
      const slot = d.querySelector('#fdSlot' + i);
      const total = 13;
      for (let k = 0; k < total; k++) {
        slot.textContent = String(2 + Math.floor(Math.random() * 13));
        SFX.facRoll();
        await sleep(k >= total - 5 ? 100 + (k - (total - 5)) * 52 : 62);
      }
      slot.textContent = '第 ' + rounds[i] + ' 轮';
      slot.classList.add('hit');
      SFX.facBadge();
      flashScreen(`radial-gradient(circle at 50% 46%, ${hexA(col, .3)}, ${hexA(col, 0)} 68%)`, 650);
      if (i === rounds.length - 1) { SFX.facCrown(); confettiBurst(90); fxCoinRain(22); }
      await sleep(sp(700));
    }
    await sleep(sp(1400));
    d.classList.remove('show');
    setTimeout(() => d.remove(), 620);
    res();
  });
}

// 地图中央常驻徽章（每帧 renderPanel 调用；landing=true 时播放落位特效）
function renderFacultyBadge(landing) {
  const g = $('facBadge'); if (!g) return;
  const C = CTR_CARD;
  const bx = C.x + 20, by = C.y + 78, bw = C.w - 40, bh = 62;   // v5.6：徽章上移压扁，给下方胶囊区让位
  const key = S ? S.faculty : null;
  if (!key || !FACULTY[key]) {
    if (facBadgeKey === '__none__') return;
    facBadgeKey = '__none__';
    g.innerHTML = `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="16" fill="rgba(255,255,255,.45)" stroke="rgba(180,170,150,.6)" stroke-width="1.3" stroke-dasharray="7 6"/>
      <text x="${bx + bw / 2}" y="${by + bh / 2 + 7}" text-anchor="middle" font-size="17" font-weight="700" fill="#a3946f" letter-spacing="3">🏫 校园风貌 · 推选中…</text>`;
    return;
  }
  if (facBadgeKey === key && !landing) return;
  facBadgeKey = key;
  const f = FACULTY[key];
  const col = f.color || '#9A968C';
  const cy = by + bh / 2;
  g.innerHTML = `
    <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="16" fill="${hexA(col, .12)}" stroke="${hexA(col, .5)}" stroke-width="1.6"/>
    <rect x="${bx}" y="${by}" width="5.5" height="${bh}" rx="3" fill="${col}"/>
    <circle cx="${bx + 42}" cy="${cy}" r="21" fill="${hexA(col, .18)}" stroke="${col}" stroke-width="1.8"/>
    <circle cx="${bx + 42}" cy="${cy}" r="26.5" fill="none" stroke="${col}" stroke-width="1.2" stroke-dasharray="4 7" opacity=".55">
      <animateTransform attributeName="transform" type="rotate" from="0 ${bx + 42} ${cy}" to="360 ${bx + 42} ${cy}" dur="16s" repeatCount="indefinite"/>
    </circle>
    <text x="${bx + 42}" y="${cy + 8.5}" text-anchor="middle" font-size="23">${f.icon || '🏫'}</text>
    <text x="${bx + 78}" y="${by + 21}" font-size="10.5" fill="#a3946f" letter-spacing="2">本局校园风貌 · 全场共享</text>
    <text x="${bx + 78}" y="${by + 42}" font-size="19" font-weight="800" fill="${shade(col, -58)}">${esc(f.name)}</text>
    <text x="${bx + 78}" y="${by + 56.5}" font-size="12" fill="#7a6a52">▸ ${esc(f.lead)}　｜　代价：${esc(f.cost)}</text>
    <rect x="${bx + bw - 62}" y="${by + 6}" width="52" height="17" rx="8.5" fill="${hexA(col, .18)}" stroke="${hexA(col, .45)}" stroke-width="1"/>
    <text x="${bx + bw - 36}" y="${by + 18.5}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${shade(col, -58)}">详情</text>`;
  g.style.cursor = 'pointer';
  if (!g.dataset.bound) { g.dataset.bound = '1'; g.addEventListener('click', openFacDetail); }
  if (landing) {
    g.style.transformBox = 'fill-box';
    g.style.transformOrigin = 'center';
    g.classList.remove('fac-land');
    void g.getBoundingClientRect();
    g.classList.add('fac-land');
    setTimeout(() => g.classList.remove('fac-land'), 1100);
    SFX.facBadge(); SFX.bell();
  }
}

// 点击徽章：展开浮层 —— 本局风貌详情 + 全部 23 个风貌一览
function openFacDetail() {
  if (!S || !S.faculty || !FACULTY[S.faculty]) return;
  SFX.click();
  const cur = S.faculty, f = FACULTY[cur];
  const d = document.createElement('div');
  d.className = 'fac-layer fac-detail';
  d.innerHTML = `<div class="fd-panel">
      <div class="fd-head" style="--fc:${f.color}">
        <span class="fd-ico">${f.icon}</span>
        <span class="fd-name">${esc(f.name)}</span>
        <span class="fd-badge">本局风貌</span>
      </div>
      <div class="fd-cur" style="--fc:${f.color}">
        <div class="fd-row"><b>主效果</b>${esc(f.lead)}</div>
        <div class="fd-row bad"><b>代价</b>${esc(f.cost)}</div>
        <div class="fd-quote">「${esc(f.tag)}」</div>
      </div>
      ${S.freeRound ? `<div class="fd-note">🎟️ 已抽定免费轮：<b>第 ${S.freeRound} 轮</b>（买地皮、盖楼完全免费）</div>` : ''}
      ${(S.freeRentRounds && S.freeRentRounds.length) ? `<div class="fd-note">🕊️ 已抽定免租轮：<b>第 ${S.freeRentRounds.join(' / ')} 轮</b>（踩到谁的地都不用付租金）</div>` : ''}
      <div class="fd-sub">本局共有 23 种校园风貌，开局随机抽 3 个候选、随机抽一位玩家定夺</div>
      <div class="fd-grid">${FACULTY_KEYS.map(k => {
        const q = FACULTY[k];
        return `<div class="fd-cell${k === cur ? ' on' : ''}" style="--fc:${q.color}">
            <span class="fd-ci">${q.icon}</span><span class="fd-cn">${esc(q.name)}</span>
            <span class="fd-cl">${esc(q.lead)}</span><span class="fd-cc">代价：${esc(q.cost)}</span>
          </div>`;
      }).join('')}</div>
      <div class="fd-close">关闭</div>
    </div>`;
  $('fxLayer').appendChild(d);
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show')));
  const close = () => { d.classList.remove('show'); setTimeout(() => d.remove(), 380); };
  d.onclick = ev => { if (ev.target === d || ev.target.classList.contains('fd-close')) close(); };
  document.addEventListener('keydown', function esc2(ev) {
    if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', esc2); }
  });
}

// v5.1：专业技能大特效 —— 全屏染色 + 冲击波 + 中央大横幅，所有玩家都能看见
function hexA(hex, a) {
  const h = (hex || '#4a90d9').replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
async function skillFx(e) {
  const mj = MAJORS[e.major] || {};
  const color = mj.fx || '#4a90d9';
  const isActive = !!e.active;   // v5.3：主动技给更完整的一套演出（号角 + 横扫光束 + 双环）
  if (isActive) { SFX.skillCast(); SFX.beam(); } else { SFX.skill(); }
  SFX.sparkle();
  const cell = playerCell(e.pid);
  const [x, y] = cellCenter(cell);
  const pt = svgToScreen(x, y);

  // 1) 全屏染色闪光：所有人屏幕同步
  flashScreen(`radial-gradient(circle at 50% 50%, ${hexA(color, .40)}, ${hexA(color, .06)} 55%, ${hexA(color, 0)} 72%)`, 820);
  // 1.5) v5.3：主动技额外扫一道横向光束（左→右，带主题色）
  if (isActive) { skillBeam(color); pulseCell(cell, color); }
  // 2) 棋子处：脉冲 + 冲击波 + 星屑
  pulseCell(cell, color);
  fxBurst(cell, { kind: 'star', n: 22, speed: 3.8, size: 4.6, life: 48, color: [color, '#ffffff', '#ffe9a8'], wave: { r: 78, color, life: 44 } });
  fxBurst(cell, { kind: 'spark', n: 12, speed: 2.6, size: 3.2, life: 34, color: ['#ffffff', color] });
  if (isActive) fxBurst(cell, { kind: 'star', n: 16, speed: 5.2, size: 3.6, life: 56, color: [color, '#ffffff'], wave: { r: 116, color, life: 52 } });

  // 3) 中央大横幅（图标 + 技能名 + 谁发的 + 效果）
  const d = document.createElement('div');
  d.className = 'skill-cast';
  d.style.setProperty('--sk', color);
  d.innerHTML = `<div class="sc-ico">${mj.icon || '✨'}</div>
    <div class="sc-body"><div class="sc-name">${esc(mj.skill || e.name || '专业技能')}</div>
    <div class="sc-who">${esc(ownerName(e.pid))}${e.detail ? ' · ' + esc(e.detail) : ''}</div></div>`;
  $('fxLayer').appendChild(d);
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show')));
  await sleep(1250);
  d.classList.remove('show');
  setTimeout(() => d.remove(), 420);
  await sleep(300);
  void pt;
}
function comboPop(pid, n) {
  const [x, y] = cellCenter(playerCell(pid));
  const pt = svgToScreen(x, y);
  const d = document.createElement('div');
  d.className = 'combo-pop';
  d.style.left = pt[0] + 'px'; d.style.top = (pt[1] - 24) + 'px';
  d.textContent = `连击 ×${n}!`;
  $('fxLayer').appendChild(d);
  setTimeout(() => d.remove(), 1800);
}
const EMO_SOUND = {
  '😂': 'hi', '🤑': 'hi', '👍': 'hi', '🎉': 'hi', '🤣': 'hi', '😎': 'hi', '🔥': 'hi', '🏆': 'hi',
  '🤝': 'hi', '🚀': 'hi', '👏': 'hi', '😏': 'hi',
  '😡': 'lo', '😭': 'lo', '💩': 'lo', '💔': 'lo', '💸': 'lo', '🙏': 'lo', '🥹': 'lo',
  '😱': 'mid', '🤔': 'mid', '🤯': 'mid', '🐶': 'mid', '🍚': 'mid',
};
function chatFx(e) {
  const [x, y] = cellCenter(playerCell(e.pid));
  const pt = svgToScreen(x, y);
  const tone = QUICK_TONE[e.text] || 'normal';
  const d = document.createElement('div');
  d.className = 'chat-bubble t-' + tone;   // 语气决定气泡配色与抖动幅度
  d.style.left = pt[0] + 'px'; d.style.top = pt[1] + 'px';
  d.innerHTML = `<span class="cb-who">${esc(e.name)}</span>${esc(e.text)}`;
  $('fxLayer').appendChild(d);
  if (tone === 'up') fxBurst(playerCell(e.pid), { kind: 'star', n: 7, speed: 2, size: 3.2, life: 28, color: ['#ffd76a', '#ffb347'], lift: 0.5 });
  else if (tone === 'sad') fxBurst(playerCell(e.pid), { kind: 'petal', n: 6, speed: 1.6, size: 3.4, life: 40, color: ['#9fc4ea', '#c9dcf5'], gravity: 0.05 });
  else if (tone === 'angry') fxBurst(playerCell(e.pid), { kind: 'spark', n: 9, speed: 2.6, size: 3, life: 26, color: ['#e2574c', '#ff9a8f'] });
  setTimeout(() => d.remove(), 2600);
  const s = EMO_SOUND[e.text] || 'mid';
  if (s === 'hi') SFX.chatHi(); else if (s === 'lo') SFX.chatLo(); else SFX.chatMid();
  // v5.1：快捷语音不再加「某某说」前缀，且同一条只念一次（自己点按钮时已即时念过，服务端回显不再重复）
  if (QUICK_SET.has(e.text) && e.pid !== myPid) speak(e.text, e.name, tone, e.pid);
}
// ---------- v5.1 对决演出（辩论擂台 / 校园运动会共用） ----------
// 分步：①抽签（双方名字飞转后定格）②两人登上大屏幕（左右滑入 + 专业亮相）
//       ③两人依次掷骰（骰子 3D 翻滚，落定后揭晓点数）④比大小 → 高亮胜者 → 结算
async function duelAnim(e) {
  const isArena = e.label === '校园运动会';
  const A = ownerName(e.pid), B = ownerName(e.opp);
  const pa = playerPt(e.pid), pb = playerPt(e.opp);
  const cont = (S && S.players) ? S.players : [];
  const PA = cont.find(p => p.id === e.pid) || {};
  const PB = cont.find(p => p.id === e.opp) || {};
  const tie = (e.winner == null) || (e.a === e.b);
  const pool = cont.filter(p => p.alive).map(p => p.name);
  const rp = () => pool.length ? pool[Math.floor(Math.random() * pool.length)] : '?';

  const stage = document.createElement('div');
  stage.className = 'duel-stage' + (isArena ? ' arena' : '');
  stage.innerHTML =
    `<div class="ds-title">${isArena ? '🏟️ 校园运动会 · 对手抽签' : '⚔️ 辩论擂台 · 抽签对决'}</div>`
    + `<div class="ds-body">`
    +   `<div class="ds-side ds-l">`
    +     `<div class="ds-name" data-slot="a">？？？</div><div class="ds-mj" data-mj="a">抽签中…</div>`
    +     `<div class="die ds-die" data-die="a">${dieDots(1)}</div><div class="ds-score" data-score="a">?</div>`
    +   `</div>`
    +   `<div class="ds-mid"><span class="ds-vs">VS</span></div>`
    +   `<div class="ds-side ds-r">`
    +     `<div class="ds-name" data-slot="b">？？？</div><div class="ds-mj" data-mj="b">抽签中…</div>`
    +     `<div class="die ds-die" data-die="b">${dieDots(1)}</div><div class="ds-score" data-score="b">?</div>`
    +   `</div>`
    + `</div><div class="ds-foot" data-foot>转盘抽取中…</div>`;
  $('fxLayer').appendChild(stage);
  requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.add('show')));
  const q = sel => stage.querySelector(sel);
  const nameA = q('[data-slot="a"]'), nameB = q('[data-slot="b"]');
  const mjA = q('[data-mj="a"]'), mjB = q('[data-mj="b"]');
  const dieA = q('[data-die="a"]'), dieB = q('[data-die="b"]');
  const scA = q('[data-score="a"]'), scB = q('[data-score="b"]');
  const sideA = q('.ds-l'), sideB = q('.ds-r');
  const foot = q('[data-foot]');

  try {
    SFX.duel(); SFX.drumroll();
    // ① 抽签：名字在两侧槽位里飞快跳动，最后定格
    dieA.style.visibility = 'hidden'; dieB.style.visibility = 'hidden';
    scA.style.visibility = 'hidden'; scB.style.visibility = 'hidden';
    for (let i = 0; i < 14; i++) {
      nameA.textContent = rp(); nameB.textContent = rp();
      SFX.tick();
      await sleep(76);
    }
    nameA.textContent = A; nameB.textContent = B;
    nameA.classList.add('lock'); nameB.classList.add('lock');
    SFX.clash();

    // ② 两人登上大屏幕
    sideA.style.setProperty('--duel-c', PA.color || '#e2574c');
    sideB.style.setProperty('--duel-c', PB.color || '#4a90d9');
    mjA.textContent = (MAJORS[PA.major] || {}).name ? `${(MAJORS[PA.major] || {}).icon || ''} ${(MAJORS[PA.major] || {}).name}` : '挑战者';
    mjB.textContent = (MAJORS[PB.major] || {}).name ? `${(MAJORS[PB.major] || {}).icon || ''} ${(MAJORS[PB.major] || {}).name}` : '挑战者';
    sideA.classList.add('in'); 
    await sleep(150);
    sideB.classList.add('in');
    fxBurst(pa, { kind: 'spark', n: 14, speed: 3.2, size: 3.2, life: 36, color: ['#e2574c', '#ff9a8f', '#ffd76a'] });
    fxBurst(pb, { kind: 'spark', n: 14, speed: 3.2, size: 3.2, life: 36, color: ['#4a90d9', '#8fc2ff', '#ffd76a'] });
    shockwave(playerCell(e.pid)); shockwave(playerCell(e.opp));
    flashScreen(`radial-gradient(circle at 50% 42%, ${isArena ? 'rgba(120,200,255,.34)' : 'rgba(255,214,140,.34)'}, rgba(60,40,20,0) 66%)`, 520);
    foot.textContent = `${A}　VS　${B}`;
    await sleep(760);

    // ③ 双方依次掷骰（骰子 3D 翻滚，落定才揭晓点数）
    const rollOne = async (die, val, side) => {
      die.style.visibility = 'visible';
      die.classList.add('rolling'); die.classList.remove('land');
      side.classList.add('rolling');
      SFX.dice();
      for (let i = 0; i < 12; i++) { die.innerHTML = dieDots(1 + Math.floor(Math.random() * 6)); SFX.tick(); await sleep(84); }
      die.classList.remove('rolling'); die.classList.add('land');
      die.innerHTML = dieDots(val);
      side.classList.remove('rolling'); side.classList.add('rolled');
      SFX.diceLand();
      const sc = (side === sideA) ? scA : scB;
      sc.style.visibility = 'visible';
      sc.textContent = String(val);
      sc.classList.add('pop');
      await sleep(300);
    };
    foot.textContent = `${A} 掷骰…`;
    await rollOne(dieA, e.a, sideA);
    foot.textContent = `${B} 掷骰…`;
    await rollOne(dieB, e.b, sideB);
    foot.textContent = `${A} ${e.a}　:　${e.b} ${B}`;
    await sleep(520);

    // ④ 比大小 → 高亮胜者
    if (tie) {
      stage.classList.add('tie');
      foot.textContent = '势均力敌 —— 平手，各回各家';
      SFX.buzzer();
    } else {
      const wLeft = e.winner === e.pid;
      const ws = wLeft ? sideA : sideB, ls = wLeft ? sideB : sideA;
      ws.classList.add('win'); ls.classList.add('lose');
      const wp = wLeft ? pa : pb;
      setTimeout(() => { SFX.clash(); SFX.glint(); shakeBoard(); flashScreen('radial-gradient(circle at 50% 50%, rgba(255,214,140,.42), rgba(180,60,40,0) 62%)', 460); }, 60);
      setTimeout(() => { fxBurst(wp, { kind: 'star', n: 20, speed: 4.6, size: 5.4, life: 48, color: ['#ffffff', '#ffd76a', '#ffb347'], wave: { r: 92, color: '#ffd76a', life: 40 } }); confettiBurst(70); }, 160);
      SFX.fanfare();
      const pct = e.pct ? `（输者现金的 ${Math.round(e.pct * 100)}%）` : '';
      foot.textContent = `${wLeft ? A : B} 胜 · 赌注 ¥${e.amount}${pct}`;
    }
    await sleep(1400);
  } catch (err) { /* 演出出错不能卡住队列 */ }

  stage.classList.remove('show');
  await sleep(320);
  stage.remove();
}
// ---------- 天气视觉引擎（v5.1 重写） ----------
// 旧版把「台风」和「雨天」共用同一套雨幕，只是加大雨量——观感完全一样。
// 现在八种天气各有独立的绘制例程与色调：晴天光柱、阴天压暗、雨天斜雨、台风旋转风眼、
// 雾霾漂移雾团、暴雪飘雪、烈日热浪、大风横扫风线。全部画在 boardWrap 内的单张 canvas
// （#wxCv）上，零常驻 DOM 粒子，切天气只是换绘制例程。
const WX_VEIL = {
  sun:   'rgba(255,206,86,.16)',
  cloud: 'rgba(130,130,140,.10)',
  rain:  'rgba(84,124,176,.20)',
  storm: 'rgba(38,36,64,.36)',
  fog:   'rgba(206,212,214,.30)',
  snow:  'rgba(196,220,246,.24)',
  heat:  'rgba(255,138,52,.18)',
  wind:  'rgba(150,190,180,.12)',
};
function applyWeather(w) {
  if (w === curWeather) return;
  curWeather = w;
  const wrap = $('boardWrap'); if (!wrap) return;
  let veil = document.getElementById('weatherVeil');
  if (!veil) { veil = document.createElement('div'); veil.id = 'weatherVeil'; veil.className = 'weather-veil'; wrap.appendChild(veil); }
  veil.style.background = WX_VEIL[w] || 'transparent';
  veil.classList.toggle('on', !!WX_VEIL[w] && w !== 'cloud');
  startWeatherFx(w);
}
// 天气粒子引擎：所有天气共用一张 canvas，按 kind 分发到各自的绘制例程
let wxCv = null, wxCtx = null, wxRAF = 0, wxKind = null, wxSeed = null, wxFrame = 0, wxFlash = 0;
const WR = (a, b) => a + Math.random() * (b - a);
function wxCanvas() {
  const wrap = $('boardWrap'); if (!wrap) return null;
  if (!wxCv) {
    wxCv = document.createElement('canvas');
    wxCv.id = 'wxCv';
    wxCv.style.cssText = 'position:absolute;inset:0;z-index:11;pointer-events:none;';
    wrap.appendChild(wxCv);
  }
  return wrap;
}
function startWeatherFx(kind) {
  const wrap = wxCanvas(); if (!wrap) return;
  if (wxRAF) { cancelAnimationFrame(wxRAF); wxRAF = 0; }
  wxKind = kind; wxFrame = 0; wxFlash = 0;
  const W = wxCv.width = wrap.clientWidth, H = wxCv.height = wrap.clientHeight;
  wxCtx = wxCv.getContext('2d');
  wxSeed = seedWeather(kind, W, H);
  if (kind === 'cloud') { wxCv.style.display = 'none'; return; }   // 阴天只有整体压暗，不铺粒子
  wxCv.style.display = 'block';
  const loop = () => { if (!wxKind) { wxRAF = 0; return; } drawWeather(); wxRAF = requestAnimationFrame(loop); };
  wxRAF = requestAnimationFrame(loop);
}
function seedWeather(kind, W, H) {
  switch (kind) {
    case 'rain':
      // v5.4：雨丝加密加长 + 落地水花圈（rings 运行时生成）
      return { drops: Array.from({ length: 74 }, () => ({ x: WR(-W * .3, W), y: WR(0, H), len: WR(14, 27), v: WR(10, 16), a: WR(.35, .8) })), rings: [] };
    case 'storm':
      // 旋转风眼 + 横扫阵风 + 飞舞碎片（与雨天完全不同的观感）；v5.4 气流臂/阵风加密
      return {
        eye: { x: W * .5, y: H * .5 }, spin: 0, next: Math.round(WR(300, 780)),
        arms: Array.from({ length: 9 }, (_, i) => ({ ph: i * Math.PI / 4.5, off: WR(0, .6) })),
        debris: Array.from({ length: 52 }, () => ({
          x: WR(0, W), y: WR(0, H), r: WR(1.6, 4.8), vx: WR(3.2, 7.4), vy: WR(-1.4, 1.4),
          rot: WR(0, 6.28), vr: WR(-.2, .2), a: WR(.22, .58), c: pick(['#c9cfd8', '#9aa4b2', '#e7c98d', '#8f9bb3']),
        })),
        gusts: Array.from({ length: 20 }, () => ({ y: WR(0, H), x: WR(-W, W), w: WR(60, 230), v: WR(9, 20), a: WR(.05, .16) })),
      };
    case 'snow':
      // v5.4：雪量加大 + 远近两层（近景大而快、远景小而慢），配地面霜白
      return { flakes: Array.from({ length: 96 }, () => ({ x: WR(0, W), y: WR(0, H), r: WR(1.4, 5.2), v: WR(1.1, 3.2), sway: WR(.4, 1.5), ph: WR(0, 6.28), a: WR(.4, .95) })) };
    case 'fog':
      return { banks: Array.from({ length: 13 }, () => ({ x: WR(-W * .2, W * 1.1), y: WR(0, H), r: WR(120, 340), v: WR(.18, .62), a: WR(.05, .15) })) };
    case 'heat':
      return {
        motes: Array.from({ length: 34 }, () => ({ x: WR(0, W), y: WR(0, H), r: WR(1.2, 3.2), v: WR(.5, 1.6), a: WR(.15, .4), ph: WR(0, 6.28) })),
        waves: Array.from({ length: 7 }, (_, i) => ({ y: H * (i + .5) / 7, ph: WR(0, 6.28), a: WR(.04, .09) })),
      };
    case 'wind':
      return {
        lines: Array.from({ length: 32 }, () => ({ y: WR(0, H), x: WR(-W, W), len: WR(40, 200), v: WR(8, 21), a: WR(.06, .22) })),
        leaves: Array.from({ length: 26 }, () => ({ x: WR(0, W), y: WR(0, H), r: WR(3, 7), vx: WR(3.4, 8), vy: WR(-1.2, 1.6), rot: WR(0, 6.28), vr: WR(-.13, .13), a: WR(.3, .7), c: pick(['#c8a24a', '#b5763a', '#8fae5d', '#d8c07a']) })),
      };
    case 'sun':
      return {
        rays: Array.from({ length: 12 }, (_, i) => ({ ph: i * Math.PI / 6 })),
        motes: Array.from({ length: 26 }, () => ({ x: WR(0, W), y: WR(0, H), r: WR(1, 2.6), v: WR(-.35, -.12), a: WR(.12, .38), ph: WR(0, 6.28) })),
      };
    default: return {};
  }
}
function drawWeather() {
  const W = wxCv.width, H = wxCv.height;
  wxCtx.clearRect(0, 0, W, H);
  wxFrame++;
  switch (wxKind) {
    case 'rain': {
      wxCtx.lineWidth = 1.1;
      for (const d of wxSeed.drops) {
        wxCtx.strokeStyle = `rgba(150,190,230,${d.a})`;
        wxCtx.beginPath(); wxCtx.moveTo(d.x, d.y); wxCtx.lineTo(d.x + d.len * .35, d.y + d.len); wxCtx.stroke();
        d.y += d.v; d.x += d.v * .175;
        // v5.4：雨滴到底部时溅起落地水花圈
        if (d.y > H) {
          if (Math.random() < .28 && wxSeed.rings.length < 22) wxSeed.rings.push({ x: d.x + d.len * .35, y: H - WR(0, 26), r: 1.5, a: .5 });
          d.y = -20; d.x = WR(-W * .2, W);
        }
      }
      // 水花圈扩散淡出
      for (let i = wxSeed.rings.length - 1; i >= 0; i--) {
        const rg = wxSeed.rings[i];
        wxCtx.strokeStyle = `rgba(190,220,248,${rg.a})`; wxCtx.lineWidth = 1.4;
        wxCtx.beginPath(); wxCtx.ellipse(rg.x, rg.y, rg.r * 1.7, rg.r * .55, 0, 0, 6.284); wxCtx.stroke();
        rg.r += .55; rg.a -= .028;
        if (rg.a <= 0) wxSeed.rings.splice(i, 1);
      }
      break;
    }
    case 'storm': {
      const s = wxSeed, c = s.eye; s.spin += 0.012;
      // 螺旋气流臂（v5.4：宽淡底 + 窄浓芯 双描边，旋转感更强）
      for (const a of s.arms) {
        for (const [lw, col] of [[5.5, 'rgba(198,208,228,.08)'], [2.2, 'rgba(214,224,244,.16)']]) {
          wxCtx.lineWidth = lw;
          wxCtx.beginPath();
          for (let t = 0; t <= 1; t += 0.035) {
            const ang = a.ph + s.spin + t * 4.1 + a.off;
            const rad = 60 + t * Math.max(W, H) * 0.62;
            const x = c.x + Math.cos(ang) * rad, y = c.y + Math.sin(ang) * rad * 0.62;
            if (t === 0) wxCtx.moveTo(x, y); else wxCtx.lineTo(x, y);
          }
          wxCtx.strokeStyle = col; wxCtx.stroke();
        }
      }
      // 风眼（v5.4：脉动呼吸 + 内圈旋涡亮线）
      const eyeR = 94 + Math.sin(wxFrame * .035) * 9;
      const g = wxCtx.createRadialGradient(c.x, c.y, 6, c.x, c.y, eyeR);
      g.addColorStop(0, 'rgba(16,14,32,.58)'); g.addColorStop(.62, 'rgba(52,50,86,.28)'); g.addColorStop(1, 'rgba(52,50,86,0)');
      wxCtx.fillStyle = g; wxCtx.beginPath(); wxCtx.arc(c.x, c.y, eyeR, 0, 6.284); wxCtx.fill();
      wxCtx.strokeStyle = `rgba(224,232,250,${.18 + Math.sin(wxFrame * .05) * .1})`; wxCtx.lineWidth = 1.6;
      wxCtx.beginPath(); wxCtx.arc(c.x, c.y, eyeR * .38, wxFrame * .04, wxFrame * .04 + 4.6); wxCtx.stroke();
      // 横扫阵风条
      for (const gu of s.gusts) {
        wxCtx.fillStyle = `rgba(214,222,238,${gu.a})`;
        wxCtx.fillRect(gu.x, gu.y, gu.w, 2.4);
        gu.x += gu.v; if (gu.x > W) { gu.x = -gu.w - WR(0, W * .4); gu.y = WR(0, H); }
      }
      // 飞舞碎片
      for (const d of s.debris) {
        wxCtx.save(); wxCtx.translate(d.x, d.y); wxCtx.rotate(d.rot);
        wxCtx.globalAlpha = d.a; wxCtx.fillStyle = d.c;
        wxCtx.fillRect(-d.r, -d.r * .6, d.r * 2, d.r * 1.2);
        wxCtx.restore();
        d.x += d.vx; d.y += d.vy + Math.sin(wxFrame * .05 + d.rot) * .5; d.rot += d.vr;
        if (d.x > W + 12) { d.x = -12; d.y = WR(0, H); }
        if (d.y < -12) d.y = H + 12; else if (d.y > H + 12) d.y = -12;
      }
      wxCtx.globalAlpha = 1;
      // 阵雷闪（v5.3：只保留闪光视觉，不再重复播放雷声——用户反馈"台风那个嗯一下的声音"太吵）
      s.next--;
      if (s.next <= 0) { s.next = Math.round(WR(300, 780)); wxFlash = 9; }
      if (wxFlash > 0) { wxCtx.fillStyle = `rgba(232,240,255,${wxFlash / 20})`; wxCtx.fillRect(0, 0, W, H); wxFlash--; }
      break;
    }
    case 'snow': {
      // v5.4：远近两层 —— 近景大而快（前 1/3），远景小而慢，底部铺一条地面霜白
      const flakes = wxSeed.flakes;
      const mid = Math.floor(flakes.length / 3);
      flakes.forEach((f, idx) => {
        const near = idx < mid;
        wxCtx.globalAlpha = near ? Math.min(1, f.a + .12) : f.a * .8;
        wxCtx.fillStyle = '#ffffff';
        wxCtx.beginPath(); wxCtx.arc(f.x, f.y, f.r, 0, 6.284); wxCtx.fill();
        if (near) {   // 近景雪花加一圈柔光
          wxCtx.globalAlpha *= .3;
          wxCtx.beginPath(); wxCtx.arc(f.x, f.y, f.r * 2.1, 0, 6.284); wxCtx.fill();
        }
        f.y += f.v * (near ? 1.25 : .8); f.ph += .03; f.x += Math.sin(f.ph) * f.sway * .5;
        if (f.y > H + 6) { f.y = -6; f.x = WR(0, W); }
        if (f.x < -8) f.x = W + 8; else if (f.x > W + 8) f.x = -8;
      });
      wxCtx.globalAlpha = 1;
      // 地面霜白：底部渐变，越到后期越明显（20s 饱和）
      const frostA = Math.min(.2, .05 + wxFrame * .00015);
      const fg = wxCtx.createLinearGradient(0, H * .86, 0, H);
      fg.addColorStop(0, 'rgba(240,248,255,0)'); fg.addColorStop(1, `rgba(240,248,255,${frostA})`);
      wxCtx.fillStyle = fg; wxCtx.fillRect(0, H * .86, W, H * .14);
      break;
    }
    case 'fog': {
      for (const b of wxSeed.banks) {
        const g = wxCtx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, `rgba(232,236,238,${b.a})`); g.addColorStop(1, 'rgba(232,236,238,0)');
        wxCtx.fillStyle = g; wxCtx.beginPath(); wxCtx.arc(b.x, b.y, b.r, 0, 6.284); wxCtx.fill();
        b.x += b.v; if (b.x - b.r > W) { b.x = -b.r; b.y = WR(0, H); }
      }
      break;
    }
    case 'heat': {
      for (const wv of wxSeed.waves) {
        wxCtx.beginPath();
        for (let x = 0; x <= W; x += 18) {
          const y = wv.y + Math.sin(x * .021 + wxFrame * .05 + wv.ph) * 7;
          if (x === 0) wxCtx.moveTo(x, y); else wxCtx.lineTo(x, y);
        }
        wxCtx.strokeStyle = `rgba(255,196,120,${wv.a})`; wxCtx.lineWidth = 2.6; wxCtx.stroke();
      }
      for (const m of wxSeed.motes) {
        wxCtx.globalAlpha = m.a; wxCtx.fillStyle = '#ffb765';
        wxCtx.beginPath(); wxCtx.arc(m.x + Math.sin(wxFrame * .04 + m.ph) * 9, m.y, m.r, 0, 6.284); wxCtx.fill();
        m.y -= m.v; if (m.y < -6) { m.y = H + 6; m.x = WR(0, W); }
      }
      wxCtx.globalAlpha = 1;
      break;
    }
    case 'wind': {
      for (const l of wxSeed.lines) {
        const g = wxCtx.createLinearGradient(l.x, l.y, l.x + l.len, l.y);
        g.addColorStop(0, 'rgba(224,240,236,0)'); g.addColorStop(.5, `rgba(224,240,236,${l.a})`); g.addColorStop(1, 'rgba(224,240,236,0)');
        wxCtx.strokeStyle = g; wxCtx.lineWidth = 2;
        wxCtx.beginPath(); wxCtx.moveTo(l.x, l.y); wxCtx.lineTo(l.x + l.len, l.y); wxCtx.stroke();
        l.x += l.v; if (l.x > W) { l.x = -l.len - WR(0, W * .5); l.y = WR(0, H); }
      }
      for (const f of wxSeed.leaves) {
        wxCtx.save(); wxCtx.translate(f.x, f.y); wxCtx.rotate(f.rot);
        wxCtx.globalAlpha = f.a; wxCtx.fillStyle = f.c;
        wxCtx.beginPath(); wxCtx.ellipse(0, 0, f.r, f.r * .45, 0, 0, 6.284); wxCtx.fill();
        wxCtx.restore();
        f.x += f.vx; f.y += f.vy + Math.sin(wxFrame * .06 + f.rot) * .7; f.rot += f.vr;
        if (f.x > W + 14) { f.x = -14; f.y = WR(0, H); }
        if (f.y < -14) f.y = H + 14; else if (f.y > H + 14) f.y = -14;
      }
      wxCtx.globalAlpha = 1;
      break;
    }
    case 'sun': {
      const cx = W * .5, cy = H * .34;
      wxCtx.save(); wxCtx.translate(cx, cy); wxCtx.rotate(wxFrame * .0022);
      wxCtx.lineWidth = 38;
      for (const r of wxSeed.rays) {
        const g = wxCtx.createLinearGradient(0, 0, Math.cos(r.ph) * 620, Math.sin(r.ph) * 620);
        g.addColorStop(0, 'rgba(255,228,150,.24)'); g.addColorStop(1, 'rgba(255,228,150,0)');
        wxCtx.strokeStyle = g;
        wxCtx.beginPath(); wxCtx.moveTo(0, 0); wxCtx.lineTo(Math.cos(r.ph) * 620, Math.sin(r.ph) * 620); wxCtx.stroke();
      }
      wxCtx.restore();
      for (const m of wxSeed.motes) {
        wxCtx.globalAlpha = m.a; wxCtx.fillStyle = '#fff3c4';
        wxCtx.beginPath(); wxCtx.arc(m.x + Math.sin(wxFrame * .02 + m.ph) * 12, m.y, m.r, 0, 6.284); wxCtx.fill();
        m.y += m.v; if (m.y < -6) { m.y = H + 6; m.x = WR(0, W); }
      }
      wxCtx.globalAlpha = 1;
      break;
    }
    default: wxCv.style.display = 'none'; break;
  }
}
window.addEventListener('resize', () => { if (curWeather) startWeatherFx(curWeather); });

// ---------- 特效实现 ----------
function diceAnim(d1, d2, single) {
  return new Promise(res => {
    const box = document.createElement('div');
    box.className = 'dice-wrap'; box.style.cssText = 'position:absolute;left:50%;top:63%;transform:translate(-50%,-50%);z-index:28;';
    // v5.1：骰子放进有透视的容器里，滚动时做真正的 3D 翻滚（rotateX + rotateY + 位移弹跳），
    // 而不是原地晃两下就出点数；落地时补一圈冲击波与灰尘。
    // v5.6：岔路内只掷一颗骰子（single=true 时只渲染一枚，居中放大）
    box.innerHTML = `<div class="die-wrap"><div class="die">${dieDots(1)}</div><i class="die-shadow"></i></div>`
      + (single ? '' : `<div class="die-wrap"><div class="die">${dieDots(1)}</div><i class="die-shadow"></i></div>`);
    if (single) box.querySelector('.die-wrap').style.transform = 'scale(1.28)';
    $('fxLayer').appendChild(box);
    SFX.dice();
    const dice = box.querySelectorAll('.die');
    if (!single) box.querySelectorAll('.die-wrap')[1].style.animationDelay = '.07s';
    dice.forEach(d => d.classList.add('rolling'));
    const iv = setInterval(() => { dice.forEach(d => d.innerHTML = dieDots(1 + Math.floor(Math.random() * 6))); }, sp(105));
    setTimeout(() => {
      clearInterval(iv);
      SFX.diceLand();
      // v5.3：骰子落定不再晃动整个屏幕（用户反馈"整屏晃一下"太晕），
      // 改成只在骰子落点画一圈扩散涟漪 + 光晕，观感干净、不晕人。
      setTimeout(() => { try { SFX.diceSettle(); diceRipple(box); } catch (e) {} }, sp(70));
      dice[0].innerHTML = dieDots(d1);
      if (!single) dice[1].innerHTML = dieDots(d2);
      dice.forEach(d => { d.classList.remove('rolling'); d.classList.add('land'); });
      const im = document.createElement('div'); im.className = 'dice-impact';
      box.appendChild(im); setTimeout(() => im.remove(), 900);
      st(() => { try { SFX.coinRain(); } catch (e) {} }, 220);
      st(() => { box.remove(); res(); }, 1150);
    }, sp(1780));
  });
}
function dieDots(n) {
  const on = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const maps = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  maps[n].forEach(i => on[i] = 1);
  return on.map(b => `<i class="${b ? 'on' : ''}"></i>`).join('');
}
function moveAnim(e) {
  return new Promise(res => {
    let i = 0;
    const step = () => {
      if (i >= e.path.length) { render(); return res(); }
      const pid = e.pid, cell = e.path[i];
      const tok = tokenEls[pid];
      if (tok) {
        SFX.step();
        const [x, y] = cellCenter(cell);
        tok.style.transition = `transform ${0.14 * speed}s ease-out`;
        tok.setAttribute('transform', `translate(${x},${y - 15})`);   // 跳起
        st(() => {
          tok.style.transition = `transform ${0.14 * speed}s ease-in`;
          tok.setAttribute('transform', `translate(${x},${y})`);      // 落地
          trailAt(cell, 9);
        }, 135);
      }
      i++; setTimeout(step, sp(300));
    };
    step();
  });
}
function cardAnim(e) {
  return new Promise(res => {
    const modal = $('modal');
    modal.style.display = 'flex';
    modal.className = 'modal-bg' + (e.type === 'fate' ? ' m-fate' : ' m-chance');
    const cm = $('cardModal'); cm.style.display = 'block'; cm.classList.remove('show'); cm.style.opacity = 1;
    $('cardType').textContent = e.type === 'chance' ? '机 会' : '命 运';
    $('cardType').parentElement.className = 'card-face card-front' + (e.type === 'fate' ? ' fate' : '');
    $('cardTitle').textContent = e.card.name; $('cardDesc').textContent = e.card.desc;
    // 牌背冒出的光晕（机会紫 / 命运绿）
    const halo = document.createElement('div');
    halo.className = 'card-halo ' + (e.type === 'fate' ? 'fate' : 'chance');
    const wrap = $('modal'); wrap.appendChild(halo);
    setTimeout(() => halo.remove(), 4600);
    st(() => cm.classList.add('show'), 850);
    st(() => { modal.style.display = 'none'; modal.className = 'modal-bg'; cm.style.display = 'none'; res(); }, 4200);
  });
}
function fxAt(cell, html) {
  const [x, y] = cellCenter(cell);
  const pt = svgToScreen(x, y);
  const d = document.createElement('div'); d.innerHTML = html;
  const el = d.firstChild;
  el.style.left = pt[0] + 'px'; el.style.top = pt[1] + 'px'; el.style.transform = 'translate(-50%,-50%)';
  $('fxLayer').appendChild(el);
  setTimeout(() => el.remove(), 1800);
}
function svgToScreen(x, y) {
  const svg = $('board'), r = svg.getBoundingClientRect();
  const sc = r.width / svg.viewBox.baseVal.width;
  return [r.left + x * sc, r.top + y * sc];
}
function pulseCell(cell, color) {
  const [x, y] = CELLXY(cell);
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', x); rect.setAttribute('y', y); rect.setAttribute('width', CW); rect.setAttribute('height', CH);
  rect.setAttribute('rx', 6); rect.setAttribute('fill', 'none'); rect.setAttribute('stroke', color); rect.setAttribute('stroke-width', 3);
  rect.setAttribute('class', 'pulse');
  $('board').appendChild(rect);
  setTimeout(() => rect.remove(), 2100);
}
// v5.1：盖房演出升级 —— 先搭脚手架 → 砖料落下 → 房子弹起 → 尘土/光环收尾
function buildAnim(e) {
  const [x, y] = cellCenter(e.cell);
  const pt = svgToScreen(x, y);
  const gid = BOARD[e.cell] && BOARD[e.cell].g;
  const grp = (gid && GROUPS[gid]) ? GROUPS[gid] : '#e8b04b';
  const el = document.createElement('div');
  el.className = 'house3d ' + (e.hotel ? 'hotel' : 'lv' + (e.level || 1));
  el.style.left = pt[0] + 'px'; el.style.top = pt[1] + 'px';
  el.style.setProperty('--bc', grp);
  el.style.fontSize = e.hotel ? '54px' : '42px';
  el.innerHTML = `<span class="h3-bar b1"></span><span class="h3-bar b2"></span>`
    + `<span class="h3-ico">${e.hotel ? '🏨' : '🏠'}</span><span class="h3-dust"></span>`;
  $('fxLayer').appendChild(el);
  // ① 脚手架先立起来（条形动画）
  setTimeout(() => el.classList.add('scaffold'), 0);
  // ② 砖块木料落下
  fxBurst(e.cell, { kind: 'shard', n: e.hotel ? 18 : 12, speed: 2.2, size: 3.4, life: 44, color: ['#c9a97e', '#a9764a', '#ded4c2'], gravity: 0.32 });
  // ③ 房子从地面弹起 + 尘土环
  setTimeout(() => {
    el.classList.add('up');
    fxBurst(e.cell, { kind: 'ring', n: 0, wave: { r: e.hotel ? 74 : 52, color: grp, life: 36 } });
  }, 150);
  // ④ 收尾：旅馆震屏 + 礼花；普通房一圈上浮星光
  if (e.hotel) {
    setTimeout(() => { shockwave(e.cell); crownAt(e.cell, grp); confettiBurst(64); fxCoinRain(16); }, 460);
  } else {
    setTimeout(() => fxBurst(e.cell, { kind: 'star', n: 10, speed: 2.4, size: 3.6, life: 36, lift: 0.9, color: [grp, '#ffd76a', '#ffffff'] }), 460);
  }
  setTimeout(() => el.remove(), e.hotel ? 2150 : 1800);
}
function shockwave(cell) {
  const [cx, cy] = cellCenter(cell);
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', 10);
  c.setAttribute('fill', 'none'); c.setAttribute('stroke', '#c0392b'); c.setAttribute('stroke-width', 4);
  c.setAttribute('class', 'shockwave');
  $('board').appendChild(c);
  setTimeout(() => c.remove(), 900);
}
function shakeBoard() { const b = $('boardWrap'); b.style.animation = 'shake .5s'; setTimeout(() => b.style.animation = '', 520); }
// v5.3：主动技横扫光束 —— 一道带主题色的光带从左扫到右，全屏可见
function skillBeam(color) {
  const d = document.createElement('div');
  d.className = 'skill-beam';
  d.style.setProperty('--sk', color || '#e8b04b');
  $('fxLayer').appendChild(d);
  setTimeout(() => d.remove(), 900);
}
// v5.4：买地插旗 —— 旗杆"噗"地立在地块上，旗面（买家主题色）升起后飘两下自动淡出
function flagPop(cell, color) {
  const [x, y] = cellCenter(cell);
  const pt = svgToScreen(x, y);
  const d = document.createElement('div');
  d.className = 'flag-pop';
  d.style.left = pt[0] + 'px';
  d.style.top = pt[1] + 'px';
  const c = color || '#e8b04b';
  d.innerHTML = `<svg width="34" height="56" viewBox="0 0 34 56">
    <line x1="4" y1="4" x2="4" y2="52" stroke="#8a6a3a" stroke-width="3" stroke-linecap="round"/>
    <circle cx="4" cy="4" r="2.6" fill="#e8b04b"/>
    <g class="flag-face"><path d="M5.5 7 L31 12 L5.5 19 Z" fill="${c}" stroke="rgba(255,255,255,.85)" stroke-width="1.4"/></g>
  </svg>`;
  $('fxLayer').appendChild(d);
  setTimeout(() => { d.style.transition = 'opacity .5s'; d.style.opacity = '0'; }, 1300);
  setTimeout(() => d.remove(), 1900);
}
// v5.3：盖楼 / 升级光柱 —— 从格子底部升起的竖直光柱 + 顶上星芒
function upgradePillar(cell, color) {
  const [x, y] = cellCenter(cell);
  const pt = svgToScreen(x, y);
  const d = document.createElement('div');
  d.className = 'up-pillar';
  d.style.left = pt[0] + 'px';
  d.style.top = pt[1] + 'px';
  d.style.setProperty('--up', color || '#e8b04b');
  $('fxLayer').appendChild(d);
  setTimeout(() => d.remove(), 1150);
}
// v5.3：破产「灰化慢镜」—— 棋盘瞬间褪色压暗再缓缓恢复，比晃屏更有"落幕"的重量感
function greyMoment() {
  const b = $('boardWrap');
  if (!b) return;
  b.classList.remove('grey-out');
  void b.offsetWidth;
  b.classList.add('grey-out');
  setTimeout(() => b.classList.remove('grey-out'), 1500);
}
// v5.3：加冕皇冠 —— 落在指定格子（垄断 / 夺冠用）
function crownAt(cell, color) {
  const [x, y] = cellCenter(cell);
  const pt = svgToScreen(x, y);
  const d = document.createElement('div');
  d.className = 'crown-pop';
  d.innerHTML = '👑';
  d.style.left = pt[0] + 'px';
  d.style.top = pt[1] + 'px';
  d.style.setProperty('--cr', color || '#e8b04b');
  $('fxLayer').appendChild(d);
  setTimeout(() => d.remove(), 1400);
}
// v5.1：拆除时的烟尘 + 坠落碎块（DOM 层，比纯 canvas 粒子更有"塌"的重量感）
function collapseAt(cell, big) {
  const [x, y] = cellCenter(cell);
  const pt = svgToScreen(x, y);
  const wrap = document.createElement('div');
  wrap.className = 'collapse';
  wrap.style.left = pt[0] + 'px'; wrap.style.top = pt[1] + 'px';
  const n = big ? 5 : 3;
  let inner = '<span class="cf-dust"></span>';
  for (let i = 0; i < n; i++) {
    const ang = (-140 + i * (280 / Math.max(1, n - 1))) * Math.PI / 180;
    inner += `<i class="cf-bit" style="--dx:${(Math.cos(ang) * rnd(28, 62)).toFixed(0)}px;--dy:${(Math.sin(ang) * rnd(18, 40)).toFixed(0)}px;--rot:${rnd(-260, 260).toFixed(0)}deg;animation-delay:${(i * 0.05).toFixed(2)}s"></i>`;
  }
  wrap.innerHTML = inner;
  $('fxLayer').appendChild(wrap);
  setTimeout(() => wrap.remove(), 1500);
}
// 3D 金币飞行：fromCell（格子索引或棋盘坐标 [x,y]）→ target（棋盘坐标 [x,y]）
function flyCoin(fromArg, target, n = 4) {
  const from = Array.isArray(fromArg) ? fromArg : cellCenter(fromArg);
  const p0 = svgToScreen(from[0], from[1]), p1 = svgToScreen(target[0], target[1]);
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div'); c.className = 'coin'; c.innerHTML = '<i>¥</i>';
    c.style.left = p0[0] + 'px'; c.style.top = p0[1] + 'px';
    $('fxLayer').appendChild(c);
    const dx = p1[0] - p0[0] + rnd(-10, 10), dy = p1[1] - p0[1] + rnd(-8, 8);
    st(() => {
      c.style.transition = 'transform .7s cubic-bezier(.35,-0.25,.65,1), opacity .18s .55s';
      c.style.transform = `translate(${dx}px,${dy}px) scale(.8)`;
      setTimeout(() => { c.style.opacity = 0; }, 560);
      setTimeout(() => c.remove(), 780);
    }, i * 110);
  }
}
const playerPt = pid => { const pos = playerCell(pid); return cellCenter(pos); };
function shakePlayer(pid) {
  const el = document.querySelector(`[data-pid="${pid}"]`);
  if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
}
function toast(msg) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; $('fxLayer').appendChild(d); setTimeout(() => d.remove(), 2300); }
function dustAt(cell) {
  const [cx, cy] = cellCenter(cell);
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('cx', cx); c.setAttribute('cy', cy + 6); c.setAttribute('r', 7);
  c.setAttribute('fill', 'none'); c.setAttribute('stroke', '#b9a98a'); c.setAttribute('stroke-width', 2);
  c.setAttribute('class', 'dust');
  $('board').appendChild(c);
  setTimeout(() => c.remove(), 550);
}
// v5.0 续：脚步金光 —— 棋子每跳一格，原地留下一圈金环
function trailAt(cell, r) {
  const [cx, cy] = cellCenter(cell);
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('cx', cx); c.setAttribute('cy', cy + 6); c.setAttribute('r', r || 8);
  c.setAttribute('fill', 'none'); c.setAttribute('stroke', '#ffcf63'); c.setAttribute('stroke-width', 2.6);
  c.setAttribute('class', 'dust');
  $('board').appendChild(c);
  setTimeout(() => c.remove(), 560);
}
// v5.3：骰子落定涟漪 —— 替代原先「整个屏幕晃一下」的 shakeBoard()。
// 以骰子落点为圆心画 3 圈扩散光环 + 一圈地面压痕，纯局部动效，不动整屏。
function diceRipple(box) {
  if (!box || !box.parentNode) return;
  for (let i = 0; i < 3; i++) {
    const r = document.createElement('i');
    r.className = 'dice-ripple';
    r.style.animationDelay = (i * 0.09).toFixed(2) + 's';
    r.style.width = r.style.height = (54 + i * 16) + 'px';
    box.appendChild(r);
    setTimeout(() => r.remove(), 1000 + i * 100);
  }
  const fl = document.createElement('i');
  fl.className = 'dice-flare';
  box.appendChild(fl);
  setTimeout(() => fl.remove(), 700);
}
function confettiBurst(count) {
  const cv = $('confetti'), ctx = cv.getContext('2d');
  cv.width = cv.offsetWidth; cv.height = cv.offsetHeight;
  const parts = Array.from({ length: count || 130 }, () => ({
    x: cv.width / 2 + rnd(-60, 60), y: cv.height / 2, vx: rnd(-6, 6), vy: rnd(-11, -4),
    c: pick(['#e8b04b', '#7a1522', '#43A047', '#1E88E5', '#F48FB1']), s: rnd(4, 9), life: rnd(50, 90),
  }));
  let frames = 0;
  (function loop() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.life--; ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, p.life / 90); ctx.fillRect(p.x, p.y, p.s, p.s); });
    if (++frames < 95) requestAnimationFrame(loop); else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

// ==================== v5.0 续·二：场景专属特效引擎 ====================
// 一张覆盖在棋盘上的 canvas，承担 盖房 / 拆房 / 抽卡 / 对决 / 垄断 / 收租 / 破产 等场景的粒子特效。
// 用 canvas 而不是几十个 DOM/SVG 节点：同样的观感，性能开销几乎为零，也不会污染棋盘 SVG 层。
let fx2Cv = null, fx2Ctx = null, fx2RAF = 0, fx2Parts = [];
function fxCanvas() {
  const wrap = $('boardWrap'); if (!wrap) return null;
  if (!fx2Cv) {
    fx2Cv = document.createElement('canvas');
    fx2Cv.id = 'fxCanvas';
    fx2Cv.style.cssText = 'position:absolute;inset:0;z-index:9;pointer-events:none;';
    wrap.appendChild(fx2Cv);
  }
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (fx2Cv.width !== w || fx2Cv.height !== h) { fx2Cv.width = w; fx2Cv.height = h; }
  else if (!fx2Parts.length && !fx2RAF) { /* 保持上一帧即可 */ }
  fx2Ctx = fx2Cv.getContext('2d');
  fx2Cv.style.display = 'block';
  return fx2Ctx;
}
// 棋盘坐标 → 画布局部坐标（fxLayer/fxCanvas 与 boardWrap 同尺寸）
function svgToLocal(x, y) {
  const svg = $('board'), wrap = $('boardWrap');
  const r = svg.getBoundingClientRect(), w = wrap.getBoundingClientRect();
  const sc = r.width / svg.viewBox.baseVal.width;
  return [r.left - w.left + x * sc, r.top - w.top + y * sc];
}
// 发射一团粒子。o = { kind, color, n, speed, gravity, life, size, dir, lift, wave }
//   kind: 'spark' 火星线条 ｜ 'star' 四芒星 ｜ 'shard' 碎块(带重力/旋转) ｜ 'coin' 金币 ｜ 'petal' 花瓣
function fxBurst(cellOrPt, o) {
  const ctx = fxCanvas(); if (!ctx) return;
  const [cx, cy] = Array.isArray(cellOrPt) ? cellOrPt : cellCenter(cellOrPt);
  const [px, py] = svgToLocal(cx, cy);
  o = o || {};
  const n = o.n || 14, base = o.color || '#e8b04b';
  for (let i = 0; i < n; i++) {
    const a = (o.dir != null) ? o.dir + rnd(-0.55, 0.55) : (i / n) * Math.PI * 2 + rnd(-0.28, 0.28);
    const sp = (o.speed || 3) * rnd(0.6, 1.45);
    fx2Parts.push({
      k: o.kind || 'spark',
      x: px + rnd(-4, 4), y: py + rnd(-4, 4),
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.lift || 0),
      g: o.gravity == null ? 0.17 : o.gravity,
      life: Math.round((o.life || 46) * rnd(0.72, 1.3)), age: 0,
      c: Array.isArray(base) ? base[i % base.length] : base,
      s: (o.size || 3) * rnd(0.7, 1.4),
      rot: rnd(0, 6.28), vr: rnd(-0.3, 0.3),
    });
  }
  if (o.wave) fx2Parts.push({ k: 'ring', x: px, y: py, vx: 0, vy: 0, g: 0, s: o.wave.r || 62, life: o.wave.life || 40, age: 0, c: o.wave.color || base, rot: 0, vr: 0 });
  if (!fx2RAF) { if (fx2Cv) fx2Cv.style.display = 'block'; fx2RAF = requestAnimationFrame(fx2Loop); }
}
// 打点：从 A 点朝 B 点方向撒一串粒子（擂台对决、金币飞行等）
function fxSprayTo(fromCell, toCell, o) {
  const [ax, ay] = Array.isArray(fromCell) ? fromCell : cellCenter(fromCell);
  const [bx, by] = Array.isArray(toCell) ? toCell : cellCenter(toCell);
  fxBurst([(ax + bx) / 2, (ay + by) / 2], Object.assign({ dir: Math.atan2(ay - by, ax - bx), n: 12, speed: 5, gravity: 0.05, life: 34 }, o || {}));
}
function fx2Loop() {
  const cv = fx2Cv;
  if (!cv || !fx2Ctx) { fx2RAF = 0; return; }
  const ctx = fx2Ctx, W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  for (let i = fx2Parts.length - 1; i >= 0; i--) {
    const p = fx2Parts[i];
    p.age++;
    const t = p.age / p.life;
    if (t >= 1) { fx2Parts.splice(i, 1); continue; }
    const a = 1 - t * t;
    if (p.k === 'ring') {
      const r = p.s * (0.18 + 0.95 * t);
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = p.c; ctx.lineWidth = 5 * (1 - t) + 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.284); ctx.stroke();
      continue;
    }
    p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    ctx.globalAlpha = a;
    if (p.k === 'spark') {
      ctx.strokeStyle = p.c; ctx.lineWidth = p.s * 0.75; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2.4, p.y - p.vy * 2.4); ctx.stroke();
    } else if (p.k === 'star') {
      const L = p.s * 2.6;
      ctx.strokeStyle = p.c; ctx.lineWidth = p.s * 0.62; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x - L, p.y); ctx.lineTo(p.x + L, p.y);
      ctx.moveTo(p.x, p.y - L); ctx.lineTo(p.x, p.y + L);
      ctx.stroke();
    } else if (p.k === 'shard') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s, -p.s * 0.55, p.s * 2, p.s * 1.1);
      ctx.restore();
    } else if (p.k === 'coin') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 6.284); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(-p.s * 0.25, -p.s * 0.25, p.s * 0.4, 0, 6.284); ctx.fill();
      ctx.restore();
    } else { // petal
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, p.s * 1.4, p.s * 0.62, 0, 0, 6.284); ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  if (fx2Parts.length) fx2RAF = requestAnimationFrame(fx2Loop);
  else { fx2RAF = 0; ctx.clearRect(0, 0, W, H); }
}
// 金币雨（垄断达成 / 领基金池）
function fxCoinRain(n, opts) {
  const wrap = $('boardWrap'); if (!wrap) return;
  const ctx = fxCanvas(); if (!ctx) return;
  const w = wrap.clientWidth;
  for (let i = 0; i < (n || 26); i++) {
    fx2Parts.push({
      k: 'coin', x: rnd(w * 0.08, w * 0.92), y: rnd(-90, -10), vx: rnd(-0.5, 0.5), vy: rnd(3.2, 5.4),
      g: 0.06, s: rnd(3.4, 6.4), life: rnd(90, 140), age: 0, c: pick(['#e8b04b', '#f5d071', '#d9a83c']),
      rot: rnd(0, 6.28), vr: rnd(-0.16, 0.16), ...(opts || {}),
    });
  }
  if (!fx2RAF) fx2RAF = requestAnimationFrame(fx2Loop);
}
// 全屏彩色一闪（盖房/对决/垄断/破产各用自己的颜色）
let flashEl = null;
function flashScreen(color, ms) {
  const wrap = $('boardWrap'); if (!wrap) return;
  if (!flashEl) { flashEl = document.createElement('div'); flashEl.className = 'screen-flash'; wrap.appendChild(flashEl); }
  flashEl.style.background = color;
  flashEl.classList.remove('on'); void flashEl.offsetWidth; flashEl.classList.add('on');
  setTimeout(() => { if (flashEl) flashEl.classList.remove('on'); }, ms || 430);
}
// 一组格子同时脉冲（垄断：同色 3 所一起亮）
function pulseGroup(cells, color) { (cells || []).forEach((c, k) => setTimeout(() => pulseCell(c, color), k * 130)); }

// ---------- 渲染 ----------
// render：动画相关（棋子/建筑）即时更新；面板交给 renderPanel（内部按 animPending 决定按钮是否出现）
function render(state) {
  const s = state || S; if (!s) return;
  if (!boardBuilt) buildBoard();
  applyWeather(dispReady ? dispWeather : s.weather);
  // 动画队列排空时把显示态与服务端对齐（重连 / 兜底，防止增量丢失造成长偏差）
  if (animPending === 0 && qDepth === 0) syncDisp(s);
  // 空闲时与服务端日志对齐（重连/首帧兜底）；动画播放中保持本地进度，避免剧透后面的动画
  if (animPending === 0 && Array.isArray(s.log) && s.log.length) {
    if (s.log[s.log.length - 1].msg !== visLog[visLog.length - 1]) { visLog = s.log.map(l => l.msg); logRendered = 0; logForce = true; }
  }
  renderBuildings(s);
  renderTokens(s);
  renderPanel(s);
}
// 面板：回合横幅、玩家现金、行动按钮、资产、日志、中央信息——只在动画队列清空时刷新
let playersSig = '';
function renderPanel(s) {
  if (!s) s = S; if (!s) return;
  const newBanner = turnText(s);
  const tb = $('turnBanner');
  if (tb.textContent !== newBanner) {
    tb.textContent = newBanner;
    tb.classList.remove('flash'); void tb.offsetWidth; tb.classList.add('flash');
  }
  const pSig = s.phase + '|' + s.cur + '|' + s.players.map(p => p.id + ',' + dcash(p) + ',' + (p.alive ? 1 : 0) + ',' + (p.combo || 0) + ',' + (p.skillLeft || 0) + ',' + (p.skipNext ? 1 : 0) + ',' + p.major + ',' + (p.voice ? 1 : 0) + ',' + (p.medal || 0) + ',' + (p.buffSteps || 0) + ',' + ((p.stepBuffs || []).length) + ',' + (p.stayFree || 0) + ',' + (p.invest ? p.invest.due : 0)).join(';');
  if (pSig !== playersSig) {
    playersSig = pSig;
    $('players').innerHTML = s.players.map(p => {
      const mj = MAJORS[p.major] || {};
      const aliveN = s.players.filter(q => q.alive).length;
      const cb = (p.combo >= 2) ? `<span class="tag" style="background:#ffe0b2;color:#a35b00">🔥×${p.combo}</span>` : '';
      const sk = (mj.id && p.skillLeft > 0 && p.alive && aliveN > 1) ? `<span class="tag" style="background:#e3f0ff;color:#2a6bb5">技${p.skillLeft}</span>` : '';
      const mc = p.voice ? `<span class="vmic on" data-vmic="${p.id}">🎤</span>` : '';
      const md = p.medal > 0 ? `<span class="tag" style="background:#fff3c4;color:#8a6d1a">🎫 免租金卡</span>` : '';
      const bf = p.buffSteps > 0 ? `<span class="tag" style="background:#fff3d6;color:#a06800">🍂+${p.buffSteps}</span>` : '';
      const bq = (p.stepBuffs && p.stepBuffs.length) ? `<span class="tag" style="background:#e9f6ec;color:#1d6b40">👟×${p.stepBuffs.length}</span>` : '';
      const iv = p.invest ? `<span class="tag" style="background:#e8eaf6;color:#3949ab" title="科研投资：第 ${p.invest.due} 轮返还 ¥${p.invest.back}">🔬${p.invest.due}</span>` : '';
      const sf = p.stayFree > 0 ? `<span class="tag" style="background:#d8f7ec;color:#12795c" title="免停留卡：可免除一次纯惩罚性停留">🎯 免停留×${p.stayFree}</span>` : '';
      return `
    <div class="pcard ${p.id === s.players[s.cur].id && s.phase !== 'over' ? 'active' : ''} ${!p.alive ? 'dead' : ''}" data-pid="${p.id}">
      <span class="dot" style="background:${p.color}"></span>
      ${mc}
      <span class="pname">${esc(p.name)}${p.id === myPid ? ' <span class="tag">你</span>' : ''}${p.isAI ? '<span class="tag">AI</span>' : ''}${p.skipNext ? '<span class="tag">停留</span>' : ''}${mj.id ? `<span class="tag">${mj.icon}${esc(mj.name)}</span>` : ''}${sk}${cb}${md}${sf}${bf}${bq}${iv}</span>
      <span class="cash">¥${dcash(p)}</span>
    </div>`;
    }).join('');
    paintSpeaking();
  }
  // 行动区：动画还在播时只显示占位，播完立刻出现按钮（下面信息已随动画同步刷新）
  if (animPending > 0) { actionsSig = null; $('actionArea').innerHTML = '<div class="panel" style="text-align:center;color:#9a938a;font-size:13px">⏳ 稍等，正在结算…</div>'; }
  else renderActions(s);
  renderAssets(s);
  renderGhost(s);   // v5.1：重投阶段的落点虚影（跟着动画队列一起出现/消失）
  renderLog();
  const pool = $('poolText'); if (pool) pool.textContent = `💰 教育基金池 ¥${s.fundPool}`;
  const rt = $('roundText');
  if (rt) rt.textContent = `第 ${s.round} 轮 · ${s.players.filter(p => p.alive).length} 人在场` + (s.phase === 'roll' ? ` · 轮到 ${s.players[s.cur].name}` : '');
  const szEl = $('seasonText');
  if (szEl) {
    const SZ = SEASON[dispSeason] || {};
    szEl.textContent = `${SZ.icon || ''} ${SZ.name || ''}　收租×${SZ.rentMul} · 建造×${SZ.buildMul}`;
    szEl.setAttribute('fill', SZ.color || '#8a6d1a');
  }
  const wEl = $('weatherText');
  if (wEl) {
    const W = WEATHER[dispWeather] || {};
    wEl.textContent = `${W.icon || ''} ${W.name || ''}　${W.desc ? '今日' + W.desc : ''}`;
  }
  const ct = $('calText');
  if (ct) ct.textContent = dispCal ? `${dispCal.icon} 校历【${dispCal.name}】${dispCal.desc}` : '';
  if ($('facBadge')) renderFacultyBadge(false);   // v5.2：地图中央的常驻校园风貌徽章
  if (s.phase === 'over') showGameOver(s);
}
// 日志区单独渲染（聊天行高亮）——增量追加，滚动到底，DOM 上限 240 行
function logLine(m) {
  const d = document.createElement('div');
  if (m.indexOf('💬') === 0) d.className = 'log-chat';
  d.textContent = m;
  return d;
}
function renderLog() {
  const lb = $('logBox'); if (!lb) return;
  if (logForce || logRendered > visLog.length) { lb.innerHTML = ''; logRendered = 0; logForce = false; }
  if (logRendered === visLog.length) return;   // 无新增就不动 DOM、不强制重排
  if (logRendered === 0) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < visLog.length; i++) frag.appendChild(logLine(visLog[i]));
    lb.appendChild(frag);
  } else {
    const frag = document.createDocumentFragment();
    for (let i = logRendered; i < visLog.length; i++) frag.appendChild(logLine(visLog[i]));
    lb.appendChild(frag);
  }
  logRendered = visLog.length;
  while (lb.childNodes.length > 240) lb.removeChild(lb.firstChild);
  lb.scrollTop = 1e6;
}
function turnText(s) {  if (s.phase === 'lobby') return '等待开始…';
  if (s.phase === 'over') return '游戏结束';
  const cur = s.players[s.cur];
  const isMe = cur.id === myPid;
  if (s.phase === 'roll') return isMe ? `轮到你掷骰子了，${cur.name}！` : `等待 ${cur.name} 掷骰…`;
  if (s.phase === 'reroll') return isMe ? `掷出 ${s.dice ? s.dice[0] + '+' + s.dice[1] : '?'}，要花钱重投吗？` : `${cur.name} 在考虑要不要重投…`;
  if (s.phase === 'buy') return isMe ? `要买下这块地吗？` : `${cur.name} 正在决定…`;
  if (s.phase === 'build') return isMe ? `要升级你的地产吗？` : `${cur.name} 正在决定…`;
  if (s.phase === 'auction') return `拍卖进行中！`;
  if (s.phase === 'raise') return isMe ? `现金不足！快抵押筹钱` : `${cur.name} 正在筹钱…`;
  if (s.phase === 'branch') return isMe ? (s.pendingBranch && s.pendingBranch.line === 'B' ? `要闯创业大道吗？` : `要进学术长廊吗？`) : `${cur.name} 站在岔路口犹豫…`;
  if (s.phase === 'invest') return isMe ? `要投一笔科研经费吗？` : `${cur.name} 正在考虑科研投资…`;
  if (s.phase === 'skill') {
    const key = (s.pendingSkill && s.pendingSkill.key) || cur.major;
    const mj = MAJORS[key] || {};
    return isMe ? `是否发动【${mj.skill || '专业技能'}】？` : `${cur.name} 正在考虑发动【${mj.skill || '技能'}】…`;
  }
  return `第 ${s.round} 轮`;
}
let tokSig = '';
// v5.1：重投询问阶段的「落点虚影」——在地图上把"这一走会落到哪一格"标出来，全场可见
let ghostSig = '';
function renderGhost(s) {
  const board = $('board'); if (!board || !s) return;
  const pr = s.pendingReroll;
  const on = (animPending === 0) && s.phase === 'reroll' && !!pr && pr.target != null;
  const sig = on ? (pr.pid + '|' + pr.target + '|' + pr.steps) : 'off';
  if (sig === ghostSig) return;
  ghostSig = sig;
  board.querySelectorAll('.ghost').forEach(el => el.remove());
  if (!on) return;
  const i = pr.target;
  const isBr = !!BRANCH_POS[i];
  const [x, y] = isBr ? [BRANCH_POS[i][0] - BR_W / 2, BRANCH_POS[i][1] - BR_H / 2] : CELLXY(i);
  const w = isBr ? BR_W : CW, h = isBr ? BR_H : CH;
  const ly = (y < 32) ? y + h + 20 : y - 11;
  const who = (s.players.find(q => q.id === pr.pid) || {}).name || '';
  const pc = (s.players.find(q => q.id === pr.pid) || {}).color || '#e8b04b';
  // v5.4：虚影大幅加深——浓底 + 发光描边 + 四角瞄准框 + 玩家色脉冲圆点，全场都能看清
  const corners = [[x + 3, y + 3, 1, 1], [x + w - 3, y + 3, -1, 1], [x + 3, y + h - 3, 1, -1], [x + w - 3, y + h - 3, -1, -1]]
    .map(([cx, cy, dx, dy]) => `<path d="M ${cx} ${cy + dy * 22} L ${cx} ${cy} L ${cx + dx * 22} ${cy}" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".95"/>`).join('');
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', 'ghost');
  g.innerHTML =
    // 浓底色填充（比 v5.3 加深一倍）
    `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" rx="12" fill="rgba(255,158,44,.48)"/>`
    // 内层暖光渐变，营造"高亮聚光"感
    + `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" rx="12" fill="rgba(255,220,120,.30)"/>`
    // 主描边：加粗 + 流动虚线
    + `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" rx="12" fill="none" stroke="#ff8c1a" stroke-width="5" stroke-dasharray="14 8">`
    + `<animate attributeName="opacity" values="0.65;1;0.65" dur="0.85s" repeatCount="indefinite"/></rect>`
    + `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" rx="12" fill="none" stroke="#fff3d6" stroke-width="1.6" opacity=".8"/>`
    // 四角瞄准框
    + corners
    // 落点中心：玩家色脉冲圆点（是谁的落点一目了然）
    + `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="17" fill="${pc}" opacity=".55">`
    + `<animate attributeName="r" values="11;21;11" dur="0.95s" repeatCount="indefinite"/></circle>`
    + `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="6.5" fill="#fff" opacity=".92"/>`
    // 标签：加大加深
    + `<text x="${x + w / 2}" y="${ly}" text-anchor="middle" font-size="19" font-weight="900" fill="#7c3f00" style="paint-order:stroke;stroke:rgba(255,255,255,.95);stroke-width:4.5px">`
    + `👻 ${esc(who)} 预计落点 · ${pr.steps} 步</text>`;
  board.appendChild(g);
}
function renderTokens(s) {
  const layer = $('tokenLayer');
  if (animPending > 0) return;   // 动画播放中冻结棋子重建，防止瞬移
  // 位置/在场/当前行动者都没变就不重建（moveAnim 收尾时已把棋子放在正确格上）
  let sig = s.phase + '|' + s.cur + '|';
  for (const p of s.players) sig += p.id + (p.alive ? p.pos : 'x') + p.color + ';';
  if (sig === tokSig) return;
  tokSig = sig;
  Object.values(tokenEls).forEach(t => t.remove()); tokenEls = {};
  // 清掉旧的高亮光环
  layer.querySelectorAll('.halo').forEach(h => h.remove());
  const byCell = {};
  s.players.filter(p => p.alive).forEach(p => { (byCell[p.pos] = byCell[p.pos] || []).push(p); });
  // 当前行动者光环（v5.3：双环 + 外圈旋转虚线，比原来一圈实线更醒目）
  if (s.phase !== 'over' && s.phase !== 'lobby' && s.players[s.cur] && s.players[s.cur].alive) {
    const cur = s.players[s.cur];
    const [hx, hy] = cellCenter(cur.pos);
    for (const [r, w, cls, col, dash] of [[30, 2.4, 'halo halo-dash', '#e8b04b', '9 7'], [24, 4, 'halo', cur.color || '#e8b04b', '']]) {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', hx); c.setAttribute('cy', hy); c.setAttribute('r', r);
      c.setAttribute('fill', 'none'); c.setAttribute('stroke', col); c.setAttribute('stroke-width', w);
      if (dash) c.setAttribute('stroke-dasharray', dash);
      c.setAttribute('class', cls);
      c.style.transformOrigin = `${hx}px ${hy}px`;
      layer.appendChild(c);
    }
  }
  for (const p of s.players.filter(p => p.alive)) {
    const idx = byCell[p.pos].indexOf(p);
    const [cx, cy] = cellCenter(p.pos);
    const off = byCell[p.pos].length > 1 ? [[-20, -20], [20, -20], [-20, 20], [20, 20], [0, 0]][idx % 5] : [0, 0];
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${cx + off[0]},${cy + off[1]})`);
    const active = s.phase !== 'over' && s.players[s.cur] && s.players[s.cur].id === p.id;
    // v5.3：棋子加了外发光圈与更立体的投影，颜色更跳
    g.innerHTML = `<ellipse cy="16" rx="18" ry="7" fill="rgba(60,45,20,.36)"/>`
      + `<circle r="22.6" fill="none" stroke="${p.color}" stroke-width="3" opacity=".38"/>`
      + `<circle r="19" fill="${p.color}" stroke="#fff" stroke-width="4" class="${active ? 'tok-breathe' : ''}"/>`
      + `<circle cx="-6" cy="-6.6" r="7.4" fill="rgba(255,255,255,.6)"/>`
      + `<text y="6.6" text-anchor="middle" font-size="16" fill="#fff" font-weight="700" style="paint-order:stroke;stroke:rgba(0,0,0,.25);stroke-width:2.8px">${esc(p.name.slice(0, 1))}</text>`;
    layer.appendChild(g);
    tokenEls[p.id] = g;
  }
}
// 小房子图标：屋顶 + 屋身，用玩家颜色，白描边保证在色带上醒目
function houseSvg(x, y, s, color) {
  return `<path d="M${x} ${y + s * 0.5} L${x + s * 0.5} ${y + s * 0.05} L${x + s} ${y + s * 0.5} Z" fill="${color}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`
    + `<rect x="${x + s * 0.16}" y="${y + s * 0.46}" width="${s * 0.68}" height="${s * 0.5}" rx="${s * 0.12}" fill="${color}" stroke="#fff" stroke-width="1.5"/>`
    + `<rect x="${x + s * 0.4}" y="${y + s * 0.66}" width="${s * 0.2}" height="${s * 0.3}" rx="1" fill="rgba(255,255,255,.85)"/>`;
}
// 旅馆图标：更宽的楼体 + 一排小窗 + 屋顶旗
function hotelSvg(x, y, w, h, color) {
  let win = '';
  for (let k = 0; k < 3; k++) win += `<rect x="${x + 4 + k * (w - 8) / 3}" y="${y + h * 0.44}" width="${(w - 8) / 4.2}" height="${h * 0.3}" rx="1" fill="rgba(255,255,255,.9)"/>`;
  return `<path d="M${x} ${y + h * 0.34} L${x + w / 2} ${y} L${x + w} ${y + h * 0.34} Z" fill="${color}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`
    + `<rect x="${x}" y="${y + h * 0.3}" width="${w}" height="${h * 0.7}" rx="2" fill="${color}" stroke="#fff" stroke-width="1.5"/>${win}`;
}
let buildSig = '';
function renderBuildings(s) {
  // 归属/建筑没变就跳过：避免每次事件都重建 40 个 SVG 分组（主要卡顿来源）
  let sig = '';
  for (let i = 0; i < 48; i++) { const c = dcell(i); sig += (c.own || '-') + ',' + (c.level || 0) + ',' + (c.mortgaged ? 1 : 0) + ';'; }
  if (sig === buildSig) return;
  buildSig = sig;
  Object.values(buildEls).forEach(t => t.remove()); buildEls = {};
  for (let i = 0; i < BOARD.length; i++) {
    const cs = dcell(i);
    const tp = BOARD[i].type;
    if (tp !== 'prop' && tp !== 'transport' && tp !== 'util') continue;
    const [x, y] = CELLXY(i);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    let inner = '';
    if (cs.own) {
      const owner = s.players.find(p => p.id === cs.own);
      const oc = owner ? owner.color : '#888';
      const e = innerEdge(i);
      // 地皮归属色条（地主颜色，加白描边更醒目）
      inner += `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="2.5" fill="${oc}" stroke="rgba(255,255,255,.9)" stroke-width="1"/>`;
      // 房屋 / 旅馆：v5.1 放大更醒目，并挪到「色带与校名之间」的空档，不再压住价格
      if (!cs.mortgaged && tp === 'prop' && cs.level > 0) {
        if (cs.level < 4) {
          const s2 = 17, gap = 3, n = cs.level;   // 4 栋时 4×17+3×3 = 77 < 85
          const total = n * s2 + (n - 1) * gap;
          let hx = x + CW / 2 - total / 2;
          for (let k = 0; k < n; k++) { inner += houseSvg(hx, y + 21, s2, oc); hx += s2 + gap; }
        } else {
          const w = 60, h = 19;
          inner += hotelSvg(x + CW / 2 - w / 2, y + 20, w, h, oc);
        }
      }
    }
    if (cs.mortgaged) {
      inner += `<rect x="${x}" y="${y}" width="${CW}" height="${CH}" rx="9" fill="rgba(120,115,105,.42)"/>`;
      const [cx, cy] = cellCenter(i);
      inner += `<text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="16">🔒</text>`;
    }
    if (!inner) continue;   // 无归属也无建筑：不生成空节点
    g.innerHTML = inner;
    $('ownLayer').appendChild(g); buildEls['g' + i] = g;
  }
}
function innerEdge(i) {
  const [x, y] = CELLXY(i);
  // 环形方格：归属色条贴格子左侧内边，竖向展示
  return { x: x + 2, y: y + 18, w: 6, h: CH - 26 };
}
let actionsSig = null;
function renderActions(s) {
  const area = $('actionArea');
  const me = s.players.find(p => p.id === myPid);
  const pb0 = s.pendingBuy, pbd0 = s.pendingBuild, au0 = s.auction, rs0 = s.raise, pm0 = s.pendingMedal, pr0 = s.pendingReroll, pbr0 = s.pendingBranch, pin0 = s.pendingInvest, psk0 = s.pendingSkill;
  // 按钮内容只由这些字段决定：没变就不重建 DOM（避免每个事件都重排一次带 onclick 的按钮）
  const key = [s.phase, s.cur, s.season, myPid, me ? dcash(me) : '-', me && me.alive ? 1 : 0,
    me && me.discount ? 1 : 0, me && me.shield ? 1 : 0,
    pb0 ? pb0.cell + ':' + pb0.price + ':' + (pb0.base || 0) + ':' + (pb0.mortgageBuy ? 1 : 0) : '-',
    pbd0 ? pbd0.cell + ':' + (pbd0.cost || 0) : '-',
    pm0 ? pm0.price : '-', pr0 ? pr0.pid + ':' + (pr0.target == null ? '-' : pr0.target) : '-',
    pbr0 ? pbr0.pid + (pbr0.line || 'A') : '-', pin0 ? pin0.pid : '-',
    psk0 ? psk0.pid + ':' + psk0.key : '-',
    au0 ? au0.cell + ':' + au0.highest + ':' + au0.bidder : '-',
    rs0 ? rs0.need : '-', s.vote ? JSON.stringify(s.vote.votes) : '-'].join('|');
  const myVoteKnown = s.vote && s.vote.votes[myPid] !== undefined;
  const showVote = !!(s.vote && !myVoteKnown);
  const key2 = key + '|v' + (showVote ? 1 : 0);
  if (key2 === actionsSig) return;
  actionsSig = key2;
  if (!me || !me.alive) { area.innerHTML = s.phase === 'over' ? '' : '<div class="panel" style="text-align:center"><b>👀 你已出局，观战中…</b><br><span style="font-size:12.5px;color:#8a847a">仍可用下方表情/快捷语音/聊天框和麦克风与大家互动</span></div>'; return; }
  const isMe = s.players[s.cur].id === myPid;
  let html = '';
  if (s.phase === 'roll' && isMe) {
    const shieldCost = shieldCostAt(s.round);   // 与服务端 shieldCost() 一致：分段随轮数涨价
    const ib = k => {
      const it = ITEMS[k];
      const cost = k === 'shield' ? shieldCost : it.cost;
      return `<button class="btn small" title="${it.desc || ''}" ${me.cash >= cost ? '' : 'disabled'} onclick="act({type:'item',item:'${k}'})">${it.icon} ${it.name} ¥${cost}</button>`;
    };
    html = `<button class="btn primary big" onclick="act({type:'roll'})">🎲 掷骰子</button>
      <div class="btn-row" style="margin-top:8px">${ib('shield')}<button class="btn small" onclick="act({type:'voteEnd'})">🤝 发起结束</button></div>
      <div style="font-size:12px;color:#9a938a;margin-top:6px">💡 🛡️ 免罚符仅本回合有效、价格随轮数上涨；掷骰后可花 ¥${REROLL_COST} 重投一次（每回合限一次）</div>`;
  }
  else if (s.phase === 'reroll' && s.pendingReroll && s.pendingReroll.pid === myPid) {
    const d = s.dice || [0, 0];
    const tgt = s.pendingReroll.target;
    const tname = (tgt != null && BOARD[tgt]) ? BOARD[tgt].name : '';
    html = `<div class="panel"><b>🎲 重掷机会</b><br><span style="font-size:13px;color:#8a847a">本回合掷出 ${d[0]} + ${d[1]} = ${d[0] + d[1]}。花 ¥${s.pendingReroll.cost} 重投一次，换个点数？（每回合限用一次）</span>${tgt != null ? `<br><span style="font-size:13px;color:#a8761a">👻 按现在的点数会落到「${esc(tname)}」（地图上已用虚影标出，所有人都能看到）</span>` : ''}</div>
      <div class="btn-row" style="margin-top:8px"><button class="btn primary" onclick="act({type:'confirmRoll'})">就这样走</button><button class="btn small subtle" ${me.cash >= s.pendingReroll.cost ? '' : 'disabled'} onclick="act({type:'reroll'})">🎲 重投一次 ¥${s.pendingReroll.cost}</button></div>`;
  }
  else if (s.phase === 'branch' && s.pendingBranch && s.pendingBranch.pid === myPid) {
    if (s.pendingBranch.line === 'B') {
      html = `<div class="panel"><b>🚀 创业大道</b><br><span style="font-size:13px;color:#8a847a">创业孵化器、毕业跳蚤市场、国际交流站……全是高风险高回报的格子。走到出口「校企合作中心」能领 ¥2000 现金，但要在里面学习 1 回合，之后沿主路线继续。</span></div>
        <div class="btn-row" style="margin-top:8px"><button class="btn primary" onclick="act({type:'enterBranch'})">🏫 进支线</button><button class="btn" onclick="act({type:'declineBranch'})">走大路</button></div>`;
    } else {
      html = `<div class="panel"><b>🎓 学术长廊</b><br><span style="font-size:13px;color:#8a847a">长廊里有科研基金处、教授工作室、奖学金长廊等外圈没有的特殊格。走到出口「校史馆」能领 1 张免租金卡，但要在校史馆学习 1 回合，之后沿主路线继续。</span></div>
        <div class="btn-row" style="margin-top:8px"><button class="btn primary" onclick="act({type:'enterBranch'})">🌿 进岔路</button><button class="btn" onclick="act({type:'declineBranch'})">走大路</button></div>`;
    }
  }
  else if (s.phase === 'skill' && s.pendingSkill && s.pendingSkill.pid === myPid) {
    const psk = s.pendingSkill;
    const mj = MAJORS[psk.key] || {};
    html = `<div class="panel skill-ask" style="border-color:${mj.fx || '#4a90d9'}">
        <b>${mj.icon || '✨'} 是否发动【${esc(mj.skill || '专业技能')}】？</b><br>
        <span style="font-size:13px;color:#8a847a">${esc(mj.desc || '')}<br>剩余次数：${me.skillLeft} 次</span></div>
      <div class="btn-row" style="margin-top:8px"><button class="btn primary" onclick="act({type:'useSkill'})">✨ 发动</button><button class="btn" onclick="act({type:'skipSkill'})">先留着</button></div>`;
  }
  else if (s.phase === 'invest' && s.pendingInvest && s.pendingInvest.pid === myPid) {
    const pi = s.pendingInvest;
    html = `<div class="panel"><b>🔬 科研投资所</b><br><span style="font-size:13px;color:#8a847a">投入 ¥${pi.cost}，${pi.rounds} 轮后返还 ¥${pi.back}（稳赚 ¥${pi.back - pi.cost}，但期间现金会被占用）${me.invest ? '<br>你已有一笔投资在途，到期后才能再投' : ''}</span></div>
      <div class="btn-row" style="margin-top:8px"><button class="btn primary" ${me.cash >= pi.cost && !me.invest ? '' : 'disabled'} onclick="act({type:'buyInvest'})">🔬 投资</button><button class="btn" onclick="act({type:'declineInvest'})">不投</button></div>`;
  }
  else if (s.phase === 'buy' && s.pendingBuy && s.pendingBuy.pid === myPid) {
    const pb = s.pendingBuy, c = BOARD[pb.cell];
    const SZn = (SEASON[s.season] || {}).name || '';
    const baseTxt = (!pb.mortgageBuy && pb.base && pb.base !== c.price) ? `（${SZn}价 ¥${pb.base}）` : '';
    html = `<div class="panel"><b>${esc(c.name)}</b><br><span style="font-size:13px;color:#8a847a">${pb.mortgageBuy ? `抵押地！可以 ¥${pb.price} 直接买走并解除抵押` : `买入价 ¥${pb.price}${baseTxt}${me.discount ? '（已含8折）' : ''}`}</span></div>
      <div class="btn-row" style="margin-top:8px"><button class="btn primary" onclick="act({type:'buy'})">✅ 买下</button><button class="btn" onclick="act({type:'decline'})">${pb.mortgageBuy ? '不买' : '进入拍卖'}</button></div>`;
  } else if (s.phase === 'build' && s.pendingBuild && s.pendingBuild.pid === myPid) {
    const pb = s.pendingBuild, cs = s.cells[pb.cell], c = BOARD[pb.cell];
    const hotel = cs.level === 3;
    const cost = (pb.cost != null) ? pb.cost : buildCost(c.g);
    const meNow = s.players.find(p => p.id === myPid);
    const short = meNow && meNow.cash < cost;
    html = `<div class="panel"><b>${esc(c.name)}</b><br><span style="font-size:13px;color:#8a847a">升级 Lv${cs.level} → ${hotel ? '🏨 旅馆' : 'Lv' + (cs.level + 1)}，花费 ¥${cost}</span></div>
      ${short ? `<div style="font-size:12px;color:#b0611e;margin-top:6px">💡 钱不够？可先在下方「我的资产」抵押其他地产筹钱，再回来升级</div>` : ''}
      <div class="btn-row" style="margin-top:8px"><button class="btn primary" onclick="act({type:'build'})">🏗️ 升级</button><button class="btn" onclick="act({type:'skipBuild'})">不建</button></div>`;
  } else if (s.phase === 'auction') {
    const a = s.auction, c = BOARD[a.cell];
    html = `<div class="panel"><b>拍卖：${esc(c.name)}</b><div style="font-size:13px;color:#8a847a">当前最高：${a.bidder ? esc(ownerName(a.bidder)) + ' ¥' + a.highest : '无人出价（起拍 ¥100）'}</div></div>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn" onclick="act({type:'bid',amount:${(a.highest || 0) + 100}})">+100</button>
        <button class="btn" onclick="act({type:'bid',amount:${(a.highest || 0) + 500}})">+500</button>
        <button class="btn" onclick="act({type:'bid',amount:${(a.highest || 0) + 1000}})">+1000</button>
      </div>`;
  } else if (s.phase === 'raise' && s.raise && s.raise.pid === myPid) {
    html = `<div class="panel" style="background:#fdecea"><b>⚠️ 现金不足！</b>需要在下面抵押地产或卖房，凑齐 ¥${s.raise.need}</div>`;
  } else if (s.vote && !s.vote.votes[myPid] && s.vote.votes[myPid] === undefined) {
    html = `<div class="panel"><b>有人发起结束投票</b></div><div class="btn-row" style="margin-top:8px"><button class="btn primary" onclick="act({type:'vote',yes:true})">同意</button><button class="btn" onclick="act({type:'vote',yes:false})">拒绝</button></div>`;
  }
  area.innerHTML = html;
}
function buildCost(g) { return { g1: 850, g2: 1200, g3: 1550, g4: 1850, g5: 2200, g6: 2550, g7: 2900, g8: 3200, g9: 3550, g10: 4100 }[g]; }
let assetsSig = null;
function renderAssets(s) {
  const me = s.players.find(p => p.id === myPid);
  if (!me) { if (assetsSig !== 'none') { assetsSig = 'none'; $('assets').innerHTML = ''; } return; }
  // 我的地产（归属/等级/抵押/解锁轮次）或当前轮次/阶段变了就重建这堆带按钮的行
  let sig = myPid + '@' + (s.round || 1) + '@' + (s.phase || '') + '#';
  for (let i = 0; i < s.cells.length; i++) { const cs = dcell(i); if (cs.own === myPid) sig += i + ':' + (cs.level || 0) + (cs.mortgaged ? 'm' + (cs.mortgageAt || 0) : '') + ';'; }
  if (sig === assetsSig) return;
  assetsSig = sig;
  const mine = [];
  for (let i = 0; i < s.cells.length; i++) { const cs = dcell(i); if (cs.own === myPid) mine.push({ cs, i }); }
  if (!mine.length) { $('assets').innerHTML = '<div class="panel"><b>🏠 我的资产</b><span class="empty-tip">还没有地产，抓紧买地盖楼吧！</span></div>'; return; }
  // v5.1：抵押只剩两种时机 —— 筹钱（phase=raise）与盖房凑钱（phase=build），掷骰前不再能抵押
  const canMortgageNow = (s.phase === 'raise' && s.raise && s.raise.pid === myPid)
    || (s.phase === 'build' && s.pendingBuild && s.pendingBuild.pid === myPid);
  const rnd = s.round || 1;
  $('assets').innerHTML = '<div class="panel"><b>🏠 我的资产</b>' + mine.map(({ cs, i }) => {
    const c = BOARD[i];
    const col = c.type === 'prop' ? GROUPS[c.g] : '#B0BEC5';
    const lvl = cs.mortgaged ? '<span class="mortgaged">🔒 抵押中</span>' : (c.type === 'prop' && cs.level > 0 ? `<span class="lvl">${cs.level === 4 ? '🏨 旅馆' : '🏠'.repeat(cs.level)}</span>` : '');
    const canM = !cs.mortgaged && canMortgageNow;
    const canSell = cs.level > 0 && canMortgageNow;
    const unlock = (cs.mortgageAt || 0) + 2;
    const locked = cs.mortgaged && rnd < unlock;
    // 抵押地产加入锁定期，未解锁时显示带锁按钮并提示解锁轮次
    const rBtn = !cs.mortgaged ? '' : (locked
      ? `<button class="btn small locked" disabled title="抵押锁定期：第 ${unlock} 轮起才能赎回">🔒 第 ${unlock} 轮解锁</button>`
      : `<button class="btn small" onclick="act({type:'redeem',cell:${i}})">🔓 赎回-¥${Math.floor(c.price / 2)}</button>`);
    return `<div class="asset"><span class="swatch" style="background:${col}"></span><span class="aname">${esc(c.name)}</span>${lvl}
      ${canM ? `<button class="btn small" onclick="act({type:'mortgage',cell:${i}})">抵押+¥${Math.floor(c.price / 2)}</button>` : ''}
      ${rBtn}
      ${canSell ? `<button class="btn small" onclick="act({type:'sellBuilding',cell:${i}})">卖楼</button>` : ''}</div>`;
  }).join('') + '</div>';
}
let overShown = false;
function showGameOver(s) {
  if (overShown) return; overShown = true;
  SFX.win();
  confettiBurst(200);
  const w = s.players.find(p => p.id === (s.events.find(e => e.t === 'gameover') || {}).winner) || s.players[s.cur];
  setTimeout(() => {
    $('modal').style.display = 'flex';
    $('cardModal').style.display = 'none';
    const ask = $('askModal'); ask.style.display = 'block';
    $('askTitle').textContent = `🏆 ${w.name} 获胜！`;
    $('askDesc').innerHTML = `恭喜！本局共 ${s.round} 轮。<br>资产结算：` + s.players.map(p => `${esc(p.name)} ¥${netWorth(s, p)}`).join('<br>');
    $('askBtns').innerHTML = `<button class="btn primary" onclick="act({type:'again'});closeModal()">再来一局</button>`;
  }, 1200);
}
function netWorth(s, p) {
  let v = dcash(p);
  for (let i = 0; i < BOARD.length; i++) {
    const cs = dcell(i);
    if (cs.own !== p.id) continue;
    const c = BOARD[i];
    if (cs.mortgaged) v += Math.floor(c.price / 2);
    else v += c.price + (c.type === 'prop' ? cs.level * buildCost(c.g) : 0);
  }
  return v;
}
function closeModal() { $('modal').style.display = 'none'; $('askModal').style.display = 'none'; }

// ---------- 棋盘构建 ----------
const TYPE_ICON = { start: '🚩', jail: '🎫', parking: '💰', gojail: '📉', tax: '🧾', chance: '❓', fate: '🌟', duel: '⚔️', junction: '🎓', junction2: '🚀' };
const iconOf = c => c.type === 'transport' ? '✈️'
  : c.type === 'util' ? (c.name.includes('快递') ? '📦' : '🖨️')
  : TYPE_ICON[c.type] || '';

function buildBoard() {
  const svg = $('board');
  let html = `<defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fdfbf3"/><stop offset="1" stop-color="#f5edda"/>
    </linearGradient>
    <radialGradient id="ctrGrad" cx="0.5" cy="0.4" r="0.85">
      <stop offset="0" stop-color="#fdf8ec"/><stop offset="1" stop-color="#f0e4c6"/>
    </radialGradient>
    <linearGradient id="cellGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fffefb"/><stop offset="1" stop-color="#f9f3e4"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(255,255,255,.5)"/><stop offset="1" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
    <radialGradient id="fieldGrad" cx="0.5" cy="0.42" r="0.78">
      <stop offset="0" stop-color="#fffdf6"/><stop offset="1" stop-color="#f3ebd8"/>
    </radialGradient>
    <radialGradient id="spotGrad" cx="0.5" cy="0.45" r="0.46">
      <stop offset="0" stop-color="rgba(255,244,206,.85)"/><stop offset="1" stop-color="rgba(255,244,206,0)"/>
    </radialGradient>
    <!-- v5.0 续·二 美术增强 -->
    <linearGradient id="sheen" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="rgba(255,255,255,.72)"/><stop offset="0.55" stop-color="rgba(255,255,255,.12)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
    <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#8d1a29"/><stop offset="0.5" stop-color="#a8242f"/><stop offset="1" stop-color="#8d1a29"/>
    </linearGradient>
    <linearGradient id="goldBar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="rgba(212,175,55,.1)"/><stop offset="0.5" stop-color="rgba(212,175,55,.85)"/>
      <stop offset="1" stop-color="rgba(212,175,55,.1)"/>
    </linearGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.72">
      <stop offset="0.62" stop-color="rgba(120,96,50,0)"/><stop offset="1" stop-color="rgba(120,96,50,.14)"/>
    </radialGradient>
  </defs>`;
  html += `<rect x="0" y="0" width="${VIEWW}" height="${VIEWH}" rx="18" fill="url(#bgGrad)"/>`;

  // ---------- 内场美术：一块淡淡的"场地"，让环路与中央区有层次 ----------
  html += `<rect x="104" y="104" width="${VIEWW - 208}" height="${VIEWH - 208}" rx="30" fill="url(#fieldGrad)" stroke="#e7dabb" stroke-width="1.5"/>`;
  html += `<rect x="110" y="110" width="${VIEWW - 220}" height="${VIEWH - 220}" rx="26" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="3"/>`;
  html += `<rect x="116" y="116" width="${VIEWW - 232}" height="${VIEWH - 232}" rx="22" fill="none" stroke="#efe4c8" stroke-width="1" stroke-dasharray="3 6" opacity=".85"/>`;
  html += `<ellipse cx="${VIEWW / 2}" cy="${VIEWH / 2}" rx="440" ry="300" fill="url(#spotGrad)" opacity=".78"/>`;
  html += `<rect x="0" y="0" width="${VIEWW}" height="${VIEWH}" rx="18" fill="url(#vignette)"/>`;
  // 四角校徽水印（外圈 + 内圈双层，更有层次）
  [[176, 178, '🎓', '#7a1522'], [VIEWW - 176, 178, '📚', '#1E5AA8'], [176, VIEWH - 178, '✈️', '#2E7D32'], [VIEWW - 176, VIEWH - 178, '🏛️', '#8D6E63']].forEach(([wx, wy, wi, wc]) => {
    html += `<circle cx="${wx}" cy="${wy}" r="46" fill="${wc}" opacity=".045"/>`;
    html += `<circle cx="${wx}" cy="${wy}" r="46" fill="none" stroke="${wc}" stroke-width="1.2" opacity=".13"/>`;
    html += `<text x="${wx}" y="${wy + 19}" text-anchor="middle" font-size="52" opacity=".15">${wi}</text>`;
  });
  // 内场左右两块「徽章」装饰（填住中央看板两侧的空白，不挡任何格子与文字）
  [[267, 470, '🎓', '#7a1522'], [VIEWW - 267, 470, '🏆', '#8a6d1a']].forEach(([ex, ey, ei, ec]) => {
    html += `<circle cx="${ex}" cy="${ey}" r="62" fill="#fff" opacity=".5"/>`;
    html += `<circle cx="${ex}" cy="${ey}" r="62" fill="none" stroke="${ec}" stroke-width="1.4" opacity=".22"/>`;
    html += `<circle cx="${ex}" cy="${ey}" r="50" fill="none" stroke="${ec}" stroke-width="1" stroke-dasharray="4 7" opacity=".35"/>`;
    html += `<text x="${ex}" y="${ey + 20}" text-anchor="middle" font-size="52" opacity=".3">${ei}</text>`;
  });

  // ---------- 岔路虚线指示（画在地图下层，让中央看板自然盖住中段） ----------
  // v5.1：改成「按矩形真实边界求交点」—— 虚线两端精确落在格子边上，不再歪斜、不再压进格子里。
  const cellC = i => { const [x, y] = CELLXY(i); return [x + CW / 2, y + CH / 2]; };
  const edgeHit = (cx0, cy0, hw, hh, ux, uy) => {
    const tx = ux === 0 ? Infinity : hw / Math.abs(ux);
    const ty = uy === 0 ? Infinity : hh / Math.abs(uy);
    const t = Math.min(tx, ty);
    return [cx0 + ux * t, cy0 + uy * t];
  };
  const dashLink = (a, hwA, hhA, b, hwB, hhB, color) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    const p1 = edgeHit(a[0], a[1], hwA, hhA, ux, uy);
    const p2 = edgeHit(b[0], b[1], hwB, hhB, -ux, -uy);
    const gap = 7;   // 两端各留一点缝，虚线贴着格子但不压边
    const x1 = p1[0] + ux * gap, y1 = p1[1] + uy * gap;
    const x2 = p2[0] - ux * gap, y2 = p2[1] - uy * gap;
    let g = `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="2.6" stroke-dasharray="9 8" stroke-linecap="round" opacity=".6"/>`;
    const p = 9;   // 箭头：尖端落在 x2,y2，指向目标格
    g += `<polygon points="${x2.toFixed(1)},${y2.toFixed(1)} ${(x2 - ux * 16 - uy * p).toFixed(1)},${(y2 - uy * 16 + ux * p).toFixed(1)} ${(x2 - ux * 16 + uy * p).toFixed(1)},${(y2 - uy * 16 - ux * p).toFixed(1)}" fill="${color}" opacity=".85"/>`;
    return g;
  };
  const MHW = CW / 2 - 4, MHH = CH / 2 - 4;          // 主环路格子半宽/半高
  const BHW = BR_W / 2 - 4, BHH = BR_H / 2 - 4;      // 岔路格子半宽/半高
  html += dashLink(cellC(20), MHW, MHH, BRANCH_POS[48], BHW, BHH, '#5c8f52');   // 长廊入口 → 科研基金处
  html += dashLink(BRANCH_POS[54], BHW, BHH, cellC(28), MHW, MHH, '#5c8f52');   // 校史馆 → 教育基金会
  html += dashLink(cellC(36), MHW, MHH, BRANCH_POS[55], BHW, BHH, '#4f5fae');   // 大道入口 → 创业孵化器
  html += dashLink(BRANCH_POS[61], BHW, BHH, cellC(39), MHW, MHH, '#4f5fae');   // 校企合作中心 → 校园商城

  // ---------- 中央看板底板 ----------
  const C = CTR_CARD;
  html += `<rect x="${C.x - 10}" y="${C.y + 10}" width="${C.w + 20}" height="${C.h}" rx="30" fill="rgba(96,76,46,.18)"/>`;
  html += `<rect x="${C.x - 4}" y="${C.y - 4}" width="${C.w + 8}" height="${C.h + 8}" rx="28" fill="url(#ctrGrad)" stroke="rgba(212,175,55,.55)" stroke-width="2"/>`;
  html += `<rect x="${C.x}" y="${C.y}" width="${C.w}" height="${C.h}" rx="24" fill="url(#ctrGrad)" stroke="#d9c9a4" stroke-width="1.6"/>`;
  // 顶部缎带（红，圆角上沿 + 方角下沿）+ 金色压边
  html += `<rect x="${C.x}" y="${C.y}" width="${C.w}" height="18" rx="24" fill="url(#ribbon)"/>`;
  html += `<rect x="${C.x}" y="${C.y + 9}" width="${C.w}" height="9" fill="url(#ribbon)"/>`;
  html += `<rect x="${C.x}" y="${C.y + 17}" width="${C.w}" height="1.6" fill="url(#goldBar)"/>`;
  // 四角金色小直角装饰
  const CN = 22, CIN = C.x + 14, CIN2 = C.x + C.w - 14, CIY = C.y + 34, CIY2 = C.y + C.h - 14;
  html += `<path d="M ${CIN} ${CIY} L ${CIN + CN} ${CIY}" stroke="rgba(212,175,55,.75)" stroke-width="2" stroke-linecap="round"/>`;
  html += `<path d="M ${CIN} ${CIY} L ${CIN} ${CIY + CN}" stroke="rgba(212,175,55,.75)" stroke-width="2" stroke-linecap="round"/>`;
  html += `<path d="M ${CIN2} ${CIY} L ${CIN2 - CN} ${CIY}" stroke="rgba(212,175,55,.75)" stroke-width="2" stroke-linecap="round"/>`;
  html += `<path d="M ${CIN2} ${CIY} L ${CIN2} ${CIY + CN}" stroke="rgba(212,175,55,.75)" stroke-width="2" stroke-linecap="round"/>`;
  html += `<path d="M ${CIN} ${CIY2} L ${CIN + CN} ${CIY2}" stroke="rgba(212,175,55,.75)" stroke-width="2" stroke-linecap="round"/>`;
  html += `<path d="M ${CIN} ${CIY2} L ${CIN} ${CIY2 - CN}" stroke="rgba(212,175,55,.75)" stroke-width="2" stroke-linecap="round"/>`;
  html += `<path d="M ${CIN2} ${CIY2} L ${CIN2 - CN} ${CIY2}" stroke="rgba(212,175,55,.75)" stroke-width="2" stroke-linecap="round"/>`;
  html += `<path d="M ${CIN2} ${CIY2} L ${CIN2} ${CIY2 - CN}" stroke="rgba(212,175,55,.75)" stroke-width="2" stroke-linecap="round"/>`;

  // ---------- 主路线 48 格（环形 16 列 × 10 行） ----------
  const CORNER = new Set([0, 15, 24, 39]);   // 四个几何角格，特殊装饰
  for (let i = 0; i < 48; i++) {
    const c = BOARD[i], [x, y] = CELLXY(i);
    let fill = 'url(#cellGrad)', strip = '';
    if (c.type === 'prop') { strip = GROUPS[c.g]; }
    else if (c.type === 'transport') { fill = '#eef4fb'; strip = '#5B8AC4'; }
    else if (c.type === 'util') { fill = '#f1ece3'; strip = '#A1887F'; }
    else if (c.type === 'chance') { fill = '#f5ecf8'; strip = '#AF7AC5'; }
    else if (c.type === 'fate') { fill = '#e9f4ef'; strip = '#1D9E75'; }
    else if (c.type === 'duel') { fill = '#f1e7dd'; strip = '#8D6E63'; }
    else if (c.type === 'tax') { fill = '#fdecea'; strip = '#E57373'; }
    else if (c.type === 'start') { fill = '#eaf2d8'; strip = '#7CB342'; }
    else if (c.type === 'gojail') { fill = '#fdecea'; strip = '#C0392B'; }
    else if (c.type === 'jail') { fill = '#f0f0ee'; strip = '#9E9E9E'; }
    else if (c.type === 'parking') { fill = '#faf3dd'; strip = '#D9A83C'; }
    else if (c.type === 'junction') { fill = '#eaf6e4'; strip = '#66A05B'; }
    else if (c.type === 'junction2') { fill = '#e8eef8'; strip = '#5C6BC0'; }
    const deep = strip ? shade(strip, -46) : '#d8d0c0';
    html += `<rect x="${x + 1.5}" y="${y + 4}" width="${CW - 3}" height="${CH - 3}" rx="11" fill="rgba(96,76,46,.42)"/>`;
    html += `<rect x="${x}" y="${y}" width="${CW}" height="${CH}" rx="10" fill="${fill}" stroke="#e2dac9" stroke-width="1"/>`;
    if (strip) {
      // ① 整格铺一层极淡的色组底色 —— 一眼区分色彩区域（本次美术增强的重点）
      html += `<rect x="${x}" y="${y}" width="${CW}" height="${CH}" rx="10" fill="${strip}" opacity=".09"/>`;
      // ② 内描边（同色，低透明度）把格子"框"起来
      html += `<rect x="${x + 4}" y="${y + 4}" width="${CW - 8}" height="${CH - 8}" rx="7.5" fill="none" stroke="${strip}" stroke-opacity=".3" stroke-width="1"/>`;
      // ③ 顶部色带：圆角 + 底部加深边 + 高光
      html += `<rect x="${x}" y="${y}" width="${CW}" height="17" rx="10" fill="${strip}"/>`;
      html += `<rect x="${x}" y="${y + 10}" width="${CW}" height="7" fill="${strip}"/>`;
      html += `<rect x="${x + 1.5}" y="${y + 15.6}" width="${CW - 3}" height="1.4" fill="${deep}" opacity=".5"/>`;
      html += `<rect x="${x + 3}" y="${y + 1.5}" width="${CW - 6}" height="6.5" rx="3.2" fill="url(#gloss)"/>`;
      // ④ 色带左侧一枚小圆徽（色组标识）
      html += `<circle cx="${x + 14}" cy="${y + 8.5}" r="4.8" fill="rgba(255,255,255,.9)"/>`;
      html += `<circle cx="${x + 14}" cy="${y + 8.5}" r="2.5" fill="${deep}"/>`;
      // ⑤ 斜向柔光，让格子有"玻璃片"质感
      html += `<rect x="${x}" y="${y}" width="${CW}" height="${CH}" rx="10" fill="url(#sheen)" opacity=".5"/>`;
    }
    const cx = x + CW / 2, nm = c.name, ic = iconOf(c);
    if (CORNER.has(i)) {
      html += `<circle cx="${cx}" cy="${y + 48}" r="21" fill="rgba(255,255,255,.66)" stroke="${strip || '#ccc'}" stroke-width="1.6" stroke-opacity=".55"/>`;
      html += `<circle cx="${cx}" cy="${y + 48}" r="25.5" fill="none" stroke="${strip || '#ccc'}" stroke-width="1" stroke-dasharray="3 5" stroke-opacity=".5"/>`;
    }
    // 大学格：校名 + 价格（价格加一枚淡色胶囊托底，更醒目）
    if (c.type === 'prop') {
      // v5.1：房屋挪到上方色带与校名之间，这里把校名/价格整体下移一点，留出房屋展示区
      html += `<rect x="${cx - 40}" y="${y + 63}" width="80" height="21" rx="10.5" fill="${strip}" opacity=".18"/>`;
      html += `<text class="cellname" x="${cx}" y="${y + 54.5}" text-anchor="middle" font-size="${nm.length <= 4 ? 20 : 17}" font-weight="800">${esc(nm)}</text>`;
      html += `<text class="cellprice" x="${cx}" y="${y + 78.5}" text-anchor="middle" font-size="16.5" font-weight="800">¥${c.price}</text>`;
    } else {
      if (ic) html += `<text x="${cx}" y="${y + 50}" text-anchor="middle" font-size="26">${ic}</text>`;
      html += `<text class="cellname" x="${cx}" y="${y + 74}" text-anchor="middle" font-size="${nm.length <= 4 ? 16.5 : 14.5}" font-weight="700">${esc(nm)}</text>`;
      if (c.price) html += `<text class="cellprice" x="${cx}" y="${y + 91}" text-anchor="middle" font-size="15" font-weight="700">¥${c.price}</text>`;
    }
  }

  // ---------- 起点出发方向标记 ----------
  // 放在「内场左上角」而不是起点格里：开局 5 枚棋子全叠在起点格上，写在格内会被棋子整个盖住。
  {
    const [ox, oy] = CELLXY(0);                 // 起点格左上角 = 棋盘左上角
    const mx = ox + CW + 68, my = oy + CH + 58; // 内场内的指示牌位置（起点格右下方向）
    // 一条指向起点格「内角」的虚线 + 一块小指示牌（箭头 = 沿顶行向右前进）
    html += `<path d="M ${ox + CW - 3} ${oy + CH - 3} L ${mx - 60} ${my - 12}" stroke="#6a9e3a" stroke-width="2.4" stroke-dasharray="5 5" opacity=".75" fill="none"/>`;
    html += `<rect x="${mx - 56}" y="${my - 17}" width="112" height="34" rx="17" fill="rgba(106,158,58,.94)" stroke="rgba(255,255,255,.94)" stroke-width="1.8"/>`;
    html += `<text x="${mx}" y="${my + 6}" text-anchor="middle" font-size="15.5" font-weight="800" fill="#fff" letter-spacing="1.5" font-family="'PingFang SC','Noto Sans SC',sans-serif">出发 ▶</text>`;
  }

  // ---------- 两条岔路（横排在棋盘正中央） ----------
  const branchRow = (title, sub, cells, accent, cy) => {
    // 整排底板：把 7 格圈成"一条支线"，与主环路区分开
    const x0 = BR_CX(0) - BR_W / 2 - 16, x1 = BR_CX(6) + BR_W / 2 + 16;
    let s = `<rect x="${x0}" y="${cy - BR_H / 2 - 44}" width="${x1 - x0}" height="${BR_H + 62}" rx="20" fill="${accent}" opacity=".055"/>`;
    s += `<rect x="${x0}" y="${cy - BR_H / 2 - 44}" width="${x1 - x0}" height="${BR_H + 62}" rx="20" fill="none" stroke="${accent}" stroke-width="1.2" stroke-dasharray="6 7" opacity=".3"/>`;
    s += `<text x="${VIEWW / 2}" y="${cy - BR_H / 2 - 28}" text-anchor="middle" font-size="19" font-weight="800" fill="${accent}" letter-spacing="3" font-family="STKaiti,KaiTi,'PingFang SC',serif">${title}</text>`;
    s += `<text x="${VIEWW / 2}" y="${cy - BR_H / 2 - 9}" text-anchor="middle" font-size="12.5" fill="#8d8577" letter-spacing="0.5">${sub}</text>`;
    // 行进箭头（带脉冲动画）
    for (let k = 0; k < 6; k++) {
      const gx = (BR_CX(k) + BR_CX(k + 1)) / 2;
      s += `<text class="br-arrow" x="${gx}" y="${cy + 6}" text-anchor="middle" font-size="17" fill="${accent}" opacity=".55" style="animation-delay:${(k * 0.18).toFixed(2)}s">›</text>`;
    }
    cells.forEach(({ i, c, icon, name }) => {
      const [px, py] = BRANCH_POS[i];
      const bx = px - BR_W / 2, by = py - BR_H / 2, deep = shade(c, -46);
      s += `<rect x="${bx + 2}" y="${by + 4}" width="${BR_W}" height="${BR_H}" rx="10" fill="rgba(96,76,46,.38)"/>`;
      s += `<rect x="${bx}" y="${by}" width="${BR_W}" height="${BR_H}" rx="9" fill="#fffdf6" stroke="${c}" stroke-width="2.2"/>`;
      s += `<rect x="${bx}" y="${by}" width="${BR_W}" height="${BR_H}" rx="9" fill="${c}" opacity=".07"/>`;
      s += `<rect x="${bx + 4}" y="${by + 4}" width="${BR_W - 8}" height="${BR_H - 8}" rx="6.5" fill="none" stroke="${c}" stroke-opacity=".26" stroke-width="1"/>`;
      s += `<rect x="${bx}" y="${by}" width="${BR_W}" height="17" rx="9" fill="${c}"/>`;
      s += `<rect x="${bx}" y="${by + 10}" width="${BR_W}" height="7" fill="${c}"/>`;
      s += `<rect x="${bx + 1.5}" y="${by + 15.6}" width="${BR_W - 3}" height="1.4" fill="${deep}" opacity=".45"/>`;
      s += `<rect x="${bx + 3}" y="${by + 1.5}" width="${BR_W - 6}" height="6" rx="3" fill="url(#gloss)"/>`;
      s += `<text x="${bx + 9}" y="${by + 12.5}" font-size="9.5" font-weight="800" fill="rgba(255,255,255,.92)">${i}</text>`;
      s += `<text x="${px}" y="${by + 52}" text-anchor="middle" font-size="26">${icon}</text>`;
      s += `<text x="${px}" y="${by + 84}" text-anchor="middle" font-size="${name.length <= 4 ? 16 : 14.5}" font-weight="800" fill="#4a443c">${esc(name)}</text>`;
      s += `<rect x="${bx}" y="${by}" width="${BR_W}" height="${BR_H}" rx="9" fill="url(#sheen)" opacity=".38"/>`;
    });
    return s;
  };
  html += branchRow('🎓 学术长廊', '持有 ≥2 块地皮 · 从「长廊入口」进 · 出口「校史馆」领 2 张免租金卡 · 停留 2 回合', [
    { i: 48, c: '#5C6BC0', icon: '🔬', name: '科研基金处' },
    { i: 49, c: '#8D6E63', icon: '🧑‍🏫', name: '教授工作室' },
    { i: 50, c: '#AB47BC', icon: '🎁', name: '校庆礼品屋' },
    { i: 51, c: '#F9A825', icon: '🎓', name: '奖学金长廊' },
    { i: 52, c: '#D9A83C', icon: '🏅', name: '杰出校友厅' },
    { i: 53, c: '#455A64', icon: '📚', name: '通宵自习室' },
    { i: 54, c: '#2E7D32', icon: '🏛️', name: '校史馆' },
  ], '#7a6a3a', BR_ROW_A);
  html += branchRow('🚀 创业大道', '无门槛 · 从「大道入口」进 · 出口「校企合作中心」领 ¥2500 · 停留 2 回合', [
    { i: 55, c: '#E65100', icon: '🚀', name: '创业孵化器' },
    { i: 56, c: '#6A1B9A', icon: '🛒', name: '跳蚤市场' },
    { i: 57, c: '#2E7D32', icon: '🏟️', name: '校园运动会' },
    { i: 58, c: '#0277BD', icon: '🌍', name: '国际交流站' },
    { i: 59, c: '#D9A83C', icon: '💼', name: '创业基金厅' },
    { i: 60, c: '#455A64', icon: '📋', name: '实习直通车' },
    { i: 61, c: '#AD1457', icon: '🤝', name: '校企合作中心' },
  ], '#3f5a7a', BR_ROW_B);

  // ---------- 中央看板文字（v5.6：标题区压缩，给下方信息胶囊腾空间） ----------
  const ccx = C.x + C.w / 2;
  html += `<text x="${ccx}" y="${C.y + 46}" text-anchor="middle" font-size="24" font-weight="800" fill="#7a1522" letter-spacing="5" font-family="STKaiti,KaiTi,'PingFang SC',serif">没事就玩大富翁</text>`;
  html += `<text x="${ccx}" y="${C.y + 63}" text-anchor="middle" font-size="10.5" fill="#a89c88" letter-spacing="4">UNIVERSITY MONOPOLY</text>`;
  html += `<line x1="${C.x + 80}" y1="${C.y + 74}" x2="${C.x + C.w - 80}" y2="${C.y + 74}" stroke="#e0d3b4" stroke-width="1.3" stroke-dasharray="5 5"/>`;
  // v5.2：校园风貌常驻徽章（内容由 renderFacultyBadge() 动态填充）——永久挂在地图正中央
  html += `<g id="facBadge"></g>`;
  // ---------- v5.5 中央信息区（胶囊化美化） ----------
  // 四行"玻璃胶囊"：季节 / 天气 / 基金池 / 轮次+校历 —— 每行带左侧色标、高光、呼吸辉光，
  // 信息仍在原 ID 的 <text> 上（renderPanel 只改 textContent，不用动）。
  const chipRow = (yy, hh, accent, x0, ww) => {
    let s = `<rect x="${x0 + 3}" y="${yy + 3.5}" width="${ww}" height="${hh}" rx="${hh / 2}" fill="rgba(96,76,46,.16)"/>`;
    s += `<rect x="${x0}" y="${yy}" width="${ww}" height="${hh}" rx="${hh / 2}" fill="rgba(255,253,243,.78)" stroke="#e3d5b2" stroke-width="1.2"/>`;
    s += `<rect x="${x0}" y="${yy}" width="${ww}" height="${hh}" rx="${hh / 2}" fill="url(#sheen)" opacity=".33"/>`;
    s += `<rect x="${x0 + 9}" y="${yy + hh / 2 - 9}" width="4.6" height="18" rx="2.3" fill="${accent}"/>`;
    return s;
  };
  const gx0 = C.x + 24, gw = C.w - 48;
  // 第 1 行：季节（学院四季）
  html += chipRow(C.y + 150, 32, '#c98a1e', gx0, gw);
  html += `<text id="seasonText" x="${ccx + 6}" y="${C.y + 174}" text-anchor="middle" font-size="17" font-weight="800" fill="#8a6d1a"></text>`;
  // 第 2 行：天气（今日天气 + 效果）
  html += chipRow(C.y + 186, 32, '#4f9ad1', gx0, gw);
  html += `<text id="weatherText" x="${ccx + 6}" y="${C.y + 210}" text-anchor="middle" font-size="14.5" font-weight="700" fill="#587a4e"></text>`;
  // 第 3 行：教育基金池（金灿灿的一行，带两枚呼吸闪光的小金币）
  html += chipRow(C.y + 222, 36, '#d9a418', gx0, gw);
  html += `<circle cx="${gx0 + 26}" cy="${C.y + 240}" r="7.5" fill="url(#goldBar)" opacity=".9"><animate attributeName="opacity" values=".45;1;.45" dur="2.6s" repeatCount="indefinite"/></circle>`;
  html += `<text x="${gx0 + 26}" y="${C.y + 245}" text-anchor="middle" font-size="10">✦</text>`;
  html += `<circle cx="${gx0 + gw - 26}" cy="${C.y + 240}" r="6.5" fill="url(#goldBar)" opacity=".8"><animate attributeName="opacity" values="1;.4;1" dur="3.1s" repeatCount="indefinite"/></circle>`;
  html += `<text x="${gx0 + gw - 26}" y="${C.y + 244}" text-anchor="middle" font-size="9">✦</text>`;
  html += `<text id="poolText" x="${ccx + 6}" y="${C.y + 248}" text-anchor="middle" font-size="19" font-weight="800" fill="#a5720e">💰 教育基金池 ¥0</text>`;
  // 第 4 行：左轮次 + 右校历（对半双胶囊）
  const hw = (gw - 12) / 2;
  html += chipRow(C.y + 262, 34, '#7a6a52', gx0, hw);
  html += chipRow(C.y + 262, 34, '#3a7bd5', gx0 + hw + 12, hw);
  html += `<text id="roundText" x="${gx0 + hw / 2 + 6}" y="${C.y + 284}" text-anchor="middle" font-size="13" font-weight="700" fill="#6a6252"></text>`;
  html += `<text id="calText" x="${gx0 + hw + 12 + hw / 2 + 6}" y="${C.y + 284}" text-anchor="middle" font-size="13" font-weight="700" fill="#3a7bd5"></text>`;
  // 底部一行小星标装饰（替换原静态说明文字，留白更干净）
  html += `<text x="${ccx}" y="${C.y + 320}" text-anchor="middle" font-size="10.5" fill="#c3b89f" letter-spacing="8">✦ ✦ ✦</text>`;

  html += `<g id="ownLayer"></g><g id="tokenLayer"></g>`;
  svg.innerHTML = html;
  boardBuilt = true;
  buildSig = ''; buildEls = {}; tokenEls = {}; facBadgeKey = null;
}

// 开局流程：作者公告 → v5.0 更新简介 → 正常创房（每次打开都走一遍）
(() => {
  const ann = $('announce'), intro = $('intro');
  if (!ann) return;
  ann.style.display = 'flex';
  $('btnAnnounce').onclick = () => {
    ann.style.display = 'none';
    if (intro) intro.style.display = 'flex';
  };
  const bi = $('btnIntro');
  if (bi) bi.onclick = () => { if (intro) intro.style.display = 'none'; };
  // 规则介绍：创房界面 + 对局界面都能随时翻阅
  const rules = $('rules');
  const openRules = () => { if (rules) rules.style.display = 'flex'; };
  const closeRules = () => { if (rules) rules.style.display = 'none'; };
  ['btnRules', 'btnRulesLobby'].forEach(id => { const b = $(id); if (b) b.onclick = openRules; });
  const bc = $('btnRulesClose'); if (bc) bc.onclick = closeRules;
  if (rules) rules.onclick = (e) => { if (e.target === rules) closeRules(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeRules(); });
})();
connect();
