/* RoadRules - Shared UI (common.js) */
/* Theme, mobile menu, accessibility, tailwind config - used by all pages */

function initTailwind() {
  if (window.tailwind) {
    tailwind.config = { darkMode: 'class' };
  }
}

function updateThemeIcon() {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  if (document.documentElement.classList.contains('dark')) {
    icon.classList.remove('fa-moon');
    icon.classList.add('fa-sun');
    icon.style.color = '#facc15';
  } else {
    icon.classList.remove('fa-sun');
    icon.classList.add('fa-moon');
    icon.style.color = '';
  }
}

function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('roadRulesTheme', dark ? 'dark' : 'light');
  updateThemeIcon();
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  applyTheme(!isDark);
}

function initTheme() {
  updateThemeIcon();
  if (!localStorage.getItem('roadRulesTheme') && window.matchMedia) {
    window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', e => {
      if (!localStorage.getItem('roadRulesTheme')) {
        document.documentElement.classList.toggle('dark', e.matches);
        updateThemeIcon();
      }
    });
  }
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const btn = document.getElementById('mobile-menu-button');
  if (!menu || !btn) return;
  const icon = btn.querySelector('i');
  const isHidden = menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !isHidden);
  if (icon) {
    icon.classList.toggle('fa-bars', !isHidden);
    icon.classList.toggle('fa-times', isHidden);
  }
}

function initAccessibility() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const m = document.getElementById('auth-modal');
      const mm = document.getElementById('mobile-menu');
      if (m && !m.classList.contains('hidden')) {
        m.classList.add('hidden');
        m.classList.remove('flex');
      } else if (mm && !mm.classList.contains('hidden')) {
        mm.classList.add('hidden');
      }
    }
  });
}

// Optional: expose for pages that need to call
window.RoadRulesCommon = { initTailwind, initTheme, toggleTheme, toggleMobileMenu, initAccessibility };

/* ============================================================
   PREMIUM FLOATING HELP CENTER CHATBOT WIDGET
   - Bottom-right round icon
   - Opens beautiful chat-like panel
   - Prewritten Q&As from admin (via Drive) + local defaults
   - Animated typing effect for answers
   - "Icyo wabazaga wakibonye?" flow with Yego / Oya
   - WhatsApp deep link when needed
   ============================================================ */

