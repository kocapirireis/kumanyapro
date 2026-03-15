/**
 * Gemi Kumanya Stok - Main App Logic
 * Version: 4.0 (Restore)
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("App Initializing...");
    
    // Initialize Lucide Icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Check Login State
    const token = localStorage.getItem('userToken');
    if (token) {
        uygulamaAc(token);
    } else {
        // LOCAL TEST İÇİN ŞİFREYİ KALDIR (Kullanıcı talebi)
        // Normalde login ekranı görünür, ancak kullanıcı "şifreyi kaldır öyle gir" dediği için
        // Otomatik olarak uygulamayı açıyoruz.
        setTimeout(() => {
            console.log("Local Test: Otomatik giriş yapılıyor...");
            uygulamaAc('kocareis1987'); // Varsayılan token
        }, 500);
    }

    initEventListeners();
});

/**
 * Main App Initializer
 */
async function uygulamaAc(token) {
    try {
        localStorage.setItem('userToken', token);
        
        // UI Layout adjust
        document.getElementById('view-login').classList.remove('active');
        document.querySelector('.bottom-nav').style.display = 'flex';
        document.getElementById('view-home').classList.add('active');

        // Load Data
        await refreshAllData();

    } catch (error) {
        console.error("Uygulama açılırken hata:", error);
        showToast("Veriler yüklenemedi: " + error.message, "error");
    }
}

/**
 * Global Event Listeners
 */
function initEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            switchView(target);
            
            // Update nav active state
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Invoice Sub-Tabs
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Tab content toggle
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
                content.classList.add('hidden');
            });
            const activeTab = document.getElementById(tabId);
            activeTab.classList.remove('hidden');
            activeTab.classList.add('active');

            // Tab button state
            document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Tab specific logic
            if (tabId === 'tab-stok-say') {
                renderStokSayimList();
            } else if (tabId === 'tab-gecmis') {
                loadGecmis();
            }
        });
    });

    // Login logic
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            const pass = document.getElementById('login-password').value;
            if (!pass) return;
            
            try {
                btnLogin.disabled = true;
                btnLogin.innerText = "Giriş Yapılıyor...";
                
                const valid = await apiCall('tokenKontrol', { token: pass });
                if (valid) {
                    uygulamaAc(pass);
                } else {
                    showLoginError();
                }
            } catch (error) {
                showToast("Bağlantı hatası: " + error.message, "error");
            } finally {
                btnLogin.disabled = false;
                btnLogin.innerText = "Giriş Yap";
            }
        });
    }

    // Camera Input
    const camInput = document.getElementById('camera-input');
    if (camInput) {
        camInput.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                await handleFaturaUpload(file);
            }
        });
    }

    // Stock Actions
    document.getElementById('btn-stoka-ekle')?.addEventListener('click', handleStokaEkle);
    document.getElementById('btn-stok-say-kaydet')?.addEventListener('click', handleStokSayimKayit);
    document.getElementById('btn-fotograf-temizle')?.addEventListener('click', clearFaturaPreview);

    // Settings
    document.getElementById('btn-show-product-modal')?.addEventListener('click', showProductModal);
    document.getElementById('btn-show-reset-modal')?.addEventListener('click', showResetModal);
    document.getElementById('btn-reset-product')?.addEventListener('click', handleProductReset);
    document.getElementById('btn-reset-all')?.addEventListener('click', handleSystemReset);

    // Reset Confirm Input logic
    const resetInput = document.getElementById('modal-reset-confirm');
    if (resetInput) {
        resetInput.addEventListener('input', (e) => {
            const btn = document.getElementById('btn-reset-all');
            if (e.target.value === 'SIFIRLA') {
                btn.disabled = false;
                btn.style.opacity = '1';
            } else {
                btn.disabled = true;
                btn.style.opacity = '0.5';
            }
        });
    }
}

/**
 * View Switcher
 */
