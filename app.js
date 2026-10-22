/* ============================================================
   iPhone Simulator — 核心逻辑
   ============================================================ */

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

let currentView = 'lockView';
let passcodeInput = '';
let currentChat = null;
let currentApp = null;

/* ========== 游戏流程状态机 ==========
   Stages:
   'initial'        — 刚解锁，其他 App 全部锁定，仅可进入微信朋友圈
   'moments_phase1' — 朋友圈自动输入第一阶段文案
   'chat_phase1'    — 被强制切换到生真聊天，播放到触发消息为止
   'moments_phase2' — 回到朋友圈，文案补全"糖糖"及后半段，等待发送
   'moments_sent'   — 朋友圈已发送，可回复生真消息、可使用其他 App
*/
let gameStage = 'initial';
// 当前朋友圈输入框的文字
let momentsCurrentText = '';
// 当前光标位置（0 ~ text.length）
let momentsCursorPos = 0;
// 自动输入定时器
let autoTypeTimer = null;
// 自动输入是否暂停（被聊天打断时）
let autoTypePaused = false;
// 朋友圈文案是否已补全（补全后才允许点击发送）
let momentsDraftReady = false;
// 聊天中触发切换回朋友圈的标记
let chatTriggerFired = false;

// 生真头像阶段：'initial' = 初始头像（紫色糖果），'current' = 现有头像（shengzhen.png）
let shengzhenAvatarStage = 'initial';

// 已查看过的聊天记录（避免重复弹窗）
let chatViewed = {};

/* ========== 工具函数 ========== */
const pad = n => String(n).padStart(2, '0');

function getTimeStr() {
  const d = new Date();
  return `${(d.getHours() % 12) || 12}:${pad(d.getMinutes())}`;
}

function getDateStr() {
  const d = new Date();
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 ${days[d.getDay()]}`;
}

function getWeekdayShort() {
  const d = new Date();
  return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()];
}

// 判断头像是否为图片（支持 assets 路径、外链和 base64 data URI）
function isImageAvatar(avatar) {
  if (typeof avatar !== 'string') return false;
  return avatar.startsWith('data:image/') ||
    avatar.startsWith('assets/') ||
    /^https?:\/\//i.test(avatar) ||
    /\.(png|jpg|jpeg|gif|webp)$/i.test(avatar);
}

// 获取生真当前头像（触发糖糖照片消息后更换为新头像）
function getShengzhenAvatar() {
  return shengzhenAvatarStage === 'changed' ? 'assets/shengzhen_new.jpg' : 'assets/shengzhen_candy.jpg';
}

// 触发生真头像更换：更新状态、刷新已渲染的所有头像、弹出提示
function changeShengzhenAvatar() {
  if (shengzhenAvatarStage === 'changed') return;
  shengzhenAvatarStage = 'changed';
  const newSrc = getShengzhenAvatar();
  // 更新聊天界面中所有已渲染的生真头像
  document.querySelectorAll('.msg-row.them-row .msg-avatar img').forEach(img => {
    img.src = newSrc;
  });
  // 弹出提示：展示新头像（附件），点击确定关闭
  showAvatarChangeModal(newSrc);
}

// 弹出生真更换头像的提示弹窗（展示新头像图片）
function showAvatarChangeModal(newSrc) {
  const screen = $('#screen');
  if (!screen) {
    showLockedHint('生真更换了头像');
    return;
  }
  const modal = document.createElement('div');
  modal.className = 'avatar-change-modal';
  modal.innerHTML = `
    <div class="avatar-change-modal-card">
      <div class="avatar-change-modal-avatar">
        <img src="${newSrc}" />
      </div>
      <div class="avatar-change-modal-title">${OWNER.birthdayGirl} 更换了头像</div>
      <div class="avatar-change-modal-desc">点击查看新头像</div>
      <button class="avatar-change-modal-btn">确定</button>
    </div>
  `;
  const close = () => {
    modal.classList.add('hide');
    setTimeout(() => { if (modal.parentNode) modal.remove(); }, 300);
  };
  modal.querySelector('.avatar-change-modal-btn').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  screen.appendChild(modal);
  try { haptic('medium'); } catch (e) {}
  try { playSound('unlock'); } catch (e) {}
}

// 阶段解锁顺序（用于判断内容是否已解锁）
const STAGE_ORDER = [
  'initial',
  'moments_phase1',
  'chat_phase1',
  'moments_phase2',
  'moments_sent',
  'chat_phase2_done',
  'chat_phase3_done',
  'chat_phase4_done',
  'chat_phase5_done',
  'chat_phase6_done',
  'chat_phase7_done',
  'chat_phase8_done'
];
function isStageUnlocked(requiredStage) {
  if (!requiredStage || requiredStage === 'initial') return true;
  const requiredIdx = STAGE_ORDER.indexOf(requiredStage);
  // 未定义的阶段视为未解锁，避免剧透
  if (requiredIdx < 0) return false;
  return STAGE_ORDER.indexOf(gameStage) >= requiredIdx;
}

// 默认微信头像（灰色人形剪影）
const DEFAULT_AVATAR_SVG = `<svg viewBox="0 0 120 120" width="100%" height="100%"><circle cx="60" cy="60" r="60" fill="#c7c7cc"/><circle cx="60" cy="46" r="18" fill="#fff"/><path d="M28,100 C28,78 44,66 60,66 C76,66 92,78 92,100" fill="#fff"/></svg>`;

// 判断是否为默认头像
function isDefaultAvatar(avatar) {
  return avatar === 'default' || avatar === DEFAULT_AVATAR;
}

// 通用返回箭头（SVG 绘制，避免特殊字符不渲染）
const BACK_ARROW_SVG = `<svg width="12" height="20" viewBox="0 0 12 20" fill="none"><path d="M10 2L2 10L10 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ========== iOS 风格 SVG 图标库 ========== */
const IOS_ICONS = {
  // 系统 App 图标
  photos: `<svg viewBox="0 0 120 120" width="100%" height="100%"><rect width="120" height="120" rx="26" fill="#fff"/><g transform="translate(60,60)"><ellipse cx="0" cy="-30" rx="16" ry="26" fill="#ff9500" transform="rotate(0)"/><ellipse cx="0" cy="-30" rx="16" ry="26" fill="#ffcc00" transform="rotate(45)"/><ellipse cx="0" cy="-30" rx="16" ry="26" fill="#8ed43d" transform="rotate(90)"/><ellipse cx="0" cy="-30" rx="16" ry="26" fill="#34c7e0" transform="rotate(135)"/><ellipse cx="0" cy="-30" rx="16" ry="26" fill="#3aa8ff" transform="rotate(180)"/><ellipse cx="0" cy="-30" rx="16" ry="26" fill="#9b6bff" transform="rotate(225)"/><ellipse cx="0" cy="-30" rx="16" ry="26" fill="#ff6482" transform="rotate(270)"/><ellipse cx="0" cy="-30" rx="16" ry="26" fill="#ff4d4f" transform="rotate(315)"/><circle r="16" fill="#fff"/><circle r="10" fill="#fff" opacity="0.0"/></g></svg>`,
  mail: `<svg viewBox="0 0 120 120" width="100%" height="100%"><defs><linearGradient id="mailBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#5ac8ff"/><stop offset="100%" stop-color="#0a6cf5"/></linearGradient></defs><rect width="120" height="120" rx="26" fill="url(#mailBg)"/><rect x="24" y="38" width="72" height="50" rx="10" fill="#fff"/><path d="M26,42 L60,68 L94,42" fill="#cfe3ff"/><path d="M26,42 L60,68 L94,42 L94,40 L60,64 L26,40 Z" fill="#e8f2ff"/><path d="M24,40 L60,66 L96,40 L96,84 L24,84 Z" fill="#fff"/><path d="M24,40 L60,66 L96,40" fill="none" stroke="#c8dcff" stroke-width="1.5"/></svg>`,
  calendar: `<svg viewBox="0 0 120 120" width="100%" height="100%"><rect x="14" y="20" width="92" height="88" rx="14" fill="#fff"/><rect x="14" y="20" width="92" height="28" rx="14" fill="#ff3b30"/><rect x="14" y="38" width="92" height="10" fill="#ff3b30"/><text x="60" y="86" font-family="Arial" font-size="52" font-weight="bold" text-anchor="middle" fill="#000">17</text></svg>`,
  clock: `<svg viewBox="0 0 120 120" width="100%" height="100%"><circle cx="60" cy="60" r="50" fill="#fff"/><circle cx="60" cy="60" r="50" fill="none" stroke="#000" stroke-width="4"/><circle cx="60" cy="60" r="46" fill="none" stroke="#000" stroke-width="1"/><g stroke="#000" stroke-width="2"><line x1="60" y1="14" x2="60" y2="22"/><line x1="60" y1="98" x2="60" y2="106"/><line x1="14" y1="60" x2="22" y2="60"/><line x1="98" y1="60" x2="106" y2="60"/></g><line x1="60" y1="60" x2="60" y2="30" stroke="#000" stroke-width="3" stroke-linecap="round"/><line x1="60" y1="60" x2="80" y2="72" stroke="#000" stroke-width="3" stroke-linecap="round"/><circle cx="60" cy="60" r="3" fill="#000"/></svg>`,
  notes: `<svg viewBox="0 0 120 120" width="100%" height="100%"><rect x="18" y="16" width="84" height="92" rx="4" fill="#fffdf4"/><line x1="28" y1="32" x2="92" y2="32" stroke="#ffc933" stroke-width="3"/><line x1="28" y1="44" x2="92" y2="44" stroke="#e8e8e8" stroke-width="1.5"/><line x1="28" y1="56" x2="92" y2="56" stroke="#e8e8e8" stroke-width="1.5"/><line x1="28" y1="68" x2="92" y2="68" stroke="#e8e8e8" stroke-width="1.5"/><line x1="28" y1="80" x2="70" y2="80" stroke="#e8e8e8" stroke-width="1.5"/><path d="M75,82 L78,92 L88,84 Z" fill="#ffcc00"/></svg>`,
  weather: `<svg viewBox="0 0 120 120" width="100%" height="100%"><circle cx="42" cy="48" r="18" fill="#ffcc00"/><g fill="#ffcc00"><rect x="40" y="18" width="4" height="10" rx="2"/><rect x="40" y="68" width="4" height="10" rx="2"/><rect x="10" y="46" width="10" height="4" rx="2"/><rect x="64" y="46" width="10" height="4" rx="2"/><rect x="18" y="24" width="8" height="4" rx="2" transform="rotate(-45 22 26)"/><rect x="56" y="24" width="8" height="4" rx="2" transform="rotate(45 60 26)"/></g><path d="M40,72 C30,72 22,80 22,90 C22,100 30,106 40,106 L78,106 C90,106 98,98 98,86 C98,74 88,66 76,66 C72,56 60,50 48,52 C42,52 38,56 36,60 C34,66 36,70 40,72Z" fill="#fff"/></svg>`,
  voicememos: `<svg viewBox="0 0 120 120" width="100%" height="100%"><rect width="120" height="120" rx="26" fill="#1c1c1e"/><g stroke-linecap="round"><line x1="26" y1="72" x2="26" y2="72" stroke="#ff3b30" stroke-width="3"/><line x1="32" y1="66" x2="32" y2="78" stroke="#ff3b30" stroke-width="3"/><line x1="38" y1="60" x2="38" y2="84" stroke="#ff3b30" stroke-width="3"/><line x1="44" y1="50" x2="44" y2="94" stroke="#ff3b30" stroke-width="3"/><line x1="50" y1="44" x2="50" y2="100" stroke="#ff3b30" stroke-width="3"/><line x1="56" y1="56" x2="56" y2="88" stroke="#ff3b30" stroke-width="3"/></g><line x1="62" y1="32" x2="62" y2="100" stroke="#3aa8ff" stroke-width="3" stroke-linecap="round"/><circle cx="62" cy="36" r="5" fill="#3aa8ff"/><circle cx="62" cy="96" r="5" fill="#3aa8ff"/><g stroke-linecap="round"><line x1="70" y1="58" x2="70" y2="86" stroke="#fff" stroke-width="3"/><line x1="76" y1="52" x2="76" y2="92" stroke="#fff" stroke-width="3"/><line x1="82" y1="60" x2="82" y2="84" stroke="#fff" stroke-width="3"/><line x1="88" y1="64" x2="88" y2="80" stroke="#fff" stroke-width="3"/><line x1="94" y1="68" x2="94" y2="76" stroke="#fff" stroke-width="2.5"/></g></svg>`,
  settings: `<svg viewBox="0 0 120 120" width="100%" height="100%"><g fill="#8e8e93"><g transform="translate(60,60)"><g><circle r="22" fill="none" stroke="#8e8e93" stroke-width="6"/><circle r="9" fill="#c7c7cc"/><g fill="#8e8e93"><rect x="-4" y="-40" width="8" height="14" rx="2"/><rect x="-4" y="26" width="8" height="14" rx="2"/><rect x="-40" y="-4" width="14" height="8" rx="2"/><rect x="26" y="-4" width="14" height="8" rx="2"/><rect x="-30" y="-30" width="10" height="8" rx="2" transform="rotate(45)"/><rect x="20" y="-30" width="10" height="8" rx="2" transform="rotate(45)"/><rect x="-30" y="22" width="10" height="8" rx="2" transform="rotate(45)"/><rect x="20" y="22" width="10" height="8" rx="2" transform="rotate(45)"/></g></g></g></g></svg>`,
  maps: `<svg viewBox="0 0 120 120" width="100%" height="100%"><rect width="120" height="120" fill="#e8f5e9"/><path d="M0,40 L120,30 L120,120 L0,120Z" fill="#c8e6c9"/><path d="M20,60 Q60,40 100,55" stroke="#4caf50" stroke-width="3" fill="none"/><path d="M10,80 Q50,70 110,85" stroke="#66bb6a" stroke-width="2" fill="none"/><circle cx="60" cy="55" r="8" fill="#ff3b30"/><path d="M60,55 L60,45" stroke="#ff3b30" stroke-width="3"/></svg>`,
  phone: `<svg viewBox="0 0 120 120" width="100%" height="100%"><defs><linearGradient id="phoneBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#5cf25c"/><stop offset="100%" stop-color="#28c253"/></linearGradient></defs><rect width="120" height="120" rx="26" fill="url(#phoneBg)"/><path d="M38,30 C36,30 34,31 33,33 L28,44 C26,49 28,54 32,57 C42,65 55,78 63,88 C66,92 71,94 76,92 L87,87 C89,86 90,84 90,82 L90,72 C90,70 89,68 87,67 L77,63 C75,62 72,63 71,65 L67,70 C60,64 56,60 50,53 L55,49 C57,48 58,45 57,43 L53,33 C52,31 50,30 48,30 Z" fill="#fff"/></svg>`,
  safari: `<svg viewBox="0 0 120 120" width="100%" height="100%"><circle cx="60" cy="60" r="52" fill="#fff"/><circle cx="60" cy="60" r="52" fill="none" stroke="#e5e5ea" stroke-width="2"/><g stroke="#c7c7cc" stroke-width="1"><circle cx="60" cy="60" r="44" fill="none"/><circle cx="60" cy="60" r="36" fill="none"/></g><path d="M60,16 L64,60 L60,104 L56,60Z" fill="#ff3b30"/><path d="M16,60 L60,56 L104,60 L60,64Z" fill="#8e8e93"/><circle cx="60" cy="60" r="4" fill="#007aff"/></svg>`,
  wechat: `<svg viewBox="0 0 120 120" width="100%" height="100%"><path d="M40,22 C22,22 8,34 8,50 C8,59 13,67 22,73 L18,86 L33,78 C35,78 37,79 40,79 C42,79 44,79 46,78 C44,74 43,69 43,65 C43,47 55,33 71,33 C73,33 75,33 77,34 C72,27 64,22 55,22 C49,22 44,23 40,22Z" fill="#fff"/><path d="M82,42 C66,42 53,53 53,67 C53,75 57,82 64,87 L61,97 L73,91 C75,91 77,92 80,92 C98,92 112,81 112,67 C112,53 98,42 82,42Z" fill="#fff"/><circle cx="32" cy="44" r="4" fill="#000"/><circle cx="48" cy="44" r="4" fill="#000"/><circle cx="72" cy="62" r="4" fill="#000"/><circle cx="90" cy="62" r="4" fill="#000"/></svg>`,
  music: `<svg viewBox="0 0 120 120" width="100%" height="100%"><circle cx="60" cy="60" r="52" fill="none" stroke="#ff2d55" stroke-width="3"/><circle cx="60" cy="60" r="40" fill="none" stroke="#ff2d55" stroke-width="2"/><path d="M75,35 L75,72 C75,78 68,82 60,82 C52,82 45,78 45,72 C45,66 52,62 60,62 C64,62 67,63 70,65 L70,42 L85,38 L85,67" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="60" cy="82" r="8" fill="#fff"/><circle cx="85" cy="67" r="6" fill="#fff"/></svg>`,
  instagram: `<svg viewBox="0 0 120 120" width="100%" height="100%"><rect x="20" y="20" width="80" height="80" rx="18" fill="#fff"/><circle cx="60" cy="60" r="20" fill="none" stroke="#000" stroke-width="4"/><circle cx="60" cy="60" r="7" fill="#000"/><circle cx="80" cy="40" r="4" fill="#000"/></svg>`,
  camera: `<svg viewBox="0 0 120 120" width="100%" height="100%"><rect x="14" y="32" width="92" height="64" rx="10" fill="#333"/><rect x="40" y="22" width="40" height="16" rx="4" fill="#333"/><circle cx="60" cy="64" r="20" fill="#1a1a1a"/><circle cx="60" cy="64" r="14" fill="#2a2a2a"/><circle cx="55" cy="59" r="4" fill="#666"/><rect x="84" y="40" width="10" height="6" rx="2" fill="#ff3b30"/></svg>`,
};

// 获取 App 图标 / 头像 HTML
function getAppIconHTML(iconKey) {
  // 图片路径、外链或 base64 内嵌图片
  if (isImageAvatar(iconKey)) {
    return `<img src="${iconKey}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.style.display='none'"/>`;
  }
  if (IOS_ICONS[iconKey]) return IOS_ICONS[iconKey];
  // 兜底：返回 emoji
  return iconKey;
}

// iOS 风格导航栏 HTML
function navBar(title, backFn) {
  return `<div class="app-nav">
    <button class="nav-back" onclick="${backFn}">${BACK_ARROW_SVG}</button>
    <div class="nav-title">${title}</div>
    <div class="nav-right"></div>
  </div>`;
}

/* ========== 全屏功能 ========== */
function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    // 进入全屏
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (req) {
      req.call(el).then(() => {
        $('#phone').classList.add('fullscreen');
        updateFullscreenBtn();
      }).catch(() => {
        // 全屏 API 失败时，强制添加 fullscreen class
        $('#phone').classList.add('fullscreen');
        document.body.style.overflow = 'hidden';
        updateFullscreenBtn();
      });
    } else {
      $('#phone').classList.add('fullscreen');
      updateFullscreenBtn();
    }
  } else {
    // 退出全屏
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
    if (exit) {
      exit.call(document);
    }
    $('#phone').classList.remove('fullscreen');
    updateFullscreenBtn();
  }
}