(function initPremiumHelpWidget() {
  // Prevent double injection
  if (document.getElementById('rr-help-fab')) return;

  // Default fallback FAQs (excellent Kinyarwanda content) — now supports up to 3 progressive answers
  const DEFAULT_FAQS = [
    { id: 'd1', question: 'Ni iki Perime.rw / RoadRules?', answers: [
      'Ni urubuga rwihariye rwo kwihugurira ikizamini cya provisoir mu Rwanda. Ugerageza ibibazo bisa n’ibyo uzasanga mu kizamini nyirizina, ugahita ubona ibisubizo n’aho wakosheje.',
      'Platform yacu igufasha kwitegura neza ikizamini cya provisoir. Ibizamini byose bisa n’ibyo uzahura nabyo ku munsi w’ikizamini.',
      'Ushobora gukora imyitozo myinshi, ubone ibisubizo byihuse, kandi ugakurikirane iterambere ryawe.'
    ]},
    { id: 'd2', question: 'Ni gute niyandikisha ku rubuga?', answers: [
      'Kanda "Iyandikishe" ku ntoki y’iburyo hejuru cyangwa mu menu. Uzuza amazina yawe, numero ya telephone, akarere, hanyuma ushyire umubare w’ibanga. Iyandikishwa ni ubuntu.',
      'Wemerewe kwiyandikisha ukoresheje numero ya telefone yawe. Ntago bisaba amafaranga yo kwiyandikisha.',
      'Nyuma yo kwiyandikisha, urashobora gutangira gukora ikizamini cya ubuntu kandi wongere wiyandikishe mu ifatabuguzi nyuma.'
    ]},
    { id: 'd3', question: 'Ifatabuguzi ifite amahitamo angana?', answers: [
      'Dufite Ubuntu (ubuntu), Inshuro 2, Icyumweru na Ukwezi. Pro na Premium zitanga imyitozo myinshi, dashboard y’iterambere, ibisubizo byihuse n’ibindi byiza byo kwitegura.',
      'Ubuntu ni ubuntu. Inshuro 2 ni 300 RWF. Icyumweru ni 500 RWF. Ukwezi ni 1000 RWF kandi ni ryo rifungura Mwarimu (Rugamba).',
      'Ukwezi ni ryo rifungura ibintu byose birimo Mwarimu w’ibizamini n’ibindi byose.'
    ]},
    { id: 'd4', question: 'Ni ryari nkora ikizamini cya provisoir?', answers: [
      'Ushobora kwiyandikisha mu biro bya Polisi y’umuhanda cyangwa ku rubuga rwa PERIME. Ibihe biragaragara ku rubuga, kandi urashobora kwiyugurura hano mbere.',
      'Ikizamini cya provisoir gikorwa ku biro bya Polisi y’umuhanda. Wabona amakuru y’ibihe ku rubuga rwa PERIME.',
      'Wabona amategeko y’umuhanda n’ibimenyetso byose hano mbere yo kujya mu kizamini.'
    ]},
    { id: 'd5', question: 'Ni gute nkora imyitozo ihagije?', answers: [
      'Kanda "Imyitozo" ku menu. Hitamo igice (ibimenyetso, amategeko, ibizamini by’ukuri...). Uzakora ibizamini bisa n’ibyo mu kizamini nyirizina.',
      'Hitamo igice cy’ibimenyetso, ibyamategeko, cyangwa ibizamini by’ukuri. Uzakora ibizamini 20-30 bisa n’ibyo ku munsi w’ikizamini.',
      'Imyitozo yose itanga ibisubizo byihuse kugira ngo wikosore vuba.'
    ]},
    { id: 'd6', question: 'Ni gute nkora amafaranga yo kugura ifatabuguzi?', answers: [
      'Injira mu Konte yawe (ikoni y’umuntu), kanda "Gura Ifatabuguzi", hitamo plan, hanyuma ukurikize amabwiriza yo kwishyura (MTN Mobile Money cyangwa Airtel).',
      'Ushobora kwishyura ukoresheje *182*8*1*1249908*PRICE# kuri MTN cyangwa Airtel Money kuri 0735610542.',
      'Nyuma yo kwishyura, andika amazina yawe mu gihe cya step 3 kugira ngo tugusuzume.'
    ]},
    { id: 'd7', question: 'Nshobora kubona ibisubizo mu gihe cy’imyitozo?', answers: [
      'Yego! Ibizamini byose bitanga ibisubizo mu gihe runaka kugira ngo wiyigishe neza kandi wikosore vuba.',
      'Ibisubizo bigaragara nyuma yo gusubiza buri kibazo cyangwa nyuma y’ikizamini.',
      'Ushobora kureba ibisubizo byose mu mateka yawe y’imyitozo.'
    ]}
  ];

  let faqs = [];
  let isOpen = false;
  let currentFeedbackEl = null;
  let currentPersona = 'manzi'; // 'manzi' | 'rugamba'
  let chatHasClosedOnce = false; // progressive answers only start after first close (per tab)
  let hasShownGreetingThisSession = false;
  let rugambaGreetedThisSession = false; // Rugamba intro only types once per tab session, not on every toggle

  // Separate chat histories per persona (each has its own "room")
  let manziHistory = '';
  let rugambaHistory = '';

  // User info for chat (like WhatsApp)
  let currentUserName = 'Wowe';
  try {
    const saved = localStorage.getItem('roadRulesUser');
    if (saved) {
      const u = JSON.parse(saved);
      if (u && u.name) currentUserName = u.name.split(' ')[0];
    }
  } catch (_) {}

  // Persistent Manzi welcome (shown once with typing, then stays forever until explicit close)
  const MANZI_WELCOME_MESSAGE = "Murakaza neza! Ni iki ushaka....";

  function hasUkweziAccess() {
    try {
      const u = JSON.parse(localStorage.getItem('roadRulesUser') || 'null');
      if (!u || !u.subscription) return false;
      return u.subscription.plan === 'ukwezi' && u.subscription.status === 'approved';
    } catch (_) { return false; }
  }

  function getUserPerformance() {
    try {
      const u = JSON.parse(localStorage.getItem('roadRulesUser') || 'null');
      const key = `roadRulesExamHistory_${u ? u.phone : 'guest'}`;
      const history = JSON.parse(localStorage.getItem(key) || '[]');
      if (!history.length) return null;
      const recent = history.slice(0, 5);
      const scores = recent.map(r => (r.score || 0));
      const avg = Math.round(scores.reduce((a,b)=>a+b,0) / scores.length);
      const last = recent[0];
      const avgTimeSec = recent.reduce((sum, r) => sum + (r.timeTaken || 720), 0) / recent.length;
      return { 
        recent, 
        avgScore: avg, 
        lastScore: last.score, 
        avgTime: Math.round(avgTimeSec), 
        count: history.length,
        lastDate: last.date 
      };
    } catch (_) { return null; }
  }

  // ========== CHAT PROGRESS TRACKING (multi-answer per question) ==========
  function getChatProgressKey() {
    try {
      const u = JSON.parse(localStorage.getItem('roadRulesUser') || 'null');
      return `roadRulesChatProgress_${u ? u.phone : 'guest'}`;
    } catch (_) { return 'roadRulesChatProgress_guest'; }
  }

  function getAskedAnswersMap() {
    try {
      return JSON.parse(localStorage.getItem(getChatProgressKey()) || '{}');
    } catch (_) { return {}; }
  }

  function saveAskedAnswersMap(map) {
    try { localStorage.setItem(getChatProgressKey(), JSON.stringify(map)); } catch (_) {}
  }

  function getSeenCountForFaq(faqId) {
    const map = getAskedAnswersMap();
    return map[faqId] || 0;
  }

  function markAnswerSeen(faqId) {
    const map = getAskedAnswersMap();
    map[faqId] = (map[faqId] || 0) + 1;
    saveAskedAnswersMap(map);
    return map[faqId];
  }

  function resetProgressForFaq(faqId) {
    const map = getAskedAnswersMap();
    delete map[faqId];
    saveAskedAnswersMap(map);
  }

  // Mwarimu (Rugamba) pulls random questions exclusively from the official bank in questions.js
  // No prewritten questions are used.

  // Create FAB
  const fab = document.createElement('button');
  fab.id = 'rr-help-fab';
  fab.className = 'fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[9999] flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 text-white shadow-2xl shadow-blue-900/40 ring-1 ring-blue-400/30 hover:scale-105 active:scale-95 transition-all duration-200';
  fab.setAttribute('aria-label', 'Help Center');
  fab.innerHTML = `
    <i class="fa-solid fa-headset text-xl md:text-2xl"></i>
    <span class="absolute -top-0.5 -right-0.5 h-3 w-3 md:h-3.5 md:w-3.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-900 animate-pulse"></span>
  `;
  document.body.appendChild(fab);
  // Force visible (defensive against visibility logic on imyitozo etc.)
  fab.style.display = 'flex';
  fab.style.pointerEvents = 'auto';

  // Create Chat Panel (ultra premium & professional)
  const panel = document.createElement('div');
  panel.id = 'rr-help-panel';
  panel.className = 'hidden fixed bottom-16 md:bottom-20 right-4 md:right-6 z-[99999] w-[94vw] max-w-[360px] sm:max-w-[380px] md:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-3xl overflow-hidden flex flex-col';
  panel.style.boxShadow = '0 30px 80px -15px rgb(15 23 42 / 0.35), 0 10px 10px -5px rgb(0 0 0 / 0.1), 0 0 0 1px rgba(148,163,184,0.08) inset';
  
  // Original behavior: max-height only, perfectly anchored from bottom
  const maxH = window.innerWidth <= 768 ? '550px' : '450px';
  panel.style.maxHeight = maxH;
  panel.innerHTML = `
    <!-- Premium Header with Persona Switcher -->
    <div class="px-4 py-2 sm:py-[11px] bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
      <div class="flex items-center gap-3">
        <!-- Dynamic Avatar -->
        <div id="rr-persona-avatar" class="relative flex-shrink-0">
          <img src="https://i.pravatar.cc/40?img=28" 
               class="w-10 h-10 rounded-2xl object-cover ring-2 ring-white dark:ring-slate-900 shadow-sm" 
               alt="Manzi">
          <div class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"></div>
        </div>

    <div class="flex-1 min-w-0">
      <div id="rr-current-persona-name" class="font-semibold text-[13.5px] leading-none text-slate-800 dark:text-slate-100">Manzi</div>
      <div id="rr-persona-status" class="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span class="font-medium">Online now • RoadRules Support</span>
      </div>
    </div>

        <!-- Close -->
        <button id="rr-help-close" 
                class="flex h-9 w-9 items-center justify-center rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
                aria-label="Close help">
          <i class="fa-solid fa-times text-lg"></i>
        </button>
      </div>
    </div>

    <!-- Messages Area (premium) -->
    <div id="rr-help-messages" 
         class="flex-1 px-3.5 md:px-4 py-2 sm:py-3.5 space-y-2.5 overflow-y-auto bg-[#F8FAFC] dark:bg-slate-950 text-[14px] leading-[1.4] custom-scroll" 
         style="min-height: 0;"></div>

    <!-- Special Mwarimu Welcome Banner (dismissible) -->
    <div id="rr-mwarimu-banner" class="hidden px-4 py-1.5 sm:py-2 bg-amber-50 dark:bg-amber-950/40 border-t border-amber-100 dark:border-amber-900 text-[13px] text-amber-700 dark:text-amber-300 flex items-start gap-2">
      <div class="flex-1 leading-snug">Ubu noneho ushobora kuvugana na mwarimu akakubwira nimba warihuguye bihagije.</div>
      <button id="rr-mwarimu-banner-close" class="mt-px text-amber-600 hover:text-amber-800 dark:hover:text-amber-200"><i class="fa-solid fa-times"></i></button>
    </div>

    <!-- Quick Replies (Manzi only) -->
    <div id="rr-help-suggestions" class="px-4 py-2 sm:py-3.5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hidden">
      <div class="text-[11px] font-medium tracking-[0.5px] text-slate-500 dark:text-slate-400 mb-1 sm:mb-2">Quick questions</div>
      <div id="rr-help-chips" class="flex flex-wrap gap-2"></div>
    </div>

    <!-- Mwarimu Bottom "Typing / Choose" Bar (user-triggered, no auto writing by Mwarimu) -->
    <div id="rr-mwarimu-bottom-bar" class="hidden px-3 py-2 sm:py-2.5 border-t border-amber-100 dark:border-amber-900 bg-gradient-to-b from-amber-50/60 to-white dark:from-amber-950/30 dark:to-slate-900">
      <div id="rr-mwarimu-bar-trigger"
           class="flex items-center gap-3 px-4 py-2 sm:py-[10px] rounded-3xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-sm cursor-pointer active:scale-[0.985] transition shadow-sm">
        <i class="fa-solid fa-comment-dots text-amber-600 dark:text-amber-400"></i>
        <span class="flex-1 text-amber-700 dark:text-amber-300 text-[14px]">Kanda hano kugira ngo uhite ibintu ushaka Mwarimu akubwire...</span>
        <i class="fa-solid fa-chevron-up text-amber-500 text-[11px]"></i>
      </div>
    </div>

    <!-- Persona Switcher at bottom (current on top row, other below; clicking bottom one swaps & activates) -->
    <div id="rr-bottom-persona-bar" class="px-2 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col gap-1 text-[13px]">
      <!-- populated dynamically by updateBottomPersonaBar() -->
    </div>
  `;
  document.body.appendChild(panel);

  // Small styles for persona switcher (injected once)
  const style = document.createElement('style');
  style.textContent = `
    .rr-persona-btn { transition: all .1s ease; font-weight: 600; }
    .rr-persona-btn.active { box-shadow: 0 1px 2px rgb(0 0 0 / 0.05); }

    #rr-help-panel {
      max-height: 450px;
    }
    #rr-help-panel > :not(#rr-help-messages) { flex-shrink: 0; }
    #rr-help-messages { min-height: 0 !important; flex: 1 1 auto; }

    /* Minor mobile tweaks only (spacing, not height) */
    @media (max-width: 620px) {
      #rr-help-panel { bottom: 6px !important; }
      #rr-help-messages, #rr-help-suggestions,
      #rr-mwarimu-bottom-bar, #rr-bottom-persona-bar {
        padding-top: 4px !important;
        padding-bottom: 4px !important;
      }
    }
    @media (max-width: 480px) {
      #rr-help-panel { bottom: 4px !important; }
    }
  `;
  document.head.appendChild(style);

  const messagesEl = panel.querySelector('#rr-help-messages');
  const suggestionsWrap = panel.querySelector('#rr-help-suggestions');
  const chipsEl = panel.querySelector('#rr-help-chips');
  const closeBtn = panel.querySelector('#rr-help-close');

  // Mwarimu bottom choose bar (user-triggered drop-up style)
  const mwarimuBar = panel.querySelector('#rr-mwarimu-bottom-bar');
  const mwarimuBarTrigger = panel.querySelector('#rr-mwarimu-bar-trigger');
  const bottomPersonaBar = panel.querySelector('#rr-bottom-persona-bar');

  function updateBottomPersonaBar() {
    if (!bottomPersonaBar) return;
    const isRugamba = currentPersona === 'rugamba';
    let html = '';
    if (isRugamba) {
      // Rugamba current (top), Manzi below
      html = `
        <div data-p="rugamba" class="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-semibold cursor-default">
          <span>Rugamba</span>
           <span class="text-[11px] opacity-70">Mwarimu</span>
           <span class="ml-auto text-[10px] font-medium opacity-60">current</span>
        </div>
        <div data-p="manzi" class="flex items-center gap-2 px-3 py-1 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer transition">
          <span>Manzi</span>
           <span class="text-[11px] opacity-70">ushinzwe ubufasha</span>
        </div>
      `;
    } else {
      // Manzi current (top), Rugamba below
      html = `
        <div data-p="manzi" class="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold cursor-default">
          <span>Manzi</span>
           <span class="text-[11px] opacity-70">ushinzwe ubufasha</span>
           <span class="ml-auto text-[10px] font-medium opacity-60">current</span>
        </div>
        <div data-p="rugamba" class="flex items-center gap-2 px-3 py-1 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer transition">
          <span>Rugamba</span>
           <span class="text-[11px] opacity-70">Mwarimu</span>
        </div>
      `;
    }
    bottomPersonaBar.innerHTML = html;
    bottomPersonaBar.querySelectorAll('[data-p]').forEach(el => {
      if (el.dataset.p !== currentPersona) {
        el.onclick = () => setPersona(el.dataset.p);
      }
    });
  }

  // Utility
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Ultra-premium WhatsApp-style bubbles (professional)
  function addChatBubble(text, isUser = false) {
    const wrapper = document.createElement('div');
    wrapper.className = `flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!isUser) {
      // Bot (left) – real support agent
      const isRugambaNow = currentPersona === 'rugamba';
      const avatar = document.createElement('img');
      avatar.src = isRugambaNow ? 'https://i.pravatar.cc/36?img=47' : 'https://i.pravatar.cc/36?img=28';
      avatar.className = 'w-[26px] h-[26px] rounded-2xl object-cover ring-1 ring-slate-200 dark:ring-slate-700 flex-shrink-0 self-start mt-0.5';
      avatar.alt = isRugambaNow ? 'Rugamba Mwarimu' : 'Manzi';

      const col = document.createElement('div');
      col.className = 'flex flex-col max-w-[80%]';

      const isRugamba = currentPersona === 'rugamba';
      const nameRow = document.createElement('div');
      nameRow.className = 'flex items-center gap-1.5 mb-0.5 ml-1';
      nameRow.innerHTML = isRugamba 
        ? `<span class="text-[12px] font-semibold text-amber-700 dark:text-amber-400">Rugamba</span><span class="text-[10px] text-amber-600/70 dark:text-amber-400/70">• Mwarimu</span>`
        : `<span class="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">Manzi</span><span class="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">• Ushinzwe ubufasha</span>`;

      const bubbleWrap = document.createElement('div');
      bubbleWrap.className = 'relative';

      const bubble = document.createElement('div');
      bubble.className = 'px-3.5 py-2.5 rounded-3xl rounded-bl-[6px] text-[14px] leading-[1.38] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-sm break-words';
      bubble.textContent = text;

      // subtle left tail
      const tail = document.createElement('div');
      tail.className = 'absolute -left-[5px] bottom-[5px] w-3 h-3 bg-white dark:bg-slate-800 border-l border-b border-slate-200 dark:border-slate-700 rotate-45 rounded-bl';

      const ts = document.createElement('div');
      ts.className = 'text-[10.5px] text-slate-400 dark:text-slate-500 mt-0.5 ml-1.5';
      ts.textContent = time;

      bubbleWrap.appendChild(bubble);
      bubbleWrap.appendChild(tail);
      col.appendChild(nameRow);
      col.appendChild(bubbleWrap);
      col.appendChild(ts);

      wrapper.appendChild(avatar);
      wrapper.appendChild(col);
    } else {
      // User (right)
      const bubble = document.createElement('div');
      bubble.className = 'flex-1 px-3.5 py-2.5 rounded-3xl rounded-br-[6px] text-[14px] leading-[1.38] bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-sm break-words';
      bubble.textContent = text;

      const initials = currentUserName.slice(0, 2).toUpperCase();
      const avatar = document.createElement('div');
      avatar.className = 'w-[26px] h-[26px] rounded-2xl bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 self-start ring-1 ring-blue-300 shadow-sm';
      avatar.textContent = initials;

      const ts = document.createElement('div');
      ts.className = 'absolute text-[10px] text-blue-200/70 -bottom-3 right-1';
      ts.textContent = time;

      const bubbleWrap = document.createElement('div');
      bubbleWrap.className = 'relative';
      bubbleWrap.appendChild(bubble);
      bubbleWrap.appendChild(ts);

      wrapper.appendChild(bubbleWrap);
      wrapper.appendChild(avatar);
    }

    messagesEl.appendChild(wrapper);
    scrollToBottom();

    // Keep the current persona's chat saved (survives reload until explicit close)
    saveCurrentPersonaHistory();

    return isUser ? wrapper.firstElementChild.firstElementChild : wrapper.querySelector('.px-3\\.5');
  }

  function showTypingIndicator() {
    const el = document.createElement('div');
    el.id = 'rr-typing';
    el.className = 'flex justify-start items-end gap-2.5 pl-1';
    const avatarSrc = currentPersona === 'rugamba' ? 'https://i.pravatar.cc/36?img=47' : 'https://i.pravatar.cc/36?img=28';
    el.innerHTML = `
      <img src="${avatarSrc}" class="w-[26px] h-[26px] rounded-2xl object-cover ring-1 ring-slate-200 dark:ring-slate-700" alt="">
      <div class="px-4 py-[9px] rounded-3xl rounded-bl-[5px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 shadow-sm">
        <span class="block w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay:0ms"></span>
        <span class="block w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay:140ms"></span>
        <span class="block w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay:260ms"></span>
      </div>
    `;
    messagesEl.appendChild(el);
    scrollToBottom();
    return el;
  }

  function removeTypingIndicator() {
    const t = document.getElementById('rr-typing');
    if (t) t.remove();
  }

  // Beautiful typewriter effect (slightly slower = more natural)
  async function typeWriter(bubble, fullText, speed = 29) {
    bubble.textContent = '';
    for (let i = 0; i < fullText.length; i++) {
      bubble.textContent += fullText[i];
      scrollToBottom();
      await sleep(speed + (Math.random() * 11));
    }
  }

  async function loadFaqs() {
    const FAST_CACHE_KEY = 'rrHelpFaqs_v2'; // bumped for new answers[] shape
    try {
      const fast = localStorage.getItem(FAST_CACHE_KEY);
      if (fast) {
        const parsed = JSON.parse(fast);
        if (Array.isArray(parsed) && parsed.length) faqs = parsed;
      }
    } catch (_) {}

    try {
      const remote = await (window.RoadRulesAuth && window.RoadRulesAuth.getHelpFaqs ? window.RoadRulesAuth.getHelpFaqs() : []);
      if (Array.isArray(remote) && remote.length > 0) {
        // Normalize old shape {answer: string} → {answers: string[]}
        faqs = remote.map(f => {
          if (f.answers && Array.isArray(f.answers) && f.answers.length) return f;
          if (f.answer) return { ...f, answers: [f.answer, "Ibindi bisubizo birimo mu gihe cya vuba.", "Murakoze. Kanda WhatsApp niba hari ikindi kibazo."] };
          return { ...f, answers: ["Ntago hari igisubizo cyanditse."] };
        });
        try { localStorage.setItem(FAST_CACHE_KEY, JSON.stringify(faqs)); } catch (_) {}
      } else if (!faqs.length) {
        faqs = DEFAULT_FAQS;
      }
    } catch (_) {
      if (!faqs.length) faqs = DEFAULT_FAQS;
    }
  }

  function renderChips() {
    chipsEl.innerHTML = '';
    // Questions no longer disappear after 3 answers.
    // They cycle back to the first alternative answer (alt1) after every 3 asks.
    const available = faqs;

    available.slice(0, 6).forEach(faq => {
      const chip = document.createElement('button');
      chip.className = 'group flex items-center gap-1.5 text-[13px] px-3.5 py-[7px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-200 dark:hover:border-blue-700 hover:bg-blue-50/60 dark:hover:bg-slate-700 active:scale-[0.985] transition text-left shadow-sm';
      chip.innerHTML = `
        <i class="fa-solid fa-comment-dots text-blue-600/70 dark:text-blue-400/70 group-hover:text-blue-600 transition text-[11px]"></i>
        <span class="text-slate-700 dark:text-slate-300">${faq.question.length > 68 ? faq.question.slice(0, 66) + '…' : faq.question}</span>
      `;
      chip.onclick = () => handleQuestionClick(faq);
      chipsEl.appendChild(chip);
    });

    suggestionsWrap.classList.remove('hidden');
  }

  function hideChips() {
    suggestionsWrap.classList.add('hidden');
  }

  async function handleQuestionClick(faq) {
    hideChips();

    // User message (with profile avatar)
    addChatBubble(faq.question, true);

    // Determine which answer version to show.
    // Progressive answers cycle: after 3 answers, it restarts from alt1 (first answer).
    // Progressive ONLY activates after the user has closed the chat box at least once.
    const answersArr = (faq.answers && faq.answers.length) ? faq.answers : [faq.answer || 'Ntago hari igisubizo.'];
    let answerIndex = 0;

    if (chatHasClosedOnce) {
      const seen = getSeenCountForFaq(faq.id);
      answerIndex = seen % answersArr.length;   // cycles 0,1,2,0,1,2,...
    }

    const answerText = answersArr[answerIndex];

    // Typing indicator
    const typing = showTypingIndicator();
    await sleep(650 + Math.random() * 350);
    removeTypingIndicator();

    // Bot answer with typewriter (real person style)
    const botBubble = addChatBubble('', false);
    await typeWriter(botBubble, answerText, 26);

    // Only mark "seen" (advance the counter) on subsequent asks after close
    if (chatHasClosedOnce) {
      markAnswerSeen(faq.id);
    }

    // Feedback line
    showFeedbackRow();
  }

  function showFeedbackRow() {
    // Remove previous if any
    if (currentFeedbackEl) currentFeedbackEl.remove();

    const row = document.createElement('div');
    row.className = 'pt-1';
    row.innerHTML = `
      <div class="text-[11px] text-slate-500 px-1 mb-1">Icyo wabazaga wakibonye?</div>
      <div class="flex gap-2">
        <button class="rr-fb-yes flex-1 py-1.5 text-sm font-semibold rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white transition">Yego</button>
        <button class="rr-fb-no flex-1 py-1.5 text-sm font-semibold rounded-2xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition">Oya</button>
      </div>
    `;
    messagesEl.appendChild(row);
    currentFeedbackEl = row;
    scrollToBottom();

    row.querySelector('.rr-fb-yes').onclick = () => {
      row.innerHTML = `<div class="px-1 py-1 text-emerald-600 text-sm font-medium">Murakoze! Niba hari ikindi, kanda ikoni y’ubufasha.</div>`;
      setTimeout(() => {
        if (row && row.parentNode) row.parentNode.removeChild(row);
        currentFeedbackEl = null;
      }, 1600);
    };

    row.querySelector('.rr-fb-no').onclick = () => {
      row.innerHTML = `
        <div class="text-[11px] text-slate-500 px-1">Ushaka kuvugana natwe kuri WhatsApp cyangwa ushaka kongera guhitamo ikindi kibazo?</div>
        <div class="flex gap-2 mt-2">
          <button class="rr-wa-again flex-1 py-1.5 text-sm font-semibold rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white">Vugana kuri WhatsApp</button>
          <button class="rr-choose-again flex-1 py-1.5 text-sm font-semibold rounded-2xl border border-slate-300 dark:border-slate-600">Hitamo ikindi kibazo</button>
        </div>
      `;
      scrollToBottom();

      row.querySelector('.rr-wa-again').onclick = () => {
        window.open('https://wa.me/250788762976?text=Mwiriwe,%20ndi%20ku%20rubuga%20rwa%20RoadRules%20nkeneye%20ubufasha', '_blank');
      };
      row.querySelector('.rr-choose-again').onclick = () => {
        row.remove();
        currentFeedbackEl = null;

        // Always show the full list of questions again.
        // User must manually re-select the same question from the chips
        // to receive the next alternative answer (progressive only happens on re-choose).
        renderChips();
        scrollToBottom();
      };
    };
  }

  async function resetConversation() {
    messagesEl.innerHTML = '';
    currentFeedbackEl = null;

    if (currentPersona === 'rugamba' && hasUkweziAccess()) {
      loadRugambaExperience(true);
      return;
    }

    // Normal Manzi greeting (persistent welcome)
    const greet = addChatBubble('', false);
    await typeWriter(greet, MANZI_WELCOME_MESSAGE, 28);
    renderChips();
  }

  // ========== RUGAMBA (MWARIMU) PREMIUM EXPERIENCE ==========
  async function loadRugambaExperience(isReset = false) {
    if (!hasUkweziAccess()) {
      showUkweziPrompt();
      return;
    }

    if (!isReset) {
      messagesEl.innerHTML = '';
      currentFeedbackEl = null;
    }

    // Check if admin-set time has passed and send auto message
    checkAndSendAutoRugambaMessage();

    const perf = getUserPerformance();

    if (!rugambaGreetedThisSession) {
      // Check if auto message should be sent instead of initial greeting
      const adminSetTime = localStorage.getItem('rrRugambaAutoTime') || '24';
      const hours = parseInt(adminSetTime);
      const loginTime = localStorage.getItem('rrUserLoginTime');
      
      if (!loginTime || (Date.now() - parseInt(loginTime)) / (1000 * 60 * 60) < hours) {
        // Initial greeting from Rugamba — types ONLY ONCE per tab session (not on every toggle)
        const greet = addChatBubble('', false);
        const greetText = perf 
          ? `Muraho ${currentUserName}! Ni me Rugamba, Mwarimu w'ibizamini. Narebye amateka yawe y'imyitozo. Wabayeho neza cyane mu myitozo ya vuba!` 
          : `Muraho ${currentUserName}! Ni me Rugamba, Mwarimu w'ibizamini. Nshobora kukubwira uko urimo mu myitozo yawe no kukubwira nimba warihuguye bihagije.`;

        await typeWriter(greet, greetText, 24);

        rugambaGreetedThisSession = true;
        try { sessionStorage.setItem('rrRugambaGreeted', '1'); } catch (_) {}
      }
      // If time has passed, the auto message will be sent by checkAndSendAutoRugambaMessage()
    }
    // On subsequent toggles: no repeat greeting. Clean area + bottom bar lets user choose actions.

    // Do NOT auto-write the action list.
    // The bottom bar (#rr-mwarimu-bottom-bar) is now visible (set in setPersona).
    // User clicks the bar to reveal the options (drop-up style).
    // After any action finishes, we re-show the bar so they can trigger again easily.
  }

  function showMwarimuActions(perf) {
    // Remove old feedback/chips
    hideChips();
    if (currentFeedbackEl) { currentFeedbackEl.remove(); currentFeedbackEl = null; }

    const actions = document.createElement('div');
    actions.className = 'px-1 py-2 space-y-1.5';
    actions.innerHTML = `
      <div class="text-[11px] uppercase tracking-[0.5px] text-amber-600 dark:text-amber-400 font-medium px-1 mb-1">Ibintu ushobora gukora</div>
      
      <button class="mwarimu-action w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-sm transition" data-action="performance">
        <i class="fa-solid fa-chart-line w-5 text-amber-600"></i>
        <span>Reba uko nagiye mu myitozo yanjye</span>
      </button>
      
      <button class="mwarimu-action w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-sm transition" data-action="ready">
        <i class="fa-solid fa-check-double w-5 text-amber-600"></i>
        <span>Nshobora gutsinda ikizamini uyu munsi?</span>
      </button>
      
      <button class="mwarimu-action w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-sm transition" data-action="challenge">
        <i class="fa-solid fa-tachometer-alt w-5 text-amber-600"></i>
        <span>Nkwiyitezeho ibibazo 5 (Last Challenge)</span>
      </button>
      
      <button class="mwarimu-action w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-sm transition" data-action="advice">
        <i class="fa-solid fa-lightbulb w-5 text-amber-600"></i>
        <span>Inama y’umwanya</span>
      </button>
    `;
    messagesEl.appendChild(actions);
    scrollToBottom();
    saveCurrentPersonaHistory();

    // Wire actions
    actions.querySelectorAll('.mwarimu-action').forEach(btn => {
      btn.onclick = () => handleMwarimuAction(btn.dataset.action, perf);
    });
  }

  async function handleMwarimuAction(action, perf) {
    // Remove the action buttons
    const lastActions = messagesEl.lastElementChild;
    if (lastActions) lastActions.remove();

    if (action === 'performance') {
      
      const typing = showTypingIndicator();
      await sleep(700);
      removeTypingIndicator();

      if (!perf) {
        const msg = addChatBubble('', false);
        await typeWriter(msg, 'Ntabwo hari amateka y’imyitozo yagaragara. Tangira ukore imyitozo 2-3 hanyuma uzagaruka, nzagukorera raporo y’ukuri.', 22);
        // Bottom bar remains visible for user to tap again
        return;
      }

      // Show nice performance cards
      const perfDiv = document.createElement('div');
      perfDiv.className = 'space-y-2 px-1';
      perfDiv.innerHTML = `
        <div class="text-[11px] text-amber-600 dark:text-amber-400 font-medium px-1">Raporo y’imyitozo ya vuba</div>
        ${perf.recent.slice(0,3).map((ex, i) => `
          <div class="bg-white dark:bg-slate-800 border border-amber-100 dark:border-amber-900 rounded-2xl px-4 py-2.5 text-sm">
            <div class="flex justify-between items-center">
              <div><span class="font-semibold">${ex.score}%</span> <span class="text-[11px] text-slate-500">• ${ex.correct}/${ex.total} by’ukuri</span></div>
              <div class="text-[11px] text-slate-500">${new Date(ex.date).toLocaleDateString('rw-RW', {month:'short', day:'numeric'})}</div>
            </div>
            <div class="text-[11px] text-slate-500 mt-0.5">Igihe: ${Math.round((ex.timeTaken||720)/60)} min</div>
          </div>
        `).join('')}
        <div class="text-[11px] px-1 text-emerald-600 dark:text-emerald-400 font-medium">Amakuru yawe y’umwanya: <strong>${perf.avgScore}%</strong> (Igipimo cyo gutsinda)</div>
      `;
      messagesEl.appendChild(perfDiv);
      scrollToBottom();

      const comment = addChatBubble('', false);
      await typeWriter(comment, `Wabayeho neza! Mu myitozo ${perf.count} ushize, igipimo cyawe ni ${perf.avgScore}%. Uko urimo ni umwanya mwiza cyane.`, 23);

      // Bottom bar is always visible for Rugamba – user taps it to choose again
    } else if (action === 'ready') {
      const typing = showTypingIndicator(); await sleep(650); removeTypingIndicator();

      const p = perf || {avgScore: 68};
      let verdict = '';
      if (p.avgScore >= 82) {
        verdict = `Yego, uko urimo ni umwanya mwiza cyane. Warihuguye bihagije. Ushobora gutsinda ikizamini uyu munsi kandi ukagenda ukora akazi.`;
      } else if (p.avgScore >= 72) {
        verdict = `Urahugutse neza, ariko wongere gukora imyitozo 3-4 y’ibisubizo by’ukuri. Ushobora gutsinda, ariko witange.`;
      } else {
        verdict = `Uko urimo ni umwanya mwiza, ariko ntuwigeze uhuguka bihagije. Kora imyitozo 5-6 z’ibizamini by’ukuri mbere yo kujya mu kizamini.`;
      }

      const reply = addChatBubble('', false);
      await typeWriter(reply, verdict, 22);

      // Bottom bar always available – tap to choose next action
    } else if (action === 'challenge') {
      const typing = showTypingIndicator(); await sleep(600); removeTypingIndicator();

      const startMsg = addChatBubble('', false);
      await typeWriter(startMsg, 'Nje! Nzakubaza ibibazo 5 by’umwanya. Subiza neza kugira ngo nkwemeze ko warihuguye bihagije.', 22);

      // Start the mini challenge quiz
      setTimeout(() => startMwarimuChallenge(), 450);

    } else if (action === 'advice') {
      const typing = showTypingIndicator(); await sleep(550); removeTypingIndicator();

      const advice = addChatBubble('', false);
      await typeWriter(advice, 'Inama yanjye: Kora imyitozo ya vuba y’ibimenyetso n’ibisubizo by’ukuri. Igihe cy’ikizamini usibye amasegonda 45 kuri buri kibazo. Uduke dukeya ni byo bigutera amahirwe menshi.', 21);

      // User can tap the bottom bar anytime to get fresh options
    }
  }

  // Mini 5-question challenge (fully simulated)
  let challengeState = { index: 0, correct: 0, questions: [] };

  async function startMwarimuChallenge() {
    challengeState = { index: 0, correct: 0, questions: [] };

    let bank = [];
    if (window.RoadRulesQuestions && Array.isArray(window.RoadRulesQuestions)) {
      // Use real official questions (only those with 4 options)
      bank = window.RoadRulesQuestions
        .filter(q => Array.isArray(q.options) && q.options.length === 4)
        .map(q => ({
          q: q.question,
          opts: q.options,
          ans: q.answer
        }));
    }

    if (bank.length < 5) {
      // No prewritten fallback — questions.js must be loaded (we include it on all pages)
      const errBubble = addChatBubble('', false);
      await typeWriter(errBubble, 'Ntabibazo byabonetse. Reba ko questions.js yashyizweho neza.', 20);
      // Bottom bar remains for next try
      return;
    }

    const shuffled = [...bank].sort(() => 0.5 - Math.random());
    challengeState.questions = shuffled.slice(0, 5);

    await askNextChallengeQuestion();
  }

  async function askNextChallengeQuestion() {
    const { index, questions } = challengeState;
    if (index >= questions.length) {
      await finishMwarimuChallenge();
      return;
    }

    const q = questions[index];
    const qBubble = addChatBubble('', false);
    await typeWriter(qBubble, `Ikibazo cya ${index+1}/5: ${q.q}`, 19);

    // Options as nice buttons
    const optsDiv = document.createElement('div');
    optsDiv.className = 'px-1 pt-1 pb-2 grid grid-cols-1 gap-1.5';
    q.opts.forEach((opt, i) => {
      const b = document.createElement('button');
      b.className = 'w-full text-left px-4 py-2.5 text-sm rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-800 active:bg-blue-100 transition';
      b.innerHTML = `<span class="font-semibold mr-2 text-blue-600">${String.fromCharCode(65+i)}.</span> ${opt}`;
      b.onclick = () => {
        optsDiv.remove();
        handleChallengeAnswer(i, q.ans);
      };
      optsDiv.appendChild(b);
    });
    messagesEl.appendChild(optsDiv);
    scrollToBottom();
  }

  async function handleChallengeAnswer(userAns, correctAns) {
    const isCorrect = userAns === correctAns;
    if (isCorrect) challengeState.correct++;

    const feedback = addChatBubble('', false);
    const fbText = isCorrect 
      ? 'Yego! Ibisubizo by’ukuri.' 
      : `Oya. Ibisubizo by’ukuri ni: ${String.fromCharCode(65+correctAns)}.`;
    await typeWriter(feedback, fbText, 18);

    challengeState.index++;
    setTimeout(() => askNextChallengeQuestion(), 380);
  }

  async function finishMwarimuChallenge() {
    const { correct, questions } = challengeState;
    const percent = Math.round((correct / questions.length) * 100);

    const final = addChatBubble('', false);
    let verdict = '';
    if (percent >= 80) {
      verdict = `Watsinze ${percent}%! Urahugutse bihagije. Ushobora kujya mu kizamini uyu munsi ukora akazi. Murakoze!`;
    } else if (percent >= 60) {
      verdict = `Watsinze ${percent}%. Warihuguye neza, ariko wongere gukora imyitozo imwe n’imwe. Ushobora gutsinda.`;
    } else {
      verdict = `Watsinze ${percent}%. Ntuwigeze uhuguka bihagije. Kora imyitozo myinshi mbere yo kujya mu kizamini.`;
    }

    await typeWriter(final, verdict, 22);

    // Final CTA
    const cta = document.createElement('div');
    cta.className = 'px-1 pt-2';
    cta.innerHTML = `
      <button onclick="window.RoadRulesHelp.close(); setTimeout(()=>window.location.href='imyitozo.html',300)" 
              class="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">Tangira Ikizamini Cy’ukuri</button>
    `;
    messagesEl.appendChild(cta);
    scrollToBottom();

    // After challenge, user taps the bottom bar to continue with Mwarimu
    // (no auto-written menu)
  }

  async function openPanel() {
    if (isOpen) return;
    isOpen = true;
    panel.classList.remove('hidden');
    panel.classList.add('flex');

    // Persist: remember panel is open so it doesn't auto-close on page reload / load
    try { sessionStorage.setItem('rrHelpPanelOpen', '1'); } catch (_) {}

    if (!faqs.length) await loadFaqs();

    // Restore the chat history for the current persona (each has its own separate place)
    // This makes the conversation survive reloads and persona toggles until explicit close.
    const savedHist = currentPersona === 'manzi' ? manziHistory : rugambaHistory;
    if (savedHist) {
      messagesEl.innerHTML = savedHist;
      scrollToBottom();
    }

    // Greeting only on the very first open of the panel in this tab/session
    const isFirstOpenEver = messagesEl.children.length === 0 && !hasShownGreetingThisSession;

    if (isFirstOpenEver) {
      hasShownGreetingThisSession = true;
      try { sessionStorage.setItem('rrChatGreetingShown', '1'); } catch (_) {}
      const typing = showTypingIndicator();
      await sleep(750);
      removeTypingIndicator();

      if (currentPersona === 'rugamba' && hasUkweziAccess()) {
        loadRugambaExperience(true);
      } else {
        const greet = addChatBubble('', false);
        await typeWriter(greet, MANZI_WELCOME_MESSAGE, 28);
        renderChips();
      }
    } else if (messagesEl.children.length === 0) {
      // Subsequent open (incl. page reload while panel left open) — re-show the Manzi welcome statically
      // so it never "disappears" on load or persona toggle (only cleared on explicit close)
      if (currentPersona === 'rugamba' && hasUkweziAccess()) {
        loadRugambaExperience(true);
      } else {
        const greet = addChatBubble('', false);
        greet.textContent = MANZI_WELCOME_MESSAGE; // instant (no typing animation on restore)
        renderChips();
      }
    } else {
      // History exists — just restore suggestions / mwarimu actions
      if (currentPersona === 'rugamba' && hasUkweziAccess()) {
        // Do not paste actions list into chat — user taps the bottom bar for drop-up choices
      } else if (!currentFeedbackEl) {
        renderChips();
      }
    }

    // Always make sure the persona toggle is visible and the correct bottom UI is shown
    updateBottomPersonaBar();

    if (currentPersona === 'rugamba' && hasUkweziAccess()) {
      if (mwarimuBar) mwarimuBar.classList.remove('hidden');
      if (suggestionsWrap) suggestionsWrap.classList.add('hidden');
    } else {
      if (mwarimuBar) mwarimuBar.classList.add('hidden');
      if (suggestionsWrap) suggestionsWrap.classList.remove('hidden');
      if (!currentFeedbackEl) renderChips();
    }

    scrollToBottom();
  }

  function closePanel() {
    // Save whatever the user was looking at before wiping everything
    saveCurrentPersonaHistory();

    isOpen = false;
    panel.classList.remove('flex');
    panel.classList.add('hidden');

    // Persist: only closed because user clicked close icon (or ESC). On next load it will stay closed.
    try { sessionStorage.setItem('rrHelpPanelOpen', '0'); } catch (_) {}

    chatHasClosedOnce = true;
    try { sessionStorage.setItem('rrChatHasClosedOnce', '1'); } catch (_) {}

    // Completely clear both personas' chats — fresh start only after explicit close
    manziHistory = '';
    rugambaHistory = '';
    try {
      sessionStorage.removeItem('rrChatManziHistory');
      sessionStorage.removeItem('rrChatRugambaHistory');
      sessionStorage.setItem('rrLastPersona', 'manzi');
    } catch (_) {}

    // Reset to Manzi for next open (fresh)
    currentPersona = 'manzi';
    if (mwarimuBanner) mwarimuBanner.classList.add('hidden');
    if (mwarimuBar) mwarimuBar.classList.add('hidden');

    // Clear chat history only when panel is closed (fresh start next time)
    messagesEl.innerHTML = '';
    currentFeedbackEl = null;
  }

  // Event listeners
  // FAB only opens the chatbot. It never closes it — close only happens via the dedicated close icon (X) or ESC.
  // This ensures "on load don't close" unless the user explicitly used the close icon.
  const openHelp = () => { if (!isOpen) openPanel(); };
  fab.addEventListener('click', openHelp);
  // Direct onclick fallback (in case addEventListener is blocked by other scripts on the page)
  fab.onclick = openHelp;
  closeBtn.addEventListener('click', closePanel);

  // ===== PERSONA SWITCHER LOGIC =====
  const currentNameEl = panel.querySelector('#rr-current-persona-name');
  const avatarWrap = panel.querySelector('#rr-persona-avatar');
  const statusEl = panel.querySelector('#rr-persona-status');
  const mwarimuBanner = panel.querySelector('#rr-mwarimu-banner');
  const bannerClose = panel.querySelector('#rr-mwarimu-banner-close');

  function saveCurrentPersonaHistory() {
    if (!messagesEl) return;
    const html = messagesEl.innerHTML;
    if (currentPersona === 'manzi') {
      manziHistory = html;
      try { sessionStorage.setItem('rrChatManziHistory', html); } catch (_) {}
    } else {
      rugambaHistory = html;
      try { sessionStorage.setItem('rrChatRugambaHistory', html); } catch (_) {}
    }
    try { sessionStorage.setItem('rrLastPersona', currentPersona); } catch (_) {}
  }

  function setPersona(persona) {
    if (persona === currentPersona) return;

    // Save the chat we are leaving (each persona keeps its own separate history)
    saveCurrentPersonaHistory();

    currentPersona = persona;
    try { sessionStorage.setItem('rrLastPersona', persona); } catch (_) {}

    // Update avatar + status (defensive to avoid TypeError if img not found)
    if (avatarWrap) {
      const img = avatarWrap.querySelector('img');
      if (img) {
        if (persona === 'rugamba') {
          img.src = 'https://i.pravatar.cc/40?img=47'; // teacher-like
          img.alt = 'Rugamba Mwarimu';
        } else {
          img.src = 'https://i.pravatar.cc/40?img=28';
          img.alt = 'Manzi';
        }
      }
    }

    if (statusEl) {
      if (persona === 'rugamba') {
        statusEl.innerHTML = `<span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span><span class="font-medium">Mwarimu • Coach w’ibizamini</span>`;
        statusEl.className = 'flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400';
      } else {
        statusEl.innerHTML = `<span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span><span class="font-medium">Online now • RoadRules Support</span>`;
        statusEl.className = 'flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400';
      }
    }

    if (currentNameEl) {
      currentNameEl.textContent = persona === 'rugamba' ? 'Rugamba' : 'Manzi';
    }

    // Handle Rugamba guard + special UI + restore its own chat history
    if (persona === 'rugamba') {
      if (!hasUkweziAccess()) {
        // Show guard prompt
        showUkweziPrompt();
        // Revert to Manzi
        setTimeout(() => {
          setPersona('manzi');
        }, 120);
        return;
      }
      // Allowed — show banner + Rugamba UI
      if (mwarimuBanner) mwarimuBanner.classList.remove('hidden');

      // Show Mwarimu bottom bar, hide normal Manzi chips
      if (mwarimuBar) mwarimuBar.classList.remove('hidden');
      if (suggestionsWrap) suggestionsWrap.classList.add('hidden');

      // Restore Rugamba's own chat (or start fresh with its greeting)
      messagesEl.innerHTML = rugambaHistory || '';
      if (!messagesEl.children.length) {
        loadRugambaExperience(true); // adds greeting only once (flag protected)
      } else {
        scrollToBottom();
      }
    } else {
      if (mwarimuBanner) mwarimuBanner.classList.add('hidden');

      // Hide Mwarimu bar, show normal suggestions for Manzi
      if (mwarimuBar) mwarimuBar.classList.add('hidden');
      if (suggestionsWrap) suggestionsWrap.classList.remove('hidden');

      // Restore Manzi's own chat (or the welcome message)
      messagesEl.innerHTML = manziHistory || '';
      if (!messagesEl.children.length) {
        const g = addChatBubble('', false);
        g.textContent = MANZI_WELCOME_MESSAGE;
      }
      hideChips();
      renderChips();
      scrollToBottom();
    }

    updateBottomPersonaBar();
  }

  function showUkweziPrompt() {
    // Clear current messages and show beautiful prompt
    messagesEl.innerHTML = '';
    const prompt = document.createElement('div');
    prompt.className = 'p-5 text-center';
    prompt.innerHTML = `
      <div class="mx-auto w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center mb-3">
        <i class="fa-solid fa-lock text-amber-600 dark:text-amber-400 text-2xl"></i>
      </div>
      <div class="font-semibold text-base text-amber-700 dark:text-amber-300 mb-1">Bisaba kuba ufite ifatabuguzi ry'ukwezi</div>
      <div class="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">Kugira ngo uvugane na Rugamba (Mwarimu) kugira ngo akubwire uko urimo mu myitozo, akakubwira nimba warihuguye bihagije, ugomba kugira ifatabuguzi ry’ukwezi.</div>
      <div class="flex gap-2">
        <button class="flex-1 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-600 text-sm font-medium" onclick="window.RoadRulesHelp.close()">Funga</button>
        <button onclick="window.location.href='ifitabuguzi.html'" class="flex-1 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold">Gura Ukwezi (1000 RWF)</button>
      </div>
    `;
    messagesEl.appendChild(prompt);
    scrollToBottom();
  }

  // Dismissible Mwarimu banner
  if (bannerClose && mwarimuBanner) {
    bannerClose.onclick = () => mwarimuBanner.classList.add('hidden');
  }

  // Auto-send Rugamba message after admin-set time
  function checkAndSendAutoRugambaMessage() {
    try {
      // Get admin-set time (in hours from login/start)
      const adminSetTime = localStorage.getItem('rrRugambaAutoTime') || '24'; // Default 24 hours
      const hours = parseInt(adminSetTime);
      
      // Check if enough time has passed
      const loginTime = localStorage.getItem('rrUserLoginTime');
      if (!loginTime) return;
      
      const loginTimestamp = parseInt(loginTime);
      const currentTime = Date.now();
      const hoursPassed = (currentTime - loginTimestamp) / (1000 * 60 * 60);
      
      if (hoursPassed >= hours) {
        // Send the auto message from Rugamba
        setTimeout(() => {
          if (currentPersona === 'rugamba' && isOpen) {
            const autoMsg = addChatBubble('', false);
            typeWriter(autoMsg, 'Ubu noneho ushobora kuvugana na mwarimu akakubwira nimba warihuguye bihagije.', 24);
            scrollToBottom();
          }
        }, 1000);
      }
    } catch (e) {
      console.log('Error checking auto Rugamba message:', e);
    }
  }

  // Store login time when user logs in (to be called by auth system)
  window.RoadRulesAuth = window.RoadRulesAuth || {};
  window.RoadRulesAuth.setLoginTime = function() {
    try {
      localStorage.setItem('rrUserLoginTime', Date.now().toString());
    } catch (e) {
      console.log('Error setting login time:', e);
    }
  };

  // Mwarimu bottom bar – user clicks to reveal action options (instead of Mwarimu typing them)
  if (mwarimuBarTrigger) {
    mwarimuBarTrigger.onclick = () => {
      if (currentPersona === 'rugamba' && hasUkweziAccess()) {
        const perf = getUserPerformance();
        showMwarimuActions(perf);
      }
    };
  }

  // Initialize default persona (Manzi)
  setPersona('manzi');

  // Optional: close on ESC when open
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

  // Make sure it works even if user clicks very early
  window.RoadRulesHelp = { open: openPanel, close: closePanel };

  // ========== SMART VISIBILITY: Hide on exam / review screens (imyitozo.html) ==========
  let visibilityObserver = null;

  function updateHelpVisibility() {
    const isExamPage = location.pathname.includes('imyitozo.html') || location.pathname.endsWith('/imyitozo');
    const isIbibazoPage = location.pathname.includes('ibibazo.html') || location.pathname.endsWith('/ibibazo');

    if (!isExamPage && !isIbibazoPage) {
      fab.style.display = '';
      return;
    }

    // Detect active exam or review states
    const hasActiveExam     = !!document.getElementById('exam-timer');
    const resultModalOpen   = document.getElementById('exam-result-modal')   && !document.getElementById('exam-result-modal').classList.contains('hidden');
    const reviewModalOpen   = document.getElementById('exam-review-modal')   && !document.getElementById('exam-review-modal').classList.contains('hidden');
    const correctingOpen    = document.getElementById('exam-correcting-modal') && !document.getElementById('exam-correcting-modal').classList.contains('hidden');
    const instructionsOpen  = document.getElementById('exam-instructions-modal') && !document.getElementById('exam-instructions-modal').classList.contains('hidden');

    // On Ibibazo page: hide when the "Isuzuma" modal (questions + answers) is open
    let ibibazoModalOpen = false;
    if (isIbibazoPage) {
      const m = document.getElementById('isuzuma-modal');
      ibibazoModalOpen = m && !m.classList.contains('hidden');
    }

    // Only hide the help fab during an *active* full-screen exam (when the timer is present).
    // Do not hide on normal browsing of the page or after-exam review modals.
    const shouldHide = hasActiveExam;

    if (shouldHide) {
      fab.style.display = 'none';
      if (isOpen) closePanel();
    } else {
      fab.style.display = 'flex';
    }
  }

  function setupExamAwareHiding() {
    // Initial check
    setTimeout(updateHelpVisibility, 120);

    // Watch for DOM changes (exam injected, modals toggled, etc.)
    const target = document.querySelector('main') || document.body;

    if (visibilityObserver) visibilityObserver.disconnect();

    let debounceTimer = null;
    visibilityObserver = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updateHelpVisibility, 80);
    });

    visibilityObserver.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    // Also re-check when user navigates back or clicks (safety)
    document.addEventListener('click', () => setTimeout(updateHelpVisibility, 150), { passive: true });

    // Expose manual refresh if needed by page scripts
    window.RoadRulesHelp.refreshVisibility = updateHelpVisibility;
  }

  // Activate smart hiding ONLY during actual active exams (timer present).
  // The fab must remain clickable on normal page browsing.
  if (location.pathname.includes('imyitozo') || location.pathname.includes('ibibazo')) {
    // Run a light initial check (no heavy observer needed for the over-hiding case)
    setTimeout(() => {
      const timer = document.getElementById('exam-timer');
      if (timer) {
        fab.style.display = 'none';
      } else {
        fab.style.display = 'flex';
      }
    }, 200);
  }

  // Auto-load FAQs in background (non-blocking)
  setTimeout(loadFaqs, 1800);

  // Restore session flags (persist across reloads in same tab)
  try {
    if (sessionStorage.getItem('rrChatHasClosedOnce') === '1') chatHasClosedOnce = true;
    if (sessionStorage.getItem('rrChatGreetingShown') === '1') hasShownGreetingThisSession = true;
    if (sessionStorage.getItem('rrRugambaGreeted') === '1') rugambaGreetedThisSession = true;

    // Per-persona chat histories + last used persona
    manziHistory = sessionStorage.getItem('rrChatManziHistory') || '';
    rugambaHistory = sessionStorage.getItem('rrChatRugambaHistory') || '';
    const lastP = sessionStorage.getItem('rrLastPersona');
    if (lastP === 'manzi' || lastP === 'rugamba') currentPersona = lastP;
  } catch (_) {}

  // Do NOT close the chatbot on page load. Only close when the user explicitly clicks the close icon (X).
  // If the panel was left open (flag=1), re-open it after load so it doesn't "disappear" on refresh.
  try {
    if (sessionStorage.getItem('rrHelpPanelOpen') === '1') {
      setTimeout(openPanel, 280);
    }
  } catch (_) {}

  console.log('%c[RoadRules] Premium Help Center widget ready (bottom-right, exam-aware)', 'color:#64748b');
})();
