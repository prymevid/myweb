// RoadRules Auth - Google Drive Driver + Self-Injecting Modal
// Every user = one real .json file inside Google Drive folder "UserData"
// Works without any local server. Modal is injected automatically by this file.

(function () {
    // ========== GOOGLE DRIVE CREDENTIALS (from your reference) ==========
    const CLIENT_ID = '313958815059-m8m1t0g29ittf223gdj3nlfb3uv030he.apps.googleusercontent.com';
    const CLIENT_SECRET = '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';
    const REFRESH_TOKEN = '1//04kD2s8SvhjxZCgYIARAAGAQSNwF-L9IropCH-lC7siDNmuQ3yKvcNXF1GtTje7-dnd-SEUDIC9LuyYfXe1DUV0sQiOTA2nOdfcs';
    const FOLDER_NAME = 'UserData';

    let cachedAccessToken = null;
    let tokenExpiry = 0;
    let tokenPromise = null;
    let cachedFolderId = null;
    let folderPromise = null;

    let authModal, loginForm, signupForm;
    let loginPhoneInput, loginPassInput, signupNameInput, signupPhoneInput, signupDistrictInput, signupPassInput;

    function getElements() {
        authModal = document.getElementById('auth-modal');
        loginForm = document.getElementById('login-form');
        signupForm = document.getElementById('signup-form');

        // Login fields
        loginPhoneInput = document.getElementById('login-phone');
        loginPassInput = document.getElementById('login-pass');

        // Signup fields (our current names)
        signupNameInput = document.getElementById('signup-name');
        signupPhoneInput = document.getElementById('signup-phone');
        signupDistrictInput = document.getElementById('signup-district');
        signupPassInput = document.getElementById('signup-pass');
    }

    // ========== GOOGLE DRIVE HELPERS (copied & adapted from your reference) ==========
    async function getAccessToken() {
        const now = Date.now();
        if (cachedAccessToken && now < tokenExpiry) {
            return cachedAccessToken;
        }
        if (tokenPromise) {
            return tokenPromise;
        }
        tokenPromise = (async () => {
            const res = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    refresh_token: REFRESH_TOKEN
                })
            });
            if (!res.ok) throw new Error('Ntibishoboye kubona access token');
            const data = await res.json();
            cachedAccessToken = data.access_token;
            tokenExpiry = now + ((data.expires_in || 3500) * 1000);
            const tok = cachedAccessToken;
            tokenPromise = null;
            return tok;
        })();
        return tokenPromise;
    }

    async function getFolderId(accessToken, folderName) {
        if (cachedFolderId) return cachedFolderId;
        if (folderPromise) return folderPromise;
        folderPromise = (async () => {
            const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
            const data = await res.json();
            const id = data.files && data.files.length > 0 ? data.files[0].id : null;
            if (id) cachedFolderId = id;
            folderPromise = null;
            return id;
        })();
        return folderPromise;
    }

    async function createFolder(accessToken, folderName) {
        const metadata = { name: folderName, mimeType: 'application/vnd.google-apps.folder' };
        const res = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(metadata)
        });
        const data = await res.json();
        return data.id;
    }

    async function findFileByName(accessToken, folderId, fileName) {
        const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const data = await res.json();
        return data.files && data.files.length > 0 ? data.files[0].id : null;
    }

    async function createUserFile(accessToken, folderId, userData) {
        const fileName = `${userData.phone.replace(/[^0-9]/g, '')}.json`;
        const fileContent = JSON.stringify(userData);
        const metadata = { name: fileName, parents: [folderId], mimeType: 'application/json' };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([fileContent], { type: 'application/json' }));
        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form
        });
        return res.json();
    }

    async function readFileContent(accessToken, fileId) {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!res.ok) throw new Error('Fichier ntibabonetse');
        return res.json();
    }