function updateFullscreenBtn() {
  const btn = $('#fullscreenBtn');
  if (!btn) return;
  const isFs = document.fullscreenElement || document.webkitFullscreenElement || $('#phone').classList.contains('fullscreen');
  btn.textContent = isFs ? '⤢' : '⛶';
}

// 监听全屏状态变化
document.addEventListener('fullscreenchange', updateFullscreenBtn);
document.addEventListener('webkitfullscreenchange', updateFullscreenBtn);

// 动态设置 --vh CSS 变量，确保高度等于实际可视区域（解决移动端地址栏/黑边问题）
function syncViewportHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', vh + 'px');
}
window.addEventListener('resize', syncViewportHeight);
window.addEventListener('orientationchange', syncViewportHeight);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', syncViewportHeight);
} else {
  syncViewportHeight();
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncViewportHeight);
  window.visualViewport.addEventListener('scroll', syncViewportHeight);
}

/* ========== 触觉反馈 + 音效 ========== */
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  return audioCtx;
}

// 播放音效（type: click / unlock / error / message）
function playSound(type) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  let freq, duration, volume;
  switch(type) {
    case 'click':   freq = 800;  duration = 0.05; volume = 0.08; break;
    case 'unlock':  freq = 1200; duration = 0.15; volume = 0.12; break;
    case 'error':   freq = 200;  duration = 0.2;  volume = 0.12; break;
    case 'message': freq = 660;  duration = 0.08; volume = 0.1;  break;
    default:        freq = 800;  duration = 0.05; volume = 0.08;
  }

  osc.frequency.setValueAtTime(freq, now);
  if (type === 'unlock') {
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + duration);
  } else if (type === 'error') {
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + duration);
  }
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.start(now);
  osc.stop(now + duration);
}

// 触觉反馈（type: light / medium / heavy / success / error）
function haptic(type) {
  if (!navigator.vibrate) return;
  switch(type) {
    case 'light':   navigator.vibrate(10);  break;
    case 'medium':  navigator.vibrate(20);  break;
    case 'heavy':   navigator.vibrate(40);  break;
    case 'success': navigator.vibrate([10, 30, 10]); break;
    case 'error':   navigator.vibrate([50, 30, 50]); break;
    default:        navigator.vibrate(15);
  }
}

/* ========== 视图切换 ========== */
function showView(id) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`#${id}`).classList.add('active');
  currentView = id;
}

// 仅显示某个视图（不移除其他视图的 active），用于 App 动画时保持底层可见
function showViewKeepOthers(id) {
  $(`#${id}`).classList.add('active');
  currentView = id;
}

// 隐藏某个视图
function hideView(id) {
  $(`#${id}`).classList.remove('active');
}

/* ========== 锁屏 ========== */
function renderLockScreen() {
  $('#lockTime').textContent = getTimeStr();
  $('#lockDate').textContent = getDateStr();
  $$('.status-time').forEach(el => el.textContent = getTimeStr());

  // 渲染通知
  const notifContainer = $('#lockNotifications');
  notifContainer.innerHTML = LOCK_NOTIFICATIONS.map(n => {
    const iconHTML = IOS_ICONS[n.icon] ? IOS_ICONS[n.icon] : n.icon;
    return `
    <div class="lock-notif">
      <div class="lock-notif-icon" style="background:${n.iconBg};overflow:hidden;">${iconHTML}</div>
      <div class="lock-notif-body">
        <div class="lock-notif-title"><span>${n.title}</span><span class="lock-notif-time">${n.time}</span></div>
        <div class="lock-notif-text">${n.text}</div>
      </div>
    </div>`;
  }).join('');
}

function unlockPhone() {
  haptic('light');
  playSound('click');
  showView('passcodeView');
  passcodeInput = '';
  updatePasscodeDots();
}

function cancelPasscode() {
  haptic('light');
  showView('lockView');
}

/* ========== 密码 ========== */
function updatePasscodeDots() {
  const dots = $$('#passcodeDots span');
  dots.forEach((d, i) => {
    d.classList.remove('filled', 'error');
    if (i < passcodeInput.length) d.classList.add('filled');
  });
}