function switchView(targetId) {
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.remove('active');
    });
    
    const target = document.getElementById(targetId);
    if (target) {
        target.classList.add('active');
        
        // Refresh analysis when entering view-analytics
        if (targetId === 'view-analytics') {
            loadAnalytics();
        }
    }
    
    // Auto-scroll to top
    window.scrollTo(0, 0);
}

/**
 * Data Refresh logic
 */
async function refreshAllData() {
    try {
        const data = await apiCall('stokOku');
        if (data) {
            window.globalUrunler = data;
            renderInventoryList(data);
            updateDashboard(data);
            updateSettingsFields(data);
        }
    } catch (error) {
        console.error("Veri yenileme hatası:", error);
    }
}

/**
 * Fatura Yükleme İşlemi
 */
async function handleFaturaUpload(file) {
    const loader = document.getElementById('fatura-loader');
    const scannedContainer = document.querySelector('.scanned-items');
    
    loader.classList.add('active');
    
    try {
        // Optimize image
        const base64 = await resizeImage(file, 1200);
        
        // API Call
        const result = await apiCall('faturaOku', { imageBase64: base64 });
        
        if (result && result.urunler) {
            window.lastScannedItems = result.urunler;
            renderScannedItems(result.urunler);
            scannedContainer.classList.remove('hidden');
            document.getElementById('son-tarananlar-header').classList.remove('hidden');
            showToast("Fatura başarıyla okundu.", "success");
        }
    } catch (error) {
        showToast("Fatura okunamadı: " + error.message, "error");
    } finally {
        loader.classList.remove('active');
    }
}

/**
 * Stoka Ekle
 */
async function handleStokaEkle() {
    const checkedItems = [];
    document.querySelectorAll('.scanned-checkbox:checked').forEach(cb => {
        const index = cb.getAttribute('data-index');
        const item = window.lastScannedItems[index];
        checkedItems.push(item);
    });

    if (checkedItems.length === 0) {
        showToast("Lütfen eklenecek ürünleri seçin.", "warning");
        return;
    }

    try {
        const btn = document.getElementById('btn-stoka-ekle');
        btn.disabled = true;
        btn.innerText = "Kaydediliyor...";

        await apiCall('stokEkle', { urunler: checkedItems });
        
        showToast(`${checkedItems.length} ürün stoka eklendi.`, "success");
        clearFaturaPreview();
        await refreshAllData();
        
    } catch (error) {
        showToast("Stok kaydı başarısız: " + error.message, "error");
    } finally {
        const btn = document.getElementById('btn-stoka-ekle');
        btn.disabled = false;
        btn.innerText = "Stoka Ekle";
    }
}

/**
 * Stok Sayım Kaydet
 */
async function handleStokSayimKayit() {
    const updates = [];
    document.querySelectorAll('.sayim-input').forEach(input => {
        const val = input.value;
        if (val !== "") {
            updates.push({
                ad: input.getAttribute('data-ad'),
                miktar: parseFloat(val)
            });
        }
    });

    if (updates.length === 0) {
        showToast("Herhangi bir değişiklik yapmadınız.", "warning");
        return;
    }

    try {
        const btn = document.getElementById('btn-stok-say-kaydet');
        btn.disabled = true;
        btn.innerText = "Kaydediliyor...";

        await apiCall('stokEkle', { urunler: updates, mod: 'overwrite' });
        
        showToast("Stok sayımı kaydedildi.", "success");
        await refreshAllData();
        renderStokSayimList(); // Refresh list
        
    } catch (error) {
        showToast("Hata: " + error.message, "error");
    } finally {
        const btn = document.getElementById('btn-stok-say-kaydet');
        btn.disabled = false;
        btn.innerText = "Stok Sayımını Kaydet";
    }
}

/**
 * Utils
 */
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = msg;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function clearFaturaPreview() {
    document.querySelector('.scanned-items').classList.add('hidden');
    document.getElementById('son-tarananlar-header').classList.add('hidden');
    window.lastScannedItems = null;
}

function showLoginError() {
    const err = document.getElementById('login-error');
    err.style.visibility = 'visible';
    err.classList.remove('opacity-0');
}