async function readUserFileById(fileId) {
        showLoading('Kuzana amakuru...');
        try {
            const token = await getAccessToken();
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('read failed');
            const data = await res.json();
            hideLoading();
            return data;
        } catch (e) {
            console.error('Failed to read file by id', e);
            hideLoading();
            return null;
        }
    }

    // Silent version for batch loading (no loading overlay)
    async function readUserFileByIdSilent(fileId) {
        try {
            const token = await getAccessToken();
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            return null;
        }
    }

    function showToast(msg, type = 'success') {
        const el = document.createElement('div');
        el.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-[95] px-5 py-3 rounded-3xl shadow-xl text-white text-sm flex items-center gap-2 ${type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`;
        el.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i> <span>${msg}</span>`;
        document.body.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200); }, 2800);
    }

    // ========== PROFESSIONAL NON-CANCELLABLE LOADER ("Tegereza Gato") ==========
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
                    <div class="mb-5">
                        <i class="fa-solid fa-spinner fa-spin text-4xl text-blue-600 dark:text-blue-400"></i>
                    </div>
                    <div class="font-semibold text-[17px] tracking-tight text-slate-800 dark:text-white">Tegereza Gato</div>
                    <div id="roadrules-loader-sub" class="text-[12.5px] text-slate-500 dark:text-slate-400 mt-1.5 min-h-[16px]"></div>
                </div>
            `;
            document.body.appendChild(globalLoader);
        }
        globalLoaderSub = globalLoader.querySelector('#roadrules-loader-sub');
        return globalLoader;
    }

    function showLoading(subMessage = '') {
        ensureGlobalLoader();
        loadingCount++;

        if (globalLoaderSub) {
            globalLoaderSub.textContent = subMessage || '';
        }
        globalLoader.style.display = 'flex';
        globalLoader.classList.remove('hidden');
        globalLoader.classList.add('flex');

        document.body.style.overflow = 'hidden';

        // Prevent Escape key from closing anything while loading
        if (!globalLoader.dataset.keyListener) {
            globalLoader.dataset.keyListener = 'true';
            document.addEventListener('keydown', function blockEscape(e) {
                if (loadingCount > 0 && e.key === 'Escape') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
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

    // Public API for other scripts
    window.RoadRulesLoader = {
        show: (msg) => showLoading(msg),
        hide: () => hideLoading(),
        forceHide: () => { loadingCount = 0; hideLoading(); }
    };

    // ========== OUR SIGNUP (exactly like your reference) ==========
    async function handleSignup(e) {
        if (e) e.preventDefault();

        const name = (signupNameInput?.value || '').trim();
        const phone = (signupPhoneInput?.value || '').trim();
        const district = (signupDistrictInput?.value || '').trim() || 'Kigali';
        const password = (signupPassInput?.value || '').trim();

        if (!name || !phone || !password) {
            showToast('Nyamuneka uzuza amazina, nimero, n\'ijambobanga', 'error');
            return;
        }

        showLoading('Kwiyandikisha...');
        try {
            const token = await getAccessToken();
            let folderId = await getFolderId(token, FOLDER_NAME);
            if (!folderId) folderId = await createFolder(token, FOLDER_NAME);

            const fileName = `${phone.replace(/[^0-9]/g, '')}.json`;
            const existing = await findFileByName(token, folderId, fileName);
            if (existing) throw new Error('Iyi telefone irahari. Injira!');

            const userData = {
                name,
                phone,
                district,
                password,
                createdAt: new Date().toISOString(),
                subscription: {
                    plan: 'ubuntu',
                    planName: 'Ubuntu Free',
                    amount: 0,
                    status: 'approved',
                    paidAt: new Date().toISOString()
                }
            };

            await createUserFile(token, folderId, userData);

            // Auto-login session
            const sessionUser = {
                name: userData.name,
                phone: userData.phone,
                district: userData.district,
                subscription: userData.subscription
            };
            localStorage.setItem('roadRulesUser', JSON.stringify(sessionUser));

            showToast('Kwiyandikisha byagenze neza!', 'success');

            // On standalone signup.html, redirect immediately to homepage
            if (window.location.pathname.includes('signup.html')) {
                setTimeout(() => { window.location.replace('index.html'); }, 400);
                return;
            }

            // Switch to login tab
            setTimeout(() => {
                document.getElementById('login-form').classList.remove('hidden');
                document.getElementById('signup-form').classList.add('hidden');
                if (loginPhoneInput) loginPhoneInput.value = phone;
            }, 1200);

        } catch (err) {
            showToast('Byanze: ' + err.message, 'error');
        } finally {
            hideLoading();
        }
    }

    // ========== OUR LOGIN (exactly like your reference) ==========
    async function handleLogin(e) {
        if (e) e.preventDefault();

        const phone = (loginPhoneInput?.value || '').trim();
        const password = (loginPassInput?.value || '').trim();

        if (!phone || !password) {
            showToast('Uzuza nimero n\'ijambobanga', 'error');
            return;
        }

        showLoading('Injira...');
        try {
            const token = await getAccessToken();
            const folderId = await getFolderId(token, FOLDER_NAME);
            if (!folderId) throw new Error('Nta bushyinguro bwabonetse muri Drive.');

            const fileName = `${phone.replace(/[^0-9]/g, '')}.json`;
            const fileId = await findFileByName(token, folderId, fileName);
            if (!fileId) throw new Error('Konti ntabwo ibaho. Iyandikishe!');

            const user = await readFileContent(token, fileId);

            if (user.password === password) {
                // Ensure every logged-in user has at least Ubuntu plan by default
                if (!user.subscription) {
                    user.subscription = {
                        plan: 'ubuntu',
                        planName: 'Ubuntu Free',
                        amount: 0,
                        status: 'approved',
                        paidAt: new Date().toISOString()
                    };
                }

                // Save session (include subscription so other pages can read current plan)
                const sessionUser = {
                    name: user.name,
                    phone: user.phone,
                    district: user.district,
                    subscription: user.subscription
                };
                if (user.pendingUpgrade) sessionUser.pendingUpgrade = user.pendingUpgrade;
                localStorage.setItem('roadRulesUser', JSON.stringify(sessionUser));

                showToast(`Murakaza neza ${user.name.split(' ')[0]}!`, 'success');

                // On standalone login.html, redirect immediately to homepage
                if (window.location.pathname.includes('login.html')) {
                    setTimeout(() => { window.location.replace('index.html'); }, 400);
                    return;
                }

                // Close modal + update header UI
                const modal = document.getElementById('auth-modal');
                if (modal) { modal.classList.remove('flex'); modal.classList.add('hidden'); }

                // Refresh any logged-in UI we have in the page
                if (typeof window.RoadRulesAuth !== 'undefined' && window.RoadRulesAuth.updateAuthUI) {
                    window.RoadRulesAuth.updateAuthUI();
                }

                // Reload to unlock protected pages (imyitozo, ibibazo, plans)
                setTimeout(() => { location.reload(); }, 650);

            } else {
                showToast('Ijambobanga cyangwa nimero si byo.', 'error');
            }
        } catch (err) {
            showToast('Byanze: ' + err.message, 'error');
        } finally {
            hideLoading();
        }
    }

    // ========== DYNAMIC MODAL (injected so every page works without duplicating HTML) ==========
    function createAuthModal() {
        if (document.getElementById('auth-modal')) return;

        const modalHTML = `
        <div id="auth-modal" class="hidden fixed inset-0 z-[90] items-center justify-center bg-black/60 p-4">
            <div onclick="event.target.id==='auth-modal' && closeAuthModal()" class="absolute inset-0"></div>
            <div class="relative w-full max-w-[380px] rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <!-- header -->
                <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div class="flex items-center gap-x-3">
                        <div class="h-8 w-8 rounded-2xl bg-gradient-to-br from-blue-700 to-blue-800 flex items-center justify-center text-white">
                            <i class="fa-solid fa-road"></i>
                        </div>
                        <span class="font-semibold text-lg tracking-tight">RoadRules</span>
                    </div>
                    <button onclick="closeAuthModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-3xl leading-none px-1 -mt-1">&times;</button>
                </div>

                <!-- tabs -->
                <div class="flex border-b border-slate-200 dark:border-slate-700 text-sm font-semibold">
                    <button id="tab-login" onclick="switchAuthTab('login')" class="flex-1 py-3.5 border-b-2 border-blue-700 text-blue-700 dark:text-blue-400">Injira</button>
                    <button id="tab-signup" onclick="switchAuthTab('signup')" class="flex-1 py-3.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Iyandikishe</button>
                </div>

                <!-- LOGIN -->
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

                <!-- SIGNUP -->
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
        if (!document.getElementById('auth-modal')) {
            createAuthModal();
        }
    }

    function switchAuthTab(tab) {
        const loginF = document.getElementById('login-form');
        const signupF = document.getElementById('signup-form');
        const tLogin = document.getElementById('tab-login');
        const tSignup = document.getElementById('tab-signup');

        if (!loginF || !signupF) return;

        if (tab === 'login') {
            loginF.classList.remove('hidden');
            signupF.classList.add('hidden');
            if (tLogin) tLogin.classList.add('border-b-2', 'border-blue-700', 'text-blue-700', 'dark:text-blue-400');
            if (tLogin) tLogin.classList.remove('text-slate-500');
            if (tSignup) tSignup.classList.remove('border-b-2', 'border-blue-700', 'text-blue-700', 'dark:text-blue-400');
            if (tSignup) tSignup.classList.add('text-slate-500');
        } else {
            loginF.classList.add('hidden');
            signupF.classList.remove('hidden');
            if (tSignup) tSignup.classList.add('border-b-2', 'border-blue-700', 'text-blue-700', 'dark:text-blue-400');
            if (tSignup) tSignup.classList.remove('text-slate-500');
            if (tLogin) tLogin.classList.remove('border-b-2', 'border-blue-700', 'text-blue-700', 'dark:text-blue-400');
            if (tLogin) tLogin.classList.add('text-slate-500');
        }
    }

    function openAuthModal(mode = 'login') {
        ensureAuthModal();
        const modal = document.getElementById('auth-modal');
        if (!modal) return;

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        getElements();                    // refresh references after injection
        attachHandlers();                 // make sure submit listeners are attached

        switchAuthTab(mode);

        setTimeout(() => {
            const input = (mode === 'login') ? loginPhoneInput : signupNameInput;
            if (input) input.focus();
        }, 80);
    }

    function closeAuthModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
        }
    }

    // ========== ATTACH HANDLERS (updated for dynamic modal) ==========
    function attachHandlers() {
        window.handleLogin = handleLogin;
        window.handleSignup = handleSignup;
        window.openAuthModal = openAuthModal;
        window.closeAuthModal = closeAuthModal;
        window.switchAuthTab = switchAuthTab;

        if (loginForm) {
            loginForm.removeEventListener('submit', handleLogin);
            loginForm.addEventListener('submit', handleLogin);
        }
        if (signupForm) {
            signupForm.removeEventListener('submit', handleSignup);
            signupForm.addEventListener('submit', handleSignup);
        }
    }

    // ========== INIT ==========
    function initGoogleDriveAuth() {
        const path = (window.location.pathname || '').replace(/\\/g, '/');
        const isStandaloneAuth = path.includes('login.html') || path.includes('signup.html');

        // On standalone login/signup pages, skip modal injection and use page-native forms
        if (!isStandaloneAuth) {
            ensureAuthModal();
        }
        getElements();
        attachHandlers();

        // Make sure the global auth UI updater still works for header
        if (!window.RoadRulesAuth) window.RoadRulesAuth = {};
        window.RoadRulesAuth.getCurrentPlan = function () {
            const user = JSON.parse(localStorage.getItem('roadRulesUser') || 'null');
            return user?.subscription || {
                plan: 'ubuntu',
                planName: 'Ubuntu Free',
                amount: 0,
                status: 'approved'
            };
        };

        window.RoadRulesAuth.updateAuthUI = function () {
            const user = JSON.parse(localStorage.getItem('roadRulesUser') || 'null');
            const desktop = document.getElementById('desktop-auth-area');
            const mobile = document.getElementById('mobile-auth-area');
            if (!user) return;

            const short = user.name.split(' ').slice(0, 2).join(' ');
            if (desktop) {
                // Make profile icon always visible in right corner (replaces text name on all screen sizes)
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
                // Fire async badge check (unseen announcements)
                setTimeout(() => window.RoadRulesAuth && window.RoadRulesAuth.updateProfileBadge && window.RoadRulesAuth.updateProfileBadge(), 350);
            }
            if (mobile) {
                mobile.innerHTML = `<div class="text-center text-sm py-1"><button onclick="window.openKontePanel&&window.openKontePanel(); if(typeof toggleMobileMenu==='function')toggleMobileMenu()" class="px-3 py-1 text-xs rounded-2xl border border-slate-300 dark:border-slate-600">Bona Konte</button> <span onclick="localStorage.removeItem('roadRulesUser');location.reload()" class="text-red-600 cursor-pointer text-xs ml-2">Gusohoka</span></div>`;
            }
        };

        // ========== PREMIUM KONTE PANEL + UNSEEN ANNOUNCEMENT BADGE ==========
        // Per-user seen tracking (localStorage, per phone)
        function getCurrentUserPhone() {
            try {
                const u = JSON.parse(localStorage.getItem('roadRulesUser') || 'null');
                return u ? u.phone : null;
            } catch { return null; }
        }

        function getSeenAnnouncementIds() {
            const phone = getCurrentUserPhone();
            if (!phone) return [];
            const key = `roadRulesSeenAnns_${phone}`;
            try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
        }

        function markAllAnnouncementsSeen(annIds) {
            const phone = getCurrentUserPhone();
            if (!phone || !annIds) return;
            const key = `roadRulesSeenAnns_${phone}`;
            localStorage.setItem(key, JSON.stringify(annIds));
            // clear badge on any visible profile icons
            document.querySelectorAll('.profile-icon-btn').forEach(btn => {
                const badge = btn.parentElement.querySelector('.ann-badge');
                if (badge) badge.remove();
            });
        }

        async function getUnseenAnnouncementCount() {
            const phone = getCurrentUserPhone();
            if (!phone) return 0;
            const seen = getSeenAnnouncementIds();
            try {
                const all = await (window.RoadRulesAuth && window.RoadRulesAuth.getAnnouncements ? window.RoadRulesAuth.getAnnouncements() : []);
                return all.filter(a => a && a.id && !seen.includes(a.id)).length;
            } catch { return 0; }
        }

        // Update the red count badge on the profile icon(s)
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
                } else if (badge) {
                    badge.remove();
                }
            });
        };

        function createKontePanel() {
            if (document.getElementById('konte-panel')) return document.getElementById('konte-panel');
            const panel = document.createElement('div');
            panel.id = 'konte-panel';
            panel.className = 'hidden fixed inset-0 z-[100]';
            panel.innerHTML = `
                <div class="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onclick="window.closeKontePanel && window.closeKontePanel()"></div>
                <div onclick="event.stopImmediatePropagation()" 
                     class="absolute right-0 top-0 bottom-0 w-full max-w-[460px] bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-[ -20px_0_60px_-15px_rgb(0,0,0,0.3) ] flex flex-col rounded-l-3xl overflow-hidden">
                    
                    <!-- Premium Header -->
                    <div class="px-6 py-5 bg-gradient-to-b from-slate-900 to-slate-950 text-white flex items-center justify-between border-b border-white/10">
                        <div class="flex items-center gap-3">
                            <div class="flex h-8 w-8 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20">
                                <i class="fa-solid fa-user text-lg"></i>
                            </div>
                            <div>
                                <div class="text-[10px] tracking-[2px] text-white/60 font-medium">perime.rw member</div>
                                <div class="font-semibold text-xl tracking-[-0.6px] -mt-0.5">Konte yawe</div>
                            </div>
                        </div>
                        <button onclick="window.closeKontePanel && window.closeKontePanel()" 
                                class="flex h-9 w-9 items-center justify-center rounded-2xl hover:bg-white/10 text-white/70 hover:text-white transition text-2xl leading-none">×</button>
                    </div>

                     <div class="flex-1 overflow-auto px-6 py-6 space-y-7 text-[13.5px]">
                        
                        <!-- Account Info -->
                        <div>
                            <div class="uppercase text-[10px] tracking-[1.8px] font-semibold text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-2">
                                <i class="fa-solid fa-id-card"></i> 
                                <span>AMAKURU YA KONTI</span>
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
                                        <div>
                                            <div class="text-[10px] text-slate-500 dark:text-slate-400">Igihugu</div>
                                            <div class="font-semibold">Rwanda</div>
                                        </div>
                                    </div>
                                    <div class="flex items-start gap-3 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3.5 shadow-sm">
                                        <div class="mt-0.5 text-blue-600 dark:text-blue-400"><i class="fa-solid fa-map-marker-alt w-4"></i></div>
                                        <div class="min-w-0">
                                            <div class="text-[10px] text-slate-500 dark:text-slate-400">Akarere wahisemo</div>
                                            <div id="konte-district" class="font-semibold text-slate-900 dark:text-white"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Contact -->
                        <div>
                            <div class="uppercase text-[10px] tracking-[1.8px] font-semibold text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-2">
                                <i class="fa-solid fa-headset"></i> 
                                <span>TWANDIKIRE</span>
                            </div>
                            <div class="flex gap-3">
                                <a href="tel:+250788762976" 
                                   class="flex-1 group flex items-center justify-center gap-2.5 rounded-3xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-slate-900 py-[13px] text-sm font-medium transition active:scale-[0.985]">
                                    <i class="fa-solid fa-phone text-blue-600 group-hover:scale-110 transition"></i>
                                    <span>0788 762 976</span>
                                </a>
                                <a href="https://wa.me/250788762976?text=Muraho" target="_blank"
                                   class="flex-1 group flex items-center justify-center gap-2.5 rounded-3xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 py-[13px] text-sm font-medium text-emerald-700 dark:text-emerald-400 transition active:scale-[0.985]">
                                    <i class="fa-brands fa-whatsapp text-lg -ml-0.5"></i>
                                    <span>WhatsApp</span>
                                </a>
                            </div>
                            <div class="text-[10px] text-center text-slate-400 mt-2">Muraho — twandikire igihe cyose</div>
                        </div>

                        <!-- Logout -->
                        <button onclick="window.logoutKonte && window.logoutKonte()" 
                                class="w-full flex items-center justify-center gap-2 py-3.5 rounded-3xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold text-sm shadow-lg shadow-red-600/30 active:scale-[0.985] transition">
                            <i class="fa-solid fa-sign-out-alt"></i>
                            <span>GUSOHOKA</span>
                        </button>

                        <!-- Announcements -->
                        <div class="pt-2">
                            <div class="flex items-center justify-between mb-3">
                                <div class="uppercase text-[10px] tracking-[1.8px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                                    <i class="fa-solid fa-bullhorn"></i> 
                                    <span>AMATANGAZO</span>
                                </div>
                                <div class="text-[10px] text-amber-600/70 dark:text-amber-400/70">Kuva ku buyobozi</div>
                            </div>
                            <div id="konte-announcements" class="space-y-3 text-sm max-h-[260px] overflow-auto pr-1 custom-scroll">
                                <!-- Populated by JS -->
                            </div>
                        </div>
                    </div>

                    <div class="px-6 py-4 text-[10px] border-t border-slate-200 dark:border-slate-800 text-slate-400 bg-slate-50 dark:bg-slate-900 text-center">
                        RoadRules • 2026 • Amakuru yawe arinzwe
                    </div>
                </div>
            `;
            document.body.appendChild(panel);
            return panel;
        }

        window.openKontePanel = async function () {
            const panel = createKontePanel();
            panel.classList.remove('hidden');
            panel.classList.add('flex');

            const user = JSON.parse(localStorage.getItem('roadRulesUser') || 'null');
            if (user) {
                // Details
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
                    const anns = await (window.RoadRulesAuth && window.RoadRulesAuth.getAnnouncements ? window.RoadRulesAuth.getAnnouncements() : []);
                    const seen = getSeenAnnouncementIds();
                    
                    if (!anns || !anns.length) {
                        annList.innerHTML = `<div class="text-center py-6 text-xs border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl text-slate-400">Nta matangazo y'umunsi.</div>`;
                    } else {
                        annList.innerHTML = '';
                        const newIds = [];
                        
                        anns.forEach(a => {
                            const isNew = a.id && !seen.includes(a.id);
                            if (isNew) newIds.push(a.id);
                            
                            const card = document.createElement('div');
                            card.className = `p-4 rounded-3xl border ${isNew ? 'border-amber-400 bg-amber-50/70 dark:bg-amber-950/40 ring-1 ring-amber-400/40' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'} shadow-sm`;
                            card.innerHTML = `
                                <div class="flex justify-between items-start">
                                    <div class="font-semibold text-amber-800 dark:text-amber-300 text-[13.5px] flex items-center gap-2">
                                        ${isNew ? '<span class="text-[9px] font-bold px-1.5 py-px rounded bg-amber-500 text-white">NEW</span>' : ''}
                                        ${a.title || 'Amatangazo'}
                                    </div>
                                    ${a.createdAt ? `<div class="text-[10px] text-amber-500 tabular-nums">${new Date(a.createdAt).toLocaleDateString('rw-RW')}</div>` : ''}
                                </div>
                                <div class="mt-2 text-[13px] leading-snug text-slate-700 dark:text-slate-200 whitespace-pre-wrap">${a.content || ''}</div>
                            `;
                            annList.appendChild(card);
                        });

                        // Mark everything as seen when panel is opened (user has now viewed them)
                        const allIds = anns.map(x => x.id).filter(Boolean);
                        markAllAnnouncementsSeen(allIds);
                        
                        // refresh header badge to 0
                        if (window.RoadRulesAuth && window.RoadRulesAuth.updateProfileBadge) {
                            window.RoadRulesAuth.updateProfileBadge();
                        }
                    }
                } catch (e) {
                    annList.innerHTML = '<div class="text-xs text-red-500 py-4">Ntibishoboye kuzana amatangazo.</div>';
                }
            }
        };

        window.closeKontePanel = function () {
            const p = document.getElementById('konte-panel');
            if (p) {
                p.classList.remove('flex');
                p.classList.add('hidden');
            }
        };

        window.logoutKonte = function () {
            localStorage.removeItem('roadRulesUser');
            if (window.closeKontePanel) window.closeKontePanel();
            setTimeout(() => location.reload(), 80);
        };

        // (keep the same Drive helpers for announcements — unchanged below)
        async function getAnnouncementsFileId(token, folderId) {
            let fileId = await findFileByName(token, folderId, 'announcements.json');
            if (!fileId) {
                const metadata = { name: 'announcements.json', parents: [folderId], mimeType: 'application/json' };
                const form = new FormData();
                form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                form.append('file', new Blob([JSON.stringify([], null, 2)], { type: 'application/json' }));
                const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: form
                });
                const created = await res.json();
                fileId = created.id;
            }
            return fileId;
        }

        async function getAnnouncements() {
            const ANN_CACHE_KEY = 'roadRulesAmatangazoCache_v1';
            const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

            try {
                const token = await getAccessToken();
                const folderId = await getFolderId(token, FOLDER_NAME);
                if (!folderId) return [];
                const fileId = await getAnnouncementsFileId(token, folderId);

                const now = Date.now();
                let cached = null;
                try {
                    const raw = localStorage.getItem(ANN_CACHE_KEY);
                    if (raw) cached = JSON.parse(raw);
                } catch (e) {}

                // Lightweight change detection via Drive file modifiedTime (cheap, no content download)
                let remoteMod = null;
                try {
                    const metaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime`;
                    const metaRes = await fetch(metaUrl, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (metaRes.ok) {
                        const meta = await metaRes.json();
                        remoteMod = meta.modifiedTime;
                    }
                } catch (e) {
                    console.warn('[Konte] could not fetch modTime, will use time-based cache');
                }

                const cacheValid = cached && Array.isArray(cached.list) &&
                    (now - (cached.cachedAt || 0) < MAX_AGE) &&
                    (!remoteMod || !cached.modifiedTime || cached.modifiedTime === remoteMod);

                if (cacheValid) {
                    return cached.list;
                }

                // Miss or stale or changed by admin → fetch fresh content
                const data = await readFileContent(token, fileId);
                const list = Array.isArray(data) ? data : [];

                // persist to localStorage with modTime + timestamp for future hits
                try {
                    localStorage.setItem(ANN_CACHE_KEY, JSON.stringify({
                        list,
                        modifiedTime: remoteMod || (cached && cached.modifiedTime) || null,
                        cachedAt: now
                    }));
                } catch (e) {}

                return list;
            } catch (e) {
                console.error('[Konte] getAnnouncements failed', e);
                // graceful fallback to any cached copy (even if old)
                try {
                    const raw = localStorage.getItem(ANN_CACHE_KEY);
                    if (raw) {
                        const c = JSON.parse(raw);
                        if (Array.isArray(c.list)) return c.list;
                    }
                } catch (_) {}
                return [];
            }
        }

        async function saveAnnouncements(anns) {
            try {
                const token = await getAccessToken();
                const folderId = await getFolderId(token, FOLDER_NAME);
                if (!folderId) throw new Error('UserData folder missing');
                const fileId = await getAnnouncementsFileId(token, folderId);
                const contentStr = JSON.stringify(anns || [], null, 2);
                const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
                const res = await fetch(url, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: contentStr
                });
                if (!res.ok) throw new Error('PATCH failed ' + res.status);
            } catch (e) {
                console.error('[Konte] saveAnnouncements failed', e);
                throw e;
            }
        }

        window.RoadRulesAuth.getAnnouncements = getAnnouncements;

        // ========== HELP CENTER / CHATBOT FAQ (help_faqs.json) - same Drive pattern ==========
        const HELP_CACHE_KEY = 'roadRulesHelpFaqsCache_v1';
        const HELP_MAX_AGE = 1000 * 60 * 60 * 6; // 6 hours

        async function getHelpFaqsFileId(token, folderId) {
            let fileId = await findFileByName(token, folderId, 'help_faqs.json');
            if (!fileId) {
                const metadata = { name: 'help_faqs.json', parents: [folderId], mimeType: 'application/json' };
                const form = new FormData();
                form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                form.append('file', new Blob([JSON.stringify([], null, 2)], { type: 'application/json' }));
                const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: form
                });
                const created = await res.json();
                fileId = created.id;
            }
            return fileId;
        }

        async function getHelpFaqs() {
            try {
                const token = await getAccessToken();
                const folderId = await getFolderId(token, FOLDER_NAME);
                if (!folderId) return [];
                const fileId = await getHelpFaqsFileId(token, folderId);

                const now = Date.now();
                let cached = null;
                try {
                    const raw = localStorage.getItem(HELP_CACHE_KEY);
                    if (raw) cached = JSON.parse(raw);
                } catch (_) {}

                // cheap modTime check
                let remoteMod = null;
                try {
                    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (metaRes.ok) remoteMod = (await metaRes.json()).modifiedTime;
                } catch (_) {}

                const cacheValid = cached && Array.isArray(cached.list) &&
                    (now - (cached.cachedAt || 0) < HELP_MAX_AGE) &&
                    (!remoteMod || cached.modifiedTime === remoteMod);

                if (cacheValid) return cached.list;

                const data = await readFileContent(token, fileId);
                const list = Array.isArray(data) ? data : [];

                try {
                    localStorage.setItem(HELP_CACHE_KEY, JSON.stringify({
                        list, modifiedTime: remoteMod || (cached && cached.modifiedTime) || null, cachedAt: now
                    }));
                } catch (_) {}

                return list;
            } catch (e) {
                console.error('[HelpCenter] getHelpFaqs failed', e);
                try {
                    const raw = localStorage.getItem(HELP_CACHE_KEY);
                    if (raw) {
                        const c = JSON.parse(raw);
                        if (Array.isArray(c.list)) return c.list;
                    }
                } catch (_) {}
                return [];
            }
        }

        async function saveHelpFaqs(list) {
            try {
                const token = await getAccessToken();
                const folderId = await getFolderId(token, FOLDER_NAME);
                if (!folderId) throw new Error('UserData folder missing');
                const fileId = await getHelpFaqsFileId(token, folderId);
                const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(list || [], null, 2)
                });
                if (!res.ok) throw new Error('PATCH help_faqs failed ' + res.status);
                // bust cache
                localStorage.removeItem(HELP_CACHE_KEY);
            } catch (e) {
                console.error('[HelpCenter] saveHelpFaqs failed', e);
                throw e;
            }
        }

        window.RoadRulesAuth.getHelpFaqs = getHelpFaqs;

        // ========== CHATBOT CONFIG (chatbot-config.json) for delay etc. ==========
        const CHAT_CFG_CACHE_KEY = 'roadRulesChatbotCfgCache_v1';
        const CHAT_CFG_MAX_AGE = 1000 * 60 * 30; // 30 min

        async function getChatbotConfigFileId(token, folderId) {
            let fileId = await findFileByName(token, folderId, 'chatbot-config.json');
            if (!fileId) {
                const metadata = { name: 'chatbot-config.json', parents: [folderId], mimeType: 'application/json' };
                const form = new FormData();
                form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                form.append('file', new Blob([JSON.stringify({ rugambaProactiveDelayMin: 5 }, null, 2)], { type: 'application/json' }));
                const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: form
                });
                const created = await res.json();
                fileId = created.id;
            }
            return fileId;
        }

        async function getChatbotConfig() {
            try {
                const token = await getAccessToken();
                const folderId = await getFolderId(token, FOLDER_NAME);
                if (!folderId) return { rugambaProactiveDelayMin: 5 };
                const fileId = await getChatbotConfigFileId(token, folderId);

                const now = Date.now();
                let cached = null;
                try {
                    const raw = localStorage.getItem(CHAT_CFG_CACHE_KEY);
                    if (raw) cached = JSON.parse(raw);
                } catch (_) {}

                let remoteMod = null;
                try {
                    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (metaRes.ok) remoteMod = (await metaRes.json()).modifiedTime;
                } catch (_) {}

                const cacheValid = cached && cached.data &&
                    (now - (cached.cachedAt || 0) < CHAT_CFG_MAX_AGE) &&
                    (!remoteMod || cached.modifiedTime === remoteMod);

                if (cacheValid) return cached.data;

                const data = await readFileContent(token, fileId);
                const cfg = (data && typeof data === 'object') ? data : { rugambaProactiveDelayMin: 5 };

                try {
                    localStorage.setItem(CHAT_CFG_CACHE_KEY, JSON.stringify({
                        data: cfg, modifiedTime: remoteMod || (cached && cached.modifiedTime) || null, cachedAt: now
                    }));
                } catch (_) {}

                return cfg;
            } catch (e) {
                console.error('[ChatbotCfg] getChatbotConfig failed', e);
                try {
                    const raw = localStorage.getItem(CHAT_CFG_CACHE_KEY);
                    if (raw) {
                        const c = JSON.parse(raw);
                        if (c && c.data) return c.data;
                    }
                } catch (_) {}
                return { rugambaProactiveDelayMin: 5 };
            }
        }

        async function saveChatbotConfig(cfg) {
            try {
                const token = await getAccessToken();
                const folderId = await getFolderId(token, FOLDER_NAME);
                if (!folderId) throw new Error('UserData folder missing');
                const fileId = await getChatbotConfigFileId(token, folderId);
                const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(cfg || { rugambaProactiveDelayMin: 5 }, null, 2)
                });
                if (!res.ok) throw new Error('PATCH chatbot-config failed ' + res.status);
                localStorage.removeItem(CHAT_CFG_CACHE_KEY);
            } catch (e) {
                console.error('[ChatbotCfg] saveChatbotConfig failed', e);
                throw e;
            }
        }

        window.RoadRulesAuth.getChatbotConfig = getChatbotConfig;

        // Admin chatbot config update (used by admin.html)
        window.RoadRulesAdmin.updateChatbotConfig = async function (partial) {
            if (typeof showLoading === 'function') showLoading('Saving chatbot settings...');
            try {
                const current = await getChatbotConfig();
                const merged = Object.assign({}, current || {}, partial || {}, { updatedAt: new Date().toISOString() });
                await saveChatbotConfig(merged);
                if (typeof hideLoading === 'function') hideLoading();
                return true;
            } catch (e) {
                if (typeof hideLoading === 'function') hideLoading();
                throw e;
            }
        };

        // Admin Help FAQ controls (used by admin.html)
        window.RoadRulesAdmin.postHelpFaq = async function (question, answers) {
            if (typeof showLoading === 'function') showLoading('Kohereza ikibazo cya chatbot...');
            const list = await getHelpFaqs();

            // answers can be array of 3 or single string (backward)
            let ansArr = [];
            if (Array.isArray(answers)) {
              ansArr = answers.map(a => String(a || '').trim()).filter(Boolean);
            } else if (typeof answers === 'string') {
              ansArr = [String(answers).trim()];
            }

            list.unshift({
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
                question: String(question || '').trim(),
                answers: ansArr.length ? ansArr : ["Ntago hari igisubizo."],
                createdAt: new Date().toISOString()
            });
            await saveHelpFaqs(list);
            if (typeof hideLoading === 'function') hideLoading();
            return true;
        };

        window.RoadRulesAdmin.editHelpFaq = async function (id, question, answers) {
            if (typeof showLoading === 'function') showLoading('Kubona ibibazo bya chatbot...');
            const list = await getHelpFaqs();
            const idx = list.findIndex(f => f.id === id);
            if (idx !== -1) {
                let changed = false;
                if (question != null) { list[idx].question = String(question).trim(); changed = true; }

                if (answers != null) {
                  let ansArr = [];
                  if (Array.isArray(answers)) ansArr = answers.map(a => String(a || '').trim()).filter(Boolean);
                  else if (typeof answers === 'string') ansArr = [String(answers).trim()];
                  if (ansArr.length) {
                    list[idx].answers = ansArr;
                    // clean legacy field
                    delete list[idx].answer;
                    changed = true;
                  }
                }
                if (changed) {
                    list[idx].updatedAt = new Date().toISOString();
                    await saveHelpFaqs(list);
                }
            }
            if (typeof hideLoading === 'function') hideLoading();
        };

        window.RoadRulesAdmin.deleteHelpFaq = async function (id) {
            if (typeof showLoading === 'function') showLoading('Kubona ibibazo bya chatbot...');
            let list = await getHelpFaqs();
            list = list.filter(f => f.id !== id);
            await saveHelpFaqs(list);
            if (typeof hideLoading === 'function') hideLoading();
        };

        // Admin announcement controls
        window.RoadRulesAdmin.postAnnouncement = async function (title, content) {
            if (typeof showLoading === 'function') showLoading('Kohereza amatangazo...');
            const list = await getAnnouncements();
            list.unshift({
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
                title: String(title || '').trim(),
                content: String(content || '').trim(),
                createdAt: new Date().toISOString()
            });
            await saveAnnouncements(list);
            if (typeof hideLoading === 'function') hideLoading();
            return true;
        };

        window.RoadRulesAdmin.editAnnouncement = async function (id, title, content) {
            if (typeof showLoading === 'function') showLoading('Kubona amatangazo...');
            const list = await getAnnouncements();
            const idx = list.findIndex(a => a.id === id);
            if (idx !== -1) {
                let changed = false;
                if (title != null) {
                    list[idx].title = String(title).trim();
                    changed = true;
                }
                if (content != null) {
                    list[idx].content = String(content).trim();
                    changed = true;
                }
                if (changed) {
                    list[idx].updatedAt = new Date().toISOString();
                    await saveAnnouncements(list);
                }
            }
            if (typeof hideLoading === 'function') hideLoading();
        };

        window.RoadRulesAdmin.deleteAnnouncement = async function (id) {
            if (typeof showLoading === 'function') showLoading('Kubona amatangazo...');
            let list = await getAnnouncements();
            list = list.filter(a => a.id !== id);
            await saveAnnouncements(list);
            if (typeof hideLoading === 'function') hideLoading();
        };

        // Restore header if already logged in
        const saved = localStorage.getItem('roadRulesUser');
        if (saved) {
            setTimeout(() => {
                if (window.RoadRulesAuth.updateAuthUI) window.RoadRulesAuth.updateAuthUI();
            }, 300);
        }

        console.log('%c[RoadRules] Google Drive auth driver active (same as your reference)', 'color:#64748b');
    }

// ========== ADMIN / DATABASE CONTROL (Google Drive direct) ==========
    window.RoadRulesAdmin = {};

    async function listAllUserFiles() {
        showLoading('Kuzana abakoresha...');
        try {
            const token = await getAccessToken();
            let folderId = await getFolderId(token, FOLDER_NAME);
            if (!folderId) {
                console.warn('UserData folder not found in Drive');
                hideLoading();
                return [];
            }

            const query = `'${folderId}' in parents and trashed=false and name contains '.json'`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime,mimeType)&pageSize=1000&orderBy=modifiedTime%20desc`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            // Only return files that match Rwandan phone pattern (07 + any digits .json)
            const files = (data.files || []).filter(f => f.name && /^07\d+\.json$/.test(f.name));
            console.log(`[Admin] Found ${files.length} user files in Drive`);
            hideLoading();
            return files;
        } catch (e) {
            console.error('Failed to list users from Drive', e);
            hideLoading();
            return [];
        }
    }

    async function getUserData(phone) {
        showLoading('Kuzana amakuru...');
        try {
            const token = await getAccessToken();
            const folderId = await getFolderId(token, FOLDER_NAME);
            if (!folderId) { hideLoading(); return null; }

            const fileName = `${phone.replace(/[^0-9]/g, '')}.json`;
            const fileId = await findFileByName(token, folderId, fileName);
            if (!fileId) { hideLoading(); return null; }

            const data = await readFileContent(token, fileId);
            hideLoading();
            return data;
        } catch (e) {
            console.error('Failed to read user', e);
            hideLoading();
            return null;
        }
    }

    // Silent version for background plan sync (no loading overlay, fast page open)
    async function getUserDataSilent(phone) {
        try {
            const token = await getAccessToken();
            const folderId = await getFolderId(token, FOLDER_NAME);
            if (!folderId) return null;

            const fileName = `${phone.replace(/[^0-9]/g, '')}.json`;
            const fileId = await findFileByName(token, folderId, fileName);
            if (!fileId) return null;

            const data = await readFileContent(token, fileId);
            return data;
        } catch (e) {
            console.warn('Silent user data fetch failed:', e.message || e);
            return null;
        }
    }

    async function updateUserData(phone, updates) {
        showLoading('Kubona ifatabuguzi...');
        try {
            const token = await getAccessToken();
            const folderId = await getFolderId(token, FOLDER_NAME);
            if (!folderId) throw new Error('UserData folder not found');

            const fileName = `${phone.replace(/[^0-9]/g, '')}.json`;
            const fileId = await findFileByName(token, folderId, fileName);
            if (!fileId) throw new Error('User file not found');

            // 1. Read current data
            const current = await readFileContent(token, fileId);
            const newData = { ...current, ...updates, lastUpdated: new Date().toISOString() };
            // Support clearing fields by passing undefined in updates (e.g. pendingUpgrade: undefined)
            Object.keys(newData).forEach(k => {
                if (newData[k] === undefined) delete newData[k];
            });
            const fileContent = JSON.stringify(newData, null, 2);

            // 2. Simple media upload (works 100%)
            const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
            const res = await fetch(uploadUrl, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: fileContent
            });

            if (!res.ok) {
                const err = await res.text();
                console.error('Drive PATCH error:', res.status, err);
                throw new Error(`Update failed: ${res.status}`);
            }

            // 3. Sync local session if same user logged in
            const session = JSON.parse(localStorage.getItem('roadRulesUser') || 'null');
            if (session && session.phone === phone) {
                Object.assign(session, updates);
                localStorage.setItem('roadRulesUser', JSON.stringify(session));
            }

            hideLoading();
            return true;
        } catch (e) {
            console.error('updateUserData error:', e);
            hideLoading();
            return false;
        }
    }

    // High level action: Dismiss / Revoke a paid plan (reset to Ubuntu)
    async function dismissUserPlan(phone) {
        showLoading('Kubona ifatabuguzi...');
        const ubuntuPlan = {
            plan: 'ubuntu',
            planName: 'Ubuntu Free',
            amount: 0,
            status: 'approved',
            dismissedAt: new Date().toISOString()
        };
        const res = await updateUserData(phone, { subscription: ubuntuPlan });
        hideLoading();
        return res;
    }

    // Approve a pending plan (admin action)
    async function approveUserPlan(phone, planData) {
        showLoading('Kubona ifatabuguzi...');
        const res = await updateUserData(phone, { subscription: { ...planData, status: 'approved', approvedAt: new Date().toISOString() } });
        hideLoading();
        return res;
    }

    // ========== ROAD RULES ACCESS CONTROL (plan-based permissions for Ibibazo + Imyitozo) ==========
    const PLAN_LIMITS = {
      ubuntu:   { maxExams: 1,   cooldownMs: 0,               singleAttempt: true },
      inshuro2: { maxExams: 2,   cooldownMs: 0,               singleAttempt: false },
      inshuro5: { maxExams: 5,   cooldownMs: 0,               singleAttempt: false }, // Icyumweru
      ukwezi:   { maxExams: 999, cooldownMs: 2 * 60 * 1000, singleAttempt: false }
    };

    function getCurrentPlan() {
      try {
        const raw = localStorage.getItem('roadRulesUser');
        const user = raw ? JSON.parse(raw) : null;
        const sub = user && user.subscription;
        if (sub && sub.status === 'approved' && sub.plan) {
          const p = sub.plan;
          if (PLAN_LIMITS[p]) return p;
          if (p === 'inshuro5' || p === 'icyumweru') return 'inshuro5';
          if (p === 'ukwezi') return 'ukwezi';
          if (p === 'inshuro2' || p === 'inshuro ebyiri') return 'inshuro2';
        }
      } catch (e) {}
      return 'ubuntu';
    }

    function getPendingUpgrade() {
      try {
        const raw = localStorage.getItem('roadRulesUser');
        const user = raw ? JSON.parse(raw) : null;
        return (user && user.pendingUpgrade && user.pendingUpgrade.status === 'pending') ? user.pendingUpgrade : null;
      } catch (e) { return null; }
    }

    function getPlanInfo() {
      const p = getCurrentPlan();
      return { plan: p, ...PLAN_LIMITS[p] };
    }

    // --- Imyitozo / Exam Limits ---
    function getMaxExamsAllowed() {
      const p = getCurrentPlan();
      return (PLAN_LIMITS[p] || PLAN_LIMITS.ubuntu).maxExams;
    }

    function isSingleAttemptPlan() {
      const p = getCurrentPlan();
      return !!(PLAN_LIMITS[p] || PLAN_LIMITS.ubuntu).singleAttempt;
    }

    // --- Cooldown / Rate Limit (2 min only for Ukwezi plan) ---
    function getLastExamCompletedAt() {
      try {
        const user = JSON.parse(localStorage.getItem('roadRulesUser') || 'null');
        const key = `roadRulesLastExamAt_${user && user.phone ? user.phone : 'guest'}`;
        const v = localStorage.getItem(key);
        return v ? parseInt(v, 10) : 0;
      } catch (e) { return 0; }
    }

    function setLastExamCompletedAt(ts = Date.now()) {
      try {
        const user = JSON.parse(localStorage.getItem('roadRulesUser') || 'null');
        const key = `roadRulesLastExamAt_${user && user.phone ? user.phone : 'guest'}`;
        localStorage.setItem(key, String(ts));
      } catch (e) {}
    }

    function getCooldownRemainingMs() {
      const info = getPlanInfo();
      if (info.cooldownMs === 0) return 0;
      const last = getLastExamCompletedAt();
      if (!last) return 0;
      const elapsed = Date.now() - last;
      return Math.max(0, info.cooldownMs - elapsed);
    }

    function canStartExamNow() {
      return getCooldownRemainingMs() === 0;
    }

    // How many exams the user has already completed (from Drive-backed history when available)
    function getCompletedExamCount() {
      try {
        const user = JSON.parse(localStorage.getItem('roadRulesUser') || 'null');
        const key = `roadRulesExamHistory_${user && user.phone ? user.phone : 'guest'}`;
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(arr) ? arr.length : 0;
      } catch (e) { return 0; }
    }

    function canStartMoreExams() {
      const max = getMaxExamsAllowed();
      const done = getCompletedExamCount();
      if (max >= 999) return true;
      return done < max;
    }

    // Expose everything
    window.RoadRulesAccess = {
      getCurrentPlan,
      getPlanInfo,
      getMaxExamsAllowed,
      isSingleAttemptPlan,
      getLastExamCompletedAt,
      setLastExamCompletedAt,
      getCooldownRemainingMs,
      canStartExamNow,
      getCompletedExamCount,
      canStartMoreExams,
      getPendingUpgrade,
      PLAN_LIMITS
    };

    // Also expose a couple of helpers on the old namespace for backward compatibility
    window.RoadRulesAdmin.getCurrentPlan = getCurrentPlan;
    window.RoadRulesAdmin.getPendingUpgrade = getPendingUpgrade;

    // Public helper for any page: refresh the logged-in user's data from Drive (fixes stale plan display)
    window.RoadRulesAuth = window.RoadRulesAuth || {};
    window.RoadRulesAuth.refreshMyData = async function() {
      try {
        const raw = localStorage.getItem('roadRulesUser');
        const user = raw ? JSON.parse(raw) : null;
        if (!user || !user.phone || !window.RoadRulesAdmin) return null;

        const fresh = await (window.RoadRulesAdmin.getUserDataSilent || window.RoadRulesAdmin.getUserData)(user.phone);
        if (!fresh) return null;

        const local = JSON.parse(localStorage.getItem('roadRulesUser') || '{}');
        if (fresh.subscription) local.subscription = fresh.subscription;
        if (fresh.pendingUpgrade) local.pendingUpgrade = fresh.pendingUpgrade;
        else delete local.pendingUpgrade;

        localStorage.setItem('roadRulesUser', JSON.stringify(local));
        return local;
      } catch (e) {
        console.warn('refreshMyData failed', e);
        return null;
      }
    };