function inputPasscode(num) {
  if (passcodeInput.length >= 4) return;
  haptic('light');
  playSound('click');
  passcodeInput += num;
  updatePasscodeDots();
  if (passcodeInput.length === 4) {
    setTimeout(checkPasscode, 200);
  }
}

function deletePasscode() {
  haptic('light');
  passcodeInput = passcodeInput.slice(0, -1);
  updatePasscodeDots();
}

function checkPasscode() {
  if (passcodeInput === PASSCODE) {
    haptic('success');
    playSound('unlock');
    renderHomeScreen();
    showView('homeView');
    // 解锁后进入游戏初始阶段：其他 App 锁定，仅朋友圈可用
    gameStage = 'initial';
    updateAppLockState();
  } else {
    haptic('error');
    playSound('error');
    const dots = $$('#passcodeDots span');
    dots.forEach(d => d.classList.add('error'));
    setTimeout(() => {
      passcodeInput = '';
      updatePasscodeDots();
    }, 500);
  }
}

/* ========== 微信剧情消息系统 ========== */
// 已解锁到的消息索引（-1 表示尚未解锁任何消息）
let wechatUnlockedIndex = -1;

// 判断当前是否处于聊天界面（微信聊天详情页）
function isInChatView() {
  return !!document.querySelector('.wx-chat-detail');
}

// 判断当前是否处于微信聊天列表页
function isInWeChatListView() {
  return !!document.querySelector('.wx-list-wrap');
}

// 显示一条通知横幅
function showNotifBanner(notif) {
  // 剧情通知可以在任何界面弹出；普通通知仅在聊天外弹出
  if (!notif.onClick && isInChatView() && !notif.forceShow) return;

  const container = $('#notifBannerContainer');
  if (!container) return;
  // 同一时间只保留一条剧情通知
  if (notif.sticky) {
    container.querySelectorAll('.notification-banner.story').forEach(el => el.remove());
  }
  const banner = document.createElement('div');
  banner.className = 'notification-banner' + (notif.sticky ? ' story' : '');
  const iconHTML = IOS_ICONS['wechat'] || '💬';
  banner.innerHTML = `
    <div class="notif-banner-icon" style="background:#07C160;overflow:hidden;">${iconHTML}</div>
    <div class="notif-banner-body">
      <div class="notif-banner-title-row">
        <span class="notif-banner-app">微信</span>
        <span class="notif-banner-time">${notif.time || '现在'}</span>
      </div>
      <div class="notif-banner-text">${notif.text}</div>
    </div>
  `;
  banner.onclick = () => {
    banner.classList.add('hide');
    setTimeout(() => banner.remove(), 300);
    // 剧情通知：点击进入对应阶段的聊天
    if (typeof notif.onClick === 'function') {
      notif.onClick();
      return;
    }
    if (notif.autoSwitch) return; // 游戏流程中自动切换，点击无效
    playSound('message');
    haptic('light');
    // 点击通知：打开微信
    openApp('wechat');
  };
  container.appendChild(banner);

  // 触发滑入动画
  requestAnimationFrame(() => {
    requestAnimationFrame(() => banner.classList.add('show'));
  });

  // 非剧情通知 5 秒后自动消失；剧情通知保持到玩家点击
  if (!notif.sticky) {
    const autoHide = setTimeout(() => {
      if (banner.parentNode) {
        banner.classList.add('hide');
        setTimeout(() => banner.remove(), 300);
      }
    }, 5000);
    banner._autoHide = autoHide;
  }
}

// ===== 剧情聊天阶段控制 =====
// 当前待播放/待查看的聊天阶段索引（null 表示没有待播放阶段）
let pendingChatPhase = null;
// 阶段通知定时器
let phaseNotifyTimer = null;
// 生真未读消息数（玩家未打开聊天时累计）
let shengzhenUnread = 0;
// 正在播放的剧情阶段索引（防止同一阶段被重复播放）
let playingChatPhase = null;
// 聊天播放序列令牌：每次开始播放时递增，被取代的旧回调据此自动失效
let chatSeqToken = 0;
// 当前阶段下一条待播放消息的绝对索引（支持阶段中途切出后继续播放）
let chatPhaseCursor = 0;
// 玩家是否在剧情阶段播放途中切出了微信
let chatPhasePaused = false;

// 阶段播放途中离开聊天：暂停进度，回来时从断点继续
function pauseChatPlayback() {
  if (playingChatPhase === null) return;
  chatPhasePaused = true;
}

// 从聊天详情返回微信聊天列表
function leaveChatToWeChatList() {
  pauseChatPlayback();
  clearChatTimers();
  renderWeChat();
}

// 聊天中"对方"头像：生真用动态头像，其他账号一律用默认头像
function getChatThemAvatarHTML() {
  if (currentChat === OWNER.birthdayGirl) {
    return `<img src="${getShengzhenAvatar()}" />`;
  }
  const chat = CHATS[currentChat];
  if (chat && !isDefaultAvatar(chat.avatar) && isImageAvatar(chat.avatar)) {
    return `<img src="${chat.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />`;
  }
  return DEFAULT_AVATAR_SVG;
}

function getChatMessageList() {
  const chat = CHATS[OWNER.birthdayGirl];
  return chat ? chat.messages : [];
}

// 计算某个剧情阶段在消息数组中的起止索引
function getPhaseRange(phaseIdx) {
  const msgs = getChatMessageList();
  let start = 0;
  if (phaseIdx > 0) {
    const prevEnd = msgs.findIndex(m => m[0] === CHAT_PHASES[phaseIdx - 1].end);
    start = prevEnd >= 0 ? prevEnd + 1 : 0;
  }
  let end = msgs.findIndex(m => m[0] === CHAT_PHASES[phaseIdx].end);
  if (end < 0) end = msgs.length - 1;
  return { start, end };
}

// 刷新微信未读角标
function updateWeChatBadge() {
  const chat = CHATS[OWNER.birthdayGirl];
  if (chat) chat.unread = shengzhenUnread;
  const dockIcons = document.querySelectorAll('.dock .app-icon');
  const wechatIcon = dockIcons[2];
  if (!wechatIcon) return;
  let badge = wechatIcon.querySelector('.app-icon-badge');
  const total = Object.values(CHATS).reduce((sum, c) => sum + (c.unread || 0), 0);
  if (total > 0) {
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'app-icon-badge';
      wechatIcon.appendChild(badge);
    }
    badge.textContent = total > 99 ? '99+' : total;
  } else if (badge) {
    badge.remove();
  }
}

// 安排下一个剧情阶段
function scheduleChatPhase(phaseIdx, delay) {
  pendingChatPhase = phaseIdx;
  if (phaseNotifyTimer) clearTimeout(phaseNotifyTimer);
  phaseNotifyTimer = setTimeout(() => deliverChatPhase(phaseIdx), delay);
}

// 阶段到点：弹出可点击的微信通知（即使在聊天界面也提示，由玩家点击推进）
function deliverChatPhase(phaseIdx) {
  if (pendingChatPhase !== phaseIdx) return;
  const range = getPhaseRange(phaseIdx);
  const msgs = getChatMessageList().slice(range.start, range.end + 1);
  const firstThem = msgs.find(m => m[1] === 'them');

  // 第七阶段只有主角自己的消息，静默写入聊天记录
  if (!firstThem) {
    completeChatPhase(phaseIdx, true);
    return;
  }

  shengzhenUnread++;
  updateWeChatBadge();
  if (isInWeChatListView()) renderWeChat();
  showNotifBanner({
    text: firstThem[0],
    time: firstThem[2] || '现在',
    sticky: true,
    onClick: () => enterChatForPhase(phaseIdx)
  });
}

// 点击通知进入对应阶段的聊天
function enterChatForPhase(phaseIdx) {
  // 已在播放同一阶段：忽略重复触发（例如通知横幅被快速连点）
  if (playingChatPhase === phaseIdx && currentChat === OWNER.birthdayGirl && isInChatView()) return;
  playSound('message');
  haptic('light');
  if (currentApp !== 'wechat') {
    const dockIcons = document.querySelectorAll('.dock .app-icon');
    openApp('wechat', dockIcons[2] || null);
    // 若 openApp 已直接进入聊天，则不再重复打开
    setTimeout(() => {
      if (!(currentChat === OWNER.birthdayGirl && isInChatView())) {
        openChat(OWNER.birthdayGirl);
      }
    }, 420);
  } else {
    openChat(OWNER.birthdayGirl);
  }
}

// 一个剧情阶段播放完毕
function completeChatPhase(phaseIdx, silent) {
  const def = CHAT_PHASES[phaseIdx];
  const range = getPhaseRange(phaseIdx);
  wechatUnlockedIndex = Math.max(wechatUnlockedIndex, range.end);
  pendingChatPhase = null;
  playingChatPhase = null;
  chatPhasePaused = false;
  chatPhaseCursor = 0;
  gameStage = def.stage;
  updateAppLockState();
  updateWeChatBadge();

  if (def.returnToMoments) {
    setTimeout(returnToMomentsPhase2, 1500);
    return;
  }

  if (silent && isInWeChatListView()) renderWeChat();

  const next = phaseIdx + 1;
  if (next < CHAT_PHASES.length) {
    // 第六阶段之后的独白阶段节奏稍快
    scheduleChatPhase(next, phaseIdx === 6 ? 2500 : 6000);
  }
}

/* ========== 主屏幕 ========== */
function renderHomeScreen() {
  // 小组件日历
  $('#widgetCalDay').textContent = getWeekdayShort();
  $('#widgetCalDate').textContent = new Date().getDate();

  // App 网格
  const grid = $('#appGrid');
  grid.innerHTML = APPS.map(app => `
    <div class="app-icon" onclick="openApp('${app.id}', this)">
      <div class="app-icon-img" style="background:${app.color};overflow:hidden;">${getAppIconHTML(app.icon)}</div>
      ${app.badge ? `<div class="app-icon-badge">${app.badge}</div>` : ''}
      <div class="app-icon-label">${app.name}</div>
    </div>
  `).join('');

  // Dock
  const dock = $('#dock');
  dock.innerHTML = DOCK_APPS.map(app => `
    <div class="app-icon" onclick="openApp('${app.id}', this)">
      <div class="app-icon-img" style="background:${app.color};overflow:hidden;">${getAppIconHTML(app.icon)}</div>
      ${app.badge ? `<div class="app-icon-badge">${app.badge}</div>` : ''}
    </div>
  `).join('');

  // 根据游戏阶段更新图标锁定状态
  updateAppLockState();
}

// 记录上一个打开的 App 图标元素，用于关闭动画
let lastAppIconEl = null;

function goHome() {
  haptic('medium');
  playSound('click');
  // 阶段播放途中回桌面：记录断点，回来继续
  pauseChatPlayback();
  clearChatTimers();
  const appView = $('#appView');

  // 先确保主屏在底层可见（避免黑屏）
  showViewKeepOthers('homeView');

  if (lastAppIconEl) {
    const iconRect = lastAppIconEl.querySelector('.app-icon-img').getBoundingClientRect();
    const screenRect = $('#screen').getBoundingClientRect();
    const scale = iconRect.width / screenRect.width;
    const tx = iconRect.left + iconRect.width/2 - (screenRect.left + screenRect.width/2);
    const ty = iconRect.top + iconRect.height/2 - (screenRect.top + screenRect.height/2);
    appView.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease';
    appView.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    appView.style.opacity = '0';
    setTimeout(() => {
      // 仅当没有打开新 App 时才隐藏 App 视图
      if (currentApp === null) {
        hideView('appView');
        appView.style.transition = 'none';
        appView.style.transform = '';
        appView.style.opacity = '';
        currentView = 'homeView';
      }
    }, 300);
  } else {
    hideView('appView');
    currentView = 'homeView';
  }
  currentApp = null;
}

