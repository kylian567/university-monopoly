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
          desc: '发动后本回合盖房费 −50% 并立刻 +¥1500；常驻盖房永久 −10%' },
  newe: { id: 'newe', name: '新能源材料与器件', icon: '🔋', skill: '储能放大', mode: 'active', uses: 3, fx: '#2fb87a', tier: 1,
          desc: '发动后立刻 +现金 12%（上限 ¥4000），本轮收租 +40%；常驻每次经过起点 +¥1000' },
  fin:  { id: 'fin',  name: '金融', icon: '💰', skill: '杠杆操作', mode: 'passive', uses: 4, fx: '#d8a531', tier: 1,
          desc: '抵押地产时自动多拿 50% 现金' },
  cs:   { id: 'cs',   name: '计算机', icon: '💻', skill: '算法优化', mode: 'passive', uses: 3, fx: '#4a90d9', tier: 1,
          desc: '掷骰不足 7 点时自动重掷取更优' },
  // ===== 第二梯队（主流强度，各有专业特色）=====
  econ:  { id: 'econ',  name: '经管',   icon: '📈', skill: '资本运作', mode: 'passive', uses: 3, fx: '#c9a227', tier: 2,
           desc: '单笔收租 ≥¥1500 时自动 +50%' },
  med:   { id: 'med',   name: '医学',   icon: '🩺', skill: '妙手回春', mode: 'passive', uses: 3, fx: '#e05a71', tier: 2,
           desc: '被收租 ≥¥1000 时自动减免 40%' },
  pharm: { id: 'pharm', name: '药学',   icon: '💊', skill: '对症下药', mode: 'active', uses: 3, fx: '#57c1a0', tier: 2,
           desc: '发动后立刻 +¥600，本轮内被收租减免 60%' },
  law:   { id: 'law',   name: '法学',   icon: '⚖️', skill: '法律援助', mode: 'passive', uses: 3, fx: '#8a6fd1', tier: 2,
           desc: '免疫 3 次不利判定（被拆地 / 拆房 / 损失地皮 / 留级 / 陷害）' },
  arch:  { id: 'arch',  name: '建筑',   icon: '🏗️', skill: '造价管理', mode: 'passive', uses: 3, fx: '#d08531', tier: 2,
           desc: '升级房产时费用自动 −35%' },
  chem:  { id: 'chem',  name: '化学',   icon: '🧪', skill: '催化加成', mode: 'passive', uses: 3, fx: '#7bbf3f', tier: 2,
           desc: '单笔收租 ≥¥1000 时自动 +40%' },
  auto:  { id: 'auto',  name: '自动化', icon: '🤖', skill: '流水线', mode: 'active', uses: 3, fx: '#5a7fd6', tier: 2,
           desc: '发动后本回合移动 +2 步；若落在自己的地产上再 +¥900' },
  ee:    { id: 'ee',    name: '微电子', icon: '🔌', skill: '信号增益', mode: 'passive', uses: 4, fx: '#00a8b5', tier: 2,
           desc: '每次经过起点自动 +¥1400' },
  math:  { id: 'math',  name: '数学',   icon: '📐', skill: '精算砍价', mode: 'passive', uses: 3, fx: '#5f9ea0', tier: 2,
           desc: '买入地产时自动 8 折' },
  agri:  { id: 'agri',  name: '农学',   icon: '🌾', skill: '春华秋实', mode: 'passive', uses: 3, fx: '#8fbf4a', tier: 2,
           desc: '每次经过起点自动 +¥1500' },
  stat:  { id: 'stat',  name: '统计',   icon: '📊', skill: '数据洞察', mode: 'passive', uses: 4, fx: '#4f9ad1', tier: 2,
           desc: '掷骰点数 ≤5 时自动 +¥800' },
  pe:    { id: 'pe',    name: '体育',   icon: '🏀', skill: '体能优势', mode: 'passive', uses: 4, fx: '#e0803f', tier: 2,
           desc: '掷骰点数 ≤5 时自动多走 2 步，并额外 +¥400' },
  phil:  { id: 'phil',  name: '哲学',   icon: '🏛️', skill: '批判思维', mode: 'passive', uses: 3, fx: '#8a7f9a', tier: 2,
           desc: '免疫 3 次不利判定（被拆地 / 拆房 / 损失地皮 / 留级 / 陷害）' },
  mil:   { id: 'mil',   name: '军事',   icon: '🎖️', skill: '战术压制', mode: 'passive', uses: 3, fx: '#7d8a3a', tier: 2,
           desc: '擂台对决时点数 +1；获胜再额外 +¥500' },
  phys:  { id: 'phys',  name: '物理',   icon: '⚛️', skill: '守恒定律', mode: 'passive', uses: 3, fx: '#3f7fd6', tier: 2,
           desc: '被收租 ≥¥1200 时自动减免 35%' },
  lang:  { id: 'lang',  name: '外国语', icon: '🌍', skill: '多语种优势', mode: 'passive', uses: 3, fx: '#c86a3f', tier: 2,
           desc: '抽到正面机会卡时自动 +¥900' },
  art:   { id: 'art',   name: '艺术',   icon: '🎨', skill: '灵感迸发', mode: 'passive', uses: 3, fx: '#d1568f', tier: 2,
           desc: '抽到正面机会卡时自动 +¥800' },
  mse:   { id: 'mse',   name: '材料科学', icon: '🧱', skill: '相变强化', mode: 'active', uses: 3, fx: '#9a7b5a', tier: 2,
           desc: '发动后本轮内自己所有地产的收租 +60%' },
  env:   { id: 'env',   name: '环境科学', icon: '♻️', skill: '循环利用', mode: 'passive', uses: 4, fx: '#3fa76a', tier: 2,
           desc: '每次被收租都自动减免 15%（无门槛）' },
  civil: { id: 'civil', name: '土木工程', icon: '🏗️', skill: '基建加固', mode: 'passive', uses: 3, fx: '#a8823f', tier: 2,
           desc: '自己的地产免于被拆除；升级房产费用 −20%' },
  // ===== 第三梯队（特色向 / 小额高频）=====
  geol:  { id: 'geol',  name: '地质',   icon: '🗺️', skill: '勘探评估', mode: 'passive', uses: 3, fx: '#8a7b52', tier: 3,
           desc: '买入无主地产时自动 9 折' },
  aero:  { id: 'aero',  name: '航天',   icon: '🛰️', skill: '一飞冲天', mode: 'passive', uses: 3, fx: '#5468a8', tier: 3,
           desc: '进入岔路时自动 +¥1000' },
  bio:   { id: 'bio',   name: '生命科学', icon: '🧬', skill: '细胞增殖', mode: 'passive', uses: 4, fx: '#5aa9d6', tier: 3,
           desc: '自己回合开始时现金 +4%' },
  drama: { id: 'drama', name: '戏剧',   icon: '🎭', skill: '全场入戏', mode: 'passive', uses: 3, fx: '#b04a9a', tier: 3,
           desc: '抽到任意机会 / 命运卡时自动 +¥500' },
  music: { id: 'music', name: '音乐',   icon: '🎵', skill: '共鸣演出', mode: 'active', uses: 3, fx: '#d1619a', tier: 3,
           desc: '发动后立刻 +¥1000，其他每位玩家各付你 ¥300 出场费' },
  psych: { id: 'psych', name: '心理学', icon: '🧠', skill: '读心术', mode: 'active', uses: 3, fx: '#7a5fc1', tier: 3,
           desc: '发动后从总资产最高的玩家处抽走 ¥1200' },
  news:  { id: 'news',  name: '新闻',   icon: '📰', skill: '独家爆料', mode: 'passive', uses: 3, fx: '#8a8f96', tier: 3,
           desc: '抽到负面卡时自动重抽一次' },
  food:  { id: 'food',  name: '食品科学', icon: '🍜', skill: '能量补给', mode: 'passive', uses: 4, fx: '#d1873f', tier: 3,
           desc: '每次被罚停留休整时自动 +¥700' },
  marine:{ id: 'marine',name: '海洋科学', icon: '🌊', skill: '深海资源', mode: 'passive', uses: 3, fx: '#2f8fbf', tier: 3,
           desc: '每次经过起点自动 +¥1200' },

  // ==================== v5.3 新增 27 个专业（覆盖面更广） ====================
  // 说明：为了让新专业「加得进去、又不碰坏老专业」，v5.3 给 MAJORS 增加了一批
  // **数据驱动字段**（salary / turnPct / lowRoll / rentGain / tollCut / buyCut /
  // buildCut / mortgageUp / cardPos / cardAny / duelPip / branch / stayCash /
  // immuneN / weather / rerollFree / noDemolish …）。老专业走原来的硬编码分支不动，
  // 新专业只填表 + 通用层统一读取，互不干扰。
  // ===== 工科 / 信息技术 =====
  elec:  { id: 'elec',  name: '电气工程',   icon: '⚡', skill: '峰谷套利', mode: 'active', uses: 3, fx: '#f0b429', tier: 2,
           desc: '发动后立刻 +¥1300，本回合买地 6 折' },
  comm:  { id: 'comm',  name: '通信工程',   icon: '📡', skill: '信号覆盖', mode: 'passive', uses: 4, fx: '#3aa0d8', tier: 2,
           desc: '每次经过起点 +¥1200；每抽到任意卡 +¥300',
           salary: { amt: 1200, use: true }, cardAny: 300 },
  ctrl:  { id: 'ctrl',  name: '控制科学',   icon: '🎛️', skill: '闭环调节', mode: 'passive', uses: 3, fx: '#5b7fd1', tier: 2,
           desc: '单笔收租 ≥¥1200 时 +30%；被收租 ≥¥1200 时减免 25%',
           rentGain: { min: 1200, pct: 0.30 }, tollCut: { min: 1200, pct: 0.25 } },
  robot: { id: 'robot', name: '机器人工程', icon: '🦾', skill: '机械臂协作', mode: 'active', uses: 3, fx: '#e2663f', tier: 2,
           desc: '发动后本回合盖房 −60%，并立刻 +¥1000' },
  se:    { id: 'se',    name: '软件工程',   icon: '⌨️', skill: '敏捷迭代', mode: 'passive', uses: 4, fx: '#4a90d9', tier: 2,
           desc: '每局 4 次免费重投骰子（不用付 ¥900）',
           rerollFree: true },
  ai:    { id: 'ai',    name: '人工智能',   icon: '🧠', skill: '模型推理', mode: 'active', uses: 3, fx: '#7a5fc1', tier: 2,
           desc: '发动后本轮收租 +35%，并从总资产最高者处取 ¥800' },
  imes:  { id: 'imes',  name: '智能制造',   icon: '🏭', skill: '柔性产线', mode: 'passive', uses: 3, fx: '#7b8fa8', tier: 2,
           desc: '升级房产 −25%；每次升级成功再 +¥500',
           buildCut: 0.25, buildCash: 500 },
  power: { id: 'power', name: '能源与动力', icon: '🔥', skill: '热机循环', mode: 'passive', uses: 4, fx: '#e07a3f', tier: 2,
           desc: '每轮开局 +¥400；每次经过起点 +¥800',
           turnCash: 400, salary: { amt: 800, use: true } },
  // ===== 理科 / 地球科学 =====
  astro: { id: 'astro', name: '天文学',     icon: '🔭', skill: '眺望星河', mode: 'passive', uses: 3, fx: '#5468a8', tier: 2,
           desc: '掷骰点数 ≥9 时自动 +¥1100',
           highRoll: { min: 9, amt: 1100 } },
  meteo: { id: 'meteo', name: '气象学',     icon: '🌦️', skill: '预报风向', mode: 'passive', uses: 4, fx: '#4f9ad1', tier: 2,
           desc: '恶劣天气（雨/台风/雪/雾）里自己回合开始 +¥700',
           weather: { kinds: ['rain', 'storm', 'snow', 'fog'], amt: 700 } },
  geop:  { id: 'geop',  name: '地球物理',   icon: '🌏', skill: '地层探测', mode: 'passive', uses: 3, fx: '#8a7b52', tier: 2,
           desc: '买入无主地产 85 折；每买下一块地再 +¥400',
           buyCut: 0.15, buyCash: 400 },
  or:    { id: 'or',    name: '运筹学',     icon: '🧮', skill: '资源调度', mode: 'active', uses: 3, fx: '#5f9ea0', tier: 2,
           desc: '发动后立刻 +¥900，本回合移动 +3 步' },
  // ===== 医农生 =====
  nurs:  { id: 'nurs',  name: '护理学',     icon: '💉', skill: '悉心看护', mode: 'passive', uses: 4, fx: '#e05a9a', tier: 2,
           desc: '被收租 ≥¥800 时自动减免 35%',
           tollCut: { min: 800, pct: 0.35 } },
  dent:  { id: 'dent',  name: '口腔医学',   icon: '🦷', skill: '牙科门诊', mode: 'passive', uses: 3, fx: '#57c1c0', tier: 2,
           desc: '单笔收租 ≥¥1200 时自动 +45%',
           rentGain: { min: 1200, pct: 0.45 } },
  vet:   { id: 'vet',   name: '兽医学',     icon: '🐾', skill: '牲畜保险', mode: 'passive', uses: 3, fx: '#8fbf4a', tier: 2,
           desc: '自己的地产免于被拆除；每次被收租减免 12%',
           noDemolish: true, tollCut: { min: 0, pct: 0.12 } },
  hort:  { id: 'hort',  name: '园艺学',     icon: '🌷', skill: '嫁接育种', mode: 'passive', uses: 3, fx: '#d1568f', tier: 3,
           desc: '每次经过起点 +¥1100；升级房产 −12%',
           salary: { amt: 1100, use: true }, buildCut: 0.12 },
  forest:{ id: 'forest',name: '林学',       icon: '🌲', skill: '封山育林', mode: 'passive', uses: 3, fx: '#3fa76a', tier: 3,
           desc: '每轮开局 +¥350；被罚停留休整时 +¥600',
           turnCash: 350, stayCash: 600 },
  // ===== 人文社科 / 管理 =====
  acc:   { id: 'acc',   name: '会计学',     icon: '🧾', skill: '精算审计', mode: 'passive', uses: 3, fx: '#c9a227', tier: 2,
           desc: '买入地产 85 折；被收租 ≥¥1000 时减免 25%',
           buyCut: 0.15, tollCut: { min: 1000, pct: 0.25 } },
  trade: { id: 'trade', name: '国际贸易',   icon: '🚢', skill: '跨境套利', mode: 'passive', uses: 4, fx: '#2f8fbf', tier: 2,
           desc: '每次经过起点 +¥1000；每抽到任意卡 +¥350',
           salary: { amt: 1000, use: true }, cardAny: 350 },
  mkt:   { id: 'mkt',   name: '市场营销',   icon: '📣', skill: '带货直播', mode: 'active', uses: 3, fx: '#e0803f', tier: 2,
           desc: '发动后立刻 +¥1200，其他每位玩家再各付你 ¥250' },
  hr:    { id: 'hr',    name: '人力资源管理', icon: '🧑‍💼', skill: '团队激励', mode: 'passive', uses: 3, fx: '#a8823f', tier: 3,
           desc: '回合开始时现金 +3%；被罚停留休整时 +¥700',
           turnPct: 0.03, stayCash: 700 },
  tourism:{ id: 'tourism', name: '旅游管理', icon: '🧳', skill: '导游外快', mode: 'passive', uses: 3, fx: '#c86a3f', tier: 3,
           desc: '进入岔路时 +¥900；每次经过起点 +¥700',
           branch: 900, salary: { amt: 700, use: true } },
  edu:   { id: 'edu',   name: '教育学',     icon: '📚', skill: '因材施教', mode: 'passive', uses: 4, fx: '#9a7b5a', tier: 3,
           desc: '每轮开局 +¥350；抽到负面卡时自动重抽（4 次）',
           turnCash: 350, negReroll: true },
  hist:  { id: 'hist',  name: '历史学',     icon: '🏺', skill: '考古发现', mode: 'passive', uses: 3, fx: '#a8823f', tier: 3,
           desc: '掷骰点数 ≤4 时发掘出文物 +¥900；买入无主地产 9 折',
           lowRoll: { max: 4, amt: 900 }, buyCut: 0.10 },
  soc:   { id: 'soc',   name: '社会学',     icon: '🧑‍🤝‍🧑', skill: '田野调查', mode: 'passive', uses: 3, fx: '#8a7f9a', tier: 3,
           desc: '每抽到一张机会 / 命运卡 +¥450',
           cardAny: 450 },
  // ===== 艺术 / 设计 / 传媒 =====
  design:{ id: 'design',name: '工业设计',   icon: '🖌️', skill: '人机工学', mode: 'passive', uses: 3, fx: '#d1619a', tier: 3,
           desc: '升级房产 −18%；买入地产 −8%',
           buildCut: 0.18, buyCut: 0.08 },
  film:  { id: 'film',  name: '影视传媒',   icon: '🎬', skill: '院线首映', mode: 'active', uses: 3, fx: '#b04a9a', tier: 2,
           desc: '发动后立刻 +¥1500，本轮自己收租 +25%' },
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
  { id: 'medal',    name: '免租金卡',        icon: '🎫', desc: '下次应付租金时自动消耗' },
  { id: 'voucher',  name: '免租券',          icon: '🎟️', desc: '下次应付租金时自动消耗（可与免租金卡叠加持有）' },
  { id: 'skill',    name: '技能次数 +1',     icon: '✨', desc: '本局专业技剩余次数 +1' },
  { id: 'discount', name: '买房 8 折卡',     icon: '🏷️', desc: '当回合买地自动 8 折' },
  { id: 'step',     name: '加速卡',          icon: '👟', desc: '下一次移动 +3 步' },
  { id: 'cash',     name: '现金红包',        icon: '🧧', desc: '立刻到账 ¥800' },
  { id: 'shield',   name: '免罚符',          icon: '🛡️', desc: '本回合踩到他人地产免租' },
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
  { name: '室友带饭', desc: '室友承包一个月饭卡——免租券：下次应付租金全免', kind: 'voucher' },
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
const FACULTY_VOTE_MS = 24000;   // 开局风貌投票时长（v5.5 由 15s 拉长到 24s：看清楚再投，超时未投者随机补票）
const FACULTY_MAX_RARE = 0;      // 本版无稀有风貌（原「变数校区」已按要求删去）

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
  }
  ev(e) {
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
    const cap = this.fundCap();   // v5.2：金融校区把上限抬到 ¥25000
    const overflow = this.fundPool + amount - cap;
    this.fundPool = Math.min(cap, this.fundPool + amount);
    if (overflow > 0) {
      const alive = this.alive();
      if (alive.length) {
        const share = Math.floor(overflow / alive.length);
        if (share > 0) {
          for (const q of alive) { q.cash += share; this.ev({ t: 'money', pid: q.id, amount: share, reason: '基金溢出均分' }); }
          this.addLog(`💰 教育基金突破上限 ¥${cap}，溢出部分均分：每人 +¥${share}`);
        }
      }
    }
  }

  // v5.1：效果卡抽取（校园商城 / 校庆礼品屋共用）
  grantCards(p, idx, n, label) {
    const drawn = [];
    for (let i = 0; i < n; i++) {
      const card = pick(EFFECT_CARDS);
      drawn.push(card);
      switch (card.id) {
        case 'medal':    p.medal++; break;
        case 'voucher':  p.voucher++; break;
        case 'skill':    p.skillLeft++; break;
        case 'discount': p.discount = true; break;
        case 'step':     p.stepBuffs.push(3); break;
        case 'cash':     p.cash += 800; this.ev({ t: 'money', pid: p.id, amount: 800, reason: '现金红包' }); break;
        case 'shield':   p.shield = true; break;
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
      voucher: 0, discount: false, skipNext: false, skipTurns: 0, color: PCOLOR[this.players.length],
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
  openFacultyVote() {
    const pool = FACULTY_KEYS.slice();
    const opts = [];
    while (opts.length < 3 && pool.length) opts.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    this.facultyOptions = opts;
    this.facultyVotes = {};
    this.phase = 'faculty';
    this.addLog(`🏫 本局「校园风貌」候选：${opts.map(k => FACULTY[k].icon + FACULTY[k].name).join(' / ')} —— 全体投票中（15 秒）`);
    this.ev({ t: 'faculty_offer', options: opts, ms: FACULTY_VOTE_MS });
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
    const pref = { urban: 3, garden: 3, reform: 3, ancient: 2, finance: 2, agri: 2, boom: 2, nofund: 2, retrain: 2, freeRound: 2 };
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
    this.addLog(`🏫 抽中 ${lucky.name} 的选票 → 本局校园风貌【${f.name}】：${f.lead}｜代价：${f.cost}`);
    this.ev({ t: 'faculty_chosen', key, lucky: lucky.id, votes: { ...this.facultyVotes }, tally: this.facultyTally() });
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
    if (key === 'retrain') {
      for (const q of this.players) q.skillLeft = (q.skillLeft || 0) + 1;
      this.addLog(`📖 【进修校区】全员专业技能次数 +1`);
    }
    if (key === 'freeRound') {
      this.freeRound = 2 + Math.floor(Math.random() * 12);   // 第 2 ~ 13 轮
      this.addLog(`🎟️ 【免费轮校区】已抽定：第 ${this.freeRound} 轮全场买地皮、盖楼完全免费`);
    }
    if (key === 'freeRent') {
      const pool = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
      const got = [];
      while (got.length < 4 && pool.length) got.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      this.freeRentRounds = got.sort((a, b) => a - b);
      this.addLog(`🕊️ 【免租轮校区】已抽定免租轮：第 ${this.freeRentRounds.join(' / ')} 轮，这些轮次全场踩到谁的地都不用付租金`);
    }
  }
  facIs(k) { return this.faculty === k; }
  isFreeRound() { return this.facIs('freeRound') && this.round === this.freeRound; }
  isFreeRentRound() { return this.facIs('freeRent') && this.freeRentRounds.includes(this.round); }

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
          const pay = Math.min(q.cash, e.amount); q.cash -= pay; sum += pay;
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
        rich.cash -= pay; this.addToFund(pay);
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
        const share = Math.floor(total / alive.length);
        if (share <= 0) break;
        this.fundPool -= share * alive.length;
        const items = [];
        for (const q of alive) { q.cash += share; items.push({ pid: q.id, amount: share }); }
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
        rich.cash -= pay; poor.cash += pay;
        this.addLog(`🤲 校历【${e.name}】：${rich.name} → ${poor.name} 转移 ¥${pay}`);
        this.ev({ t: 'charge', pid: rich.id, amount: pay, creditor: null, reason: e.name, cell: rich.pos, toPool: false });
        this.ev({ t: 'paid', pid: rich.id, amount: pay, creditor: null, toPool: false });
        this.ev({ t: 'money', pid: poor.id, amount: pay, reason: e.name });
        break;
      }
      case 'cardsLottery': {
        const items = [];
        for (const q of alive) if (e.cards > 0) this.grantCards(q, q.pos, e.cards, e.name);
        const lucky = alive.length ? pick(alive) : null;
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
    const thr = this.facIs('finance') ? 5 : 6;   // v5.2：金融校区把起征门槛下调 1
    const items = [];
    for (const p of this.alive()) {
      let hold = 0, bld = 0;
      this.cells.forEach((cs, i) => {
        if (cs.own !== p.id || cs.mortgaged) return;
        hold++; if (BOARD[i].type === 'prop') bld += cs.level;
      });
      let tax = Math.max(0, bld - thr) * 130 + Math.max(0, hold - thr) * 90;
      tax = Math.min(tax, 1800);   // v5.0：税率与上限小幅下调
      if (tax <= 0) continue;
      if (p.cash < tax) continue;   // 现金不足则本年暂缓，避免与筹钱逻辑纠缠
      p.cash -= tax;
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
    if (p.cash < cost) return;
    p.cash -= cost;
    if (item === 'shield') p.shield = true;
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
    const cost = this.rerollCostFor(p);
    if (p.cash < cost) { this.execRoll(p); return; }
    const freeRoll = cost === 0 && (MAJORS[p.major] || {}).rerollFree && p.skillLeft > 0;
    if (freeRoll) p.skillLeft--;
    else { p.cash -= cost; this.addToFund(Math.round(cost * FUND_SHARE)); }   // v5.0：重掷花费的 1/3 进教育基金池
    p.rerollUsed = true;
    const [d1, d2] = this.rollDice(p);
    this.dice = [d1, d2];
    if (freeRoll) {
      const mj = MAJORS[p.major] || {};
      this.addLog(`${mj.icon} ${p.name} 发动【${mj.skill}】免费重投一次：${d1} + ${d2} = ${d1 + d2}`);
      this.ev({ t: 'skill', pid: p.id, major: p.major, name: mj.skill, detail: `免费重投 ${d1}+${d2}`, active: false });
    } else {
      this.addLog(`🎲 ${p.name} 花 ¥${cost} 重投一次：${d1} + ${d2} = ${d1 + d2}`);
      this.ev({ t: 'item', pid: p.id, item: 'reroll', cost, name: '重掷骰', detail: `重投 ${d1}+${d2}` });
    }
    this.ev({ t: 'roll', pid: p.id, d1, d2 });
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
    // 专业：航天 · 一飞冲天（进入岔路额外 +¥1000）
    if (p.major === 'aero' && p.skillLeft > 0) {
      p.skillLeft--; p.cash += 1000;
      this.addLog(`🛰️ ${p.name} 发动【一飞冲天】+¥1000`);
      this.ev({ t: 'skill', pid: p.id, major: 'aero', name: '一飞冲天', detail: '+¥1000' });
      this.ev({ t: 'money', pid: p.id, amount: 1000, reason: '一飞冲天' });
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
    p.cash -= cost;
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
      case 'mech': {   // 精益制造：本回合盖房 −50% + 立刻 +¥1500
        p.buildCutTurn = 0.5; p.cash += 1500;
        this.ev({ t: 'money', pid: p.id, amount: 1500, reason: '精益制造' });
        return '+¥1500，本回合盖房 −50%';
      }
      case 'newe': {   // 储能放大：立刻 +现金 12%（上限 4000）+ 本轮收租 +40%
        const gain = Math.min(4000, Math.round(p.cash * 0.12));
        p.cash += gain; p.rentBuff = (p.rentBuff || 0) + 0.4;
        this.ev({ t: 'money', pid: p.id, amount: gain, reason: '储能放大' });
        return `+¥${gain}，本轮收租 +40%`;
      }
      case 'pharm': {  // 对症下药：立刻 +¥600 + 本轮被收租减免 60%
        p.cash += 600; p.defBuff = (p.defBuff || 0) + 0.6;
        this.ev({ t: 'money', pid: p.id, amount: 600, reason: '对症下药' });
        return '+¥600，本轮被收租 −60%';
      }
      case 'auto': {   // 流水线：本回合移动 +2 步，落在己方地产再 +¥900
        p.buffSteps = (p.buffSteps || 0) + 2; p.autoBonus = true;
        return '本回合移动 +2 步';
      }
      case 'mse': {    // 相变强化：本轮自己地产收租 +60%
        p.rentBuff = (p.rentBuff || 0) + 0.6;
        return '本轮自己地产收租 +60%';
      }
      case 'music': {  // 共鸣演出：立刻 +¥1000，其他玩家各付 ¥300
        p.cash += 1000;
        this.ev({ t: 'money', pid: p.id, amount: 1000, reason: '共鸣演出' });
        let extra = 0;
        for (const q of this.alive()) {
          if (q.id === p.id) continue;
          const pay = Math.min(300, Math.max(0, q.cash));
          q.cash -= pay; p.cash += pay; extra += pay;
          this.ev({ t: 'money', pid: q.id, amount: -pay, reason: '共鸣演出·出场费' });
        }
        if (extra > 0) this.ev({ t: 'money', pid: p.id, amount: extra, reason: '共鸣演出·出场费' });
        return `+¥${1000 + extra}`;
      }
      case 'psych': {  // 读心术：从总资产最高者处抽走 ¥1200
        const others = this.alive().filter(q => q.id !== p.id);
        if (!others.length) return '无人可读心';
        let rich = others[0];
        for (const q of others) if (this.netWorth(q) > this.netWorth(rich)) rich = q;
        const take = Math.min(1200, Math.max(0, rich.cash));
        rich.cash -= take; p.cash += take;
        this.ev({ t: 'money', pid: rich.id, amount: -take, reason: '被读心' });
        this.ev({ t: 'money', pid: p.id, amount: take, reason: '读心术' });
        return `从 ${rich.name} 处取得 ¥${take}`;
      }
      // ===== v5.3 新增主动技 =====
      case 'elec': {   // 峰谷套利：立刻 +¥1300，本回合买地 6 折
        p.buyCutTurn = 0.4; p.cash += 1300;
        this.ev({ t: 'money', pid: p.id, amount: 1300, reason: '峰谷套利' });
        return '+¥1300，本回合买地 6 折';
      }
      case 'robot': {  // 机械臂协作：本回合盖房 −60%，立刻 +¥1000
        p.buildCutTurn = 0.6; p.cash += 1000;
        this.ev({ t: 'money', pid: p.id, amount: 1000, reason: '机械臂协作' });
        return '+¥1000，本回合盖房 −60%';
      }
      case 'ai': {     // 模型推理：本轮收租 +35%，并从总资产最高者处取 ¥800
        p.rentBuff = (p.rentBuff || 0) + 0.35;
        const others = this.alive().filter(q => q.id !== p.id);
        let got = 0;
        if (others.length) {
          let rich = others[0];
          for (const q of others) if (this.netWorth(q) > this.netWorth(rich)) rich = q;
          got = Math.min(800, Math.max(0, rich.cash));
          rich.cash -= got; p.cash += got;
          this.ev({ t: 'money', pid: rich.id, amount: -got, reason: '被模型推理' });
          this.ev({ t: 'money', pid: p.id, amount: got, reason: '模型推理' });
        }
        return `本轮收租 +35%${got > 0 ? `，取得 ¥${got}` : ''}`;
      }
      case 'or': {     // 资源调度：立刻 +¥900，本回合移动 +3 步
        p.buffSteps = (p.buffSteps || 0) + 3; p.cash += 900;
        this.ev({ t: 'money', pid: p.id, amount: 900, reason: '资源调度' });
        return '+¥900，本回合移动 +3 步';
      }
      case 'mkt': {    // 带货直播：立刻 +¥1200，其他每位玩家各付 ¥250
        p.cash += 1200;
        this.ev({ t: 'money', pid: p.id, amount: 1200, reason: '带货直播' });
        let extra = 0;
        for (const q of this.alive()) {
          if (q.id === p.id) continue;
          const pay = Math.min(250, Math.max(0, q.cash));
          q.cash -= pay; p.cash += pay; extra += pay;
          this.ev({ t: 'money', pid: q.id, amount: -pay, reason: '带货直播·坑位费' });
        }
        if (extra > 0) this.ev({ t: 'money', pid: p.id, amount: extra, reason: '带货直播·坑位费' });
        return `+¥${1200 + extra}`;
      }
      case 'film': {   // 院线首映：立刻 +¥1500，本轮自己收租 +25%
        p.rentBuff = (p.rentBuff || 0) + 0.25; p.cash += 1500;
        this.ev({ t: 'money', pid: p.id, amount: 1500, reason: '院线首映' });
        return '+¥1500，本轮收租 +25%';
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
    if (p.discount) p.discount = false; // 折扣卡仅当轮有效
    p.shield = false;                   // 道具仅当轮有效
    p.rerollUsed = false;               // 重掷骰每回合重置
    p.skillUsedThisTurn = false;        // v5.1 主动技：本回合可询问一次
    p.buildCutTurn = 0;                 // v5.1 主动技临时折扣到期
    p.buyCutTurn = 0;                   // v5.3 主动技「峰谷套利」临时买地折扣到期
    p.autoBonus = false;                // v5.1 自动化落点奖励到期
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
    // 专业：生命科学 · 细胞增殖（回合开始现金 +4%）
    if (p.major === 'bio' && p.skillLeft > 0 && p.cash > 0) {
      const gain = Math.round(p.cash * 0.04);
      p.skillLeft--; p.cash += gain;
      this.addLog(`🧬 ${p.name} 发动【细胞增殖】+¥${gain}`);
      this.ev({ t: 'skill', pid: p.id, major: 'bio', name: '细胞增殖', detail: `+¥${gain}` });
      this.ev({ t: 'money', pid: p.id, amount: gain, reason: '细胞增殖' });
    }
    // v5.3：通用被动 —— 回合开始类收益（每轮补贴 / 现金流百分比 / 天气红利）
    this.applyTurnStartPassives(p);
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
    if (idx === 0) { this.round++; this.beginRound(); }
    this.startTurn();
  }

  // ---------- 掷骰与移动 ----------
  // 掷一次骰（含计算机"算法优化"技能），返回 [d1, d2]
  rollDice(p) {
    let d1 = 1 + Math.floor(Math.random() * 6), d2 = 1 + Math.floor(Math.random() * 6);
    // 专业：计算机 · 算法优化（不足 7 点自动重掷取更优，每局限次）
    if (p.major === 'cs' && p.skillLeft > 0 && d1 + d2 < 7) {
      const n1 = 1 + Math.floor(Math.random() * 6), n2 = 1 + Math.floor(Math.random() * 6);
      p.skillLeft--;
      this.ev({ t: 'skill', pid: p.id, major: 'cs', name: '算法优化', detail: `重掷 ${n1} + ${n2}` });
      if (n1 + n2 > d1 + d2) { d1 = n1; d2 = n2; }
    }
    return [d1, d2];
  }
  doRoll(p) {
    if (this.phase !== 'roll' || this.curp() !== p) return;
    const [d1, d2] = this.rollDice(p);
    this.dice = [d1, d2];   // 双数判定与公用事业租金按最终点数计算
    this.ev({ t: 'roll', pid: p.id, d1, d2 });
    // v4.1：掷骰后可花 ¥1200 重投一次（每回合每人限一次，现金够且未用过才提供选项）
    const rc0 = this.rerollCostFor(p);   // v5.2：文体校区每轮首次重投只要 ¥900
    if (!p.rerollUsed && p.cash >= rc0) {
      this.phase = 'reroll';
      // v5.1：重投询问时就把"这一走会落到哪一格"预测出来，全场都能在地图上看到虚影
      const pv = this.previewLanding(p);
      this.pendingReroll = { pid: p.id, cost: rc0, from: p.pos, target: pv ? pv.cell : null, steps: pv ? pv.steps : (d1 + d2) };
      this.addLog(`${p.name} 掷出 ${d1} + ${d2} = ${d1 + d2}${d1 === d2 ? '（双数，可再掷一次）' : ''}`);
      this.ev({ t: 'ask_reroll', pid: p.id, d1, d2, cost: rc0, target: this.pendingReroll.target, steps: this.pendingReroll.steps });
      this.setTimer(TURN_MS, () => this.confirmRoll(this.curp()));
      if (p.isAI) this.aiTimers.push(setTimeout(() => this.aiReroll(p), rnd(1800, 4200)));
      return;
    }
    this.addLog(`${p.name} 掷出 ${d1} + ${d2} = ${d1 + d2}${d1 === d2 ? '（双数，可再掷一次）' : ''}`);
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
      steps += 2; p.skillLeft--; p.cash += 400;
      this.addLog(`🏀 ${p.name} 发动【体能优势】多走 2 步并 +¥400`);
      this.ev({ t: 'skill', pid: p.id, major: 'pe', name: '体能优势', detail: '+2 步 / +¥400' });
      this.ev({ t: 'money', pid: p.id, amount: 400, reason: '体能优势' });
    }
    // 专业：统计 · 数据洞察（点数 ≤5 时额外 +¥800）
    if (p.major === 'stat' && p.skillLeft > 0 && raw <= 5) {
      p.skillLeft--; p.cash += 800;
      this.addLog(`📊 ${p.name} 发动【数据洞察】+¥800`);
      this.ev({ t: 'skill', pid: p.id, major: 'stat', name: '数据洞察', detail: '+¥800' });
      this.ev({ t: 'money', pid: p.id, amount: 800, reason: '数据洞察' });
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
    if (passedGo) {
      // v4.0「经济寒冬」：第 ENDGAME_ROUND 轮起银行停发工资
      if (this.salaryOn()) {
        const w = this.wageOf();
        p.cash += w; this.ev({ t: 'money', pid: p.id, amount: w, reason: '工资' });
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
    return SALARY;
  }
  // v5.2：风貌对地价 / 升级费 / 租金 / 基金池上限 / 罚款 / 岔路奖励 / 重投费用的影响，集中读表，避免散落 if
  facLandMul() {
    switch (this.faculty) {
      case 'garden': return 0.96;
      case 'nofund': return 0.88;
      case 'urban': case 'life': case 'retrain': return 1.03;
      case 'art':    return 1.04;
      case 'boom':   return 1.06;
      default:       return 1;
    }
  }
  facBuildMul() {
    switch (this.faculty) {
      case 'tech':   return 0.92;
      case 'nofund': return 0.90;
      case 'agri':   return 1.03;
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
      default: break;
    }
    if (this.facIs('ancient') && this.round <= 3) m *= 0.93;   // 百年学府：开局三轮收租偏弱
    return Math.round(m * 1000) / 1000;
  }
  fundCap() { return this.facIs('finance') ? 25000 : FUND_CAP; }
  facFine(amt) { return this.facIs('med') ? Math.round(amt * 1.2) : amt; }        // 医学：罚款类支出 +20%
  facBranch(amt) { return this.facIs('intl') ? Math.round(amt * 1.12) : amt; }    // 国际：岔路奖励 ×1.12
  // v5.2 文体：每轮首次重投 ¥900；v5.3 软件工程·敏捷迭代：有次数时重投免费
  rerollCostFor(p) {
    const mj = MAJORS[p.major] || {};
    if (mj.rerollFree && p.skillLeft > 0) return 0;
    return (this.facIs('sports') && !p.rerollUsed) ? 900 : REROLL_COST;
  }
  // v5.2：统一的「停留」入口 —— 师范校区发的「免停留卡」在这里生效（只对纯惩罚性停留有效）
  applyStay(p, turns, why) {
    if ((p.stayFree || 0) > 0) {
      p.stayFree--;
      this.addLog(`🎯 ${p.name} 使用「免停留卡」，免除「${why}」的停留（还剩 ${p.stayFree} 张）`);
      this.ev({ t: 'stay_free', pid: p.id, why, left: p.stayFree });
      return false;   // 没被停留
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
    } else {
      if (this.facIs('tech')) v = Math.round(v * 0.93);
      if (this.facIs('general')) v = Math.min(0, v + 200);
      if (this.facIs('book') && type === 'fate') v = Math.round(v * 1.1);
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
          const price = p.discount ? Math.floor(base * 0.8) : base;
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
            p.autoBonus = false; p.cash += 900;
            this.addLog(`🤖 ${p.name} 的自动化产线转回自家地皮，产能 +¥900`);
            this.ev({ t: 'skill', pid: p.id, major: 'auto', name: '流水线', detail: '+¥900', active: true });
            this.ev({ t: 'money', pid: p.id, amount: 900, reason: '流水线' });
          }
          if (cell.type !== 'prop') { this.afterResolve(p, false); return; }
          if (cs.mortgaged) { this.addLog(`${p.name} 回到自己的抵押地「${cell.name}」，可随时在资产面板赎回`); this.afterResolve(p, false); return; }
          if (cs.level < 4) {
            const cost = this.seasonCost(GROUPS[cell.g].build);
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
        if (p.voucher > 0) {
          p.voucher--;
          this.addLog(`🎫 ${p.name} 的免租券生效，免除「${cell.name}」的租金`);
          this.ev({ t: 'voucher', pid: p.id, cell: idx });
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
        // 被动：化学·催化加成（单笔 ≥¥1000 时 +40%）
        if (owner.major === 'chem' && owner.skillLeft > 0 && rent >= 1000) {
          const bonus = Math.round(rent * 0.4); rent += bonus; owner.skillLeft--;
          this.addLog(`🧪 ${owner.name} 发动【催化加成】+¥${bonus}`);
          this.ev({ t: 'skill', pid: owner.id, major: 'chem', name: '催化加成', detail: `+${bonus}` });
        }
        // 被动：经管·资本运作（单笔 ≥¥1500 时 +50%）
        if (owner.major === 'econ' && owner.skillLeft > 0 && rent >= 1500) {
          const bonus = Math.round(rent * 0.5); rent += bonus; owner.skillLeft--;
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
        // ===== 付租方减免 =====
        // 被动：物理·守恒定律（≥¥1200 时 −35%）
        if (p.major === 'phys' && p.skillLeft > 0 && rent >= 1200) {
          const saved = Math.round(rent * 0.35); rent -= saved; p.skillLeft--;
          this.addLog(`⚛️ ${p.name} 发动【守恒定律】减免 ¥${saved}`);
          this.ev({ t: 'skill', pid: p.id, major: 'phys', name: '守恒定律', detail: `-${saved}` });
        }
        // 被动：医学·妙手回春（≥¥1000 时 −40%）
        if (p.major === 'med' && p.skillLeft > 0 && rent >= 1000) {
          const saved = Math.round(rent * 0.4); rent -= saved; p.skillLeft--;
          this.addLog(`🩺 ${p.name} 发动【妙手回春】减免 ¥${saved}`);
          this.ev({ t: 'skill', pid: p.id, major: 'med', name: '妙手回春', detail: `减免 ¥${saved}` });
        }
        // 被动：环境科学·循环利用（无门槛 −15%，次数多）
        if (p.major === 'env' && p.skillLeft > 0 && rent > 0) {
          const saved = Math.round(rent * 0.15); rent -= saved; p.skillLeft--;
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
        if (rent < 1) rent = 1;
        if (rent >= 10000) this.giveAch(owner, 'rent10k');
        this.addLog(`${p.name} 踩到 ${owner.name} 的「${cell.name}」，应付租金 ¥${rent}`);
        this.charge(p, rent, owner, `租金·${cell.name}`, idx);
        return;
      }
      case 'jail': {
        // 校园商城（v5.1）：随机抽 1 张（35% 概率抽到 2 张）效果卡，卡池含「免租金卡 / 免租券 / 技能次数 +1」等
        // v5.2 艺术校区：盲盒每次多抽 1 张
        const n = ((Math.random() < 0.35) ? 2 : 1) + (this.facIs('art') ? 1 : 0);
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
        const stake = Math.round(1500 * (this.facIs('sports') ? 1.2 : 1));   // v5.2 文体校区：赌注 ×1.2
        const amount = Math.min(stake, loser.cash);
        this.addLog(`⚔️ 擂台！${p.name}(${a}) vs ${opp.name}(${b}) → ${winner.name} 胜，${loser.name} 付 ¥${amount}`);
        this.ev({ t: 'duel', pid: p.id, opp: opp.id, a, b, label: '辩论擂台', winner: winner.id, amount });
        if (amount > 0) {
          loser.cash -= amount; winner.cash += amount; loser.combo = 0;
          this.ev({ t: 'charge', pid: loser.id, amount, creditor: winner.id, reason: '擂台赌注', cell: idx, toPool: false });
          this.ev({ t: 'paid', pid: loser.id, amount, creditor: winner.id, toPool: false });
        }
        // 专业：军事 · 战术压制（获胜额外 +¥500）
        if (winner.major === 'mil' && winner.skillLeft > 0) {
          winner.skillLeft--; winner.cash += 500;
          this.addLog(`🎖️ ${winner.name} 乘胜追击【战术压制】+¥500`);
          this.ev({ t: 'skill', pid: winner.id, major: 'mil', name: '战术压制', detail: '胜者 +¥500' });
          this.ev({ t: 'money', pid: winner.id, amount: 500, reason: '战术压制' });
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
        const n = ((Math.random() < 0.35) ? 2 : 1) + (this.facIs('art') ? 1 : 0);
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
            p.cash -= give; poor.cash += give;
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
        if (cell.risk && Math.random() < 0.10) {
          this.evRoll(p, idx, '杰出校友厅·论文抽查', ['领取基金分红', '被耿同学举报论文造假 → 缴 ¥2000'], 1, 'bad');
          const fine = this.facFine(2000);
          this.addLog(`📑 耿同学实名举报 ${p.name} 论文造假，缴 ¥${fine} 进教育基金池`);
          this.charge(p, fine, null, '论文造假罚款', idx, true);
          return;
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
        // 国际交流站（v5.1）：花 ¥1200 报名，50% 拿到 ¥4000 奖学金
        if (p.cash < 1200) { this.addLog(`${p.name} 现金不足，只能看看交换项目宣传册`); this.afterResolve(p, false); return; }
        const win = Math.random() < 0.5;
        this.evRoll(p, idx, '国际交流站·名额抽签', ['🎉 中签 → 领 ¥4000', '😢 落选 → 报名费打水漂'], win ? 0 : 1, win ? 'good' : 'bad');
        p.cash -= 1200;
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
    // 专业：数学 · 精算砍价（买入自动 8 折，与折扣卡不叠加）
    if (!freeNow && !mortgageBuy && !usedDiscount && p.major === 'math' && p.skillLeft > 0 && p.cash >= Math.max(1, Math.round(basePrice * 0.8))) {
      price = Math.max(1, Math.round(basePrice * 0.8)); mathCut = true;
    }
    // 专业：地质 · 勘探评估（买入自动 9 折，与折扣卡不叠加）
    if (!freeNow && !mortgageBuy && !usedDiscount && p.major === 'geol' && p.skillLeft > 0 && p.cash >= Math.max(1, Math.round(basePrice * 0.9))) {
      price = Math.max(1, Math.round(basePrice * 0.9)); geolCut = true;
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
    p.cash -= price;
    cs.own = p.id; cs.mortgaged = false; cs.mortgageAt = 0;
    if (p.discount) p.discount = false;
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
      w.cash -= a.highest;
      this.cells[cell].own = w.id;
      this.addLog(`${w.name} 以 ¥${a.highest} 拍得「${c.name}」`);
      this.ev({ t: 'buy', pid: w.id, cell, price: a.highest, auction: true });
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
    if (p.major === 'mech') mul *= 0.9;
    if (p.major === 'mech' && (p.buildCutTurn || 0) > 0) { mul *= (1 - p.buildCutTurn); usedCuts.push(['精益制造', 'mech', true]); }
    if (p.major === 'arch' && p.skillLeft > 0) { mul *= 0.65; usedCuts.push(['造价管理', 'arch', false]); }
    if (p.major === 'civil' && p.skillLeft > 0) { mul *= 0.8; usedCuts.push(['基建加固', 'civil', false]); }
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
      p.cash -= price; cs.level++;
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
    // 双数：同玩家再掷一次
    if (this.dice && this.dice[0] === this.dice[1] && p.alive) {
      this.addLog(`${p.name} 掷出双数，再掷一次！`);
      this.phase = 'roll';
      this.schedule();
      return;
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
        // v3.5：裸地租金 ×1.5（早期踩地有痛感），垄断 ×3（集齐一组价值更高）
        base = c.rent * (full ? 3 : 1.5);
      }
    } else if (c.type === 'transport') {
      const n = BOARD.reduce((s, cc, i) => s + (cc.type === 'transport' && this.cells[i].own === owner.id ? 1 : 0), 0);
      base = 900 * Math.pow(2, n - 1);   // v5.0：机场过路费小幅削弱
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
    if (owner && owner.combo >= 2) mul *= 1 + Math.min(0.15 * (owner.combo - 1), 0.45);
    mul *= this.facRentMul();   // v5.2：校园风貌（幅度控制在 ±8% 以内）
    // v5.2 生活区校区：只减免「公用事业（文印店/快递驿站）」与「机场路费」，不碰学生宿舍地皮租金
    if (this.facIs('life') && (c.type === 'util' || c.type === 'transport')) mul *= 0.92;
    return Math.max(0, Math.round(base * mul));
  }

  charge(p, amount, creditor, reason, cellIdx, toPool = false) {
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
      if (creditor) {
        creditor.cash += amount;
        if (creditor.combo >= 2) { this.addLog(`🔥 ${creditor.name} 连击 ×${creditor.combo + 1} 收租`); this.ev({ t: 'combo', pid: creditor.id, n: creditor.combo + 1 }); }
        creditor.combo = (creditor.combo || 0) + 1;
        this.checkCombo(creditor); p.combo = 0;
      }
      else if (toPool) this.addToFund(amount);
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
    if (p.cash < mp) return;
    p.cash -= mp; cs.mortgaged = false; cs.mortgageAt = 0;
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
    p.cash = 0; p.voucher = 0; p.invest = null; p.buffSteps = 0; p.stepBuffs = []; p.medal = 0; p.skipTurns = 0;
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
    // 专业：艺术 · 灵感迸发（抽到正面机会卡额外 +¥800）
    if (type === 'chance' && p.major === 'lang' && p.skillLeft > 0 && !this.isBadCard(card) && card.kind !== 'each') {
      p.skillLeft--; p.cash += 900;
      this.addLog(`🌍 ${p.name} 发动【多语种优势】+¥900`);
      this.ev({ t: 'skill', pid: p.id, major: 'lang', name: '多语种优势', detail: '+¥900' });
      this.ev({ t: 'money', pid: p.id, amount: 900, reason: '多语种优势' });
    }
    if (type === 'chance' && p.major === 'art' && p.skillLeft > 0 && !this.isBadCard(card) && card.kind !== 'each') {
      p.skillLeft--; p.cash += 800;
      this.addLog(`🎨 ${p.name} 发动【灵感迸发】+¥800`);
      this.ev({ t: 'skill', pid: p.id, major: 'art', name: '灵感迸发', detail: '+¥800' });
      this.ev({ t: 'money', pid: p.id, amount: 800, reason: '灵感迸发' });
    }
    // 专业：戏剧 · 全场入戏（抽到任意机会/命运卡时额外 +¥500）
    if (p.major === 'drama' && p.skillLeft > 0) {
      p.skillLeft--; p.cash += 500;
      this.addLog(`🎭 ${p.name} 发动【全场入戏】+¥500`);
      this.ev({ t: 'skill', pid: p.id, major: 'drama', name: '全场入戏', detail: '+¥500' });
      this.ev({ t: 'money', pid: p.id, amount: 500, reason: '全场入戏' });
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
          if (this.salaryOn()) { const w = this.wageOf(); p.cash += w; this.ev({ t: 'money', pid: p.id, amount: w, reason: '工资' }); }
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
          for (const q of others) { const pay = Math.min(q.cash, card.amount); q.cash -= pay; total += pay; }
          p.cash += total;
          this.addLog(`${p.name} 从每位玩家处收到共 ¥${total}`);
          this.ev({ t: 'each', pid: p.id, amount: total, dir: 'in' });
        } else {
          for (const q of others) {
            const pay = Math.min(q.cash, card.amount);
            q.cash -= pay; p.cash += pay;
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
      case 'voucher': { p.voucher++; this.afterResolve(p, false); return; }
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
          q.cash -= pay; sum += pay;
          this.ev({ t: 'charge', pid: q.id, amount: pay, creditor: null, reason: card.name, cell: q.pos, toPool: true });
          this.ev({ t: 'paid', pid: q.id, amount: pay, creditor: null, toPool: true });
        }
        this.addToFund(sum);
        this.addLog(`🧾 ${card.name}：全体共缴 ¥${sum} 进教育基金池`);
        this.afterResolve(p, false); return;
      }
      case 'jailSelf': {
        if (this.immune(p, '入狱')) { this.afterResolve(p, false); return; }
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
            q.cash -= pay; poor.cash += pay; sum += pay;
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
        const n = card.n || ((Math.random() < 0.35) ? 2 : 1);
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
      const w = this.wageOf();
      p.cash += w; this.ev({ t: 'money', pid: p.id, amount: w, reason: '工资' });
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
    const GO_SKILL = { ee: ['信号增益', 1400], agri: ['春华秋实', 1500], marine: ['深海资源', 1200] };
    if (GO_SKILL[p.major] && p.skillLeft > 0) {
      const [nm, amt] = GO_SKILL[p.major];
      p.skillLeft--; p.cash += amt;
      this.addLog(`${MAJORS[p.major].icon} ${p.name} 发动【${nm}】+¥${amt}`);
      this.ev({ t: 'skill', pid: p.id, major: p.major, name: nm, detail: `+¥${amt}` });
      this.ev({ t: 'money', pid: p.id, amount: amt, reason: nm });
    }
    if (p.major === 'newe') {
      p.cash += 1000;
      this.addLog(`🔋 ${p.name} 的光伏阵列并网发电，+¥1000（常驻）`);
      this.ev({ t: 'money', pid: p.id, amount: 1000, reason: '光伏增益' });
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

module.exports = { Room, BOARD, GROUPS, CHANCE, FATE, SALARY, START_CASH, SEASON, SEASON_ORDER, WEATHER, CALEVENTS, MAJORS, MAJOR_KEYS, ACHS, ITEMS, EFFECT_CARDS, FUND_CAP, ENDGAME_ROUND, REROLL_COST, BRANCH, BRANCH2, FACULTY, FACULTY_KEYS, FACULTY_VOTE_MS, PCOLOR };
