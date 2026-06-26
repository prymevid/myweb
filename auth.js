// RoadRules Auth — Direct Supabase (static-site mode)
// No Express server needed. Calls Supabase REST API + RPCs directly from the browser.
// Safe: only the anon key is embedded (designed to be public; RLS + SECURITY DEFINER RPCs enforce security).

(function () {
    const SUPABASE_URL  = 'https://zplzsgsyzxjpvewtjygd.supabase.co';
    const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwbHpzZ3N5enhqcHZld3RqeWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NTYyMTEsImV4cCI6MjA5NjUzMjIxMX0.WCpHnVfqmguQcD3AI_ryqx-njCqXIKoS3fz3sNCjkfE';

    const REST  = `${SUPABASE_URL}/rest/v1`;
    const RPC   = `${SUPABASE_URL}/rest/v1/rpc`;
    const HDR   = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' };
    const HDR_R = { ...HDR, Prefer: 'return=representation' };

    // ========== LOW-LEVEL HELPERS ==========
    async function sbGet(path, query) {
        const url = `${REST}/${path}${query ? '?' + query : ''}`;
        const res = await fetch(url, { headers: HDR });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data && (data.message || data.error)) || `HTTP ${res.status}`);
        return data;
    }
    async function sbRpc(fn, body) {
        const res = await fetch(`${RPC}/${fn}`, { method: 'POST', headers: HDR_R, body: JSON.stringify(body) });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            const msg = (data && (data.message || data.hint || data.error)) || `HTTP ${res.status}`;
            throw new Error(msg);
        }
        return data;
    }

    // ========== SESSION ==========
    function getSession() { try { return JSON.parse(localStorage.getItem('roadRulesUser') || 'null'); } catch { return null; } }
    function saveSession(u) { try { localStorage.setItem('roadRulesUser', JSON.stringify(u)); } catch {} }
    function clearSession() { try { localStorage.removeItem('roadRulesUser'); } catch {} }

    // ========== TOAST ==========
    function showToast(msg, type = 'success') {
        const el = document.createElement('div');
        el.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-[95] px-5 py-3 rounded-3xl shadow-xl text-white text-sm flex items-center gap-2 ${type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`;
        el.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i> <span>${msg}</span>`;
        document.body.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .2s'; setTimeout(() => el.remove(), 220); }, 2800);
    }

    // ========== LOADER ==========
    let _loadCount = 0, _loader = null, _loaderSub = null;
    function _ensureLoader() {
        if (_loader) return;
        _loader = document.createElement('div');
        _loader.id = 'roadrules-global-loader';
        _loader.className = 'fixed inset-0 z-[9999] hidden items-center justify-center select-none';
        _loader.innerHTML = `
          <style>
            .rr-loader-overlay {
              position: fixed;
              inset: 0;
              z-index: 1000;
              background: rgba(10, 10, 20, 0.12);
              backdrop-filter: blur(3px);
              -webkit-backdrop-filter: blur(3px);
              display: flex;
              align-items: center;
              justify-content: center;
              flex-direction: column;
              gap: 32px;
              pointer-events: auto;
              animation: rrFadeInOverlay 0.45s ease-out;
            }
            @keyframes rrFadeInOverlay {
              from { opacity: 0; backdrop-filter: blur(0px); }
              to { opacity: 1; backdrop-filter: blur(3px); }
            }
            .rr-wrapper {
              position: relative;
              width: 180px;
              height: 180px;
              background-color: transparent;
              border: none;
              -webkit-user-select: none;
              user-select: none;
            }
            .rr-wrapper .rr-box-wrap {
              width: 70%;
              height: 70%;
              margin: calc((100% - 70%) / 2) calc((100% - 70%) / 2);
              position: relative;
              transform: rotate(-45deg);
            }
            .rr-wrapper .rr-box-wrap .rr-box {
              width: 100%;
              height: 100%;
              position: absolute;
              left: 0;
              top: 0;
              background: linear-gradient(to right, #141562, #486fbc, #eab5a1, #8dd6ff, #4973c9, #d07ca7, #f4915e, #f5919e, #b46f89, #141562, #486fbc);
              background-position: 0% 50%;
              background-size: 1000% 1000%;
              visibility: hidden;
              border-radius: 3px;
            }
            .rr-spinner-ring {
              position: absolute;
              inset: -10px;
              border-radius: 50%;
              border: 2px solid transparent;
              border-top-color: rgba(255, 255, 255, 0.6);
              border-right-color: rgba(255, 255, 255, 0.3);
              border-bottom-color: rgba(255, 255, 255, 0.1);
              border-left-color: rgba(255, 255, 255, 0.3);
              animation: rrSpinRing 1.6s linear infinite;
              pointer-events: none;
              filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.15));
            }
            .rr-glow-ring {
              position: absolute;
              inset: -18px;
              border-radius: 50%;
              border: 1.5px solid transparent;
              border-top-color: rgba(255, 255, 255, 0.12);
              border-right-color: rgba(255, 255, 255, 0.06);
              animation: rrSpinRing 3.2s linear infinite reverse;
              pointer-events: none;
            }
            @keyframes rrSpinRing { to { transform: rotate(360deg); } }
            .rr-loading-text {
              font-size: 15px;
              font-weight: 500;
              letter-spacing: 5px;
              text-transform: uppercase;
              color: rgba(255, 255, 255, 0.75);
              text-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
              animation: rrSoftPulse 2.2s ease-in-out infinite;
              z-index: 10;
            }
            @keyframes rrSoftPulse {
              0%, 100% { opacity: 0.5; letter-spacing: 5px; }
              50% { opacity: 0.95; letter-spacing: 6px; }
            }
            .rr-box.one { animation: rrMoveGradient 15s infinite, rrOneMove 3.5s infinite; }
            .rr-box.two { animation: rrMoveGradient 15s infinite, rrTwoMove 3.5s 0.15s infinite; }
            .rr-box.three { animation: rrMoveGradient 15s infinite, rrThreeMove 3.5s 0.3s infinite; }
            .rr-box.four { animation: rrMoveGradient 15s infinite, rrFourMove 3.5s 0.575s infinite; }
            .rr-box.five { animation: rrMoveGradient 15s infinite, rrFiveMove 3.5s 0.725s infinite; }
            .rr-box.six { animation: rrMoveGradient 15s infinite, rrSixMove 3.5s 0.875s infinite; }
            @keyframes rrMoveGradient { to { background-position: 100% 50%; } }
            @keyframes rrOneMove {
              0% { visibility: visible; clip-path: inset(0% 35% 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
              14.2857% { clip-path: inset(0% 35% 70% round 5%); }
              28.5714% { clip-path: inset(35% round 5%); }
              42.8571% { clip-path: inset(35% 70% 35% 0 round 5%); }
              57.1428% { clip-path: inset(35% 70% 35% 0 round 5%); }
              71.4285% { clip-path: inset(0% 70% 70% 0 round 5%); }
              85.7142% { clip-path: inset(0% 70% 70% 0 round 5%); }
              100% { clip-path: inset(0% 35% 70% round 5%); }
            }
            @keyframes rrTwoMove {
              0% { visibility: visible; clip-path: inset(0% 70% 70% 0 round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
              14.2857% { clip-path: inset(0% 70% 70% 0 round 5%); }
              28.5714% { clip-path: inset(0% 35% 70% round 5%); }
              42.8571% { clip-path: inset(0% 35% 70% round 5%); }
              57.1428% { clip-path: inset(35% round 5%); }
              71.4285% { clip-path: inset(35% 70% 35% 0 round 5%); }
              85.7142% { clip-path: inset(35% 70% 35% 0 round 5%); }
              100% { clip-path: inset(0% 70% 70% 0 round 5%); }
            }
            @keyframes rrThreeMove {
              0% { visibility: visible; clip-path: inset(35% 70% 35% 0 round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
              14.2857% { clip-path: inset(35% 70% 35% 0 round 5%); }
              28.5714% { clip-path: inset(0% 70% 70% 0 round 5%); }
              42.8571% { clip-path: inset(0% 70% 70% 0 round 5%); }
              57.1428% { clip-path: inset(0% 35% 70% round 5%); }
              71.4285% { clip-path: inset(0% 35% 70% round 5%); }
              85.7142% { clip-path: inset(35% round 5%); }
              100% { clip-path: inset(35% 70% 35% 0 round 5%); }
            }
            @keyframes rrFourMove {
              0% { visibility: visible; clip-path: inset(35% 0% 35% 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
              14.2857% { clip-path: inset(35% 0% 35% 70% round 5%); }
              28.5714% { clip-path: inset(35% round 5%); }
              42.8571% { clip-path: inset(70% 35% 0% 35% round 5%); }
              57.1428% { clip-path: inset(70% 35% 0% 35% round 5%); }
              71.4285% { clip-path: inset(70% 0 0 70% round 5%); }
              85.7142% { clip-path: inset(70% 0 0 70% round 5%); }
              100% { clip-path: inset(35% 0% 35% 70% round 5%); }
            }
            @keyframes rrFiveMove {
              0% { visibility: visible; clip-path: inset(70% 0 0 70% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
              14.2857% { clip-path: inset(70% 0 0 70% round 5%); }
              28.5714% { clip-path: inset(35% 0% 35% 70% round 5%); }
              42.8571% { clip-path: inset(35% 0% 35% 70% round 5%); }
              57.1428% { clip-path: inset(35% round 5%); }
              71.4285% { clip-path: inset(70% 35% 0% 35% round 5%); }
              85.7142% { clip-path: inset(70% 35% 0% 35% round 5%); }
              100% { clip-path: inset(70% 0 0 70% round 5%); }
            }
            @keyframes rrSixMove {
              0% { visibility: visible; clip-path: inset(70% 35% 0% 35% round 5%); animation-timing-function: cubic-bezier(0.86, 0, 0.07, 1); }
              14.2857% { clip-path: inset(70% 35% 0% 35% round 5%); }
              28.5714% { clip-path: inset(70% 0 0 70% round 5%); }
              42.8571% { clip-path: inset(70% 0 0 70% round 5%); }
              57.1428% { clip-path: inset(35% 0% 35% 70% round 5%); }
              71.4285% { clip-path: inset(35% 0% 35% 70% round 5%); }
              85.7142% { clip-path: inset(35% round 5%); }
              100% { clip-path: inset(70% 35% 0% 35% round 5%); }
            }
            @media (max-width: 500px) {
              .rr-wrapper { width: 140px; height: 140px; }
              .rr-loading-text { font-size: 12px; letter-spacing: 3px; }
            }
          </style>
          <div class="rr-loader-overlay">
            <div class="rr-wrapper">
              <div class="rr-spinner-ring"></div>
              <div class="rr-glow-ring"></div>
              <div class="rr-box-wrap">
                <div class="rr-box one"></div>
                <div class="rr-box two"></div>
                <div class="rr-box three"></div>
                <div class="rr-box four"></div>
                <div class="rr-box five"></div>
                <div class="rr-box six"></div>
              </div>
            </div>
            <div class="rr-loading-text">Tegereza gato</div>
          </div>
        `;
        document.body.appendChild(_loader);
        _loaderSub = _loader.querySelector('#rr-loader-sub');
    }
    function showLoading(sub) {
        _ensureLoader(); _loadCount++;
        if (_loaderSub) _loaderSub.textContent = sub || '';
        _loader.style.display = 'flex'; _loader.classList.remove('hidden'); _loader.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }
    function hideLoading() {
        if (!_loader) return;
        _loadCount = Math.max(0, _loadCount - 1);
        if (_loadCount === 0) { _loader.style.display = 'none'; _loader.classList.add('hidden'); _loader.classList.remove('flex'); document.body.style.overflow = ''; }
    }
    window.RoadRulesLoader = { show: showLoading, hide: hideLoading, forceHide: () => { _loadCount = 0; hideLoading(); } };

    // ========== AUTH MODAL ==========
    function createAuthModal() {
        if (document.getElementById('auth-modal')) return;
        document.body.insertAdjacentHTML('beforeend', `
        <div id="auth-modal" class="hidden fixed inset-0 z-[90] items-center justify-center bg-black/60 p-4">
          <div onclick="event.target.id==='auth-modal'&&closeAuthModal()" class="absolute inset-0"></div>
          <div class="relative w-full max-w-[380px] rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <div class="flex items-center gap-x-3">
                <div class="h-8 w-8 rounded-2xl bg-gradient-to-br from-blue-700 to-blue-800 flex items-center justify-center text-white"><i class="fa-solid fa-road"></i></div>
                <span class="font-semibold text-lg tracking-tight">RoadRules</span>
              </div>
              <button onclick="closeAuthModal()" class="text-slate-400 hover:text-slate-600 text-3xl leading-none px-1 -mt-1">&times;</button>
            </div>
            <div class="flex border-b border-slate-200 dark:border-slate-700 text-sm font-semibold">
              <button id="tab-login" onclick="switchAuthTab('login')" class="flex-1 py-3.5 border-b-2 border-blue-700 text-blue-700">Injira</button>
              <button id="tab-signup" onclick="switchAuthTab('signup')" class="flex-1 py-3.5 text-slate-500">Iyandikishe</button>
            </div>
            <form id="login-form" class="p-6 space-y-4">
              <div><label class="block text-[11px] font-medium text-slate-500 mb-1.5 tracking-wide">NIMERO YA TELEFONE</label><input id="login-phone" type="tel" placeholder="0788 123 456" class="w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm"></div>
              <div><label class="block text-[11px] font-medium text-slate-500 mb-1.5 tracking-wide">IJAMBOBANGA</label><input id="login-pass" type="password" placeholder="••••••••" class="w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm"></div>
              <button type="submit" class="w-full py-3.5 mt-1 rounded-2xl bg-blue-700 hover:bg-blue-800 font-semibold text-sm text-white">Injira</button>
              <div class="pt-2 text-center text-xs text-slate-500">Ntabwo ufite konti? <span onclick="switchAuthTab('signup')" class="text-blue-700 cursor-pointer font-semibold hover:underline">Iyandikishe</span></div>
            </form>
            <form id="signup-form" class="p-6 space-y-4 hidden">
              <div><label class="block text-[11px] font-medium text-slate-500 mb-1.5 tracking-wide">AMAZINA</label><input id="signup-name" type="text" placeholder="Jean Pierre Habimana" class="w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm"></div>
              <div><label class="block text-[11px] font-medium text-slate-500 mb-1.5 tracking-wide">NIMERO YA TELEFONE</label><input id="signup-phone" type="tel" placeholder="0788 123 456" class="w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm"></div>
              <div><label class="block text-[11px] font-medium text-slate-500 mb-1.5 tracking-wide">AKARERE</label>
                <select id="signup-district" class="w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm">
                  <option>Kigali</option><option>Musanze</option><option>Rubavu</option><option>Huye</option><option>Nyagatare</option><option>Rusizi</option><option>Rwamagana</option><option>Gicumbi</option><option>Muhanga</option><option>Ruhango</option><option>Nyamasheke</option><option>Kayonza</option><option>Karongi</option><option>Bugesera</option><option>Nyanza</option>
                </select>
              </div>
              <div><label class="block text-[11px] font-medium text-slate-500 mb-1.5 tracking-wide">IJAMBOBANGA</label><input id="signup-pass" type="password" placeholder="••••••••" class="w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm"></div>
              <button type="submit" class="w-full py-3.5 mt-1 rounded-2xl bg-emerald-600 hover:bg-emerald-700 font-semibold text-sm text-white">Iyandikishe</button>
              <div class="pt-2 text-center text-xs text-slate-500">Usanzwe ufite konti? <span onclick="switchAuthTab('login')" class="text-blue-700 cursor-pointer font-semibold hover:underline">Injira</span></div>
            </form>
          </div>
        </div>`);
    }

    function switchAuthTab(tab) {
        const lf = document.getElementById('login-form');
        const sf = document.getElementById('signup-form');
        const tl = document.getElementById('tab-login');
        const ts = document.getElementById('tab-signup');
        if (!lf || !sf) return;
        if (tab === 'login') {
            lf.classList.remove('hidden'); sf.classList.add('hidden');
            tl && (tl.className = 'flex-1 py-3.5 border-b-2 border-blue-700 text-blue-700');
            ts && (ts.className = 'flex-1 py-3.5 text-slate-500');
        } else {
            sf.classList.remove('hidden'); lf.classList.add('hidden');
            ts && (ts.className = 'flex-1 py-3.5 border-b-2 border-blue-700 text-blue-700');
            tl && (tl.className = 'flex-1 py-3.5 text-slate-500');
        }
    }

    function openAuthModal(mode = 'login') {
        createAuthModal();
        const m = document.getElementById('auth-modal');
        if (!m) return;
        m.classList.remove('hidden'); m.classList.add('flex');
        _attachHandlers();
        switchAuthTab(mode);
        setTimeout(() => { const el = document.getElementById(mode === 'login' ? 'login-phone' : 'signup-name'); if (el) el.focus(); }, 80);
    }
    function closeAuthModal() {
        const m = document.getElementById('auth-modal');
        if (m) { m.classList.remove('flex'); m.classList.add('hidden'); }
    }

    // ========== SIGNUP ==========
    async function handleSignup(e) {
        if (e) e.preventDefault();
        const name = (document.getElementById('signup-name')?.value || '').trim();
        const phone = (document.getElementById('signup-phone')?.value || '').trim();
        const district = (document.getElementById('signup-district')?.value || 'Kigali').trim();
        const password = (document.getElementById('signup-pass')?.value || '').trim();
        if (!name || !phone || !password) { showToast('Nyamuneka uzuza amazina, nimero, n\'ijambobanga', 'error'); return; }
        showLoading('Kwiyandikisha...');
        try {
            const user = await sbRpc('roadrules_signup', { p_name: name, p_phone: phone, p_district: district, p_password: password });
            saveSession(user);
            showToast('Kwiyandikisha byagenze neza!');
            if (window.location.pathname.includes('signup.html')) {
                setTimeout(() => location.replace('index.html'), 400);
                return;
            }
            switchAuthTab('login');
            const lp = document.getElementById('login-phone'); if (lp) lp.value = phone;
        } catch (err) { showToast('Byanze: ' + err.message, 'error'); }
        finally { hideLoading(); }
    }

    // ========== LOGIN ==========
    async function handleLogin(e) {
        if (e) e.preventDefault();
        const phone = (document.getElementById('login-phone')?.value || '').trim();
        const password = (document.getElementById('login-pass')?.value || '').trim();
        if (!phone || !password) { showToast('Uzuza nimero n\'ijambobanga', 'error'); return; }
        showLoading('Injira...');
        try {
            const user = await sbRpc('roadrules_login', { p_phone: phone, p_password: password });
            saveSession(user);
            showToast(`Murakaza neza ${(user.name || '').split(' ')[0]}!`);
            if (window.location.pathname.includes('login.html')) {
                const ret = sessionStorage.getItem('roadRulesReturnTo');
                const validPages = ['/index.html', '/imyitozo.html', '/ibibazo.html', '/ifitabuguzi.html', 'index.html', 'imyitozo.html', 'ibibazo.html', 'ifitabuguzi.html'];
                let target = ret && validPages.includes(ret) ? ret : 'index.html';
                sessionStorage.removeItem('roadRulesReturnTo');
                setTimeout(() => location.replace(target), 400);
                return;
            }
            closeAuthModal();
            if (window.RoadRulesAuth?.updateAuthUI) window.RoadRulesAuth.updateAuthUI();
            setTimeout(() => location.reload(), 650);
        } catch (err) { showToast('Byanze: ' + err.message, 'error'); }
        finally { hideLoading(); }
    }

    function _attachHandlers() {
        window.handleLogin = handleLogin;
        window.handleSignup = handleSignup;
        window.openAuthModal = openAuthModal;
        window.closeAuthModal = closeAuthModal;
        window.switchAuthTab = switchAuthTab;
        const lf = document.getElementById('login-form');
        const sf = document.getElementById('signup-form');
        if (lf) { lf.removeEventListener('submit', handleLogin); lf.addEventListener('submit', handleLogin); }
        if (sf) { sf.removeEventListener('submit', handleSignup); sf.addEventListener('submit', handleSignup); }
    }

    // ========== KONTE PANEL ==========
    function _createKontePanel() {
        if (document.getElementById('konte-panel')) return document.getElementById('konte-panel');
        const p = document.createElement('div');
        p.id = 'konte-panel';
        p.className = 'hidden fixed inset-0 z-[100]';
        p.innerHTML = `
          <div class="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onclick="window.closeKontePanel&&window.closeKontePanel()"></div>
          <div onclick="event.stopImmediatePropagation()" class="absolute right-0 top-0 bottom-0 w-full max-w-[460px] bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col rounded-l-3xl overflow-hidden">
            <div class="px-6 py-5 bg-gradient-to-b from-slate-900 to-slate-950 text-white flex items-center justify-between border-b border-white/10">
              <div class="flex items-center gap-3">
                <div class="flex h-8 w-8 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20"><i class="fa-solid fa-user text-lg"></i></div>
                <div><div class="text-[10px] tracking-[2px] text-white/60 font-medium">perime.rw member</div><div class="font-semibold text-xl tracking-[-0.6px] -mt-0.5">Konte yawe</div></div>
              </div>
              <button onclick="window.closeKontePanel&&window.closeKontePanel()" class="flex h-9 w-9 items-center justify-center rounded-2xl hover:bg-white/10 text-white/70 text-2xl">×</button>
            </div>
            <div class="flex-1 overflow-auto px-6 py-6 space-y-7 text-[13.5px]">
              <div>
                <div class="uppercase text-[10px] tracking-[1.8px] font-semibold text-slate-500 mb-2.5 flex items-center gap-2"><i class="fa-solid fa-id-card"></i> AMAKURU YA KONTI</div>
                <div class="space-y-3">
                  <div class="flex items-start gap-3 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3.5"><div class="mt-0.5 text-blue-600"><i class="fa-solid fa-user w-4"></i></div><div><div class="text-[10px] text-slate-500">Amazina yawe</div><div id="konte-name" class="font-semibold text-[15px]"></div></div></div>
                  <div class="flex items-start gap-3 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3.5"><div class="mt-0.5 text-blue-600"><i class="fa-solid fa-phone w-4"></i></div><div><div class="text-[10px] text-slate-500">Numero ya telefoni</div><div id="konte-phone" class="font-semibold tabular-nums"></div></div></div>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="flex items-start gap-3 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3.5"><div class="mt-0.5 text-blue-600"><i class="fa-solid fa-globe w-4"></i></div><div><div class="text-[10px] text-slate-500">Igihugu</div><div class="font-semibold">Rwanda</div></div></div>
                    <div class="flex items-start gap-3 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3.5"><div class="mt-0.5 text-blue-600"><i class="fa-solid fa-map-marker-alt w-4"></i></div><div><div class="text-[10px] text-slate-500">Akarere</div><div id="konte-district" class="font-semibold"></div></div></div>
                  </div>
                </div>
              </div>
              <div>
                <div class="uppercase text-[10px] tracking-[1.8px] font-semibold text-slate-500 mb-2.5 flex items-center gap-2"><i class="fa-solid fa-headset"></i> TWANDIKIRE</div>
                <div class="flex gap-3">
                  <a href="tel:+250788762976" class="flex-1 flex items-center justify-center gap-2.5 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-[13px] text-sm font-medium"><i class="fa-solid fa-phone text-blue-600"></i><span>0788 762 976</span></a>
                  <a href="https://wa.me/250788762976?text=Muraho" target="_blank" class="flex-1 flex items-center justify-center gap-2.5 rounded-3xl border border-emerald-200 bg-emerald-50 py-[13px] text-sm font-medium text-emerald-700"><i class="fa-brands fa-whatsapp text-lg"></i><span>WhatsApp</span></a>
                </div>
              </div>
              <button onclick="window.logoutKonte&&window.logoutKonte()" class="w-full flex items-center justify-center gap-2 py-3.5 rounded-3xl bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold text-sm active:scale-[0.985]"><i class="fa-solid fa-sign-out-alt"></i> GUSOHOKA</button>
              <div>
                <div class="flex items-center justify-between mb-3">
                  <div class="uppercase text-[10px] tracking-[1.8px] font-semibold text-amber-700 flex items-center gap-2"><i class="fa-solid fa-bullhorn"></i> AMATANGAZO</div>
                  <div class="text-[10px] text-amber-600/70">Kuva ku buyobozi</div>
                </div>
                <div id="konte-announcements" class="space-y-3 text-sm max-h-[260px] overflow-auto pr-1"></div>
              </div>
            </div>
            <div class="px-6 py-4 text-[10px] border-t border-slate-200 dark:border-slate-800 text-slate-400 bg-slate-50 dark:bg-slate-900 text-center">RoadRules • 2026 • Amakuru yawe arinzwe</div>
          </div>`;
        document.body.appendChild(p);
        return p;
    }

    // ========== SEEN ANNOUNCEMENTS ==========
    const ANN_SEEN_KEY = 'roadRulesSeenAnnsCache_v2';
    function _getPhone() { try { return getSession()?.phone || null; } catch { return null; } }
    function getSeenIds() {
        const ph = _getPhone(); if (!ph) return [];
        try { const c = JSON.parse(localStorage.getItem(ANN_SEEN_KEY) || '{}'); return c[ph] || []; } catch { return []; }
    }
    function markSeen(ids) {
        const ph = _getPhone(); if (!ph || !ids) return;
        try { const c = JSON.parse(localStorage.getItem(ANN_SEEN_KEY) || '{}'); c[ph] = ids; localStorage.setItem(ANN_SEEN_KEY, JSON.stringify(c)); } catch {}
        sbRpc('roadrules_mark_announcements_seen', { p_phone: ph, p_ids: ids }).catch(() => {});
        document.querySelectorAll('.ann-badge').forEach(b => b.remove());
    }

    // ========== ANNOUNCEMENTS ==========
    const ANN_CACHE_KEY  = 'roadRulesAmatangazoCache_v2';
    const ANN_MAX_AGE    = 5 * 60 * 1000;
    async function getAnnouncements() {
        const now = Date.now();
        try {
            const raw = localStorage.getItem(ANN_CACHE_KEY);
            if (raw) { const c = JSON.parse(raw); if (Array.isArray(c.list) && now - (c.cachedAt || 0) < ANN_MAX_AGE) return c.list; }
        } catch {}
        try {
            const list = await sbGet('announcements', 'order=created_at.desc');
            try { localStorage.setItem(ANN_CACHE_KEY, JSON.stringify({ list, cachedAt: now })); } catch {}
            return list || [];
        } catch {
            try { const c = JSON.parse(localStorage.getItem(ANN_CACHE_KEY) || 'null'); if (c?.list) return c.list; } catch {}
            return [];
        }
    }

    // ========== HELP FAQs ==========
    const HELP_CACHE_KEY = 'roadRulesHelpFaqsCache_v2';
    const HELP_MAX_AGE   = 6 * 60 * 60 * 1000;
    async function getHelpFaqs() {
        const now = Date.now();
        try {
            const raw = localStorage.getItem(HELP_CACHE_KEY);
            if (raw) { const c = JSON.parse(raw); if (Array.isArray(c.list) && now - (c.cachedAt || 0) < HELP_MAX_AGE) return c.list; }
        } catch {}
        try {
            const list = await sbGet('help_faqs', 'order=created_at.desc');
            try { localStorage.setItem(HELP_CACHE_KEY, JSON.stringify({ list, cachedAt: now })); } catch {}
            return list || [];
        } catch {
            try { const c = JSON.parse(localStorage.getItem(HELP_CACHE_KEY) || 'null'); if (c?.list) return c.list; } catch {}
            return [];
        }
    }

    // ========== CHATBOT CONFIG ==========
    const CFG_CACHE_KEY = 'roadRulesChatbotCfgCache_v2';
    const CFG_MAX_AGE   = 30 * 60 * 1000;
    async function getChatbotConfig() {
        const now = Date.now();
        try {
            const raw = localStorage.getItem(CFG_CACHE_KEY);
            if (raw) { const c = JSON.parse(raw); if (c?.data && now - (c.cachedAt || 0) < CFG_MAX_AGE) return c.data; }
        } catch {}
        try {
            const rows = await sbGet('config', 'key=eq.chatbot&select=value');
            const cfg = (rows[0] && rows[0].value) || { rugambaProactiveDelayMin: 5 };
            try { localStorage.setItem(CFG_CACHE_KEY, JSON.stringify({ data: cfg, cachedAt: now })); } catch {}
            return cfg;
        } catch { return { rugambaProactiveDelayMin: 5 }; }
    }

    // ========== OPEN KONTE PANEL ==========
    window.openKontePanel = async function () {
        const panel = _createKontePanel();
        panel.classList.remove('hidden'); panel.classList.add('flex');
        const u = getSession();
        if (u) {
            const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
            set('konte-name', u.name); set('konte-phone', u.phone); set('konte-district', u.district);
        }
        const annList = document.getElementById('konte-announcements');
        if (annList) {
            annList.innerHTML = `<div class="flex items-center gap-2 text-xs py-4 text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i> <span>Kuzana amatangazo...</span></div>`;
            try {
                const anns = await getAnnouncements();
                const seen = getSeenIds();
                if (!anns || !anns.length) {
                    annList.innerHTML = `<div class="text-center py-6 text-xs border border-dashed border-slate-300 rounded-3xl text-slate-400">Nta matangazo y'umunsi.</div>`;
                } else {
                    annList.innerHTML = '';
                    anns.forEach(a => {
                        const isNew = a.id && !seen.includes(a.id);
                        const card = document.createElement('div');
                        card.className = `p-4 rounded-3xl border ${isNew ? 'border-amber-400 bg-amber-50/70 ring-1 ring-amber-400/40' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'} shadow-sm`;
                        card.innerHTML = `<div class="flex justify-between items-start"><div class="font-semibold text-amber-800 dark:text-amber-300 text-[13.5px] flex items-center gap-2">${isNew ? '<span class="text-[9px] font-bold px-1.5 py-px rounded bg-amber-500 text-white">NEW</span>' : ''}${a.title || 'Amatangazo'}</div>${a.created_at ? `<div class="text-[10px] text-amber-500">${new Date(a.created_at).toLocaleDateString('rw-RW')}</div>` : ''}</div><div class="mt-2 text-[13px] leading-snug text-slate-700 dark:text-slate-200 whitespace-pre-wrap">${a.content || ''}</div>`;
                        annList.appendChild(card);
                    });
                    markSeen(anns.map(x => x.id).filter(Boolean));
                    window.RoadRulesAuth?.updateProfileBadge?.();
                }
            } catch { annList.innerHTML = '<div class="text-xs text-red-500 py-4">Ntibishoboye kuzana amatangazo.</div>'; }
        }
    };
    window.closeKontePanel = function () { const p = document.getElementById('konte-panel'); if (p) { p.classList.remove('flex'); p.classList.add('hidden'); } };
    window.logoutKonte = function () { clearSession(); if (window.closeKontePanel) window.closeKontePanel(); setTimeout(() => location.reload(), 80); };

    // ========== ACCESS CONTROL ==========
    const PLAN_LIMITS = {
        ubuntu:   { maxExams: 1,   cooldownMs: 0,           singleAttempt: true },
        inshuro2: { maxExams: 2,   cooldownMs: 0,           singleAttempt: false },
        inshuro5: { maxExams: 5,   cooldownMs: 0,           singleAttempt: false },
        ukwezi:   { maxExams: 999, cooldownMs: 2*60*1000,   singleAttempt: false }
    };
    function _normalizePlan(p) {
        if (!p) return 'ubuntu';
        if (p === 'icyumweru' || p === 'inshuro5') return 'inshuro5';
        if (p === 'inshuro2') return 'inshuro2';
        if (p === 'ukwezi') return 'ukwezi';
        if (PLAN_LIMITS[p]) return p;
        return 'ubuntu';
    }
    function _getCurrentPlan() {
        try {
            const sub = getSession()?.subscription;
            if (sub?.status === 'approved' && sub?.plan) {
                return _normalizePlan(sub.plan);
            }
        } catch {}
        return 'ubuntu';
    }
    function _getPendingUpgrade() { try { const u = getSession(); return (u?.pendingUpgrade?.status === 'pending') ? u.pendingUpgrade : null; } catch { return null; } }

    function _getRemainingExams() {
        try { const u = getSession(); return typeof u?.remainingExams === 'number' ? u.remainingExams : null; } catch { return null; }
    }
    function _setRemainingExams(val) {
        try {
            const u = getSession() || {};
            u.remainingExams = Math.max(0, val);
            saveSession(u);
        } catch {}
    }
    function _addRemainingExams(add) {
        const cur = _getRemainingExams();
        if (cur === null) return;
        _setRemainingExams(cur + Math.max(0, add));
    }
    function _getEffectiveMax() {
        const plan = _getCurrentPlan();
        const info = PLAN_LIMITS[plan] || PLAN_LIMITS.ubuntu;
        // ukwezi is effectively unlimited
        if (info.maxExams >= 999) return 999;
        // Use remainingExams as the source of truth when available (already includes stacked allowances)
        const rem = _getRemainingExams();
        if (typeof rem === 'number') return Math.max(0, rem);
        return info.maxExams;
    }
    function refreshPlanStack() {
        try {
            const u = getSession() || {};
            const sub = u.subscription;
            if (sub?.status === 'approved' && sub?.plan) {
                const plan = _normalizePlan(sub.plan);
                const info = PLAN_LIMITS[plan] || PLAN_LIMITS.ubuntu;
                const prevPlan = u.currentPlan || 'ubuntu';
                const lastPaidAt = u.lastPaidAt ? Date.parse(u.lastPaidAt) : 0;
                const currentPaidAt = sub.paidAt ? Date.parse(sub.paidAt) : 0;
                const isNewPurchase = isNaN(currentPaidAt)
                  ? sub.paidAt !== u.lastPaidAt
                  : currentPaidAt > Math.max(0, lastPaidAt);

                if (info.maxExams >= 999) {
                    // ukwezi: unlimited; track plan + paidAt, ignore stacking
                    u.remainingExams = 8888;
                } else {
                    const base = info.maxExams;
                    let remaining = typeof u.remainingExams === 'number' ? u.remainingExams : null;

                    if (remaining === null) {
                        // First time seeding: base plan allowance minus completed exams
                        const completed = window.RoadRulesAccess?.getCompletedExamCount ? window.RoadRulesAccess.getCompletedExamCount() : 0;
                        remaining = Math.max(0, base - completed);
                    } else if (isNewPurchase || plan !== prevPlan) {
                        // New purchase or plan change: add the new plan's base allowance to existing remaining
                        remaining = remaining + base;
                    }
                    // else: same plan, no new purchase detected -> keep existing remaining

                    u.remainingExams = Math.max(0, remaining);
                }
                u.currentPlan = plan;
                if (sub.paidAt) u.lastPaidAt = sub.paidAt;
                saveSession(u);
            }
        } catch {}
    }

    window.RoadRulesAccess = {
        getCurrentPlan: _getCurrentPlan,
        getPlanInfo: () => ({ plan: _getCurrentPlan(), ...(PLAN_LIMITS[_getCurrentPlan()] || PLAN_LIMITS.ubuntu) }),
        getMaxExamsAllowed: _getEffectiveMax,
        getBaseMaxExamsAllowed: () => (PLAN_LIMITS[_getCurrentPlan()] || PLAN_LIMITS.ubuntu).maxExams,
        isSingleAttemptPlan: () => !!(PLAN_LIMITS[_getCurrentPlan()] || PLAN_LIMITS.ubuntu).singleAttempt,
        getLastExamCompletedAt: () => { try { const k = `roadRulesLastExamAt_${getSession()?.phone||'guest'}`; const v = localStorage.getItem(k); return v ? parseInt(v) : 0; } catch { return 0; } },
        setLastExamCompletedAt: (ts = Date.now()) => { try { localStorage.setItem(`roadRulesLastExamAt_${getSession()?.phone||'guest'}`, String(ts)); } catch {} },
        getCooldownRemainingMs: () => { const info = (PLAN_LIMITS[_getCurrentPlan()] || PLAN_LIMITS.ubuntu); if (!info.cooldownMs) return 0; const last = window.RoadRulesAccess.getLastExamCompletedAt(); return last ? Math.max(0, info.cooldownMs - (Date.now() - last)) : 0; },
        canStartExamNow: () => window.RoadRulesAccess.getCooldownRemainingMs() === 0,
        getCompletedExamCount: () => { try { const k = `roadRulesExamHistory_${getSession()?.phone||'guest'}`; const a = JSON.parse(localStorage.getItem(k)||'[]'); return Array.isArray(a) ? a.length : 0; } catch { return 0; } },
        canStartMoreExams: () => {
            const max = window.RoadRulesAccess.getMaxExamsAllowed();
            const rem = window.RoadRulesAccess.getRemainingExams ? window.RoadRulesAccess.getRemainingExams() : null;
            if (typeof rem === 'number') {
                return max >= 999 || rem > 0;
            }
            const done = window.RoadRulesAccess.getCompletedExamCount ? window.RoadRulesAccess.getCompletedExamCount() : 0;
            return max >= 999 || done < max;
        },
        getRemainingExams: _getRemainingExams,
        addRemainingExams: _addRemainingExams,
        refreshPlanStack,
        getPendingUpgrade: _getPendingUpgrade,
        PLAN_LIMITS
    };

    // ========== ADMIN NAMESPACE ==========
    // Admin password is stored in sessionStorage after admin logs in (set by admin.html)
    function _adminPwd() { return sessionStorage.getItem('rrAdminPwd') || ''; }

    window.RoadRulesAdmin = {
        getCurrentPlan: _getCurrentPlan,
        getPendingUpgrade: _getPendingUpgrade,

        listAllUserFiles: async () => {
            showLoading('Kuzana abakoresha...');
            try { const r = await sbRpc('roadrules_admin_list_users', { p_admin_pwd: _adminPwd() }); hideLoading(); return r || []; }
            catch (e) { hideLoading(); throw e; }
        },
        getUserData: async (phone) => {
            showLoading('Kuzana amakuru...');
            try { const r = await sbRpc('roadrules_admin_get_user', { p_admin_pwd: _adminPwd(), p_phone: phone }); hideLoading(); return r; }
            catch (e) { hideLoading(); return null; }
        },
        getUserDataSilent: async (phone) => {
            try { return await sbRpc('roadrules_admin_get_user', { p_admin_pwd: _adminPwd(), p_phone: phone }); }
            catch { return null; }
        },
        updateUserData: async (phone, updates) => {
            showLoading('Kubona ifatabuguzi...');
            try {
                if (updates.pendingUpgrade !== undefined) {
                    await sbRpc('roadrules_set_pending_upgrade', { p_phone: phone, p_upgrade: updates.pendingUpgrade || null });
                }
                hideLoading(); return true;
            } catch (e) { hideLoading(); return false; }
        },
        approveUserPlan: async (phone) => {
            showLoading('Kubona ifatabuguzi...');
            try { await sbRpc('roadrules_admin_approve', { p_admin_pwd: _adminPwd(), p_phone: phone }); hideLoading(); return true; }
            catch (e) { hideLoading(); return false; }
        },
        dismissUserPlan: async (phone) => {
            showLoading('Kubona ifatabuguzi...');
            try { await sbRpc('roadrules_admin_dismiss', { p_admin_pwd: _adminPwd(), p_phone: phone }); hideLoading(); return true; }
            catch (e) { hideLoading(); return false; }
        },
        deleteUser: async (phone) => {
            try { await sbRpc('roadrules_admin_delete_user', { p_admin_pwd: _adminPwd(), p_phone: phone }); return true; }
            catch (e) { throw e; }
        },

        // Announcements
        postAnnouncement: async (title, content) => {
            showLoading('Kohereza amatangazo...');
            try {
                await sbRpc('roadrules_admin_post_announcement', { p_admin_pwd: _adminPwd(), p_title: title, p_content: content });
                try { localStorage.removeItem('roadRulesAmatangazoCache_v2'); } catch {}
                hideLoading(); return true;
            } catch (e) { hideLoading(); throw e; }
        },
        editAnnouncement: async (id, title, content) => {
            showLoading('Kubona amatangazo...');
            try {
                await sbRpc('roadrules_admin_edit_announcement', { p_admin_pwd: _adminPwd(), p_id: id, p_title: title || null, p_content: content || null });
                try { localStorage.removeItem('roadRulesAmatangazoCache_v2'); } catch {}
                hideLoading();
            } catch (e) { hideLoading(); throw e; }
        },
        deleteAnnouncement: async (id) => {
            showLoading('Gusiba amatangazo...');
            try {
                await sbRpc('roadrules_admin_delete_announcement', { p_admin_pwd: _adminPwd(), p_id: id });
                try { localStorage.removeItem('roadRulesAmatangazoCache_v2'); } catch {}
                hideLoading();
            } catch (e) { hideLoading(); throw e; }
        },

        // Help FAQs
        postHelpFaq: async (question, answers) => {
            showLoading('Kohereza ikibazo...');
            const arr = Array.isArray(answers) ? answers.filter(Boolean) : [String(answers || '')];
            try {
                await sbRpc('roadrules_admin_post_faq', { p_admin_pwd: _adminPwd(), p_question: question, p_answers: arr });
                try { localStorage.removeItem('roadRulesHelpFaqsCache_v2'); } catch {}
                hideLoading(); return true;
            } catch (e) { hideLoading(); throw e; }
        },
        editHelpFaq: async (id, question, answers) => {
            showLoading('Kubona ikibazo...');
            const arr = answers != null ? (Array.isArray(answers) ? answers : [String(answers)]) : null;
            try {
                await sbRpc('roadrules_admin_edit_faq', { p_admin_pwd: _adminPwd(), p_id: id, p_question: question || null, p_answers: arr });
                try { localStorage.removeItem('roadRulesHelpFaqsCache_v2'); } catch {}
                hideLoading();
            } catch (e) { hideLoading(); throw e; }
        },
        deleteHelpFaq: async (id) => {
            showLoading('Gusiba ikibazo...');
            try {
                await sbRpc('roadrules_admin_delete_faq', { p_admin_pwd: _adminPwd(), p_id: id });
                try { localStorage.removeItem('roadRulesHelpFaqsCache_v2'); } catch {}
                hideLoading();
            } catch (e) { hideLoading(); throw e; }
        },

        // Chatbot config
        updateChatbotConfig: async (partial) => {
            showLoading('Saving chatbot settings...');
            try {
                await sbRpc('roadrules_admin_update_chatbot_config', { p_admin_pwd: _adminPwd(), p_partial: partial });
                try { localStorage.removeItem('roadRulesChatbotCfgCache_v2'); } catch {}
                hideLoading(); return true;
            } catch (e) { hideLoading(); throw e; }
        }
    };

    // ========== ROADRULESAUTH NAMESPACE ==========
    window.RoadRulesAuth = {
        getCurrentPlan: () => getSession()?.subscription || { plan: 'ubuntu', planName: 'Ubuntu Free', amount: 0, status: 'approved' },
        getAnnouncements,
        getHelpFaqs,
        getChatbotConfig,

        refreshMyData: async () => {
            try {
                const u = getSession(); if (!u?.phone) return null;
                const fresh = await sbRpc('roadrules_refresh', { p_phone: u.phone });
                if (!fresh) return null;
                const local = getSession() || {};
                if (fresh.subscription) local.subscription = fresh.subscription;
                local.pendingUpgrade = fresh.pendingUpgrade || undefined;
                saveSession(local); return local;
            } catch { return null; }
        },

        setPendingUpgrade: async (phone, upgradeData) => {
            try {
                await sbRpc('roadrules_set_pending_upgrade', { p_phone: phone, p_upgrade: upgradeData });
                const local = getSession();
                if (local) { local.pendingUpgrade = upgradeData; saveSession(local); }
                return true;
            } catch { return false; }
        },

        saveExam: async (examResult) => {
            const u = getSession(); if (!u?.phone) return;
            try {
                const k = `roadRulesExamHistory_${u.phone}`;
                const arr = JSON.parse(localStorage.getItem(k) || '[]');
                arr.unshift({ ...examResult, date: new Date().toISOString() });
                localStorage.setItem(k, JSON.stringify(arr.slice(0, 100)));
            } catch {}
            sbRpc('roadrules_save_exam', { p_phone: u.phone, p_score: examResult.score, p_total: examResult.total || 20, p_time_taken: examResult.timeTaken || 0 }).catch(() => {});
        },

        updateAuthUI: function () {
            const u = getSession(); if (!u) return;
            const short = u.name.split(' ').slice(0, 2).join(' ');
            const desktop = document.getElementById('desktop-auth-area');
            const mobile  = document.getElementById('mobile-auth-area');
            if (desktop) {
                desktop.classList.remove('hidden'); desktop.classList.add('flex', 'items-center');
                desktop.innerHTML = `<div class="relative" style="line-height:0"><button onclick="window.openKontePanel&&window.openKontePanel()" class="profile-icon-btn flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-blue-800 text-white shadow ring-1 ring-blue-900/40 hover:brightness-105 active:scale-[0.96] transition" title="Konte • ${short}"><i class="fa-solid fa-user text-[17px]"></i></button></div>`;
                setTimeout(() => window.RoadRulesAuth?.updateProfileBadge?.(), 350);
            }
            if (mobile) {
                mobile.innerHTML = `<div class="text-center text-sm py-1"><button onclick="window.openKontePanel&&window.openKontePanel()" class="px-3 py-1 text-xs rounded-2xl border border-slate-300">Bona Konte</button> <span onclick="window.logoutKonte&&window.logoutKonte()" class="text-red-600 cursor-pointer text-xs ml-2">Gusohoka</span></div>`;
            }
        },

        updateProfileBadge: async function () {
            try {
                const seen = getSeenIds();
                const all  = await getAnnouncements();
                const count = all.filter(a => a?.id && !seen.includes(a.id)).length;
                document.querySelectorAll('.profile-icon-btn').forEach(btn => {
                    const w = btn.parentElement;
                    let badge = w.querySelector('.ann-badge');
                    if (count > 0) {
                        if (!badge) { badge = document.createElement('span'); badge.className = 'ann-badge absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-extrabold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-1 shadow ring-1 ring-white/80'; w.style.position = 'relative'; w.appendChild(badge); }
                        badge.textContent = count > 9 ? '9+' : String(count);
                    } else if (badge) badge.remove();
                });
            } catch {}
        }
    };

    // ========== BOOT ==========
    function _init() {
        const path = window.location.pathname;
        const isStandaloneAuth = path.includes('login.html') || path.includes('signup.html');
        if (!isStandaloneAuth) createAuthModal();
        _attachHandlers();
        const u = getSession();
        if (u) {
            // Ensure plan stack/remaining exams is up-to-date on every load
            try { window.RoadRulesAccess.refreshPlanStack(); } catch {}
            setTimeout(() => window.RoadRulesAuth.updateAuthUI(), 300);
        }
        console.log('%c[RoadRules] Direct Supabase mode — no server required.', 'color:#10b981');
        console.log('%c[RoadRules Admin] window.RoadRulesAdmin.* → Supabase RPCs', 'color:#f59e0b');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _init);
    else _init();
})();