/* ========== App 路由 ========== */
function openApp(id, iconEl) {
  // 游戏流程访问控制
  const lockedStages = ['initial', 'moments_phase1', 'chat_phase1', 'moments_phase2'];
  if (lockedStages.includes(gameStage) && id !== 'wechat') {
    showLockedHint('请先完成朋友圈发布');
    haptic('error');
    return;
  }

  haptic('light');
  currentApp = id;
  lastAppIconEl = iconEl || null;
  const content = $('#appContent');
  content.innerHTML = '';
  content.scrollTop = 0;

  // 游戏初始阶段：打开微信显示聊天列表，用户需通过「发现→朋友圈」进入发布
  if (id === 'wechat' && gameStage === 'initial') {
    renderWeChat();
  } else if (id === 'wechat' && gameStage === 'moments_phase1') {
    // 继续第一阶段自动输入
    renderMomentsCompose();
    startAutoTyping('phase1');
  } else if (id === 'wechat' && gameStage === 'moments_phase2') {
    // 第二阶段补全由现有定时器继续驱动，这里恢复界面与键盘
    renderMomentsCompose();
    const kb = $('#simKeyboard');
    if (kb) kb.classList.add('show');
  } else if (id === 'wechat' && gameStage === 'chat_phase1') {
    // 被生真消息打断后，微信直接进入和生真的对话
    openChat(OWNER.birthdayGirl);
  } else {
    switch (id) {
      case 'wechat': renderWeChat(); break;
      case 'notes': renderNotes(); break;
      case 'voicememos': renderVoiceMemos(); break;
      case 'photos': renderPhotos(); break;
      case 'weather': renderWeather(); break;
      case 'clock': renderClock(); break;
      case 'calendar': renderCalendar(); break;
      case 'settings': renderSettings(); break;
      case 'music': renderMusic(); break;
      case 'safari': renderSafari(); break;
      case 'phone': renderPhone(); break;
      case 'mail': renderMail(); break;
      case 'instagram': renderInstagram(); break;
      case 'maps': renderMaps(); break;
      default: renderPlaceholder(id);
    }
  }

  // 打开动画：从图标位置放大到全屏
  const appView = $('#appView');
  const homeView = $('#homeView');

  if (iconEl) {
    const iconRect = iconEl.querySelector('.app-icon-img').getBoundingClientRect();
    const screenRect = $('#screen').getBoundingClientRect();
    const scale = iconRect.width / screenRect.width;
    const tx = iconRect.left + iconRect.width/2 - (screenRect.left + screenRect.width/2);
    const ty = iconRect.top + iconRect.height/2 - (screenRect.top + screenRect.height/2);
    // 先设置起始状态（无过渡）
    appView.style.transition = 'none';
    appView.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    appView.style.opacity = '0';
    // 显示 App 视图，但保留主屏在底层（避免黑屏）
    showViewKeepOthers('appView');
    // 下一帧触发动画到全屏
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        appView.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
        appView.style.transform = 'translate(0, 0) scale(1)';
        appView.style.opacity = '1';
        // 动画结束后隐藏底层主屏
        setTimeout(() => {
          if (currentApp === id) {
            homeView.classList.remove('active');
          }
        }, 350);
      });
    });
  } else {
    showView('appView');
  }
}

// 显示 App 锁定提示
function showLockedHint(msg) {
  const screen = $('#screen');
  const existing = screen.querySelector('.app-locked-hint');
  if (existing) existing.remove();
  const hint = document.createElement('div');
  hint.className = 'app-locked-hint';
  hint.textContent = msg || '暂不可用';
  screen.appendChild(hint);
  setTimeout(() => hint.remove(), 2000);
}

// 根据游戏阶段更新桌面图标锁定状态
function updateAppLockState() {
  const lockedStages = ['initial', 'moments_phase1', 'chat_phase1', 'moments_phase2'];
  const locked = lockedStages.includes(gameStage);
  $$('.app-icon').forEach(el => {
    const onclick = el.getAttribute('onclick') || '';
    if (locked && !onclick.includes("'wechat'")) {
      el.classList.add('disabled');
    } else {
      el.classList.remove('disabled');
    }
  });
}

/* ============================================================
   朋友圈发布页 + 模拟键盘 + 自动输入
   ============================================================ */

// 渲染朋友圈发布（编辑）页
function renderMomentsCompose() {
  const content = $('#appContent');
  const canSend = momentsDraftReady && gameStage === 'moments_phase2';
  content.innerHTML = `
    <div class="moments-compose">
      <div class="moments-compose-header">
        <button class="compose-cancel" onclick="cancelMomentsCompose()">取消</button>
        <div class="compose-title">发表文字</div>
        <button class="compose-send" id="momentsSendBtn" ${canSend ? '' : 'disabled'} onclick="sendMomentsPost()">发送</button>
      </div>
      <div class="moments-compose-body">
        <div class="moments-compose-textarea" id="momentsTextarea" contenteditable="false"></div>
        <div class="moments-compose-hint" id="momentsHint">
          ${gameStage === 'moments_phase1' ? '正在编辑领养启事…' : gameStage === 'moments_phase2' ? (momentsDraftReady ? '文案已完成，点击右上角发送' : '正在补全文案…') : ''}
        </div>
      </div>
      ${renderKeyboard()}
    </div>
  `;
  updateMomentsTextDisplay();
}

// 渲染模拟 26 键键盘
function renderKeyboard() {
  const rows = [
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L'],
    ['Z','X','C','V','B','N','M']
  ];
  let html = '<div class="keyboard" id="simKeyboard">';
  rows.forEach((row, ri) => {
    html += '<div class="keyboard-row">';
    if (ri === 2) {
      html += `<div class="keyboard-key wide" data-key="shift">⇧</div>`;
    }
    row.forEach(k => {
      html += `<div class="keyboard-key" data-key="${k}">${k}</div>`;
    });
    if (ri === 2) {
      html += `<div class="keyboard-key wide" data-key="delete">⌫</div>`;
    }
    html += '</div>';
  });
  html += `<div class="keyboard-row">
    <div class="keyboard-key wide" data-key="123">123</div>
    <div class="keyboard-key space" data-key="space">空格</div>
    <div class="keyboard-key return" data-key="return">发送</div>
  </div>`;
  html += '</div>';
  return html;
}

// 更新朋友圈输入框显示的文字（光标位置由 momentsCursorPos 决定）
function updateMomentsTextDisplay() {
  const area = $('#momentsTextarea');
  if (!area) return;
  if (momentsCurrentText) {
    const pos = Math.min(Math.max(0, momentsCursorPos), momentsCurrentText.length);
    const before = momentsCurrentText.slice(0, pos);
    const after = momentsCurrentText.slice(pos);
    area.innerHTML = '';
    if (before) {
      area.appendChild(document.createTextNode(before));
    }
    // 光标
    const cursor = document.createElement('span');
    cursor.className = 'moments-compose-cursor';
    area.appendChild(cursor);
    if (after) {
      area.appendChild(document.createTextNode(after));
    }
  } else {
    area.innerHTML = '<span style="color:#555;">这一刻的想法…</span>';
  }
}

// 高亮键盘上的某个键（带弹跳动画）
function highlightKeyboardKey(keyChar) {
  const key = keyChar ? keyChar.toUpperCase() : '';
  const keyEl = document.querySelector(`.keyboard-key[data-key="${key}"]`);
  if (keyEl) {
    // 移除再添加，确保动画重新触发
    keyEl.classList.remove('highlight', 'pressed');
    // 强制重排以重启动画
    void keyEl.offsetWidth;
    keyEl.classList.add('highlight');
    keyEl.classList.add('pressed');
    setTimeout(() => {
      keyEl.classList.remove('highlight');
      keyEl.classList.remove('pressed');
    }, 220);
  }
}

// 启动自动输入
function startAutoTyping(phase) {
  if (autoTypeTimer) {
    clearTimeout(autoTypeTimer);
    autoTypeTimer = null;
  }
  autoTypePaused = false;
  momentsDraftReady = false;

  // 显示键盘滑入动画
  const kb = $('#simKeyboard');
  if (kb) {
    kb.classList.add('show');
  }

  // 等待键盘滑入动画完成后再开始打字
  const startTyping = () => {
    if (phase === 'phase1') {
      momentsCursorPos = momentsCurrentText.length;
      if (momentsCurrentText.length < MOMENTS_INTERRUPT_AT) {
        // 先输入到"被消息打断"的位置
        typeTextSequence(MOMENTS_POST_PHASE1, momentsCurrentText.length, null, MOMENTS_INTERRUPT_AT);
      } else {
        // 从聊天返回后继续补全第一阶段文案，完成后进入第二阶段补全
        typeTextSequence(MOMENTS_POST_PHASE1, momentsCurrentText.length, () => {
          startPhase2Typing();
        });
      }
    } else if (phase === 'phase2') {
      startPhase2Typing();
    }
  };
  autoTypeTimer = setTimeout(startTyping, 350);
}

// 逐字输入文本序列（光标始终在末尾）
// 加入真实输入的纠结感：基础速度变慢，随机插入较长停顿
// stopAt：输入到指定字符数时停下，触发剧情打断（null 表示不打断）
function typeTextSequence(targetText, startIdx, onDone, stopAt) {
  let i = startIdx;
  const typeNext = () => {
    if (autoTypePaused) {
      autoTypeTimer = setTimeout(typeNext, 100);
      return;
    }
    if (i >= targetText.length) {
      autoTypeTimer = null;
      if (onDone) onDone();
      return;
    }
    if (stopAt != null && i >= stopAt) {
      autoTypeTimer = null;
      onMomentsTypingInterrupted();
      return;
    }
    const ch = targetText[i];
    momentsCurrentText = targetText.slice(0, i + 1);
    momentsCursorPos = momentsCurrentText.length;
    updateMomentsTextDisplay();
    highlightKeyboardKey(mapCharToKey(ch));
    playSound('click');
    i++;
    // 朋友圈文案输入：速度较快（拉齐亚在认真编辑文案）
    let delay = 80 + Math.random() * 100;
    // 标点符号后稍作停顿
    if (/[，。、；：！？,.!?;:]/.test(ch)) {
      delay += 200 + Math.random() * 300;
    }
    // 偶尔思考停顿（约8%概率）
    if (Math.random() < 0.08) {
      delay += 300 + Math.random() * 500;
    }
    autoTypeTimer = setTimeout(typeNext, delay);
  };
  typeNext();
}

// 第二阶段完整流程：光标回移 → 输入"糖糖，" → 光标跳至末尾 → 输入后半段
function startPhase2Typing() {
  momentsDraftReady = false;
  // 1. 当前文字为 phase1 结果，光标在末尾
  momentsCurrentText = MOMENTS_POST_PHASE1;
  momentsCursorPos = momentsCurrentText.length;
  updateMomentsTextDisplay();

  // 2. 光标动画移动到 "无偿领养，" 之后（索引 5）
  const insertPos = '无偿领养，'.length; // = 5
  animateCursorTo(insertPos, () => {
    // 3. 在光标处逐字插入 "糖糖，"
    const insertText = '糖糖，';
    insertTextAtCursor(insertText, () => {
      // 4. 光标动画移动到文字末尾
      animateCursorTo(momentsCurrentText.length, () => {
        // 5. 逐字补全后半段
        const restText = '，可以赠送很多宠物相关用品，距离最好不要太远，可以帮忙送狗上门。';
        const fullTarget = momentsCurrentText + restText;
        typeTextSequence(fullTarget, momentsCurrentText.length, () => {
          // 第二阶段完成：启用发送按钮
          momentsDraftReady = true;
          const btn = $('#momentsSendBtn');
          if (btn) btn.disabled = false;
          const hint = $('#momentsHint');
          if (hint) hint.textContent = '文案已完成，点击右上角发送';
        });
      });
    });
  });
}

