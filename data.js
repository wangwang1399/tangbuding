/* ============================================================
   iPhone Simulator — 故事数据
   故事：拉齐亚 × 生真 —— 从领养糖糖到相爱
   修改这里的内容即可自定义你的故事
   ============================================================ */

// ===== 手机密码（4位数字）=====
const PASSCODE = '0000';

// ===== 手机主人信息 =====
const OWNER = {
  name: '拉齐亚',            // 真实姓名（用于聊天记录、语音备忘录、朋友圈等故事内容）
  wechatName: '现用idVram', // 微信昵称（仅微信界面显示用）
  signature: '曾用名：海月九', // 微信个性签名
  birthdayGirl: '生真',   // 爱人名字
  birthdayMonth: 3,        // 生真生日月
  birthdayDay: 19,         // 生真生日日
  // 头像：拉齐亚头像 —— 用户上传的图片
  avatar: 'assets/laqiya.jpg',
  avatarColor: 'linear-gradient(135deg, #7ee8fa, #4facfe)',
};

// ===== 锁屏通知 =====
const LOCK_NOTIFICATIONS = [
  {
    app: 'reminders',
    icon: '🔔',
    iconBg: '#ff9500',
    title: '提醒事项',
    text: '回俱乐部之前必须要把狗领养出去',
    time: '一天前'
  },
  {
    app: 'reminders',
    icon: '🔔',
    iconBg: '#ff9500',
    title: '提醒事项',
    text: '手机密码，真的非要有吗？',
    time: '一年前'
  },
  {  app: 'reminders',
    icon: '🔔',
    iconBg: '#ff9500',
    title: '提醒事项',
    text: '算了，弄一个好记的就可以了。',
    time: '一年前'
    
  }
];

// ===== 主屏幕 App 列表 =====
const APPS = [
  { id: 'photos',    name: '照片',      icon: 'photos',     color: 'linear-gradient(135deg, #9bdcff, #d8f1ff)' },
  { id: 'mail',      name: '邮件',      icon: 'mail',       color: 'linear-gradient(135deg, #3fb0ff, #0a6cf5)', badge: 2 },
  { id: 'calendar',  name: '日历',      icon: 'calendar',   color: '#ffffff', dark: true },
  { id: 'clock',     name: '时钟',      icon: 'clock',      color: '#000000' },
  { id: 'notes',     name: '备忘录',    icon: 'notes',      color: 'linear-gradient(135deg, #ffe27a, #ffc933)', dark: true },
  { id: 'weather',   name: '天气',      icon: 'weather',    color: 'linear-gradient(135deg, #53b5ff, #1f6fe0)' },
  { id: 'voicememos',name: '语音备忘录',icon: 'voicememos', color: 'linear-gradient(135deg, #ff6b6b, #ee0979)', badge: 1 },
  { id: 'settings',  name: '设置',      icon: 'settings',   color: 'linear-gradient(135deg, #a7adb6, #6d727b)' },
  { id: 'maps',      name: '地图',      icon: 'maps',       color: 'linear-gradient(135deg, #a8e6a3, #6fcf6f)', dark: true },
];

// ===== Dock 栏 App =====
const DOCK_APPS = [
  { id: 'phone',    name: '电话',   icon: 'phone',   color: 'linear-gradient(135deg, #65f38f, #28c253)' },
  { id: 'safari',   name: 'Safari', icon: 'safari',  color: 'linear-gradient(135deg, #3aa8ff, #0f5fe0)' },
  { id: 'wechat',   name: '微信',   icon: 'wechat',  color: 'linear-gradient(135deg, #34d058, #1aad19)', badge: 5 },
  { id: 'music',    name: '音乐',   icon: 'music',   color: 'linear-gradient(135deg, #ff5e62, #ff2d55)' },
];

// ===== 聊天数据 =====
// type: "them" = 对方(生真), "me" = 我(拉齐亚), "date" = 日期分隔
var DEFAULT_AVATAR = 'default'; // 默认头像标识

