/* Main Application Logic and Event Handlers */

document.addEventListener('DOMContentLoaded', async () => {
    // Initial UI Setup
    if (window.lucide) lucide.createIcons();
    
    // Auth Check
    const girisYapildi = localStorage.getItem('girisYapildi') === 'true';
    const token = localStorage.getItem('userToken');
    if (girisYapildi && token) {
        await uygulamaAc(token);
    }

    // --- NAVIGATION ---
    const navItems = document.querySelectorAll('.nav-item');
    const viewSections = document.querySelectorAll('.view-section');
    const bottomNav = document.querySelector('.bottom-nav');

    navItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            const targetId = item.getAttribute('data-target');
            if (!targetId) return;

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            viewSections.forEach(section => section.classList.remove('active'));
            const targetView = document.getElementById(targetId);
            if (targetView) {
                targetView.classList.add('active');
                if (window.lucide) lucide.createIcons();
                
                // Section-specific loading
                if (targetId === 'view-home' || targetId === 'view-inventory') await updateUI();
                if (targetId === 'view-analytics') await updateAnalytics();
                if (targetId === 'view-invoice') {
                    const activeTab = document.querySelector('.tab-btn.active');
                    if (activeTab && activeTab.getAttribute('data-tab') === 'tab-stok-say') {
                        await renderStokSayimList();
                    }
                }
            }
        });
    });

    // --- TABS ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => { c.classList.remove('active'); c.style.display = 'none'; });
            btn.classList.add('active');
            const targetTab = document.getElementById(btn.getAttribute('data-tab'));
            if (targetTab) {
                targetTab.classList.add('active');
                targetTab.style.display = 'block';
                if (targetTab.id === 'tab-stok-say') renderStokSayimList();
                if (targetTab.id === 'tab-gecmis') renderGecmisList();
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
                const check = await apiCall('tokenKontrol', { token: pass });
                if (check && check.basarili) {
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
                    loginError.classList.replace('opacity-0', 'opacity-100');
                }
            } finally {
                btnLogin.disabled = false;
                btnLogin.innerHTML = 'Giriş Yap';
            }
        });
    }

    // --- SHIP NAME ---
    const shipNameInput = document.getElementById('ship-name-input');
    if (shipNameInput) {
        const saved = localStorage.getItem('shipName');
        if (saved) shipNameInput.innerText = saved;
        shipNameInput.addEventListener('blur', () => localStorage.setItem('shipName', shipNameInput.innerText));
    }

    // --- CAMERA / OCR ---
    const cameraInput = document.getElementById('camera-input');
    if (cameraInput) {
        cameraInput.addEventListener('change', async (e) => {
            console.log("[OCR] Dosya seçildi, analiz başlatılıyor...");
            const file = e.target.files[0];
            if (!file) return;

            const loader = document.getElementById('fatura-loader');
            if (loader) loader.classList.add('active');

            try {
                const base64 = await compressImage(file, 1024, 0.6);
                const result = await apiCall('faturaOku', { imageBase64: base64 });
                if (result && result.urunler) {
                    renderScannedItems(result.urunler, "success", "Fatura işlendi");
                } else {
                    renderScannedItems([], "error", result.hata || "Okuma başarısız");
                }
            } catch (err) {
                showToast("Analiz hatası: " + err.message, "error");
            } finally {
                if (loader) loader.classList.remove('active');
                cameraInput.value = '';
            }
        });
    }

    // --- STOK EKLE (OCR SONRASI) ---
    const btnStokaEkle = document.getElementById('btn-stoka-ekle');
    if (btnStokaEkle) {
        btnStokaEkle.addEventListener('click', async () => {
            const items = prepareStokEklePayload(); // This would be in inventory.js if possible, or here
            if (items.length === 0) return;

            try {
                btnStokaEkle.disabled = true;
                btnStokaEkle.textContent = 'Kaydediliyor...';
                await apiCall('stokEkle', { urunler: items, tip: 'GIRIS' });
                showToast("Stoka eklendi!", "success");
                document.querySelector('.scanned-items').classList.add('hidden');
                await updateUI();
                // Go to home
                document.querySelector('[data-target="view-home"]').click();
            } catch(err) {
                showToast("Hata: " + err.message, "error");
            } finally {
                btnStokaEkle.disabled = false;
                btnStokaEkle.textContent = 'Stoka Ekle';
            }
        });
    }

    // --- DOWNLOAD SIPARIS ---
    const btnDownloadSiparis = document.getElementById('btn-download-siparis');
    if (btnDownloadSiparis) {
        btnDownloadSiparis.addEventListener('click', () => {
            const kritikler = window.globalUrunler.filter(u => u.takip && u.miktar <= (u.minStok || 0));
            if (kritikler.length === 0) {
                showToast("Sipariş listesi şu an boş (Kritik ürün yok).", "info");
                return;
            }

            const printWindow = window.open('', '_blank');
            const date = new Date().toLocaleDateString('tr-TR');
            const shipName = localStorage.getItem('shipName') || 'KUMANYASTOK';

            let html = `
                <html>
                <head>
                    <title>Sipariş Listesi - ${date}</title>
                    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
                    <style>
                        body { background: white; color: black; padding: 40px; font-family: sans-serif; }
                        .header { border-bottom: 2px solid black; margin-bottom: 20px; padding-bottom: 10px; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                        th { background-color: #f2f2f2; }
                    </style>
                </head>
                <body>
                    <div class="header flex justify-between items-end">
                        <div>
                            <h1 class="text-2xl font-bold uppercase">${shipName}</h1>
                            <p class="text-sm">Eksik Ürünler / Sipariş Listesi</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold">${date}</p>
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Ürün Adı</th>
                                <th>Mevcut Stok</th>
                                <th>Birim</th>
                                <th>Sipariş Miktarı</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${kritikler.map(u => `
                                <tr>
                                    <td class="font-bold">${u.ad}</td>
                                    <td>${u.miktar}</td>
                                    <td>${u.birim}</td>
                                    <td style="width: 150px;"></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="mt-8 text-xs text-gray-500">
                        * Bu liste Kumanya Stok sistemi tarafından otomatik oluşturulmuştur.
                    </div>
                    <script>
                        setTimeout(() => { window.print(); }, 300);
                    <\/script>
                </body>
                </html>
            `;
            printWindow.document.write(html);
            printWindow.document.close();
        });
    }

    // --- ACTIVITY UNDO DELEGATION ---
    const homeActivityList = document.getElementById('home-activity-list');
    if (homeActivityList) {
        homeActivityList.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-geri-al')) {
                const id = e.target.dataset.id;
                stokGeriAl(id, e.target);
            }
        });
    }
});

/**
 * Switch app state to open
 */
async function uygulamaAc(token) {
    localStorage.setItem('userToken', token);
    localStorage.setItem('girisYapildi', 'true');
    
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.getElementById('view-home').classList.add('active');
    
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) bottomNav.style.display = 'flex';
    
    await updateUI();
}

/**
 * Prepare items for stock update from scanned list
 */
function prepareStokEklePayload() {
    const items = [];
    document.querySelectorAll('.checklist li').forEach(li => {
        const checkbox = li.querySelector('.urun-onay-check');
        if (checkbox && checkbox.checked) {
            const ad = li.querySelector('.o-ad').value;
            const faturaMiktar = li.querySelector('.o-miktar').value;
            const birimDetay = li.querySelector('.o-birim-detay').value;
            const eslestirilen_alias = li.querySelector('.o-ad').dataset.orijinal; // Renamed from originalName
            const inputEskiStok = li.querySelector('.o-eski-stok');
            
            // Find current product to get display unit
            const product = Alias.findMatch(ad, window.globalUrunler);
            const displayUnit = product ? product.birim : "ADET";
            
            const artis = Inventory.calculateArtis(faturaMiktar, birimDetay, displayUnit);

            items.push({
                ad: ad,
                id: product ? product.id : '',
                miktar: artis,
                fatura_miktar: Utils.safeParseFloat(faturaMiktar),
                birim_detay: birimDetay,
                birim: displayUnit,
                kategori: product ? product.kategori : 'diger',
                eskiStok: inputEskiStok && inputEskiStok.value ? Utils.safeParseFloat(inputEskiStok.value) : (product ? product.miktar : undefined),
                notlar: 'Fatura Girişi',
                eslestirilen_alias: eslestirilen_alias // Use the renamed variable
            });
        }
    });
    return items;
}

/**
 * Image compression utility
 */
function compressImage(file, maxWidthOrHeight, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > h) { if (w > maxWidthOrHeight) { h *= maxWidthOrHeight / w; w = maxWidthOrHeight; } }
                else { if (h > maxWidthOrHeight) { w *= maxWidthOrHeight / h; h = maxWidthOrHeight; } }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}
/**
 * Change product field (category, tracking)
 */
window.changeUrunAlan = async function (urunAdi, alan, deger, element) {
    try {
        if (element) element.disabled = true;
        await apiCall('takipGuncelle', { urunAdi, alan, deger });
        showToast("Güncellendi", "success");
        await updateUI();
    } catch (err) {
        showToast("Güncelleme hatası", "error");
    } finally {
        if (element) element.disabled = false;
    }
};

/**
 * Logout
 */
window.logoutApp = function () {
    localStorage.removeItem('girisYapildi');
    localStorage.removeItem('userToken');
    window.location.reload();
};

/**
 * Reset specific product history
 */
window.resetUrun = async function () {
    const urunSec = document.getElementById('settings-urun-sec');
    const ad = urunSec.value;
    const miktar = parseFloat(document.getElementById('settings-baslangic-miktar').value) || 0;

    if (!ad) { showToast("Lütfen ürün seçin", "warning"); return; }
    if (!confirm(`${ad} geçmişi silinecek ve stok ${miktar} yapılacak. Emin misiniz?`)) return;

    try {
        await apiCall('urunGecmisiSifirla', { urunAdi: ad, baslangicMiktar: miktar });
        showToast("Ürün sıfırlandı", "success");
        await updateUI();
    } catch (e) { showToast("Hata oluştu", "error"); }
};

/**
 * Reset entire system
 */
window.resetApp = async function () {
    const code = document.getElementById('settings-reset-code').value;
    if (code !== 'SIFIRLA') { showToast("Onay kodu hatalı", "error"); return; }
    if (!confirm('TÜM SİSTEM SIFIRLANACAK! Bu işlem geri alınamaz. Emin misiniz?')) return;

    try {
        await apiCall('tumSistemiSifirla', { onayKodu: 'SIFIRLA' });
        showToast("Sistem sıfırlandı", "success");
        window.location.reload();
    } catch (e) { showToast("Sıfırlama hatası", "error"); }
};

/**
 * Undo movement
 */
window.stokGeriAl = async function (id, element) {
    if (!confirm('Bu işlemi geri almak istediğinize emin misiniz?')) return;
    try {
        if (element) element.disabled = true;
        await apiCall('hareketGeriAl', { id });
        showToast("İşlem geri alındı", "success");
        await updateUI();
    } catch (e) { showToast("Hata oluştu", "error"); }
};