// 在当前光标位置逐字插入文本
function insertTextAtCursor(text, onDone) {
  let i = 0;
  const typeNext = () => {
    if (autoTypePaused) {
      autoTypeTimer = setTimeout(typeNext, 100);
      return;
    }
    if (i >= text.length) {
      autoTypeTimer = null;
      if (onDone) onDone();
      return;
    }
    const ch = text[i];
    const pos = momentsCursorPos;
    momentsCurrentText = momentsCurrentText.slice(0, pos) + ch + momentsCurrentText.slice(pos);
    momentsCursorPos = pos + 1;
    updateMomentsTextDisplay();
    highlightKeyboardKey(mapCharToKey(ch));
    playSound('click');
    i++;
    // 插入文字也用较快速度
    let delay = 80 + Math.random() * 100;
    if (/[，。、；：！？,.!?;:]/.test(ch)) {
      delay += 200 + Math.random() * 300;
    }
    if (Math.random() < 0.08) {
      delay += 300 + Math.random() * 500;
    }
    autoTypeTimer = setTimeout(typeNext, delay);
  };
  typeNext();
}

// 光标逐格动画移动到目标位置
function animateCursorTo(targetPos, onDone) {
  const step = () => {
    if (autoTypePaused) {
      autoTypeTimer = setTimeout(step, 100);
      return;
    }
    if (momentsCursorPos === targetPos) {
      autoTypeTimer = null;
      if (onDone) onDone();
      return;
    }
    if (momentsCursorPos < targetPos) {
      momentsCursorPos++;
    } else {
      momentsCursorPos--;
    }
    updateMomentsTextDisplay();
    autoTypeTimer = setTimeout(step, 60);
  };
  step();
}

// 将中文字符映射到键盘按键（用于视觉高亮，不影响实际输入）
function mapCharToKey(ch) {
  // 简单映射：用字符 charCode 取模映射到某一行的键
  const keys = ['Q','W','E','R','T','Y','U','I','O','P','A','S','D','F','G','H','J','K','L','Z','X','C','V','B','N','M'];
  if (!ch) return '';
  const code = ch.charCodeAt(0);
  return keys[code % keys.length];
}

// 朋友圈输入被生真的消息打断：暂停输入，弹出可点击的微信通知
function onMomentsTypingInterrupted() {
  if (gameStage !== 'moments_phase1') return;
  gameStage = 'chat_phase1';
  autoTypePaused = true;
  if (autoTypeTimer) {
    clearTimeout(autoTypeTimer);
    autoTypeTimer = null;
  }

  const chat = CHATS[OWNER.birthdayGirl];
  const firstThem = chat.messages.find(m => m[1] === 'them');
  pendingChatPhase = 0;
  shengzhenUnread++;
  updateWeChatBadge();
  showNotifBanner({
    text: firstThem ? firstThem[0] : '生真发来一条消息',
    time: firstThem ? (firstThem[2] || '现在') : '现在',
    sticky: true,
    onClick: () => enterChatForPhase(0)
  });
  playSound('message');
  haptic('medium');
}

// 切回朋友圈输入界面：先补完第一阶段文案，再自动补全"糖糖"和后半段
function returnToMomentsPhase2() {
  autoTypePaused = false;
  momentsDraftReady = false;
  renderMomentsCompose();
  // 重新显示模拟键盘并继续补全文案
  startAutoTyping('phase1');
}

// 从聊天返回朋友圈（用户点击返回键时）
function returnToMomentsFromChat() {
  clearChatTimers();
  if (gameStage === 'chat_phase1') {
    // 剧情未播放完，不允许提前离开
    showLockedHint('请先看完生真的消息');
    return;
  }
  if (gameStage === 'moments_phase2') {
    returnToMomentsPhase2();
    return;
  }
  renderWeChat();
}

// 取消朋友圈编辑
function cancelMomentsCompose() {
  if (gameStage === 'moments_phase1' || gameStage === 'moments_phase2') {
    showLockedHint('请先完成文案发送');
    return;
  }
  goHome();
}

// 发送朋友圈
function sendMomentsPost() {
  if (gameStage !== 'moments_phase2' || !momentsDraftReady) return;
  if (autoTypeTimer) {
    clearTimeout(autoTypeTimer);
    autoTypeTimer = null;
  }
  // 将这条动态加入朋友圈数据
  MOMENTS.unshift({
    id: Date.now(),
    author: OWNER.name,
    avatar: getAppIconHTML(OWNER.avatar),
    avatarColor: 'transparent',
    time: '刚刚',
    text: MOMENTS_POST_FULL,
    images: [],
    likes: [],
    comments: []
  });
  gameStage = 'moments_sent';
  haptic('success');
  playSound('unlock');
  // 解锁所有 App
  updateAppLockState();
  // 显示朋友圈列表（含刚发的动态）
  renderMomentsFeed();
  // 朋友圈发出后，进入第二阶段对话（弹出生真的新消息通知）
  scheduleChatPhase(1, 2200);
}

// 显示"生真发来消息"的系统提示
function showAvatarChangeNotice() {
  const content = $('#appContent');
  if (!content) return;
  const notice = document.createElement('div');
  notice.className = 'avatar-change-notice';
  notice.innerHTML = `
    <div class="avatar-change-icon">
      <img src="assets/shengzhen_candy.jpg" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />
    </div>
    <div class="avatar-change-text">
      <div class="avatar-change-title">${OWNER.birthdayGirl} 发来一条消息</div>
      <div class="avatar-change-desc">点击查看</div>
    </div>
  `;
  notice.onclick = () => {
    notice.remove();
    openChat(OWNER.birthdayGirl);
  };
  content.appendChild(notice);
  // 6秒后自动消失
  setTimeout(() => {
    if (notice.parentNode) {
      notice.classList.add('hide');
      setTimeout(() => notice.remove(), 300);
    }
  }, 6000);
}

// 渲染朋友圈信息流
function renderMomentsFeed() {
  const content = $('#appContent');
  content.innerHTML = `
    <div class="moments-wrap">
      <div class="moments-header">
        <button class="nav-back" onclick="renderWeChat()">${BACK_ARROW_SVG}</button>
        <div class="nav-title">朋友圈</div>
        <div class="nav-right" onclick="renderMomentsCompose()">📷</div>
      </div>
      <div class="moments-cover"></div>
      <div class="moments-profile">
        <div class="moments-avatar" style="background:transparent;">${getAppIconHTML(OWNER.avatar)}</div>
        <div class="moments-profile-info">
          <div class="moments-name">${OWNER.wechatName}</div>
          ${OWNER.signature ? `<div class="moments-signature">${OWNER.signature}</div>` : ''}
        </div>
      </div>
      <div class="moments-feed">
        ${MOMENTS.map(m => {
          const isOwner = m.author === OWNER.name;
          let avatarHTML;
          if (isOwner) {
            avatarHTML = getAppIconHTML(OWNER.avatar);
          } else if (isDefaultAvatar(m.avatar)) {
            avatarHTML = DEFAULT_AVATAR_SVG;
          } else {
            avatarHTML = m.avatar;
          }
          const avatarBg = isOwner ? 'transparent' : m.avatarColor;
          const displayAuthor = isOwner ? OWNER.wechatName : m.author;
          return `
          <div class="moment-item">
            <div class="moment-avatar" style="background:${avatarBg};">${avatarHTML}</div>
            <div class="moment-body">
              <div class="moment-author">${displayAuthor}</div>
              <div class="moment-text">${m.text}</div>
              ${m.images && m.images.length ? `<div class="moment-images">${m.images.map(img => `<div class="moment-img" style="background:${img}"></div>`).join('')}</div>` : ''}
              <div class="moment-footer">
                <span class="moment-time">${m.time}</span>
                <span class="moment-actions"><span>💬</span><span>❤️</span></span>
              </div>
              ${(m.likes && m.likes.length) || (m.comments && m.comments.length) ? `
                <div class="moment-comments">
                  ${m.likes && m.likes.length ? `<div class="moment-likes">❤️ ${m.likes.join('、')}</div>` : ''}
                  ${m.comments && m.comments.map(c => {
                    const commentUser = (c.user === OWNER.name) ? OWNER.wechatName : c.user;
                    return `<div class="moment-comment"><b>${commentUser}：</b>${c.text}</div>`;
                  }).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `;
        }).join('')}
      </div>
    </div>
  `;
}

/* ========== 微信 App ========== */
function renderWeChat() {
  const content = $('#appContent');
  // 朋友圈发送前：不显示任何未读数
  const chatsUnlocked = isStageUnlocked('moments_sent');
  const totalUnread = chatsUnlocked ? Object.values(CHATS).reduce((sum, c) => sum + (c.unread || 0), 0) : 0;
  // 朋友圈发送后才允许进入聊天（剧情强制入口例外）
  const canEnterChats = chatsUnlocked || pendingChatPhase !== null;
  content.innerHTML = `
    <div class="wx-list-wrap">
      <div class="wx-list-header">
        <div class="wx-list-title">微信${totalUnread > 0 ? `<span class="wx-list-count">(${totalUnread})</span>` : ''}</div>
        <div class="wx-list-actions">
          <span class="wx-action-icon" title="搜索">🔍</span>
          <span class="wx-action-icon" title="添加">＋</span>
        </div>
      </div>
      <div class="wx-chat-list">
        ${Object.entries(CHATS).map(([name, chat]) => {
          let lastTime = getLastChatTime(chat);
          let lastText = getLastChatText(chat);
          // 朋友圈发送前：所有聊天都不显示任何消息预览和时间
          if (!chatsUnlocked) {
            lastText = '';
            lastTime = '';
          }
          // 生真的聊天只显示已解锁的最新消息，避免剧透
          if (name === OWNER.birthdayGirl) {
            lastText = '';
            lastTime = '';
            if (wechatUnlockedIndex >= 0) {
              const visibleMsgs = chat.messages.slice(0, wechatUnlockedIndex + 1);
              for (let i = visibleMsgs.length - 1; i >= 0; i--) {
                if (visibleMsgs[i][1] !== 'date') {
                  lastText = visibleMsgs[i][0];
                  lastTime = visibleMsgs[i][2] || lastTime;
                  break;
                }
              }
            }
          }
          // 头像渲染：生真用动态头像，其他人用默认头像
          let avatarHTML;
          if (name === OWNER.birthdayGirl) {
            const avatarSrc = getShengzhenAvatar();
            avatarHTML = `<img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />`;
          } else if (isDefaultAvatar(chat.avatar)) {
            avatarHTML = DEFAULT_AVATAR_SVG;
          } else {
            const avatarSrc = chat.avatar;
            avatarHTML = isImageAvatar(avatarSrc)
              ? `<img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />`
              : avatarSrc;
          }
          const clickHandler = canEnterChats
            ? `openChat('${name}')`
            : `showLockedHint('发送朋友圈后即可查看聊天')`;
          // 朋友圈发送前：隐藏所有未读标记
          const unreadCount = name === OWNER.birthdayGirl ? shengzhenUnread : (chat.unread || 0);
          const showUnread = chatsUnlocked && unreadCount > 0;
          return `
          <div class="wx-chat-item" onclick="${clickHandler}">
            <div class="wx-chat-avatar" style="background:${name === OWNER.birthdayGirl ? 'transparent' : chat.avatarColor};">
              ${avatarHTML}
              ${showUnread ? `<span class="wx-unread-dot">${unreadCount > 99 ? '99+' : unreadCount}</span>` : ''}
            </div>
            <div class="wx-chat-body">
              <div class="wx-chat-row1">
                <span class="wx-chat-name">${name}</span>
                ${lastTime ? `<span class="wx-chat-time">${lastTime}</span>` : ''}
              </div>
              <div class="wx-chat-row2">
                <span class="wx-chat-preview">${lastText}</span>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="wx-tabbar">
        <div class="wx-tab active" onclick="renderWeChat()">
          <span class="wx-tab-icon">💬</span>
          <span class="wx-tab-label">微信</span>
        </div>
        <div class="wx-tab" onclick="showLockedHint('功能开发中')">
          <span class="wx-tab-icon">👥</span>
          <span class="wx-tab-label">通讯录</span>
        </div>
        <div class="wx-tab" onclick="renderDiscover()">
          <span class="wx-tab-icon">🧭</span>
          <span class="wx-tab-label">发现</span>
        </div>
        <div class="wx-tab" onclick="showLockedHint('功能开发中')">
          <span class="wx-tab-icon">👤</span>
          <span class="wx-tab-label">我</span>
        </div>
      </div>
    </div>
  `;
}

// 渲染微信「发现」页
function renderDiscover() {
  const content = $('#appContent');
  content.innerHTML = `
    <div class="wx-discover-wrap">
      <div class="wx-list-header">
        <div class="wx-list-title">发现</div>
        <div class="wx-list-actions"></div>
      </div>
      <div class="wx-discover-list">
        <div class="wx-discover-item" onclick="openMomentsFromDiscover()">
          <div class="wx-discover-icon moments-icon">🌍</div>
          <div class="wx-discover-name">朋友圈</div>
          <span class="wx-discover-arrow">›</span>
        </div>
        <div class="wx-discover-item" onclick="showLockedHint('功能开发中')">
          <div class="wx-discover-icon">📹</div>
          <div class="wx-discover-name">视频号</div>
          <span class="wx-discover-arrow">›</span>
        </div>
        <div class="wx-discover-item" onclick="showLockedHint('功能开发中')">
          <div class="wx-discover-icon">🔍</div>
          <div class="wx-discover-name">搜一搜</div>
          <span class="wx-discover-arrow">›</span>
        </div>
        <div class="wx-discover-item" onclick="showLockedHint('功能开发中')">
          <div class="wx-discover-icon">📰</div>
          <div class="wx-discover-name">看一看</div>
          <span class="wx-discover-arrow">›</span>
        </div>
        <div class="wx-discover-item" onclick="showLockedHint('功能开发中')">
          <div class="wx-discover-icon">🛒</div>
          <div class="wx-discover-name">购物</div>
          <span class="wx-discover-arrow">›</span>
        </div>
        <div class="wx-discover-item" onclick="showLockedHint('功能开发中')">
          <div class="wx-discover-icon">🎮</div>
          <div class="wx-discover-name">游戏</div>
          <span class="wx-discover-arrow">›</span>
        </div>
        <div class="wx-discover-item" onclick="showLockedHint('功能开发中')">
          <div class="wx-discover-icon">📱</div>
          <div class="wx-discover-name">小程序</div>
          <span class="wx-discover-arrow">›</span>
        </div>
      </div>
      <div class="wx-tabbar">
        <div class="wx-tab" onclick="renderWeChat()">
          <span class="wx-tab-icon">💬</span>
          <span class="wx-tab-label">微信</span>
        </div>
        <div class="wx-tab" onclick="showLockedHint('功能开发中')">
          <span class="wx-tab-icon">👥</span>
          <span class="wx-tab-label">通讯录</span>
        </div>
        <div class="wx-tab active" onclick="renderDiscover()">
          <span class="wx-tab-icon">🧭</span>
          <span class="wx-tab-label">发现</span>
        </div>
        <div class="wx-tab" onclick="showLockedHint('功能开发中')">
          <span class="wx-tab-icon">👤</span>
          <span class="wx-tab-label">我</span>
        </div>
      </div>
    </div>
  `;
}

// 从微信"发现"页打开朋友圈
function openMomentsFromDiscover() {
  if (gameStage === 'initial') {
    // 进入朋友圈发布流程
    gameStage = 'moments_phase1';
    renderMomentsCompose();
    startAutoTyping('phase1');
  } else if (gameStage === 'moments_phase1') {
    renderMomentsCompose();
    startAutoTyping('phase1');
  } else if (gameStage === 'moments_phase2') {
    renderMomentsCompose();
  } else if (isStageUnlocked('moments_sent')) {
    // 朋友圈已发送，之后随时可以查看
    renderMomentsFeed();
  } else {
    showLockedHint('请先完成聊天流程');
  }
}

function getLastChatTime(chat) {
  const msgs = chat.messages;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i][1] !== 'date') return msgs[i][2] || '';
  }
  return '';
}