const CHATS = {
  '生真': {
    unread: 5,
    avatar: 'assets/shengzhen_candy.jpg',  // 紫色糖果头像
    avatarColor: 'linear-gradient(135deg, #ffc35c, #ff3d6e)',
    messages: [
      // ===== 第一阶段：线上关系（糖糖到来之前）=====
      ['放假第一天', 'date'],
      ['我终于放假啦！有没有想我呀？', 'them', '10:23 AM'],
      ['。', 'me', '10:25 AM'],
      ['我也很想你 ᶘ ᵒᴥᵒᶅ', 'them', '10:26 AM'],
      ['>ᴗoಣ感觉好久好久没听到过你的声音了。', 'them', '10:26 AM'],
      ['过几天可以直接给我打电话。', 'me', '10:30 AM'],
      ['还有，不要再给我的直播账号打钱了。', 'me', '10:31 AM'],

      // ===== 第二阶段：捡到糖糖，发布领养 =====
      ['两天后', 'date'],
      ['我可以领养糖糖哦——', 'them', '2:15 PM'],
      ['虽然有点远，但是不用你送啦，把地址发给我，我来接就好了。', 'them', '2:15 PM'],
      ['•ᴥ• 可以吗可以吗？', 'them', '2:16 PM'],
      ['好。', 'me', '2:20 PM'],
      ['[地址]', 'me', '2:20 PM'],
      ['那就说好了哦，过几天见。', 'them', '2:21 PM'],

      // ===== 第三阶段：生真来接糖糖 =====
      ['见面那天', 'date'],
      ['我好像要到了。', 'them', '11:30 AM'],
      ['嗯，我下来接你。', 'me', '11:31 AM'],
      ['◝(⑅•ᴗ•⑅)◜..°♡我会好好照顾糖糖等拉齐亚来的喔。', 'them', '3:00 PM'],

      // ===== 第四阶段：异地日常，生真养了更多宠物 =====
      ['一周后', 'date'],
      ['【糖糖照片】它过得很好哦，毛都变亮了', 'them', '8:00 PM'],
      ['嗯，谢谢。', 'me', '8:05 PM'],
      ['比赛我看了，拉齐亚打的特别好！好厉害！', 'them', '8:06 PM'],
      ['好想到现场去给你加油呀QAQ', 'them', '8:06 PM'],
      ['……比赛随时都有，还是学习更加重要。', 'me', '8:10 PM'],
      ['是是是，拉齐亚哥哥', 'them', '8:11 PM'],

      // ===== 第五阶段：暧昧升温（通话内容已转存语音备忘录）=====
      ['某天晚上', 'date'],
      ['╥﹏╥', 'them', '11:20 PM'],
      ['怎么了。', 'me', '11:21 PM'],
      ['我想给你打电话。', 'them', '11:22 PM'],
      ['？那打吧。', 'me', '11:22 PM'],
      ['[通话录音已自动保存至语音备忘录]', 'system', '11:26 PM'],

      // ===== 第六阶段：生真考完试，拉齐亚谎称生病 =====
      ['生真考完试那天', 'date'],
      ['我考完了！！！！', 'them', '5:00 PM'],
      ['ෆ( ˶\'ᵕ\'˶)ෆ 拉齐亚是不是明天也要放假了，快到我这里来呀。', 'them', '5:01 PM'],
      ['恭喜，但是我来不了。', 'me', '6:30 PM'],
      ['？', 'them', '6:31 PM'],
      ['生病了，会传染。', 'me', '6:31 PM'],
      ['我已经到s市了。', 'me', '6:32 PM'],
      ['你现在还好吗？有没有去医院？有没有吃药？', 'them', '6:35 PM'],
      ['问题不大，你不用担心。', 'me', '6:40 PM'],

      // ===== 第七阶段：拉齐亚独自在出租屋 =====
      ['凌晨', 'date'],
      ['甜甜，心心，软软，糖糖，还有海月九，它们都还好吗？', 'me', '3:30 AM'],
      ['在做什么？', 'me', '5:00 AM'],

      // ===== 第八阶段：生真突然出现（现场录音已转存语音备忘录）=====
      ['第二天中午', 'date'],
      ['拉齐亚我到了哦，来帮我开一下门吧？', 'them', '12:00 PM'],
      ['[现场录音已自动保存至语音备忘录]', 'system', '12:10 PM'],
    ]
  },
  '房东': {
    unread: 1,
    avatar: DEFAULT_AVATAR,
    avatarColor: '#e5e5ea',
    messages: [
      ['小伙子，房子还续租吗？', 'them', '昨天'],
      ['续租的。', 'me', '昨天'],
      ['好的，记得按时交房租。', 'them', '昨天'],
    ]
  },
  '战队群': {
    unread: 3,
    avatar: DEFAULT_AVATAR,
    avatarColor: '#e5e5ea',
    messages: [
      ['明天训练赛，别迟到', 'them', '昨天'],
      ['收到。', 'me', '昨天'],
      ['收到', 'them', '今天'],
      ['收到', 'them', '今天'],
    ]
  },
};

