/* Main Application Logic and Event Handlers */

document.addEventListener('DOMContentLoaded', () => {
    // API ve Config yüklenmesi için kısa bir süre tanı (Mobil cihazlar için kritik)
    setTimeout(async () => {
        // Initial UI Setup
        if (window.lucide) lucide.createIcons();
        
        // Auth Check
        const girisYapildi = localStorage.getItem('girisYapildi') === 'true';
        const token = localStorage.getItem('kumanya_stok_token');
        if (girisYapildi && token) {
            await uygulamaAc(token);
        } else {
            // Logout state: show login screen
            document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
            const loginView = document.getElementById('login-view');
            if (loginView) loginView.classList.add('active');
            
            const bottomNav = document.querySelector('.bottom-nav');
            if (bottomNav) bottomNav.style.display = 'none';
        }
    }, 150);

    // --- NAVIGATION ---
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content'); // Fix: Target tab-content inside main-view

    navItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            const targetId = item.getAttribute('data-tab');
            if (!targetId) return;

            // Update Nav UI
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Switch Tabs (DO NOT hide main-view)
            tabContents.forEach(content => content.classList.remove('active'));
            const targetContent = document.getElementById(targetId + '-view');
            if (targetContent) {
                targetContent.classList.add('active');
                if (window.lucide) lucide.createIcons();
                
                // Section-specific loading
                try {
                    if (targetId === 'dashboard' || targetId === 'stok') {
                        if (typeof window.updateUI === 'function') await window.updateUI();
                    }
                    if (targetId === 'analiz') {
                        if (typeof window.updateAnalytics === 'function') await window.updateAnalytics();
                    }
                } catch (err) {
                    console.error("Tab yükleme hatası:", err);
                }
            }
        });
    });

    // --- LOGIN ---
    const btnLogin = document.getElementById('btn-login');
    const loginPassword = document.getElementById('login-password');
    const loginError = document.getElementById('login-error');

    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            const pass = loginPassword.value;
            if (!pass) return;

            try {
                btnLogin.disabled = true;
                btnLogin.innerHTML = '🔄 Kontrol Ediliyor...';
                const result = await apiCall('tokenKontrol', { token: pass });
                if (result && result.basarili) {
                    await uygulamaAc(pass);
                } else {
                    throw new Error("Geçersiz şifre");
                }
            } catch (error) {
                const loginCard = document.getElementById('login-card');
                if (loginCard) {
                    loginCard.classList.add('shake');
                    setTimeout(() => loginCard.classList.remove('shake'), 500);
                }
                if (loginError) {
                    loginError.style.visibility = 'visible';
                    loginError.style.opacity = '1';
                }
                console.error("Login hatası:", error);
            } finally {
                btnLogin.disabled = false;
                btnLogin.innerHTML = 'GİRİŞ YAP';
            }
        });

        // Allow Enter key
        loginPassword?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') btnLogin.click();
        });
    }

    // --- LOGOUT ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.logoutApp();
        });
    }

    // --- SETTINGS ---
    const resetStorageBtn = document.getElementById('reset-storage-btn');
    if (resetStorageBtn) {
        resetStorageBtn.addEventListener('click', () => {
            localStorage.clear();
            window.location.reload();
        });
    }
});

/**
 * Switch app state to open
 */
async function uygulamaAc(token) {
    localStorage.setItem('kumanya_stok_token', token);
    localStorage.setItem('girisYapildi', 'true');
    
    // Switch View Sections (Login -> Main)
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    const mainView = document.getElementById('main-view');
    if (mainView) mainView.classList.add('active');
    
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) bottomNav.style.display = 'flex';
    
    // Ensure Dashboard Tab is active
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const dashboardView = document.getElementById('dashboard-view');
    if (dashboardView) dashboardView.classList.add('active');
    
    // Initial data load
    if (typeof window.updateUI === 'function') {
        await window.updateUI();
    } else {
        setTimeout(() => { if(window.updateUI) window.updateUI(); }, 500);
    }
}

/**
 * Global Logout
 */
window.logoutApp = function () {
    localStorage.removeItem('girisYapildi');
    localStorage.removeItem('kumanya_stok_token');
    window.location.reload();
};