function getLastChatText(chat) {
  const msgs = chat.messages;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i][1] !== 'date') return msgs[i][0];
  }
  return '';
}

// 聊天动画定时器集合（用于清理）
let chatTimers = [];
let chatTypingTimer = null;

function clearChatTimers() {
  chatTimers.forEach(t => clearTimeout(t));
  chatTimers = [];
  if (chatTypingTimer) { clearInterval(chatTypingTimer); chatTypingTimer = null; }
  chatSeqToken++; // 使尚未执行的播放回调全部失效
}

function openChat(name) {
  const isShengzhen = name === OWNER.birthdayGirl;
  // 安全锁：朋友圈发送前不允许进入聊天（剧情驱动的入口不受此限制）
  if (isShengzhen && !isStageUnlocked('moments_sent') && pendingChatPhase === null) {
    showLockedHint('发送朋友圈后即可查看聊天');
    return;
  }
  if (!CHATS[name]) return;

  // 该剧情阶段正在当前聊天中播放且未被打断：直接返回，避免重建界面导致消息重复
  if (isShengzhen && pendingChatPhase !== null && playingChatPhase === pendingChatPhase &&
      currentChat === name && isInChatView() && !chatPhasePaused) {
    scrollChatBottom();
    return;
  }

  currentChat = name;
  clearChatTimers();
  const chat = CHATS[name];
  const content = $('#appContent');
  // 生真的聊天由剧情驱动，不允许玩家自由输入
  const canReply = !isShengzhen;
  const inputArea = canReply
    ? `<div class="wx-input-area">
        <button class="wx-input-voice" title="语音">🔊</button>
        <input class="wx-input" id="chatInput" placeholder="发消息…" onkeydown="if(event.key==='Enter')sendMessage()" />
        <button class="wx-input-icon" title="表情">😊</button>
        <button class="wx-input-icon" title="更多">＋</button>
      </div>`
    : `<div class="wx-input-area">
        <button class="wx-input-voice" title="语音" disabled>🔊</button>
        <input class="wx-input" placeholder="剧情推进中…" disabled />
        <button class="wx-input-icon" disabled>😊</button>
        <button class="wx-input-icon" disabled>＋</button>
      </div>`;
  content.innerHTML = `
    <div class="wx-chat-detail">
      <div class="wx-chat-header">
        <button class="wx-chat-back" onclick="leaveChatToWeChatList()">${BACK_ARROW_SVG}</button>
        <div class="wx-chat-header-name">${name}</div>
        <button class="wx-chat-skip" onclick="skipChatAnimation()" title="跳过动画">⏩</button>
      </div>
      <div class="wx-chat-messages" id="chatMessages"></div>
      <div class="wx-chat-typing" id="chatTyping" style="display:none;">
        <span></span><span></span><span></span>
      </div>
      ${inputArea}
    </div>
  `;

  const container = $('#chatMessages');

  if (!isShengzhen) {
    renderAllMessages(container, chat.messages, false);
    scrollChatBottom();
    return;
  }

  // 打开生真聊天即视为已读
  shengzhenUnread = 0;
  updateWeChatBadge();

  // 先渲染已解锁的过往聊天记录
  const unlockedEnd = Math.min(wechatUnlockedIndex, chat.messages.length - 1);
  if (unlockedEnd >= 0) {
    renderAllMessages(container, chat.messages.slice(0, unlockedEnd + 1), false);
  }

  // 有待播放的剧情阶段：接着逐条播放新消息
  if (pendingChatPhase !== null && getPhaseRange(pendingChatPhase).end > unlockedEnd) {
    const range = getPhaseRange(pendingChatPhase);
    const resumeFrom = Math.max(chatPhasePaused && playingChatPhase === pendingChatPhase ? chatPhaseCursor : 0, range.start);
    // 阶段中途离开过：先把中断前已经显示的消息补渲染回来（不重复触发动画/弹窗）
    if (chatPhasePaused && resumeFrom > unlockedEnd + 1) {
      renderAllMessages(container, chat.messages.slice(unlockedEnd + 1, resumeFrom), false);
    }
    playChatPhase(pendingChatPhase, resumeFrom);
  } else {
    showTyping(false);
    scrollChatBottom();
  }
}

// 播放某个剧情阶段的聊天
// resumeFrom：断点索引；不传则从该阶段第一条未播放的消息开始
function playChatPhase(phaseIdx, resumeFrom) {
  const container = $('#chatMessages');
  if (!container) return;
  const range = getPhaseRange(phaseIdx);
  // 播放起点与已渲染的历史记录去重：只播放尚未显示过的消息
  const start = resumeFrom != null ? resumeFrom : Math.max(range.start, wechatUnlockedIndex + 1);
  if (range.end < start) { completeChatPhase(phaseIdx); return; }
  playingChatPhase = phaseIdx;
  chatPhasePaused = false;
  chatPhaseCursor = start;
  const messages = getChatMessageList().slice(start, range.end + 1);
  playChatSequence(messages, () => completeChatPhase(phaseIdx), {
    // 每显示一条就推进断点，玩家随时切出都能从下一条继续
    onProgress: consumed => { chatPhaseCursor = start + consumed; }
  });
}

// 逐条播放聊天消息，播放完毕后执行 onDone
function playChatSequence(messages, onDone, opts = {}) {
  const container = $('#chatMessages');
  if (!container) return;
  const token = ++chatSeqToken; // 序列令牌：被更新的播放或界面重建取代后，旧回调自动失效
  const alive = () => token === chatSeqToken;
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
  const report = () => { if (onProgress) onProgress(idx); };
  let idx = 0;
  let finished = false;
  const laqiyaAvatarHTML = getAppIconHTML(OWNER.avatar);

  const finish = () => {
    if (finished || !alive()) return;
    finished = true;
    window._skipChat = null;
    showTyping(false);
    if (onDone) onDone();
  };

  window._skipChat = () => {
    if (finished || !alive()) return;
    finished = true;
    clearChatTimers();
    renderAllMessages(container, messages.slice(idx), true);
    scrollChatBottom();
    window._skipChat = null;
    showTyping(false);
    if (onDone) onDone();
  };

  function next() {
    if (finished || !alive()) return;
    if (idx >= messages.length) {
      finish();
      return;
    }
    const [text, type, time] = messages[idx];

    if (type === 'date') {
      appendMessage(container, `<div class="msg-date">${text}</div>`);
      idx++;
      report();
      const t = setTimeout(next, 600);
      chatTimers.push(t);
    } else if (type === 'system') {
      appendMessage(container, `<div class="msg-system">🎙️ ${text}</div>`);
      playSound('message');
      idx++;
      report();
      const t = setTimeout(next, 800);
      chatTimers.push(t);
    } else if (type === 'them') {
      // 对方消息：先显示输入中（生真打字速度中等）
      showTyping(true);
      const delay = 2200 + Math.random() * 2000;
      const t = setTimeout(() => {
        showTyping(false);
        appendMessage(container, `<div class="msg-row them-row"><div class="msg-avatar">${getChatThemAvatarHTML()}</div><div class="msg-bubble-wrap"><div class="msg them">${text}</div>${time ? `<div class="msg-time">${time}</div>` : ''}</div></div>`);
        playSound('message');
        haptic('light');
        idx++;
        report();
        // 检查是否触发生真头像更换
        if (text === SHENGZHEN_AVATAR_CHANGE_MSG) {
          changeShengzhenAvatar();
        }
        const t2 = setTimeout(next, 1000 + Math.random() * 800);
        chatTimers.push(t2);
      }, delay);
      chatTimers.push(t);
    } else {
      // 我的消息：拉齐亚打字速度适中偏快
      showTyping(true);
      let meDelay = 800 + Math.random() * 800;
      const t = setTimeout(() => {
        showTyping(false);
        appendMessage(container, `<div class="msg-row me-row"><div class="msg-bubble-wrap"><div class="msg me">${text}</div>${time ? `<div class="msg-time">${time}</div>` : ''}</div><div class="msg-avatar me-avatar">${laqiyaAvatarHTML}</div></div>`);
        playSound('click');
        idx++;
        report();
        const t2 = setTimeout(next, 600 + Math.random() * 400);
        chatTimers.push(t2);
      }, meDelay);
      chatTimers.push(t);
    }
    scrollChatBottom();
  }

  // 启动
  const t0 = setTimeout(next, 400);
  chatTimers.push(t0);
}