// Delete a user permanently (admin action) - removes the JSON file from Drive
     async function deleteUserFile(phone) {
         if (!phone) throw new Error('Phone number required');
         try {
             const token = await getAccessToken();
             const folderId = await getFolderId(token, FOLDER_NAME);
             if (!folderId) throw new Error('UserData folder not found');

             const fileName = `${phone.replace(/[^0-9]/g, '')}.json`;
             const fileId = await findFileByName(token, folderId, fileName);
             if (!fileId) throw new Error('User file not found');

             const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                 method: 'DELETE',
                 headers: { Authorization: `Bearer ${token}` }
             });

             if (!res.ok) {
                 const err = await res.text();
                 console.error('Drive DELETE error:', res.status, err);
                 throw new Error(`Delete failed: ${res.status}`);
             }

             return true;
         } catch (e) {
             console.error('deleteUserFile error:', e);
             throw e;
         }
     }

// Expose admin API
    window.RoadRulesAdmin.listAllUserFiles = listAllUserFiles;
    window.RoadRulesAdmin.getUserData = getUserData;
    window.RoadRulesAdmin.getUserDataSilent = getUserDataSilent;
    window.RoadRulesAdmin.updateUserData = updateUserData;
    window.RoadRulesAdmin.dismissUserPlan = dismissUserPlan;
    window.RoadRulesAdmin.approveUserPlan = approveUserPlan;
    window.RoadRulesAdmin.readUserFileById = readUserFileById;
    window.RoadRulesAdmin.readUserFileByIdSilent = readUserFileByIdSilent;
    window.RoadRulesAdmin.deleteUser = deleteUserFile;

    console.log('%c[RoadRules Admin] Direct Google Drive control enabled. Use window.RoadRulesAdmin.*', 'color:#f59e0b');

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGoogleDriveAuth);
    } else {
        initGoogleDriveAuth();
    }

})();
