
// App Initialization & Routing
document.addEventListener('DOMContentLoaded', async () => {
    // UI initialize
    window.UI = createUI();
    
    // Check if logged in - with server verification to prevent Chrome bypass
    const cachedToken = localStorage.getItem('kumanya_stok_token');
    if (cachedToken) {
        window.KUMANYA_TOKEN = cachedToken;
        
        try {
            // Sunucudan token'ın hala geçerli olup olmadığını kontrol et
            const check = await API.auth.login(cachedToken);
            if (check.basarili) {
                showMainView();
                loadInitialData();
                setupEventListeners();
                updateDateTime();
                setInterval(updateDateTime, 60000);
                return;
            }
        } catch (e) {
            console.error("Auth verification failed:", e);
        }
        
        // Geçersiz veya süresi dolmuş token - temizle ve girişe yönlendir
        localStorage.removeItem('kumanya_stok_token');
        showLoginView();
    } else {
        showLoginView();
    }

    setupEventListeners();
    updateDateTime();
    setInterval(updateDateTime, 60000);
});

async function loadInitialData() {
    UI.showLoader('Stok verileri yükleniyor...');
    try {
        const data = await API.stok.oku();
        if (data.basarili) {
            window.KUMANYA_DATA = data.veri;
            UI.renderDashboard(data.veri);
            UI.renderInventory(data.veri.stok);
            UI.renderActivity(data.veri.sonHareketler);
        }
    } catch (err) {
        UI.showToast('Veriler yüklenemedi: ' + err.message, 'error');
    } finally {
        UI.hideLoader();
    }
}

function showMainView() {
    document.getElementById('login-view').classList.remove('active');
    document.getElementById('main-view').classList.add('active');
}

function showLoginView() {
    document.getElementById('main-view').classList.remove('active');
    document.getElementById('login-view').classList.add('active');
}

function setupEventListeners() {
    // Login
    document.getElementById('login-btn').onclick = handleLogin;
    document.getElementById('login-key').onkeypress = (e) => {
        if (e.key === 'Enter') handleLogin();
    };

    // Password view toggle
    document.getElementById('toggle-password').onclick = () => {
        const input = document.getElementById('login-key');
        const icon = document.querySelector('#toggle-password i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('far', 'fas');
        } else {
            input.type = 'password';
            icon.classList.replace('fas', 'far');
        }
    };

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = () => {
            const tab = item.dataset.tab;
            if (tab) switchTab(tab);
        };
    });

    // FAB / Scanner
    document.getElementById('scanner-fab').onclick = () => {
        UI.showScannerModal();
    };

    // Search
    document.getElementById('inventory-search').oninput = (e) => {
        const query = e.target.value.toLowerCase();
        UI.filterInventory(query);
    };

    // Quick Filters
    document.getElementById('btn-show-all').onclick = () => switchTab('stok');
    document.getElementById('btn-show-critical').onclick = () => {
        switchTab('stok');
        UI.filterInventory('', 'critical');
    };
    
    // Logout
    document.getElementById('logout-btn').onclick = () => {
        localStorage.removeItem('kumanya_stok_token');
        window.location.reload();
    };

    // Reset Cache
    document.getElementById('reset-storage-btn').onclick = () => {
        if (confirm('Tüm uygulama verileri ve şifre sıfırlanacak. Emin misiniz?')) {
            localStorage.clear();
            if ('serviceWorker' in navigator) {
                caches.keys().then(names => {
                    for (let name of names) caches.delete(name);
                });
            }
            window.location.reload();
        }
    };
}

async function handleLogin() {
    const keyInput = document.getElementById('login-key');
    const key = keyInput.value;
    
    if (!key || key.length < 4) {
        keyInput.parentElement.classList.add('shake');
        setTimeout(() => keyInput.parentElement.classList.remove('shake'), 400);
        return;
    }

    UI.showLoader('Doğrulanıyor...');
    try {
        const res = await API.auth.login(key);
        if (res.basarili) {
            localStorage.setItem('kumanya_stok_token', key);
            window.KUMANYA_TOKEN = key;
            showMainView();
            loadInitialData();
            UI.showToast('Başarıyla giriş yapıldı', 'success');
        } else {
            keyInput.parentElement.classList.add('shake');
            setTimeout(() => keyInput.parentElement.classList.remove('shake'), 400);
            UI.showToast('Hatalı giriş anahtarı', 'error');
        }
    } catch (err) {
        UI.showToast('Giriş hatası: ' + err.message, 'error');
    } finally {
        UI.hideLoader();
    }
}

function switchTab(tabId) {
    // Update Nav
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.dataset.tab === tabId) item.classList.add('active');
        else item.classList.remove('active');
    });

    // Update Content
    document.querySelectorAll('.tab-content').forEach(content => {
        if (content.id === tabId + '-view') content.classList.add('active');
        else content.classList.remove('active');
    });

    // Special logic for tabs
    if (tabId === 'analiz') UI.renderAnalysis(window.KUMANYA_DATA);
}

function updateDateTime() {
    const el = document.getElementById('current-date');
    if (!el) return;
    const now = new Date();
    const options = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    el.innerText = now.toLocaleDateString('tr-TR', options);
}