function appendMessage(container, html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  container.appendChild(div);
  scrollChatBottom();
}

function scrollChatBottom() {
  const msgs = $('#chatMessages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function showTyping(show) {
  const el = $('#chatTyping');
  if (el) el.style.display = show ? 'flex' : 'none';
}

// 跳过动画
function skipChatAnimation() {
  if (window._skipChat) window._skipChat();
}

// 一次性渲染所有剩余消息
// triggerAvatarChange：是否触发"生真更换头像"弹窗（渲染历史记录时关闭）
function renderAllMessages(container, messages, triggerAvatarChange = true) {
  const laqiyaAvatarHTML = getAppIconHTML(OWNER.avatar);
  let avatarShouldChange = false;
  messages.forEach(([text, type, time]) => {
    let html;
    if (type === 'date') html = `<div class="msg-date">${text}</div>`;
    else if (type === 'system') html = `<div class="msg-system">🎙️ ${text}</div>`;
    else if (type === 'them') {
      html = `<div class="msg-row them-row"><div class="msg-avatar">${getChatThemAvatarHTML()}</div><div class="msg-bubble-wrap"><div class="msg them">${text}</div>${time ? `<div class="msg-time">${time}</div>` : ''}</div></div>`;
      if (text === SHENGZHEN_AVATAR_CHANGE_MSG) avatarShouldChange = true;
    }
    else html = `<div class="msg-row me-row"><div class="msg-bubble-wrap"><div class="msg me">${text}</div>${time ? `<div class="msg-time">${time}</div>` : ''}</div><div class="msg-avatar me-avatar">${laqiyaAvatarHTML}</div></div>`;
    appendMessage(container, html);
  });
  if (avatarShouldChange && triggerAvatarChange) changeShengzhenAvatar();
  showTyping(false);
}

function sendMessage() {
  const input = $('#chatInput');
  const text = input.value.trim();
  if (!text) return;
  // 这里可以扩展：添加消息到 CHATS 数据并重新渲染
  input.value = '';
}

/* ========== 备忘录 App ========== */
function renderNotes() {
  const allNotes = NOTES.filter(n => isStageUnlocked(n.unlockStage));
  const pinned = allNotes.filter(n => n.pinned);
  const normal = allNotes.filter(n => !n.pinned);
  const content = $('#appContent');
  content.innerHTML = `
    <div class="app-nav">
      <button class="nav-back" onclick="goHome()">${BACK_ARROW_SVG}</button>
      <div class="nav-title">备忘录</div>
      <div class="nav-right"></div>
    </div>
    ${pinned.length ? `<div style="padding:8px 16px 4px;color:#8e8e93;font-size:13px;font-weight:600;">📌 置顶</div>` : ''}
    <div class="notes-list">
      ${pinned.map(n => noteItemHTML(n)).join('')}
    </div>
    ${normal.length ? `<div style="padding:8px 16px 4px;color:#8e8e93;font-size:13px;font-weight:600;">备忘录</div>` : ''}
    <div class="notes-list">
      ${normal.map(n => noteItemHTML(n)).join('')}
    </div>
  `;
}

function noteItemHTML(n) {
  return `
    <div class="note-item" onclick="openNote(${n.id})">
      <div class="note-title">${n.title}</div>
      <div class="note-preview">${n.date}  ${n.body.split('\n')[0]}</div>
    </div>
  `;
}

function openNote(id) {
  const note = NOTES.find(n => n.id === id);
  if (!note) return;
  const content = $('#appContent');
  content.innerHTML = `
    <div class="app-nav">
      <button class="nav-back" onclick="renderNotes()">${BACK_ARROW_SVG} 备忘录</button>
      <div class="nav-title"></div>
      <div class="nav-right"></div>
    </div>
    <div class="note-detail">
      <div class="note-detail-title">${note.title}</div>
      <div class="note-detail-body">${note.body}</div>
    </div>
  `;
}

/* ========== 语音备忘录 App ========== */
function renderVoiceMemos() {
  const memos = VOICE_MEMOS.filter(m => isStageUnlocked(m.unlockStage));
  const content = $('#appContent');
  content.innerHTML = `
    <div class="app-nav">
      <button class="nav-back" onclick="goHome()">${BACK_ARROW_SVG}</button>
      <div class="nav-title">语音备忘录</div>
      <div class="nav-right"></div>
    </div>
    <div class="vm-list">
      ${memos.map(m => `
        <div class="vm-item" onclick="openVoiceMemo(${m.id})">
          <div class="vm-play-btn">▶</div>
          <div class="vm-info">
            <div class="vm-title">${m.title}</div>
            <div class="vm-meta">${m.date} · ${m.duration}</div>
          </div>
          <div class="vm-wave-mini">
            ${m.waveform.slice(0, 20).map(w => `<span style="height:${w * 24}px"></span>`).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function openVoiceMemo(id) {
  const memo = VOICE_MEMOS.find(m => m.id === id);
  if (!memo) return;
  const content = $('#appContent');
  content.innerHTML = `
    <div class="app-nav">
      <button class="nav-back" onclick="renderVoiceMemos()">${BACK_ARROW_SVG} 语音备忘录</button>
      <div class="nav-title"></div>
      <div class="nav-right"></div>
    </div>
    <div class="vm-detail">
      <div class="vm-detail-title">${memo.title}</div>
      <div class="vm-detail-date">${memo.date}</div>

      <!-- 播放器 -->
      <div class="vm-player">
        <div class="vm-big-play" id="vmPlayBtn" onclick="togglePlayVM(${memo.id})">▶</div>
        <div class="vm-wave-big" id="vmWaveBig">
          ${memo.waveform.map((w, i) => `<span class="vm-bar" data-idx="${i}" style="height:${w * 60}px"></span>`).join('')}
        </div>
        <div class="vm-time">
          <span id="vmCurrent">0:00</span>
          <span>${memo.duration}</span>
        </div>
      </div>

      <!-- 转写文本 -->
      <div class="vm-transcript">
        <div class="vm-transcript-title">语音转文字</div>
        ${memo.segments.map(seg => `
          <div class="vm-segment">
            <div class="vm-seg-head">
              <span class="vm-speaker" style="color:${seg.color}">${seg.speaker}</span>
              <span class="vm-seg-time">${seg.time}</span>
            </div>
            <div class="vm-seg-text">${seg.text}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// 模拟播放状态
let vmPlaying = false;
let vmTimer = null;
function togglePlayVM(id) {
  const btn = $('#vmPlayBtn');
  const bars = $$('.vm-bar');
  const current = $('#vmCurrent');
  if (!vmPlaying) {
    // 开始播放
    vmPlaying = true;
    btn.textContent = '❚❚';
    let idx = 0;
    const total = bars.length;
    const memo = VOICE_MEMOS.find(m => m.id === id);
    // 解析时长
    const [min, sec] = memo.duration.split(':').map(Number);
    const totalSec = min * 60 + sec;
    vmTimer = setInterval(() => {
      bars.forEach((b, i) => b.classList.remove('active'));
      const activeCount = Math.floor((idx / total) * total);
      for (let i = 0; i < activeCount && i < total; i++) bars[i].classList.add('active');
      const elapsed = Math.floor((idx / total) * totalSec);
      current.textContent = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
      idx++;
      if (idx > total) {
        clearInterval(vmTimer);
        vmPlaying = false;
        btn.textContent = '▶';
      }
    }, 100);
  } else {
    // 暂停
    clearInterval(vmTimer);
    vmPlaying = false;
    btn.textContent = '▶';
  }
}

/* ========== 照片 App ========== */
function renderPhotos() {
  const content = $('#appContent');
  content.innerHTML = `
    ${navBar('照片', 'goHome()')}
    <div class="photos-grid">
      ${PHOTOS.map((p, i) => `<div class="photo-thumb" style="background:${p}"></div>`).join('')}
    </div>
  `;
}

/* ========== 天气 App ========== */
function renderWeather() {
  const content = $('#appContent');
  content.innerHTML = `
    ${navBar('天气', 'goHome()')}
    <div class="weather-app">
      <div class="weather-city">${WEATHER.city}</div>
      <div class="weather-temp">${WEATHER.temp}°</div>
      <div class="weather-desc">${WEATHER.desc}</div>
      <div class="weather-range">最高 ${WEATHER.high}° 最低 ${WEATHER.low}°</div>
    </div>
  `;
}

/* ========== 时钟 App ========== */
function renderClock() {
  const content = $('#appContent');
  content.innerHTML = `
    ${navBar('时钟', 'goHome()')}
    <div class="clock-app">
      <div class="clock-face" id="clockFace">
        <div class="clock-hand clock-hour" id="clockHour"></div>
        <div class="clock-hand clock-min" id="clockMin"></div>
        <div class="clock-hand clock-sec" id="clockSec"></div>
        <div class="clock-center"></div>
      </div>
      <div class="clock-digital" id="clockDigital">${getTimeStr()}</div>
    </div>
  `;
  updateClockHands();
}

function updateClockHands() {
  const now = new Date();
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();
  const hourEl = $('#clockHour');
  const minEl = $('#clockMin');
  const secEl = $('#clockSec');
  const dig = $('#clockDigital');
  if (hourEl) hourEl.style.transform = `rotate(${h * 30 + m * 0.5}deg)`;
  if (minEl) minEl.style.transform = `rotate(${m * 6}deg)`;
  if (secEl) secEl.style.transform = `rotate(${s * 6}deg)`;
  if (dig) dig.textContent = `${pad(now.getHours())}:${pad(m)}:${pad(s)}`;
}

/* ========== 日历 App ========== */
function renderCalendar() {
  const content = $('#appContent');
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let calHTML = '';
  for (let i = 0; i < firstDay; i++) calHTML += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const hasEvent = CALENDAR_EVENTS.some(e => e.day === d);
    calHTML += `<div class="cal-day ${d === today ? 'today' : ''} ${hasEvent ? 'has-event' : ''}">${d}</div>`;
  }

  const todayEvents = CALENDAR_EVENTS.filter(e => e.day === today);
  content.innerHTML = `
    ${navBar(`${year}年${month + 1}月`, 'goHome()')}
    <div class="cal-app">
      <div class="cal-grid">
        ${['日', '一', '二', '三', '四', '五', '六'].map(d => `<div class="cal-day-name">${d}</div>`).join('')}
        ${calHTML}
      </div>
      <div class="cal-events-list">
        <div style="font-size:15px;font-weight:600;margin-bottom:8px;">今日事件</div>
        ${todayEvents.length ? todayEvents.map(e => `
          <div class="cal-event-item">
            <div class="cal-event-bar" style="background:${e.color}"></div>
            <div>
              <div style="font-size:15px;">${e.title}</div>
              <div style="font-size:12px;color:#8e8e93;">${e.allDay ? '全天' : ''}</div>
            </div>
          </div>
        `).join('') : '<div style="color:#8e8e93;font-size:14px;">无事件</div>'}
      </div>
    </div>
  `;
}

/* ========== 设置 App ========== */
function renderSettings() {
  const content = $('#appContent');
  content.innerHTML = `
    ${navBar('设置', 'goHome()')}
    <div style="margin-bottom:20px;">
      <div class="settings-list">
        ${SETTINGS.map(s => `
          <div class="settings-item">
            <div class="settings-icon" style="background:${s.color}">${s.icon}</div>
            <div class="settings-label">${s.label}</div>
            <span style="color:#c7c7cc;">›</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* ========== 音乐 App ========== */
function renderMusic() {
  const content = $('#appContent');
  content.innerHTML = `
    ${navBar('音乐', 'goHome()')}
    <div style="padding:40px 20px;text-align:center;">
      <div style="width:200px;height:200px;margin:0 auto 24px;background:linear-gradient(135deg,#ff5e62,#ff2d55);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:60px;">🎵</div>
      <div style="font-size:18px;font-weight:600;">正在播放</div>
      <div style="color:#8e8e93;margin-top:4px;">未知艺术家</div>
      <div style="margin-top:30px;display:flex;justify-content:center;gap:30px;font-size:32px;">
        <span>⏮</span><span>▶️</span><span>⏭</span>
      </div>
    </div>
  `;
}

/* ========== Safari App ========== */
function renderSafari() {
  const content = $('#appContent');
  const searchHistory = [
    '捡到狗怎么办',
    '边牧',
    '怎么养活狗',
    '去高中生家里拜访买什么比较好'
  ];
  content.innerHTML = `
    ${navBar('Safari', 'goHome()')}
    <div style="padding:20px;">
      <div style="background:#e5e5ea;border-radius:10px;padding:10px 14px;color:#8e8e93;text-align:center;">
        🔍 搜索或输入网址
      </div>
      <div style="margin-top:24px;">
        <div style="font-size:15px;font-weight:600;margin-bottom:12px;">搜索记录</div>
        <div class="settings-list" style="margin:0;">
          ${searchHistory.map(item => `
            <div class="settings-item" style="padding:12px 16px;">
              <div class="settings-icon" style="background:#8e8e93;width:28px;height:28px;font-size:14px;">🔍</div>
              <div class="settings-label" style="font-size:15px;">${item}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div style="margin-top:24px;">
        <div style="font-size:15px;font-weight:600;margin-bottom:12px;">个人收藏</div>
        <div style="display:grid;grid-template-columns:4fr;gap:12px;">
          <div style="display:flex;align-items:center;gap:12px;padding:10px;background:#fff;border-radius:10px;">
            <span style="font-size:24px;">🍎</span>
            <div>
              <div style="font-size:15px;font-weight:500;">Apple</div>
              <div style="font-size:12px;color:#8e8e93;">apple.com</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ========== 电话 App ========== */
function renderPhone() {
  const content = $('#appContent');
  content.innerHTML = `
    ${navBar('电话', 'goHome()')}
    <div style="padding:20px;">
      <div style="font-size:15px;font-weight:600;margin-bottom:12px;">最近通话</div>
      <div class="settings-list" style="margin:0;">
        <div class="settings-item">
          <div class="settings-icon" style="background:#28c253">📞</div>
          <div class="settings-label">${OWNER.birthdayGirl}</div>
          <div style="font-size:13px;color:#8e8e93;">未接 3 次</div>
        </div>
        <div class="settings-item">
          <div class="settings-icon" style="background:#0a84ff">📞</div>
          <div class="settings-label">房东</div>
          <div style="font-size:13px;color:#8e8e93;">已接</div>
        </div>
      </div>
    </div>
  `;
}

/* ========== 邮件 App ========== */
function renderMail() {
  const content = $('#appContent');
  const mails = [
    { from: 'Apple', subject: '您的收据', preview: '您从 App Store 购买的项目收据已生成', icon: '', color: '#000' },
    { from: '招商银行信用卡', subject: '【账单提醒】您10月信用卡账单已出', preview: '本期账单金额￥8,642.00，最后还款日11月10日', icon: '💳', color: '#c8102e' },
    { from: 'Apple Store', subject: '新款 iPhone 17 Pro 现已开售', preview: '钛金属设计，A19 Pro 芯片，立即选购享优惠', icon: '', color: '#000' },
    { from: '支付宝', subject: '花呗账单提醒', preview: '您本月花呗账单￥1,238.50 待还，点击查看详情', icon: '💰', color: '#1677ff' },
    { from: '京东', subject: '您的订单已发货', preview: '您购买的商品已由顺丰速运发出，预计明天送达', icon: '📦', color: '#e1251b' },
    { from: '美团', subject: '外卖红包已到账', preview: '您有一张满30减8元红包即将过期，快去使用吧', icon: '🍔', color: '#ffc300' },
    { from: '中国电信', subject: '流量使用提醒', preview: '您本月流量已使用80%，点击查看更多流量套餐', icon: '📶', color: '#0066b3' },
  ];
  content.innerHTML = `
    ${navBar('收件箱', 'goHome()')}
    <div class="notes-list">
      ${mails.map(m => `
        <div class="note-item">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:8px;background:${m.color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${m.icon || m.from[0]}</div>
            <div style="flex:1;min-width:0;">
              <div class="note-title">${m.from}</div>
              <div style="font-size:14px;font-weight:600;color:#000;margin-top:2px;">${m.subject}</div>
              <div class="note-preview">${m.preview}</div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/* ========== Instagram App ========== */
function renderInstagram() {
  const content = $('#appContent');
  content.innerHTML = `
    ${navBar('Instagram', 'goHome()')}
    <div style="padding:20px;text-align:center;color:#8e8e93;">
      <div style="font-size:48px;margin-bottom:12px;">📷</div>
      <div>暂无内容</div>
    </div>
  `;
}

/* ========== 地图 App ========== */
function renderMaps() {
  const content = $('#appContent');
  content.innerHTML = `
    ${navBar('地图', 'goHome()')}
    <div style="padding:20px;text-align:center;color:#8e8e93;">
      <div style="font-size:48px;margin-bottom:12px;">🗺️</div>
      <div>上海</div>
    </div>
  `;
}

/* ========== 占位 App ========== */
function renderPlaceholder(id) {
  const content = $('#appContent');
  content.innerHTML = `
    ${navBar(id, 'goHome()')}
    <div style="padding:40px 20px;text-align:center;color:#8e8e93;">
      <div style="font-size:48px;margin-bottom:12px;">📱</div>
      <div>此 App 为演示占位</div>
    </div>
  `;
}

/* ========== 事件绑定 ========== */
function bindEvents() {
  // 密码键盘
  $$('.key[data-num]').forEach(btn => {
    btn.addEventListener('click', () => inputPasscode(btn.dataset.num));
  });
  $('#keyDelete').addEventListener('click', deletePasscode);

  // 点击密码区空白取消
  $('.passcode-cancel').addEventListener('click', cancelPasscode);
}

/* ========== 时钟更新 ========== */
function tick() {
  const timeStr = getTimeStr();
  $('#lockTime').textContent = timeStr;
  $$('.status-time').forEach(el => el.textContent = timeStr);
  if (currentView === 'appView' && currentApp === 'clock') {
    updateClockHands();
  }
}

/* ========== 测试渠道 ========== */
// 通过 URL 参数 ?test=1 进入测试模式，自动进入语音备忘录并播放录音
function runTestChannel() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('test') !== '1') return;

  console.log('%c🎙️ [测试渠道] 语音备忘录功能测试启动', 'color:#ff3b30;font-weight:bold;font-size:14px;');
  console.log(`%c录音数量: ${VOICE_MEMOS.length}`, 'color:#0a84ff;');
  VOICE_MEMOS.forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.title} | ${m.date} | 时长 ${m.duration} | ${m.segments.length} 段转写`);
  });

  // 测试模式：自动解锁并进入语音备忘录
  setTimeout(() => {
    renderHomeScreen();
    showView('homeView');
    console.log('%c✓ 已自动解锁进入主屏幕', 'color:#34c759;');
  }, 300);

  setTimeout(() => {
    openApp('voicememos');
    console.log('%c✓ 已打开语音备忘录', 'color:#34c759;');
  }, 800);

  setTimeout(() => {
    openVoiceMemo(VOICE_MEMOS[0].id);
    console.log('%c✓ 已打开第一条录音详情', 'color:#34c759;');
  }, 1300);

  setTimeout(() => {
    togglePlayVM(VOICE_MEMOS[0].id);
    console.log('%c✓ 已开始播放录音（模拟）', 'color:#34c759;');
    console.log('%c🎙️ [测试渠道] 所有测试项已启动，查看语音转文字区域', 'color:#ff3b30;font-weight:bold;');
  }, 1800);
}

/* ========== 锁屏上滑解锁手势 ========== */
function bindSwipeToUnlock() {
  const lockView = $('#lockView');
  if (!lockView) return;

  let startY = 0;
  let startX = 0;
  let startTime = 0;
  let isSwiping = false;
  const SWIPE_THRESHOLD = 30; // 上滑最小距离(px)，降低阈值更容易触发

  function onTouchStart(e) {
    if (currentView !== 'lockView') return;
    const touch = e.touches ? e.touches[0] : e;
    startY = touch.clientY;
    startX = touch.clientX;
    startTime = Date.now();
    isSwiping = true;
  }

  function onTouchMove(e) {
    if (!isSwiping) return;
    // 阻止默认滚动行为，确保上滑手势不被页面滚动吞掉
    if (e.cancelable) e.preventDefault();
  }

  function onTouchEnd(e) {
    if (currentView !== 'lockView' || !isSwiping) return;
    isSwiping = false;
    const touch = e.changedTouches ? e.changedTouches[0] : e;
    const deltaY = touch.clientY - startY;
    const deltaX = touch.clientX - startX;
    const duration = Date.now() - startTime;
    // 上滑：垂直方向位移 < -阈值，且垂直位移大于水平位移（避免误触横向滑动）
    if (deltaY < -SWIPE_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX)) {
      unlockPhone();
    }
  }

  // 触摸事件（移动端）
  lockView.addEventListener('touchstart', onTouchStart, { passive: true });
  lockView.addEventListener('touchmove', onTouchMove, { passive: false });
  lockView.addEventListener('touchend', onTouchEnd, { passive: true });
  // 鼠标事件（桌面端测试）
  lockView.addEventListener('mousedown', onTouchStart);
  lockView.addEventListener('mousemove', onTouchMove);
  lockView.addEventListener('mouseup', onTouchEnd);
  // 点击 home indicator 也可解锁（兜底方案）
  const homeIndicator = lockView.querySelector('.home-indicator');
  if (homeIndicator) {
    homeIndicator.addEventListener('click', (e) => {
      e.stopPropagation();
      unlockPhone();
    });
  }
}

/* ========== 初始化 ========== */
function init() {
  renderLockScreen();
  bindEvents();
  bindSwipeToUnlock();
  setInterval(tick, 1000);
  runTestChannel();
}

document.addEventListener('DOMContentLoaded', init);
