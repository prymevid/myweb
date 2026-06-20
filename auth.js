// RoadRules Auth - Supabase Backend Driver
// All data operations go through /api/* endpoints (server uses Supabase service key)
// No Google Drive. No Firebase. No client-side credentials.

(function () {
    // ========== SESSION HELPERS ==========
    function getSession() {
        try { return JSON.parse(localStorage.getItem('roadRulesUser') || 'null'); } catch { return null; }
    }
    function saveSession(user) {
        try { localStorage.setItem('roadRulesUser', JSON.stringify(user)); } catch {}
    }
    function clearSession() {
        try { localStorage.removeItem('roadRulesUser'); } catch {}
    }

    // ========== API HELPERS ==========
    async function apiPost(path, body) {
        const res = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
        return data;
    }
    async function apiGet(path) {
        const res = await fetch(path);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
        return data;
    }
    async function apiPatch(path, body) {
        const res = await fetch(path, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
        return data;
    }
    async function apiDelete(path) {
        const res = await fetch(path, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
        return data;
    }

    // ========== TOAST ==========
    function showToast(msg, type = 'success') {
        const el = document.createElement('div');
        el.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-[95] px-5 py-3 rounded-3xl shadow-xl text-white text-sm flex items-center gap-2 ${type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`;
        el.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i> <span>${msg}</span>`;
        document.body.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200); }, 2800);
    }

    // ========== LOADER ==========
    let loadingCount = 0;
    let globalLoader = null;
    let globalLoaderSub = null;

    function ensureGlobalLoader() {
        if (globalLoader) return globalLoader;
        globalLoader = document.getElementById('roadrules-global-loader');
        if (!globalLoader) {
            globalLoader = document.createElement('div');
            globalLoader.id = 'roadrules-global-loader';
            globalLoader.className = 'fixed inset-0 z-[9999] hidden bg-black/75 items-center justify-center';
            globalLoader.innerHTML = `
                <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl px-9 py-8 text-center min-w-[280px]">
                    <div class="mb-5"><i class="fa-solid fa-spinner fa-spin text-4xl text-blue-600 dark:text-blue-400"></i></div>
                    <div class="font-semibold text-[17px] tracking-tight text-slate-800 dark:text-white">Tegereza Gato</div>
                    <div id="roadrules-loader-sub" class="text-[12.5px] text-slate-500 dark:text-slate-400 mt-1.5 min-h-[16px]"></div>
                </div>`;
            document.body.appendChild(globalLoader);
        }
        globalLoaderSub = globalLoader.querySelector('#roadrules-loader-sub');
        return globalLoader;
    }

    function showLoading(subMessage = '') {
        ensureGlobalLoader();
        loadingCount++;
        if (globalLoaderSub) globalLoaderSub.textContent = subMessage || '';
        globalLoader.style.display = 'flex';
        globalLoader.classList.remove('hidden');
        globalLoader.classList.add('flex');
        document.body.style.overflow = 'hidden';
        if (!globalLoader.dataset.keyListener) {
            globalLoader.dataset.keyListener = 'true';
            document.addEventListener('keydown', function blockEscape(e) {
                if (loadingCount > 0 && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); }
            }, true);
        }
    }

    function hideLoading() {
        if (!globalLoader) return;
        loadingCount = Math.max(0, loadingCount - 1);
        if (loadingCount === 0) {
            globalLoader.style.display = 'none';
            globalLoader.classList.remove('flex');
            globalLoader.classList.add('hidden');
            document.body.style.overflow = '';
            if (globalLoaderSub) globalLoaderSub.textContent = '';
        }
    }

    window.RoadRulesLoader = {
        show: (msg) => showLoading(msg),
        hide: () => hideLoading(),
        forceHide: () => { loadingCount = 0; hideLoading(); }
    };

    // ========== AUTH MODAL HTML ==========
    function createAuthModal() {
        if (document.getElementById('auth-modal')) return;
        const modalHTML = `
        <div id="auth-modal" class="hidden fixed inset-0 z-[90] items-center justify-center bg-black/60 p-4">
            <div onclick="event.target.id==='auth-modal' && closeAuthModal()" class="absolute inset-0"></div>
            <div class="relative w-full max-w-[380px] rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div class="flex items-center gap-x-3">
                        <div class="h-8 w-8 rounded-2xl bg-gradient-to-br from-blue-700 to-blue-800 flex items-center justify-center text-white">
                            <i class="fa-solid fa-road"></i>
                        </div>
                        <span class="font-semibold text-lg tracking-tight">RoadRules</span>
                    </div>
                    <button onclick="closeAuthModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-3xl leading-none px-1 -mt-1">&times;</button>
                </div>
                <div class="flex border-b border-slate-200 dark:border-slate-700 text-sm font-semibold">
                    <button id="tab-login" onclick="switchAuthTab('login')" class="flex-1 py-3.5 border-b-2 border-blue-700 text-blue-700 dark:text-blue-400">Injira</button>
                    <button id="tab-signup" onclick="switchAuthTab('signup')" class="flex-1 py-3.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Iyandikishe</button>
                </div>
                <form id="login-form" class="p-6 space-y-4">
                    <div>
                        <label class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 tracking-wide">NIMERO YA TELEFONE</label>
                        <input id="login-phone" type="tel" placeholder="0788 123 456" class="w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm focus:outline-none focus:border-blue-500">
                    </div>
                    <div>
                        <label class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 tracking-wide">IJAMBOBANGA</label>
                        <input id="login-pass" type="password" placeholder="••••••••" class="w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm focus:outline-none focus:border-blue-500">
                    </div>
                    <button type="submit" class="w-full py-3.5 mt-1 rounded-2xl bg-blue-700 hover:bg-blue-800 active:scale-[0.985] transition font-semibold text-sm text-white">Injira</button>
                    <div class="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                        Ntabwo ufite konti?
                        <span onclick="switchAuthTab('signup')" class="text-blue-700 dark:text-blue-400 cursor-pointer font-semibold hover:underline">Iyandikishe</span>
                    </div>
                </form>
                <form id="signup-form" class="p-6 space-y-4 hidden">
                    <div class="grid grid-cols-1 gap-y-4">
                        <div>
                            <label class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 tracking-wide">AMAZINA</label>
                            <input id="signup-name" type="text" placeholder="Jean Pierre Habimana" class="w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm">
                        </div>
                        <div>
                            <label class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 tracking-wide">NIMERO YA TELEFONE</label>
                            <input id="signup-phone" type="tel" placeholder="0788 123 456" class="w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm">
                        </div>
                        <div>
                            <label class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 tracking-wide">AKARERE (DISTRICT)</label>
                            <select id="signup-district" class="w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm">
                                <option value="Kigali">Kigali</option>
                                <option value="Musanze">Musanze</option>
                                <option value="Rubavu">Rubavu</option>
                                <option value="Huye">Huye</option>
                                <option value="Nyagatare">Nyagatare</option>
                                <option value="Rusizi">Rusizi</option>
                                <option value="Rwamagana">Rwamagana</option>
                                <option value="Gicumbi">Gicumbi</option>
                                <option value="Muhanga">Muhanga</option>
                                <option value="Ruhango">Ruhango</option>
                                <option value="Nyamasheke">Nyamasheke</option>
                                <option value="Kayonza">Kayonza</option>
                                <option value="Karongi">Karongi</option>
                                <option value="Bugesera">Bugesera</option>
                                <option value="Nyanza">Nyanza</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 tracking-wide">IJAMBOBANGA</label>
                            <input id="signup-pass" type="password" placeholder="••••••••" class="w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm">
                        </div>
                    </div>
                    <button type="submit" class="w-full py-3.5 mt-1 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.985] transition font-semibold text-sm text-white">Iyandikishe</button>
                    <div class="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                        Usanzwe ufite konti?
                        <span onclick="switchAuthTab('login')" class="text-blue-700 dark:text-blue-400 cursor-pointer font-semibold hover:underline">Injira</span>
                    </div>
                </form>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    function ensureAuthModal() {
        if (!document.getElementById('auth-modal')) createAuthModal();
    }

    function switchAuthTab(tab) {
        const loginF = document.getElementById('login-form');
        const signupF = document.getElementById('signup-form');
        const tLogin = document.getElementById('tab-login');
        const tSignup = document.getElementById('tab-signup');
        if (!loginF || !signupF) return;
        if (tab === 'login') {
            loginF.classList.remove('hidden'); signupF.classList.add('hidden');
            tLogin && tLogin.classList.add('border-b-2', 'border-blue-700', 'text-blue-700', 'dark:text-blue-400');
            tLogin && tLogin.classList.remove('text-slate-500');
            tSignup && tSignup.classList.remove('border-b-2', 'border-blue-700', 'text-blue-700', 'dark:text-blue-400');
            tSignup && tSignup.classList.add('text-slate-500');
        } else {
            loginF.classList.add('hidden'); signupF.classList.remove('hidden');
            tSignup && tSignup.classList.add('border-b-2', 'border-blue-700', 'text-blue-700', 'dark:text-blue-400');
            tSignup && tSignup.classList.remove('text-slate-500');
            tLogin && tLogin.classList.remove('border-b-2', 'border-blue-700', 'text-blue-700', 'dark:text-blue-400');
            tLogin && tLogin.classList.add('text-slate-500');
        }
    }

    function openAuthModal(mode = 'login') {
        ensureAuthModal();
        const modal = document.getElementById('auth-modal');
        if (!modal) return;
        modal.classList.remove('hidden'); modal.classList.add('flex');
        attachHandlers();
        switchAuthTab(mode);
        setTimeout(() => {
            const input = (mode === 'login')
                ? document.getElementById('login-phone')
                : document.getElementById('signup-name');
            if (input) input.focus();
        }, 80);
    }

    function closeAuthModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) { modal.classList.remove('flex'); modal.classList.add('hidden'); }
    }

    // ========== SIGNUP ==========
    async function handleSignup(e) {
        if (e) e.preventDefault();
        const name = (document.getElementById('signup-name')?.value || '').trim();
        const phone = (document.getElementById('signup-phone')?.value || '').trim();
        const district = (document.getElementById('signup-district')?.value || 'Kigali').trim();
        const password = (document.getElementById('signup-pass')?.value || '').trim();

        if (!name || !phone || !password) {
            showToast('Nyamuneka uzuza amazina, nimero, n\'ijambobanga', 'error');
            return;
        }
        showLoading('Kwiyandikisha...');
        try {
            const data = await apiPost('/api/auth/signup', { name, phone, district, password });
            saveSession(data.user);
            showToast('Kwiyandikisha byagenze neza!', 'success');
            if (window.location.pathname.includes('signup.html')) {
                setTimeout(() => { window.location.replace('index.html'); }, 400);
                return;
            }
            setTimeout(() => {
                document.getElementById('login-form')?.classList.remove('hidden');
                document.getElementById('signup-form')?.classList.add('hidden');
                const lp = document.getElementById('login-phone');
                if (lp) lp.value = phone;
            }, 1200);
        } catch (err) {
            showToast('Byanze: ' + err.message, 'error');
        } finally {
            hideLoading();
        }
    }

    // ========== LOGIN ==========
    async function handleLogin(e) {
        if (e) e.preventDefault();
        const phone = (document.getElementById('login-phone')?.value || '').trim();
        const password = (document.getElementById('login-pass')?.value || '').trim();

        if (!phone || !password) {
            showToast('Uzuza nimero n\'ijambobanga', 'error');
            return;
        }
        showLoading('Injira...');
        try {
            const data = await apiPost('/api/auth/login', { phone, password });
            saveSession(data.user);
            showToast(`Murakaza neza ${data.user.name.split(' ')[0]}!`, 'success');

            if (window.location.pathname.includes('login.html')) {
                setTimeout(() => { window.location.replace('index.html'); }, 400);
                return;
            }
            const modal = document.getElementById('auth-modal');
            if (modal) { modal.classList.remove('flex'); modal.classList.add('hidden'); }
            if (window.RoadRulesAuth?.updateAuthUI) window.RoadRulesAuth.updateAuthUI();
            setTimeout(() => { location.reload(); }, 650);
        } catch (err) {
            showToast('Byanze: ' + err.message, 'error');
        } finally {
            hideLoading();
        }
    }

    // ========== ATTACH HANDLERS ==========
    function attachHandlers() {
        window.handleLogin = handleLogin;
        window.handleSignup = handleSignup;
        window.openAuthModal = openAuthModal;
        window.closeAuthModal = closeAuthModal;
        window.switchAuthTab = switchAuthTab;

        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        if (loginForm) { loginForm.removeEventListener('submit', handleLogin); loginForm.addEventListener('submit', handleLogin); }
        if (signupForm) { signupForm.removeEventListener('submit', handleSignup); signupForm.addEventListener('submit', handleSignup); }
    }

    // ========== INIT ==========
    function initSupabaseAuth() {
        const path = (window.location.pathname || '').replace(/\\/g, '/');
        const isStandaloneAuth = path.includes('login.html') || path.includes('signup.html');
        if (!isStandaloneAuth) ensureAuthModal();
        attachHandlers();

        if (!window.RoadRulesAuth) window.RoadRulesAuth = {};

        window.RoadRulesAuth.getCurrentPlan = function () {
            const user = getSession();
            return user?.subscription || { plan: 'ubuntu', planName: 'Ubuntu Free', amount: 0, status: 'approved' };
        };

        window.RoadRulesAuth.updateAuthUI = function () {
            const user = getSession();
            const desktop = document.getElementById('desktop-auth-area');
            const mobile = document.getElementById('mobile-auth-area');
            if (!user) return;
            const short = user.name.split(' ').slice(0, 2).join(' ');
            if (desktop) {
                desktop.classList.remove('hidden', 'sm:flex');
                desktop.classList.add('flex', 'items-center');
                desktop.innerHTML = `
                    <div class="relative" style="line-height:0">
                      <button onclick="window.openKontePanel && window.openKontePanel()"
                              class="profile-icon-btn flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-blue-800 text-white shadow ring-1 ring-blue-900/40 hover:brightness-105 active:scale-[0.96] transition"
                              title="Konte • ${short}">
                        <i class="fa-solid fa-user text-[17px]"></i>
                      </button>
                    </div>`;
                setTimeout(() => window.RoadRulesAuth?.updateProfileBadge?.(), 350);
            }
            if (mobile) {
                mobile.innerHTML = `<div class="text-center text-sm py-1"><button onclick="window.openKontePanel&&window.openKontePanel(); if(typeof toggleMobileMenu==='function')toggleMobileMenu()" class="px-3 py-1 text-xs rounded-2xl border border-slate-300 dark:border-slate-600">Bona Konte</button> <span onclick="window.logoutKonte&&window.logoutKonte()" class="text-red-600 cursor-pointer text-xs ml-2">Gusohoka</span></div>`;
            }
        };

        // ========== SEEN ANNOUNCEMENTS (Supabase-backed, localStorage cache) ==========
        function getCurrentUserPhone() {
            try { return getSession()?.phone || null; } catch { return null; }
        }

        const ANN_SEEN_CACHE_KEY = 'roadRulesSeenAnnsCache_v2';

        function getSeenAnnouncementIds() {
            const phone = getCurrentUserPhone();
            if (!phone) return [];
            try {
                const raw = localStorage.getItem(ANN_SEEN_CACHE_KEY);
                if (raw) {
                    const cache = JSON.parse(raw);
                    if (cache[phone]) return cache[phone];
                }
            } catch {}
            return [];
        }

        function markAllAnnouncementsSeen(annIds) {
            const phone = getCurrentUserPhone();
            if (!phone || !annIds) return;
            // Update local cache immediately
            try {
                const raw = localStorage.getItem(ANN_SEEN_CACHE_KEY);
                const cache = raw ? JSON.parse(raw) : {};
                cache[phone] = annIds;
                localStorage.setItem(ANN_SEEN_CACHE_KEY, JSON.stringify(cache));
            } catch {}
            // Sync to server in background
            fetch(`/api/users/${encodeURIComponent(phone)}/seen-announcements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: annIds })
            }).catch(() => {});
            // Clear badge
            document.querySelectorAll('.profile-icon-btn').forEach(btn => {
                btn.parentElement.querySelector('.ann-badge')?.remove();
            });
        }

        async function getUnseenAnnouncementCount() {
            const phone = getCurrentUserPhone();
            if (!phone) return 0;
            const seen = getSeenAnnouncementIds();
            try {
                const all = await (window.RoadRulesAuth?.getAnnouncements?.() || []);
                return all.filter(a => a?.id && !seen.includes(a.id)).length;
            } catch { return 0; }
        }

        window.RoadRulesAuth.updateProfileBadge = async function () {
            const count = await getUnseenAnnouncementCount();
            document.querySelectorAll('.profile-icon-btn').forEach(btn => {
                const wrapper = btn.parentElement;
                let badge = wrapper.querySelector('.ann-badge');
                if (count > 0) {
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'ann-badge absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-extrabold leading-none rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-1 shadow ring-1 ring-white/80 dark:ring-slate-900';
                        wrapper.style.position = 'relative';
                        wrapper.appendChild(badge);
                    }
                    badge.textContent = count > 9 ? '9+' : String(count);
                } else if (badge) { badge.remove(); }
            });
        };

        // ========== ANNOUNCEMENTS (Supabase) ==========
        const ANN_CACHE_KEY = 'roadRulesAmatangazoCache_v2';
        const ANN_MAX_AGE = 5 * 60 * 1000; // 5 minutes

        async function getAnnouncements() {
            try {
                const now = Date.now();
                let cached = null;
                try { const raw = localStorage.getItem(ANN_CACHE_KEY); if (raw) cached = JSON.parse(raw); } catch {}
                if (cached && Array.isArray(cached.list) && (now - (cached.cachedAt || 0) < ANN_MAX_AGE)) {
                    return cached.list;
                }
                const list = await apiGet('/api/announcements');
                try { localStorage.setItem(ANN_CACHE_KEY, JSON.stringify({ list, cachedAt: now })); } catch {}
                return list || [];
            } catch (e) {
                try {
                    const raw = localStorage.getItem(ANN_CACHE_KEY);
                    if (raw) { const c = JSON.parse(raw); if (Array.isArray(c.list)) return c.list; }
                } catch {}
                return [];
            }
        }

        window.RoadRulesAuth.getAnnouncements = getAnnouncements;

        // ========== HELP FAQs (Supabase) ==========
        const HELP_CACHE_KEY = 'roadRulesHelpFaqsCache_v2';
        const HELP_MAX_AGE = 6 * 60 * 60 * 1000; // 6 hours

        async function getHelpFaqs() {
            try {
                const now = Date.now();
                let cached = null;
                try { const raw = localStorage.getItem(HELP_CACHE_KEY); if (raw) cached = JSON.parse(raw); } catch {}
                if (cached && Array.isArray(cached.list) && (now - (cached.cachedAt || 0) < HELP_MAX_AGE)) {
                    return cached.list;
                }
                const list = await apiGet('/api/help-faqs');
                try { localStorage.setItem(HELP_CACHE_KEY, JSON.stringify({ list, cachedAt: now })); } catch {}
                return list || [];
            } catch (e) {
                try {
                    const raw = localStorage.getItem(HELP_CACHE_KEY);
                    if (raw) { const c = JSON.parse(raw); if (Array.isArray(c.list)) return c.list; }
                } catch {}
                return [];
            }
        }

        window.RoadRulesAuth.getHelpFaqs = getHelpFaqs;

        // ========== CHATBOT CONFIG (Supabase) ==========
        const CHAT_CFG_CACHE_KEY = 'roadRulesChatbotCfgCache_v2';
        const CHAT_CFG_MAX_AGE = 30 * 60 * 1000; // 30 minutes

        async function getChatbotConfig() {
            try {
                const now = Date.now();
                let cached = null;
                try { const raw = localStorage.getItem(CHAT_CFG_CACHE_KEY); if (raw) cached = JSON.parse(raw); } catch {}
                if (cached && cached.data && (now - (cached.cachedAt || 0) < CHAT_CFG_MAX_AGE)) {
                    return cached.data;
                }
                const cfg = await apiGet('/api/chatbot-config');
                try { localStorage.setItem(CHAT_CFG_CACHE_KEY, JSON.stringify({ data: cfg, cachedAt: now })); } catch {}
                return cfg || { rugambaProactiveDelayMin: 5 };
            } catch (e) {
                try {
                    const raw = localStorage.getItem(CHAT_CFG_CACHE_KEY);
                    if (raw) { const c = JSON.parse(raw); if (c?.data) return c.data; }
                } catch {}
                return { rugambaProactiveDelayMin: 5 };
            }
        }

        window.RoadRulesAuth.getChatbotConfig = getChatbotConfig;

        // ========== KONTE PANEL ==========
        function createKontePanel() {
            if (document.getElementById('konte-panel')) return document.getElementById('konte-panel');
            const panel = document.createElement('div');
            panel.id = 'konte-panel';
            panel.className = 'hidden fixed inset-0 z-[100]';
            panel.innerHTML = `
                <div class="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onclick="window.closeKontePanel && window.closeKontePanel()"></div>
                <div onclick="event.stopImmediatePropagation()"
                     class="absolute right-0 top-0 bottom-0 w-full max-w-[460px] bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col rounded-l-3xl overflow-hidden">
                    <div class="px-6 py-5 bg-gradient-to-b from-slate-900 to-slate-950 text-white flex items-center justify-between border-b border-white/10">
                        <div class="flex items-center gap-3">
                            <div class="flex h-8 w-8 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20"><i class="fa-solid fa-user text-lg"></i></div>
                            <div>
                                <div class="text-[10px] tracking-[2px] text-white/60 font-medium">perime.rw member</div>
                                <div class="font-semibold text-xl tracking-[-0.6px] -mt-0.5">Konte yawe</div>
                            </div>
                        </div>
                        <button onclick="window.closeKontePanel && window.closeKontePanel()"
                                class="flex h-9 w-9 items-center justify-center rounded-2xl hover:bg-white/10 text-white/70 hover:text-white transition text-2xl leading-none">×</button>
                    </div>
                    <div class="flex-1 overflow-auto px-6 py-6 space-y-7 text-[13.5px]">
                        <div>
                            <div class="uppercase text-[10px] tracking-[1.8px] font-semibold text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-2">
                                <i class="fa-solid fa-id-card"></i> <span>AMAKURU YA KONTI</span>
                            </div>
                            <div class="space-y-3">
                                <div class="flex items-start gap-3 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3.5 shadow-sm">
                                    <div class="mt-0.5 text-blue-600 dark:text-blue-400"><i class="fa-solid fa-user w-4"></i></div>
                                    <div class="flex-1">
                                        <div class="text-[10px] text-slate-500 dark:text-slate-400">Amazina yawe</div>
                                        <div id="konte-name" class="font-semibold text-slate-900 dark:text-white text-[15px]"></div>
                                    </div>
                                </div>
                                <div class="flex items-start gap-3 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3.5 shadow-sm">
                                    <div class="mt-0.5 text-blue-600 dark:text-blue-400"><i class="fa-solid fa-phone w-4"></i></div>
                                    <div class="flex-1">
                                        <div class="text-[10px] text-slate-500 dark:text-slate-400">Numero ya telefoni</div>
                                        <div id="konte-phone" class="font-semibold text-slate-900 dark:text-white tabular-nums"></div>
                                    </div>
                                </div>
                                <div class="grid grid-cols-2 gap-3">
                                    <div class="flex items-start gap-3 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3.5 shadow-sm">
                                        <div class="mt-0.5 text-blue-600 dark:text-blue-400"><i class="fa-solid fa-globe w-4"></i></div>
                                        <div><div class="text-[10px] text-slate-500 dark:text-slate-400">Igihugu</div><div class="font-semibold">Rwanda</div></div>
                                    </div>
                                    <div class="flex items-start gap-3 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3.5 shadow-sm">
                                        <div class="mt-0.5 text-blue-600 dark:text-blue-400"><i class="fa-solid fa-map-marker-alt w-4"></i></div>
                                        <div class="min-w-0"><div class="text-[10px] text-slate-500 dark:text-slate-400">Akarere</div><div id="konte-district" class="font-semibold text-slate-900 dark:text-white"></div></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div class="uppercase text-[10px] tracking-[1.8px] font-semibold text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-2">
                                <i class="fa-solid fa-headset"></i> <span>TWANDIKIRE</span>
                            </div>
                            <div class="flex gap-3">
                                <a href="tel:+250788762976" class="flex-1 group flex items-center justify-center gap-2.5 rounded-3xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-slate-900 py-[13px] text-sm font-medium transition active:scale-[0.985]">
                                    <i class="fa-solid fa-phone text-blue-600 group-hover:scale-110 transition"></i><span>0788 762 976</span>
                                </a>
                                <a href="https://wa.me/250788762976?text=Muraho" target="_blank" class="flex-1 group flex items-center justify-center gap-2.5 rounded-3xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 py-[13px] text-sm font-medium text-emerald-700 dark:text-emerald-400 transition active:scale-[0.985]">
                                    <i class="fa-brands fa-whatsapp text-lg -ml-0.5"></i><span>WhatsApp</span>
                                </a>
                            </div>
                            <div class="text-[10px] text-center text-slate-400 mt-2">Muraho — twandikire igihe cyose</div>
                        </div>
                        <button onclick="window.logoutKonte && window.logoutKonte()"
                                class="w-full flex items-center justify-center gap-2 py-3.5 rounded-3xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold text-sm shadow-lg shadow-red-600/30 active:scale-[0.985] transition">
                            <i class="fa-solid fa-sign-out-alt"></i> <span>GUSOHOKA</span>
                        </button>
                        <div class="pt-2">
                            <div class="flex items-center justify-between mb-3">
                                <div class="uppercase text-[10px] tracking-[1.8px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                                    <i class="fa-solid fa-bullhorn"></i> <span>AMATANGAZO</span>
                                </div>
                                <div class="text-[10px] text-amber-600/70 dark:text-amber-400/70">Kuva ku buyobozi</div>
                            </div>
                            <div id="konte-announcements" class="space-y-3 text-sm max-h-[260px] overflow-auto pr-1 custom-scroll"></div>
                        </div>
                    </div>
                    <div class="px-6 py-4 text-[10px] border-t border-slate-200 dark:border-slate-800 text-slate-400 bg-slate-50 dark:bg-slate-900 text-center">
                        RoadRules • 2026 • Amakuru yawe arinzwe
                    </div>
                </div>`;
            document.body.appendChild(panel);
            return panel;
        }

        window.openKontePanel = async function () {
            const panel = createKontePanel();
            panel.classList.remove('hidden'); panel.classList.add('flex');
            const user = getSession();
            if (user) {
                const n = document.getElementById('konte-name');
                const p = document.getElementById('konte-phone');
                const d = document.getElementById('konte-district');
                if (n) n.textContent = user.name || '—';
                if (p) p.textContent = user.phone || '—';
                if (d) d.textContent = user.district || '—';
            }
            const annList = document.getElementById('konte-announcements');
            if (annList) {
                annList.innerHTML = `<div class="flex items-center gap-2 text-xs py-4 text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i> <span>Kuzana amatangazo...</span></div>`;
                try {
                    const anns = await getAnnouncements();
                    const seen = getSeenAnnouncementIds();
                    if (!anns || !anns.length) {
                        annList.innerHTML = `<div class="text-center py-6 text-xs border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl text-slate-400">Nta matangazo y'umunsi.</div>`;
                    } else {
                        annList.innerHTML = '';
                        anns.forEach(a => {
                            const isNew = a.id && !seen.includes(a.id);
                            const card = document.createElement('div');
                            card.className = `p-4 rounded-3xl border ${isNew ? 'border-amber-400 bg-amber-50/70 dark:bg-amber-950/40 ring-1 ring-amber-400/40' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'} shadow-sm`;
                            card.innerHTML = `
                                <div class="flex justify-between items-start">
                                    <div class="font-semibold text-amber-800 dark:text-amber-300 text-[13.5px] flex items-center gap-2">
                                        ${isNew ? '<span class="text-[9px] font-bold px-1.5 py-px rounded bg-amber-500 text-white">NEW</span>' : ''}
                                        ${a.title || 'Amatangazo'}
                                    </div>
                                    ${a.created_at ? `<div class="text-[10px] text-amber-500 tabular-nums">${new Date(a.created_at).toLocaleDateString('rw-RW')}</div>` : ''}
                                </div>
                                <div class="mt-2 text-[13px] leading-snug text-slate-700 dark:text-slate-200 whitespace-pre-wrap">${a.content || ''}</div>`;
                            annList.appendChild(card);
                        });
                        const allIds = anns.map(x => x.id).filter(Boolean);
                        markAllAnnouncementsSeen(allIds);
                        window.RoadRulesAuth?.updateProfileBadge?.();
                    }
                } catch (e) {
                    annList.innerHTML = '<div class="text-xs text-red-500 py-4">Ntibishoboye kuzana amatangazo.</div>';
                }
            }
        };

        window.closeKontePanel = function () {
            const p = document.getElementById('konte-panel');
            if (p) { p.classList.remove('flex'); p.classList.add('hidden'); }
        };

        window.logoutKonte = function () {
            clearSession();
            if (window.closeKontePanel) window.closeKontePanel();
            setTimeout(() => location.reload(), 80);
        };

        // ========== ADMIN NAMESPACE (Supabase-backed) ==========
        window.RoadRulesAdmin = window.RoadRulesAdmin || {};

        window.RoadRulesAdmin.listAllUserFiles = async function () {
            showLoading('Kuzana abakoresha...');
            try {
                const users = await apiGet('/api/admin/users');
                hideLoading();
                return users;
            } catch (e) { hideLoading(); return []; }
        };

        window.RoadRulesAdmin.getUserData = async function (phone) {
            showLoading('Kuzana amakuru...');
            try {
                const data = await apiGet(`/api/admin/users/${encodeURIComponent(phone)}`);
                hideLoading();
                return data;
            } catch (e) { hideLoading(); return null; }
        };

        window.RoadRulesAdmin.getUserDataSilent = async function (phone) {
            try {
                const data = await apiGet(`/api/admin/users/${encodeURIComponent(phone)}`);
                return data;
            } catch (e) { return null; }
        };

        window.RoadRulesAdmin.readUserFileById = window.RoadRulesAdmin.getUserData;
        window.RoadRulesAdmin.readUserFileByIdSilent = window.RoadRulesAdmin.getUserDataSilent;

        window.RoadRulesAdmin.updateUserData = async function (phone, updates) {
            showLoading('Kubona ifatabuguzi...');
            try {
                if (updates.pendingUpgrade !== undefined) {
                    await apiPatch(`/api/users/${encodeURIComponent(phone)}/pending-upgrade`, {
                        pendingUpgrade: updates.pendingUpgrade || null
                    });
                }
                hideLoading();
                return true;
            } catch (e) { hideLoading(); return false; }
        };

        window.RoadRulesAdmin.approveUserPlan = async function (phone) {
            showLoading('Kubona ifatabuguzi...');
            try {
                await apiPatch(`/api/admin/users/${encodeURIComponent(phone)}/approve`, {});
                hideLoading();
                return true;
            } catch (e) { hideLoading(); return false; }
        };

        window.RoadRulesAdmin.dismissUserPlan = async function (phone) {
            showLoading('Kubona ifatabuguzi...');
            try {
                await apiPatch(`/api/admin/users/${encodeURIComponent(phone)}/dismiss`, {});
                hideLoading();
                return true;
            } catch (e) { hideLoading(); return false; }
        };

        window.RoadRulesAdmin.deleteUser = async function (phone) {
            try {
                await apiDelete(`/api/admin/users/${encodeURIComponent(phone)}`);
                return true;
            } catch (e) { throw e; }
        };

        window.RoadRulesAdmin.getCurrentPlan = function () {
            const user = getSession();
            return user?.subscription?.plan || 'ubuntu';
        };

        window.RoadRulesAdmin.getPendingUpgrade = function () {
            const user = getSession();
            return (user?.pendingUpgrade?.status === 'pending') ? user.pendingUpgrade : null;
        };

        // Announcements admin
        window.RoadRulesAdmin.postAnnouncement = async function (title, content) {
            showLoading('Kohereza amatangazo...');
            try {
                await apiPost('/api/announcements', { title, content });
                try { localStorage.removeItem(ANN_CACHE_KEY); } catch {}
                hideLoading();
                return true;
            } catch (e) { hideLoading(); throw e; }
        };

        window.RoadRulesAdmin.editAnnouncement = async function (id, title, content) {
            showLoading('Kubona amatangazo...');
            try {
                const updates = {};
                if (title != null) updates.title = title;
                if (content != null) updates.content = content;
                await apiPatch(`/api/announcements/${id}`, updates);
                try { localStorage.removeItem(ANN_CACHE_KEY); } catch {}
                hideLoading();
            } catch (e) { hideLoading(); throw e; }
        };

        window.RoadRulesAdmin.deleteAnnouncement = async function (id) {
            showLoading('Kubona amatangazo...');
            try {
                await apiDelete(`/api/announcements/${id}`);
                try { localStorage.removeItem(ANN_CACHE_KEY); } catch {}
                hideLoading();
            } catch (e) { hideLoading(); throw e; }
        };

        // Help FAQ admin
        window.RoadRulesAdmin.postHelpFaq = async function (question, answers) {
            showLoading('Kohereza ikibazo cya chatbot...');
            let ansArr = Array.isArray(answers) ? answers.filter(Boolean) : [String(answers || '')];
            try {
                await apiPost('/api/help-faqs', { question, answers: ansArr });
                try { localStorage.removeItem(HELP_CACHE_KEY); } catch {}
                hideLoading();
                return true;
            } catch (e) { hideLoading(); throw e; }
        };

        window.RoadRulesAdmin.editHelpFaq = async function (id, question, answers) {
            showLoading('Kubona ibibazo bya chatbot...');
            const updates = {};
            if (question != null) updates.question = question;
            if (answers != null) updates.answers = Array.isArray(answers) ? answers : [String(answers)];
            try {
                await apiPatch(`/api/help-faqs/${id}`, updates);
                try { localStorage.removeItem(HELP_CACHE_KEY); } catch {}
                hideLoading();
            } catch (e) { hideLoading(); throw e; }
        };

        window.RoadRulesAdmin.deleteHelpFaq = async function (id) {
            showLoading('Kubona ibibazo bya chatbot...');
            try {
                await apiDelete(`/api/help-faqs/${id}`);
                try { localStorage.removeItem(HELP_CACHE_KEY); } catch {}
                hideLoading();
            } catch (e) { hideLoading(); throw e; }
        };

        // Chatbot config admin
        window.RoadRulesAdmin.updateChatbotConfig = async function (partial) {
            showLoading('Saving chatbot settings...');
            try {
                await apiPatch('/api/chatbot-config', partial);
                try { localStorage.removeItem(CHAT_CFG_CACHE_KEY); } catch {}
                hideLoading();
                return true;
            } catch (e) { hideLoading(); throw e; }
        };

        // ========== ACCESS CONTROL ==========
        const PLAN_LIMITS = {
            ubuntu:   { maxExams: 1,   cooldownMs: 0,             singleAttempt: true },
            inshuro2: { maxExams: 2,   cooldownMs: 0,             singleAttempt: false },
            inshuro5: { maxExams: 5,   cooldownMs: 0,             singleAttempt: false },
            ukwezi:   { maxExams: 999, cooldownMs: 2 * 60 * 1000, singleAttempt: false }
        };

        function getCurrentPlan() {
            try {
                const user = getSession();
                const sub = user?.subscription;
                if (sub?.status === 'approved' && sub?.plan) {
                    const p = sub.plan;
                    if (PLAN_LIMITS[p]) return p;
                    if (p === 'inshuro5' || p === 'icyumweru') return 'inshuro5';
                    if (p === 'ukwezi') return 'ukwezi';
                    if (p === 'inshuro2' || p === 'inshuro ebyiri') return 'inshuro2';
                }
            } catch {}
            return 'ubuntu';
        }

        function getPendingUpgrade() {
            try {
                const user = getSession();
                return (user?.pendingUpgrade?.status === 'pending') ? user.pendingUpgrade : null;
            } catch { return null; }
        }

        function getPlanInfo() {
            const p = getCurrentPlan();
            return { plan: p, ...PLAN_LIMITS[p] };
        }

        function getMaxExamsAllowed() {
            return (PLAN_LIMITS[getCurrentPlan()] || PLAN_LIMITS.ubuntu).maxExams;
        }

        function isSingleAttemptPlan() {
            return !!(PLAN_LIMITS[getCurrentPlan()] || PLAN_LIMITS.ubuntu).singleAttempt;
        }

        // Exam cooldown — still stored in localStorage (per-device, fast, no need to roundtrip)
        function getLastExamCompletedAt() {
            try {
                const user = getSession();
                const key = `roadRulesLastExamAt_${user?.phone || 'guest'}`;
                const v = localStorage.getItem(key);
                return v ? parseInt(v, 10) : 0;
            } catch { return 0; }
        }

        function setLastExamCompletedAt(ts = Date.now()) {
            try {
                const user = getSession();
                const key = `roadRulesLastExamAt_${user?.phone || 'guest'}`;
                localStorage.setItem(key, String(ts));
            } catch {}
        }

        function getCooldownRemainingMs() {
            const info = getPlanInfo();
            if (info.cooldownMs === 0) return 0;
            const last = getLastExamCompletedAt();
            if (!last) return 0;
            return Math.max(0, info.cooldownMs - (Date.now() - last));
        }

        function canStartExamNow() { return getCooldownRemainingMs() === 0; }

        function getCompletedExamCount() {
            try {
                const user = getSession();
                const key = `roadRulesExamHistory_${user?.phone || 'guest'}`;
                const arr = JSON.parse(localStorage.getItem(key) || '[]');
                return Array.isArray(arr) ? arr.length : 0;
            } catch { return 0; }
        }

        function canStartMoreExams() {
            const max = getMaxExamsAllowed();
            if (max >= 999) return true;
            return getCompletedExamCount() < max;
        }

        window.RoadRulesAccess = {
            getCurrentPlan, getPlanInfo, getMaxExamsAllowed, isSingleAttemptPlan,
            getLastExamCompletedAt, setLastExamCompletedAt, getCooldownRemainingMs,
            canStartExamNow, getCompletedExamCount, canStartMoreExams,
            getPendingUpgrade, PLAN_LIMITS
        };

        window.RoadRulesAdmin.getCurrentPlan = getCurrentPlan;
        window.RoadRulesAdmin.getPendingUpgrade = getPendingUpgrade;

        // ========== REFRESH MY DATA (plan sync) ==========
        window.RoadRulesAuth.refreshMyData = async function () {
            try {
                const user = getSession();
                if (!user?.phone) return null;
                const fresh = await apiPost('/api/auth/refresh', { phone: user.phone });
                if (!fresh?.user) return null;
                const local = getSession() || {};
                if (fresh.user.subscription) local.subscription = fresh.user.subscription;
                if (fresh.user.pendingUpgrade) local.pendingUpgrade = fresh.user.pendingUpgrade;
                else delete local.pendingUpgrade;
                saveSession(local);
                return local;
            } catch (e) {
                console.warn('refreshMyData failed', e);
                return null;
            }
        };

        // ========== PAYMENT PENDING UPGRADE (user side) ==========
        window.RoadRulesAuth.setPendingUpgrade = async function (phone, upgradeData) {
            try {
                await apiPatch(`/api/users/${encodeURIComponent(phone)}/pending-upgrade`, {
                    pendingUpgrade: upgradeData
                });
                // Update local session
                const local = getSession();
                if (local) {
                    local.pendingUpgrade = upgradeData;
                    saveSession(local);
                }
                return true;
            } catch (e) {
                console.error('setPendingUpgrade failed', e);
                return false;
            }
        };

        // ========== EXAM HISTORY (Supabase + localStorage mirror) ==========
        window.RoadRulesAuth.saveExam = async function (examResult) {
            const user = getSession();
            if (!user?.phone) return;
            // Save to localStorage mirror (used by plan limit checks)
            try {
                const key = `roadRulesExamHistory_${user.phone}`;
                const arr = JSON.parse(localStorage.getItem(key) || '[]');
                arr.unshift({ ...examResult, date: new Date().toISOString() });
                localStorage.setItem(key, JSON.stringify(arr.slice(0, 100)));
            } catch {}
            // Save to Supabase in background
            fetch('/api/exams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: user.phone,
                    score: examResult.score,
                    total: examResult.total || 20,
                    timeTaken: examResult.timeTaken || 0
                })
            }).catch(() => {});
        };

        // Restore header UI if already logged in
        const saved = getSession();
        if (saved) {
            setTimeout(() => {
                if (window.RoadRulesAuth.updateAuthUI) window.RoadRulesAuth.updateAuthUI();
            }, 300);
        }

        console.log('%c[RoadRules] Supabase backend active. Google Drive removed.', 'color:#10b981');
        console.log('%c[RoadRules Admin] Direct Supabase control enabled. Use window.RoadRulesAdmin.*', 'color:#f59e0b');
    }

    // ========== BOOT ==========
    window.RoadRulesAdmin = window.RoadRulesAdmin || {};

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSupabaseAuth);
    } else {
        initSupabaseAuth();
    }

})();