// ===== 语音备忘录 =====
// 每条录音包含：标题、日期、时长、转写文本（按说话人分段）
// unlockStage: 在哪个游戏阶段解锁显示
const VOICE_MEMOS = [
  {
    id: 1,
    title: '通话录音 · 生真',
    date: '某天晚上 11:20 PM',
    duration: '0:42',
    unlockStage: 'moments_sent',
    waveform: [0.3, 0.6, 0.4, 0.8, 0.5, 0.7, 0.3, 0.9, 0.4, 0.6, 0.5, 0.7, 0.3, 0.8, 0.4, 0.6, 0.5, 0.9, 0.3, 0.7, 0.5, 0.6, 0.4, 0.8, 0.3, 0.5, 0.7, 0.4, 0.6, 0.9],
    segments: [
      { speaker: '生真', time: '11:20', text: '（吸鼻子）呜……', color: '#ff6b9d' },
      { speaker: '拉齐亚', time: '11:21', text: '怎么了。', color: '#5a8dee' },
      { speaker: '生真', time: '11:22', text: '我想给你打电话。', color: '#ff6b9d' },
      { speaker: '拉齐亚', time: '11:22', text: '？那打吧。', color: '#5a8dee' },
      { speaker: '生真', time: '11:23', text: '告诉你天气晴朗。', color: '#ff6b9d' },
      { speaker: '拉齐亚', time: '11:25', text: '是，明天的天气预报吗？谢谢。', color: '#5a8dee' },
      { speaker: '生真', time: '11:26', text: '（轻声）……笨蛋。', color: '#ff6b9d' },
    ]
  },
  {
    id: 2,
    title: '现场录音 · 生真来家里',
    date: '第二天 12:00 PM',
    duration: '1:32',
    unlockStage: 'moments_sent',
    waveform: [0.4, 0.7, 0.5, 0.9, 0.3, 0.8, 0.6, 0.4, 0.7, 0.5, 0.9, 0.3, 0.6, 0.8, 0.4, 0.7, 0.5, 0.9, 0.3, 0.8, 0.6, 0.4, 0.7, 0.5, 0.9, 0.3, 0.6, 0.8, 0.4, 0.7],
    segments: [
      { speaker: '生真', time: '12:00', text: '拉齐亚我到了哦，来帮我开一下门吧？', color: '#ff6b9d' },
      { speaker: '拉齐亚', time: '12:01', text: '……你怎么来了。', color: '#5a8dee' },
      { speaker: '生真', time: '12:01', text: '不是说生病了吗？我来照顾你。', color: '#ff6b9d' },
      { speaker: '拉齐亚', time: '12:02', text: '我……已经没事了。', color: '#5a8dee' },
      { speaker: '生真', time: '12:05', text: '其实拉齐亚很讨厌我吧。', color: '#ff6b9d' },
      { speaker: '生真', time: '12:05', text: '连和我待在一起都没办法接受，才要找这么拙劣的借口。', color: '#ff6b9d' },
      { speaker: '拉齐亚', time: '12:06', text: '不是。', color: '#5a8dee' },
      { speaker: '生真', time: '12:06', text: '那是什么？', color: '#ff6b9d' },
      { speaker: '拉齐亚', time: '12:08', text: '（停顿）……我怕自己会控制不住。', color: '#5a8dee' },
      { speaker: '生真', time: '12:08', text: '控制不住什么？', color: '#ff6b9d' },
      { speaker: '拉齐亚', time: '12:10', text: '（轻声）喜欢你。', color: '#5a8dee' },
    ]
  },
  {
    id: 3,
    title: '糖糖的呼噜声',
    date: '上周 9:00 PM',
    duration: '0:15',
    unlockStage: 'moments_sent',
    waveform: [0.2, 0.3, 0.25, 0.35, 0.2, 0.3, 0.25, 0.4, 0.2, 0.3, 0.25, 0.35, 0.2, 0.3, 0.25, 0.35, 0.2, 0.3, 0.25, 0.4, 0.2, 0.3, 0.25, 0.35, 0.2, 0.3, 0.25, 0.35, 0.2, 0.3],
    segments: [
      { speaker: '糖糖', time: '0:00', text: '（呼噜声）呼……呼……', color: '#a8e6a3' },
    ]
  },
];

