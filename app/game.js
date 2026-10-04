// 没事就玩大富翁 · 游戏引擎（服务器权威判定）
'use strict';

// ---------- 棋盘数据（大学主题 · 主路线 48 格 + 两条岔路各 7 格） ----------
// v5.1：盖房成本整体下调约 15%，各级租金同步下调约 12%（盖楼更便宜、收租也不再那么暴利）
const GROUPS = {
  g1:  { label: '棕',   color: '#A1887F', build: 850,  refRent: 230,  rents: [620, 1410, 2900, 5460] },
  g2:  { label: '浅蓝', color: '#90CAF9', build: 1200, refRent: 320,  rents: [840, 1940, 4050, 7570] },
  g3:  { label: '粉',   color: '#F48FB1', build: 1550, refRent: 410,  rents: [1100, 2550, 5280, 9860] },
  g4:  { label: '橙',   color: '#FFB74D', build: 1850, refRent: 500,  rents: [1320, 3080, 6420, 12060] },
  g5:  { label: '红',   color: '#E57373', build: 2200, refRent: 590,  rents: [1580, 3700, 7660, 14340] },
  g6:  { label: '黄',   color: '#FFE082', build: 2550, refRent: 680,  rents: [1850, 4310, 8890, 16720] },
  g7:  { label: '绿',   color: '#A5D6A7', build: 2900, refRent: 770,  rents: [2110, 4930, 10210, 19100] },
  g8:  { label: '青',   color: '#4DB6AC', build: 3200, refRent: 860,  rents: [2380, 5540, 11530, 21560] },
  g9:  { label: '深蓝', color: '#9FA8DA', build: 3550, refRent: 980,  rents: [2730, 6340, 13110, 24550] },
  g10: { label: '紫',   color: '#B39DDB', build: 4100, refRent: 1100, rents: [3080, 7130, 14780, 27720] },
};
const PCOLOR = ['#E53935', '#1E88E5', '#FDD835', '#43A047', '#8E24AA']; // 玩家棋子色（最多 5 人）

// type: start/fate/chance/tax/transport/jail/parking/gojail/prop/util/duel/junction/junction2
function P(name, g, price, rent) { return { name, type: 'prop', g, price, rent }; }
// 30 所中国高校：2026 QS 世界排名「中国（内地 + 香港大学）」前 28 + 西北农林科技大学 + 长安大学
// 价格按 QS 档次从低到高沿棋盘排列，档内每所价格与租金都不同
// 名次（全球）：香港大学11 · 北大14 · 清华17 · 复旦30 · 上交47 · 浙大49 · 南大103 · 中科大132 · 同济177
//             武大186 · 北师大247 · 哈工大256 · 天大257 · 北理工259 · 中山276 · 西交305 · 华科319
//             川大324 · 山大339 · 厦大341 · 南科大343 · 南开355 · 国科大362 · 华南理工377 · 北航388
//             东南392 · 华东师大433 · 深圳大学452 ｜ 附加：西北农林科技(801-850) · 长安大学
const BOARD = [
  { name: '起点', type: 'start' },                         //0
  P('华中科大', 'g5', 2100, 560),                               //1
  P('山东大学', 'g4', 1900, 500),                               //2
  { name: '命运', type: 'fate' },                          //3
  { name: '缴学费', type: 'tax', amount: 900 },             //4（v5.1：实际扣款改为随机 ¥800~1500，此字段仅作占位）
  { name: '浦东机场', type: 'transport', price: 2000 },  //5
  P('浙江大学', 'g9', 3450, 900),                               //6
  P('厦门大学', 'g4', 1800, 470),                               //7
  { name: '机会', type: 'chance' },                        //8
  P('北航', 'g2', 1300, 320),                                 //9
  P('北京理工', 'g6', 2400, 650),                               //10（与北理工互换）
  P('中山大学', 'g6', 2300, 620),                               //11
  { name: '文印店', type: 'util', price: 1700 },            //12（v5.1：涨价 1600→1700）
  P('香港大学', 'g10', 3900, 1020),                             //13
  P('四川大学', 'g5', 2000, 530),                               //14
  { name: '白云机场', type: 'transport', price: 2000 },  //15
  P('西北农林', 'g1', 900, 205),                                //16
  { name: '命运', type: 'fate' },                          //17
  P('南京大学', 'g8', 3300, 860),                               //18
  P('南开大学', 'g3', 1600, 410),                               //19
  { name: '长廊入口', type: 'junction' },                //20（岔路入口：持有 ≥2 块地皮可进·与教育基金会互换）
  P('东南大学', 'g2', 1200, 290),                               //21
  { name: '机会', type: 'chance' },                        //22
  P('北京大学', 'g10', 4050, 1060),                             //23
  { name: '宝安机场', type: 'transport', price: 2000 },  //24（v5.1：与中科大互换）
  P('中科大', 'g8', 3150, 830),                                //25（v5.1：与宝安机场互换）
  P('天津大学', 'g6', 2500, 680),                               //26
  P('华东师大', 'g2', 1100, 260),                               //27
  { name: '教育基金会', type: 'parking' },                   //28（走到领走基金池·与长廊入口互换）
  P('华南理工', 'g3', 1400, 350),                               //29
  { name: '挂科留级', type: 'gojail' },                     //30（原入狱）
  P('深圳大学', 'g1', 1000, 230),                               //31
  P('北师大', 'g7', 2700, 740),                                //32
  P('同济大学', 'g8', 3000, 800),                               //33
  P('武汉大学', 'g7', 2850, 770),                               //34
  { name: '大兴机场', type: 'transport', price: 2000 },  //35
  { name: '大道入口', type: 'junction2' },               //36（原大道入口）
  P('南科大', 'g4', 1700, 440),                                //37
  { name: '快递驿站', type: 'util', price: 1600 },           //38（v5.1：涨价 1500→1600）
  { name: '校园商城', type: 'jail' },                       //39（免费领「免租金卡」·与北理工互换）
  P('清华大学', 'g10', 4200, 1100),                             //40
  P('国科大', 'g3', 1500, 380),                                //41
  P('上海交大', 'g9', 3600, 940),                               //42
  P('长安大学', 'g1', 800, 180),                                //43
  { name: '辩论擂台', type: 'duel' },                        //44（原擂台）
  P('西安交大', 'g5', 2200, 590),                               //45
  P('复旦大学', 'g9', 3750, 980),                               //46
  P('哈工大', 'g7', 2600, 710),                                //47
];

// ---------- 学术长廊（48~54 号格，7 格） ----------
// 入口：20 号「长廊入口」（持有 ≥2 块地皮）；出口 54「校史馆」领 2 张免租金卡但停留 2 回合，之后沿主路线继续（54 → 28 教育基金会）。
const BRANCH = { START: 48, EXIT: 54, EXIT_TO: 28, JUNCTION: 20, NEED: 2 };
const BRANCH_CELLS = [
  { name: '科研基金处', type: 'invest', desc: '花 ¥2000 立项，2 轮后结题返还 ¥3000（净赚 ¥1000）' },
  { name: '教授工作室', type: 'advisor', desc: '教授心情随机：请喝咖啡 +¥1500 / 抓去搬设备 -¥1000' },
  { name: '校庆礼品屋', type: 'shop', desc: '同校园商城：随机抽 1~2 张效果卡（含「技能次数 +1」）' },
  { name: '奖学金长廊', type: 'ginkgo', desc: '领 ¥2000，且接下来两次移动各 +3；15% 概率被举报，改为给总资产最少者 ¥2500' },
  { name: '杰出校友厅', type: 'hall', risk: true, desc: '领基金池 25% 分红（至少 ¥600）；10% 概率被耿同学举报论文造假，缴 ¥2000 进基金会' },
  { name: '通宵自习室', type: 'study', desc: '停留一回合领 ¥2000 奖学金；20% 概率猝死，付 ¥4000 治疗且再停一回合' },
  { name: '校史馆', type: 'exit', desc: '停留一回合学习校史，并领 1 张免租金卡' },
];
BOARD.push(...BRANCH_CELLS);

// ---------- 创业大道（55~61 号格，7 格） ----------
// 入口：36 号「大道入口」（无门槛）；出口 61「校企合作中心」领 ¥2000 但停留 1 回合，之后沿主路线继续（61 → 39 校园商城）。
const BRANCH2 = { START: 55, EXIT: 61, EXIT_TO: 39, JUNCTION: 36 };
const BRANCH2_CELLS = [
  { name: '创业孵化器', type: 'startup', desc: '路演随机：50% 获奖 ¥4000 / 50% 亏损 ¥2000' },
  { name: '毕业跳蚤市场', type: 'market', desc: '摆摊随机：好物 +¥3000（10%）/ 出清 +¥1000（60%）/ 假货 -¥1500（30%）' },
  { name: '校园运动会', type: 'arena', desc: '挑战总资产最高者：胜者拿走对方现金的 25%；自己就是首富则无效' },
  { name: '国际交流站', type: 'exchange', desc: '花 ¥1200 报名交换项目：50% 拿到 ¥4000 奖学金' },
  { name: '创业基金厅', type: 'hall', desc: '领取教育基金池 25% 分红（至少 ¥600）' },
  { name: '实习直通车', type: 'intern', desc: '停留一回合赚 ¥3000；20% 概率被导师召回，扣 ¥2000 且再停一回合' },
  { name: '校企合作中心', type: 'exit2', desc: '领 ¥2000 现金，并停留一回合学习' },
];
BOARD.push(...BRANCH2_CELLS);

// ---------- v4.0 / v5.0 全局机制常量 ----------
const FUND_CAP = 20000;        // 教育基金池上限（v5.1：30000 → 20000）：超过部分直接均分给全体玩家
const ENDGAME_ROUND = 15;      // 终局「经济寒冬」：第 15 轮起银行停发工资
const REROLL_COST = 1200;      // 重掷骰：掷骰后花 ¥1200 重投一次
const FUND_SHARE = 1 / 3;      // v5.0：重掷/免罚符的花费有 1/3 进入教育基金池

// ---------- 市场周期（季节） / 天气 / 校历事件 ----------
// 季节由每轮开局的"市场骰"决定：1-2 淡季 / 3-4 平季 / 5-6 旺季，并带惯性（旺者更旺、淡者更淡）。
// 关键设计：季节双向影响价格——淡季收租低但扩张便宜，旺季收租高但扩张也贵，形成"低谷囤地、高峰收割"的循环。
const SEASON = {
  low:  { key: 'low',  name: '淡季', icon: '🍂', rentMul: 0.85, buildMul: 0.9, color: '#378ADD' },
  mid:  { key: 'mid',  name: '平季', icon: '🌤️', rentMul: 1.0, buildMul: 1.0, color: '#888780' },
  high: { key: 'high', name: '旺季', icon: '🔥', rentMul: 1.15, buildMul: 1.1, color: '#BA7517' },
};
const SEASON_ORDER = ['low', 'mid', 'high'];
// v5.1：天气扩充到 8 种，每种有独立的数值修正与独立视觉效果（台风不再复用雨天雨幕）
const WEATHER = {
  sun:   { key: 'sun',   name: '晴天', icon: '☀️', diceMod: 1,  desc: '掷骰 +1 步' },
  cloud: { key: 'cloud', name: '阴天', icon: '☁️', diceMod: 0,  desc: '无特殊影响' },
  rain:  { key: 'rain',  name: '雨天', icon: '🌧️', diceMod: -1, desc: '掷骰 −1 步' },
  storm: { key: 'storm', name: '台风', icon: '🌪️', diceMod: 0,  rentMul: 0.7,  desc: '全场租金 ×0.7' },
  fog:   { key: 'fog',   name: '雾霾', icon: '🌫️', diceMod: 0,  rentMul: 0.9,  desc: '能见度低，全场租金 ×0.9' },
  snow:  { key: 'snow',  name: '暴雪', icon: '❄️', diceMod: -1, buildMul: 1.15, desc: '掷骰 −1 步，盖房 ×1.15' },
  heat:  { key: 'heat',  name: '烈日', icon: '🔥', diceMod: 0,  rentMul: 1.1,  desc: '消费旺盛，全场租金 ×1.1' },
  wind:  { key: 'wind',  name: '大风', icon: '💨', diceMod: 1,  rentMul: 0.95, buildMul: 1.1, desc: '顺风 +1 步，租金 ×0.95，盖房 ×1.1' },
};
// 出现权重：晴/阴/雨最常见，台风与暴雪偏稀有
const WEATHER_POOL = ['sun', 'sun', 'cloud', 'cloud', 'rain', 'rain', 'fog', 'snow', 'heat', 'wind', 'storm'];
const CALEVENTS = [
  { id: 'term',      name: '开学季',   icon: '🎒', desc: '全体领取助学金 ¥1500', kind: 'moneyAll', amount: 1500 },
  { id: 'exam',      name: '考试周',   icon: '📚', desc: '本回合所有玩家移动 -2', kind: 'slow', steps: -2 },
  { id: 'anniv',     name: '校庆周',   icon: '🎉', desc: '本回合全场租金 ×1.5', kind: 'rentUp', mul: 1.5 },
  { id: 'grad',      name: '毕业季',   icon: '🎓', desc: '本回合全场租金 -50%', kind: 'rentDown', mul: 0.5 },
  { id: 'midautumn', name: '中秋节',   icon: '🥮', desc: '学校发月饼礼盒：全体 +¥800', kind: 'moneyAll', amount: 800 },
  { id: 'double11',  name: '双十一',   icon: '🛒', desc: '忍不住剁手：全体各缴 ¥600 进教育基金池', kind: 'payAll', amount: 600 },
  { id: 'sports',    name: '校运会',   icon: '🏃', desc: '本回合全体移动 +2', kind: 'fast', steps: 2 },
  { id: 'national',  name: '国庆假期', icon: '🇨🇳', desc: '消费补贴：现金不足 ¥8000 的玩家各得 ¥2000', kind: 'bailout', low: 8000, amount: 2000 },
  { id: 'cherry',    name: '樱花季',   icon: '🌸', desc: '游客如织：本回合全场租金 ×1.25', kind: 'rentUp', mul: 1.25 },
  { id: 'thesis',    name: '毕业论文季', icon: '📄', desc: '查重、打印、答辩：全体各缴 ¥400', kind: 'payAll', amount: 400 },
  { id: 'alumni',    name: '校友返校日', icon: '🤝', desc: '最富的玩家向教育基金池捐赠 ¥2000', kind: 'richTax', amount: 2000 },
  { id: 'newbie',    name: '迎新季',   icon: '🌱', desc: '现金最少的玩家获助学金 ¥2500', kind: 'poorBonus', amount: 2500 },
  { id: 'rebuild',   name: '校园改造季', icon: '🚧', desc: '本回合盖房费用 ×0.7', kind: 'buildSale', mul: 0.7 },
  { id: 'rainy',     name: '梅雨季节', icon: '☔', desc: '阴雨绵绵：本回合全体移动 -1，租金 -25%', kind: 'rainy', steps: -1, mul: 0.75 },
  // ===== v5.1 新增：更多「三轮一次」的校历事件（风格各异，各配独立特效）=====
  { id: 'newyear',   name: '元旦跨年',   icon: '🎆', desc: '跨年烟火大会：全体领取 ¥1000', kind: 'moneyAll', amount: 1000, fx: 'fireworks' },
  { id: 'spring',    name: '春节假期',   icon: '🧧', desc: '开学红包到账：全体领取 ¥1600', kind: 'moneyAll', amount: 1600, fx: 'redpacket' },
  { id: 'halloween', name: '万圣节',     icon: '🎃', desc: '不给糖就捣蛋：全体各缴 ¥500 进教育基金池', kind: 'payAll', amount: 500, fx: 'pumpkin' },
  { id: 'karaoke',   name: '校园歌手赛', icon: '🎤', desc: '随机一位选手夺冠独得 ¥3500，其余各领 ¥300 参与奖', kind: 'lottery', amount: 3500, consolation: 300, fx: 'stage' },
  { id: 'jobfair',   name: '招聘季',     icon: '💼', desc: '实习 offer 雨：全体各领 ¥900 安家费', kind: 'moneyAll', amount: 900, fx: 'offer' },
  { id: 'fundday',   name: '基金分红日', icon: '🏦', desc: '教育基金池拿出 60% 按在场人数均分', kind: 'fundShare', share: 0.6, fx: 'bank' },
  { id: 'aidpoor',   name: '精准帮扶',   icon: '🤲', desc: '现金最多者向现金最少者转移 ¥2000', kind: 'stealPoor', amount: 2000, fx: 'aid' },
  { id: 'techweek',  name: '科技文化节', icon: '🚀', desc: '大兴土木：本回合盖房费用 ×1.25', kind: 'buildBoom', mul: 1.25, fx: 'rocket' },
  { id: 'freeper',   name: '校园免租日', icon: '🎈', desc: '和气生财：本回合全场租金 ×0.6', kind: 'rentDown', mul: 0.6, fx: 'balloon' },
  { id: 'booming',   name: '经济过热',   icon: '💹', desc: '本回合全场租金 ×1.35', kind: 'rentUp', mul: 1.35, fx: 'bull' },
  { id: 'blackfri',  name: '黑五大促',   icon: '🏷️', desc: '忍不住剁手：全体各缴 ¥1000 进教育基金池', kind: 'payAll', amount: 1000, fx: 'sale' },
  { id: 'stormweek', name: '暴雨停课周', icon: '🌀', desc: '停课不停学：本回合全体移动 -2，租金 ×0.8', kind: 'rainy', steps: -2, mul: 0.8, fx: 'storm' },
  { id: 'reading',   name: '读书节',     icon: '📖', desc: '沉心读书：本回合全体移动 -1，但各领 ¥700 购书补贴', kind: 'study', steps: -1, amount: 700, fx: 'book' },
  { id: 'gala',      name: '校庆嘉年华', icon: '🎪', desc: '每人发 1 张校园效果卡，另随机一位抽中大奖 ¥2500', kind: 'cardsLottery', amount: 2500, cards: 1, fx: 'carnival' },
  { id: 'gradshow',  name: '毕业作品展', icon: '🖼️', desc: '作品拍出好价：现金最少者 +¥3000，其余各 +¥500', kind: 'poorMore', amount: 3000, other: 500, fx: 'gallery' },
];

// ---------- 专业身份（v5.1 扩充到 33 种；被动自动发动 / 主动到点询问，都有次数上限） ----------
//   mode:'passive' 满足条件自动发动；mode:'active' 在自己回合开始时会询问是否发动
//   fx: 客户端技能大特效的主题色（全场可见）；tier: 强度档位（仅用于 UI 排序与平衡参考）
const MAJORS = {
  // ===== 第一梯队（v5.1 强度上调：机械 / 新能源 / 金融 / 计算机）=====
  mech: { id: 'mech', name: '机械', icon: '⚙️', skill: '精益制造', mode: 'active', uses: 4, fx: '#e8734a', tier: 1,
          desc: '发动后本回合盖房费 −46% 并立刻 +¥1350；常驻盖房永久 −9%' },
  newe: { id: 'newe', name: '新能源材料与器件', icon: '🔋', skill: '储能放大', mode: 'active', uses: 3, fx: '#2fb87a', tier: 1,
          desc: '发动后立刻 +现金 11%（上限 ¥3650），本轮收租 +36%；常驻每次经过起点 +¥900' },
  fin:  { id: 'fin',  name: '金融', icon: '💰', skill: '杠杆操作', mode: 'passive', uses: 4, fx: '#d8a531', tier: 1,
          desc: '抵押地产时自动多拿 46% 现金' },
  cs:   { id: 'cs',   name: '计算机', icon: '💻', skill: '算法优化', mode: 'passive', uses: 3, fx: '#4a90d9', tier: 1,
          desc: '掷骰不足 7 点时自动重掷取更优' },
  // ===== 第二梯队（主流强度，各有专业特色）=====
  econ:  { id: 'econ',  name: '经管',   icon: '📈', skill: '资本运作', mode: 'passive', uses: 3, fx: '#c9a227', tier: 2,
           desc: '单笔收租 ≥¥1500 时自动 +46%' },
  med:   { id: 'med',   name: '医学',   icon: '🩺', skill: '妙手回春', mode: 'passive', uses: 3, fx: '#e05a71', tier: 2,
           desc: '被收租 ≥¥1000 时自动减免 36%' },
  pharm: { id: 'pharm', name: '药学',   icon: '💊', skill: '对症下药', mode: 'active', uses: 3, fx: '#57c1a0', tier: 2,
           desc: '发动后立刻 +¥550，本轮内被收租减免 55%' },
  law:   { id: 'law',   name: '法学',   icon: '⚖️', skill: '法律援助', mode: 'passive', uses: 3, fx: '#8a6fd1', tier: 2,
           desc: '免疫 3 次不利判定（被拆地 / 拆房 / 损失地皮 / 留级 / 陷害）' },
  arch:  { id: 'arch',  name: '建筑',   icon: '🏗️', skill: '造价管理', mode: 'passive', uses: 3, fx: '#d08531', tier: 2,
           desc: '升级房产时费用自动 −32%' },
  chem:  { id: 'chem',  name: '化学',   icon: '🧪', skill: '催化加成', mode: 'passive', uses: 3, fx: '#7bbf3f', tier: 2,
           desc: '单笔收租 ≥¥1000 时自动 +36%' },
  auto:  { id: 'auto',  name: '自动化', icon: '🤖', skill: '流水线', mode: 'active', uses: 3, fx: '#5a7fd6', tier: 2,
           desc: '发动后本回合移动 +2 步；若落在自己的地产上再 +¥820' },
  ee:    { id: 'ee',    name: '微电子', icon: '🔌', skill: '信号增益', mode: 'passive', uses: 4, fx: '#00a8b5', tier: 2,
           desc: '每次经过起点自动 +¥1250' },
  math:  { id: 'math',  name: '数学',   icon: '📐', skill: '精算砍价', mode: 'passive', uses: 3, fx: '#5f9ea0', tier: 2,
           desc: '买入地产时自动 8.2 折' },
  agri:  { id: 'agri',  name: '农学',   icon: '🌾', skill: '春华秋实', mode: 'passive', uses: 3, fx: '#8fbf4a', tier: 2,
           desc: '每次经过起点自动 +¥1350' },
  stat:  { id: 'stat',  name: '统计',   icon: '📊', skill: '数据洞察', mode: 'passive', uses: 4, fx: '#4f9ad1', tier: 2,
           desc: '掷骰点数 ≤5 时自动 +¥730' },
  pe:    { id: 'pe',    name: '体育',   icon: '🏀', skill: '体能优势', mode: 'passive', uses: 4, fx: '#e0803f', tier: 2,
           desc: '掷骰点数 ≤5 时自动多走 2 步，并额外 +¥360' },
  phil:  { id: 'phil',  name: '哲学',   icon: '🏛️', skill: '批判思维', mode: 'passive', uses: 3, fx: '#8a7f9a', tier: 2,
           desc: '免疫 3 次不利判定（被拆地 / 拆房 / 损失地皮 / 留级 / 陷害）' },
  mil:   { id: 'mil',   name: '军事',   icon: '🎖️', skill: '战术压制', mode: 'passive', uses: 3, fx: '#7d8a3a', tier: 2,
           desc: '擂台对决时点数 +1；获胜再额外 +¥460' },
  phys:  { id: 'phys',  name: '物理',   icon: '⚛️', skill: '守恒定律', mode: 'passive', uses: 3, fx: '#3f7fd6', tier: 2,
           desc: '被收租 ≥¥1200 时自动减免 32%' },
  lang:  { id: 'lang',  name: '外国语', icon: '🌍', skill: '多语种优势', mode: 'passive', uses: 3, fx: '#c86a3f', tier: 2,
           desc: '抽到正面机会卡时自动 +¥820' },
  art:   { id: 'art',   name: '艺术',   icon: '🎨', skill: '灵感迸发', mode: 'passive', uses: 3, fx: '#d1568f', tier: 2,
           desc: '抽到正面机会卡时自动 +¥730' },
  mse:   { id: 'mse',   name: '材料科学', icon: '🧱', skill: '相变强化', mode: 'active', uses: 3, fx: '#9a7b5a', tier: 2,
           desc: '发动后本轮内自己所有地产的收租 +55%' },
  env:   { id: 'env',   name: '环境科学', icon: '♻️', skill: '循环利用', mode: 'passive', uses: 4, fx: '#3fa76a', tier: 2,
           desc: '每次被收租都自动减免 13%（无门槛）' },
  civil: { id: 'civil', name: '土木工程', icon: '🏗️', skill: '基建加固', mode: 'passive', uses: 3, fx: '#a8823f', tier: 2,
           desc: '自己的地产免于被拆除；升级房产费用 −18%' },
  // ===== 第三梯队（特色向 / 小额高频）=====
  geol:  { id: 'geol',  name: '地质',   icon: '🗺️', skill: '勘探评估', mode: 'passive', uses: 3, fx: '#8a7b52', tier: 3,
           desc: '买入无主地产时自动 9.1 折' },
  aero:  { id: 'aero',  name: '航天',   icon: '🛰️', skill: '一飞冲天', mode: 'passive', uses: 3, fx: '#5468a8', tier: 3,
           desc: '进入岔路时自动 +¥900' },
  bio:   { id: 'bio',   name: '生命科学', icon: '🧬', skill: '细胞增殖', mode: 'passive', uses: 4, fx: '#5aa9d6', tier: 3,
           desc: '自己回合开始时现金 +3.5%' },
  drama: { id: 'drama', name: '戏剧',   icon: '🎭', skill: '全场入戏', mode: 'passive', uses: 3, fx: '#b04a9a', tier: 3,
           desc: '抽到任意机会 / 命运卡时自动 +¥460' },
  music: { id: 'music', name: '音乐',   icon: '🎵', skill: '共鸣演出', mode: 'active', uses: 3, fx: '#d1619a', tier: 3,
           desc: '发动后立刻 +¥900，其他每位玩家各付你 ¥270 出场费' },
  psych: { id: 'psych', name: '心理学', icon: '🧠', skill: '读心术', mode: 'active', uses: 3, fx: '#7a5fc1', tier: 3,
           desc: '发动后从总资产最高的玩家处抽走 ¥1100' },
  news:  { id: 'news',  name: '新闻',   icon: '📰', skill: '独家爆料', mode: 'passive', uses: 3, fx: '#8a8f96', tier: 3,
           desc: '抽到负面卡时自动重抽一次' },
  food:  { id: 'food',  name: '食品科学', icon: '🍜', skill: '能量补给', mode: 'passive', uses: 4, fx: '#d1873f', tier: 3,
           desc: '每次被罚停留休整时自动 +¥640' },
  marine:{ id: 'marine',name: '海洋科学', icon: '🌊', skill: '深海资源', mode: 'passive', uses: 3, fx: '#2f8fbf', tier: 3,
           desc: '每次经过起点自动 +¥1100' },

  // ==================== v5.3 新增 27 个专业（覆盖面更广） ====================
  // 说明：为了让新专业「加得进去、又不碰坏老专业」，v5.3 给 MAJORS 增加了一批
  // **数据驱动字段**（salary / turnPct / lowRoll / rentGain / tollCut / buyCut /
  // buildCut / mortgageUp / cardPos / cardAny / duelPip / branch / stayCash /
  // immuneN / weather / rerollFree / noDemolish …）。老专业走原来的硬编码分支不动，
  // 新专业只填表 + 通用层统一读取，互不干扰。
  // ===== 工科 / 信息技术 =====
  elec:  { id: 'elec',  name: '电气工程',   icon: '⚡', skill: '峰谷套利', mode: 'active', uses: 3, fx: '#f0b429', tier: 2,
           desc: '发动后立刻 +¥1150，本回合买地 6.4 折' },
  comm:  { id: 'comm',  name: '通信工程',   icon: '📡', skill: '信号覆盖', mode: 'passive', uses: 4, fx: '#3aa0d8', tier: 2,
           desc: '每次经过起点 +¥1100；每抽到任意卡 +¥270',
           salary: { amt: 1100, use: true }, cardAny: 270 },
  ctrl:  { id: 'ctrl',  name: '控制科学',   icon: '🎛️', skill: '闭环调节', mode: 'passive', uses: 3, fx: '#5b7fd1', tier: 2,
           desc: '单笔收租 ≥¥1200 时 +27%；被收租 ≥¥1200 时减免 23%',
           rentGain: { min: 1200, pct: 0.27 }, tollCut: { min: 1200, pct: 0.23 } },
  robot: { id: 'robot', name: '机器人工程', icon: '🦾', skill: '机械臂协作', mode: 'active', uses: 3, fx: '#e2663f', tier: 2,
           desc: '发动后本回合盖房 −55%，并立刻 +¥900' },
  se:    { id: 'se',    name: '软件工程',   icon: '⌨️', skill: '敏捷迭代', mode: 'passive', uses: 4, fx: '#4a90d9', tier: 2,
           desc: '每局 4 次免费重投骰子（不用付 ¥1200）',
           rerollFree: true },
  ai:    { id: 'ai',    name: '人工智能',   icon: '🧠', skill: '模型推理', mode: 'active', uses: 3, fx: '#7a5fc1', tier: 2,
           desc: '发动后本轮收租 +32%，并从总资产最高者处取 ¥730' },
  imes:  { id: 'imes',  name: '智能制造',   icon: '🏭', skill: '柔性产线', mode: 'passive', uses: 3, fx: '#7b8fa8', tier: 2,
           desc: '升级房产 −23%；每次升级成功再 +¥460',
           buildCut: 0.23, buildCash: 460 },
  power: { id: 'power', name: '能源与动力', icon: '🔥', skill: '热机循环', mode: 'passive', uses: 4, fx: '#e07a3f', tier: 2,
           desc: '每轮开局 +¥360；每次经过起点 +¥730',
           turnCash: 360, salary: { amt: 730, use: true } },
  // ===== 理科 / 地球科学 =====
  astro: { id: 'astro', name: '天文学',     icon: '🔭', skill: '眺望星河', mode: 'passive', uses: 3, fx: '#5468a8', tier: 2,
           desc: '掷骰点数 ≥9 时自动 +¥1000',
           highRoll: { min: 9, amt: 1000 } },
  meteo: { id: 'meteo', name: '气象学',     icon: '🌦️', skill: '预报风向', mode: 'passive', uses: 4, fx: '#4f9ad1', tier: 2,
           desc: '恶劣天气（雨/台风/雪/雾）里自己回合开始 +¥640',
           weather: { kinds: ['rain', 'storm', 'snow', 'fog'], amt: 640 } },
  geop:  { id: 'geop',  name: '地球物理',   icon: '🌏', skill: '地层探测', mode: 'passive', uses: 3, fx: '#8a7b52', tier: 2,
           desc: '买入无主地产 8.7 折；每买下一块地再 +¥360',
           buyCut: 0.13, buyCash: 360 },
  or:    { id: 'or',    name: '运筹学',     icon: '🧮', skill: '资源调度', mode: 'active', uses: 3, fx: '#5f9ea0', tier: 2,
           desc: '发动后立刻 +¥820，本回合移动 +3 步' },
  // ===== 医农生 =====
  nurs:  { id: 'nurs',  name: '护理学',     icon: '💉', skill: '悉心看护', mode: 'passive', uses: 4, fx: '#e05a9a', tier: 2,
           desc: '被收租 ≥¥800 时自动减免 32%',
           tollCut: { min: 800, pct: 0.32 } },
  dent:  { id: 'dent',  name: '口腔医学',   icon: '🦷', skill: '牙科门诊', mode: 'passive', uses: 3, fx: '#57c1c0', tier: 2,
           desc: '单笔收租 ≥¥1200 时自动 +41%',
           rentGain: { min: 1200, pct: 0.41 } },
  vet:   { id: 'vet',   name: '兽医学',     icon: '🐾', skill: '牲畜保险', mode: 'passive', uses: 3, fx: '#8fbf4a', tier: 2,
           desc: '自己的地产免于被拆除；每次被收租减免 11%',
           noDemolish: true, tollCut: { min: 0, pct: 0.11 } },
  hort:  { id: 'hort',  name: '园艺学',     icon: '🌷', skill: '嫁接育种', mode: 'passive', uses: 3, fx: '#d1568f', tier: 3,
           desc: '每次经过起点 +¥1000；升级房产 −11%',
           salary: { amt: 1000, use: true }, buildCut: 0.11 },
  forest:{ id: 'forest',name: '林学',       icon: '🌲', skill: '封山育林', mode: 'passive', uses: 3, fx: '#3fa76a', tier: 3,
           desc: '每轮开局 +¥320；被罚停留休整时 +¥550',
           turnCash: 320, stayCash: 550 },
  // ===== 人文社科 / 管理 =====
  acc:   { id: 'acc',   name: '会计学',     icon: '🧾', skill: '精算审计', mode: 'passive', uses: 3, fx: '#c9a227', tier: 2,
           desc: '买入地产 8.7 折；被收租 ≥¥1000 时减免 23%',
           buyCut: 0.13, tollCut: { min: 1000, pct: 0.23 } },
  trade: { id: 'trade', name: '国际贸易',   icon: '🚢', skill: '跨境套利', mode: 'passive', uses: 4, fx: '#2f8fbf', tier: 2,
           desc: '每次经过起点 +¥900；每抽到任意卡 +¥320',
           salary: { amt: 900, use: true }, cardAny: 320 },
  mkt:   { id: 'mkt',   name: '市场营销',   icon: '📣', skill: '带货直播', mode: 'active', uses: 3, fx: '#e0803f', tier: 2,
           desc: '发动后立刻 +¥1100，其他每位玩家再各付你 ¥230' },
  hr:    { id: 'hr',    name: '人力资源管理', icon: '🧑‍💼', skill: '团队激励', mode: 'passive', uses: 3, fx: '#a8823f', tier: 3,
           desc: '回合开始时现金 +2.5%；被罚停留休整时 +¥640',
           turnPct: 0.025, stayCash: 640 },
  tourism:{ id: 'tourism', name: '旅游管理', icon: '🧳', skill: '导游外快', mode: 'passive', uses: 3, fx: '#c86a3f', tier: 3,
           desc: '进入岔路时 +¥820；每次经过起点 +¥640',
           branch: 820, salary: { amt: 640, use: true } },
  edu:   { id: 'edu',   name: '教育学',     icon: '📚', skill: '因材施教', mode: 'passive', uses: 4, fx: '#9a7b5a', tier: 3,
           desc: '每轮开局 +¥320；抽到负面卡时自动重抽（4 次）',
           turnCash: 320, negReroll: true },
  hist:  { id: 'hist',  name: '历史学',     icon: '🏺', skill: '考古发现', mode: 'passive', uses: 3, fx: '#a8823f', tier: 3,
           desc: '掷骰点数 ≤4 时发掘出文物 +¥820；买入无主地产 9.1 折',
           lowRoll: { max: 4, amt: 820 }, buyCut: 0.09 },
  soc:   { id: 'soc',   name: '社会学',     icon: '🧑‍🤝‍🧑', skill: '田野调查', mode: 'passive', uses: 3, fx: '#8a7f9a', tier: 3,
           desc: '每抽到一张机会 / 命运卡 +¥410',
           cardAny: 410 },
  // ===== 艺术 / 设计 / 传媒 =====
  design:{ id: 'design',name: '工业设计',   icon: '🖌️', skill: '人机工学', mode: 'passive', uses: 3, fx: '#d1619a', tier: 3,
           desc: '升级房产 −16%；买入地产 −7%',
           buildCut: 0.16, buyCut: 0.07 },
  film:  { id: 'film',  name: '影视传媒',   icon: '🎬', skill: '院线首映', mode: 'active', uses: 3, fx: '#b04a9a', tier: 2,
           desc: '发动后立刻 +¥1350，本轮自己收租 +23%' },
};
const MAJOR_KEYS = [
  'mech', 'newe', 'fin', 'cs',
  'econ', 'med', 'pharm', 'law', 'arch', 'chem', 'auto', 'ee', 'math', 'agri', 'stat', 'pe', 'phil', 'mil', 'phys', 'lang', 'art', 'mse', 'env', 'civil',
  'geol', 'aero', 'bio', 'drama', 'music', 'psych', 'news', 'food', 'marine',
  // v5.3 新增 27 个
  'elec', 'comm', 'ctrl', 'robot', 'se', 'ai', 'imes', 'power',
  'astro', 'meteo', 'geop', 'or',
  'nurs', 'dent', 'vet', 'hort', 'forest',
  'acc', 'trade', 'mkt', 'hr', 'tourism', 'edu', 'hist', 'soc',
  'design', 'film',
];

// ---------- 成就 ----------
const ACHS = {
  monopoly: { name: '包场王',   desc: '凑齐一个色组',        reward: 1500 },
  hotel:    { name: '五星酒店', desc: '建成第一座旅馆',      reward: 2000 },
  rent10k:  { name: '收租之王', desc: '单次收租破万',        reward: 1000 },
  tycoon:   { name: '地产大亨', desc: '同时拥有 8 块地产',   reward: 2000 },
  combo3:   { name: '三连收租', desc: '连续 3 次收租',       reward: 1200 },
  assassin: { name: '终结者',   desc: '送走一名对手',        reward: 2500 },
  richest:  { name: '校园首富', desc: '现金突破 ¥100000',    reward: 3000 },
};

// ---------- 掷骰前可购买的一次性道具（v4.0：幸运骰改为掷后付费重投，见 doReroll） ----------
const ITEMS = {
  shield: { id: 'shield', name: '免罚符', icon: '🛡️', desc: '本回合踩到他人地产免租，价格随轮数上涨' },
};

// ---------- v5.1：效果卡池（校园商城 / 校庆礼品屋 随机抽取 1~2 张） ----------
const EFFECT_CARDS = [
  // v5.8：卡池重做 —— 删去「免租券」与「免罚符」，所有卡均可保留到条件满足时自动使用
  { id: 'medal',     name: '免租金卡',        icon: '🎫', desc: '保留到下次应付租金时自动消耗（可叠加持有）' },
  { id: 'skill',     name: '技能次数 +1',     icon: '✨', desc: '本局专业技剩余次数 +1' },
  { id: 'discount',  name: '买地皮 8 折卡',   icon: '🏷️', desc: '保留到下次买地时自动 8 折' },
  { id: 'buildcut',  name: '盖房 9 折卡',     icon: '🔨', desc: '保留到下次盖房 / 升级时自动 9 折' },
  { id: 'step',      name: '加速卡',          icon: '👟', desc: '保留到下一次移动，额外 +4 步' },
  { id: 'cash',      name: '现金红包',        icon: '🧧', desc: '立刻到账 ¥800' },
  { id: 'stayfree',  name: '免停留卡',        icon: '🎯', desc: '保留到下次纯惩罚性停留时自动消耗（罚款照付）' },
  { id: 'finefree',  name: '免罚款卡',        icon: '📜', desc: '保留到下次缴纳「非租金罚款」时自动免除' },
  { id: 'steal',     name: '偷师卡',          icon: '🕵️', desc: '立刻随机偷取一名玩家 1 次技能使用次数' },
];

// ---------- 卡牌（30 机会 + 30 命运） ----------
// kind: money(+收/-付) / moveTo / move / each(每位玩家±) / skip / discount
const CHANCE = [
  { name: '神仙座位', desc: '抢到图书馆四楼靠窗座位，前进 3 格', kind: 'move', steps: 3 },
  { name: '教授的召唤', desc: '教授半夜发消息"明天来办公室一趟"——立即移动到「天津大学」', kind: 'moveTo', cell: 26, salary: false },
  { name: '科研经费到账', desc: '收 ¥2000', kind: 'money', amount: 2000 },
  { name: '国奖到账', desc: '国家奖学金发放，收 ¥5000', kind: 'money', amount: 5000 },
  { name: '抢课手速王', desc: '可立即以 8 折购入任意一块无主地产；放弃则收 ¥500 安慰奖', kind: 'discount' },
  { name: '抢到车票', desc: '直接移动到起点，领工资', kind: 'moveTo', cell: 0, salary: true },
  { name: '新窗口试吃', desc: '食堂新窗口开业请你试吃，每位玩家给你 ¥400', kind: 'each', amount: 400, dir: 'in' },
  { name: '拼单奶茶', desc: '拼单拼成"单王"，每位玩家给你 ¥300', kind: 'each', amount: 300, dir: 'in' },
  { name: '勤工俭学', desc: '助管工资到账，收 ¥1500', kind: 'money', amount: 1500 },
  { name: '体育满分', desc: '体测满分，收 ¥1400', kind: 'money', amount: 1400 },
  { name: '校友基金', desc: '校友捐赠抽奖抽中你，收 ¥3000', kind: 'money', amount: 3000 },
  { name: '书院下午茶', desc: '书院咖啡券到账，收 ¥850', kind: 'money', amount: 850 },
  { name: '单车爆胎', desc: '共享单车爆胎，后退 3 格', kind: 'move', steps: -3 },
  { name: '空调罢工', desc: '宿舍空调坏了，支付 ¥700 维修费', kind: 'money', amount: -700 },
  { name: '步数霸榜', desc: '微信运动全校第一，收 ¥1100', kind: 'money', amount: 1100 },
  { name: '赶飞机', desc: '立即移动到任意一个机场（不领工资）', kind: 'moveAnyTrans' },
  { name: '室友带饭', desc: '室友承包一个月饭卡——免租金卡：下次应付租金全免', kind: 'medal' },
  { name: '论文接收', desc: '论文被顶刊接收，收 ¥4000', kind: 'money', amount: 4000 },
  { name: '阿姨手抖', desc: '食堂阿姨手不抖了，多打一勺红烧肉，心情大好，收 ¥400', kind: 'money', amount: 400 },
  { name: '二手书出清', desc: '期末摆摊卖教材，收 ¥1200', kind: 'money', amount: 1200 },
  { name: '顺风拼车', desc: '顺风车捎同学回本部，每位玩家付你 ¥550', kind: 'each', amount: 550, dir: 'in' },
  { name: '电竞校队', desc: '试训通过，收 ¥2000', kind: 'money', amount: 2000 },
  { name: '问卷羊毛', desc: '填一下市场调研问卷，收 ¥700', kind: 'money', amount: 700 },
  { name: '坐过站了', desc: '机场摆渡车睡过头，后退 4 格', kind: 'move', steps: -4 },
  { name: '社团招新', desc: '摆摊招新，每位玩家付你 ¥400 摊位赞助费', kind: 'each', amount: 400, dir: 'in' },
  { name: '岁月静好', desc: '今天的校园：什么都没发生，岁月静好', kind: 'money', amount: 0 },
  { name: '助教加急', desc: '帮老师批改作业加急费，收 ¥1800', kind: 'money', amount: 1800 },
  { name: '拾金不昧', desc: '捡到钱包上交失物招领，失主酬谢 ¥2000', kind: 'money', amount: 2000 },
  { name: '毕业旅行考察', desc: '提前考察毕业旅行路线，前进 5 格', kind: 'move', steps: 5 },
  { name: '毕业典礼彩排', desc: '被抽中去毕业典礼彩排，立即移动到「武汉大学」', kind: 'moveTo', cell: 34, salary: false },
  { name: '悬赏令', desc: '发布悬赏：向当前最富有的玩家收取 ¥1500 赏金', kind: 'bounty', amount: 1500 },
  { name: '校友饭卡', desc: '校友回校请你吃饭，收 ¥1600', kind: 'money', amount: 1600 },
  { name: '抢到自习室', desc: '欧气爆棚抢到唯一位子，立即前进 4 格', kind: 'move', steps: 4 },
  // ---- 新增：负面为主 ----
  { name: '室友借笔记不还', desc: '借出去的笔记再也没回来，后退 2 格', kind: 'move', steps: -2 },
  { name: '组会连开三天', desc: '被导师连开三天组会，支付 ¥1250 精神损失费', kind: 'money', amount: -1250 },
  { name: '选课全被踢', desc: '三轮选课全被踢出，支付 ¥850 抢课脚本费', kind: 'money', amount: -850 },
  { name: '请全实验室喝奶茶', desc: '嘴欠答应了请客，每位玩家付 ¥350', kind: 'each', amount: 350, dir: 'out' },
  { name: '社团活动超支', desc: '活动经费超支要你垫，支付 ¥1200', kind: 'money', amount: -1200 },
  { name: '校园改造拆地', desc: '规划改造：地皮最多的人被拆掉一块地皮（归还银行）', kind: 'demolishLand' },
  { name: '违建被举报', desc: '有人举报违建：房子最多的人被拆掉一栋房', kind: 'demolishHouse' },
  { name: 'DIY 盖房', desc: '动手能力爆棚，免费给自己一块地盖一栋房', kind: 'selfBuild' },
  { name: '学弟学妹来帮忙', desc: '房子最少的人获得帮忙，免费盖一栋房', kind: 'poorestBuild' },
  { name: '工地噪音', desc: '隔壁工地通宵施工，支付 ¥700 耳塞与民宿钱', kind: 'money', amount: -700 },
  { name: '末班车坐反', desc: '末班摆渡车坐反方向，后退 3 格', kind: 'move', steps: -3 },
  { name: '代课被记', desc: '帮人代课被抓，支付 ¥1000', kind: 'money', amount: -1000 },
  // ---- 新增：翻盘与首富税 ----
  { name: '励志奖学金', desc: '总资产最低的同学喜提励志奖学金 ¥3000（学校资助）', kind: 'poorestMoney', amount: 3000 },
  { name: '校友结对帮扶', desc: '校友会结对帮扶：总资产最低的同学向其他每位玩家收 ¥500', kind: 'poorestEach', amount: 500 },
  { name: '财务突击查账', desc: '财务处突击查账：总资产最高的玩家向教育基金池支付 ¥2500', kind: 'richPayPool', amount: 2500 },
  { name: '资产评估征税', desc: '年度资产评估：总资产最高的玩家缴纳总资产的 10%（进教育基金池，现金不够会被迫抵押！）', kind: 'richPayPct', pct: 10, base: 'net' },
  // ---- v5.0 新增：更多有趣的机会 ----
  { name: '一等奖学金', desc: '拿下校级一等奖学金，收 ¥3500', kind: 'money', amount: 3500 },
  { name: '论文被引破百', desc: '论文被引破百，学校额外奖励 ¥2800', kind: 'money', amount: 2800 },
  { name: '实习转正', desc: '实习单位当场发转正 offer 并预付安家费，收 ¥3200', kind: 'money', amount: 3200 },
  { name: '宿舍团建 AA', desc: '宿舍团建 AA，每位玩家给你 ¥300', kind: 'each', amount: 300, dir: 'in' },
  { name: '校园马拉松冠军', desc: '校园马拉松夺冠，收 ¥2200', kind: 'money', amount: 2200 },
  { name: '直播带货翻车', desc: '帮学院直播带货翻了车，赔付 ¥1800', kind: 'money', amount: -1800 },
  { name: '低买高卖赚差价', desc: '二手显示器低买高卖，赚 ¥1600', kind: 'money', amount: 1600 },
  { name: '学霸笔记畅销', desc: '整理的学霸笔记被疯抢，收 ¥2400', kind: 'money', amount: 2400 },
  { name: '导师发红包', desc: '导师在群里发了红包，收 ¥999', kind: 'money', amount: 999 },
  { name: '设备招标中签', desc: '科研设备招标中签，省下的经费归你，收 ¥2600', kind: 'money', amount: 2600 },
  { name: '早八睡过头', desc: '早八没爬起来被点名，支付 ¥900', kind: 'money', amount: -900 },
  { name: '公交卡五折月', desc: '公交卡五折活动退款，收 ¥1200', kind: 'money', amount: 1200 },
  // ---- v5.1 新增玩法 ----
  { name: '转专业成功', desc: '抓住机会转专业成功：随机换一个新专业，技能次数重置', kind: 'majorSwitch', good: true },
  { name: '校庆大抽奖', desc: '校庆抽奖：随机抽取 1~2 张效果卡（免租金卡 / 技能次数 +1 …）', kind: 'drawCards' },
  { name: '选课加权', desc: '抢到带加权的选修课：接下来三次移动各 +2 步', kind: 'stepQueue', steps: 2, times: 3 },
  { name: '实验室结题分红', desc: '课题顺利结题：获得现金的 8%（最多 ¥2000）', kind: 'pctGain', pct: 0.08, cap: 2000 },
];
const FATE = [
  { name: '挂科预警', desc: '支付 ¥1400 重修费', kind: 'money', amount: -1400 },
  { name: '电脑蓝屏', desc: '论文没保存，支付 ¥1100', kind: 'money', amount: -1100 },
  { name: '校园卡丢了', desc: '支付 ¥400 补办', kind: 'money', amount: -400 },
  { name: '食堂涨价', desc: '全体玩家各支付 ¥700', kind: 'each', amount: 700, dir: 'out' },
  { name: '宿舍养猫', desc: '被楼管阿姨发现，社死名场面——停留一回合', kind: 'skip' },
  { name: '查重通过', desc: '查重率仅 2%，导师大喜，收 ¥1500', kind: 'money', amount: 1500 },
  { name: '生日快乐', desc: '宿友凑份子，每位玩家送你 ¥400', kind: 'each', amount: 400, dir: 'in' },
  { name: '试剂打翻', desc: '实验室试剂打翻，支付 ¥1500', kind: 'money', amount: -1500 },
  { name: '快递丢件', desc: '驿站丢件，支付 ¥550', kind: 'money', amount: -550 },
  { name: '忘带伞', desc: '大雨被困教学楼，停留一回合', kind: 'skip' },
  { name: '校医院排队', desc: '排队三小时，支付 ¥850 挂号费', kind: 'money', amount: -850 },
  { name: '实习工资', desc: '实习工资到账，收 ¥3000', kind: 'money', amount: 3000 },
  { name: '断电断网', desc: '宿舍跳闸，跳过下一回合', kind: 'skip' },
  { name: '帮取快递', desc: '帮教授跑腿，收 ¥700', kind: 'money', amount: 700 },
  { name: '歌赛夺冠', desc: '十大歌手夺冠，收 ¥2000', kind: 'money', amount: 2000 },
  { name: '退货成功', desc: '七天无理由退货，收 ¥550', kind: 'money', amount: 550 },
  { name: '奖学金公示', desc: '每位玩家支付你 ¥300（恭喜）', kind: 'each', amount: 300, dir: 'in' },
  { name: '赶 due', desc: '半夜赶 due，支付 ¥700 咖啡钱', kind: 'money', amount: -700 },
  { name: '违规电器', desc: '宿舍被查收热得快，支付 ¥400 罚款', kind: 'money', amount: -400 },
  { name: '洗衣机排队', desc: '排队两小时还没轮到，停留一回合', kind: 'skip' },
  { name: '六级报名', desc: '又到了四六级报名的日子，支付 ¥400', kind: 'money', amount: -400 },
  { name: '外卖洒了', desc: '骑手小哥道歉再赔一份，支付 ¥350', kind: 'money', amount: -350 },
  { name: '演唱会学生票', desc: '抢到学生票转手出了，赚 ¥1500', kind: 'money', amount: 1500 },
  { name: '导师画饼成真', desc: '说好的科研补贴真的到账了，收 ¥2500', kind: 'money', amount: 2500 },
  { name: '体测 1000 米', desc: '跑完瘫在操场，支付 ¥550 运动饮料钱', kind: 'money', amount: -550 },
  { name: '室友中奖', desc: '室友抽奖中了请全宿舍吃饭，每位玩家给你 ¥550', kind: 'each', amount: 550, dir: 'in' },
  { name: '占座被抓', desc: '图书馆占座被巡查抓到，支付 ¥300 并后退 2 格', kind: 'money', amount: -300, thenMove: -2 },
  { name: '天降门票', desc: '在自习室捡到没人认领的演出票，收 ¥2000', kind: 'money', amount: 2000 },
  { name: '水卡充值', desc: '水卡充值满赠活动，收 ¥1100', kind: 'money', amount: 1100 },
  { name: '期末通宵', desc: '期末周连肝三夜，考完补觉，跳过下一回合', kind: 'skip' },
  { name: '被人打小报告', desc: '被人匿名举报，下回合移动 -3 格', kind: 'sabotage', steps: -3 },
  { name: '校园卡消费记录', desc: '导员查账发现你点太多外卖，支付 ¥1000', kind: 'money', amount: -1000 },
  { name: '食堂新菜踩雷', desc: '点了新品黑暗料理，支付 ¥500 医药费', kind: 'money', amount: -500 },
  // ---- 新增：负面为主 ----
  { name: '论文被拒三次', desc: '投稿连续被拒，支付 ¥1500 版面费与重做费', kind: 'money', amount: -1500 },
  { name: '宿舍调整', desc: '被通知搬宿舍，支付 ¥1100 搬运费', kind: 'money', amount: -1100 },
  { name: '手机碎屏', desc: '手滑摔碎屏幕，支付 ¥1250 维修费', kind: 'money', amount: -1250 },
  { name: '考勤不合格', desc: '旷课太多，支付 ¥1400 补考与重修费', kind: 'money', amount: -1400 },
  { name: '资金链断裂', desc: '被迫变卖资产：自己失去一块地皮（归还银行）', kind: 'selfLoseLand' },
  { name: '老房子失修', desc: '年久失修必须拆除：自己拆掉一栋房子', kind: 'selfLoseHouse' },
  { name: '宿舍大检查', desc: '全体被查违规电器，各支付 ¥500 进教育基金池', kind: 'taxAll', amount: 500 },
  { name: '诸事不顺', desc: '霉运缠身，挂科留级一回合', kind: 'jailSelf' },
  { name: 'idea 被抢发', desc: '课题被人抢先发表，支付 ¥1300 重做实验', kind: 'money', amount: -1300 },
  { name: '食堂吃出问题', desc: '食物中毒去医院，支付 ¥1000', kind: 'money', amount: -1000 },
  { name: '被扣奖学金', desc: '因违纪被扣发奖学金，支付 ¥1500', kind: 'money', amount: -1500 },
  { name: '室友半夜开派对', desc: '吵得整夜没睡，停留一回合', kind: 'skip' },
  { name: '实验设备损坏', desc: '操作失误弄坏仪器，支付 ¥1800 赔偿', kind: 'money', amount: -1800 },
  // ---- 新增：翻盘与首富税 ----
  { name: '助学贷款豁免', desc: '政策利好：总资产最低的同学的助学贷款被豁免，收 ¥2500', kind: 'poorestMoney', amount: 2500 },
  { name: '慈善晚宴募捐', desc: '慈善晚宴：总资产最高的玩家向教育基金池捐款 ¥3000', kind: 'richPayPool', amount: 3000 },
  { name: '高消费预警', desc: '被大数据盯上高额消费：总资产最高的玩家缴纳手头现金的 20% 进教育基金池', kind: 'richPayPct', pct: 20, base: 'cash' },
  // ---- v5.0 新增：更多有趣的命运 ----
  { name: '盲审一次性通过', desc: '毕业论文盲审一次通过，收 ¥3500', kind: 'money', amount: 3500 },
  { name: '保研上岸', desc: '保研成功，亲友红包累计 ¥4000', kind: 'money', amount: 4000 },
  { name: '创业大赛金奖', desc: '创业大赛夺金，奖金 ¥3800', kind: 'money', amount: 3800 },
  { name: '室友失恋请客', desc: '室友失恋请你吃饭，每位玩家付你 ¥350', kind: 'each', amount: 350, dir: 'in' },
  { name: '实验室搬家', desc: '实验室整体搬家，出钱请搬运 ¥1600', kind: 'money', amount: -1600 },
  { name: '硬盘损坏', desc: '硬盘损坏数据全丢，重做花费 ¥2200', kind: 'money', amount: -2200 },
  { name: '被导师留堂', desc: '讨论卡了半天没结果，挂科留级一回合', kind: 'jailSelf' },
  { name: '换季感冒', desc: '换季感冒跑医院，支付 ¥1100', kind: 'money', amount: -1100 },
  { name: '校招笔试迟到', desc: '校招笔试睡过头，错失机会，损失 ¥1700', kind: 'money', amount: -1700 },
  { name: '校园网断线', desc: '校园网断了一整周，流量费 ¥800', kind: 'money', amount: -800 },
  { name: '抢到演唱会票', desc: '抢到热门演唱会门票转手，赚 ¥2400', kind: 'money', amount: 2400 },
  { name: '同学借钱不还', desc: '借出去的钱打了水漂，损失 ¥1300', kind: 'money', amount: -1300 },
  // ---- v5.1 新增玩法 ----
  { name: '被强制转专业', desc: '被调剂到冷门专业：随机换一个专业，技能次数重置', kind: 'majorSwitch' },
  { name: '宿舍失窃', desc: '宿舍遭窃：损失现金的 12%（最多 ¥2500）', kind: 'pctLose', pct: 0.12, cap: 2500 },
  { name: '校园卡冻结', desc: '补助发放延迟：接下来两次移动各 −2 步', kind: 'stepQueue', steps: -2, times: 2 },
  { name: '选课全被退', desc: '手滑退掉必修课：立即失去一张效果卡（免租金卡优先，其次免租券）', kind: 'loseCard' },
];

// ---------- v5.2：校园风貌（金铲铲「城邦」机制的校园化移植） ----------
// 机制（对应设计提案 1.1 节）：开局随机给出 3 个候选 → 全体玩家各投 1 票 → 随机抽一名玩家，
//   他所投的风貌成为本局风貌，全场共享、贯穿整局。（按用户要求采用「随机抽取」而非多数决。）
// 结构：每个风貌 = 1 个主效果（lead）+ 1 个代价（cost），无一纯赚；
//   全局幅度控制在「整局 ±¥3000~6000」（约一局总资产的 5%），且不在既有租金乘数上叠新系数。
const FACULTY = {
  urban:    { name: '都市校区',   icon: '🏙️', color: '#4A90D9', lead: '经过起点工资 ¥2250（+250）',           cost: '所有地皮买入价 +3%',              tag: '钱来得快，地也贵' },
  garden:   { name: '园林校区',   icon: '🌳', color: '#6FAE3F', lead: '所有地皮买入价 −4%',                  cost: '经过起点工资 ¥1800（−200）',       tag: '便宜是便宜，就是远' },
  ancient:  { name: '百年学府',   icon: '🏛️', color: '#C8941F', terms: [1, 1], lead: '每 3 轮全场各领 ¥300 校友捐款',         cost: '本届前 3 轮全场租金 ×0.93',         tag: '底蕴要慢慢显（只在第一轮城邦出现）' },
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
  austerity:{ name: '紧缩校区',   icon: '⏰', color: '#6E6C66', terms: [1, 2], lead: '本届免征物业税',                    cost: '银行提前 5 轮停发工资（第 10 轮起）', tag: '勒紧腰带过日子' },
  boom:     { name: '繁荣校区',   icon: '🌇', color: '#C99A3F', terms: [1, 2], lead: '停发工资推迟 5 轮、过起点额外 +¥200',   cost: '所有地皮买入价 +6%',                tag: '日子还长，先涨个价' },
  nofund:   { name: '限薪校区',   icon: '🏚️', color: '#9B3A3A', terms: [1, 2], lead: '全场地价 −12%、升级费 −10%',           cost: '本届起停发起点工资',                tag: '没有工资，全凭本事' },
  retrain:  { name: '进修校区',   icon: '📖', color: '#5548B0', lead: '当选时全场技能次数 +1',                 cost: '所有地皮买入价 +3%',                tag: '多学一门手艺' },
  freeRound:{ name: '免费轮校区', icon: '🎟️', color: '#4E9B2A', lead: '随机 1 轮全场买地、盖楼完全免费',       cost: '全场租金 ×1.08',                    tag: '那一轮，随便花' },
  freeRent: { name: '免租轮校区', icon: '🕊️', color: '#3FBF9E', lead: '随机 4 轮全场所有人免交租金',           cost: '其余轮次全场租金 ×1.05',            tag: '这四轮，谁也别想收租' },
  // ===== v5.10 新增：「海克斯定调」六城（只在第一轮城邦推选出现，且候选权重更高） =====
  hxPrism:  { name: '彩霞之城',   icon: '🌈', color: '#B76CE8', hexTheme: 1, terms: [1, 1], lead: '本局海克斯前三次必出国家级（棱彩）',  cost: '全场租金 ×1.05',                    tag: '天降紫雨，只下前三发' },
  hxSilver: { name: '白银学城',   icon: '⚪', color: '#8FA6BF', hexTheme: 1, terms: [1, 1], lead: '本局海克斯前三次必出校级（银）',      cost: '所有地皮买入价 +3%',                tag: '稳扎稳打，从不惊喜' },
  hxGold:   { name: '黄金学府',   icon: '🟡', color: '#E8B04B', hexTheme: 1, terms: [1, 1], lead: '本局海克斯前三次必出省级（金）',      cost: '全场租金 ×1.04',                    tag: '含金量直接拉满' },
  hxMix:    { name: '极光之城',   icon: '🌌', color: '#7B68EE', hexTheme: 1, terms: [1, 1], lead: '本局海克斯前三次必为银/金/彩各一个',  cost: '物业税起征门槛降低 1',              tag: '雨露均沾，档档来一遍' },
  hex3:     { name: '精研之城',   icon: '🧭', color: '#3FBF9E', hexTheme: 1, terms: [1, 1], lead: '本局海克斯只有 3 次（第 2/10/20 轮）', cost: '此后所有立项机会全部取消——选卡时记得用刷新', tag: '少即是多，张张要紧' },
  hexEarly: { name: '时光之城',   icon: '⏳', color: '#E07A45', hexTheme: 1, terms: [1, 1], lead: '海克斯提前触发：第 2/5/10/20/32/40 轮', cost: '第 40 轮后就再也没有立项机会',      tag: '早起的鸟儿有项目吃' },
  // ===== v5.10 新增：30 个娱乐城邦（一利一弊，幅度克制，主打好玩） =====
  lantern:  { name: '灯会校区',   icon: '🏮', color: '#E8A23F', lead: '每轮开场全场 +¥150 灯会补贴',           cost: '全场租金 ×1.03',                    tag: '张灯结彩，人人有份' },
  midterm:  { name: '期中周校区', icon: '📝', color: '#8E86E0', lead: '每 5 轮全场各缴 ¥400 助学捐款',         cost: '躲不掉——人人有份，直接进基金池',     tag: '谁也别想逃' },
  lottery:  { name: '抽奖校区',   icon: '🎰', color: '#D9437A', lead: '每 3 轮随机 1 人独中 ¥1000',            cost: '其余人各付 ¥100 参与费',            tag: '一夜暴富的梦想还是要有的' },
  oldbook:  { name: '旧书集校区', icon: '📦', color: '#A9682B', lead: '每 3 轮按名下地皮数 ×¥120 摆摊收益',    cost: '基金池上限 −20%',                   tag: '书摊支起来，地越多越赚' },
  nightowl: { name: '夜猫校区',   icon: '🌙', color: '#5548B0', lead: '每轮开场现金最少者 +¥600',              cost: '现金最多者缴 ¥300 进基金池',         tag: '熬夜的人有补贴' },
  shuffle:  { name: '洗牌校区',   icon: '🔀', color: '#2E9BC4', lead: '每 8 轮全场资金随机互转一轮',            cost: '全场租金 ×1.02',                    tag: '钱在谁手里，全看天意' },
  stampede: { name: '早八校区',   icon: '🌅', color: '#F2B33D', lead: '掷出 7 点 +¥300（准时到教室）',         cost: '掷出 ≤3 点 −¥150（起晚了）',        tag: '早八人的悲欢并不相通' },
  carnival: { name: '嘉年华校区', icon: '🎡', color: '#E2569F', lead: '每轮首次重投免费',                      cost: '全场租金 ×1.05',                    tag: '今天全场都是游乐场' },
  liberal:  { name: '通识校区',   icon: '🎭', color: '#6FAE3F', lead: '每抽一张命运卡 +¥150',                  cost: '机会卡的收益 −8%',                  tag: '命运的馈赠暗中标好了价' },
  dorm:     { name: '宿舍校区',   icon: '🛏️', color: '#B04B2C', lead: '被罚停留时 +¥800 休整补贴',             cost: '所有地皮买入价 +4%',                tag: '躺平也有躺平的收入' },
  runner:   { name: '校车站校区', icon: '🚌', color: '#3F8FBF', lead: '掷出双数时 +¥250（班来得巧）',          cost: '所有地皮买入价 +3%',                tag: '等车的时间也是钱' },
  cafe:     { name: '咖啡校区',   icon: '☕', color: '#8B5A3C', lead: '每 3 轮全场各领 ¥250 咖啡补贴',         cost: '罚款类支出 +10%',                   tag: '续命水，学院报销一半' },
  silent:   { name: '自习校区',   icon: '🤫', color: '#7A8B99', lead: '全场租金 ×0.94',                        cost: '卡牌收益 −10%',                     tag: '安静，但安静得有点穷' },
  gala:     { name: '校友日校区', icon: '🎗️', color: '#C99A3F', lead: '每 5 轮总资产最高者捐 ¥800 进基金池',   cost: '全场租金 ×1.02',                    tag: '成功人士该表示表示了' },
  spring:   { name: '创业热土校区', icon: '🌱', color: '#4E9B2A', lead: '全场建筑升级费 −5%',                  cost: '全场租金 ×1.03',                    tag: '万物生长，施工不停' },
  artfest:  { name: '艺术节校区', icon: '🎪', color: '#9B59B6', lead: '效果卡盲盒每次多抽 1 张',               cost: '基金池上限 −10%',                   tag: '艺术无价，池子有价' },
  metro:    { name: '地铁校区',   icon: '🚇', color: '#2E7BC4', lead: '机场路费 ×0.85',                        cost: '文印店/快递租金 ×1.15',             tag: '机场快了，驿站贵了' },
  scholar:  { name: '讲座校区',   icon: '🎤', color: '#1FA37A', lead: '每 3 轮随机 1 人技能次数 +1',           cost: '其余人各付 ¥150 讲座门票',          tag: '听讲座也能涨本事' },
  market:   { name: '市集校区',   icon: '🧺', color: '#D98E2B', lead: '每 4 轮全场各领 ¥200 摊位分红',         cost: '所有地皮买入价 +2%',                tag: '摆摊的自由，买地的代价' },
  snowville:{ name: '冰雪校区',   icon: '❄️', color: '#7FB3D9', lead: '雨/雾/雪/台风天全场各 +¥250',           cost: '晴/烈日天全场各 −¥150',             tag: '怕冷的来，怕热的绕道' },
  veteran:  { name: '老生校区',   icon: '🎓', color: '#6B8E23', lead: '当选时全场各领 1 张免租金卡',           cost: '所有地皮买入价 +5%',                tag: '学长学姐的传家宝' },
  freshman: { name: '新生校区',   icon: '🍼', color: '#F4A460', lead: '当选时全场各领 ¥1500 迎新红包',         cost: '第 10 轮起每 3 轮各缴 ¥300 社团费',  tag: '先甜后苦，年轻的代价' },
  dicegod:  { name: '骰神校区',   icon: '🎲', color: '#E67E22', lead: '每轮开场随机 1 人移动 +2 步',           cost: '被选中者当场付 ¥300 车马费',         tag: '被骰神摸过头' },
  charity:  { name: '公益校区',   icon: '🤲', color: '#E74C3C', lead: '每 5 轮最富者向最穷者转 ¥600',          cost: '全场租金 ×1.02',                    tag: '先富带后富' },
  professor:{ name: '名师校区',   icon: '👨‍🏫', color: '#34495E', lead: '每 3 轮随机 1 人免费盖一栋房',         cost: '全场租金 ×1.04',                    tag: '名师亲自监工' },
  cram:     { name: '补习街校区', icon: '📐', color: '#16A085', lead: '机会卡的负面金额 −15%',                 cost: '机会卡的正面收益 −8%',              tag: '补课补不出暴富' },
  reunion:  { name: '聚餐校区',   icon: '🍲', color: '#C0392B', lead: '每 4 轮随机 1 人请全场吃饭（每人 +¥150）', cost: '请客的人当场放血 ¥150×人数',        tag: 'AA 是不可能 AA 的' },
  observatory:{ name: '观星校区', icon: '🔭', color: '#2C3E94', lead: '掷出 ≥10 点 +¥400（星象大吉）',        cost: '掷出 ≤4 点 −¥200（乌云蔽月）',      tag: '夜观天象，日进斗金' },
  green:    { name: '环保校区',   icon: '♻️', color: '#27AE60', lead: '全场建筑升级费 −6%',                    cost: '经过起点工资 ¥1850（−150）',        tag: '绿化好了，工资少了' },
  gamble:   { name: '博弈校区',   icon: '🃏', color: '#8E44AD', lead: '擂台/运动会赌注 ×1.25',                 cost: '全场租金 ×1.03',                    tag: '富贵险中求' },
};
const FACULTY_KEYS = Object.keys(FACULTY);
const FACULTY_VOTE_MS = 60000;   // 开局/换届风貌投票时长（v5.12 由 40s 拉长到 60s：59 个城邦的说明更厚，看清楚再投）
const FACULTY_MAX_RARE = 0;      // 本版无稀有风貌（原「变数校区」已按要求删去）

// ---------- v5.7：海克斯 · 研究项目（校级=银 / 省级=金 / 国家级=棱彩） ----------
// 设计约束（对齐《设计提案_城邦与海克斯.md》）：
//  · 全部为被动或「到手即结算」，不做主动技；
//  · 不新增租金乘数——改基准量（工资/补贴/折扣/返现）或一次性效果；
//  · 校级/省级对局势影响刻意做小，国家级允许中等偏大；
//  · 与专业的分工：专业=身份（开局选定），项目=每局随机构筑（中后期获得）。
const HEX_TIERS = {
  silver: { name: '校级项目', short: '校级', icon: '🥈', color: '#8FA6BF' },
  gold:   { name: '省级项目', short: '省级', icon: '🥇', color: '#E8B04B' },
  prism:  { name: '国家级项目', short: '国家级', icon: '💎', color: '#B76CE8' },
};
const PROJECTS = {
  // ===== 校级（银）× 20 =====
  stipend:   { tier: 'silver', icon: '🚶', name: '勤工俭学', desc: '每次经过起点额外 +¥320（限 14 次）', mods: { goCash: 320 }, charges: 14},
  thrift:    { tier: 'silver', icon: '🧾', name: '精打细算',  desc: '盖房费用 −9%', mods: { buildCut: 0.09 } },
  agent:     { tier: 'silver', icon: '🏠', name: '房产中介',  desc: '买入无主地 9.1 折', mods: { buyCut: 0.09 } },
  openbook:  { tier: 'silver', icon: '📖', name: '开卷有益',  desc: '每抽一张机会/命运卡 +¥130', mods: { cardGain: 130 } },
  allowance: { tier: 'silver', icon: '🤝', name: '助学金', desc: '每轮开始 +¥250（限 16 轮）', mods: { turnCash: 250 }, charges: 16},
  microlend: { tier: 'silver', icon: '🏦', name: '小额贷',    desc: '抵押地产时多拿 13%', mods: { mortgageUp: 0.13 } },
  timemgmt:  { tier: 'silver', icon: '⏰', name: '时间管理',  desc: '被罚停留的回合数 −1（多于 1 回合时）', mods: { stayCut: 1 } },
  earlybird: { tier: 'silver', icon: '🐦', name: '早起鸟',    desc: '立即 +¥1100', once: 'cash', amt: 1100 },
  bookmark:  { tier: 'silver', icon: '🎫', name: '祖传票券',  desc: '立即获得 1 张免租金卡', once: 'pack', medal: 1 },
  milk:      { tier: 'silver', icon: '🍼', name: '营养快线', desc: '每轮开始若现金 <¥5000，+¥400（限 16 轮）', mods: { poorCash: 400, poorCashUnder: 5000 }, charges: 16},
  cashback:  { tier: 'silver', icon: '💳', name: '积分返现',  desc: '每次付款返还 3.5%（单笔封顶 ¥110）', mods: { cashbackPct: 0.035, cashbackCap: 110 } },
  talisman:  { tier: 'silver', icon: '🧿', name: '平安符', desc: '每回合开始获得免罚符（限 12 轮）', mods: { shieldEach: 1 }, charges: 12},
  sprint:    { tier: 'silver', icon: '🏃', name: '低点冲刺',  desc: '掷出 ≤5 点时 +¥180', mods: { lowRollCash: 180 } },
  twins:     { tier: 'silver', icon: '🎲', name: '双倍喜悦',  desc: '掷出双数时 +¥130', mods: { doubleCash: 130 } },
  usedbook:  { tier: 'silver', icon: '📚', name: '二手书摊',  desc: '立即 +¥700', once: 'cash', amt: 700 },
  firstaid:  { tier: 'silver', icon: '💊', name: '应急药箱',  desc: '被收租 ≥¥1000 时减免 13%（3 次）', mods: { tollShield: 3, tollShieldPct: 0.13, tollShieldMin: 1000 } },
  freelance: { tier: 'silver', icon: '💻', name: '技术接单', desc: '每轮开始若名下没有地产，+¥520（限 13 轮）', mods: { noLandCash: 520 }, charges: 13},
  umbrella:  { tier: 'silver', icon: '☔', name: '雨具出租', desc: '雨 / 雾 / 雪 / 台风天，每轮开始 +¥330（限 16 轮）', mods: { weatherCash: 330 }, charges: 16},
  network:   { tier: 'silver', icon: '📶', name: '情报网',    desc: '重掷骰费用 −18%', mods: { rerollCut: 0.18 } },
  sponsor:   { tier: 'silver', icon: '🏅', name: '赛事赞助',  desc: '立即 +¥900', once: 'cash', amt: 900 },
  // ===== 省级（金）× 20 =====
  raise:      { tier: 'gold', icon: '💼', name: '涨薪合同', desc: '每次经过起点额外 +¥630（限 12 次）', mods: { goCash: 630 }, charges: 12},
  overseer:   { tier: 'gold', icon: '🏗️', name: '工程监理',  desc: '盖房费用 −13%', mods: { buildCut: 0.13 } },
  landrush:   { tier: 'gold', icon: '🗺️', name: '圈地许可',  desc: '买入无主地 8.9 折', mods: { buyCut: 0.11 } },
  fortune:    { tier: 'gold', icon: '🎴', name: '卡运亨通',   desc: '每抽一张卡 +¥270', mods: { cardGain: 270 } },
  scholarship:{ tier: 'gold', icon: '🎖️', name: '一等奖学金', desc: '每轮开始 +¥500（限 14 轮）', mods: { turnCash: 500 }, charges: 14},
  leverage:   { tier: 'gold', icon: '🏦', name: '杠杆大师',   desc: '抵押地产时多拿 18%', mods: { mortgageUp: 0.18 } },
  tollpass:   { tier: 'gold', icon: '🎫', name: '通行优惠',   desc: '被收租时一律减免 11%', mods: { tollCut: 0.11 } },
  rentboost:  { tier: 'gold', icon: '📈', name: '收租培训',   desc: '单笔收租 ≥¥1200 时 +16%', mods: { rentGainPct: 0.16, rentGainMin: 1200 } },
  medkit:     { tier: 'gold', icon: '⛑️', name: '急救包',     desc: '被收租 ≥¥800 时减免 18%（4 次）', mods: { tollShield: 4, tollShieldPct: 0.18, tollShieldMin: 800 } },
  giftbag:    { tier: 'gold', icon: '🎁', name: '票券大礼包', desc: '立即获得 3 张免租金卡', once: 'pack', medal: 3 },
  deposit:    { tier: 'gold', icon: '🏛️', name: '定期存款', desc: '每轮开始现金 ≥¥15000 时生息 3.8%（封顶 ¥880，限 15 轮）', mods: { interestPct: 0.038, interestMin: 15000, interestCap: 880 }, charges: 15},
  safetynet:  { tier: 'gold', icon: '🛏️', name: '最低保障', desc: '每轮开始若名下没有地产，+¥880（限 13 轮）', mods: { noLandCash: 880 }, charges: 13},
  luckydice:  { tier: 'gold', icon: '🍀', name: '幸运双骰',   desc: '掷出双数时 +¥410', mods: { doubleCash: 410 } },
  burst:      { tier: 'gold', icon: '⚡', name: '爆发体质',   desc: '掷出 ≤5 点时 +¥410', mods: { lowRollCash: 410 } },
  rebate:     { tier: 'gold', icon: '💰', name: '消费返现',   desc: '每次付款返还 5.5%（单笔封顶 ¥200）', mods: { cashbackPct: 0.055, cashbackCap: 200 } },
  buildcash:  { tier: 'gold', icon: '🔨', name: '盖房返现',   desc: '每次盖房返还 ¥160', mods: { buildCash: 160 } },
  buycash:    { tier: 'gold', icon: '🏷️', name: '拿地返现',   desc: '每次买地返还 ¥140', mods: { buyCash: 140 } },
  patron:     { tier: 'gold', icon: '🛡️', name: '学术保护',   desc: '额外获得 2 次免疫负面判定的机会', mods: { immuneBonus: 2 } },
  startup:    { tier: 'gold', icon: '🚀', name: '创业启动金', desc: '立即 +¥2350', once: 'cash', amt: 2350 },
  intuition:  { tier: 'gold', icon: '🧠', name: '考场直觉',   desc: '掷出 ≥9 点时 +¥460', mods: { highRollCash: 460 } },
  // ===== 国家级（棱彩）× 14 =====
  salaryx2:    { tier: 'prism', icon: '💵', name: '双倍工资', desc: '经过起点工资 ×2，并额外 +¥700（限 12 次）', mods: { salaryX2: 1, goCash: 700 }, charges: 12},
  monopoly:    { tier: 'prism', icon: '🏆', name: '垄断宣言',   desc: '立即随机占有一块无主地，并 +¥1350', once: 'land', amt: 1350 },
  seize:       { tier: 'prism', icon: '💎', name: '强取豪夺',   desc: '立即夺取现金最多者 11% 的现金（封顶 ¥3200）', once: 'seize', pct: 0.11, amt: 3200 },
  nirvana:     { tier: 'prism', icon: '🔥', name: '涅槃',       desc: '首次破产时以 ¥5500 复活并免除该笔债务（限 1 次）', mods: { nirvana: 1, nirvanaCash: 5500 } },
  aegis:       { tier: 'prism', icon: '🛡️', name: '绝对防御',  desc: '免疫 2 次负面判定（挂科留级 / 拆地拆房等）', mods: { immuneCharges: 2 } },
  tollbooth:   { tier: 'prism', icon: '🚧', name: '收费站', desc: '对手经过你的地产每次付 ¥230（单次封顶 ¥780，限 12 次）', mods: { tollBooth: 230, tollBoothCap: 780 }, charges: 12},
  fatewheel:   { tier: 'prism', icon: '🎲', name: '命运改写',   desc: '抽到负面卡自动重抽（2 次）', mods: { rerollBad: 2 } },
  wallstreet:  { tier: 'prism', icon: '🐺', name: '华尔街之狼', desc: '抵押地产可获得地价 100%', mods: { mortgage100: 1 } },
  legacy:      { tier: 'prism', icon: '🧧', name: '遗产继承', desc: '每轮开始，当前总资产最低者向你支付 ¥440（限 12 轮）', mods: { legacy: 1, legacyAmt: 440 }, charges: 12},
  dividends:   { tier: 'prism', icon: '🏛️', name: '基金抽成', desc: '教育基金池每次进账，你抽成 7.5%（单笔封顶 ¥400，限 12 次）', mods: { fundKick: 0.075, fundKickCap: 400 }, charges: 12},
  headstart:   { tier: 'prism', icon: '⚡', name: '先发优势', desc: '每轮开始 +¥640（限 12 轮）', mods: { turnCash: 640 }, charges: 12},
  landmark:    { tier: 'prism', icon: '🏙️', name: '地标经济', desc: '每轮开始按名下建筑数 ×¥40 收益（限 13 轮）', mods: { landmark: 40 }, charges: 13},
  rerollmaster:{ tier: 'prism', icon: '🔁', name: '重投大师', desc: '每回合首次重投免费（限 16 轮）', mods: { freeReroll: 1 }, charges: 16},
  safety:      { tier: 'prism', icon: '💯', name: '风险兜底', desc: '每轮开始若现金 <¥2000，补足到 ¥2000（限 16 轮）', mods: { floor: 2000 }, charges: 16},
  // ===== v5.10 新增：校级（银）× 20 =====
  buscard:    { tier: 'silver', icon: '🚌', name: '校车月票',   desc: '每次被收机场 / 文印店 / 快递路费时立减 ¥130', mods: { tollFlat: 130 } },
  nightbus:   { tier: 'silver', icon: '🌃', name: '夜班校车',   desc: '被收租 ≥¥600 时减免 9%（3 次）', mods: { tollShield: 3, tollShieldPct: 0.09, tollShieldMin: 600 } },
  waterfree:  { tier: 'silver', icon: '🚰', name: '免费开水', desc: '每轮开始 +¥185（限 16 轮）', mods: { turnCash: 185 }, charges: 16},
  canteen:    { tier: 'silver', icon: '🍱', name: '食堂套餐', desc: '每轮开始若现金 <¥7000，+¥300（限 16 轮）', mods: { poorCash: 300, poorCashUnder: 7000 }, charges: 16},
  notesduty:  { tier: 'silver', icon: '📒', name: '笔记出借',   desc: '每抽一张机会/命运卡 +¥110', mods: { cardGain: 110 } },
  gymrun:     { tier: 'silver', icon: '🏃', name: '操场夜跑',   desc: '掷出 ≤4 点时 +¥160', mods: { lowRollCash: 160 } },
  bike:       { tier: 'silver', icon: '🚲', name: '单车代步',   desc: '掷出双数时 +¥110', mods: { doubleCash: 110 } },
  earlyclass: { tier: 'silver', icon: '☀️', name: '早八全勤', desc: '晴天 / 烈日每轮开始 +¥290（限 16 轮）', mods: { sunCash: 290 }, charges: 16},
  keychain:   { tier: 'silver', icon: '🔑', name: '挂科保险',   desc: '免于挂科留级 2 次（补考费照交）', mods: { jailFree: 2 } },
  pawnshop:   { tier: 'silver', icon: '🏪', name: '二手好价',   desc: '赎回抵押地产时少付 9%', mods: { redeemCut: 0.09 } },
  ticketx:    { tier: 'silver', icon: '🎟️', name: '尾票福利',   desc: '立即获得 1 张免租金卡 + 1 张免停留卡', once: 'stayPack', medal: 1, stayFree: 1 },
  smallcash:  { tier: 'silver', icon: '💰', name: '零花补贴',   desc: '立即 +¥730', once: 'cash', amt: 730 },
  taxrebate:  { tier: 'silver', icon: '🧾', name: '税费返还',   desc: '物业税 −23%', mods: { taxCut: 0.23 } },
  studycard:  { tier: 'silver', icon: '📚', name: '通宵补习',   desc: '被罚停留时 +¥360 补贴', mods: { stayCash: 360 } },
  dormkey:    { tier: 'silver', icon: '🛡️', name: '宿舍免检',   desc: '免疫 1 次负面判定（留级 / 拆地拆房等）', mods: { immuneCharges: 1 } },
  couponbk:   { tier: 'silver', icon: '🎫', name: '优惠券册',   desc: '每次付款返还 2.5%（单笔封顶 ¥80）', mods: { cashbackPct: 0.025, cashbackCap: 80 } },
  umbrellas:  { tier: 'silver', icon: '☔', name: '雨天专车', desc: '雨 / 雾 / 雪 / 台风天，每轮开始 +¥285（限 16 轮）', mods: { weatherCash: 285 }, charges: 16},
  regent:     { tier: 'silver', icon: '🏅', name: '院系嘉奖',   desc: '立即 +¥820', once: 'cash', amt: 820 },
  auctioneer: { tier: 'silver', icon: '🔨', name: '拍卖慧眼',   desc: '你赢下的拍卖成交价 −9%', mods: { auctionCut: 0.09 } },
  milktea:    { tier: 'silver', icon: '🧋', name: '奶茶自由', desc: '每轮开始若现金 <¥12000，+¥235（限 16 轮）', mods: { poorCash: 235, poorCashUnder: 12000 }, charges: 16},
  // ===== v5.10 新增：省级（金）× 15 =====
  express:    { tier: 'gold', icon: '🚄', name: '高铁学生票', desc: '每次被收机场 / 文印店 / 快递路费时立减 ¥270', mods: { tollFlat: 270 } },
  vaultkey:   { tier: 'gold', icon: '🏦', name: '金库钥匙',   desc: '抵押多拿 16%，赎回再少付 9%', mods: { mortgageUp: 0.16, redeemCut: 0.09 } },
  goldcard:   { tier: 'gold', icon: '💳', name: '白金返现',   desc: '每次付款返还 7%（单笔封顶 ¥270）', mods: { cashbackPct: 0.07, cashbackCap: 270 } },
  housefund:  { tier: 'gold', icon: '🧱', name: '建材补贴',   desc: '盖房费用 −11%，且每次盖房返还 ¥110', mods: { buildCut: 0.11, buildCash: 110 } },
  grants:     { tier: 'gold', icon: '📜', name: '科研津贴', desc: '每轮开始 +¥480（限 14 轮）', mods: { turnCash: 480 }, charges: 14},
  welfare:    { tier: 'gold', icon: '🧸', name: '救助大礼包', desc: '每轮开始若名下没有地产 +¥780；现金 <¥6000 再 +¥300（限 13 轮）', mods: { noLandCash: 780, poorCash: 300, poorCashUnder: 6000 }, charges: 13},
  highjump:   { tier: 'gold', icon: '🏆', name: '竞技状态',   desc: '掷出 ≥9 点 +¥380，掷出双数再 +¥180', mods: { highRollCash: 380, doubleCash: 180 } },
  legalaid:   { tier: 'gold', icon: '⚖️', name: '法律顾问',   desc: '免于挂科留级 3 次 + 免疫 1 次负面判定', mods: { jailFree: 3, immuneCharges: 1 } },
  insurance:  { tier: 'gold', icon: '🛡️', name: '全额保险',   desc: '被收租一律减免 9%；单笔 ≥¥1200 再减 13%（4 次）', mods: { tollCut: 0.09, tollShield: 4, tollShieldPct: 0.13, tollShieldMin: 1200 } },
  alumninet:  { tier: 'gold', icon: '🤝', name: '校友网络',   desc: '立即获得 2 张免租金卡 + 1 张免停留卡', once: 'stayPack2', medal: 2, stayFree: 1 },
  contract:   { tier: 'gold', icon: '📈', name: '独家代理',   desc: '单笔收租 ≥¥1200 时 +13%，且每笔收租再 +¥70', mods: { rentGainPct: 0.13, rentGainMin: 1200, rentFlat: 70 } },
  landgift:   { tier: 'gold', icon: '🗺️', name: '土地划拨',   desc: '立即随机占有一块无主地，并 +¥730', once: 'land', amt: 730 },
  fundseed:   { tier: 'gold', icon: '🌱', name: '种子基金',   desc: '立即从教育基金池提取 11%（封顶 ¥2200）', once: 'fundCut', pct: 0.11, cap: 2400 },
  overtime:   { tier: 'gold', icon: '⏱️', name: '弹性学制',   desc: '被罚停留的回合数 −1，且被罚停留时 +¥460', mods: { stayCut: 1, stayCash: 460 } },
  taxshield:  { tier: 'gold', icon: '🧮', name: '报税大师',   desc: '物业税 −36%', mods: { taxCut: 0.36 } },
  // ===== v5.10 新增：国家级（棱彩）× 15 =====
  salaryplus: { tier: 'prism', icon: '💸', name: '津贴加码', desc: '每次经过起点额外 +¥880（限 12 次）', mods: { goCash: 880 }, charges: 12},
  goldenland: { tier: 'prism', icon: '🏰', name: '御赐封地',   desc: '立即随机占有 2 块无主地，并 +¥900', once: 'land2', amt: 900 },
  mindrain:   { tier: 'prism', icon: '🧠', name: '智囊天团', desc: '立即夺取现金最多者 11% 的现金（封顶 ¥3200），此后每轮开始再 +¥300（限 12 轮）', once: 'seize', pct: 0.11, amt: 3200, mods: { turnCash: 300 }, charges: 12},
  fortress:   { tier: 'prism', icon: '🏯', name: '不动如山',   desc: '免疫 3 次负面判定 + 免于挂科留级 3 次', mods: { immuneCharges: 3, jailFree: 3 } },
  tollking:   { tier: 'prism', icon: '🌉', name: '车水马龙', desc: '对手经过你的地产每次付 ¥350（单次封顶 ¥1050），每笔收租 +¥100（共限 12 次）', mods: { tollBooth: 350, tollBoothCap: 1050, rentFlat: 100 }, charges: 12},
  fateward:   { tier: 'prism', icon: '🧿', name: '厄运退散',   desc: '抽到负面卡自动重抽（3 次）', mods: { rerollBad: 3 } },
  bankline:   { tier: 'prism', icon: '🏛️', name: '银行白名单', desc: '抵押地产可获得地价 100%，赎回再少付 18%', mods: { mortgage100: 1, redeemCut: 0.18 } },
  tithe:      { tier: 'prism', icon: '👑', name: '万民伞', desc: '每轮开始，总资产最低者向你支付 ¥450（限 12 轮）', mods: { legacy: 1, legacyAmt: 450 }, charges: 12},
  fundlord:   { tier: 'prism', icon: '🏦', name: '基金合伙人', desc: '教育基金池每次进账，你抽成 9.5%（单笔封顶 ¥520，限 12 次）', mods: { fundKick: 0.095, fundKickCap: 520 }, charges: 12},
  megahead:   { tier: 'prism', icon: '⚡', name: '大先发优势', desc: '每轮开始 +¥880（限 12 轮）', mods: { turnCash: 880 }, charges: 12},
  skyscraper: { tier: 'prism', icon: '🌃', name: '摩天经济', desc: '每轮开始按名下建筑数 ×¥70 收益（限 12 轮）', mods: { landmark: 70 }, charges: 12},
  rerollking: { tier: 'prism', icon: '🔁', name: '时来运转', desc: '每回合首次重投免费，其余重投费用 −50%（限 12 轮）', mods: { freeReroll: 1, rerollCut: 0.50 }, charges: 12},
  megafloor:  { tier: 'prism', icon: '🛟', name: '终身兜底', desc: '每轮开始若现金 <¥3000，补足到 ¥3000（限 16 轮）', mods: { floor: 3000 }, charges: 16},
  taxexempt:  { tier: 'prism', icon: '🧾', name: '免税特许',   desc: '物业税 −55%，且每次付款返还 4.5%（封顶 ¥180）', mods: { taxCut: 0.55, cashbackPct: 0.045, cashbackCap: 180 } },
  phoenix2:   { tier: 'prism', icon: '🔥', name: '浴火重生',   desc: '首次破产时以 ¥4600 复活并免除该笔债务，且免疫 1 次负面判定', mods: { nirvana: 1, nirvanaCash: 4600, immuneCharges: 1 } },
};
const PROJECT_KEYS = { silver: [], gold: [], prism: [] };
for (const k in PROJECTS) PROJECT_KEYS[PROJECTS[k].tier].push(k);
// 四次立项的档位概率（银/金/彩）——完全随机，不是按顺序升档（v5.14：第四次改到第 32 轮）
const HEX_TRIGGERS = [2, 10, 20, 32, 40, 50];
const HEX_TRIGGERS_EARLY = [2, 5, 10, 20, 32, 40];   // v5.10「时光之城」：海克斯整体提前的触发轮
// v5.14：彩（国家级）概率整体上调回一档（六次平均 ≈19%），金略降、银仍为单次最大盘；各行仍严格归一
//       六次 = 80/12/8 · 50/32/18 · 42/34/24 · 46/32/22 ×3（平均 银 51.7% / 金 29.0% / 彩 19.3%）
const HEX_TIER_P = [[0.80, 0.12, 0.08], [0.50, 0.32, 0.18], [0.42, 0.34, 0.24], [0.46, 0.32, 0.22], [0.46, 0.32, 0.22], [0.46, 0.32, 0.22]];   // [银, 金, 彩]
const HEX_PICK_MS = 70000;       // 三选一决策时长（v5.12：52s → 70s，卡池破百 + 可刷新，选得更从容）
// v5.14：限次项目「合约到期」时按档位发放一笔结项经费——把没用完的合约折算成现金，
//        避免晚抽到的限次卡「抽到即亏」，也让限次卡的价值曲线更平滑（不再是断崖式归零）
const EXPIRY_STIPEND = { silver: 300, gold: 650, prism: 1300 };
// v5.8：第 15/25/40 轮后，除「房产租金」外的一切奖金收入衰减为 ×70% / ×50% / ×25%
const INCOME_DECAY = [{ r: 15, mul: 0.70 }, { r: 25, mul: 0.50 }, { r: 40, mul: 0.25 }];
// 衰减豁免的入账理由（非「奖金」类：转账 / 返还 / 返现 / 兜底等）
const INCOME_EXEMPT = ['抵押', '赎回', '拆除回售', '卖房', '返现', '遗产继承', '收费站过路费', '风险兜底', '涅槃', '投资结项', '转移', '对决', '带货', '偷', '强取豪夺', '模型推理', '帮扶', '慈善', '捐款', '接管', '基金会划拨', '众筹'];

const SALARY = 2000, START_CASH = 30000, TURN_MS = 30000, AUCTION_MS = 15000;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

class Room {
  constructor(code, opts) {
    this.code = code;
    this.phase = 'lobby'; // lobby / faculty / roll / auction / raise / over
    this.players = [];
    this.cells = BOARD.map(() => ({ own: null, level: 0, mortgaged: false, mortgageAt: 0 }));
    this.cur = 0;
    this.fundPool = 0;
    this.log = [];
    this.events = [];          // 本轮待广播事件
    // v5.1：增量状态追踪（ev() 用它算出每个事件"新变更了什么"，供客户端延后套用）
    this._seenCash = {};
    this._seenCells = this.cells.map(cs => ({ own: cs.own, level: cs.level, mortgaged: cs.mortgaged, mortgageAt: cs.mortgageAt }));
    this._seenFund = 0;
    this.pendingBuy = null;    // {pid, cell}
    this.pendingBuild = null;  // {pid, cell}
    this.pendingBranch = null; // {pid, cell, line} 岔路入口询问（line: 'A'学术长廊 / 'B'创业大道）
    this.pendingInvest = null; // {pid, cost, back, rounds} 科研投资询问
    this.pendingSkill = null;  // {pid, key} v5.1 主动技询问
    this.pendingReroll = null; // {pid, cost} 掷骰后重投询问（v4.0）
    this.auction = null;       // {cell, highest, bidder, endsAt, maxBid:{}}
    this.raise = null;         // {pid, need, creditor}
    this.vote = null;          // {asker, votes:{}}
    this.timer = null;
    this.aiTimers = [];
    this.dice = null;
    this.round = 1;
    this.startedAt = null;
    this.season = 'mid';       // low / mid / high（市场周期）
    this.weather = 'cloud';    // sun / cloud / rain / storm
    this.calEvent = null;      // 本轮生效的校历全局事件
    this.duel = null;          // 进行中的擂台对决
    // ---------- v5.2：校园风貌 ----------
    // 由服务端显式开启（new Room(code, {faculty:true})）；未开启时所有风貌修正返回中性值，
    // 行为与 v5.1 完全一致 —— 这样既有的 test_v40/v50/v51/simulate 无需改动即可继续回归。
    this.facultyOn = !!(opts && opts.faculty);
    this.faculty = null;          // 本局风貌 key
    this.facultyOptions = [];     // 3 个候选 key
    this.facultyVotes = {};       // pid -> key
    this.facultyLucky = null;     // 被抽中的玩家 id（他的选择成为本局风貌）
    this.freeRound = 0;           // 「免费轮」抽中的轮次（该轮全场买地、盖楼免费）
    this.freeRentRounds = [];     // 「免租轮」抽中的 4 个轮次（这些轮次全场免交租金）
    // ---------- v5.7：海克斯 · 研究项目 ----------
    // 由服务端显式开启（new Room(code, {hex:true})）；未开启时整套机制不触发，
    // 既有测试 / simulate 行为与 v5.6 完全一致。
    this.hexOn = !!(opts && opts.hex);
    this.project = null;          // {round, tier, offers:{pid:[key×3]}, picks:{pid:key}}
    this.hexDoneRounds = [];      // 已触发过立项的轮次（防重复触发）
    // ---------- v5.10：定调城邦 / 刷新 ----------
    this.hexTiers = [];           // 本局每次立项抽到的档位（供「极光之城」银金彩各一用）
    this.hexForce = null;         // 'prism'|'silver'|'gold'|'mix'——前三次立项强制档位（彩霞/白银/黄金/极光之城）
    this.hexMaxCount = 0;         // 本局立项次数上限（精研之城 = 3；0 = 不限）
    this.hexEarly = false;        // 时光之城：触发轮改为 2/5/10/20/32/40
  }
  ev(e) {
    // v5.8：收益衰减中央拦截 —— 第 15/25/40 轮后，除「房产租金」外的一切奖金收入 ×70%/×50%/×25%。
    // 所有入账口统一在此打折（t:'money' 单人入账 + calwave/faculty_wave 全场波及），租金与转账类理由豁免。
    if (e && e.t === 'money' && e.amount > 0 && this.round >= INCOME_DECAY[0].r
        && !INCOME_EXEMPT.some(w => (e.reason || '').includes(w))) {
      const p = this.players.find(q => q.id === e.pid);
      if (p) {
        const cut = Math.round(e.amount * (1 - this.incomeMul()));
        if (cut > 0) { p.cash -= cut; e.amount -= cut; e.decayed = true; }
      }
    }
    if (e && (e.t === 'calwave' || e.t === 'faculty_wave') && e.gain && this.round >= INCOME_DECAY[0].r
        && Array.isArray(e.items)) {
      const m = this.incomeMul();
      if (m < 1) {
        let total = 0;
        for (const it of e.items) {
          const q = this.players.find(x => x.id === it.pid);
          if (!q || !(it.amount > 0)) continue;
          const cut = Math.round(it.amount * (1 - m));
          if (cut > 0) { q.cash -= cut; it.amount -= cut; }
          total += it.amount;
        }
        e.total = total;
      }
    }
    // v5.1：为每个事件附带「发出时刻的增量状态」（现金 / 地皮 / 基金池）。
    // 客户端会在播完该事件对应的动画后才套用这份增量，于是资金与资产的变化严格晚于动画，
    // 并且评论区、资产面板、玩家现金条会在同一时刻一起变化。
    const cash = {}, cells = {};
    let fund = null, changed = false;
    for (const p of this.players) {
      if (this._seenCash[p.id] !== p.cash) { cash[p.id] = p.cash; this._seenCash[p.id] = p.cash; changed = true; }
    }
    for (let i = 0; i < this.cells.length; i++) {
      const cs = this.cells[i], sv = this._seenCells[i];
      if (sv.own !== cs.own || sv.level !== cs.level || sv.mortgaged !== cs.mortgaged || sv.mortgageAt !== cs.mortgageAt) {
        cells[i] = { own: cs.own, level: cs.level, mortgaged: !!cs.mortgaged, mortgageAt: cs.mortgageAt || 0 };
        sv.own = cs.own; sv.level = cs.level; sv.mortgaged = cs.mortgaged; sv.mortgageAt = cs.mortgageAt;
        changed = true;
      }
    }
    if (this._seenFund !== this.fundPool) { fund = this.fundPool; this._seenFund = this.fundPool; changed = true; }
    if (changed) e.d = { cash, cells, fund };
    this.events.push(e);
  }
  addLog(msg) { const ts = Date.now(); this.log.push({ t: ts, msg }); if (this.log.length > 200) this.log.shift(); this.ev({ t: 'log', msg, ts }); }
  // v4.0：教育基金池统一入口 —— 上限 ¥30000，超出部分直接均分给全体在场玩家
  addToFund(amount) {
    if (!(amount > 0)) return;
    // v5.7 基金抽成：持有「基金抽成」项目的玩家从每次进账中抽 10%（单笔封顶 ¥500）
    let kick = 0;
    const kicker = this.alive().find(q => q.hex && q.hex.fundKick && this.hexKeyWith(q, 'fundKick'));
    if (kicker && amount >= 200) {
      kick = Math.min(kicker.hex.fundKickCap || 460, Math.round(amount * kicker.hex.fundKick));   // v5.10：抽成上限可配置
      if (kick > 0) {
        kicker.cash += kick;
        this.ev({ t: 'money', pid: kicker.id, amount: kick, reason: '项目·基金抽成' });
        this.hexFx(kicker, 'dividends', `基金进账抽成 +¥${kick}`);
        for (const key of (kicker.hexList || [])) {   // v5.13：基金抽成按次计
          const pr = PROJECTS[key];
          if (pr && pr.charges && pr.mods && pr.mods.fundKick !== undefined) this.hexSpend(kicker, key);
        }
      }
    }
    const net = amount - kick;
    const cap = this.fundCap();   // v5.2：金融校区把上限抬到 ¥25000
    const overflow = this.fundPool + net - cap;
    this.fundPool = Math.min(cap, this.fundPool + net);
    if (overflow > 0) {
      const alive = this.alive();
      if (alive.length) {
        const share = Math.floor(overflow / alive.length);
        if (share > 0) {
          for (const q of alive) { if (q.fundBanned) continue; q.cash += share; this.ev({ t: 'money', pid: q.id, amount: share, reason: '基金溢出均分' }); }
          this.addLog(`💰 教育基金突破上限 ¥${cap}，溢出部分均分：每人 +¥${share}`);
        }
      }
    }
  }

  // v5.8：效果卡盲盒张数 1/2/3，概率 50% / 30% / 20%
  rollCardCount() {
    const r = Math.random();
    return r < 0.5 ? 1 : (r < 0.8 ? 2 : 3);
  }
  // v5.1：效果卡抽取（校园商城 / 校庆礼品屋共用）
  grantCards(p, idx, n, label) {
    const drawn = [];
    for (let i = 0; i < n; i++) {
      const card = pick(EFFECT_CARDS);
      drawn.push(card);
      switch (card.id) {
        case 'medal':    p.medal++; break;
        case 'skill':    p.skillLeft++; break;
        case 'discount': p.discount = true; break;
        case 'buildcut': p.buildCutCard = (p.buildCutCard || 0) + 1; break;
        case 'step':     p.stepBuffs.push(4); break;   // v5.8：加速卡加强 +3 → +4
        case 'cash':     p.cash += 800; this.ev({ t: 'money', pid: p.id, amount: 800, reason: '现金红包' }); break;
        case 'stayfree': p.stayFree = (p.stayFree || 0) + 1; break;
        case 'finefree': p.fineFree = (p.fineFree || 0) + 1; break;
        case 'steal': {
          // v5.8：偷师卡 —— 随机偷一名还有技能次数的玩家 1 次（对方 -1，我 +1）
          const cands = this.alive().filter(q => q !== p && (q.skillLeft || 0) > 0);
          if (cands.length) {
            const t = pick(cands);
            t.skillLeft--; p.skillLeft++;
            this.addLog('🕵️ ' + p.name + ' 对 ' + t.name + ' 使用「偷师卡」：偷走 1 次技能使用次数');
            this.ev({ t: 'skill_steal', pid: p.id, target: t.id, targetName: t.name });
          } else {
            p.cash += 500;   // 没得偷就折现补偿
            this.ev({ t: 'money', pid: p.id, amount: 500, reason: '偷师卡·无人可偷折现' });
          }
          break;
        }
        default: break;
      }
    }
    const names = drawn.map(c => `${c.icon}${c.name}`).join('、');
    this.addLog(`🎁 ${p.name} 在${label}抽到 ${n} 张效果卡：${names}`);
    this.ev({ t: 'draw', pid: p.id, cell: idx, n, label, cards: drawn.map(c => ({ id: c.id, name: c.name, icon: c.icon, desc: c.desc })) });
    return drawn;
  }
  // v5.1：随机抽取过程的全场可视化事件（客户端演出「转盘 → 定格」抽取动画）
  evRoll(p, cell, title, options, idx, tone) {
    this.ev({ t: 'rollpay', pid: p.id, cell, title, options, idx, tone: tone || (idx === 0 ? 'good' : 'bad') });
  }

  // ---------- 大厅 ----------
  join(name, isAI = false) {
    if (this.phase !== 'lobby' && !isAI) return null;
    if (this.players.length >= 5) return null;
    const p = {
      id: 'p' + (this.players.length + 1), name, isAI,
      token: Math.random().toString(36).slice(2, 12),
      cash: START_CASH, pos: 0, alive: true,
      discount: false, buildCutCard: 0, fineFree: 0, skipNext: false, skipTurns: 0, color: PCOLOR[this.players.length],
      fundBanned: false,        // v5.8：科研投资失败后被教育基金拉黑
      shieldRound: -9,          // v5.8：上一次购买免罚符的轮次（购买冷却 1 轮）
      rerollStreak: 0, rerollLastRound: -9,   // v5.8：连续重投计手（连用 2 回合第 3 回合锁定）
      invest: null,             // 科研投资 {due, back}（学术长廊）
      buffSteps: 0,             // 奖学金长廊浪漫加成（下回合移动 +N）
      stepBuffs: [],            // v5.1：移动加成队列（可连续多回合，如奖学金长廊「下两次各 +3」）
      medal: 0,                 // 免租金卡（校园商城免费领取，保留到付租金时自动消耗）
      wins: 0,
      voice: false,              // 是否开着麦（语音房状态，不参与游戏逻辑）
      major: pick(MAJOR_KEYS),   // 专业身份（大厅可改）
      skillLeft: 0,              // 专业技能剩余次数（开局按专业重置）
      ach: {},                   // 已获得成就（按局重置）
      combo: 0,                  // 连续收租次数（连击）
      lucky: false, shield: false, sabotage: 0,  // 当回合临时状态
      rerollUsed: false,        // 重掷骰每回合限用一次
      rentBuff: 0,              // v5.1 主动技：本轮内自己收租加成（如材料 0.6）
      defBuff: 0,               // v5.1 主动技：本轮内自己被收租减免（如药学 0.6）
      buildCutTurn: 0,          // v5.1 主动技：本回合盖房额外折扣（如机械 0.5）
      skillUsedThisTurn: false, // v5.1 主动技：本回合是否已询问/发动过
      stayFree: 0,              // v5.2：免停留卡（师范校区发放，可免除一次纯惩罚性停留）
      hex: {},                  // v5.7：研究项目的聚合修正（goCash/turnCash/buildCut/...）
      hexList: [],              // v5.7：已立项的项目 key（一局内同一项目不会重复出现）
      hexLeft: {},              // v5.13：限次项目的剩余触发次数（有 charges 的项目才有）
      hexFreeUsed: false,       // v5.7：重投大师——本回合的免费重投是否已用
    };
    this.players.push(p);
    this.addLog(`${name} 加入了房间`);
    return p;
  }
  start() {
    if (this.phase !== 'lobby' || this.players.length < 2) return false;
    this.startedAt = Date.now();
    for (const p of this.players) p.skillLeft = MAJORS[p.major].uses;
    this.addLog('游戏开始！初始资金 ¥30000，祝大家武运昌隆');
    this.addLog('专业：' + this.players.map(p => `${p.name}·${MAJORS[p.major].name}`).join('，'));
    if (this.facultyOn) { this.openFacultyVote(); return true; }   // v5.2：先定本局校园风貌，再进第 1 轮
    this.beginRound();
    this.startTurn();
    return true;
  }

  // ---------- v5.2：校园风貌 —— 开局投票 + 随机抽取（对应设计提案 1.1 节） ----------
  // 流程：随机 3 个候选 → 全体玩家（含 AI）各投 1 票 → 随机抽一名玩家，他所投的风貌成为本局风貌。
  openFacultyVote(termStart = 1) {
    // v5.9：城邦 10 轮一届 —— 第 1/11/21/31/41/51 轮各推选一次；按届次过滤只在早期有意义的城邦
    this.facTermStart = termStart;
    const term = Math.floor((termStart - 1) / 10) + 1;
    const pool = FACULTY_KEYS.filter(k => {
      const w = FACULTY[k].terms;
      return !w || (term >= w[0] && term <= w[1]);
    });
    const opts = [];
    // v5.10：首轮城邦推选加权 —— 「海克斯定调」六城有 55% 概率抢占一个候选席位
    if (term === 1 && Math.random() < 0.55) {
      const themes = pool.filter(k => FACULTY[k].hexTheme);
      if (themes.length) {
        const k0 = pick(themes);
        opts.push(k0);
        pool.splice(pool.indexOf(k0), 1);
      }
    }
    while (opts.length < 3 && pool.length) opts.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    this.facultyOptions = opts;
    this.facultyVotes = {};
    this.faculty = null; this.facultyLucky = null;
    this.freeRound = null; this.freeRentRounds = [];   // 清掉上一届的免费轮 / 免租轮
    this.phase = 'faculty';
    this.addLog(`🏫 第 ${term} 届「校园风貌」换届（第 ${termStart}~${termStart + 9} 轮生效）候选：${opts.map(k => FACULTY[k].icon + FACULTY[k].name).join(' / ')} —— 全体投票中（${Math.round(FACULTY_VOTE_MS / 1000)} 秒）`);
    this.facEndsAt = Date.now() + FACULTY_VOTE_MS;   // v5.12：重连快照下发剩余时长用
    this.ev({ t: 'faculty_offer', options: opts, ms: FACULTY_VOTE_MS, term, termStart });
    this.setTimer(FACULTY_VOTE_MS, () => this.settleFaculty());
    for (const q of this.players) if (q.isAI) this.aiTimers.push(setTimeout(() => this.aiFacultyVote(q), rnd(1400, 3400)));
  }
  voteFaculty(p, key) {
    if (this.phase !== 'faculty') return;
    if (!this.facultyOptions.includes(key)) return;
    if (this.facultyVotes[p.id]) return;
    this.facultyVotes[p.id] = key;
    this.addLog(`🗳️ ${p.name} 投给了「${FACULTY[key].name}」`);
    this.ev({ t: 'faculty_vote', pid: p.id, key });
    if (this.players.every(q => this.facultyVotes[q.id])) this.settleFaculty();
  }
  aiFacultyVote(p) {
    if (this.phase !== 'faculty' || this.facultyVotes[p.id]) return;
    // AI 偏好：现金类 / 建设类 / 规则类各有权重，另加一点随机，避免全场投票千篇一律
    const pref = { urban: 3, garden: 3, reform: 3, ancient: 2, finance: 2, agri: 2, boom: 2, nofund: 2, retrain: 2, freeRound: 2, lantern: 2, cafe: 2, freshman: 2, veteran: 2, dicegod: 2, hxGold: 2, hxPrism: 1, hexEarly: 1, carnival: 1, observatory: 1 };
    let best = this.facultyOptions[0], bs = -1;
    for (const k of this.facultyOptions) {
      const s = (pref[k] || 1) + Math.random() * 1.6;
      if (s > bs) { bs = s; best = k; }
    }
    this.voteFaculty(p, best);
  }
  settleFaculty() {
    if (this.phase !== 'faculty') return;
    this.clearTimer();
    // 超时未投（含掉线的真人）随机补票，保证每个人都有"选择"
    for (const q of this.players) if (!this.facultyVotes[q.id]) this.facultyVotes[q.id] = pick(this.facultyOptions);
    // 随机抽一名玩家 —— 他的选择成为本局风貌（照搬金铲铲的"幸运儿"设计）
    const lucky = pick(this.players);
    const key = this.facultyVotes[lucky.id];
    this.faculty = key;
    this.facultyLucky = lucky.id;
    this.applyFacultySetup(key);
    const f = FACULTY[key];
    this.addLog(`🏫 抽中 ${lucky.name} 的选票 → 第 ${Math.floor((this.facTermStart - 1) / 10) + 1} 届校园风貌【${f.name}】（第 ${this.facTermStart}~${this.facTermStart + 9} 轮生效）：${f.lead}｜代价：${f.cost}`);
    this.ev({ t: 'faculty_chosen', key, lucky: lucky.id, votes: { ...this.facultyVotes }, tally: this.facultyTally(), term: Math.floor((this.facTermStart - 1) / 10) + 1, termStart: this.facTermStart });
    this.phase = 'roll';
    this.beginRound();
    this.startTurn();
  }
  // 计票（仅用于展示；最终由"随机抽一名玩家"决定）
  facultyTally() {
    const t = {};
    for (const k of this.facultyOptions) t[k] = 0;
    for (const pid of Object.keys(this.facultyVotes)) { const k = this.facultyVotes[pid]; if (t[k] !== undefined) t[k]++; }
    return t;
  }
  // 风貌开局一次性结算：技能次数 +1 / 抽定「免费轮」「免租轮」的轮次
  applyFacultySetup(key) {
    if (!this.facTermStart) this.facTermStart = this.round > 1 ? Math.floor((this.round - 1) / 10) * 10 + 1 : 1;   // v5.9：防御默认（测试直接调用时）
    if (key === 'retrain') {
      for (const q of this.players) q.skillLeft = (q.skillLeft || 0) + 1;
      this.addLog(`📖 【进修校区】全员专业技能次数 +1`);
    }
    if (key === 'freeRound') {
      // v5.9：免费轮只在本届 10 轮窗口内抽（首轮城邦 → 第 1~10 轮）
      this.freeRound = this.facTermStart + Math.floor(Math.random() * 10);
      this.addLog(`🎟️ 【免费轮校区】已抽定：第 ${this.freeRound} 轮全场买地皮、盖楼完全免费（本届窗口内）`);
      this.ev({ t: 'faculty_draw', kind: 'freeRound', rounds: [this.freeRound] });   // v5.6：大屏抽签动画
    }
    if (key === 'freeRent') {
      const pool = [];
      for (let r = this.facTermStart; r < this.facTermStart + 10; r++) pool.push(r);   // v5.9：免租轮只在本届窗口内抽
      const got = [];
      while (got.length < 4 && pool.length) got.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      this.freeRentRounds = got.sort((a, b) => a - b);
      this.addLog(`🕊️ 【免租轮校区】已抽定免租轮：第 ${this.freeRentRounds.join(' / ')} 轮，这些轮次全场踩到谁的地都不用付租金`);
      this.ev({ t: 'faculty_draw', kind: 'freeRent', rounds: this.freeRentRounds.slice() });   // v5.6：大屏抽签动画
    }
    // ---------- v5.10：新城邦的一次性结算 ----------
    if (key === 'hxPrism') { this.hexForce = 'prism'; this.addLog('🌈 【彩霞之城】本局海克斯前三次必出国家级（棱彩）'); }
    if (key === 'hxSilver') { this.hexForce = 'silver'; this.addLog('⚪ 【白银学城】本局海克斯前三次必出校级（银）'); }
    if (key === 'hxGold') { this.hexForce = 'gold'; this.addLog('🟡 【黄金学府】本局海克斯前三次必出省级（金）'); }
    if (key === 'hxMix') { this.hexForce = 'mix'; this.addLog('🌌 【极光之城】本局海克斯前三次必为银 / 金 / 彩各一个'); }
    if (key === 'hex3') { this.hexMaxCount = 3; this.addLog('🧭 【精研之城】本局海克斯只有 3 次（第 2/10/20 轮）——选卡时记得用刷新！'); }
    if (key === 'hexEarly') { this.hexEarly = true; this.addLog('⏳ 【时光之城】海克斯提前触发：第 2/5/10/20/32/40 轮'); }
    if (key === 'veteran') {
      for (const q of this.players) { q.medal = (q.medal || 0) + 1; this.ev({ t: 'medalGain', pid: q.id, n: q.medal }); }
      this.addLog('🎓 【老生校区】学长学姐的传家宝：全场各领 1 张免租金卡');
    }
    if (key === 'freshman') {
      const items = [];
      for (const q of this.alive()) { q.cash += 1500; items.push({ pid: q.id, amount: 1500 }); }
      if (items.length) this.ev({ t: 'faculty_wave', icon: '🍼', name: '迎新红包', gain: true, items, total: 1500 * items.length });
      this.addLog('🍼 【新生校区】迎新红包到账：全体 +¥1500');
    }
  }
  facIs(k) { return this.faculty === k; }
  isFreeRound() { return this.facIs('freeRound') && this.round === this.freeRound; }
  isFreeRentRound() { return this.facIs('freeRent') && this.freeRentRounds.includes(this.round); }

  // ---------- v5.7：海克斯 · 研究项目（第 2 / 10 / 20 轮全体三选一） ----------
  hexFx(p, key, detail) { this.ev({ t: 'hexfx', pid: p.id, key, detail }); }

  // 回合推进到触发轮时开启立项阶段；返回 true 表示游戏暂停等待三选一
  maybeProject() {
    if (!this.hexOn) return false;
    const trig = this.hexEarly ? HEX_TRIGGERS_EARLY : HEX_TRIGGERS;   // v5.10：时光之城整体提前
    if (!trig.includes(this.round) || this.hexDoneRounds.includes(this.round)) return false;
    if (this.alive().length <= 1) return false;
    if (this.hexMaxCount && this.hexDoneRounds.length >= this.hexMaxCount) return false;   // v5.10：精研之城限 3 次
    this.hexDoneRounds.push(this.round);
    // ① 抽档位：按第几次立项取概率（银/金/彩），完全随机
    const nth = trig.indexOf(this.round);
    const [ps, pg] = HEX_TIER_P[Math.min(nth, HEX_TIER_P.length - 1)];
    const r = Math.random();
    let tier = r < ps ? 'silver' : (r < ps + pg ? 'gold' : 'prism');
    // v5.10：定调城邦 —— 前三次立项强制档位（彩霞/白银/黄金必出；极光之城银金彩各一）
    if (this.hexForce && this.hexDoneRounds.length <= 3) {
      if (this.hexForce === 'mix') {
        const left = ['silver', 'gold', 'prism'].filter(t => !this.hexTiers.includes(t));
        if (left.length) tier = pick(left);
      } else tier = this.hexForce;
    }
    this.hexTiers.push(tier);
    // ② 发牌：同一玩家不会见到自己已立项的项目；同一轮内尽量人手不同
    //    v5.9：停发工资后，工资类项目（goCash / salaryX2）已无意义，从池中剔除以平衡同档强度
    const wageDead = this.round >= this.salaryStop();
    const used = new Set();
    const offers = {};
    for (const p of this.alive()) {
      const owned = new Set(p.hexList);
      const deadKey = k => {
        const m = PROJECTS[k].mods || {};
        return wageDead && (m.goCash || m.salaryX2);
      };
      let pool = PROJECT_KEYS[tier].filter(k => !owned.has(k) && !used.has(k) && !deadKey(k));
      if (pool.length < 3) pool = pool.concat(PROJECT_KEYS[tier].filter(k => !owned.has(k) && !pool.includes(k) && !deadKey(k)));
      if (pool.length < 3) pool = PROJECT_KEYS[tier].filter(k => !owned.has(k));
      const cards = [];
      while (cards.length < 3 && pool.length) cards.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      offers[p.id] = cards;
      cards.forEach(k => used.add(k));
    }
    for (const p of this.alive()) p.hexRefreshLeft = 1;   // v5.11：每次立项三选一都给一次刷新（原 v5.10 为整局一次）
    this.phase = 'project';
    this.project = { round: this.round, tier, offers, picks: {} };
    this.addLog(`🧪 第 ${this.round} 轮 · 「${HEX_TIERS[tier].name}」立项：每位玩家三选一（${HEX_PICK_MS / 1000} 秒）`);
    this.ev({ t: 'project_offer', round: this.round, tier, offers, ms: HEX_PICK_MS });
    this.setTimer(HEX_PICK_MS, () => this.settleProject());
    for (const p of this.alive()) if (p.isAI) this.aiTimers.push(setTimeout(() => this.aiProject(p), rnd(3600, 9500)));
    return true;
  }
  pickProject(p, key) {
    if (this.phase !== 'project' || !this.project || !p || !p.alive) return;
    const off = this.project.offers[p.id] || [];
    if (!off.includes(key)) return;
    if (this.project.picks[p.id]) return;
    this.project.picks[p.id] = key;
    this.addLog(`🧪 ${p.name} 选定了「${(PROJECTS[key] || {}).name || key}」`);
    this.ev({ t: 'project_pick', pid: p.id, key, tier: this.project.tier });
    if (this.alive().every(q => this.project.picks[q.id])) this.settleProject();
  }
  // v5.10：海克斯刷新 —— 三选一中把一张换成同档随机新卡（每人整局一次）
  refreshProject(p, key) {
    if (this.phase !== 'project' || !this.project || !p || !p.alive) return;
    if (this.project.picks[p.id]) return;
    if ((p.hexRefreshLeft || 0) <= 0) return;
    const off = this.project.offers[p.id] || [];
    if (!off.includes(key) || off.length < 3) return;
    const tier = this.project.tier;
    const owned = new Set(p.hexList);
    const wageDead = this.round >= this.salaryStop();
    const deadKey = k => { const m = PROJECTS[k].mods || {}; return wageDead && (m.goCash || m.salaryX2); };
    let pool = PROJECT_KEYS[tier].filter(k2 => !owned.has(k2) && !off.includes(k2) && !deadKey(k2));
    if (!pool.length) pool = PROJECT_KEYS[tier].filter(k2 => !owned.has(k2) && !off.includes(k2));
    if (!pool.length) return;
    const nk = pick(pool);
    this.project.offers[p.id] = off.map(k2 => k2 === key ? nk : k2);
    p.hexRefreshLeft--;
    this.addLog(`🔁 ${p.name} 刷新了「${(PROJECTS[key] || {}).name || key}」→ 换来「${(PROJECTS[nk] || {}).name || nk}」（刷新机会已用完）`);
    this.ev({ t: 'project_refresh', pid: p.id, offers: this.project.offers[p.id], left: p.hexRefreshLeft });
  }
  aiProject(p) {
    if (this.phase !== 'project' || !this.project || this.project.picks[p.id]) return;
    // AI 简单评分：缺钱偏现金流，地多偏建设，其余按修正条目数量 + 随机扰动
    const hxWant = {};
    if (p.cash < 8000) Object.assign(hxWant, { turnCash: 3, poorCash: 2, noLandCash: 2, cashbackPct: 1 });
    if (this.buildSum(p) > 0) Object.assign(hxWant, { buildCut: 3, buildCash: 2, landmark: 2 });
    if (this.propCells(p).length >= 4) Object.assign(hxWant, { rentGainPct: 3, tollBooth: 2 });
    let best = null, bs = -1;
    for (const k of this.project.offers[p.id]) {
      const pr = PROJECTS[k] || {};
      let s = 1 + Object.keys(pr.mods || {}).length * 0.5 + Math.random() * 1.6;
      for (const mk in hxWant) if (pr.mods && pr.mods[mk]) s += hxWant[mk];
      if (s > bs) { bs = s; best = k; }
    }
    this.pickProject(p, best || pick(this.project.offers[p.id]));
  }
  settleProject() {
    if (this.phase !== 'project' || !this.project) return;
    this.clearTimer();
    const tier = this.project.tier;
    for (const p of this.alive()) {
      const key = this.project.picks[p.id] || pick(this.project.offers[p.id]);
      this.grantProject(p, key);
    }
    this.project = null;
    this.phase = 'roll';
    this.startTurn();
  }
  grantProject(p, key) {
    const pr = PROJECTS[key];
    if (!pr) return;
    p.hexList.push(key);
    if (pr.charges) p.hexLeft[key] = pr.charges;   // v5.13：限次项目登记合约次数
    for (const k in (pr.mods || {})) p.hex[k] = (p.hex[k] || 0) + pr.mods[k];
    this.recomputeMaxMods(p);   // v5.13：floor 等按取最大值聚合
    let detail = pr.desc;
    switch (pr.once) {
      case 'cash':
        p.cash += pr.amt;
        this.ev({ t: 'money', pid: p.id, amount: pr.amt, reason: `立项【${pr.name}】` });
        detail = `立即 +¥${pr.amt}`;
        break;
      case 'pack': {
        if (pr.medal) p.medal += pr.medal;
        const parts = [];
        if (pr.medal) parts.push(`${pr.medal} 张免租金卡`);
        detail = `获得 ${parts.join(' + ')}`;
        break;
      }
      case 'land': {
        const empty = BOARD.map((cc, i) => i).filter(i => BOARD[i].type === 'prop' && !this.cells[i].own && !this.cells[i].mortgaged);
        if (empty.length) {
          const idx = pick(empty);
          this.cells[idx].own = p.id;
          if (pr.amt) p.cash += pr.amt;
          this.ev({ t: 'buy', pid: p.id, cell: idx, price: 0, grant: true });
          this.checkOwnership(p);
          detail = `获得「${BOARD[idx].name}」${pr.amt ? ` +¥${pr.amt}` : ''}`;
        } else {
          const comp = (pr.amt || 0) + 2500;
          p.cash += comp;
          this.ev({ t: 'money', pid: p.id, amount: comp, reason: `立项【${pr.name}】补偿` });
          detail = `已无无主地，改为补偿 +¥${comp}`;
        }
        break;
      }
      case 'stayPack': case 'stayPack2': {
        const md = pr.medal || 0, sf = pr.stayFree || 0;
        if (md) p.medal = (p.medal || 0) + md;
        if (sf) p.stayFree = (p.stayFree || 0) + sf;
        detail = [md ? `${md} 张免租金卡` : '', sf ? `${sf} 张免停留卡` : ''].filter(Boolean).join(' + ') || '卡包';
        break;
      }
      case 'fundCut': {
        const g = Math.min(pr.cap || 1e9, Math.round(this.fundPool * (pr.pct || 0.1)));
        if (g > 0) {
          this.fundPool -= g; p.cash += g;
          this.ev({ t: 'money', pid: p.id, amount: g, reason: `立项【${pr.name}】` });
          this.addLog(`🌱 ${p.name} 从教育基金池提取 ¥${g}`);
          detail = `从教育基金池提取 ¥${g}`;
        } else detail = '基金池空空如也，分文未得';
        break;
      }
      case 'land2': {
        const empty = BOARD.map((cc, i) => i).filter(i => BOARD[i].type === 'prop' && !this.cells[i].own && !this.cells[i].mortgaged);
        const got = [];
        while (got.length < 2 && empty.length) {
          const gi = empty.splice(Math.floor(Math.random() * empty.length), 1)[0];
          this.cells[gi].own = p.id;
          this.ev({ t: 'buy', pid: p.id, cell: gi, price: 0, grant: true });
          got.push(BOARD[gi].name);
        }
        if (got.length) {
          this.checkOwnership(p);
          if (pr.amt) p.cash += pr.amt;
          detail = `获得 ${got.join('、')}${pr.amt ? ` +¥${pr.amt}` : ''}`;
        } else {
          const comp = (pr.amt || 0) + 4000;
          p.cash += comp;
          this.ev({ t: 'money', pid: p.id, amount: comp, reason: `立项【${pr.name}】补偿` });
          detail = `已无无主地，改为补偿 +¥${comp}`;
        }
        break;
      }
      case 'seize': {
        const others = this.alive().filter(q => q !== p);
        if (others.length) {
          let richest = others[0];
          for (const q of others) if (q.cash > richest.cash) richest = q;
          const amt = Math.min(pr.amt || 5000, Math.round(richest.cash * (pr.pct || 0.2)));
          if (amt > 0) {
            richest.cash -= amt; richest.combo = 0; p.cash += amt;
            this.ev({ t: 'money', pid: p.id, amount: amt, reason: `强取豪夺 ← ${richest.name}` });
            detail = `夺取 ${richest.name} 的 ¥${amt}`;
          } else detail = '对方现金见底，分文未得';
        }
        break;
      }
    }
    const T = HEX_TIERS[pr.tier];
    this.addLog(`🧪 ${p.name} 立项【${T.icon}${pr.name}】（${T.name}）：${detail}`);
    this.ev({ t: 'project_grant', pid: p.id, key, tier: pr.tier, detail });
  }

  // v5.7：研究项目的「每轮开始」类修正（在 startTurn 里紧跟专业通用被动之后调用）
  applyHexPassives(p) {
    const hx = p.hex || {};
    const give = (amt, reason) => { if (amt > 0) { p.cash += amt; this.ev({ t: 'money', pid: p.id, amount: amt, reason }); } };
    if (hx.turnCash) { give(hx.turnCash, '项目·每轮补贴'); }
    if (hx.poorCash && p.cash < (hx.poorCashUnder || 0)) { give(hx.poorCash, '项目·营养快线'); }
    if (hx.noLandCash && this.propCells(p).length === 0) { give(hx.noLandCash, '项目·无地补助'); }
    if (hx.interestPct && p.cash >= (hx.interestMin || 0)) {
      const g = Math.min(hx.interestCap || 1e9, Math.round(p.cash * hx.interestPct));
      if (g > 0) { give(g, '项目·定期利息'); this.addLog(`🏛️ ${p.name} 的【定期存款】生息 +¥${g}`); }
    }
    if (hx.weatherCash && ['rain', 'storm', 'snow', 'fog'].includes(this.weather)) { give(hx.weatherCash, '项目·雨天津贴'); }
    if (hx.sunCash && ['sun', 'heat'].includes(this.weather)) { give(hx.sunCash, '项目·晴天津贴'); }   // v5.10 早八全勤
    if (hx.landmark) {
      const g = this.buildSum(p) * hx.landmark;
      if (g > 0) { give(g, '项目·地标经济'); this.addLog(`🏙️ ${p.name} 的【地标经济】按建筑收成 +¥${g}`); }
    }
    if (hx.legacy) {
      const others = this.alive().filter(q => q !== p);
      if (others.length) {
        let poorest = others[0];
        for (const q of others) if (this.netWorth(q) < this.netWorth(poorest)) poorest = q;
        const pay = Math.min(hx.legacyAmt || 800, poorest.cash);   // v5.10：万民伞 / 遗产继承金额可配置
        if (pay > 0) {
          poorest.cash -= pay; p.cash += pay;
          this.addLog(`🧧 ${poorest.name} 向 ${p.name} 支付【遗产继承】¥${pay}`);
          this.ev({ t: 'money', pid: p.id, amount: pay, reason: '遗产继承' });
          this.hexFx(p, 'legacy', `${poorest.name} 支付 ¥${pay}`);
        }
      }
    }
    if (hx.floor && p.cash < hx.floor) {
      const g = hx.floor - p.cash;
      p.cash = hx.floor;
      this.ev({ t: 'money', pid: p.id, amount: g, reason: '风险兜底' });
      this.hexFx(p, 'safety', `兜底补足 ¥${g}`);
    }
    this.hexSpendRound(p);   // v5.13：消耗「每轮生效」类限次项目的合约次数
  }

  // ---------- v5.13：海克斯「限次」机制 ----------
  // PROJECTS 中带 charges 的项目有合约期：每触发 1 次消耗 1 点，用尽后其全部修正被移除。
  //  「每轮生效」类（turnCash / landmark / legacy / floor / shieldEach / freeReroll…）在 applyHexPassives 里扣；
  //  「事件触发」类（goCash / tollBooth / rentFlat / fundKick）在各自结算点扣。
  hexChargesLeft(p, key) {
    const pr = PROJECTS[key];
    if (!pr || !pr.charges) return Infinity;
    return (p.hexLeft && p.hexLeft[key] != null) ? p.hexLeft[key] : pr.charges;
  }
  hexSpend(p, key) {   // 消耗 1 点合约次数；返回 false 表示已过期不可用
    const pr = PROJECTS[key];
    if (!pr || !pr.charges) return true;
    const left = this.hexChargesLeft(p, key);
    if (left <= 0) return false;
    p.hexLeft[key] = left - 1;
    if (p.hexLeft[key] <= 0) this.expireHex(p, key);
    return true;
  }
  expireHex(p, key) {
    const pr = PROJECTS[key];
    if (!pr) return;
    for (const mk in (pr.mods || {})) {
      const v = (p.hex[mk] || 0) - pr.mods[mk];
      if (v > 1e-9) p.hex[mk] = v; else delete p.hex[mk];
    }
    this.recomputeMaxMods(p);
    const stipend = EXPIRY_STIPEND[pr.tier] || 0;    // v5.14：合约到期发放「结项经费」
    if (stipend > 0) {
      p.cash += stipend;
      this.ev({ t: 'money', pid: p.id, amount: stipend, reason: '结项经费' });
    }
    this.addLog(`⌛ ${p.name} 的立项「${pr.name}」合约到期，效果结束${stipend ? `，发放结项经费 ¥${stipend}` : ''}`);
    this.ev({ t: 'hex_expire', pid: p.id, key, stipend });
  }
  // 少数修正按「取最大值」聚合（同类只生效最强的一档），到期后需重算
  recomputeMaxMods(p) {
    for (const mk of ['floor']) {
      let v = 0;
      for (const key of (p.hexList || [])) {
        const pr = PROJECTS[key];
        if (!pr || this.hexChargesLeft(p, key) <= 0) continue;
        const m = pr.mods || {};
        if (m[mk] !== undefined) v = Math.max(v, m[mk]);
      }
      if (v > 0) p.hex[mk] = v; else delete p.hex[mk];
    }
  }
  // 找出 p 名下「某修正仍在合约期内」的项目 key（供事件触发点按次消耗）
  hexKeyWith(p, modName) {
    for (const key of (p.hexList || [])) {
      const pr = PROJECTS[key];
      if (pr && pr.mods && pr.mods[modName] !== undefined && this.hexChargesLeft(p, key) > 0) return key;
    }
    return null;
  }
  // 每轮消耗一次：只针对含「每轮生效」修正的限次项目
  hexSpendRound(p) {
    const ROUND_MODS = ['turnCash', 'poorCash', 'noLandCash', 'interestPct', 'weatherCash', 'sunCash', 'landmark', 'legacy', 'floor', 'shieldEach', 'freeReroll'];
    for (const key of (p.hexList || []).slice()) {
      const pr = PROJECTS[key];
      if (!pr || !pr.charges) continue;
      const m = pr.mods || {};
      if (!ROUND_MODS.some(mk => m[mk] !== undefined)) continue;
      this.hexSpend(p, key);
    }
  }

  // ---------- 每轮开局：季节 / 天气 / 校历事件 / 物业税 ----------
  beginRound() {
    const prev = this.season;
    this.season = this.rollSeason(prev);
    const S = SEASON[this.season];
    this.ev({ t: 'season', season: this.season, prev, round: this.round });
    this.addLog(`📅 第 ${this.round} 轮 · 市场进入「${S.name}」：收租 ×${S.rentMul}，买地盖房 ×${S.buildMul}`);

    this.weather = pick(WEATHER_POOL);
    const W = WEATHER[this.weather];
    this.ev({ t: 'weather', w: this.weather });
    this.addLog(`${W.icon} 今日${W.name}${W.desc ? '：' + W.desc : ''}`);

    this.calEvent = null;
    // v5.2 校园风貌：每轮开场的风貌结算（提醒横幅 / 银行注资 / 开学补贴 / 校友捐款 / 发免停留卡）
    this.applyFacultyRound();

    // v4.0 终局：进入「经济寒冬」，银行停发工资（v5.2：停发轮次受校园风貌影响）
    const stop = this.salaryStop();
    if (this.round === stop) {
      this.addLog(`❄️ 第 ${stop} 轮起进入「经济寒冬」：银行停发工资，全靠地租和生意过日子！`);
      this.ev({ t: 'endgame', round: stop });
    }
    // v5.8：收益衰减到点播报（15 / 25 / 40 轮），中央看板同步常驻显示当前倍率
    for (const d of INCOME_DECAY) {
      if (this.round === d.r) {
        this.addLog(`📉 第 ${d.r} 轮起市场收紧：除房产租金外的一切奖金收入衰减为 ×${Math.round(d.mul * 100)}%！`);
        this.ev({ t: 'income_decay', round: d.r, mul: d.mul });
      }
    }
    if (this.round > 1 && this.round % 3 === 0) {
      const e = pick(CALEVENTS);
      this.calEvent = e;
      this.ev({ t: 'calevent', id: e.id, name: e.name, icon: e.icon, desc: e.desc, kind: e.kind, fx: e.fx || null });
      this.addLog(`${e.icon} 校历事件【${e.name}】：${e.desc}`);
      this.applyCalEvent(e);
    }
    // 科研投资到期返还（学术长廊）
    for (const q of this.players) {
      if (!q.alive || !q.invest || this.round < q.invest.due) continue;
      q.cash += q.invest.back;
      this.addLog(`🔬 ${q.name} 的科研投资结项，返还 ¥${q.invest.back}`);
      this.ev({ t: 'money', pid: q.id, amount: q.invest.back, reason: '科研投资结项' });
      q.invest = null;
    }
    this.collectTax();
  }
  // ---------- v5.2：校园风貌的每轮结算 ----------
  applyFacultyRound() {
    if (!this.faculty) return;
    const r = this.round;
    // 免费轮 / 免租轮：本轮开场就把整屏提醒打出来，让所有人提前知道
    if (this.isFreeRound()) {
      this.addLog(`🎟️ 【免费轮校区】第 ${r} 轮 —— 全场买地皮、盖楼完全免费！`);
      this.ev({ t: 'faculty_round', kind: 'freeRound', round: r, title: '免费轮', sub: '这一轮全场买地皮、盖楼完全免费' });
    }
    if (this.isFreeRentRound()) {
      const left = this.freeRentRounds.filter(x => x >= r).length;
      this.addLog(`🕊️ 【免租轮校区】第 ${r} 轮 —— 免租轮！踩到谁的地都不用付租金（本局还剩 ${left} 轮）`);
      this.ev({ t: 'faculty_round', kind: 'freeRent', round: r, title: '免租轮', sub: '这一轮全场踩到别人的地都不用付租金', left });
    }
    // 金融：银行每轮向教育基金池自动注资
    if (this.facIs('finance')) {
      this.addToFund(500);
      this.addLog(`🏦 【金融校区】银行向教育基金池自动注资 ¥500`);
    }
    // 改革：全场每轮开局领开学补贴
    if (this.facIs('reform')) {
      const items = [];
      for (const q of this.alive()) { q.cash += 300; items.push({ pid: q.id, amount: 300 }); }
      if (items.length) this.ev({ t: 'faculty_wave', icon: '⚡', name: '开学补贴', gain: true, items, total: 300 * items.length });
      this.addLog(`⚡ 【改革校区】开学补贴到账：全体 +¥300`);
    }
    // 百年学府：每 3 轮（与校历同刻）发校友捐款
    if (this.facIs('ancient') && r > 1 && r % 3 === 0) {
      const items = [];
      for (const q of this.alive()) { q.cash += 300; items.push({ pid: q.id, amount: 300 }); }
      if (items.length) this.ev({ t: 'faculty_wave', icon: '🏛️', name: '校友捐款', gain: true, items, total: 300 * items.length });
      this.addLog(`🏛️ 【百年学府】校友捐款到账：全体 +¥300`);
    }
    // 师范：每过 10 轮全场各得 1 张「免停留卡」
    if (this.facIs('normal') && r % 10 === 0) {
      for (const q of this.alive()) { q.stayFree = (q.stayFree || 0) + 1; this.ev({ t: 'stay_free_gain', pid: q.id, count: q.stayFree }); }
      this.addLog(`🎯 【师范校区】第 ${r} 轮福利：全场各领 1 张「免停留卡」`);
    }
    // ---------- v5.10：新城邦的每轮结算 ----------
    const wave = (icon, name, fn, gain = true) => {   // gain=true 全场进账 / false 全场缴费
      const items = [];
      for (const q of this.alive()) { const d = fn(q); if (d) { q.cash += d; items.push({ pid: q.id, amount: d }); } }
      if (items.length) this.ev({ t: 'faculty_wave', icon, name, gain, items, total: items.reduce((s, x) => s + x.amount, 0) });
    };
    if (this.facIs('lantern')) wave('🏮', '灯会补贴', () => 150);
    if (this.facIs('cafe') && r % 3 === 0) wave('☕', '咖啡补贴', () => 250);
    if (this.facIs('market') && r % 4 === 0) wave('🧺', '摊位分红', () => 200);
    if (this.facIs('midterm') && r % 5 === 0) {
      let sum = 0;
      for (const q of this.alive()) { const pay = Math.min(q.cash, 400); q.cash -= pay; sum += pay; this.ev({ t: 'charge', pid: q.id, amount: pay, creditor: null, reason: '期中周·助学捐款', cell: q.pos, toPool: true }); this.ev({ t: 'paid', pid: q.id, amount: pay, creditor: null, toPool: true }); }
      if (sum > 0) this.addToFund(sum);
      this.addLog(`📝 【期中周校区】全场共缴 ¥${sum} 助学捐款（进教育基金池）`);
    }
    if (this.facIs('lottery') && r % 3 === 0 && this.alive().length >= 2) {
      const win = pick(this.alive());
      win.cash += 1000;
      this.ev({ t: 'money', pid: win.id, amount: 1000, reason: '抽奖校区·独中头奖' });
      this.ev({ t: 'facfx', pid: win.id, kind: 'lottery', name: '抽奖校区', detail: '独中 ¥1000！' });
      const items = [];
      for (const q of this.alive()) if (q !== win) { const pay = Math.min(q.cash, 100); q.cash -= pay; items.push({ pid: q.id, amount: -pay }); this.ev({ t: 'paid', pid: q.id, amount: pay, creditor: null, toPool: true }); this.addToFund(pay); }
      this.addLog(`🎰 【抽奖校区】${win.name} 独中 ¥1000！其余玩家各付 ¥100 参与费`);
    }
    if (this.facIs('oldbook') && r % 3 === 0) wave('📦', '旧书集摆摊收益', q => Math.min(3000, this.propCells(q).length * 120));
    if (this.facIs('nightowl')) {
      const list = this.alive().slice().sort((a, b) => a.cash - b.cash);
      if (list.length >= 2) {
        const poor = list[0], rich = list[list.length - 1];
        poor.cash += 600;
        this.ev({ t: 'money', pid: poor.id, amount: 600, reason: '夜猫校区·熬夜补贴' });
        const pay = Math.min(rich.cash, 300);
        if (pay > 0) { rich.cash -= pay; this.addToFund(pay); this.ev({ t: 'facfx', pid: rich.id, kind: 'nightowl', name: '夜猫校区', detail: `夜宵钱 −¥${pay}` }); this.ev({ t: 'paid', pid: rich.id, amount: pay, creditor: null, toPool: true }); }
      }
    }
    if (this.facIs('shuffle') && r % 8 === 0) {
      const list = this.alive();
      if (list.length >= 2) {
        for (const q of list) {
          const others = list.filter(x => x !== q);
          const t = pick(others);
          const pay = Math.min(q.cash, 200);
          if (pay > 0) { q.cash -= pay; t.cash += pay; this.ev({ t: 'facfx', pid: q.id, kind: 'shuffle', name: '洗牌校区', detail: `¥${pay} 飞向 ${t.name}` }); this.ev({ t: 'money', pid: t.id, amount: pay, reason: '洗牌校区·资金互转' }); }
        }
        this.addLog('🔀 【洗牌校区】全场资金随机互转了一轮，钱在谁手里全看天意');
      }
    }
    if (this.facIs('gala') && r % 5 === 0) {
      const list = this.alive();
      if (list.length) {
        let rich = list[0];
        for (const q of list) if (this.netWorth(q) > this.netWorth(rich)) rich = q;
        const pay = Math.min(rich.cash, 800);
        if (pay > 0) { rich.cash -= pay; this.addToFund(pay); this.addLog(`🎗️ 【校友日校区】${rich.name} 捐款 ¥${pay}（进教育基金池）`); this.ev({ t: 'paid', pid: rich.id, amount: pay, creditor: null, toPool: true }); }
      }
    }
    if (this.facIs('scholar') && r % 3 === 0 && this.alive().length >= 2) {
      const t = pick(this.alive());
      t.skillLeft = (t.skillLeft || 0) + 1;
      this.addLog(`🎤 【讲座校区】${t.name} 听讲座入迷，技能次数 +1`);
      this.ev({ t: 'facfx', pid: t.id, kind: 'scholar', name: '讲座校区', detail: '技能次数 +1' });
      for (const q of this.alive()) if (q !== t) { const pay = Math.min(q.cash, 150); if (pay > 0) { q.cash -= pay; this.addToFund(pay); this.ev({ t: 'paid', pid: q.id, amount: pay, creditor: null, toPool: true }); } }
    }
    if (this.facIs('snowville')) {
      if (['rain', 'fog', 'snow', 'storm'].includes(this.weather)) wave('❄️', '恶劣天气补贴', () => 250);
      else if (['sun', 'heat'].includes(this.weather)) {
        for (const q of this.alive()) { const pay = Math.min(q.cash, 150); if (pay > 0) { q.cash -= pay; this.addToFund(pay); } }
        this.addLog('☀️ 【冰雪校区】艳阳天实在受不了，全场各付 ¥150 避暑费');
      }
    }
    if (this.facIs('freshman') && r > 10 && r % 3 === 0) {
      let sum = 0;
      for (const q of this.alive()) { const pay = Math.min(q.cash, 300); q.cash -= pay; sum += pay; }
      if (sum > 0) this.addToFund(sum);
      this.addLog(`🍼 【新生校区】社团费到缴：全场共缴 ¥${sum}`);
    }
    if (this.facIs('dicegod')) {
      const t = pick(this.alive());
      t.stepBuffs = (t.stepBuffs || []).concat([2]);
      const pay = Math.min(t.cash, 300);
      if (pay > 0) t.cash -= pay;
      this.addLog(`🎲 【骰神校区】${t.name} 被骰神摸了头：下次移动 +2 步${pay ? `（车马费 ¥${pay}）` : ''}`);
      this.ev({ t: 'facfx', pid: t.id, kind: 'dicegod', name: '骰神校区', detail: '下次移动 +2 步' });
    }
    if (this.facIs('charity') && r % 5 === 0) {
      const list = this.alive().slice().sort((a, b) => this.netWorth(b) - this.netWorth(a));
      if (list.length >= 2) {
        const rich = list[0], poor = list[list.length - 1];
        const pay = Math.min(rich.cash, 600);
        if (pay > 0) { rich.cash -= pay; poor.cash += pay; this.addLog(`🤲 【公益校区】${rich.name} 向 ${poor.name} 转账 ¥${pay}`); this.ev({ t: 'money', pid: poor.id, amount: pay, reason: '公益校区·先富带后富' }); }
      }
    }
    if (this.facIs('professor') && r % 3 === 0) {
      const cand = this.aliveList().filter(q => this.propCells(q).some(i => this.cells[i].level < 4));
      if (cand.length) {
        const t = pick(cand);
        const ci = pick(this.propCells(t).filter(i => this.cells[i].level < 4));
        this.cells[ci].level++;
        this.addLog(`👨‍🏫 【名师校区】${t.name} 的「${BOARD[ci].name}」获名师监工，免费升到 Lv${this.cells[ci].level}`);
        this.ev({ t: 'cardBuild', pid: t.id, cell: ci, level: this.cells[ci].level, hotel: this.cells[ci].level === 4, help: true });
      }
    }
    if (this.facIs('reunion') && r % 4 === 0 && this.alive().length >= 2) {
      const t = pick(this.alive());
      const n = this.alive().length - 1;
      const pay = Math.min(t.cash, 150 * n);
      if (pay > 0) t.cash -= pay;
      const items = [];
      for (const q of this.alive()) if (q !== t) { q.cash += 150; items.push({ pid: q.id, amount: 150 }); }
      if (items.length) this.ev({ t: 'faculty_wave', icon: '🍲', name: '聚餐校区', gain: true, items, total: 150 * items.length });
      this.addLog(`🍲 【聚餐校区】${t.name} 请全场吃饭（花了 ¥${pay}），大家吃得都很开心`);
      this.aiChat(t, pick(['🍲 我请客！', '这顿算我的']), true);
    }
  }
  // 校历事件的具体结算
  applyCalEvent(e) {
    const alive = this.alive();
    switch (e.kind) {
      case 'moneyAll': {
        // 全员类结算合并成一条播报：避免轮次开场连播 N 条大字横幅造成积压
        const items = [];
        for (const q of alive) { q.cash += e.amount; items.push({ pid: q.id, amount: e.amount }); }
        if (items.length) this.ev({ t: 'calwave', icon: e.icon, name: e.name, gain: true, items, total: e.amount * items.length });
        break;
      }
      case 'payAll': {
        const items = []; let sum = 0;
        for (const q of alive) {
          const pay = Math.min(q.cash, e.amount); q.cash -= pay; q.combo = 0; sum += pay;
          items.push({ pid: q.id, amount: pay });
        }
        this.addToFund(sum);
        if (items.length) this.ev({ t: 'calwave', icon: e.icon, name: e.name, gain: false, items, total: sum });
        break;
      }
      case 'richTax': {
        if (!alive.length) break;
        const rich = alive.slice().sort((x, y) => this.netWorth(y) - this.netWorth(x))[0];
        const pay = Math.max(0, Math.min(e.amount, rich.cash));
        rich.cash -= pay; rich.combo = 0; this.addToFund(pay);
        this.addLog(`💝 ${rich.name} 向教育基金池捐赠 ¥${pay}`);
        this.ev({ t: 'charge', pid: rich.id, amount: pay, creditor: null, reason: e.name, cell: rich.pos, toPool: true });
        this.ev({ t: 'paid', pid: rich.id, amount: pay, creditor: null, toPool: true });
        break;
      }
      case 'poorBonus': {
        if (!alive.length) break;
        const poor = alive.slice().sort((x, y) => x.cash - y.cash)[0];
        poor.cash += e.amount;
        this.addLog(`🌱 ${poor.name} 获得助学金 ¥${e.amount}`);
        this.ev({ t: 'money', pid: poor.id, amount: e.amount, reason: e.name });
        break;
      }
      case 'bailout': {
        const items = [];
        for (const q of alive) {
          if (q.cash < e.low) { q.cash += e.amount; this.addLog(`🇨🇳 ${q.name} 领取消费补贴 ¥${e.amount}`); items.push({ pid: q.id, amount: e.amount }); }
        }
        if (items.length) this.ev({ t: 'calwave', icon: e.icon, name: e.name, gain: true, items, total: e.amount * items.length });
        break;
      }
      // ---- v5.1 新增结算 ----
      case 'lottery': {
        if (!alive.length) break;
        const winner = pick(alive);
        const cons = e.consolation || 0;
        const items = [];
        for (const q of alive) {
          const amt = q.id === winner.id ? e.amount : cons;
          q.cash += amt; items.push({ pid: q.id, amount: amt });
        }
        this.addLog(`🎤 校历【${e.name}】：${winner.name} 夺冠独得 ¥${e.amount}，其余各领参与奖 ¥${cons}`);
        this.ev({ t: 'caleventHit', icon: e.icon, name: e.name, winner: winner.id, amount: e.amount, consolation: cons, items, total: e.amount + cons * (alive.length - 1) });
        break;
      }
      case 'fundShare': {
        if (!alive.length || this.fundPool <= 0) break;
        const total = Math.floor(this.fundPool * (e.share || 0.5));
        if (total <= 0) break;
        const recv = alive.filter(q => !q.fundBanned);
        if (!recv.length) break;
        const share = Math.floor(total / recv.length);
        if (share <= 0) break;
        this.fundPool -= share * recv.length;
        const items = [];
        for (const q of recv) { q.cash += share; items.push({ pid: q.id, amount: share }); }
        this.addLog(`🏦 校历【${e.name}】：教育基金池分出 ¥${share * alive.length}，每人 +¥${share}`);
        this.ev({ t: 'calwave', icon: e.icon, name: e.name, gain: true, items, total: share * alive.length });
        break;
      }
      case 'stealPoor': {
        if (alive.length < 2) break;
        const rich = alive.slice().sort((x, y) => x.cash - y.cash)[alive.length - 1];
        const poor = alive.slice().sort((x, y) => x.cash - y.cash)[0];
        if (!rich || !poor || rich.id === poor.id) break;
        const pay = Math.max(0, Math.min(e.amount, rich.cash));
        rich.cash -= pay; rich.combo = 0; poor.cash += pay;
        this.addLog(`🤲 校历【${e.name}】：${rich.name} → ${poor.name} 转移 ¥${pay}`);
        this.ev({ t: 'charge', pid: rich.id, amount: pay, creditor: null, reason: e.name, cell: rich.pos, toPool: false });
        this.ev({ t: 'paid', pid: rich.id, amount: pay, creditor: null, toPool: false });
        this.ev({ t: 'money', pid: poor.id, amount: pay, reason: e.name });
        break;
      }
      case 'cardsLottery': {
        const items = [];
        for (const q of alive) if (e.cards > 0) this.grantCards(q, q.pos, e.cards, e.name);
        const cand = alive.filter(q => !q.fundBanned);
        const lucky = cand.length ? pick(cand) : null;
        if (lucky) {
          lucky.cash += e.amount;
          this.addLog(`🎪 校历【${e.name}】：${lucky.name} 嘉年华抽中大奖 ¥${e.amount}`);
          this.ev({ t: 'caleventHit', icon: e.icon, name: e.name, winner: lucky.id, amount: e.amount, consolation: 0, items: [{ pid: lucky.id, amount: e.amount }], total: e.amount });
        } else if (items.length) {
          this.ev({ t: 'calwave', icon: e.icon, name: e.name, gain: true, items, total: 0 });
        }
        break;
      }
      case 'poorMore': {
        if (!alive.length) break;
        const poor = alive.slice().sort((x, y) => x.cash - y.cash)[0];
        const other = e.other || 0;
        const items = [];
        for (const q of alive) {
          const amt = q.id === poor.id ? e.amount : other;
          q.cash += amt; items.push({ pid: q.id, amount: amt });
        }
        this.addLog(`🖼️ 校历【${e.name}】：${poor.name} 拍出最高价 +¥${e.amount}，其余各 +¥${other}`);
        this.ev({ t: 'caleventHit', icon: e.icon, name: e.name, winner: poor.id, amount: e.amount, consolation: other, items, total: e.amount + other * (alive.length - 1) });
        break;
      }
      case 'study': {
        const items = [];
        for (const q of alive) { q.cash += e.amount; items.push({ pid: q.id, amount: e.amount }); }
        if (items.length) this.ev({ t: 'calwave', icon: e.icon, name: e.name, gain: true, items, total: e.amount * items.length });
        break;
      }
      default: break; // slow/fast/rainy/rentUp/rentDown/buildSale/buildBoom 在对应结算处生效
    }
  }
  // 市场骰：1-2 淡 / 3-4 平 / 5-6 旺，带惯性（旺季更旺、淡季更淡）
  rollSeason(prev) {
    const d = 1 + Math.floor(Math.random() * 6);
    let tier = d <= 2 ? 0 : (d <= 4 ? 1 : 2);
    if (prev === 'high') tier = Math.min(2, tier + 1);
    else if (prev === 'low') tier = Math.max(0, tier - 1);
    return SEASON_ORDER[tier];
  }
  // 物业税：只对"大户"征收（v3.5：地产 >6 块 或 建筑 >6 级才收，税额温和，全部进教育基金池）
  // v5.1：抵押中的地产不计入税基 —— 已押给银行，不再按持有征税
  collectTax() {
    if (this.facIs('austerity')) { this.addLog('⏰ 【紧缩校区】本局免征物业税，本轮无人缴税'); return; }   // v5.2
    const thr = (this.facIs('finance') || this.facIs('hxMix')) ? 5 : 6;   // v5.2 金融 / v5.10 极光之城：起征门槛下调 1
    const items = [];
    for (const p of this.alive()) {
      let hold = 0, bld = 0;
      this.cells.forEach((cs, i) => {
        if (cs.own !== p.id || cs.mortgaged) return;
        hold++; if (BOARD[i].type === 'prop') bld += cs.level;
      });
      let tax = Math.max(0, bld - thr) * 130 + Math.max(0, hold - thr) * 90;
      tax = Math.min(tax, 1800);   // v5.0：税率与上限小幅下调
      // v5.10：税费返还 / 报税大师 / 免税特许
      if (tax > 0 && p.hex && p.hex.taxCut) {
        const sv = tax - Math.max(0, Math.round(tax * (1 - p.hex.taxCut)));
        if (sv > 0) { tax -= sv; this.hexFx(p, 'taxrebate', `报税减免 −¥${sv}`); }
      }
      if (tax <= 0) continue;
      if (p.cash < tax) continue;   // 现金不足则本年暂缓，避免与筹钱逻辑纠缠
      p.cash -= tax; p.combo = 0;   // v5.8：扣钱断连击
      this.addToFund(tax);
      this.addLog(`🏛️ ${p.name} 名下 ${hold} 块地产 / ${bld} 级建筑，缴纳物业税 ¥${tax}`);
      items.push({ pid: p.id, amount: tax });
    }
    // 合并成一条播报（多个大户同轮缴税时不再连播多条大字横幅）
    if (items.length) this.ev({ t: 'tax', items, total: items.reduce((s, x) => s + x.amount, 0) });
  }
  // 成就
  giveAch(p, id) {
    if (!p || !p.alive) return;
    const a = ACHS[id]; if (!a) return;
    if (!p.ach) p.ach = {};
    if (p.ach[id]) return;
    p.ach[id] = 1;
    p.cash += a.reward;
    this.addLog(`🏅 ${p.name} 达成成就【${a.name}】${a.desc}，奖励 ¥${a.reward}`);
    this.ev({ t: 'ach', pid: p.id, id, name: a.name, desc: a.desc, reward: a.reward });
  }
  // 聊天 / 表情（AI 也参与）：只发 chat 事件，客户端即时显示，不排进动画队列
  chat(p, text) {
    const t = String(text == null ? '' : text).replace(/[\r\n\t]/g, ' ').slice(0, 30).trim();
    if (!t) return;
    const msg = `💬 ${p.name}：${t}`;
    this.log.push({ t: Date.now(), msg });
    if (this.log.length > 200) this.log.shift();
    this.ev({ t: 'chat', pid: p.id, name: p.name, text: t, ai: !!p.isAI });
  }
  aiChat(p, text, force) { if (p && p.isAI && p.alive && (force || Math.random() < 0.4)) this.chat(p, text); }
  // 大厅改专业
  setMajor(p, major) {
    if (this.phase !== 'lobby') return;
    if (!MAJORS[major]) return;
    p.major = major;
  }
  // 掷骰前购买并使用一次性道具（免罚符价格随轮数上涨：¥(400 + 150×轮数)，仅当轮有效）
  useItem(p, item) {
    if (this.phase !== 'roll' || this.curp() !== p) return;
    const it = ITEMS[item]; if (!it) return;
    const cost = item === 'shield' ? this.shieldCost() : it.cost;
    if (item === 'shield' && this.round - (p.shieldRound || -9) <= 1) {
      // v5.8：免罚符不能连续购买 —— 本轮买了，下轮锁定
      this.addLog(`🛡️ ${p.name} 刚买过免罚符（冷却中），本轮不能再买`);
      this.ev({ t: 'item_locked', pid: p.id, item, reason: '免罚符冷却中（上轮刚买，下轮才能再买）' });
      return;
    }
    if (p.cash < cost) return;
    p.cash -= cost;
    if (item === 'shield') { p.shield = true; p.shieldRound = this.round; }
    this.addToFund(Math.round(cost * FUND_SHARE));   // v5.0：道具花费的 1/3 进教育基金池
    this.addLog(`🎒 ${p.name} 花 ¥${cost} 使用道具「${it.name}」（其中 ¥${Math.round(cost * FUND_SHARE)} 进教育基金池）`);
    this.ev({ t: 'item', pid: p.id, item, cost, name: it.name });
  }
  // ---------- 重掷骰（v4.0：掷骰后可花 ¥1200 重投一次，替代旧"幸运骰自选点数"） ----------
  confirmRoll(p) {
    if (this.phase !== 'reroll' || !this.pendingReroll || this.pendingReroll.pid !== p.id) return;
    this.clearTimer(); this.pendingReroll = null;
    this.execRoll(p);
  }
  doReroll(p) {
    if (this.phase !== 'reroll' || !this.pendingReroll || this.pendingReroll.pid !== p.id) return;
    this.clearTimer(); this.pendingReroll = null;
    let cost = this.rerollCostFor(p);
    // v5.7 重投大师：每回合首次重投免费
    let hexFree = false;
    if (p.hex && p.hex.freeReroll && !p.hexFreeUsed) { cost = 0; hexFree = true; p.hexFreeUsed = true; }
    if (p.cash < cost) { this.execRoll(p); return; }
    const freeRoll = hexFree || (cost === 0 && (MAJORS[p.major] || {}).rerollFree && p.skillLeft > 0);
    if (freeRoll && !hexFree) p.skillLeft--;
    else { p.cash -= cost; this.addToFund(Math.round(cost * FUND_SHARE)); }   // v5.0：重掷花费的 1/3 进教育基金池
    p.rerollUsed = true;
    p.rerollStreak = (p.rerollLastRound === this.round - 1) ? (p.rerollStreak || 0) + 1 : 1;   // v5.8：连用计手
    p.rerollLastRound = this.round;
    const onBr = this.onBranch(p.pos);   // v5.6：岔路内重投也是单骰
    const [d1, d2] = this.rollDice(p, onBr);
    this.dice = onBr ? [d1, 0] : [d1, d2];
    const rollTxt = onBr ? `${d1} 点（岔路单骰）` : `${d1} + ${d2} = ${d1 + d2}`;
    if (hexFree) {
      this.addLog(`🔁 ${p.name} 的【重投大师】生效，免费重投：${rollTxt}`);
      this.ev({ t: 'hexfx', pid: p.id, key: 'rerollmaster', name: '重投大师', detail: `免费重投 ${onBr ? d1 + ' 点' : d1 + '+' + d2}` });
    } else if (freeRoll) {
      const mj = MAJORS[p.major] || {};
      this.addLog(`${mj.icon} ${p.name} 发动【${mj.skill}】免费重投一次：${rollTxt}`);
      this.ev({ t: 'skill', pid: p.id, major: p.major, name: mj.skill, detail: `免费重投 ${onBr ? d1 + ' 点' : d1 + '+' + d2}`, active: false });
    } else {
      this.addLog(`🎲 ${p.name} 花 ¥${cost} 重投一次：${rollTxt}`);
      this.ev({ t: 'item', pid: p.id, item: 'reroll', cost, name: '重掷骰', detail: `重投 ${onBr ? d1 + ' 点' : d1 + '+' + d2}` });
    }
    this.ev({ t: 'roll', pid: p.id, d1, d2: onBr ? 0 : d2, single: onBr });
    this.execRoll(p);
  }
  aiReroll(p) {
    if (this.phase !== 'reroll' || !this.pendingReroll || this.pendingReroll.pid !== p.id) return;
    const sum = (this.dice ? this.dice[0] + this.dice[1] : 7);
    // v5.4：AI 更精明 —— 先看看落点：落点是自己的地 / 无主地（能买）就不花冤枉钱重投
    const tgt = this.pendingReroll.target;
    if (tgt != null && sum <= 6) {
      const cs = this.cells[tgt], c = BOARD[tgt] || {};
      const mine = cs && cs.own === p.id;                       // 落自己家：安全
      const buyable = c.type === 'prop' && cs && !cs.own && p.cash >= (c.price || 0) * 0.8;  // 落点是好地还想买
      if (mine || buyable) { this.confirmRoll(p); return; }
    }
    // 点数太差且现金宽裕才值得花钱重投
    if (sum <= 5 && p.cash >= this.rerollCostFor(p) + this.safety(p) * 0.5) this.doReroll(p);
    else this.confirmRoll(p);
  }
  // 免罚符价格：随轮数上涨（前期便宜、后期租金高也水涨船高），仅当轮有效
  // 免罚符价格（v5.1：分段价整体再下调约 8%）
  //   第 1~8 轮 ：260 + 55 × 轮          → ¥315 … ¥700
  //   第 9~20 轮：700 + 110 × (轮 − 8)   → ¥810 … ¥2020
  //   第 21 轮起：2020 + 150 × (轮 − 20) → ¥2170 …
  shieldCost() {
    const r = Math.max(1, this.round);
    if (r <= 8) return 260 + 55 * r;
    if (r <= 20) return 700 + 110 * (r - 8);
    return 2020 + 150 * (r - 20);
  }

  // ---------- 岔路（v3.5 学术长廊 + v4.0 创业大道） ----------
  enterBranch(p) {
    if (this.phase !== 'branch' || !this.pendingBranch || this.pendingBranch.pid !== p.id) return;
    const line = this.pendingBranch.line || 'A';
    this.pendingBranch = null;
    if (line === 'B') {
      this.addLog(`🚀 ${p.name} 转进「创业大道」，走上高风险高回报的路子`);
      p.pos = BRANCH2.START;
    } else {
      this.addLog(`🎓 ${p.name} 转进「学术长廊」，去看看外圈没有的风景`);
      p.pos = BRANCH.START;
    }
    this.ev({ t: 'teleport', pid: p.id, cell: p.pos });
    // 专业：航天 · 一飞冲天（进入岔路额外 +¥900）
    if (p.major === 'aero' && p.skillLeft > 0) {
      p.skillLeft--; p.cash += 900;
      this.addLog(`🛰️ ${p.name} 发动【一飞冲天】+¥900`);
      this.ev({ t: 'skill', pid: p.id, major: 'aero', name: '一飞冲天', detail: '+¥900' });
      this.ev({ t: 'money', pid: p.id, amount: 900, reason: '一飞冲天' });
    }
    // v5.3：通用被动 —— 进入岔路收益（branch）
    {
      const amj = MAJORS[p.major] || {};
      if (amj.branch && p.skillLeft > 0) {
        p.skillLeft--; p.cash += amj.branch;
        this.addLog(`${amj.icon} ${p.name} 发动【${amj.skill}】+¥${amj.branch}`);
        this.ev({ t: 'skill', pid: p.id, major: p.major, name: amj.skill, detail: `+¥${amj.branch}` });
        this.ev({ t: 'money', pid: p.id, amount: amj.branch, reason: amj.skill });
      }
    }
    this.resolveCell(p);
  }
  declineBranch(p) {
    if (this.phase !== 'branch' || !this.pendingBranch || this.pendingBranch.pid !== p.id) return;
    this.pendingBranch = null;
    this.addLog(`${p.name} 在长廊入口想了想，还是走大路`);
    this.afterResolve(p, false);
  }
  aiBranch(p) {
    if (this.phase !== 'branch' || !this.pendingBranch || this.pendingBranch.pid !== p.id) return;
    // AI：现金宽裕才进岔路（岔路是事件格，进去不亏，但留着现金更稳）
    if (p.cash >= this.safety(p)) this.enterBranch(p);
    else this.declineBranch(p);
  }
  buyInvest(p) {
    if (this.phase !== 'invest' || !this.pendingInvest || this.pendingInvest.pid !== p.id) return;
    const { cost, back, rounds } = this.pendingInvest;
    this.pendingInvest = null;
    if (p.cash < cost) { this.declineInvest(p); return; }
    p.cash -= cost; p.combo = 0;   // v5.8：扣钱断连击
    p.invest = { due: this.round + rounds, back };
    this.addLog(`🔬 ${p.name} 投入 ¥${cost} 科研经费，第 ${p.invest.due} 轮返还 ¥${back}`);
    this.ev({ t: 'invest', pid: p.id, cost, back });
    this.afterResolve(p, true);
  }
  declineInvest(p) {
    if (this.phase !== 'invest' || !this.pendingInvest || this.pendingInvest.pid !== p.id) return;
    this.pendingInvest = null;
    this.addLog(`${p.name} 观望了一下，没有投资`);
    this.afterResolve(p, false);
  }
  aiInvest(p) {
    if (this.phase !== 'invest' || !this.pendingInvest || this.pendingInvest.pid !== p.id) return;
    if (p.cash >= 2000 + this.safety(p) * 1.2) this.buyInvest(p);
    else this.declineInvest(p);
  }

  // ---------- v5.1 主动技：自己回合开始时询问是否发动 ----------
  askSkill(p) { return this.phase === 'skill' && this.pendingSkill && this.pendingSkill.pid === p.id; }
  // 回合开始流程：先弹主动技询问，选完（发动或跳过）再进入掷骰
  openSkillPrompt(p) {
    const mj = MAJORS[p.major];
    if (!mj || mj.mode !== 'active' || p.skillLeft <= 0 || p.skillUsedThisTurn) { this.schedule(); return false; }
    this.phase = 'skill';
    this.pendingSkill = { pid: p.id, key: p.major };
    this.addLog(`❓ ${p.name} 的【${mj.skill}】可以发动（剩余 ${p.skillLeft} 次）`);
    this.ev({ t: 'ask_skill', pid: p.id, key: p.major });
    this.setTimer(TURN_MS, () => this.skipSkill(p));
    if (p.isAI) this.aiTimers.push(setTimeout(() => this.aiSkill(p), rnd(2000, 4200)));
    return true;
  }
  // 真正结算一个主动技的效果；skillLeft 已在校验时扣除
  applyActiveSkill(p, key) {
    switch (key) {
      case 'mech': {   // 精益制造：本回合盖房 −46% + 立刻 +¥1350
        p.buildCutTurn = 0.46; p.cash += 1350;
        this.ev({ t: 'money', pid: p.id, amount: 1350, reason: '精益制造' });
        return '+¥1350，本回合盖房 −46%';
      }
      case 'newe': {   // 储能放大：立刻 +现金 11%（上限 3650）+ 本轮收租 +36%
        const gain = Math.min(3650, Math.round(p.cash * 0.11));
        p.cash += gain; p.rentBuff = (p.rentBuff || 0) + 0.36;
        this.ev({ t: 'money', pid: p.id, amount: gain, reason: '储能放大' });
        return `+¥${gain}，本轮收租 +36%`;
      }
      case 'pharm': {  // 对症下药：立刻 +¥550 + 本轮被收租减免 55%
        p.cash += 550; p.defBuff = (p.defBuff || 0) + 0.55;
        this.ev({ t: 'money', pid: p.id, amount: 550, reason: '对症下药' });
        return '+¥550，本轮被收租 −55%';
      }
      case 'auto': {   // 流水线：本回合移动 +2 步，落在己方地产再 +¥820
        p.buffSteps = (p.buffSteps || 0) + 2; p.autoBonus = true;
        return '本回合移动 +2 步';
      }
      case 'mse': {    // 相变强化：本轮自己地产收租 +55%
        p.rentBuff = (p.rentBuff || 0) + 0.55;
        return '本轮自己地产收租 +55%';
      }
      case 'music': {  // 共鸣演出：立刻 +¥900，其他玩家各付 ¥270
        p.cash += 900;
        this.ev({ t: 'money', pid: p.id, amount: 900, reason: '共鸣演出' });
        let extra = 0;
        for (const q of this.alive()) {
          if (q.id === p.id) continue;
          const pay = Math.min(270, Math.max(0, q.cash));
          q.cash -= pay; q.combo = 0; p.cash += pay; extra += pay;
          this.ev({ t: 'money', pid: q.id, amount: -pay, reason: '共鸣演出·出场费' });
        }
        if (extra > 0) this.ev({ t: 'money', pid: p.id, amount: extra, reason: '共鸣演出·出场费' });
        return `+¥${900 + extra}`;
      }
      case 'psych': {  // 读心术：从总资产最高者处抽走 ¥1100
        const others = this.alive().filter(q => q.id !== p.id);
        if (!others.length) return '无人可读心';
        let rich = others[0];
        for (const q of others) if (this.netWorth(q) > this.netWorth(rich)) rich = q;
        const take = Math.min(1100, Math.max(0, rich.cash));
        rich.cash -= take; rich.combo = 0; p.cash += take;
        this.ev({ t: 'money', pid: rich.id, amount: -take, reason: '被读心' });
        this.ev({ t: 'money', pid: p.id, amount: take, reason: '读心术' });
        return `从 ${rich.name} 处取得 ¥${take}`;
      }
      // ===== v5.3 新增主动技 =====
      case 'elec': {   // 峰谷套利：立刻 +¥1150，本回合买地 6.4 折
        p.buyCutTurn = 0.36; p.cash += 1150;
        this.ev({ t: 'money', pid: p.id, amount: 1150, reason: '峰谷套利' });
        return '+¥1150，本回合买地 6.4 折';
      }
      case 'robot': {  // 机械臂协作：本回合盖房 −55%，立刻 +¥920
        p.buildCutTurn = 0.55; p.cash += 900;
        this.ev({ t: 'money', pid: p.id, amount: 900, reason: '机械臂协作' });
        return '+¥900，本回合盖房 −55%';
      }
      case 'ai': {     // 模型推理：本轮收租 +32%，并从总资产最高者处取 ¥730
        p.rentBuff = (p.rentBuff || 0) + 0.32;
        const others = this.alive().filter(q => q.id !== p.id);
        let got = 0;
        if (others.length) {
          let rich = others[0];
          for (const q of others) if (this.netWorth(q) > this.netWorth(rich)) rich = q;
          got = Math.min(730, Math.max(0, rich.cash));
          rich.cash -= got; rich.combo = 0; p.cash += got;
          this.ev({ t: 'money', pid: rich.id, amount: -got, reason: '被模型推理' });
          this.ev({ t: 'money', pid: p.id, amount: got, reason: '模型推理' });
        }
        return `本轮收租 +35%${got > 0 ? `，取得 ¥${got}` : ''}`;
      }
      case 'or': {     // 资源调度：立刻 +¥820，本回合移动 +3 步
        p.buffSteps = (p.buffSteps || 0) + 3; p.cash += 820;
        this.ev({ t: 'money', pid: p.id, amount: 820, reason: '资源调度' });
        return '+¥820，本回合移动 +3 步';
      }
      case 'mkt': {    // 带货直播：立刻 +¥1100，其他每位玩家各付 ¥230
        p.cash += 1100;
        this.ev({ t: 'money', pid: p.id, amount: 1100, reason: '带货直播' });
        let extra = 0;
        for (const q of this.alive()) {
          if (q.id === p.id) continue;
          const pay = Math.min(230, Math.max(0, q.cash));
          q.cash -= pay; q.combo = 0; p.cash += pay; extra += pay;
          this.ev({ t: 'money', pid: q.id, amount: -pay, reason: '带货直播·坑位费' });
        }
        if (extra > 0) this.ev({ t: 'money', pid: p.id, amount: extra, reason: '带货直播·坑位费' });
        return `+¥${1100 + extra}`;
      }
      case 'film': {   // 院线首映：立刻 +¥1350，本轮自己收租 +23%
        p.rentBuff = (p.rentBuff || 0) + 0.23; p.cash += 1350;
        this.ev({ t: 'money', pid: p.id, amount: 1350, reason: '院线首映' });
        return '+¥1350，本轮收租 +23%';
      }
      default: return '';
    }
  }
  useSkill(p) {
    if (!this.askSkill(p)) return;
    const { key } = this.pendingSkill;
    const mj = MAJORS[key] || {};
    this.pendingSkill = null;
    p.skillLeft--; p.skillUsedThisTurn = true;
    this.clearTimer();
    const detail = this.applyActiveSkill(p, key);
    this.addLog(`✨ ${p.name} 发动【${mj.skill}】${detail ? '：' + detail : ''}`);
    this.ev({ t: 'skill', pid: p.id, major: key, name: mj.skill, detail, active: true });
    this.aiChat(p, pick(['看我的绝招！', '技能，发动！', '⚡ 就是现在', '接招吧各位']));
    this.checkRichest(p);
    this.phase = 'roll';
    this.schedule();
  }
  skipSkill(p) {
    if (!this.askSkill(p)) return;
    this.pendingSkill = null;
    this.clearTimer();
    p.skillUsedThisTurn = true;   // 本回合不再追问
    this.addLog(`${p.name} 收起【${(MAJORS[p.major] || {}).skill}】，这一手先留着`);
    this.phase = 'roll';
    this.schedule();
  }
  aiSkill(p) {
    if (!this.askSkill(p)) return;
    const key = p.major;
    const mj = MAJORS[key] || {};
    // AI 决策：一般在自己现金不足以吃亏、或收益明确时发动，避免无谓浪费
    let go = true;
    if (key === 'newe') go = p.cash >= 4000;
    else if (key === 'mech') go = p.cash >= 1200;
    else if (key === 'psych' || key === 'music') go = p.skillLeft > 0 && this.alive().length > 1;
    else if (key === 'mse') go = p.skillLeft > 0;
    // v5.3 新增主动技的 AI 判断（没把握就先留着，别浪费次数）
    else if (key === 'elec') go = p.cash >= 1200;
    else if (key === 'robot') go = p.cash >= 1000;
    else if (key === 'ai') go = this.alive().length > 1;
    else if (key === 'mkt') go = this.alive().length > 1;
    else if (key === 'film') go = p.skillLeft > 0;
    else if (key === 'or') go = p.skillLeft > 0;
    void mj;
    if (go) this.useSkill(p); else this.skipSkill(p);
  }

  // ---------- 回合 ----------
  alive() { return this.players.filter(p => p.alive); }
  curp() { return this.players[this.cur]; }
  startTurn() {
    if (this.checkWin()) return;
    const p = this.curp();
    // v5.4：AI 拟人 —— 第一轮开局轮流打个招呼，让 AI 更像真人玩家
    if (this.round === 1 && p.isAI && !p.trustee && Math.random() < 0.65) {
      this.aiTimers.push(setTimeout(() => this.aiChat(p, pick(['大家好，请多关照！', '这局我来带节奏', '稳住，我们能赢', '友尽局开始了吗？', '闲庭信步，走起！🚶'])), rnd(800, 2600)));
    }
    p.shield = false;                   // 道具仅当轮有效
    p.rerollUsed = false;               // 重掷骰每回合重置
    p.rollsThisTurn = 0;                // v5.6：本回合已掷次数（双数再掷上限 2 次）
    p.skillUsedThisTurn = false;        // v5.1 主动技：本回合可询问一次
    p.buildCutTurn = 0;                 // v5.1 主动技临时折扣到期
    p.buyCutTurn = 0;                   // v5.3 主动技「峰谷套利」临时买地折扣到期
    p.autoBonus = false;                // v5.1 自动化落点奖励到期
    p.boughtThisTurn = false;           // v5.10：前五轮限购 —— 每回合最多买一块地皮
    p.hexFreeUsed = false;              // v5.7 重投大师：每回合的免费重投重置
    if (p.hex && p.hex.shieldEach) p.shield = true;   // v5.7 平安符：每回合自动挂免罚符
    // rentBuff / defBuff 是「本轮」持续：上一次自己回合发动后，一直保留到这一次自己回合才清零
    p.rentBuff = 0;                     // v5.1：收租加成到期
    p.defBuff = 0;                      // v5.1：被收租减免到期
    this.phase = 'roll';
    this.dice = null;
    this.pendingBuy = null; this.pendingBuild = null; this.pendingReroll = null; this.pendingBranch = null; this.pendingInvest = null; this.pendingSkill = null; this.raise = null; this.auction = null; this.vote = null;
    if (p.skipNext || (p.skipTurns || 0) > 0) {
      if (p.skipNext) p.skipNext = false; else p.skipTurns--;
      const left = p.skipTurns || 0;
      this.addLog(`${p.name} 停留一回合，原地休整${left > 0 ? `（还要停留 ${left} 回合）` : ''}`);
      this.ev({ t: 'stay', pid: p.id, left });
      // 专业：食品科学 · 能量补给（被罚停留时 +¥700）
      if (p.major === 'food' && p.skillLeft > 0) {
        p.skillLeft--; p.cash += 700;
        this.addLog(`🍜 ${p.name} 发动【能量补给】+¥700`);
        this.ev({ t: 'skill', pid: p.id, major: 'food', name: '能量补给', detail: '+¥700' });
        this.ev({ t: 'money', pid: p.id, amount: 700, reason: '能量补给' });
      }
      // v5.10：宿舍校区 —— 被罚停留休整补贴
      if (this.facIs('dorm')) {
        p.cash += 800;
        this.addLog('🛏️ 【宿舍校区】休整补贴 +¥800');
        this.ev({ t: 'money', pid: p.id, amount: 800, reason: '宿舍校区补贴' });
      }
      // v5.10：研究项目的停留补贴（通宵补习 / 弹性学制）
      if (p.hex && p.hex.stayCash) {
        p.cash += p.hex.stayCash;
        this.ev({ t: 'money', pid: p.id, amount: p.hex.stayCash, reason: '项目·停留补贴' });
        this.hexFx(p, 'studycard', `停留补贴 +¥${p.hex.stayCash}`);
      }
      // v5.3：通用被动 —— 被罚停留补贴（stayCash）
      const smj = MAJORS[p.major] || {};
      if (smj.stayCash && p.skillLeft > 0) {
        p.skillLeft--; p.cash += smj.stayCash;
        this.addLog(`${smj.icon || '✨'} ${p.name} 发动【${smj.skill}】+¥${smj.stayCash}`);
        this.ev({ t: 'skill', pid: p.id, major: p.major, name: smj.skill, detail: `+¥${smj.stayCash}` });
        this.ev({ t: 'money', pid: p.id, amount: smj.stayCash, reason: smj.skill });
      }
      this.endTurn();
      return;
    }
    this.ev({ t: 'turn', pid: p.id });
    // 专业：生命科学 · 细胞增殖（回合开始现金 +3.5%）
    if (p.major === 'bio' && p.skillLeft > 0 && p.cash > 0) {
      const gain = Math.round(p.cash * 0.035);
      p.skillLeft--; p.cash += gain;
      this.addLog(`🧬 ${p.name} 发动【细胞增殖】+¥${gain}`);
      this.ev({ t: 'skill', pid: p.id, major: 'bio', name: '细胞增殖', detail: `+¥${gain}` });
      this.ev({ t: 'money', pid: p.id, amount: gain, reason: '细胞增殖' });
    }
    // v5.3：通用被动 —— 回合开始类收益（每轮补贴 / 现金流百分比 / 天气红利）
    this.applyTurnStartPassives(p);
    // v5.7：研究项目的回合开始类收益（每轮补贴 / 利息 / 遗产继承 / 兜底……）
    this.applyHexPassives(p);
    // 主动技：先问一句要不要发动，选完再掷骰
    if (this.openSkillPrompt(p)) return;
    this.schedule();
  }
  schedule() {
    const p = this.curp();
    if (p.isAI) {
      const delay = rnd(3600, 7600);
      this.aiTimers.push(setTimeout(() => this.aiAct(), delay));
    } else {
      this.setTimer(TURN_MS, () => this.autoAct());
    }
  }
  // 玩家主动退出（或掉线）：转为 AI 并立即接管当前需要他做的行动，无需投票
  handoverToAI(p) {
    if (!p || !p.alive || p.isAI) return;
    p.isAI = true;
    p.voice = false;   // 掉线/退出即闭麦，避免语音房残留幽灵麦
    this.addLog(`🤖 ${p.name} 退出对局，AI 已接管`);
    this.ev({ t: 'quit', pid: p.id });
    const busySelf = (this.phase === 'roll' && this.curp() === p)
      || (this.phase === 'buy' && this.pendingBuy && this.pendingBuy.pid === p.id)
      || (this.phase === 'build' && this.pendingBuild && this.pendingBuild.pid === p.id)
      || (this.phase === 'reroll' && this.pendingReroll && this.pendingReroll.pid === p.id)
      || (this.phase === 'branch' && this.pendingBranch && this.pendingBranch.pid === p.id)
      || (this.phase === 'invest' && this.pendingInvest && this.pendingInvest.pid === p.id)
      || (this.phase === 'skill' && this.pendingSkill && this.pendingSkill.pid === p.id)
      || (this.phase === 'faculty' && !this.facultyVotes[p.id])   // v5.2：开局风貌投票
      || (this.phase === 'project' && this.project && !this.project.picks[p.id])   // v5.7：项目三选一
      || (this.phase === 'raise' && this.raise && this.raise.pid === p.id);
    if (busySelf) {
      this.clearTimer();   // 清掉人类超时兜底，AI 立刻接手
      if (this.phase === 'roll') this.aiTimers.push(setTimeout(() => this.aiAct(), rnd(2200, 4600)));
      else if (this.phase === 'buy') this.aiTimers.push(setTimeout(() => this.aiBuy(), rnd(2600, 5200)));
      else if (this.phase === 'build') this.aiTimers.push(setTimeout(() => this.aiBuild(), rnd(2200, 4600)));
      else if (this.phase === 'reroll') this.aiTimers.push(setTimeout(() => this.aiReroll(p), rnd(1800, 3600)));
      else if (this.phase === 'branch') this.aiTimers.push(setTimeout(() => this.aiBranch(p), rnd(2600, 5200)));
      else if (this.phase === 'invest') this.aiTimers.push(setTimeout(() => this.aiInvest(p), rnd(2600, 5200)));
      else if (this.phase === 'skill') this.aiTimers.push(setTimeout(() => this.aiSkill(p), rnd(2000, 4000)));
      else if (this.phase === 'faculty') this.aiTimers.push(setTimeout(() => this.aiFacultyVote(p), rnd(1200, 2600)));
      else if (this.phase === 'project') this.aiTimers.push(setTimeout(() => this.aiProject(p), rnd(1500, 3500)));
      else this.aiTimers.push(setTimeout(() => this.aiRaise(), 2600));
    } else if (this.phase === 'auction' && this.auction && this.auction.bidder !== p.id) {
      this.aiTimers.push(setTimeout(() => this.aiBid(p), rnd(2800, 7000)));
    } else if (this.vote && this.vote.votes[p.id] === undefined) {
      this.aiTimers.push(setTimeout(() => this.aiVote(p), rnd(2200, 4800)));
    }
  }

  // v5.4：AI 托管 —— 真人玩家可随时开启/关闭；开启后本回合起全部由 AI 代打，随时可取回操作权
  busySelf(p) {
    return (this.phase === 'roll' && this.curp() === p)
      || (this.phase === 'buy' && this.pendingBuy && this.pendingBuy.pid === p.id)
      || (this.phase === 'build' && this.pendingBuild && this.pendingBuild.pid === p.id)
      || (this.phase === 'reroll' && this.pendingReroll && this.pendingReroll.pid === p.id)
      || (this.phase === 'branch' && this.pendingBranch && this.pendingBranch.pid === p.id)
      || (this.phase === 'invest' && this.pendingInvest && this.pendingInvest.pid === p.id)
      || (this.phase === 'skill' && this.pendingSkill && this.pendingSkill.pid === p.id)
      || (this.phase === 'faculty' && !this.facultyVotes[p.id])   // v5.2：开局风貌投票
      || (this.phase === 'project' && this.project && !this.project.picks[p.id])   // v5.7：项目三选一
      || (this.phase === 'raise' && this.raise && this.raise.pid === p.id);
  }
  setTrustee(p, on) {
    if (!p || !p.alive) return;
    if (p.isAI && !p.trustee) return;  // 本来就是 AI 的玩家无需托管
    on = !!on;
    if (!!p.trustee === on) return;
    p.trustee = on;
    p.isAI = on;                       // 托管 = 走全套 AI 决策；取回 = 恢复真人操作
    this.addLog(on ? `🤖 ${p.name} 开启了 AI 托管，回合由 AI 代打` : `🙋 ${p.name} 取回了操作权`);
    this.ev({ t: 'trustee', pid: p.id, on });
    if (on) {
      if (this.busySelf(p)) {
        this.clearTimer();             // 清掉人类超时兜底，AI 立刻接手
        if (this.phase === 'roll') this.aiTimers.push(setTimeout(() => this.aiAct(), rnd(2200, 4600)));
        else if (this.phase === 'buy') this.aiTimers.push(setTimeout(() => this.aiBuy(), rnd(2600, 5200)));
        else if (this.phase === 'build') this.aiTimers.push(setTimeout(() => this.aiBuild(), rnd(2200, 4600)));
        else if (this.phase === 'reroll') this.aiTimers.push(setTimeout(() => this.aiReroll(p), rnd(1800, 3600)));
        else if (this.phase === 'branch') this.aiTimers.push(setTimeout(() => this.aiBranch(p), rnd(2600, 5200)));
        else if (this.phase === 'invest') this.aiTimers.push(setTimeout(() => this.aiInvest(p), rnd(2600, 5200)));
        else if (this.phase === 'skill') this.aiTimers.push(setTimeout(() => this.aiSkill(p), rnd(2000, 4000)));
        else if (this.phase === 'faculty') this.aiTimers.push(setTimeout(() => this.aiFacultyVote(p), rnd(1200, 2600)));
        else this.aiTimers.push(setTimeout(() => this.aiRaise(), 2600));
      } else if (this.phase === 'auction' && this.auction && this.auction.bidder !== p.id) {
        this.aiTimers.push(setTimeout(() => this.aiBid(p), rnd(2800, 7000)));
      } else if (this.vote && this.vote.votes[p.id] === undefined) {
        this.aiTimers.push(setTimeout(() => this.aiVote(p), rnd(2200, 4800)));
      }
    } else if (this.busySelf(p)) {
      // 取回操作权：重新给人类起超时兜底（按当前决策阶段恢复对应的跳过逻辑）
      this.clearTimer();
      this.setTimer(TURN_MS, () => {
        if (this.phase === 'buy') this.declineBuy(p);
        else if (this.phase === 'build') this.skipBuild(p);
        else if (this.phase === 'branch') this.declineBranch(p);
        else if (this.phase === 'invest') this.declineInvest(p);
        else if (this.phase === 'skill') this.skipSkill(p);
        else if (this.phase === 'reroll') this.confirmRoll(p);
        else this.autoAct();
      });
    }
  }
  setTimer(ms, fn) { this.clearTimer(); this.timer = setTimeout(fn, ms); }
  clearTimer() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }
  clearAiTimers() { this.aiTimers.forEach(clearTimeout); this.aiTimers = []; }
  autoAct() {
    const p = this.curp();
    if (this.phase === 'faculty') { this.settleFaculty(); return; }   // v5.2：投票超时直接揭晓
    if (this.phase === 'project') { this.settleProject(); return; }   // v5.7：立项超时自动补选
    if (this.phase === 'roll') { this.doRoll(p); }
    else if (this.phase === 'reroll') this.confirmRoll(p);
    else if (this.phase === 'auction') this.endAuction();
    else if (this.phase === 'raise') this.forceSettleRaise();
    else if (this.phase === 'lobby') {}
  }
  endTurn() {
    this.clearTimer(); this.clearAiTimers();
    this.pendingBuy = null; this.pendingBuild = null; this.pendingPick = null; this.pendingBranch = null; this.pendingInvest = null; this.pendingSkill = null; this.raise = null;
    let n = this.players.length;
    let idx = this.cur;
    for (let i = 0; i < n; i++) {
      idx = (idx + 1) % this.players.length;
      if (this.players[idx].alive) break;
    }
    this.cur = idx;
    if (idx === 0) {
      this.round++;
      if (this.maybeFacultyTerm()) return;   // v5.11：换届投票先于淡旺季/天气抽取（只在 11/21/31/41/51 轮次刚开始触发一次，settleFaculty 内自行 beginRound+startTurn）
      this.beginRound();
    }
    if (this.maybeProject()) return;   // v5.7：第 2/10/20/30/40/50 轮 → 全体「研究项目」三选一，选完再回 startTurn
    this.startTurn();
  }

  // v5.9：城邦 10 轮一届 —— 推进到换届轮（11/21/31/41/51）时开启新一轮推选；返回 true 表示暂停等待投票
  // v5.11 修复：只在「轮次刚推进」（endTurn 的 idx===0 分支）时检查，不再于每位玩家回合结束时重复触发；
  //            且第 1 轮不再触发（开局已推选过一次）。
  maybeFacultyTerm() {
    if (!this.facultyOn || this.alive().length <= 1) return false;
    if (this.round <= 1 || (this.round - 1) % 10 !== 0) return false;
    this.openFacultyVote(this.round);   // AI 投票由 openFacultyVote 内部统一布置
    return true;
  }

  // ---------- 掷骰与移动 ----------
  // 掷一次骰（含计算机"算法优化"技能），返回 [d1, d2]；single=true 时只掷一颗（v5.6 岔路内）
  rollDice(p, single = false) {
    let d1 = 1 + Math.floor(Math.random() * 6), d2 = 1 + Math.floor(Math.random() * 6);
    // 专业：计算机 · 算法优化（不足 7 点自动重掷取更优，每局限次）—— 岔路单骰时不生效
    if (!single && p.major === 'cs' && p.skillLeft > 0 && d1 + d2 < 7) {
      const n1 = 1 + Math.floor(Math.random() * 6), n2 = 1 + Math.floor(Math.random() * 6);
      p.skillLeft--;
      this.ev({ t: 'skill', pid: p.id, major: 'cs', name: '算法优化', detail: `重掷 ${n1} + ${n2}` });
      if (n1 + n2 > d1 + d2) { d1 = n1; d2 = n2; }
    }
    return [d1, d2];
  }
  // v5.6：是否站在岔路（学术长廊 48~54 / 创业大道 55~61）—— 岔路内只掷一颗骰子
  onBranch(pos) { return (pos >= BRANCH.START && pos <= BRANCH.EXIT) || (pos >= BRANCH2.START && pos <= BRANCH2.EXIT); }
  doRoll(p) {
    if (this.phase !== 'roll' || this.curp() !== p) return;
    p.rollsThisTurn = (p.rollsThisTurn || 0) + 1;   // v5.6：双数再掷上限 2 次/回合
    const onBr = this.onBranch(p.pos);              // v5.6：岔路内只掷一颗骰子
    const [d1, d2] = this.rollDice(p, onBr);
    this.dice = onBr ? [d1, 0] : [d1, d2];   // 双数判定与公用事业租金按最终点数计算（单骰第二位记 0，永不成双）
    this.ev({ t: 'roll', pid: p.id, d1, d2: onBr ? 0 : d2, single: onBr });
    // v5.7：研究项目的点数类奖励（低点冲刺 / 考场直觉 / 幸运双骰）——岔路单骰不参与
    if (!onBr) {
      const hx = p.hex || {}, raw = d1 + d2;
      if (hx.lowRollCash && raw <= 5) { p.cash += hx.lowRollCash; this.ev({ t: 'money', pid: p.id, amount: hx.lowRollCash, reason: '项目·低点冲刺' }); }
      if (hx.highRollCash && raw >= 9) { p.cash += hx.highRollCash; this.ev({ t: 'money', pid: p.id, amount: hx.highRollCash, reason: '项目·考场直觉' }); }
      if (hx.doubleCash && d1 === d2) { p.cash += hx.doubleCash; this.ev({ t: 'money', pid: p.id, amount: hx.doubleCash, reason: '项目·幸运双骰' }); }
      this.facRollFx(p, raw, d1 === d2);   // v5.10：早八 / 观星 / 校车站
    }
    const rollTxt = onBr ? `${d1} 点（岔路单骰）` : `${d1} + ${d2} = ${d1 + d2}`;
    const dblTxt = (!onBr && d1 === d2) ? '（双数，可再掷一次）' : '';
    // v4.1：掷骰后可花 ¥1200 重投一次（每回合每人限一次，现金够且未用过才提供选项）
    const rc0 = this.rerollCostFor(p);   // v5.2：文体校区每轮首次重投只要 ¥900
    // v5.8：连续两个回合都用了重投，第三回合锁定一次
    if (!p.rerollUsed && (p.rerollStreak || 0) >= 2) {
      this.addLog(`🔒 ${p.name} 已连续两个回合使用重投，本回合重投锁定`);
      this.ev({ t: 'reroll_lock', pid: p.id, round: this.round });
      this.addLog(`${p.name} 掷出 ${rollTxt}${dblTxt}`);
      this.execRoll(p);
      return;
    }
    if (!p.rerollUsed && p.cash >= rc0) {
      this.phase = 'reroll';
      // v5.1：重投询问时就把"这一走会落到哪一格"预测出来，全场都能在地图上看到虚影
      const pv = this.previewLanding(p);
      this.pendingReroll = { pid: p.id, cost: rc0, from: p.pos, target: pv ? pv.cell : null, steps: pv ? pv.steps : (d1 + d2) };
      this.addLog(`${p.name} 掷出 ${rollTxt}${dblTxt}`);
      this.ev({ t: 'ask_reroll', pid: p.id, d1, d2, cost: rc0, target: this.pendingReroll.target, steps: this.pendingReroll.steps, single: onBr });
      this.setTimer(TURN_MS, () => this.confirmRoll(this.curp()));
      if (p.isAI) this.aiTimers.push(setTimeout(() => this.aiReroll(p), rnd(1800, 4200)));
      return;
    }
    this.addLog(`${p.name} 掷出 ${rollTxt}${dblTxt}`);
    this.execRoll(p);
  }
  // 按最终点数实际移动并结算（天气/校历/陷害/长廊加成都在这里叠加）
  execRoll(p) {
    const d1 = this.dice[0], d2 = this.dice[1];
    const raw = d1 + d2;
    let steps = raw;
    const wmod = (WEATHER[this.weather] || {}).diceMod || 0;
    if (wmod) { steps += wmod; this.addLog(`${WEATHER[this.weather].icon} ${WEATHER[this.weather].name}：移动 ${wmod > 0 ? '+' : ''}${wmod} 步`); }
    if (this.calEvent && this.calEvent.steps) { steps += this.calEvent.steps; this.addLog(`${this.calEvent.icon} 校历【${this.calEvent.name}】：移动 ${this.calEvent.steps > 0 ? '+' : ''}${this.calEvent.steps} 步`); }
    if (p.sabotage) { steps += p.sabotage; this.addLog(`😈 ${p.name} 被人陷害：移动 ${p.sabotage} 步`); p.sabotage = 0; }
    if (p.buffSteps) { steps += p.buffSteps; this.addLog(`🎓 ${p.name} 的奖学金长廊加成：移动 +${p.buffSteps} 步`); p.buffSteps = 0; }
    // v5.1：移动加成队列（奖学金长廊「下两次各 +3」等）
    if (p.stepBuffs && p.stepBuffs.length) {
      const b = p.stepBuffs.shift();
      steps += b;
      this.addLog(`🎓 ${p.name} 的奖学金加成队列生效：本次移动 +${b} 步${p.stepBuffs.length ? `（还剩 ${p.stepBuffs.length} 次）` : ''}`);
      this.ev({ t: 'buff', pid: p.id, steps: b, left: p.stepBuffs.length });
    }
    if (p.major === 'pe' && p.skillLeft > 0 && raw <= 5) {
      steps += 2; p.skillLeft--; p.cash += 360;
      this.addLog(`🏀 ${p.name} 发动【体能优势】多走 2 步并 +¥360`);
      this.ev({ t: 'skill', pid: p.id, major: 'pe', name: '体能优势', detail: '+2 步 / +¥360' });
      this.ev({ t: 'money', pid: p.id, amount: 360, reason: '体能优势' });
    }
    // 专业：统计 · 数据洞察（点数 ≤5 时额外 +¥730）
    if (p.major === 'stat' && p.skillLeft > 0 && raw <= 5) {
      p.skillLeft--; p.cash += 730;
      this.addLog(`📊 ${p.name} 发动【数据洞察】+¥730`);
      this.ev({ t: 'skill', pid: p.id, major: 'stat', name: '数据洞察', detail: '+¥730' });
      this.ev({ t: 'money', pid: p.id, amount: 730, reason: '数据洞察' });
    }
    // v5.3：通用被动 —— 点数相关（低点数补贴 / 高点数补贴 / 低点数多走）
    {
      const rmj = MAJORS[p.major] || {};
      if (rmj.lowRoll && p.skillLeft > 0 && raw <= rmj.lowRoll.max) {
        p.skillLeft--; p.cash += rmj.lowRoll.amt;
        this.addLog(`${rmj.icon} ${p.name} 发动【${rmj.skill}】+¥${rmj.lowRoll.amt}`);
        this.ev({ t: 'skill', pid: p.id, major: p.major, name: rmj.skill, detail: `+¥${rmj.lowRoll.amt}` });
        this.ev({ t: 'money', pid: p.id, amount: rmj.lowRoll.amt, reason: rmj.skill });
      }
      if (rmj.highRoll && p.skillLeft > 0 && raw >= rmj.highRoll.min) {
        p.skillLeft--; p.cash += rmj.highRoll.amt;
        this.addLog(`${rmj.icon} ${p.name} 发动【${rmj.skill}】+¥${rmj.highRoll.amt}`);
        this.ev({ t: 'skill', pid: p.id, major: p.major, name: rmj.skill, detail: `+¥${rmj.highRoll.amt}` });
        this.ev({ t: 'money', pid: p.id, amount: rmj.highRoll.amt, reason: rmj.skill });
      }
    }
    if (steps < 1) steps = 1;
    if (steps !== raw) this.addLog(`${p.name} 实际前进 ${steps} 步`);

    const path = [];
    let pos = p.pos;
    for (let i = 0; i < steps; i++) {
      pos = this.nextOf(pos);
      path.push(pos);
    }
    this.phase = 'resolving';
    let passedGo = false;
    for (const c of path) if (c === 0) passedGo = true;
    p.pos = pos;
    // v5.7 收费站：对手「经过」（不含本次落点）收费站持有者的地产，每次付 ¥300（单次移动封顶 ¥900）
    {
      let toll = 0, boothOwner = null; const booths = new Set();
      for (const ci of path.slice(0, -1)) {
        const o = this.cells[ci].own;
        if (!o || o === p.id || BOARD[ci].type !== 'prop') continue;
        const ow = this.players.find(q => q.id === o);
        if (ow && ow.alive && ow !== p && ow.hex && ow.hex.tollBooth && this.hexKeyWith(ow, 'tollBooth') && !this.cells[ci].mortgaged) { toll += ow.hex.tollBooth; boothOwner = ow; booths.add(ow); }
      }
      if (boothOwner && toll > 0) {
        toll = Math.min(toll, boothOwner.hex.tollBoothCap || 820);   // v5.10：车水马龙上限 1050
        const pay = Math.min(p.cash, toll);
        if (pay > 0) {
          p.cash -= pay; p.combo = 0; boothOwner.cash += pay;   // v5.8：扣钱断连击
          this.addLog(`🚧 ${p.name} 经过 ${boothOwner.name} 的地产，被收费站收下 ¥${pay}`);
          this.hexFx(boothOwner, 'tollbooth', `${p.name} 缴过路费 ¥${pay}`);
          this.ev({ t: 'money', pid: boothOwner.id, amount: pay, reason: '收费站过路费' });
          for (const ow of booths) this.hexSpend(ow, this.hexKeyWith(ow, 'tollBooth'));   // v5.13：收费站/车水马龙按次计
        }
      }
    }
    if (passedGo) {
      // v4.0「经济寒冬」：第 ENDGAME_ROUND 轮起银行停发工资
      if (this.salaryOn()) {
        const w = this.payWage(p);
        this.addLog(`${p.name} 经过起点，领工资 ¥${w}`);
        this.applyGoSkills(p);
      } else {
        this.addLog(`❄️ ${p.name} 经过起点，经济寒冬银行停发工资`);
      }
      this.checkRichest(p);
    }
    this.ev({ t: 'move', pid: p.id, path, final: pos });
    setTimeout(() => this.resolveCell(p), 0); // 客户端先播移动动画；引擎立即结算事件随后广播
  }
  // v5.8：当前非租金奖金收入的衰减倍率（15 轮后 ×0.7、25 轮后 ×0.5、40 轮后 ×0.25）
  incomeMul() {
    let m = 1;
    for (const d of INCOME_DECAY) if (this.round >= d.r) m = d.mul;
    return m;
  }
  // 是否还发工资（v4.0 终局模式；v5.2：停发轮次受校园风貌影响）
  salaryOn() { return this.round < this.salaryStop(); }
  salaryStop() {
    if (this.facIs('austerity')) return ENDGAME_ROUND - 5;   // 紧缩校区：提前 5 轮（第 10 轮起）
    if (this.facIs('boom'))      return ENDGAME_ROUND + 5;   // 繁荣校区：推迟 5 轮（第 20 轮起）
    if (this.facIs('nofund'))    return 1;                   // 限薪校区：全程不发
    return ENDGAME_ROUND;
  }
  // v5.2：起点工资（受校园风貌影响）
  wageOf() {
    if (this.facIs('urban'))  return SALARY + 250;
    if (this.facIs('garden')) return 1800;
    if (this.facIs('boom'))   return SALARY + 200;
    if (this.facIs('agri'))   return SALARY + 300;
    if (this.facIs('green'))  return SALARY - 150;   // v5.10 环保校区
    return SALARY;
  }
  // v5.7：工资统一入口 ——「双倍工资」项目在这里翻倍，三个发放点共用
  payWage(p) {
    let w = this.wageOf();
    if (p.hex && p.hex.salaryX2) { w *= 2; this.hexFx(p, 'salaryx2', '双倍工资：工资 ×2'); }
    p.cash += w;
    this.ev({ t: 'money', pid: p.id, amount: w, reason: '工资' });
    return w;
  }
  // v5.2：风貌对地价 / 升级费 / 租金 / 基金池上限 / 罚款 / 岔路奖励 / 重投费用的影响，集中读表，避免散落 if
  facLandMul() {
    switch (this.faculty) {
      case 'garden': return 0.96;
      case 'nofund': return 0.88;
      case 'urban': case 'life': case 'retrain': return 1.03;
      case 'art':    return 1.04;
      case 'boom':   return 1.06;
      // v5.10 新城邦
      case 'hxSilver': case 'runner': return 1.03;
      case 'dorm': case 'veteran': return 1.04;
      case 'market': return 1.02;
      default:       return 1;
    }
  }
  facBuildMul() {
    switch (this.faculty) {
      case 'tech':   return 0.92;
      case 'nofund': return 0.90;
      case 'agri':   return 1.03;
      // v5.10 新城邦
      case 'spring': return 0.95;
      case 'green':  return 0.94;
      default:       return 1;
    }
  }
  facRentMul() {
    let m = 1;
    switch (this.faculty) {
      case 'sports':    m *= 0.96; break;
      case 'normal':    m *= 0.97; break;
      case 'reform':    m *= 1.06; break;
      case 'freeRound': m *= 1.08; break;
      case 'freeRent':  m *= 1.05; break;
      // v5.10 新城邦
      case 'silent':    m *= 0.94; break;
      case 'lantern': case 'hxSilver': m *= 1.03; break;
      case 'shuffle': case 'gala': case 'charity': m *= 1.02; break;
      case 'carnival': case 'hxPrism': case 'hxGold': m *= 1.05; break;
      case 'spring': case 'gamble': m *= 1.03; break;
      case 'professor': m *= 1.04; break;
      default: break;
    }
    if (this.facIs('ancient') && this.round <= 3) m *= 0.93;   // 百年学府：开局三轮收租偏弱
    return Math.round(m * 1000) / 1000;
  }
  fundCap() {
    if (this.facIs('finance')) return 25000;
    if (this.facIs('oldbook')) return Math.round(FUND_CAP * 0.8);   // v5.10 旧书集：基金池 −20%
    if (this.facIs('artfest')) return Math.round(FUND_CAP * 0.9);   // v5.10 艺术节：基金池 −10%
    return FUND_CAP;
  }
  facFine(amt) { return this.facIs('med') ? Math.round(amt * 1.2) : (this.facIs('cafe') ? Math.round(amt * 1.1) : amt); }   // 医学 +20% / v5.10 咖啡 +10%
  facBranch(amt) { return this.facIs('intl') ? Math.round(amt * 1.12) : amt; }    // 国际：岔路奖励 ×1.12
  // v5.10：城邦的点数类修正（早八 / 观星 / 校车站）—— 在掷骰结算点调用
  facRollFx(p, raw, isDouble) {
    if (this.facIs('stampede')) {
      if (raw === 7) { p.cash += 300; this.ev({ t: 'money', pid: p.id, amount: 300, reason: '早八校区·准时到教室' }); this.ev({ t: 'facfx', pid: p.id, kind: 'stampede', name: '早八校区', detail: '7 点准时 +¥300' }); }
      else if (raw <= 3) { const pay = Math.min(p.cash, 150); if (pay > 0) { p.cash -= pay; this.ev({ t: 'facfx', pid: p.id, kind: 'stampede', name: '早八校区', detail: `起晚了 −¥${pay}` }); this.ev({ t: 'paid', pid: p.id, amount: pay, creditor: null, toPool: true }); this.addToFund(pay); } }
    }
    if (this.facIs('observatory')) {
      if (raw >= 10) { p.cash += 400; this.ev({ t: 'money', pid: p.id, amount: 400, reason: '观星校区·星象大吉' }); this.ev({ t: 'facfx', pid: p.id, kind: 'observatory', name: '观星校区', detail: '星象大吉 +¥400' }); }
      else if (raw <= 4) { const pay = Math.min(p.cash, 200); if (pay > 0) { p.cash -= pay; this.ev({ t: 'facfx', pid: p.id, kind: 'observatory', name: '观星校区', detail: `乌云蔽月 −¥${pay}` }); this.ev({ t: 'paid', pid: p.id, amount: pay, creditor: null, toPool: true }); this.addToFund(pay); } }
    }
    if (this.facIs('runner') && isDouble) { p.cash += 250; this.ev({ t: 'money', pid: p.id, amount: 250, reason: '校车站校区·班来得巧' }); }
  }
  // v5.2 文体：每轮首次重投 ¥900；v5.3 软件工程·敏捷迭代：有次数时重投免费
  rerollCostFor(p) {
    const mj = MAJORS[p.major] || {};
    if (mj.rerollFree && p.skillLeft > 0) return 0;
    let c = (this.facIs('sports') && !p.rerollUsed) ? 900 : REROLL_COST;
    if (p.hex && p.hex.rerollCut) c = Math.round(c * (1 - p.hex.rerollCut));   // v5.7 情报网：重投打折
    return c;
  }
  // v5.2：统一的「停留」入口 —— 师范校区发的「免停留卡」在这里生效（只对纯惩罚性停留有效）
  applyStay(p, turns, why) {
    if ((p.stayFree || 0) > 0) {
      p.stayFree--;
      this.addLog(`🎯 ${p.name} 使用「免停留卡」，免除「${why}」的停留（还剩 ${p.stayFree} 张）`);
      this.ev({ t: 'stay_free', pid: p.id, why, left: p.stayFree });
      return false;   // 没被停留
    }
    // v5.7 时间管理：被罚停留的回合数 −1（只在多于 1 回合时生效）
    if (p.hex && p.hex.stayCut && turns > 1) {
      turns--;
      this.hexFx(p, 'timemgmt', `时间管理：停留缩短为 ${turns} 回合`);
    }
    p.skipTurns = Math.max(p.skipTurns || 0, turns);
    return true;
  }
  // v5.2：风貌对卡牌金钱收益的影响（type: 'chance' | 'fate'）
  facCardMoney(amt, type) {
    if (!this.faculty || !amt) return amt;
    let v = amt;
    if (v > 0) {
      if (this.facIs('tech')) v = Math.round(v * 0.93);
      if (this.facIs('park') && type === 'chance') v = Math.round(v * 0.9);
      if (this.facIs('intl') && type === 'chance') v = Math.round(v * 0.85);
      if (this.facIs('general')) v += 200;
      if (this.facIs('liberal') && type === 'fate') v += 150;                 // v5.10 通识：命运卡 +150
      if (this.facIs('liberal') && type === 'chance') v = Math.round(v * 0.92);   // v5.10 通识：机会卡 −8%
      if (this.facIs('silent')) v = Math.round(v * 0.90);                     // v5.10 自习：卡牌经济 −10%
      if (this.facIs('cram') && type === 'chance') v = v > 0 ? Math.round(v * 0.92) : Math.round(v * 0.85);   // v5.10 补习街
    } else {
      if (this.facIs('tech')) v = Math.round(v * 0.93);
      if (this.facIs('general')) v = Math.min(0, v + 200);
      if (this.facIs('book') && type === 'fate') v = Math.round(v * 1.1);
      if (this.facIs('silent')) v = Math.round(v * 0.90);                     // v5.10 自习：负面损失也按同一口径收窄（整体 −10%）
      if (this.facIs('cram') && type === 'chance') v = Math.round(v * 0.85);   // v5.10 补习街：机会卡负面 −15%
    }
    return v;
  }

  // v5.1：预测本次掷骰的实际步数与落点（不改变任何状态），用于「重投虚影」——全场可见
  previewLanding(p) {
    if (!this.dice) return null;
    const raw = this.dice[0] + this.dice[1];
    let steps = raw;
    const wmod = (WEATHER[this.weather] || {}).diceMod || 0;
    steps += wmod;
    if (this.calEvent && this.calEvent.steps) steps += this.calEvent.steps;
    if (p.sabotage) steps += p.sabotage;
    if (p.buffSteps) steps += p.buffSteps;
    if (p.stepBuffs && p.stepBuffs.length) steps += p.stepBuffs[0];
    if (p.major === 'pe' && p.skillLeft > 0 && raw <= 5) steps += 2;
    if (steps < 1) steps = 1;
    let pos = p.pos;
    for (let i = 0; i < steps; i++) pos = this.nextOf(pos);
    return { steps, cell: pos };
  }

  // 岔路感知的下一格：主路线 0~47 环形（47→0）；学术长廊 48~54 线性（54→20 教育基金会）；
  // 创业大道 55~61 线性（61→10 校园商城）
  nextOf(pos) {
    if (pos === 47) return 0;
    if (pos >= BRANCH.START && pos < BRANCH.EXIT) return pos + 1;
    if (pos === BRANCH.EXIT) return BRANCH.EXIT_TO;
    if (pos >= BRANCH2.START && pos < BRANCH2.EXIT) return pos + 1;
    if (pos === BRANCH2.EXIT) return BRANCH2.EXIT_TO;
    return pos + 1;
  }
  checkRichest(p) { if (p.cash >= 100000) this.giveAch(p, 'richest'); }

  // v5.1：天气对买地/盖房价格的影响（暴雪、大风施工困难，价格上浮）
  weatherBuildMul() { const W = WEATHER[this.weather]; return (W && W.buildMul) ? W.buildMul : 1; }
  seasonCost(base) {
    let m = SEASON[this.season].buildMul * this.weatherBuildMul() * this.facBuildMul();   // v5.2：叠上校园风貌修正
    if (this.calEvent && (this.calEvent.kind === 'buildSale' || this.calEvent.kind === 'buildBoom')) m *= this.calEvent.mul;
    return Math.max(1, Math.round(base * m));
  }
  landCost(base) { return Math.max(1, Math.round(base * SEASON[this.season].buildMul * this.weatherBuildMul() * this.facLandMul())); }
  resolveCell(p) {
    const idx = p.pos, cell = BOARD[idx], cs = this.cells[idx];
    this.ev({ t: 'land', pid: p.id, cell: idx });
    switch (cell.type) {
      case 'prop': case 'transport': case 'util': {
        if (cs.own === null) {
          // v5.10：前五轮限购 —— 每人每回合只能买一块地皮；已买过时踩到无主地，既不能买、也不进拍卖
          if (this.round <= 5 && p.boughtThisTurn) {
            this.addLog(`🚫 前 5 轮限购：${p.name} 本回合已经买过地，「${cell.name}」既不能买、也不进拍卖`);
            this.ev({ t: 'buy_capped', pid: p.id, cell: idx });
            this.afterResolve(p, true);
            return;
          }
          // v5.2 免费轮校区：抽中的那一轮，全场买地皮不要钱
          if (this.isFreeRound()) {
            this.phase = 'buy';
            this.pendingBuy = { pid: p.id, cell: idx, price: 0, base: 0, free: true };
            this.addLog(`🎟️ 【免费轮】${p.name} 踩到无主地产「${cell.name}」，本轮买地不要钱，可直接拿下！`);
            this.ev({ t: 'ask_buy', pid: p.id, cell: idx, price: 0, base: 0, free: true });
            this.scheduleBuy();
            return;
          }
          const base = this.landCost(cell.price);
          // v5.7：研究项目的买地折扣（房产中介/圈地许可），再叠折扣卡
          let price = (p.hex && p.hex.buyCut) ? Math.max(1, Math.round(base * (1 - p.hex.buyCut))) : base;
          if (p.discount) price = Math.floor(price * 0.8);
          this.phase = 'buy';
          this.pendingBuy = { pid: p.id, cell: idx, price, base };
          this.addLog(`${p.name} 踩到无主地产「${cell.name}」（¥${price}${this.season !== 'mid' ? ' · ' + SEASON[this.season].name + '价' : ''}）`);
          this.ev({ t: 'ask_buy', pid: p.id, cell: idx, price, base, discount: !!p.discount });
          this.scheduleBuy();
          return;
        }
        if (cs.own === p.id) {
          // 主动技：自动化·流水线（本回合落回自家地皮产能 +¥900）
          if (p.autoBonus) {
            p.autoBonus = false; p.cash += 820;
            this.addLog(`🤖 ${p.name} 的自动化产线转回自家地皮，产能 +¥900`);
            this.ev({ t: 'skill', pid: p.id, major: 'auto', name: '流水线', detail: '+¥900', active: true });
            this.ev({ t: 'money', pid: p.id, amount: 900, reason: '流水线' });
          }
          if (cell.type !== 'prop') { this.afterResolve(p, false); return; }
          if (cs.mortgaged) { this.addLog(`${p.name} 回到自己的抵押地「${cell.name}」，可随时在资产面板赎回`); this.afterResolve(p, false); return; }
          if (cs.level < 4) {
            // v5.7：研究项目的盖房折扣（精打细算/工程监理）；v5.8：盖房 9 折卡（用后消耗）
            const cost0 = this.seasonCost(GROUPS[cell.g].build);
            let cost = (p.hex && p.hex.buildCut) ? Math.max(1, Math.round(cost0 * (1 - p.hex.buildCut))) : cost0;
            if ((p.buildCutCard || 0) > 0) {
              cost = Math.max(1, Math.round(cost * 0.9));
              p.buildCutCard--;
              this.addLog(`🔨 ${p.name} 使用「盖房 9 折卡」（还剩 ${p.buildCutCard} 张）`);
              this.ev({ t: 'buildcut_used', pid: p.id, left: p.buildCutCard });
            }
            this.phase = 'build';
            this.pendingBuild = { pid: p.id, cell: idx, cost };
            this.addLog(`${p.name} 踩到自己的「${cell.name}」，可升级（Lv${cs.level}→Lv${cs.level + 1}，¥${cost}）`);
            this.ev({ t: 'ask_build', pid: p.id, cell: idx, cost });
            this.scheduleBuild();
            return;
          }
          this.addLog(`${p.name} 踩到自己的旅馆「${cell.name}」，已是顶级`);
          this.afterResolve(p, false); return;
        }
        const owner = this.players.find(q => q.id === cs.own);
        if (cs.mortgaged) {
          // 抵押地：可被踩到者以抵押价买走
          const mp = Math.floor(cell.price / 2);
          this.phase = 'buy';
          this.pendingBuy = { pid: p.id, cell: idx, mortgageBuy: mp, price: mp, base: mp };
          this.addLog(`${p.name} 踩到 ${owner.name} 的抵押地「${cell.name}」，可以 ¥${mp} 直接买走！`);
          this.ev({ t: 'ask_buy', pid: p.id, cell: idx, price: mp, mortgageBuy: true });
          this.scheduleBuy();
          return;
        }
        // 免租三件套：先消耗限时的（免罚符当轮过期），再消耗持久的（免租金卡/免租券）
        if (p.shield) {
          p.shield = false;
          this.addLog(`🛡️ ${p.name} 的免罚符生效，免除「${cell.name}」的租金`);
          this.ev({ t: 'shield', pid: p.id, cell: idx });
          this.afterResolve(p, false); return;
        }
        if (p.medal > 0) {
          p.medal--;
          this.addLog(`🎫 ${p.name} 的免租金卡生效，免除「${cell.name}」的租金`);
          this.ev({ t: 'medal', pid: p.id, cell: idx });
          this.afterResolve(p, false); return;
        }
        // v5.2 免租轮校区：抽中的那 4 轮，全场踩到谁的地都不用付租金
        if (this.isFreeRentRound()) {
          this.addLog(`🕊️ 【免租轮】${p.name} 踩到 ${owner.name} 的「${cell.name}」，本轮全场免租，一分不付`);
          this.ev({ t: 'free_rent', pid: p.id, cell: idx, owner: owner.id });
          this.afterResolve(p, false); return;
        }
        let rent = this.calcRent(idx, this.dice);
        // ===== 收租方加成 =====
        // 主动技：材料科学·相变强化 / 新能源·储能放大（本轮收租加成）
        if ((owner.rentBuff || 0) > 0) {
          const bonus = Math.round(rent * owner.rentBuff); rent += bonus;
          const nm = (MAJORS[owner.major] || {}).skill || '主动技';
          this.addLog(`${(MAJORS[owner.major] || {}).icon || '✨'} ${owner.name} 的【${nm}】生效，收租 +¥${bonus}`);
          this.ev({ t: 'skill', pid: owner.id, major: owner.major, name: nm, detail: `收租 +¥${bonus}`, active: true });
        }
        // 被动：化学·催化加成（单笔 ≥¥1000 时 +36%）
        if (owner.major === 'chem' && owner.skillLeft > 0 && rent >= 1000) {
          const bonus = Math.round(rent * 0.36); rent += bonus; owner.skillLeft--;
          this.addLog(`🧪 ${owner.name} 发动【催化加成】+¥${bonus}`);
          this.ev({ t: 'skill', pid: owner.id, major: 'chem', name: '催化加成', detail: `+${bonus}` });
        }
        // 被动：经管·资本运作（单笔 ≥¥1500 时 +46%）
        if (owner.major === 'econ' && owner.skillLeft > 0 && rent >= 1500) {
          const bonus = Math.round(rent * 0.46); rent += bonus; owner.skillLeft--;
          this.addLog(`📈 ${owner.name} 发动【资本运作】+¥${bonus}`);
          this.ev({ t: 'skill', pid: owner.id, major: 'econ', name: '资本运作', detail: `+¥${bonus}` });
        }
        // v5.3：通用被动 —— 收租加成（rentGain）
        {
          const omj = MAJORS[owner.major] || {};
          if (omj.rentGain && owner.skillLeft > 0 && rent >= omj.rentGain.min) {
            const bonus = Math.round(rent * omj.rentGain.pct); rent += bonus; owner.skillLeft--;
            this.addLog(`${omj.icon} ${owner.name} 发动【${omj.skill}】+¥${bonus}`);
            this.ev({ t: 'skill', pid: owner.id, major: owner.major, name: omj.skill, detail: `+¥${bonus}` });
          }
        }
        // v5.7：研究项目的收租加成（收租培训）—— 不消耗技能次数，无次数限制
        if (owner.hex && owner.hex.rentGainPct && rent >= (owner.hex.rentGainMin || 0)) {
          const bonus = Math.round(rent * owner.hex.rentGainPct);
          if (bonus > 0) { rent += bonus; this.hexFx(owner, 'rentboost', `收租加成 +¥${bonus}`); }
        }
        // v5.10：独家代理 / 车水马龙 —— 每笔收租固定加成
        if (owner.hex && owner.hex.rentFlat && rent > 0) {
          rent += owner.hex.rentFlat;
          for (const key of (owner.hexList || [])) {   // v5.13：车水马龙按次计
            const pr = PROJECTS[key];
            if (pr && pr.charges && pr.mods && pr.mods.rentFlat !== undefined) this.hexSpend(owner, key);
          }
        }
        // ===== 付租方减免 =====
        // 被动：物理·守恒定律（≥¥1200 时 −32%）
        if (p.major === 'phys' && p.skillLeft > 0 && rent >= 1200) {
          const saved = Math.round(rent * 0.32); rent -= saved; p.skillLeft--;
          this.addLog(`⚛️ ${p.name} 发动【守恒定律】减免 ¥${saved}`);
          this.ev({ t: 'skill', pid: p.id, major: 'phys', name: '守恒定律', detail: `-${saved}` });
        }
        // 被动：医学·妙手回春（≥¥1000 时 −36%）
        if (p.major === 'med' && p.skillLeft > 0 && rent >= 1000) {
          const saved = Math.round(rent * 0.36); rent -= saved; p.skillLeft--;
          this.addLog(`🩺 ${p.name} 发动【妙手回春】减免 ¥${saved}`);
          this.ev({ t: 'skill', pid: p.id, major: 'med', name: '妙手回春', detail: `减免 ¥${saved}` });
        }
        // 被动：环境科学·循环利用（无门槛 −13%，次数多）
        if (p.major === 'env' && p.skillLeft > 0 && rent > 0) {
          const saved = Math.round(rent * 0.13); rent -= saved; p.skillLeft--;
          this.addLog(`♻️ ${p.name} 发动【循环利用】减免 ¥${saved}`);
          this.ev({ t: 'skill', pid: p.id, major: 'env', name: '循环利用', detail: `-${saved}` });
        }
        // v5.3：通用被动 —— 付租减免（tollCut；min=0 表示无门槛）
        {
          const pmj = MAJORS[p.major] || {};
          if (pmj.tollCut && p.skillLeft > 0 && rent > 0 && rent >= (pmj.tollCut.min || 0)) {
            const saved = Math.round(rent * pmj.tollCut.pct); rent -= saved; p.skillLeft--;
            this.addLog(`${pmj.icon} ${p.name} 发动【${pmj.skill}】减免 ¥${saved}`);
            this.ev({ t: 'skill', pid: p.id, major: p.major, name: pmj.skill, detail: `-¥${saved}` });
          }
        }
        // 主动技：药学·对症下药（本轮被收租 −60%）
        if ((p.defBuff || 0) > 0 && rent > 0) {
          const saved = Math.round(rent * p.defBuff); rent -= saved;
          this.addLog(`💊 ${p.name} 的【对症下药】生效，减免 ¥${saved}`);
          this.ev({ t: 'skill', pid: p.id, major: p.major, name: '对症下药', detail: `-${saved}`, active: true });
        }
        // v5.2 医学校区：单笔被收租 ≥¥1500 时减免 10%
        if (this.facIs('med') && rent >= 1500) {
          const saved = Math.round(rent * 0.1); rent -= saved;
          this.addLog(`🩺 【医学校区】大额住院费兜底，减免 ¥${saved}`);
          this.ev({ t: 'facfx', pid: p.id, kind: 'med', name: '医学校区', detail: `大额租金减免 ¥${saved}` });
        }
        // v5.7：研究项目的付租减免（通行优惠 = 无门槛常驻；应急药箱 = 限次）
        {
          const hx = p.hex || {};
          // v5.10：校车月票 / 高铁学生票 —— 路费固定立减
          if (hx.tollFlat && rent > 0) {
            const sv = Math.min(rent, hx.tollFlat);
            rent -= sv;
            this.hexFx(p, 'buscard', `通行固定减免 −¥${sv}`);
          }
          if (hx.tollCut && rent > 0) {
            const saved = Math.round(rent * hx.tollCut);
            if (saved > 0) { rent -= saved; this.hexFx(p, 'tollpass', `通行优惠 −¥${saved}`); }
          }
          if ((hx.tollShield || 0) > 0 && rent >= (hx.tollShieldMin || 0)) {
            hx.tollShield--;
            const saved = Math.round(rent * (hx.tollShieldPct || 0));
            if (saved > 0) rent -= saved;
            this.hexFx(p, 'firstaid', `应急减免 ¥${saved}（剩 ${hx.tollShield} 次）`);
          }
        }
        if (rent < 1) rent = 1;
        if (rent >= 10000) this.giveAch(owner, 'rent10k');
        this.addLog(`${p.name} 踩到 ${owner.name} 的「${cell.name}」，应付租金 ¥${rent}`);
        this.charge(p, rent, owner, `租金·${cell.name}`, idx);
        return;
      }
      case 'jail': {
        // 校园商城（v5.1）：随机抽 1 张（35% 概率抽到 2 张）效果卡，卡池含「免租金卡 / 免租券 / 技能次数 +1」等
        // v5.2 艺术校区：盲盒每次多抽 1 张
        const n = this.rollCardCount() + ((this.facIs('art') || this.facIs('artfest')) ? 1 : 0);
        this.addLog(`🛍️ ${p.name} 走进校园商城，店员塞给他 ${n} 张效果卡盲盒${this.facIs('art') ? '（艺术校区多送 1 张）' : ''}`);
        this.grantCards(p, idx, n, '校园商城');
        this.afterResolve(p, false); return;
      }
      case 'tax': {
        // v5.1：缴学费金额改为随机 ¥800~1500（原来固定 ¥900）；v5.2 医学校区罚款类 +20%
        const amt = this.facFine(Math.round(rnd(800, 1500) / 10) * 10);
        this.addLog(`${p.name} 缴${cell.name} ¥${amt}（进教育基金池）${this.facIs('med') ? '【医学：罚款 +20%】' : ''}`);
        this.charge(p, amt, null, cell.name, idx, true);
        return;
      }
      case 'gojail': {
        // v5.1：挂科留级惩罚加重 —— 停留 1 回合 + 补考费 ¥1200（进教育基金池）
        if (this.immune(p, '留级')) { this.afterResolve(p, false); return; }
        // v5.10：研究项目的挂科保险（免于留级，补考费照交）
        if (p.hex && (p.hex.jailFree || 0) > 0) {
          p.hex.jailFree--;
          this.hexFx(p, 'keychain', `挂科保险生效（剩 ${p.hex.jailFree} 次），免于留级`);
          this.addLog(`🔑 ${p.name} 的挂科保险生效，免于留级（补考费照交）`);
          this.ev({ t: 'gojail', pid: p.id, cell: idx, stayed: false });
          this.charge(p, this.facFine(1200), null, '补考费', idx, true);
          return;
        }
        const stayed = this.applyStay(p, 1, '挂科留级');   // v5.2：师范校区的「免停留卡」在这里生效
        const fee = this.facFine(1200);
        this.addLog(`${p.name} 挂科留级：${stayed ? '休整一回合，并' : ''}交补考费 ¥${fee}`);
        this.ev({ t: 'gojail', pid: p.id, cell: idx, stayed });
        this.aiChat(p, pick(['😭', '😤']));
        this.charge(p, fee, null, '补考费', idx, true);
        return;
      }
      case 'parking': {
        const got = this.fundPool;
        if (got > 0) {
          if (p.fundBanned) {
            this.addLog(`🚫 ${p.name} 想领教育基金，但已被拉黑（投资失败），一分都拿不到`);
            this.ev({ t: 'fund_banned', pid: p.id, cell: idx });
            this.afterResolve(p, false); return;
          }
          this.fundPool = 0; p.cash += got;
          this.addLog(`${p.name} 走进教育基金会，领取教育基金 ¥${got}！`);
          this.ev({ t: 'jackpot', pid: p.id, amount: got, cell: idx });
          this.aiChat(p, pick(['🤩', '🎉']));
          this.checkRichest(p);
        } else this.addLog(`${p.name} 走进教育基金会，可惜基金空空`);
        this.afterResolve(p, false); return;
      }
      case 'duel': {
        const others = this.alive().filter(q => q.id !== p.id);
        if (!others.length) { this.afterResolve(p, false); return; }
        const opp = pick(others);
        let a = 1 + Math.floor(Math.random() * 6);
        const b = 1 + Math.floor(Math.random() * 6);
        // 专业：军事 · 战术压制（自己点数 +1）
        if (p.major === 'mil' && p.skillLeft > 0) {
          a += 1; p.skillLeft--;
          this.addLog(`🎖️ ${p.name} 发动【战术压制】，擂台点数 +1`);
          this.ev({ t: 'skill', pid: p.id, major: 'mil', name: '战术压制', detail: '点数 +1' });
        }
        // v5.3：通用被动 —— 擂台点数加成（duelPip）
        {
          const dmj = MAJORS[p.major] || {};
          if (dmj.duelPip && p.skillLeft > 0) {
            a += dmj.duelPip; p.skillLeft--;
            this.addLog(`${dmj.icon} ${p.name} 发动【${dmj.skill}】，擂台点数 +${dmj.duelPip}`);
            this.ev({ t: 'skill', pid: p.id, major: p.major, name: dmj.skill, detail: `点数 +${dmj.duelPip}` });
          }
        }
        if (a === b) {
          this.addLog(`⚔️ 擂台！${p.name}(${a}) 与 ${opp.name}(${b}) 战成平手，各回各家`);
          this.ev({ t: 'duel', pid: p.id, opp: opp.id, a, b, label: '辩论擂台', winner: null, amount: 0 });
          this.afterResolve(p, false); return;
        }
        const winner = a > b ? p : opp, loser = a > b ? opp : p;
        const stake = Math.round(1500 * (this.facIs('sports') ? 1.2 : (this.facIs('gamble') ? 1.25 : 1)));   // v5.2 文体 ×1.2 / v5.10 博弈 ×1.25
        const amount = Math.min(stake, loser.cash);
        this.addLog(`⚔️ 擂台！${p.name}(${a}) vs ${opp.name}(${b}) → ${winner.name} 胜，${loser.name} 付 ¥${amount}`);
        this.ev({ t: 'duel', pid: p.id, opp: opp.id, a, b, label: '辩论擂台', winner: winner.id, amount });
        if (amount > 0) {
          loser.cash -= amount; winner.cash += amount; loser.combo = 0;
          this.ev({ t: 'charge', pid: loser.id, amount, creditor: winner.id, reason: '擂台赌注', cell: idx, toPool: false });
          this.ev({ t: 'paid', pid: loser.id, amount, creditor: winner.id, toPool: false });
        }
        // 专业：军事 · 战术压制（获胜额外 +¥460）
        if (winner.major === 'mil' && winner.skillLeft > 0) {
          winner.skillLeft--; winner.cash += 460;
          this.addLog(`🎖️ ${winner.name} 乘胜追击【战术压制】+¥460`);
          this.ev({ t: 'skill', pid: winner.id, major: 'mil', name: '战术压制', detail: '胜者 +¥460' });
          this.ev({ t: 'money', pid: winner.id, amount: 460, reason: '战术压制' });
        }
        // v5.3：通用被动 —— 擂台获胜奖励（duelWin）
        {
          const wmj = MAJORS[winner.major] || {};
          if (wmj.duelWin && winner.skillLeft > 0) {
            winner.skillLeft--; winner.cash += wmj.duelWin;
            this.addLog(`${wmj.icon} ${winner.name} 乘胜追击【${wmj.skill}】+¥${wmj.duelWin}`);
            this.ev({ t: 'skill', pid: winner.id, major: winner.major, name: wmj.skill, detail: `胜者 +¥${wmj.duelWin}` });
            this.ev({ t: 'money', pid: winner.id, amount: wmj.duelWin, reason: wmj.skill });
          }
        }
        this.aiChat(loser, pick(['😵', '😤']), true);
        this.aiChat(winner, pick(['😎', '🤣']), true);
        this.afterResolve(p, false);
        return;
      }
      case 'junction': {
        // 长廊入口：持有 ≥2 块地皮才能进（v5.2 国际校区把门槛降到 1 块）
        const need = this.facIs('intl') ? 1 : BRANCH.NEED;
        if (this.propCells(p).length >= need) {
          this.phase = 'branch';
          this.pendingBranch = { pid: p.id, cell: idx, line: 'A' };
          this.addLog(`🎓 ${p.name} 来到长廊入口：条件满足（持有 ≥${need} 块地皮${this.facIs('intl') ? '，国际校区已降门槛' : ''}），可进入「学术长廊」`);
          this.ev({ t: 'ask_branch', pid: p.id, cell: idx, line: 'A' });
          this.setTimer(TURN_MS, () => this.declineBranch(this.curp()));
          if (p.isAI) this.aiTimers.push(setTimeout(() => this.aiBranch(p), rnd(3000, 6200)));
        } else {
          this.addLog(`${p.name} 路过长廊入口（需持有 ≥${need} 块地皮才能进岔路，现在 ${this.propCells(p).length} 块）`);
          this.afterResolve(p, false);
        }
        return;
      }
      case 'junction2': {
        // 大道入口（v4.2）：无门槛，人人可进，高风险高回报
        this.phase = 'branch';
        this.pendingBranch = { pid: p.id, cell: idx, line: 'B' };
        this.addLog(`🚀 ${p.name} 来到大道入口：可进入「创业大道」闯一闯（无门槛，高风险高回报）`);
        this.ev({ t: 'ask_branch', pid: p.id, cell: idx, line: 'B' });
        this.setTimer(TURN_MS, () => this.declineBranch(this.curp()));
        if (p.isAI) this.aiTimers.push(setTimeout(() => this.aiBranch(p), rnd(3000, 6200)));
        return;
      }
      case 'invest': {
        // 科研基金处（v5.1：投 ¥2000，2 轮后结题返还 ¥3000 —— 净赚从 ¥1600 降到 ¥1000）
        if (p.invest) { this.addLog(`${p.name} 已有一笔投资在途（第 ${p.invest.due} 轮返还 ¥${p.invest.back}）`); this.afterResolve(p, false); return; }
        if (p.cash < 2000) { this.addLog(`${p.name} 现金不足，错过科研投资`); this.afterResolve(p, false); return; }
        const back = this.facIs('park') ? 3600 : 3000;   // v5.2 科技园区：返还 +20%
        this.phase = 'invest';
        this.pendingInvest = { pid: p.id, cost: 2000, back, rounds: 2 };
        this.addLog(`🔬 ${p.name} 来到科研基金处：花 ¥2000 立项，2 轮后结题返还 ¥${back}${this.facIs('park') ? '（科技园区 +20%）' : ''}`);
        this.ev({ t: 'ask_invest', pid: p.id, cell: idx });
        this.setTimer(TURN_MS, () => this.declineInvest(this.curp()));
        if (p.isAI) this.aiTimers.push(setTimeout(() => this.aiInvest(p), rnd(3000, 6000)));
        return;
      }
      case 'advisor': {
        // 导师办公室：心情随机
        if (Math.random() < 0.5) {
          const gain = this.facBranch(1500);   // v5.2 国际校区：岔路奖励 ×1.12
          p.cash += gain;
          this.addLog(`☕ 导师今天心情好，请 ${p.name} 喝咖啡还发了补贴 +¥${gain}`);
          this.ev({ t: 'money', pid: p.id, amount: gain, reason: '导师请喝咖啡' });
        } else {
          this.addLog(`📉 ${p.name} 被导师抓去搬实验室设备，累到打车回家 -¥1000`);
          this.charge(p, 1000, null, '搬设备打车费', idx, false);
          return;
        }
        this.afterResolve(p, false); return;
      }
      case 'shop': {
        // 校庆礼品屋（v5.1）：与校园商城同款，随机抽 1~2 张效果卡（含「技能次数 +1」）
        // v5.2 艺术校区：盲盒每次多抽 1 张
        const n = this.rollCardCount() + ((this.facIs('art') || this.facIs('artfest')) ? 1 : 0);
        this.addLog(`🎁 ${p.name} 走进校庆礼品屋，工作人员送出 ${n} 张效果卡盲盒${this.facIs('art') ? '（艺术校区多送 1 张）' : ''}`);
        this.grantCards(p, idx, n, '校庆礼品屋');
        this.afterResolve(p, false); return;
      }
      case 'ginkgo': {
        // 奖学金长廊（v5.1）：85% 领 ¥2000 + 接下来两次移动各 +3；15% 被举报，改为给总资产最少者 ¥2500
        if (Math.random() < 0.15) {
          this.evRoll(p, idx, '被同学举报奖学金材料造假', ['正常领取 ¥2000', '被举报 → 转给最穷的同学 ¥2500'], 1, 'bad');
          const poor = this.alive().slice().sort((x, y) => this.netWorth(x) - this.netWorth(y))[0];
          if (poor && poor.id !== p.id) {
            const give = Math.min(2500, Math.max(0, p.cash));
            p.cash -= give; p.combo = 0; poor.cash += give;
            this.addLog(`📢 ${p.name} 在奖学金长廊被举报，¥${give} 转给了总资产最少的 ${poor.name}`);
            this.ev({ t: 'money', pid: p.id, amount: -give, reason: '被举报·转让' });
            this.ev({ t: 'money', pid: poor.id, amount: give, reason: '同学举报所得' });
          } else {
            this.addLog(`📢 ${p.name} 在奖学金长廊被举报，但他自己就是最穷的，这事儿就算了`);
          }
          this.afterResolve(p, false); return;
        }
        const sch = this.facBranch(2000);   // v5.2 国际校区：岔路奖励 ×1.12
        this.evRoll(p, idx, '奖学金长廊审核结果', [`正常领取 ¥${sch} + 两次加速`, '被举报 → 转给最穷的同学 ¥2500'], 0, 'good');
        p.cash += sch;
        p.stepBuffs.push(3, 3);
        this.addLog(`🎓 ${p.name} 走通奖学金长廊：+¥${sch}，接下来两次移动各 +3 步`);
        this.ev({ t: 'money', pid: p.id, amount: sch, reason: '奖学金长廊' });
        this.ev({ t: 'buff', pid: p.id, steps: 3, left: 2, queue: true });
        this.afterResolve(p, false); return;
      }
      case 'hall': {
        // 校友会馆 / 杰出校友厅：领基金池 25% 分红（至少 ¥600）；杰出校友厅额外有 10% 被举报风险
        // v5.8：创业基金厅（无 risk 标记的 hall）—— 15% 概率投资失败，本局被教育基金拉黑
        if (!cell.risk && Math.random() < 0.15) {
          this.evRoll(p, idx, '创业基金厅·投资审核', ['领取基金分红', '💥 投资失败 → 被教育基金拉黑'], 1, 'bad');
          p.fundBanned = true;
          this.addLog(`💥 ${p.name} 在创业基金厅的投资失败！本局被教育基金拉黑（基金分红 / 独吞奖池都领不了）`);
          this.ev({ t: 'invest_fail', pid: p.id, cell: idx });
          this.afterResolve(p, false); return;
        }
        if (cell.risk && Math.random() < 0.10) {
          this.evRoll(p, idx, '杰出校友厅·论文抽查', ['领取基金分红', '被耿同学举报论文造假 → 缴 ¥2000'], 1, 'bad');
          const fine = this.facFine(2000);
          this.addLog(`📑 耿同学实名举报 ${p.name} 论文造假，缴 ¥${fine} 进教育基金池`);
          this.charge(p, fine, null, '论文造假罚款', idx, true);
          return;
        }
        if (p.fundBanned) {
          this.addLog(`🚫 ${p.name} 已被教育基金拉黑（投资失败），${cell.name} 的分红领不了`);
          this.ev({ t: 'fund_banned', pid: p.id, cell: idx });
          this.afterResolve(p, false); return;
        }
        const take = Math.max(600, this.facBranch(Math.floor(this.fundPool * 0.25)));
        const fromPool = Math.min(take, this.fundPool);
        this.fundPool -= fromPool;
        const sub = take - fromPool;
        p.cash += take;
        if (cell.risk) this.evRoll(p, idx, '杰出校友厅·论文抽查', ['领取基金分红', '被耿同学举报论文造假 → 缴 ¥2000'], 0, 'good');
        this.addLog(`🏛️ ${p.name} 在${cell.name}领取基金分红 ¥${take}${sub > 0 ? `（基金池见底，校友会垫付 ¥${sub}）` : ''}`);
        this.ev({ t: 'money', pid: p.id, amount: take, reason: '基金分红' });
        this.afterResolve(p, false); return;
      }
      case 'exit': {
        // 校史馆（v5.1）：停留一回合学习校史，并领 1 张免租金卡
        p.medal += 1;
        p.skipTurns = Math.max(p.skipTurns || 0, 1);
        this.addLog(`🏛️ ${p.name} 参观校史馆：领到 1 张「免租金卡」，并留下学习一回合`);
        this.ev({ t: 'medalGain', pid: p.id, count: 1 });
        this.afterResolve(p, false);
        return;
      }
      case 'exit2': {
        // 校企合作中心（v5.1）：领 ¥2000 现金，并停留一回合学习
        const coop = this.facBranch(2000);
        p.cash += coop;
        p.skipTurns = Math.max(p.skipTurns || 0, 1);
        this.addLog(`🤝 ${p.name} 进入校企合作中心：领到 ¥${coop} 现金，并留下学习一回合`);
        this.ev({ t: 'money', pid: p.id, amount: coop, reason: '校企合作中心' });
        this.afterResolve(p, false);
        return;
      }
      case 'startup': {
        // 创业孵化器（v5.1）：50% 获奖 ¥4000 / 50% 亏损 ¥2000
        const win = Math.random() < 0.5;
        this.evRoll(p, idx, '创业孵化器·路演结果', ['🎉 获奖 ¥4000', '💸 亏损 ¥2000'], win ? 0 : 1, win ? 'good' : 'bad');
        if (win) {
          const gain = this.facBranch(4000);
          p.cash += gain;
          this.addLog(`🚀 ${p.name} 创业路演大成功！投资人现场追投 +¥${gain}`);
          this.ev({ t: 'money', pid: p.id, amount: gain, reason: '创业路演成功' });
          this.aiChat(p, pick(['🤩', '🤑']));
          this.checkRichest(p);
          this.afterResolve(p, false); return;
        }
        this.addLog(`💸 ${p.name} 路演冷场，自负 ¥2000 成本（进教育基金池）`);
        this.charge(p, 2000, null, '路演亏损', idx, true);
        return;
      }
      case 'exchange': {
        // 国际交流站（v5.1；v5.8：中签率 50% → 40%，负面 60%）
        if (p.cash < 1200) { this.addLog(`${p.name} 现金不足，只能看看交换项目宣传册`); this.afterResolve(p, false); return; }
        const win = Math.random() < 0.4;
        this.evRoll(p, idx, '国际交流站·名额抽签', ['🎉 中签 → 领 ¥4000', '😢 落选 → 报名费打水漂'], win ? 0 : 1, win ? 'good' : 'bad');
        p.cash -= 1200; p.combo = 0;   // v5.8：扣钱断连击
        if (win) {
          const gain = this.facBranch(4000);
          p.cash += gain;
          this.addLog(`🌍 ${p.name} 交换项目申请通过，拿到 ¥${gain} 奖学金（净赚 ¥${gain - 1200}）`);
          this.ev({ t: 'money', pid: p.id, amount: gain, reason: '交换生奖学金' });
          this.aiChat(p, pick(['🤩', '🎉']));
          this.checkRichest(p);
        } else {
          this.addLog(`🌍 ${p.name} 交换名额被抢，¥1200 报名费打水漂`);
          this.ev({ t: 'charge', pid: p.id, amount: 1200, creditor: null, reason: '交换报名费', cell: idx, toPool: false });
        }
        this.afterResolve(p, false);
        return;
      }
      case 'study': {
        // 通宵自习室（v5.1）：80% 停留一回合领 ¥2000；20% 猝死付 ¥4000 治疗且再停一回合
        const dead = Math.random() < 0.20;
        this.evRoll(p, idx, '通宵自习室·熬夜后果', ['📚 顺利闭关 → +¥2000 奖学金', '😵 猝死送医 → 付 ¥4000 且再停一回合'], dead ? 1 : 0, dead ? 'bad' : 'good');
        if (dead) {
          this.addLog(`🚑 ${p.name} 通宵猝死送医：治疗费 ¥4000，还要再休养一回合`);
          this.ev({ t: 'stay', pid: p.id });
          p.skipTurns = Math.max(p.skipTurns || 0, 2);
          this.charge(p, 4000, null, '住院治疗费', idx, true);
          return;
        }
        const sch2 = this.facBranch(2000);
        p.skipNext = true; p.cash += sch2;
        this.addLog(`📚 ${p.name} 在通宵自习室闭关一回合，奖学金 ¥${sch2} 到账`);
        this.ev({ t: 'money', pid: p.id, amount: sch2, reason: '闭关奖学金' });
        this.ev({ t: 'stay', pid: p.id });
        this.afterResolve(p, false); return;
      }
      case 'intern': {
        // 实习直通车（v5.1）：80% 停留一回合赚 ¥3000；20% 被导师召回，扣 ¥2000 且再停一回合
        const fired = Math.random() < 0.20;
        this.evRoll(p, idx, '实习直通车·导师态度', ['💼 顺利实习 → +¥3000', '📞 导师召回 → 扣 ¥2000 且再停一回合'], fired ? 1 : 0, fired ? 'bad' : 'good');
        if (fired) {
          this.addLog(`📞 ${p.name} 的导师不允许实习，直接把他召回：扣 ¥2000，还要再停一回合`);
          this.ev({ t: 'stay', pid: p.id });
          p.skipTurns = Math.max(p.skipTurns || 0, 2);
          this.charge(p, 2000, null, '被导师召回', idx, true);
          return;
        }
        const pay3 = this.facBranch(3000);
        p.skipNext = true; p.cash += pay3;
        this.addLog(`💼 ${p.name} 坐上实习直通车，一回合赚到 ¥${pay3} 补贴`);
        this.ev({ t: 'money', pid: p.id, amount: pay3, reason: '实习补贴' });
        this.ev({ t: 'stay', pid: p.id });
        this.afterResolve(p, false); return;
      }
      case 'arena': {
        // 校园运动会（v5.1）：和总资产最高的玩家比；自己就是首富则无效；胜者拿走输者现金的 25%
        const others = this.alive().filter(q => q.id !== p.id);
        const myNW = this.netWorth(p);
        const rich = others.slice().sort((x, y) => this.netWorth(y) - this.netWorth(x))[0];
        if (!rich || myNW >= this.netWorth(rich)) {
          this.addLog(`🏟️ ${p.name} 站上校园运动会，一看自己才是全场首富，无人应战（本格无效）`);
          this.ev({ t: 'money', pid: p.id, amount: 0, reason: '运动会·无人应战' });
          this.afterResolve(p, false); return;
        }
        let a = 1 + Math.floor(Math.random() * 6);
        const b = 1 + Math.floor(Math.random() * 6);
        if (p.major === 'mil' && p.skillLeft > 0) {
          a += 1; p.skillLeft--;
          this.addLog(`🎖️ ${p.name} 发动【战术压制】，运动会点数 +1`);
          this.ev({ t: 'skill', pid: p.id, major: 'mil', name: '战术压制', detail: '点数 +1' });
        }
        if (a === b) {
          this.addLog(`🏟️ 校园运动会：${p.name}(${a}) 与首富 ${rich.name}(${b}) 战成平手，握手致意`);
          this.ev({ t: 'duel', pid: p.id, opp: rich.id, a, b, label: '校园运动会', winner: null, amount: 0 });
          this.afterResolve(p, false); return;
        }
        const pct = this.facIs('sports') ? 0.30 : 0.25;   // v5.2 文体校区：运动会赌注 ×1.2（25% → 30%）
        if (a > b) {
          const take = Math.max(0, Math.floor(rich.cash * pct));
          rich.cash -= take; p.cash += take; rich.combo = 0;
          this.addLog(`🏟️ 校园运动会：${p.name}(${a}) 力压首富 ${rich.name}(${b})，赢走对方现金的 ${Math.round(pct * 100)}% → ¥${take}！`);
          this.ev({ t: 'duel', pid: p.id, opp: rich.id, a, b, label: '校园运动会', winner: p.id, amount: take, pct });
          if (take > 0) { this.ev({ t: 'charge', pid: rich.id, amount: take, creditor: p.id, reason: '校园运动会', cell: idx, toPool: false }); this.ev({ t: 'paid', pid: rich.id, amount: take, creditor: p.id, toPool: false }); }
          this.aiChat(p, pick(['💪', '😎']), true);
          this.checkRichest(p);
        } else {
          const pay = Math.max(0, Math.floor(p.cash * pct));
          p.cash -= pay; rich.cash += pay; p.combo = 0;
          this.addLog(`🏟️ 校园运动会：${p.name}(${a}) 不敌首富 ${rich.name}(${b})，被拿走现金的 ${Math.round(pct * 100)}% → ¥${pay}`);
          this.ev({ t: 'duel', pid: p.id, opp: rich.id, a, b, label: '校园运动会', winner: rich.id, amount: pay, pct });
          if (pay > 0) { this.ev({ t: 'charge', pid: p.id, amount: pay, creditor: rich.id, reason: '校园运动会', cell: idx, toPool: false }); this.ev({ t: 'paid', pid: p.id, amount: pay, creditor: rich.id, toPool: false }); }
        }
        this.afterResolve(p, false); return;
      }
      case 'market': {
        // 毕业跳蚤市场（v5.1）：好物 +¥3000（10%）/ 出清 +¥1000（60%）/ 假货 -¥1500（30%）
        const r = Math.random();
        const which = r < 0.10 ? 0 : (r < 0.70 ? 1 : 2);
        const gA = this.facBranch(3000), gB = this.facBranch(1000);
        this.evRoll(p, idx, '毕业跳蚤市场·摆摊结果', [`💎 好物 +¥${gA}`, `🧺 出清 +¥${gB}`, '🎭 假货 -¥1500'], which, which === 2 ? 'bad' : 'good');
        if (which === 0) {
          p.cash += gA;
          this.addLog(`💎 ${p.name} 在跳蚤市场淘到限量好物，转手净赚 ¥${gA}`);
          this.ev({ t: 'money', pid: p.id, amount: gA, reason: '跳蚤市场捡漏' });
          this.checkRichest(p);
          this.afterResolve(p, false); return;
        }
        if (which === 1) {
          p.cash += gB;
          this.addLog(`🧺 ${p.name} 摆摊卖出闲置，回血 ¥${gB}`);
          this.ev({ t: 'money', pid: p.id, amount: gB, reason: '跳蚤市场出清' });
          this.afterResolve(p, false); return;
        }
        this.addLog(`🎭 ${p.name} 花钱买教训：淘到假货，亏了 ¥1500（进教育基金池）`);
        this.charge(p, 1500, null, '买到假货', idx, true);
        return;
      }
      case 'chance': this.drawCard(p, CHANCE, 'chance'); return;
      case 'fate': this.drawCard(p, FATE, 'fate'); return;
      default: this.afterResolve(p, false);
    }
  }

  // v5.4：AI 拟人 —— 贵的地要想更久（像真人纠结掏不掏钱），便宜的地果断拿下
  scheduleBuy() {
    const p = this.curp();
    if (p.isAI) {
      const price = (this.pendingBuy && this.pendingBuy.price != null) ? this.pendingBuy.price : 0;
      const delay = price > p.cash * 0.55 ? rnd(5600, 11000) : rnd(3600, 7200);
      this.aiTimers.push(setTimeout(() => this.aiBuy(), delay));
    } else this.setTimer(TURN_MS, () => this.declineBuy(this.curp()));
  }
  scheduleBuild() { const p = this.curp(); if (p.isAI) this.aiTimers.push(setTimeout(() => this.aiBuild(), rnd(3600, 7600))); else this.setTimer(TURN_MS, () => this.skipBuild(this.curp())); }

  buy(p) {
    if (this.phase !== 'buy' || !this.pendingBuy || this.pendingBuy.pid !== p.id) return;
    const { cell, mortgageBuy } = this.pendingBuy;
    const basePrice = this.pendingBuy.price;
    const cs = this.cells[cell], c = BOARD[cell];
    const usedDiscount = !!p.discount && !mortgageBuy;
    const freeNow = this.isFreeRound() && !mortgageBuy;   // v5.2 免费轮：这一轮买地皮不要钱
    let price = freeNow ? 0 : basePrice, mathCut = false, geolCut = false;
    // 专业：数学 · 精算砍价（买入自动 8.2 折，与折扣卡不叠加）
    if (!freeNow && !mortgageBuy && !usedDiscount && p.major === 'math' && p.skillLeft > 0 && p.cash >= Math.max(1, Math.round(basePrice * 0.82))) {
      price = Math.max(1, Math.round(basePrice * 0.82)); mathCut = true;
    }
    // 专业：地质 · 勘探评估（买入自动 9.1 折，与折扣卡不叠加）
    if (!freeNow && !mortgageBuy && !usedDiscount && p.major === 'geol' && p.skillLeft > 0 && p.cash >= Math.max(1, Math.round(basePrice * 0.91))) {
      price = Math.max(1, Math.round(basePrice * 0.91)); geolCut = true;
    }
    // v5.3：通用买地折扣 —— 主动技临时折扣（buyCutTurn，如电气·峰谷套利）优先，其次被动 buyCut
    let genCut = 0, genTurn = false;
    const bmj = MAJORS[p.major] || {};
    if (!freeNow && !mortgageBuy && !usedDiscount && !mathCut && !geolCut && p.skillLeft > 0) {
      if ((p.buyCutTurn || 0) > 0) { genCut = p.buyCutTurn; genTurn = true; }
      else if (bmj.buyCut) { genCut = bmj.buyCut; }
      if (genCut > 0) price = Math.max(1, Math.round(basePrice * (1 - genCut)));
    }
    if (p.cash < price) { this.declineBuy(p); return; }
    if (mathCut || geolCut) {
      p.skillLeft--;
      this.addLog(`${mathCut ? '📐' : '🗺️'} ${p.name} 发动【${mathCut ? '精算砍价' : '勘探评估'}】，买价 ¥${basePrice} → ¥${price}`);
      this.ev({ t: 'skill', pid: p.id, major: mathCut ? 'math' : 'geol', name: mathCut ? '精算砍价' : '勘探评估', detail: `省 ¥${basePrice - price}` });
    }
    if (genCut > 0) {
      if (!genTurn) p.skillLeft--;   // 被动折扣消耗次数；主动技的临时折扣在发动时已扣
      this.addLog(`${bmj.icon || '✨'} ${p.name} 发动【${bmj.skill}】，买价 ¥${basePrice} → ¥${price}`);
      this.ev({ t: 'skill', pid: p.id, major: p.major, name: bmj.skill, detail: `省 ¥${basePrice - price}`, active: genTurn });
      // v5.3：部分地区研究类专业买地还有现金返利（如地球物理）
      if (bmj.buyCash) {
        p.cash += bmj.buyCash;
        this.addLog(`${bmj.icon} ${p.name} 的【${bmj.skill}】勘探返利 +¥${bmj.buyCash}`);
        this.ev({ t: 'money', pid: p.id, amount: bmj.buyCash, reason: bmj.skill });
      }
    }
    p.cash -= price;   // v5.9：买地不打断连击
    p.boughtThisTurn = true;   // v5.10：计入本轮限购额度
    cs.own = p.id; cs.mortgaged = false; cs.mortgageAt = 0;
    if (p.discount) p.discount = false;
    // v5.7：研究项目的买地返现（拿地返现）
    if (p.hex && p.hex.buyCash && !mortgageBuy && price > 0) {
      p.cash += p.hex.buyCash;
      this.ev({ t: 'money', pid: p.id, amount: p.hex.buyCash, reason: '项目·拿地返现' });
    }
    this.addLog(`${p.name} 以 ¥${price} 买下「${c.name}」${usedDiscount ? '（8折卡生效）' : ''}${mathCut ? '（精算砍价）' : ''}${geolCut ? '（勘探评估）' : ''}${genCut > 0 ? `（${bmj.skill}）` : ''}`);
    this.ev({ t: 'buy', pid: p.id, cell, price, mortgageBuy: !!mortgageBuy });
    this.pendingBuy = null;
    this.checkOwnership(p);
    // v5.0 续·二：刚好买齐同色组 3 所 → 播一次「垄断达成」庆祝（对局中最多触发一次/每组）
    if (c.type === 'prop') {
      const gc = this.groupCells(c.g);
      if (gc.length && gc.every(i => this.cells[i].own === p.id)) {
        this.addLog(`🏆 ${p.name} 集齐 ${c.g.toUpperCase()} 色组 3 所名校，裸地租金 ×3！`);
        this.ev({ t: 'mono', pid: p.id, g: c.g, cells: gc.slice(), names: gc.map(i => BOARD[i].name) });
        this.aiChat(p, pick(['🏆 三所齐了，租金翻三倍！', '这组名校我承包了！', '✌️ 从今天起这段路我说了算']), true);
      }
    }
    this.aiChat(p, pick(['😎', '🤑']));
    this.afterResolve(p, true);
  }
  // 拥有地数量 / 色组垄断 → 成就
  checkOwnership(p) {
    let hold = 0;
    this.cells.forEach(cs => { if (cs.own === p.id) hold++; });
    if (hold >= 8) this.giveAch(p, 'tycoon');
    for (const g of Object.keys(GROUPS)) {
      const gc = this.groupCells(g);
      if (gc.length && gc.every(i => this.cells[i].own === p.id)) { this.giveAch(p, 'monopoly'); break; }
    }
  }
  declineBuy(p) {
    if (this.phase !== 'buy' || !this.pendingBuy || this.pendingBuy.pid !== p.id) return;
    const { cell, mortgageBuy } = this.pendingBuy;
    this.pendingBuy = null;
    if (mortgageBuy) { this.addLog(`${p.name} 放弃买走抵押地`); this.afterResolve(p, true); return; }
    this.startAuction(cell, p);
  }
  startAuction(cell, from) {
    const c = BOARD[cell];
    this.phase = 'auction';
    this.auction = { cell, highest: 0, bidder: null, endsAt: Date.now() + AUCTION_MS, maxBid: {} };
    this.addLog(`${from.name} 放弃购买，「${c.name}」进入公开拍卖（15 秒）`);
    this.ev({ t: 'auction_start', cell, ms: AUCTION_MS });
    this.setTimer(AUCTION_MS, () => this.endAuction());
    // AI 评估首轮出价
    for (const q of this.alive()) if (q.isAI) this.aiTimers.push(setTimeout(() => this.aiBid(q), rnd(3400, 11500)));
  }
  bid(p, amount) {
    if (this.phase !== 'auction' || !p.alive) return;
    if (this.round <= 5 && p.boughtThisTurn) return;   // v5.10：限购期间已买过地的玩家不能参拍
    const a = this.auction;
    if (!Number.isInteger(amount) || amount <= a.highest) return;
    if (amount > p.cash) return;
    a.highest = amount; a.bidder = p.id;
    this.ev({ t: 'auction_bid', pid: p.id, amount });
    this.setTimer(Math.max(4000, AUCTION_MS - (Date.now() - (a.endsAt - AUCTION_MS))), () => this.endAuction());
    if (p.isAI) return;
    for (const q of this.alive()) if (q.isAI && q.id !== p.id) this.aiTimers.push(setTimeout(() => this.aiBid(q), rnd(3000, 8000)));
  }
  endAuction() {
    if (this.phase !== 'auction') return;
    const a = this.auction, cell = a.cell, c = BOARD[cell];
    if (a.bidder) {
      const w = this.players.find(p => p.id === a.bidder);
      let price = a.highest;
      // v5.10：拍卖慧眼 —— 成交价打折
      if (w.hex && w.hex.auctionCut) {
        price = Math.max(1, Math.round(price * (1 - w.hex.auctionCut)));
        this.hexFx(w, 'auctioneer', `拍卖慧眼：成交价 ¥${a.highest} → ¥${price}`);
      }
      w.cash -= price;   // v5.9：拍卖不打断连击
      w.boughtThisTurn = true;   // v5.10：计入本轮限购额度
      this.cells[cell].own = w.id;
      this.addLog(`${w.name} 以 ¥${price} 拍得「${c.name}」${price !== a.highest ? `（拍卖慧眼，原价 ¥${a.highest}）` : ''}`);
      this.ev({ t: 'buy', pid: w.id, cell, price, auction: true });
      this.checkOwnership(w);
    } else {
      this.addLog(`「${c.name}」无人出价，保持无主`);
      this.ev({ t: 'auction_none', cell });
    }
    this.auction = null;
    const p = this.curp();
    this.afterResolve(p, true);
  }

  build(p) {
    if (this.phase !== 'build' || !this.pendingBuild || this.pendingBuild.pid !== p.id) return;
    const { cell, cost } = this.pendingBuild;
    const cs = this.cells[cell], c = BOARD[cell];
    this.pendingBuild = null;
    if (c.type !== 'prop') { this.afterResolve(p, true); return; }
    if (cs.mortgaged) { this.addLog(`「${c.name}」处于抵押状态，赎回后才能升级`); this.afterResolve(p, true); return; }
    const baseCost = (cost != null) ? cost : GROUPS[c.g].build;
    // v5.1：专业盖房折扣（可叠乘）—— 机械常驻 −10%；机械主动技本回合再 −50%；建筑 −35%；土木工程 −20%
    let mul = 1; const usedCuts = [];
    if (p.major === 'mech') mul *= 0.91;
    if (p.major === 'mech' && (p.buildCutTurn || 0) > 0) { mul *= (1 - p.buildCutTurn); usedCuts.push(['精益制造', 'mech', true]); }
    if (p.major === 'arch' && p.skillLeft > 0) { mul *= 0.68; usedCuts.push(['造价管理', 'arch', false]); }
    if (p.major === 'civil' && p.skillLeft > 0) { mul *= 0.82; usedCuts.push(['基建加固', 'civil', false]); }
    // v5.3：通用盖房折扣 —— 主动技临时折扣（buildCutTurn）优先，其次被动 buildCut（消耗次数）
    if (p.major !== 'mech' && p.major !== 'arch' && p.major !== 'civil') {
      const gmj = MAJORS[p.major] || {};
      if ((p.buildCutTurn || 0) > 0) { mul *= (1 - p.buildCutTurn); usedCuts.push([gmj.skill || '主动技', p.major, true]); }
      else if (gmj.buildCut && p.skillLeft > 0) { mul *= (1 - gmj.buildCut); usedCuts.push([gmj.skill, p.major, false]); }
    }
    if (mul < 0.3) mul = 0.3;                       // 折扣下限，避免费用被压到 0
    const price = this.isFreeRound() ? 0 : Math.max(1, Math.round(baseCost * mul));   // v5.2 免费轮：盖楼不要钱
    if (cs.level < 4 && p.cash >= price) {
      if (this.isFreeRound()) {
        this.addLog(`🎟️ 【免费轮】${p.name} 的「${c.name}」免费升级（原价 ¥${baseCost}），本轮盖楼不要钱`);
        this.ev({ t: 'facfx', pid: p.id, kind: 'freeRound', name: '免费轮', detail: `免费升级「${c.name}」` });
      } else if (mul < 1) {
        const nmAll = usedCuts.map(x => x[0]).join(' + ') || '精益制造·常驻';
        const ic = usedCuts.length ? (MAJORS[usedCuts[0][1]].icon) : '⚙️';
        this.addLog(`${ic} ${p.name} 发动【${nmAll}】，费用 ¥${baseCost} → ¥${price}`);
        for (const [nm, key, actv] of usedCuts) {
          this.ev({ t: 'skill', pid: p.id, major: key, name: nm, detail: `省 ¥${baseCost - price}`, active: !!actv });
        }
        for (const [, , actv] of usedCuts) if (!actv) p.skillLeft--;
      }
      p.cash -= price; cs.level++;   // v5.9：盖房不打断连击
      // v5.7：研究项目的盖房返现（盖房返现）
      if (p.hex && p.hex.buildCash && price > 0) {
        p.cash += p.hex.buildCash;
        this.ev({ t: 'money', pid: p.id, amount: p.hex.buildCash, reason: '项目·盖房返现' });
      }
      // v5.3：通用 —— 升级成功后的现金返利（buildCash，如智能制造·柔性产线）
      const bmj2 = MAJORS[p.major] || {};
      if (bmj2.buildCash && usedCuts.some(x => x[1] === p.major)) {
        p.cash += bmj2.buildCash;
        this.addLog(`${bmj2.icon} ${p.name} 的【${bmj2.skill}】产线返利 +¥${bmj2.buildCash}`);
        this.ev({ t: 'money', pid: p.id, amount: bmj2.buildCash, reason: bmj2.skill });
      }
      const isHotel = cs.level === 4;
      this.addLog(`${p.name} 花 ¥${price} 将「${c.name}」升到 Lv${cs.level}${isHotel ? ' —— 旅馆落成！！' : ''}`);
      this.ev({ t: 'build', pid: p.id, cell, level: cs.level, cost: price, hotel: isHotel });
      if (isHotel) { this.giveAch(p, 'hotel'); this.aiChat(p, pick(['😎', '🤩'])); }
    } else {
      this.addLog(`${p.name} 放弃升级「${c.name}」`);
    }
    this.afterResolve(p, true);
  }
  skipBuild(p) {
    if (this.phase !== 'build' || !this.pendingBuild || this.pendingBuild.pid !== p.id) return;
    this.pendingBuild = null;
    this.addLog(`${p.name} 放弃升级`);
    this.afterResolve(p, true);
  }

  afterResolve(p, resolvable) {
    // 双数：同玩家再掷一次（v5.6：一回合最多掷两次；被罚停留 / 留级期间不再追加）
    if (this.dice && this.dice[0] === this.dice[1] && this.dice[1] > 0 && p.alive
        && !p.skipNext && !(p.skipTurns > 0)) {
      if ((p.rollsThisTurn || 0) < 2) {
        this.addLog(`🎲 ${p.name} 掷出双数，再掷一次！（本回合第 ${p.rollsThisTurn + 1} 掷）`);
        this.ev({ t: 'doubles', pid: p.id, again: true, nth: p.rollsThisTurn + 1 });
        this.phase = 'roll';
        this.schedule();
        return;
      }
      this.addLog(`🎲 ${p.name} 掷出双数，但一回合最多掷两次，就到这里`);
      this.ev({ t: 'doubles', pid: p.id, again: false });
    }
    this.endTurn();
  }

  // ---------- 租金与扣款 ----------
  groupCells(g) { const r = []; BOARD.forEach((c, i) => { if (c.type === 'prop' && c.g === g) r.push(i); }); return r; }
  calcRent(idx, dice) {
    const c = BOARD[idx], cs = this.cells[idx];
    if (cs.mortgaged) return 0;
    const owner = this.players.find(p => p.id === cs.own);
    let base = 0;
    if (c.type === 'prop') {
      if (cs.level > 0) {
        // v5.0：同色组内每所大学按自身裸地租金等比缩放，保证 30 所租金两两不同
        const gp = GROUPS[c.g];
        base = Math.round(gp.rents[cs.level - 1] * (c.rent / gp.refRent));
      }
      else {
        const full = this.groupCells(c.g).every(i => this.cells[i].own === owner.id);
        // v3.5 裸地加成；v5.8：裸地 ×1.3、垄断裸地 ×2（削弱早期踩地痛感）
        base = c.rent * (full ? 2 : 1.3);
      }
    } else if (c.type === 'transport') {
      const n = BOARD.reduce((s, cc, i) => s + (cc.type === 'transport' && this.cells[i].own === owner.id ? 1 : 0), 0);
      base = [0, 800, 1600, 3500, 5500][n] || 5500;   // v5.9：机场租金 800/1600/3500/5500（购买价已统一 ¥2000）
    } else if (c.type === 'util') {
      const n = BOARD.reduce((s, cc, i) => s + (cc.type === 'util' && this.cells[i].own === owner.id ? 1 : 0), 0);
      // 文印店/快递驿站：一家 = 点数×100，两家垄断 = 点数×350（v5.1：×400 → ×350 削弱）
      base = (dice ? dice[0] + dice[1] : 7) * (n >= 2 ? 350 : 100);
    }
    // 季节 × 天气 × 校历事件 × 收租连击
    let mul = SEASON[this.season].rentMul;
    const W = WEATHER[this.weather];
    if (W && W.rentMul) mul *= W.rentMul;
    if (this.calEvent && this.calEvent.mul) mul *= this.calEvent.mul;
    // v5.8：收租连击 —— 三连 ×1.15、四连及以上 ×1.3（封顶 1.3）；扣钱即断（重投/免罚符购买除外）
    if (owner && owner.combo >= 2) mul *= owner.combo === 2 ? 1.15 : 1.3;
    mul *= this.facRentMul();   // v5.2：校园风貌（幅度控制在 ±8% 以内）
    // v5.2 生活区校区：只减免「公用事业（文印店/快递驿站）」与「机场路费」，不碰学生宿舍地皮租金
    if (this.facIs('life') && (c.type === 'util' || c.type === 'transport')) mul *= 0.92;
    // v5.10 地铁校区：机场便宜，驿站变贵
    if (this.facIs('metro') && c.type === 'transport') mul *= 0.85;
    if (this.facIs('metro') && c.type === 'util') mul *= 1.15;
    return Math.max(0, Math.round(base * mul));
  }

  charge(p, amount, creditor, reason, cellIdx, toPool = false) {
    // v5.8：免罚款卡 —— 免去一次「不是租金」的罚款（租金走 creditor，不受影响）
    if (!creditor && amount > 0 && (p.fineFree || 0) > 0) {
      p.fineFree--;
      this.addLog(`📜 ${p.name} 使用「免罚款卡」，免除「${reason}」¥${amount}（还剩 ${p.fineFree} 张）`);
      this.ev({ t: 'charge', pid: p.id, amount, creditor: null, reason, cell: cellIdx, toPool, waived: true });
      this.ev({ t: 'fine_free', pid: p.id, reason, amount, left: p.fineFree });
      this.finishPay(p);
      return true;
    }
    this.ev({ t: 'charge', pid: p.id, amount, creditor: creditor ? creditor.id : null, reason, cell: cellIdx, toPool });
    const r = this.tryPay(p, amount, creditor, toPool);
    // v5.1：表情包必须排在付款事件之后 —— 否则人机会在移动动画还没播完时就抢先发表情（剧透结果）
    // v5.4：AI 拟人 —— 大额付款偶尔用文字吐槽；现金见底时求饶，更像真人
    if (p.isAI && amount >= 1000) this.aiChat(p, pick(['😭', '😱', '💸', '这也太贵了吧！', '我的钱啊……', '下次赊账行不行']));
    if (p.isAI && p.cash < 1500 && amount >= 600) this.aiChat(p, pick(['要破产了，救命！', '各位大爷少收点 🙏', '我是不是该卖地了']));
    if (creditor && creditor.isAI && amount >= 1500) this.aiChat(creditor, pick(['🤑', '😆', '谢谢惠顾～', '过路费拿来！']));
    return r;
  }
  checkCombo(p) { if ((p.combo || 0) >= 3) this.giveAch(p, 'combo3'); }
  tryPay(p, amount, creditor, toPool = false) {
    if (p.cash >= amount) {
      p.cash -= amount;
      // v5.7：研究项目的付款返现（积分返现 / 消费返现）
      if (p.hex && p.hex.cashbackPct && amount > 0) {
        const back = Math.min(p.hex.cashbackCap || 1e9, Math.round(amount * p.hex.cashbackPct));
        if (back > 0) { p.cash += back; this.ev({ t: 'money', pid: p.id, amount: back, reason: '项目·付款返现' }); }
      }
      if (creditor) {
        creditor.cash += amount;
        if (creditor.combo >= 2) { this.addLog(`🔥 ${creditor.name} 连击 ×${creditor.combo + 1} 收租`); this.ev({ t: 'combo', pid: creditor.id, n: creditor.combo + 1 }); }
        creditor.combo = (creditor.combo || 0) + 1;
        this.checkCombo(creditor);
      }
      else if (toPool) this.addToFund(amount);
      // v5.8：只要扣钱就打断收租连击（重投骰子 / 免罚符购买不走 tryPay，天然豁免）
      p.combo = 0;
      this.ev({ t: 'paid', pid: p.id, amount, creditor: creditor ? creditor.id : null, toPool });
      this.finishPay(p);
      return true;
    }
    // 需要筹钱
    const need = amount - p.cash;
    this.phase = 'raise';
    this.raise = { pid: p.id, need: amount, creditor: creditor ? creditor.id : null, toPool };
    this.addLog(`${p.name} 现金不足（还差 ¥${need}），请抵押地产或卖房筹钱（30 秒）`);
    this.ev({ t: 'ask_raise', pid: p.id, need, amount });
    this.setTimer(TURN_MS, () => this.forceSettleRaise());
    if (p.isAI) this.aiTimers.push(setTimeout(() => this.aiRaise(), 3200));
    return false;
  }
  finishPay(p) {
    const mv = this._afterMove; this._afterMove = null;
    if (mv) { this.doCardMove(p, mv); return; }
    this.afterResolve(p, true);
  }
  // v5.1：抵押时机收敛为两种 —— ①盖房凑钱（踩自己地升级时） ②现金不足（筹钱/防破产）时。
  // 原「轮到自己掷骰前可随时主动抵押」这条途径已按用户要求删除。
  mortgage(p, cell) {
    const cs = this.cells[cell], c = BOARD[cell];
    const acting = (this.phase === 'raise' && this.raise && this.raise.pid === p.id)
      || (this.phase === 'build' && this.pendingBuild && this.pendingBuild.pid === p.id);
    if (!acting) return;
    if (cs.own !== p.id || cs.mortgaged) return;
    if (cs.level > 0) { // 先逐级回售建筑
      const back = cs.level * Math.floor(GROUPS[c.g].build / 2);
      cs.level = 0;
      p.cash += back;
      this.addLog(`${p.name} 将「${c.name}」的建筑回售给银行，回收 ¥${back}`);
    }
    let mp = Math.floor(c.price * (this.facIs('biz') ? 0.58 : 0.5));   // v5.2 商科校区：抵押可拿地价 58%
    // 专业：金融 · 杠杆操作（抵押多拿 30%）
    if (p.major === 'fin' && p.skillLeft > 0) {
      const bonus = Math.round(mp * 0.3);
      mp += bonus; p.skillLeft--;
      this.addLog(`💰 ${p.name} 发动【杠杆操作】，抵押多拿 ¥${bonus}`);
      this.ev({ t: 'skill', pid: p.id, major: 'fin', name: '杠杆操作', detail: `+¥${bonus}` });
    }
    // v5.3：通用被动 —— 抵押加成（mortgageUp）
    {
      const mmj = MAJORS[p.major] || {};
      if (mmj.mortgageUp && p.skillLeft > 0) {
        const bonus = Math.round(mp * mmj.mortgageUp);
        mp += bonus; p.skillLeft--;
        this.addLog(`${mmj.icon} ${p.name} 发动【${mmj.skill}】，抵押多拿 ¥${bonus}`);
        this.ev({ t: 'skill', pid: p.id, major: p.major, name: mmj.skill, detail: `+¥${bonus}` });
      }
    }
    // v5.7：研究项目的抵押加成（小额贷/杠杆大师 = 百分比加成；华尔街之狼 = 直接拿足地价 100%）
    {
      const hx = p.hex || {};
      if (hx.mortgage100) {
        const tgt = Math.round(c.price);
        if (tgt > mp) { mp = tgt; this.hexFx(p, 'wallstreet', '抵押拿足地价 100%'); }
      } else if (hx.mortgageUp) {
        const bonus = Math.round(mp * hx.mortgageUp);
        if (bonus > 0) mp += bonus;
      }
    }
    cs.mortgaged = true;
    cs.mortgageAt = this.round;   // v5.1：记录抵押轮次，用于计算赎回解锁轮
    p.cash += mp;
    this.addLog(`${p.name} 抵押「${c.name}」，获得 ¥${mp}（第 ${this.redeemUnlockRound(cs)} 轮起可赎回）`);
    this.ev({ t: 'mortgage', pid: p.id, cell, unlockRound: this.redeemUnlockRound(cs) });
    if (this.phase === 'raise' && this.raise && this.raise.pid === p.id) this.settleRaise();
  }
  // v5.1：赎回锁 —— 本轮抵押的地产，本轮与下一轮都锁住，要到「下下轮」才解锁（整整两个轮次）
  redeemUnlockRound(cs) { return (cs.mortgageAt || 0) + 2; }
  canRedeem(p, cell) {
    const cs = this.cells[cell];
    if (!cs || cs.own !== p.id || !cs.mortgaged) return false;
    return this.round >= this.redeemUnlockRound(cs);
  }
  redeem(p, cell) {
    const cs = this.cells[cell], c = BOARD[cell];
    if (cs.own !== p.id || !cs.mortgaged) return;
    if (!this.canRedeem(p, cell)) {
      this.addLog(`🔒 ${p.name} 想赎回「${c.name}」，但它还在抵押锁定期（第 ${this.redeemUnlockRound(cs)} 轮起才能赎回）`);
      return;
    }
    let mp = Math.floor(c.price * (this.facIs('biz') ? 0.58 : 0.5));
    if (this.facIs('biz')) mp = Math.round(mp * 1.08);   // v5.2 商科校区：赎回额外付 8% 手续费
    // v5.10：二手好价 / 金库钥匙 / 银行白名单 —— 赎回优惠
    if (p.hex && p.hex.redeemCut) { const sv = Math.round(mp * p.hex.redeemCut); if (sv > 0) { mp -= sv; this.hexFx(p, 'pawnshop', `赎回优惠 −¥${sv}`); } }
    if (p.cash < mp) return;
    p.cash -= mp; p.combo = 0; cs.mortgaged = false; cs.mortgageAt = 0;   // v5.8：扣钱断连击
    this.addLog(`${p.name} 花 ¥${mp} 赎回「${c.name}」${this.facIs('biz') ? '（含 8% 手续费）' : ''}`);
    this.ev({ t: 'redeem', pid: p.id, cell });
    if (this.phase === 'raise' && this.raise && this.raise.pid === p.id) this.settleRaise();
  }
  // v5.1：拆房（回售建筑）与抵押同权限 —— 只在「筹钱 / 盖房凑钱」两种时机可以动
  sellBuilding(p, cell) {
    const acting = (this.phase === 'raise' && this.raise && this.raise.pid === p.id)
      || (this.phase === 'build' && this.pendingBuild && this.pendingBuild.pid === p.id);
    if (!acting) return;
    const cs = this.cells[cell], c = BOARD[cell];
    if (cs.own !== p.id || cs.level === 0) return;
    const back = Math.floor(GROUPS[c.g].build / 2);   // 回收价 = 盖房价的一半
    cs.level--; p.cash += back;
    this.addLog(`${p.name} 将「${c.name}」降回 Lv${cs.level}，回收 ¥${back}`);
    this.ev({ t: 'sellb', pid: p.id, cell, level: cs.level });
    if (this.phase === 'raise' && this.raise && this.raise.pid === p.id) this.settleRaise();
  }
  settleRaise() {
    if (this.phase !== 'raise' || !this.raise) return;
    const p = this.players.find(q => q.id === this.raise.pid);
    const { need, creditor, toPool } = this.raise;
    if (p.cash >= need) {
      p.cash -= need;
      const cr = (creditor != null) ? this.players.find(q => q.id === creditor) : null;
      if (cr) { cr.cash += need; cr.combo = (cr.combo || 0) + 1; this.checkCombo(cr); p.combo = 0; }
      else if (toPool) this.addToFund(need);
      this.addLog(`${p.name} 筹齐资金，支付 ¥${need}`);
      this.ev({ t: 'paid', pid: p.id, amount: need, creditor, toPool });
      this.raise = null;
      this.finishPay(p);
    }
  }
  forceSettleRaise() {
    if (this.phase !== 'raise' || !this.raise) return;
    const p = this.players.find(q => q.id === this.raise.pid);
    const need = this.raise.need;
    // 自动抵押最贵的地（mortgage 内部筹够会自动结算并清空 raise）
    let guard = 0;
    while (this.raise && p.cash < need && guard++ < 60) {
      const cand = BOARD.map((c, i) => ({ c, i })).filter(({ c, i }) => this.cells[i].own === p.id && !this.cells[i].mortgaged)
        .sort((a, b) => (b.c.price + (this.cells[b.i].level ? GROUPS[b.c.g].build : 0)) - (a.c.price + (this.cells[a.i].level ? GROUPS[a.c.g].build : 0)))[0];
      if (!cand) break;
      const before = p.cash;
      this.mortgage(p, cand.i);
      if (p.cash <= before) break;   // 无进展 → 退出，防死循环
    }
    if (this.raise && p.cash < need) this.bankrupt(p, (this.raise.creditor != null) ? this.players.find(q => q.id === this.raise.creditor) : null);
    else if (this.raise) this.settleRaise();
  }

  bankrupt(p, creditor) {
    // v5.7 涅槃：首次破产时免除该笔债务，带 ¥5500 复活（限 1 次）
    if (p.alive && p.hex && (p.hex.nirvana || 0) > 0) {
      p.hex.nirvana = 0;
      p.cash = p.hex.nirvanaCash || 5500;   // v5.11：复活金额由卡面决定（涅槃 5500 / 浴火重生 4600）
      this.raise = null;
      this.addLog(`🔥 ${p.name} 触发【涅槃】，免除该笔债务并带着 ¥5500 从灰烬中站了起来！`);
      this.hexFx(p, 'nirvana', '涅槃：免债复活 +¥5500');
      this.finishPay(p);
      return;
    }
    p.alive = false;
    this.clearTimer(); this.clearAiTimers();
    let total = 0;
    BOARD.forEach((c, i) => {
      const cs = this.cells[i];
      if (cs.own !== p.id) return;
      if (creditor) {
        cs.own = creditor.id; // 已抵押的保持抵押状态
        this.ev({ t: 'transfer', cell: i, to: creditor.id });
      } else {
        total += Math.floor(c.price / 2) + (cs.level > 0 ? cs.level * Math.floor(GROUPS[c.g].build / 2) : 0);
        cs.own = null; cs.level = 0; cs.mortgaged = false; cs.mortgageAt = 0;
      }
    });
    if (creditor) { creditor.cash += p.cash; this.addLog(`${p.name} 破产出局！全部资产移交给 ${creditor.name}`); }
    else { total += p.cash; this.addLog(`${p.name} 破产出局！资产清算给银行`); }
    p.cash = 0; p.invest = null; p.buffSteps = 0; p.stepBuffs = []; p.medal = 0; p.skipTurns = 0; p.fineFree = 0; p.buildCutCard = 0;
    this.ev({ t: 'bankrupt', pid: p.id, creditor: creditor ? creditor.id : null });
    if (creditor) { this.giveAch(creditor, 'assassin'); this.aiChat(creditor, pick(['😈', '🤣']), true); }
    this.raise = null;
    if (this.checkWin()) return;
    this.endTurn();
  }

  checkWin() {
    const alive = this.alive();
    if (this.phase === 'over') return true;
    if (this.startedAt && alive.length === 1) {
      this.phase = 'over';
      alive[0].wins++;
      this.addLog(`🏆 ${alive[0].name} 是最后的赢家！`);
      this.ev({ t: 'gameover', winner: alive[0].id });
      return true;
    }
    return false;
  }

  // ---------- 抽卡 ----------
  drawCard(p, deck, type) {
    let card = pick(deck);
    // 专业：新闻 · 独家爆料（抽到负面卡时自动重抽一次）
    if (p.major === 'news' && p.skillLeft > 0 && this.isBadCard(card)) {
      const c2 = pick(deck);
      if (!this.isBadCard(c2)) {
        p.skillLeft--;
        this.ev({ t: 'skill', pid: p.id, major: 'news', name: '独家爆料', detail: '重抽卡牌' });
        card = c2;
      }
    }
    // v5.3：通用被动 —— 负面卡重抽（negReroll，如教育学 · 因材施教）
    if (p.major !== 'news') {
      const nmj = MAJORS[p.major] || {};
      if (nmj.negReroll && p.skillLeft > 0 && this.isBadCard(card)) {
        const c2 = pick(deck);
        if (!this.isBadCard(c2)) {
          p.skillLeft--;
          this.ev({ t: 'skill', pid: p.id, major: p.major, name: nmj.skill, detail: '重抽卡牌' });
          card = c2;
        }
      }
    }
    this.addLog(`${p.name} 抽到${type === 'chance' ? '机会' : '命运'}卡「${card.name}」：${card.desc}`);
    this.ev({ t: 'card', pid: p.id, type, card });
    // v5.7：研究项目 —— 命运改写（负面卡自动重抽，限次）
    if (p.hex && (p.hex.rerollBad || 0) > 0 && this.isBadCard(card)) {
      const c2 = pick(deck);
      if (!this.isBadCard(c2)) {
        p.hex.rerollBad--;
        this.hexFx(p, 'fatewheel', `命运改写：负面卡已重抽（剩 ${p.hex.rerollBad} 次）`);
        card = c2;
      }
    }
    // v5.7：研究项目 —— 卡牌津贴（开卷有益 / 卡运亨通）
    if (p.hex && p.hex.cardGain) {
      p.cash += p.hex.cardGain;
      this.ev({ t: 'money', pid: p.id, amount: p.hex.cardGain, reason: '项目·卡牌津贴' });
    }
    // 专业：艺术 · 灵感迸发（抽到正面机会卡额外 +¥730）
    if (type === 'chance' && p.major === 'lang' && p.skillLeft > 0 && !this.isBadCard(card) && card.kind !== 'each') {
      p.skillLeft--; p.cash += 820;
      this.addLog(`🌍 ${p.name} 发动【多语种优势】+¥820`);
      this.ev({ t: 'skill', pid: p.id, major: 'lang', name: '多语种优势', detail: '+¥820' });
      this.ev({ t: 'money', pid: p.id, amount: 820, reason: '多语种优势' });
    }
    if (type === 'chance' && p.major === 'art' && p.skillLeft > 0 && !this.isBadCard(card) && card.kind !== 'each') {
      p.skillLeft--; p.cash += 730;
      this.addLog(`🎨 ${p.name} 发动【灵感迸发】+¥730`);
      this.ev({ t: 'skill', pid: p.id, major: 'art', name: '灵感迸发', detail: '+¥730' });
      this.ev({ t: 'money', pid: p.id, amount: 730, reason: '灵感迸发' });
    }
    // 专业：戏剧 · 全场入戏（抽到任意机会/命运卡时额外 +¥460）
    if (p.major === 'drama' && p.skillLeft > 0) {
      p.skillLeft--; p.cash += 460;
      this.addLog(`🎭 ${p.name} 发动【全场入戏】+¥460`);
      this.ev({ t: 'skill', pid: p.id, major: 'drama', name: '全场入戏', detail: '+¥460' });
      this.ev({ t: 'money', pid: p.id, amount: 460, reason: '全场入戏' });
    }
    // v5.2 书香校区：每抽到一张机会卡额外 +¥250
    if (this.facIs('book') && type === 'chance') {
      p.cash += 250;
      this.addLog(`📚 【书香校区】${p.name} 抽到机会卡，额外 +¥250`);
      this.ev({ t: 'money', pid: p.id, amount: 250, reason: '书香校区' });
    }
    // v5.3：通用被动 —— 抽卡收益（cardAny 任意卡；cardPos 仅正面机会卡）
    {
      const cmj = MAJORS[p.major] || {};
      let amt = 0;
      if (cmj.cardAny && p.skillLeft > 0) amt = cmj.cardAny;
      else if (cmj.cardPos && type === 'chance' && p.skillLeft > 0 && !this.isBadCard(card) && card.kind !== 'each') amt = cmj.cardPos;
      if (amt > 0) {
        p.skillLeft--; p.cash += amt;
        this.addLog(`${cmj.icon} ${p.name} 发动【${cmj.skill}】+¥${amt}`);
        this.ev({ t: 'skill', pid: p.id, major: p.major, name: cmj.skill, detail: `+¥${amt}` });
        this.ev({ t: 'money', pid: p.id, amount: amt, reason: cmj.skill });
      }
    }
    this.applyCard(p, card, type);
  }
  isBadCard(c) {
    if (!c) return false;
    const badKinds = ['skip', 'sabotage', 'demolishLand', 'demolishHouse', 'selfLoseLand', 'selfLoseHouse', 'jailSelf', 'taxAll', 'richPayPool', 'richPayPct', 'pctLose', 'loseCard'];
    if (badKinds.includes(c.kind)) return true;
    if (c.kind === 'majorSwitch' && !c.good) return true;
    if (c.kind === 'stepQueue' && c.steps < 0) return true;
    if (c.kind === 'money' && c.amount < 0) return true;
    if (c.kind === 'move' && c.steps < 0) return true;
    if (c.kind === 'each' && c.dir === 'out') return true;
    return false;
  }
  // 某玩家持有的「地产类」地块（可盖房）数量 / 建筑总级数
  propCells(p) { return BOARD.map((c, i) => i).filter(i => BOARD[i].type === 'prop' && this.cells[i].own === p.id); }
  buildSum(p) { return this.propCells(p).reduce((s, i) => s + this.cells[i].level, 0); }
  aliveList() { return this.players.filter(q => q.alive); }
  // v5.1：法学 · 法律援助 / 哲学 · 批判思维：抵消一次不利判定
  // v5.3：通用化 —— 任何带 immuneN 的专业都走这里
  immune(p, why) {
    // v5.7：研究项目的免疫（绝对防御 = 限次；学术保护 = 限次加成）优先于专业技能次数
    const hx = p ? (p.hex || {}) : {};
    if ((hx.immuneCharges || 0) > 0) {
      hx.immuneCharges--;
      this.hexFx(p, 'aegis', `绝对防御：免除「${why}」（剩 ${hx.immuneCharges} 次）`);
      return true;
    }
    if ((hx.immuneBonus || 0) > 0) {
      hx.immuneBonus--;
      this.hexFx(p, 'patron', `学术保护：免除「${why}」`);
      return true;
    }
    if (!p || p.skillLeft <= 0) return false;
    const mj = MAJORS[p.major] || {};
    const ok = (p.major === 'law' || p.major === 'phil') || (mj.immuneN > 0);
    if (!ok) return false;
    p.skillLeft--;
    this.addLog(`${mj.icon} ${p.name} 发动【${mj.skill}】，免除「${why}」`);
    this.ev({ t: 'skill', pid: p.id, major: p.major, name: mj.skill, detail: `免除「${why}」` });
    return true;
  }
  // v5.1：土木工程 · 基建加固 —— 自己的地产免于被拆除（消耗 1 次）
  // v5.3：通用化 —— 带 noDemolish 的专业常驻免拆（不消耗次数）
  landImmune(p, why) {
    if (!p) return false;
    const mj = MAJORS[p.major] || {};
    if (mj.noDemolish) {
      this.addLog(`${mj.icon} ${p.name} 的【${mj.skill}】护住了「${why}」`);
      this.ev({ t: 'skill', pid: p.id, major: p.major, name: mj.skill, detail: `常驻·免除「${why}」` });
      return true;
    }
    if (p.major !== 'civil' || p.skillLeft <= 0) return false;
    p.skillLeft--;
    this.addLog(`${mj.icon} ${p.name} 发动【基建加固】，保住了「${why}」`);
    this.ev({ t: 'skill', pid: p.id, major: 'civil', name: '基建加固', detail: `免除「${why}」` });
    return true;
  }
  applyCard(p, card, type) {
    switch (card.kind) {
      case 'money': {
        const amt = this.facCardMoney(card.amount, type);   // v5.2：校园风貌修正（综合/理工/科技园/国际/书香）
        if (amt >= 0) { p.cash += amt; this.ev({ t: 'money', pid: p.id, amount: amt, reason: card.name }); this.afterResolve(p, false); }
        else {
          this.ev({ t: 'charge', pid: p.id, amount: -amt, creditor: null, reason: card.name, cell: p.pos, toPool: false });
          this._afterMove = card.thenMove || null;
          const ok = this.tryPay(p, -amt, null, false);
          if (ok && this._afterMove) { const mv = this._afterMove; this._afterMove = null; this.doCardMove(p, mv); }
        }
        return;
      }
      case 'moveTo': {
        p.pos = card.cell;
        if (card.salary) {
          if (this.salaryOn()) { this.payWage(p); }
          else this.addLog(`❄️ 经济寒冬：银行停发工资，${p.name} 没领到钱`);
        }
        this.ev({ t: 'teleport', pid: p.id, cell: card.cell });
        this.resolveCell(p);
        return;
      }
      case 'move': { this.doCardMove(p, card.steps); return; }
      case 'each': {
        const others = this.players.filter(q => q.alive && q.id !== p.id);
        if (card.dir === 'in') {
          let total = 0;
          for (const q of others) { const pay = Math.min(q.cash, card.amount); q.cash -= pay; q.combo = 0; total += pay; }
          p.cash += total;
          this.addLog(`${p.name} 从每位玩家处收到共 ¥${total}`);
          this.ev({ t: 'each', pid: p.id, amount: total, dir: 'in' });
        } else {
          for (const q of others) {
            const pay = Math.min(q.cash, card.amount);
            q.cash -= pay; q.combo = 0; p.cash += pay;
            this.ev({ t: 'charge', pid: q.id, amount: pay, creditor: p.id, reason: card.name, cell: p.pos, toPool: false });
            this.ev({ t: 'paid', pid: q.id, amount: pay, creditor: p.id, toPool: false });
          }
        }
        this.afterResolve(p, false); return;
      }
      case 'skip': {   // v5.2：免停留卡可抵消（只对纯惩罚性停留生效）
        const st = this.applyStay(p, 1, card.name);
        this.addLog(`${p.name} 因「${card.name}」${st ? '停留一回合' : '—— 免停留卡已抵消'}`);
        this.afterResolve(p, false); return;
      }
      case 'discount': {
        p.discount = true;
        this.addLog(`${p.name} 获得 8 折购地卡（本轮有效）`);
        // 立即询问是否就地使用？简化：仅标记，下次踩到无主地时生效；若本轮不踩则作废
        this.afterResolve(p, false); return;
      }
      case 'moveAnyTrans': {
        const trans = BOARD.map((c, i) => ({ c, i })).filter(({ c }) => c.type === 'transport');
        const t = pick(trans);
        p.pos = t.i;
        this.ev({ t: 'teleport', pid: p.id, cell: t.i });
        this.resolveCell(p); return;
      }
      case 'medal': { p.medal++; this.afterResolve(p, false); return; }   // v5.8：免租券并入免租金卡
      case 'bounty': {   // 悬赏令：向当前最富有的玩家索取赏金
        const others = this.alive().filter(q => q.id !== p.id);
        if (!others.length) { this.afterResolve(p, false); return; }
        const rich = others.slice().sort((x, y) => this.netWorth(y) - this.netWorth(x))[0];
        const pay = Math.max(0, Math.min(card.amount, rich.cash));
        rich.cash -= pay; p.cash += pay; rich.combo = 0;
        this.addLog(`📢 ${p.name} 发布悬赏，向最富有的 ${rich.name} 收取 ¥${pay}`);
        this.ev({ t: 'charge', pid: rich.id, amount: pay, creditor: p.id, reason: '悬赏令', cell: p.pos, toPool: false });
        this.ev({ t: 'paid', pid: rich.id, amount: pay, creditor: p.id, toPool: false });
        this.afterResolve(p, false); return;
      }
      case 'sabotage': { // 陷害：随机一名对手下回合移动受损
        const foes = this.alive().filter(q => q.id !== p.id);
        if (foes.length) {
          const t = pick(foes);
          if (this.immune(t, '被人陷害')) { this.afterResolve(p, false); return; }
          t.sabotage = (t.sabotage || 0) + card.steps;
          this.addLog(`😈 ${p.name} 暗中操作，${t.name} 下回合移动 ${card.steps} 格`);
        }
        this.afterResolve(p, false); return;
      }
      case 'demolishLand': {   // v5.1：真随机选人，但优先拆没盖房的、房子少的地皮
        const cand = this.aliveList().filter(q => this.propCells(q).length > 0);
        if (!cand.length) { this.addLog('全场没有可拆的地皮，卡牌作废'); this.afterResolve(p, false); return; }
        const t = pick(cand);                                   // 真随机：每位有地的玩家等概率被选中
        if (this.immune(t, '校园改造拆地') || this.landImmune(t, '校园改造拆地')) { this.afterResolve(p, false); return; }
        const all = this.propCells(t);
        const minLv = Math.min(...all.map(i => this.cells[i].level));
        const pool = all.filter(i => this.cells[i].level === minLv);   // 优先拆没盖房的，其次房子最少的
        const ci = pick(pool);                                  // 在候选里真随机
        const cn = BOARD[ci].name;
        this.cells[ci].own = null; this.cells[ci].level = 0; this.cells[ci].mortgaged = false; this.cells[ci].mortgageAt = 0;
        this.addLog(`🏗️ 【校园改造】${t.name} 的「${cn}」被拆除，地块归还银行`);
        this.ev({ t: 'demolish', pid: t.id, cell: ci, kind: 'land', name: cn });
        this.afterResolve(p, false); return;
      }
      case 'demolishHouse': {  // 房子最多的人被拆掉一栋房（v5.1：确认只拆一栋，且优先拆等级低的）
        const cand = this.aliveList().filter(q => this.buildSum(q) > 0);
        if (!cand.length) { this.addLog('全场没有可拆的房子，卡牌作废'); this.afterResolve(p, false); return; }
        const maxN = Math.max(...cand.map(q => this.buildSum(q)));
        const poolP = cand.filter(q => this.buildSum(q) === maxN);
        const t = pick(poolP);
        if (this.immune(t, '违建拆除') || this.landImmune(t, '违建拆除')) { this.afterResolve(p, false); return; }
        const cells = this.propCells(t).filter(i => this.cells[i].level > 0);
        const minLv = Math.min(...cells.map(i => this.cells[i].level));
        const ci = pick(cells.filter(i => this.cells[i].level === minLv));
        this.cells[ci].level--;                                 // 只拆一栋
        this.addLog(`🚧 【违建举报】${t.name} 的「${BOARD[ci].name}」被拆掉一栋房（现 Lv${this.cells[ci].level}）`);
        this.ev({ t: 'demolish', pid: t.id, cell: ci, kind: 'house', level: this.cells[ci].level, name: BOARD[ci].name });
        this.afterResolve(p, false); return;
      }
      case 'selfLoseLand': {   // 自己失去一块地皮（v5.1：优先失去没盖房的）
        const cells = this.propCells(p);
        if (!cells.length) { this.addLog('你名下没有可卖的地皮，卡牌作废'); this.afterResolve(p, false); return; }
        if (this.immune(p, '变卖地皮') || this.landImmune(p, '变卖地皮')) { this.afterResolve(p, false); return; }
        const minLv = Math.min(...cells.map(i => this.cells[i].level));
        const ci = pick(cells.filter(i => this.cells[i].level === minLv));
        this.cells[ci].own = null; this.cells[ci].level = 0; this.cells[ci].mortgaged = false; this.cells[ci].mortgageAt = 0;
        this.addLog(`📉 ${p.name} 变卖资产，「${BOARD[ci].name}」归还银行`);
        this.ev({ t: 'demolish', pid: p.id, cell: ci, kind: 'land', self: true, name: BOARD[ci].name });
        this.afterResolve(p, false); return;
      }
      case 'selfLoseHouse': {
        const cells = this.propCells(p).filter(i => this.cells[i].level > 0);
        if (!cells.length) { this.addLog('你名下没有可拆的房子，卡牌作废'); this.afterResolve(p, false); return; }
        if (this.immune(p, '房子失修拆除') || this.landImmune(p, '房子失修拆除')) { this.afterResolve(p, false); return; }
        const minLv = Math.min(...cells.map(i => this.cells[i].level));
        const ci = pick(cells.filter(i => this.cells[i].level === minLv));   // v5.1：只拆一栋，随机在最低等级里选
        this.cells[ci].level--;
        this.addLog(`💥 ${p.name} 的「${BOARD[ci].name}」年久失修被拆除（现 Lv${this.cells[ci].level}）`);
        this.ev({ t: 'demolish', pid: p.id, cell: ci, kind: 'house', self: true, level: this.cells[ci].level, name: BOARD[ci].name });
        this.afterResolve(p, false); return;
      }
      case 'selfBuild': {      // 免费给自己盖一栋房（v5.1：随机挑一块可加盖的地皮）
        const cells = this.propCells(p).filter(i => this.cells[i].level < 4);
        if (!cells.length) { this.addLog('没有可加盖的地皮，卡牌作废'); this.afterResolve(p, false); return; }
        const ci = pick(cells);
        this.cells[ci].level++;
        const hotel = this.cells[ci].level === 4;
        this.addLog(`🎁 ${p.name} 白得施工队，「${BOARD[ci].name}」升到 Lv${this.cells[ci].level}${hotel ? ' —— 旅馆落成！' : ''}`);
        this.ev({ t: 'cardBuild', pid: p.id, cell: ci, level: this.cells[ci].level, hotel });
        this.afterResolve(p, false); return;
      }
      case 'poorestBuild': {   // 房子最少的人免费盖一栋房（v5.1：随机挑一块可加盖的地皮）
        const cand = this.aliveList().filter(q => this.propCells(q).some(i => this.cells[i].level < 4));
        if (!cand.length) { this.addLog('没有可加盖的地皮，卡牌作废'); this.afterResolve(p, false); return; }
        const minN = Math.min(...cand.map(q => this.buildSum(q)));
        const pool = cand.filter(q => this.buildSum(q) === minN);
        const t = pick(pool);
        const ci = pick(this.propCells(t).filter(i => this.cells[i].level < 4));
        this.cells[ci].level++;
        const hotel = this.cells[ci].level === 4;
        this.addLog(`🤝 房子最少的 ${t.name} 获得学弟学妹帮忙，「${BOARD[ci].name}」升到 Lv${this.cells[ci].level}${hotel ? ' —— 旅馆落成！' : ''}`);
        this.ev({ t: 'cardBuild', pid: t.id, cell: ci, level: this.cells[ci].level, hotel, help: true });
        this.afterResolve(p, false); return;
      }
      case 'taxAll': {         // 全体各支付 X 进基金池
        let sum = 0;
        for (const q of this.aliveList()) {
          const pay = Math.min(q.cash, card.amount);
          q.cash -= pay; q.combo = 0; sum += pay;
          this.ev({ t: 'charge', pid: q.id, amount: pay, creditor: null, reason: card.name, cell: q.pos, toPool: true });
          this.ev({ t: 'paid', pid: q.id, amount: pay, creditor: null, toPool: true });
        }
        this.addToFund(sum);
        this.addLog(`🧾 ${card.name}：全体共缴 ¥${sum} 进教育基金池`);
        this.afterResolve(p, false); return;
      }
      case 'jailSelf': {
        if (this.immune(p, '入狱')) { this.afterResolve(p, false); return; }
        // v5.10：挂科保险（免于留级）
        if (p.hex && (p.hex.jailFree || 0) > 0) {
          p.hex.jailFree--;
          this.hexFx(p, 'keychain', `挂科保险生效（剩 ${p.hex.jailFree} 次）`);
          this.addLog(`🔑 ${p.name} 的挂科保险生效，免于「${card.name}」留级`);
          this.ev({ t: 'gojail', pid: p.id, cell: p.pos, stayed: false });
          this.afterResolve(p, false); return;
        }
        const st2 = this.applyStay(p, 1, card.name);   // v5.2：免停留卡可抵消
        this.addLog(`🚔 ${p.name} ${card.name}，${st2 ? '挂科留级反省一回合' : '—— 免停留卡已抵消'}`);
        this.ev({ t: 'gojail', pid: p.id, cell: p.pos, stayed: st2 });
        this.afterResolve(p, false); return;
      }
      case 'poorestMoney': {   // 翻盘：总资产最低的玩家获得资助
        const aliveP = this.aliveList();
        if (aliveP.length > 1) {
          const poor = aliveP.slice().sort((x, y) => this.netWorth(x) - this.netWorth(y))[0];
          poor.cash += card.amount;
          this.addLog(`🎁 ${card.name}：总资产垫底的 ${poor.name} 获得 ¥${card.amount}`);
          this.ev({ t: 'money', pid: poor.id, amount: card.amount, reason: card.name });
        }
        this.afterResolve(p, false); return;
      }
      case 'poorestEach': {    // 翻盘：总资产最低的玩家向其他每位玩家收帮扶金
        const aliveE = this.aliveList();
        if (aliveE.length > 1) {
          const poor = aliveE.slice().sort((x, y) => this.netWorth(x) - this.netWorth(y))[0];
          let sum = 0;
          for (const q of aliveE) {
            if (q.id === poor.id) continue;
            const pay = Math.min(q.cash, card.amount);
            if (pay <= 0) continue;
            q.cash -= pay; q.combo = 0; poor.cash += pay; sum += pay;
            this.ev({ t: 'charge', pid: q.id, amount: pay, creditor: poor.id, reason: card.name, cell: q.pos });
            this.ev({ t: 'paid', pid: q.id, amount: pay, creditor: poor.id });
          }
          if (sum > 0) {
            this.addLog(`🤝 ${card.name}：总资产垫底的 ${poor.name} 收到帮扶金 ¥${sum}`);
            this.ev({ t: 'money', pid: poor.id, amount: sum, reason: card.name });
          }
        }
        this.afterResolve(p, false); return;
      }
      case 'richPayPool': {    // 首富税：总资产最高的玩家向基金池付款（现金不够会进入筹钱流程，可能被逼破产）
        const aliveR = this.aliveList();
        if (aliveR.length > 1) {
          const rich = aliveR.slice().sort((x, y) => this.netWorth(y) - this.netWorth(x))[0];
          if (this.immune(rich, card.name)) { this.afterResolve(p, false); return; }
          this.addLog(`💣 ${card.name}：总资产最高的 ${rich.name} 需向教育基金池支付 ¥${card.amount}`);
          if (rich.cash >= card.amount) {
            rich.cash -= card.amount; this.addToFund(card.amount);
            this.ev({ t: 'charge', pid: rich.id, amount: card.amount, creditor: null, reason: card.name, cell: rich.pos, toPool: true });
            this.ev({ t: 'paid', pid: rich.id, amount: card.amount, creditor: null, toPool: true });
            this.afterResolve(p, false);
          } else {
            this.dice = null;   // 付款方≠抽卡者时，不能让"双数再掷"落到付款方头上
            this.phase = 'raise';
            this.raise = { pid: rich.id, need: card.amount, creditor: null, toPool: true };
            this.addLog(`${rich.name} 现金不足（还差 ¥${card.amount - rich.cash}），请抵押地产或卖房筹钱（30 秒）`);
            this.ev({ t: 'ask_raise', pid: rich.id, need: card.amount - rich.cash, amount: card.amount });
            this.setTimer(TURN_MS, () => this.forceSettleRaise());
            if (rich.isAI) this.aiTimers.push(setTimeout(() => this.aiRaise(), 3200));
          }
          return;
        }
        this.afterResolve(p, false); return;
      }
      case 'richPayPct': {     // 首富税：按总资产/现金比例缴纳
        const aliveC = this.aliveList();
        if (aliveC.length > 1) {
          const rich = aliveC.slice().sort((x, y) => this.netWorth(y) - this.netWorth(x))[0];
          if (this.immune(rich, card.name)) { this.afterResolve(p, false); return; }
          const baseVal = card.base === 'cash' ? rich.cash : this.netWorth(rich);
          const amount = Math.max(0, Math.round(baseVal * card.pct / 100));
          if (amount > 0) {
            this.addLog(`💣 ${card.name}：总资产最高的 ${rich.name} 需缴纳 ¥${amount} 进教育基金池`);
            if (rich.cash >= amount) {
              rich.cash -= amount; this.addToFund(amount);
              this.ev({ t: 'charge', pid: rich.id, amount, creditor: null, reason: card.name, cell: rich.pos, toPool: true });
              this.ev({ t: 'paid', pid: rich.id, amount, creditor: null, toPool: true });
              this.afterResolve(p, false);
            } else {
              this.dice = null;
              this.phase = 'raise';
              this.raise = { pid: rich.id, need: amount, creditor: null, toPool: true };
              this.addLog(`${rich.name} 现金不足（还差 ¥${amount - rich.cash}），请抵押地产或卖房筹钱（30 秒）`);
              this.ev({ t: 'ask_raise', pid: rich.id, need: amount - rich.cash, amount });
              this.setTimer(TURN_MS, () => this.forceSettleRaise());
              if (rich.isAI) this.aiTimers.push(setTimeout(() => this.aiRaise(), 3200));
            }
            return;
          }
        }
        this.afterResolve(p, false); return;
      }
      // ---------- v5.1：新增玩法 ----------
      case 'majorSwitch': {     // 转专业：随机换一个专业，技能次数重置
        const oldM = p.major;
        let nm = pick(MAJOR_KEYS);
        if (nm === oldM) nm = pick(MAJOR_KEYS.filter(k => k !== oldM));
        p.major = nm;
        p.skillLeft = MAJORS[nm].uses;
        p.rentBuff = 0; p.defBuff = 0; p.buildCutTurn = 0; p.autoBonus = false;
        this.addLog(`${card.good ? '🎉' : '🌀'} ${p.name} ${card.good ? '转专业成功' : '被强制转专业'}：${MAJORS[oldM].name} → ${MAJORS[nm].name}（技能次数重置为 ${MAJORS[nm].uses}）`);
        this.ev({ t: 'major_switch', pid: p.id, from: oldM, to: nm, good: !!card.good });
        this.afterResolve(p, false); return;
      }
      case 'drawCards': {       // 抽效果卡（校园商城同款卡池）
        const n = card.n || this.rollCardCount();
        this.grantCards(p, p.pos, n, card.name);
        this.afterResolve(p, false); return;
      }
      case 'stepQueue': {       // 接下来若干次移动各 +N 步
        const times = card.times || 2, stp = card.steps || 2;
        for (let i = 0; i < times; i++) p.stepBuffs.push(stp);
        this.addLog(`👟 ${card.name}：接下来 ${times} 次移动各 +${stp} 步`);
        this.ev({ t: 'buff', pid: p.id, steps: stp, left: p.stepBuffs.length, queue: true });
        this.afterResolve(p, false); return;
      }
      case 'pctGain': {         // 按当前现金比例增收（有上限）
        const gain = this.facCardMoney(Math.min(card.cap || 99999, Math.round(p.cash * (card.pct || 0.1))), type);
        p.cash += gain;
        this.addLog(`📈 ${card.name}：+¥${gain}（现金的 ${Math.round((card.pct || 0.1) * 100)}%，上限 ¥${card.cap || 99999}）`);
        this.ev({ t: 'money', pid: p.id, amount: gain, reason: card.name });
        this.checkRichest(p);
        this.afterResolve(p, false); return;
      }
      case 'pctLose': {         // 按当前现金比例损失（有上限，进教育基金池）
        const rawLose = Math.min(card.cap || 99999, Math.round(p.cash * (card.pct || 0.1)));
        const lose = -this.facCardMoney(-rawLose, type);   // v5.2：风貌修正（可能少损或加重）
        if (lose <= 0) { this.afterResolve(p, false); return; }
        this.addLog(`📉 ${card.name}：损失 ¥${lose}（现金的 ${Math.round((card.pct || 0.1) * 100)}%）`);
        this.charge(p, lose, null, card.name, p.pos, true);
        return;
      }
      case 'loseCard': {        // 失去一张效果卡（免租金卡优先）
        if (p.medal > 0) { p.medal--; this.addLog(`🎫 ${p.name} 的「免租金卡」被系统回收`); this.ev({ t: 'medal', pid: p.id, cell: p.pos, lost: true }); }
        else if (p.voucher > 0) { p.voucher--; this.addLog(`🎟️ ${p.name} 的「免租券」被系统回收`); this.ev({ t: 'voucher', pid: p.id, cell: p.pos, lost: true }); }
        else if (p.shield) { p.shield = false; this.addLog(`🛡️ ${p.name} 的「免罚符」失效了`); this.ev({ t: 'shield', pid: p.id, cell: p.pos, lost: true }); }
        else this.addLog(`${p.name} 身上没有可回收的卡，${card.name}落空`);
        this.afterResolve(p, false); return;
      }
      default: this.afterResolve(p, false);
    }
  }
  doCardMove(p, steps) {
    const path = [];
    let pos = p.pos, passedGo = false;
    for (let i = 0; i < Math.abs(steps); i++) {
      pos = (pos + (steps > 0 ? 1 : 47)) % 48;
      path.push(pos);
      if (steps > 0 && pos === 0) passedGo = true;
    }
    p.pos = pos;
    if (passedGo && this.salaryOn()) {
      this.payWage(p);
      this.applyGoSkills(p);
    }
    this.ev({ t: 'move', pid: p.id, path, final: pos });
    this.resolveCell(p);
  }
  // v5.3：通用「回合开始」被动 —— 每轮固定补贴 / 现金流百分比 / 恶劣天气红利。
  // 每个专业最多命中一条，命中即消耗 1 次技能次数，避免一回合被薅多次。
  applyTurnStartPassives(p) {
    const mj = MAJORS[p.major] || {};
    if (!mj || p.skillLeft <= 0) return;
    let gain = 0, tag = '';
    if (mj.turnCash) { gain = mj.turnCash; tag = '每轮补贴'; }
    else if (mj.turnPct && p.cash > 0) { gain = Math.round(p.cash * mj.turnPct); tag = '现金流滚存'; }
    else if (mj.weather && (mj.weather.kinds || []).includes(this.weather)) { gain = mj.weather.amt; tag = '天气红利'; }
    if (gain <= 0) return;
    p.skillLeft--; p.cash += gain;
    this.addLog(`${mj.icon || '✨'} ${p.name} 发动【${mj.skill}】+¥${gain}（${tag}）`);
    this.ev({ t: 'skill', pid: p.id, major: p.major, name: mj.skill, detail: `+¥${gain} · ${tag}` });
    this.ev({ t: 'money', pid: p.id, amount: gain, reason: mj.skill });
  }
  // v5.1：经过起点的专业被动（微电子/农学/海洋科学 消耗次数；新能源为常驻）
  applyGoSkills(p) {
    const GO_SKILL = { ee: ['信号增益', 1250], agri: ['春华秋实', 1350], marine: ['深海资源', 1100] };
    if (GO_SKILL[p.major] && p.skillLeft > 0) {
      const [nm, amt] = GO_SKILL[p.major];
      p.skillLeft--; p.cash += amt;
      this.addLog(`${MAJORS[p.major].icon} ${p.name} 发动【${nm}】+¥${amt}`);
      this.ev({ t: 'skill', pid: p.id, major: p.major, name: nm, detail: `+¥${amt}` });
      this.ev({ t: 'money', pid: p.id, amount: amt, reason: nm });
    }
    if (p.major === 'newe') {
      p.cash += 900;
      this.addLog(`🔋 ${p.name} 的光伏阵列并网发电，+¥900（常驻）`);
      this.ev({ t: 'money', pid: p.id, amount: 900, reason: '光伏增益' });
    }
    // v5.3：通用被动 —— 经过起点收益（salary.amt；use=true 消耗 1 次，false 常驻）
    const mj = MAJORS[p.major] || {};
    if (mj.salary) {
      const always = !mj.salary.use;
      if (always || p.skillLeft > 0) {
        if (!always) p.skillLeft--;
        p.cash += mj.salary.amt;
        this.addLog(`${mj.icon || '✨'} ${p.name} 发动【${mj.skill}】+¥${mj.salary.amt}${always ? '（常驻）' : ''}`);
        this.ev({ t: 'skill', pid: p.id, major: p.major, name: mj.skill, detail: `+¥${mj.salary.amt}` });
        this.ev({ t: 'money', pid: p.id, amount: mj.salary.amt, reason: mj.skill });
      }
    }
    // v5.7：研究项目 —— 过起点加成（勤工俭学 / 涨薪合同），常驻不耗次数
    if (p.hex && p.hex.goCash && this.hexKeyWith(p, 'goCash')) {
      p.cash += p.hex.goCash;
      this.ev({ t: 'money', pid: p.id, amount: p.hex.goCash, reason: '项目·过起点津贴' });
      for (const key of (p.hexList || [])) {   // v5.13：限次项目按次消耗
        const pr = PROJECTS[key];
        if (pr && pr.charges && pr.mods && pr.mods.goCash !== undefined) this.hexSpend(p, key);
      }
    }
  }

  // ---------- 投票结束 ----------
  requestEnd(p) {
    if (this.phase !== 'roll' && this.phase !== 'build' && this.phase !== 'buy') return;
    this.vote = { asker: p.id, votes: { [p.id]: true } };
    this.addLog(`${p.name} 发起"结束游戏"投票，需全体同意`);
    this.ev({ t: 'vote_start', pid: p.id });
    for (const q of this.alive()) if (q.isAI) this.aiTimers.push(setTimeout(() => this.aiVote(q), rnd(3000, 6800)));
    this.checkVote();
  }
  voteEnd(p, yes) {
    if (!this.vote) return;
    this.vote.votes[p.id] = !!yes;
    this.checkVote();
  }
  checkVote() {
    if (!this.vote) return;
    const alive = this.alive();
    if (alive.every(q => this.vote.votes[q.id] === true)) this.settleEnd();
    else if (alive.every(q => this.vote.votes[q.id] !== undefined)) {
      this.addLog(`投票未通过，游戏继续`);
      this.ev({ t: 'vote_no' });
      this.vote = null;
    }
  }
  netWorth(p) {
    let v = p.cash;
    BOARD.forEach((c, i) => {
      const cs = this.cells[i];
      if (cs.own !== p.id) return;
      if (cs.mortgaged) v += Math.floor(c.price / 2);
      else { v += c.price + (cs.type === 'prop' ? cs.level * GROUPS[c.g].build : 0); }
    });
    return v;
  }
  settleEnd() {
    const ranked = this.alive().map(p => ({ p, v: this.netWorth(p) })).sort((a, b) => b.v - a.v);
    this.phase = 'over';
    ranked[0].p.wins++;
    this.addLog(`🤝 全体同意结束。${ranked[0].p.name} 以总资产 ¥${ranked[0].v} 获胜！`);
    this.ev({ t: 'gameover', winner: ranked[0].p.id, ranked: ranked.map(r => ({ pid: r.p.id, v: r.v })) });
  }

  // ---------- 拟人 AI ----------
  safety(p) {
    // 动态现金安全线：越到后期/威胁越大，越要留钱
    const threat = BOARD.reduce((s, c, i) => s + (this.cells[i].own && this.cells[i].own !== p.id && !this.cells[i].mortgaged && this.cells[i].level >= 2 ? 1 : 0), 0);
    return 6000 + threat * 900;
  }
  aiAct() {
    const p = this.curp();
    if (!p || !p.isAI || p.id !== this.curp().id) return;
    if (this.phase === 'roll') this.doRoll(p);
  }
  aiBuy() {
    const pb = this.pendingBuy; if (!pb) return;
    const p = this.players.find(q => q.id === pb.pid);
    if (!p || !p.isAI) return;
    const cell = pb.cell, c = BOARD[cell];
    const price = (pb.price != null) ? pb.price : c.price;
    const safety = this.safety(p);
    // 威胁评估：这地被别人买走对我最疼 → 更愿意买
    let maxPrice = price;
    if (c.type === 'prop') {
      const myInGroup = this.groupCells(c.g).filter(i => this.cells[i].own === p.id).length;
      if (myInGroup >= 1) maxPrice = price * 1.4; // 凑组关键地
    }
    const canPay = p.cash - price >= safety * (c.type === 'prop' ? 0.55 : 0.75);
    if ((p.cash >= price && canPay) || (pb.mortgageBuy && p.cash >= price)) this.buy(p);
    else this.declineBuy(p);
  }
  aiBuild() {
    const pb = this.pendingBuild; if (!pb) return;
    const p = this.players.find(q => q.id === pb.pid);
    if (!p || !p.isAI) return;
    const cs = this.cells[pb.cell], c = BOARD[pb.cell];
    if (c.type !== 'prop') { this.skipBuild(p); return; }
    const cost = (pb.cost != null) ? pb.cost : GROUPS[c.g].build;
    // 领先时更激进，落后时保守
    const others = this.alive().filter(q => q.id !== p.id);
    const myNW = this.netWorth(p);
    const avgNW = others.reduce((s, q) => s + this.netWorth(q), 0) / Math.max(1, others.length);
    const lead = myNW / Math.max(1, avgNW);
    const need = this.safety(p) * (lead > 1.2 ? 0.5 : 0.85);
    if (p.cash - cost >= need && cs.level < 4) this.build(p);
    else if (cs.level < 4) {
      // 钱不够但有闲置地：抵押最便宜的一块凑钱升级（保留安全垫，且不抵押当前要升级的这块）
      const cand = BOARD.map((c2, i2) => ({ c: c2, i: i2 }))
        .filter(({ c: c2, i }) => this.cells[i].own === p.id && !this.cells[i].mortgaged && i !== pb.cell)
        .sort((a, b) => a.c.price - b.c.price)
        .find(({ c: c2 }) => p.cash + Math.floor(c2.price / 2) - cost >= need);
      if (cand) {
        this.mortgage(p, cand.i);
        if (p.cash - cost >= need && !this.cells[pb.cell].mortgaged) this.build(p);
        else if (this.phase === 'build') this.skipBuild(p);
      } else this.skipBuild(p);
    }
    else this.skipBuild(p);
  }
  aiBid(p) {
    if (this.phase !== 'auction' || !this.auction || !p.alive) return;
    const a = this.auction, c = BOARD[a.cell];
    if (a.bidder === p.id) return;
    const already = a.maxBid[p.id];
    if (already === undefined) {
      let cap = c.price * rnd(1.2, 1.5);
      if (c.type === 'prop') {
        const myInGroup = this.groupCells(c.g).filter(i => this.cells[i].own === p.id).length;
        const oppInGroup = this.groupCells(c.g).filter(i => this.cells[i].own && this.cells[i].own !== p.id).length;
        if (myInGroup >= 2) cap *= 1.5;           // 就差这一块
        else if (oppInGroup >= 2) cap *= 1.35;     // 绝不能让对手凑齐
      }
      if (this.netWorth(p) < this.alive().reduce((s, q) => s + this.netWorth(q), 0) / this.alive().length) cap *= 0.85; // 落后略保守
      a.maxBid[p.id] = Math.min(Math.floor(cap), p.cash - this.safety(p) * 0.4);
    }
    const cap = a.maxBid[p.id];
    const next = Math.min(cap, (a.highest || Math.floor(c.price * 0.1)) + 100 * Math.ceil(rnd(100, 500) / 100));
    if (next > a.highest && next <= cap && next <= p.cash) this.bid(p, next);
  }
  aiRaise() {
    if (this.phase !== 'raise' || !this.raise) return;
    const p = this.players.find(q => q.id === this.raise.pid);
    if (!p || !p.isAI) return;
    let guard = 0;
    while (this.raise && p.cash < this.raise.need && guard++ < 60) {
      const cand = BOARD.map((c, i) => ({ c, i })).filter(({ c, i }) => this.cells[i].own === p.id && !this.cells[i].mortgaged)
        .sort((a, b) => b.c.price - a.c.price)[0];
      if (!cand) break;
      const before = p.cash;
      this.mortgage(p, cand.i);                 // 内部筹够会自动结算并清空 raise
      if (p.cash <= before || this.phase !== 'raise') break;  // 无进展/已结算 → 立刻退出，防死循环
    }
    if (!this.raise) return;                    // 已在 mortgage 内结算完毕
    if (p.cash < this.raise.need) this.bankrupt(p, (this.raise.creditor != null) ? this.players.find(q => q.id === this.raise.creditor) : null);
    else this.settleRaise();
  }
  aiVote(p) {
    if (!this.vote || this.vote.votes[p.id] !== undefined) return;
    const asker = this.players.find(q => q.id === this.vote.asker);
    const myNW = this.netWorth(p);
    const best = Math.max(...this.alive().map(q => this.netWorth(q)));
    this.voteEnd(p, asker.id !== p.id ? myNW >= best : true);
  }
}

module.exports = { Room, BOARD, GROUPS, CHANCE, FATE, SALARY, START_CASH, SEASON, SEASON_ORDER, WEATHER, CALEVENTS, MAJORS, MAJOR_KEYS, ACHS, ITEMS, EFFECT_CARDS, FUND_CAP, ENDGAME_ROUND, REROLL_COST, BRANCH, BRANCH2, FACULTY, FACULTY_KEYS, FACULTY_VOTE_MS, PCOLOR, PROJECTS, EXPIRY_STIPEND, HEX_TIERS, PROJECT_KEYS, HEX_TRIGGERS, HEX_TRIGGERS_EARLY, HEX_TIER_P, HEX_PICK_MS };