// ===== 备忘录 =====
// unlockStage: 在哪个游戏阶段解锁显示
const NOTES = [
  { id: 1, pinned: true, title: '网上说的宠物用品清单', body: '狗粮（已买）\n狗窝\n牵引绳\n尿垫\n玩具\n\n注：买贵一点的', date: '昨天', unlockStage: 'initial' },
  { id: 2, pinned: true, title: '生真家地址', body: '别墅区·XX路XX号\n\n放假了就过去看看。\n糖糖现在叫糖糖，没有被改名。', date: '上周', unlockStage: 'moments_sent' },
  { id: 3, pinned: true, title: '糖糖的朋友们', body: '糖糖（边牧，黑白）\n甜甜（边牧）\n心心（边牧）\n软软（边牧）\n海月九（缅因猫）\n\n海月九……为什么取这个名字？', date: '上周', unlockStage: 'moments_sent' },
  { id: 4, pinned: true, title: '天气晴朗', body: '"我想打电话给你，告诉你天气晴朗。"\n\n……他到底是什么意思。\n（通话录音见语音备忘录）', date: '前天', unlockStage: 'moments_sent' },
  { id: 5, title: '遛狗注意事项', body: '1. 四只边牧会爆冲，绳子会缠在一起\n2. 不小心的话就会被狗拖着跑\n3. 运动完不能直接躺下（生真说的）\n4. 猫不是好猫', date: '上周', unlockStage: 'moments_sent' },
  { id: 6, title: '午饭', body: '要记得给生真买点菜做饭\n真的会好吃吗？', date: '今天', unlockStage: 'moments_sent' },
  { id: 7, title: '购物', body: '狗粮（给狗的）\n猫粮（海月九的）\n自己的拼好饭', date: '今天', unlockStage: 'moments_sent' },
];

// ===== 日历事件 =====
const CALENDAR_EVENTS = [
  { day: 19, title: '生真生日 🎂', allDay: true, color: '#ff3b30' },
  { day: 22, title: '回俱乐部训练', allDay: true, color: '#ff9500' },
  { day: 25, title: '和生真视频', allDay: true, color: '#ff2d55' },
];

// ===== 天气 =====
const WEATHER = {
  city: 'S市',
  temp: 24,
  desc: '晴',
  high: 28,
  low: 18,
};

// ===== 照片（用渐变占位，可替换为真实图片URL）=====
const PHOTOS = [
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #30cfd0, #330867)',
  'linear-gradient(135deg, #a8edea, #fed6e3)',
  'linear-gradient(135deg, #ff9a9e, #fecfef)',
  'linear-gradient(135deg, #ffecd2, #fcb69f)',
];

// ===== 朋友圈（Moments）数据 =====
// 已有的朋友圈动态（供浏览）
const MOMENTS = [
  {
    id: 1,
    author: '拉齐亚',
    avatar: '拉',
    avatarColor: 'linear-gradient(135deg, #5a8dee, #3a6fd8)',
    time: '昨天',
    text: '训练结束，好累。',
    images: ['linear-gradient(135deg, #667eea, #764ba2)'],
    likes: ['战队群·教练'],
    comments: []
  },
  {
    id: 2,
    author: '极速贷·小助手',
    avatar: DEFAULT_AVATAR,
    avatarColor: '#e5e5ea',
    time: '2天前',
    text: '【极速贷】无抵押信用贷款，最高可借20万！日息低至0.02%，随借随还，3分钟到账。点击链接立即申请→',
    images: [],
    likes: [],
    comments: []
  },
  {
    id: 3,
    author: '还款提醒',
    avatar: DEFAULT_AVATAR,
    avatarColor: '#e5e5ea',
    time: '3天前',
    text: '您本月的信用卡账单已出，最低还款额￥1,280.00，最后还款日为每月10号，请及时还款避免逾期影响征信。',
    images: [],
    likes: [],
    comments: []
  },
  {
    id: 4,
    author: '平安普惠',
    avatar: DEFAULT_AVATAR,
    avatarColor: '#e5e5ea',
    time: '5天前',
    text: '【平安普惠】保单贷/车抵贷/房抵贷，有资产即可贷，额度高达50万，利率0.65%起，线上申请不面签。',
    images: [],
    likes: [],
    comments: []
  },
  {
    id: 5,
    author: '借呗',
    avatar: DEFAULT_AVATAR,
    avatarColor: '#e5e5ea',
    time: '1周前',
    text: '您的借呗额度已提升至￥30,000，年化利率低至10.95%，借款1万元日息仅需3元。',
    images: [],
    likes: [],
    comments: []
  },
  {
    id: 6,
    author: '拉齐亚',
    avatar: '拉',
    avatarColor: 'linear-gradient(135deg, #5a8dee, #3a6fd8)',
    time: '一年前',
    text: '打职业去了，之后不再接单。',
    images: [],
    likes: [],
    comments: []
  }
];

// ===== 游戏流程：朋友圈文案 =====
// 第一阶段输入的文字（自动输入到这里，触发生真第一条消息）
const MOMENTS_POST_PHASE1 = '无偿领养，幼犬，应该混了一定边牧血统，总之看起来很像一只黑白色边牧，温顺粘人';

// 第二阶段完整文字（在"无偿领养"后插入"糖糖"，并补充后半段）
const MOMENTS_POST_FULL = '无偿领养，糖糖，幼犬，应该混了一定边牧血统，总之看起来很像一只黑白色边牧，温顺粘人，可以赠送很多宠物相关用品，距离最好不要太远，可以帮忙送狗上门。';

// 聊天触发点：聊到这条消息后，切回朋友圈继续输入
const CHAT_TRIGGER_MSG = '>ᴗoಣ感觉好久好久没听到过你的声音了。';

// 头像更换触发点：生真发完这条消息后，头像更换为新照片
const SHENGZHEN_AVATAR_CHANGE_MSG = '【糖糖照片】它过得很好哦，毛都变亮了';

// ===== 设置项 =====
const SETTINGS = [
  { icon: '✈️', color: '#ff9500', label: '飞行模式' },
  { icon: '📶', color: '#0a84ff', label: 'Wi-Fi' },
  { icon: '🔵', color: '#0a84ff', label: '蓝牙' },
  { icon: '📱', color: '#5856d6', label: '蜂窝网络' },
  { icon: '🔔', color: '#ff3b30', label: '通知' },
  { icon: '🔊', color: '#ff3b30', label: '声音与触感' },
  { icon: '🌙', color: '#5856d6', label: '专注模式' },
  { icon: '⏳', color: '#8e8e93', label: '屏幕使用时间' },
  { icon: '⚙️', color: '#8e8e93', label: '通用' },
  { icon: '🎨', color: '#0a84ff', label: '显示与亮度' },
];
