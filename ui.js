/* UI Rendering and Toast Logic */

window.inventoryFilter = 'TRACKED'; // Default: Tracked products

window.setInventoryFilter = function(filter, element) {
    window.inventoryFilter = filter;
    document.querySelectorAll('#view-inventory .pill-btn').forEach(opt => opt.classList.remove('active'));
    if (element) element.classList.add('active');
    if (window.renderInventoryList) {
        window.renderInventoryList(window.globalUrunler);
    }
};

/**
 * Global Toast Function
 */
window.showToast = function(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'alert-circle';
    if (type === 'warning') icon = 'alert-triangle';

    toast.innerHTML = `
        <i data-lucide="${icon}" style="width:18px; height:18px;"></i>
        <span></span>
        <div class="toast-progress" style="animation-duration: ${duration}ms"></div>
    `;
    toast.querySelector('span').textContent = message;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 400);
    }, duration);
}

/**
 * Update the entire UI
 */
window.updateUI = async function () {
    try {
        const data = await apiCall('stokOku');
        if (!data) return;

        window.globalUrunler = data.urunler || [];
        window.currentStokMap = {};
        window.currentIdMap = {};
        (data.urunler || []).forEach(u => {
            window.currentStokMap[u.ad] = u.miktar || 0;
            if (u.id) window.currentIdMap[u.id] = u.miktar || 0;
        });

        // Dashboard summaries
        const totalUrunCount = document.getElementById('total-urun-count');
        const lowStokCount = document.getElementById('low-stok-count');
        if (totalUrunCount) totalUrunCount.innerHTML = `${data.urunler.length} <span class="text-xs font-normal">Kalem</span>`;

        const kritikler = data.urunler.filter(u => u.takip && u.miktar <= (u.minStok || 0));
        if (lowStokCount) lowStokCount.textContent = kritikler.length;

        // Banners
        const criticalBanner = document.getElementById('critical-stock-banner');
        const criticalTitle = document.getElementById('critical-stock-title');
        const criticalList = document.getElementById('critical-stock-list');
        
        if (criticalBanner && criticalTitle && criticalList) {
            if (kritikler.length > 0) {
                criticalBanner.classList.remove('hidden');
                criticalTitle.textContent = `Kritik Seviye: ${kritikler.length} Ürün`;
                const names = kritikler.map(u => u.ad).join(', ');
                criticalList.textContent = `${names} kritik stok seviyesine ulaştı.`;
            } else {
                criticalBanner.classList.add('hidden');
            }
        }

        // Section updates
        const criticalSection = document.getElementById('critical-stock-section');
        const criticalContainer = document.getElementById('critical-items-container');

        try {
            const analizData = await apiCall('analizHesapla');
            const lifeLimitedItems = analizData.filter(a => parseFloat(a.kacAyYeter) < 1);

            if (criticalSection && criticalContainer) {
                if (lifeLimitedItems.length > 0) {
                    criticalSection.classList.remove('hidden');
                    criticalContainer.innerHTML = lifeLimitedItems.map(item => {
                        const val = parseFloat(item.kacAyYeter);
                        const gun = Math.round(val * 30);
                        const surLabel = val >= 12 ? `${(val/12).toFixed(1)} yıl` : (gun < 1 ? "Bitti" : `${gun} gün`);
                        return `
                        <div class="glass flex justify-between items-center" style="border-left: 4px solid var(--danger); margin-bottom: 10px; border-radius: 12px; padding: 12px 16px;">
                            <div class="flex flex-col gap-1">
                                <h4 class="text-sm font-bold white">${item.urunAdi}</h4>
                                <p class="text-[11px] text-muted">Mevcut: <span class="white font-semibold">${item.mevcutStok} ${item.birim || ''}</span></p>
                            </div>
                            <div class="text-right flex flex-col gap-1">
                                <div class="text-lg font-extrabold text-danger">${surLabel}</div>
                                <div class="text-[10px] text-muted uppercase">Kalan Süre</div>
                            </div>
                        </div>`;
                    }).join('');
                } else {
                    criticalSection.classList.add('hidden');
                }
            }
        } catch (e) {
            console.warn("Analytics failed:", e);
        }

        // Recent Activity
        const activityList = document.getElementById('home-activity-list');
        if (activityList && data.sonHareketler) {
            window.tumHareketler = data.sonHareketler;
            renderHomeActivity(window.hareketlerGenisletildi ? window.tumHareketler.length : 5);
        }

        // Settings 
        const settingsUrunSec = document.getElementById('settings-urun-sec');
        if (settingsUrunSec) {
            const currentVal = settingsUrunSec.value;
            settingsUrunSec.innerHTML = '<option value="">-- Ürün Seçin --</option>' +
                data.urunler.map(u => `<option value="${u.ad}" ${u.ad === currentVal ? 'selected' : ''}>${u.ad}</option>`).join('');
        }
        renderSettingsActivity(window.tumHareketler);

        // Inventory List
        renderInventoryList(window.globalUrunler);
    } catch (err) {
        console.error('[updateUI] Hata:', err);
        showToast("Veriler yüklenirken bir sorun oluştu.", "error");
    }
};

/**
 * Render activity in settings page
 */
window.renderSettingsActivity = function (hareketler) {
    const container = document.getElementById('settings-recent-activity');
    if (!container || !hareketler) return;

    const sonFaturaHareketleri = hareketler.filter(h => h.tip === 'GIRIS').slice(0, 5);
    if (sonFaturaHareketleri.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-xs text-muted">Son fatura hareketi bulunamadı.</div>';
        return;
    }

    container.innerHTML = sonFaturaHareketleri.map(h => {
        const date = new Date(h.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        return `
            <div class="settings-activity-item flex justify-between items-center">
                <div class="flex-col">
                    <div class="text-sm font-bold text-white">${h.urun_adi || h.urunAdi}</div>
                    <div class="text-[10px] text-muted">${date} • ${h.miktar} ${h.birim || ''}</div>
                </div>
                <button class="text-xs text-accent font-bold" onclick="stokGeriAl('${h.id}', this)">Geri Al</button>
            </div>
        `;
    }).join('');
};

/**
 * Render home activity list
 */
window.renderHomeActivity = function (limit) {
    const activityList = document.getElementById('home-activity-list');
    if (!activityList || !window.tumHareketler) return;
    activityList.innerHTML = '';
    const liste = window.tumHareketler.slice(0, limit);
    liste.forEach(h => {
        const date = new Date(h.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        const item = document.createElement('div');
        item.className = 'activity-item';
        const tipClass = h.tip === 'GIRIS' ? 'text-success' : (h.tip === 'CIKIS' ? 'text-danger' : 'text-primary');
        const icon = h.tip === 'GIRIS' ? 'download' : (h.tip === 'CIKIS' ? 'upload' : 'plus-circle');
        const tipLabel = h.tip === 'GIRIS' ? 'Giriş' : (h.tip === 'CIKIS' ? 'Çıkış' : h.tip === 'BASLANGIC' ? 'Başlangıç' : h.tip === 'SAYIM' ? 'Sayım' : h.tip);
        item.innerHTML = `
            <div class="activity-icon bg-${h.tip === 'CIKIS' ? 'danger' : 'success'}-light text-${h.tip === 'CIKIS' ? 'danger' : 'success'}">
                <i data-lucide="${icon}"></i>
            </div>
            <div class="activity-details">
                <h4>${h.urunAdi}</h4>
                <p>${date} • ${tipLabel}</p>
            </div>
            <div class="flex-col text-right">
                <div class="activity-amount ${tipClass}">${h.miktar} ${h.birim || ''}</div>
                <button class="text-xs text-muted mt-1 btn-geri-al" data-id="${h.id}" style="background:none;border:none;cursor:pointer;">Geri Al</button>
            </div>
        `;
        activityList.appendChild(item);
    });
    if (window.lucide) lucide.createIcons();
};

/**
 * Render main inventory list with category grouping
 */
window.renderInventoryList = function (urunler) {
    if (!urunler) return;
    const inventoryList = document.getElementById('inventory-list');
    const searchInput = document.querySelector('#view-inventory .search-bar input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";

    if (inventoryList) {
        inventoryList.innerHTML = '';
        const kategoriler = {
            "et urunleri": "Et Ürünleri",
            "kahvaltilik": "Kahvaltılık",
            "kuru gida": "Kuru Gıda",
            "temizlik": "Temizlik",
            "diger": "Diğer"
        };

        Object.keys(kategoriler).forEach(key => {
            const grupUrunler = urunler.filter(u => {
                const uKat = (u.kategori || '').toLowerCase();
                const isMatch = (uKat === key) || (!kategoriler[uKat] && key === 'diger');
                const isSearchMatch = u.ad.toLowerCase().includes(searchTerm);
                let isFilterMatch = true;
                if (window.inventoryFilter === 'TRACKED') isFilterMatch = u.takip;
                else if (window.inventoryFilter === 'UNTRACKED') isFilterMatch = !u.takip;
                return isMatch && isSearchMatch && isFilterMatch;
            });

            if (grupUrunler.length > 0) {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'category-group';
                groupDiv.innerHTML = `<div class="category-header">${kategoriler[key]}</div>`;
                grupUrunler.forEach(u => {
                    const card = document.createElement('div');
                    card.className = 'inventory-card glass';
                    card.innerHTML = `
                        <div class="inv-main">
                            <h4 class="text-sm font-bold ${u.miktar <= (u.minStok || 0) ? 'text-danger' : ''}">${u.ad}</h4>
                            <div class="text-xs text-muted">${u.miktar} ${u.birim || ''}</div>
                        </div>
                        <div class="inv-controls">
                            <select class="cat-select" onchange="changeUrunAlan('${u.ad}', 'kategori', this.value, this)">
                                ${Object.keys(kategoriler).map(k => `<option value="${k}" ${u.kategori === k ? 'selected' : ''}>${kategoriler[k]}</option>`).join('')}
                            </select>
                            <label class="switch">
                                <input type="checkbox" ${u.takip ? 'checked' : ''} onchange="changeUrunAlan('${u.ad}', 'takip', this.checked, this)">
                                <span class="slider"></span>
                            </label>
                        </div>`;
                    groupDiv.appendChild(card);
                });
                inventoryList.appendChild(groupDiv);
            }
        });
        if (window.lucide) lucide.createIcons();
    }
};

/**
 * Render stock counting list
 */
window.renderStokSayimList = async function () {
    const container = document.getElementById('stok-sayim-items');
    if (!container) return;

    let urunlerData = window.globalUrunler;
    if (!urunlerData || urunlerData.length === 0) {
        const data = await apiCall('stokOku');
        urunlerData = data ? data.urunler : [];
    }

    const takipUrunler = urunlerData.filter(u => u.takip);
    container.innerHTML = takipUrunler.map(u => `
        <div class="t-sayim-row" data-ad="${u.ad}">
            <span class="font-bold text-sm">${u.ad}</span>
            <span class="text-center text-xs text-muted">${u.miktar} ${u.birim || ''}</span>
            <input type="number" class="o-sayim-val" placeholder="Yeni miktar">
        </div>
    `).join('');
};

/**
 * Render history list (grouped by time)
 */
window.renderGecmisList = async function () {
    const container = document.getElementById('gecmis-fatura-list');
    const detayContainer = document.getElementById('gecmis-fatura-detay');
    if (!container) return;

    try {
        const hareketlerRes = await sbFetch('/rest/v1/hareketler?select=*&order=tarih.desc');
        const girisler = hareketlerRes.filter(h => h.tip === 'GIRIS');
        
        if (girisler.length === 0) {
            container.innerHTML = '<div class="py-6 text-center text-muted">Fatura kaydı bulunamadı.</div>';
            return;
        }

        const gruplar = [];
        let mevcutGrup = null;
        girisler.forEach(h => {
            if (!mevcutGrup || (new Date(mevcutGrup.tarih) - new Date(h.tarih)) > 120000) {
                mevcutGrup = { tarih: h.tarih, urunler: [] };
                gruplar.push(mevcutGrup);
            }
            mevcutGrup.urunler.push(h);
        });

        container.innerHTML = gruplar.map((g, i) => `
            <div class="glass mb-2 p-3 cursor-pointer" onclick="renderGecmisDetay(${i})">
                <div class="text-sm font-bold">📦 Fatura Girişi</div>
                <div class="text-xs text-muted">${new Date(g.tarih).toLocaleString('tr-TR')}</div>
                <div class="text-xs text-primary font-bold mt-1">${g.urunler.length} ürün</div>
            </div>`).join('');

        window.gecmisGruplar = gruplar;
    } catch(e) {
        container.innerHTML = '<div class="py-6 text-center text-danger">Yükleme hatası.</div>';
    }
};

/**
 * Render Analytics Data
 */
window.updateAnalytics = async function () {
    const container = document.getElementById('analytics-container');
    if (!container) return;

    try {
        const urunler = await apiCall('analizHesapla');
        const searchInput = document.querySelector('#view-analytics .search-bar input');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";

        const filtered = urunler.filter(u => u.urunAdi.toLowerCase().includes(searchTerm));

        if (filtered.length === 0) {
            container.innerHTML = '<div class="py-12 text-center text-muted col-span-full">Veri bulunamadı.</div>';
            return;
        }

        container.innerHTML = filtered.map(item => {
            const val = parseFloat(item.kacAyYeter);
            const gun = Math.round(val * 30);
            const surLabel = val >= 12 ? `${(val/12).toFixed(1)} yıl` : (gun < 1 ? "Bitti" : `${gun} gün`);
            const statusColor = val < 1 ? 'danger' : (val < 3 ? 'warning' : 'success');

            return `
                <div class="glass flex justify-between items-center p-4">
                    <div class="flex flex-col gap-1">
                        <h4 class="text-sm font-bold white">${item.urunAdi}</h4>
                        <p class="text-[11px] text-muted">Aylık Ort: <span class="white">${item.aylikTuketim} ${item.birim}</span></p>
                    </div>
                    <div class="text-right">
                        <div class="text-lg font-extrabold text-${statusColor}">${surLabel}</div>
                        <div class="text-[10px] text-muted uppercase">Tahmini Süre</div>
                    </div>
                </div>`;
        }).join('');
    } catch (err) {
        showToast("Analiz yüklenemedi", "error");
    }
};

window.renderGecmisDetay = function(index) {
    const g = window.gecmisGruplar[index];
    const detayContainer = document.getElementById('gecmis-fatura-detay');
    if (!detayContainer) return;

    detayContainer.innerHTML = `
        <div class="text-xs font-bold text-primary mb-3">${new Date(g.tarih).toLocaleString('tr-TR')}</div>
        ${g.urunler.map(u => `
            <div class="flex justify-between items-center py-2 border-b-white-10">
                <span class="text-sm font-semibold">${u.urun_adi}</span>
                <span class="text-sm font-bold text-success">+${u.miktar} ${u.birim || ''}</span>
            </div>`).join('')}`;
};

/**
 * Render items scanned by OCR
 */
window.renderScannedItems = function(urunler, status = "success", message = "") {
    const scannerContainer = document.querySelector('.scanned-items');
    if (!scannerContainer) return;

    const headerSpan = scannerContainer.querySelector('.badge-status');
    const detailDiv = scannerContainer.querySelector('.o-fatura-detay');

    if (headerSpan) {
        headerSpan.className = `text-xs px-2 py-1 rounded badge-status ${status === 'error' ? 'bg-danger-light text-danger' : 'bg-success-light text-success'}`;
        headerSpan.textContent = status === 'error' ? 'Okunmadı' : 'Okundu';
    }
    if (detailDiv) detailDiv.textContent = message;

    const checklist = scannerContainer.querySelector('.checklist');
    if (!checklist) return;
    
    checklist.innerHTML = '';
    if (status === "error" || !urunler || urunler.length === 0) {
        checklist.innerHTML = `<div class="p-4 text-center text-danger text-sm glass">Fatura okunamadı veya ürün bulunamadı.</div>`;
    } else {
                urunler.forEach((urun, idx) => {
            const rawName = urun.ad || urun.urun_adi || '';
            const cleanedName = Utils.cleanAd(rawName);
            // Eğer birim_detay boşsa veya sadece 'Adet' yazıyorsa, isimden miktar çekmeyi dene
            let birimDetay = (urun.birim_detay || '').replace(/[.]/g, "");
            if (!birimDetay || birimDetay.toLowerCase() === 'adet') {
                const extracted = Utils.extractBirimDetay(rawName);
                if (extracted) birimDetay = extracted;
            }
            // Noktaları her durumda temizle (Örn: "Kg." -> "KG")
            birimDetay = birimDetay.replace(/[.]/g, "").toUpperCase();

            const li = document.createElement('li');
            li.className = 'mb-4 glass p-3';
            li.innerHTML = `
                <div class="flex items-start gap-3 relative">
                    <input type="checkbox" checked class="mt-2 urun-onay-check" data-idx="${idx}">
                    <div class="flex-col w-full pr-8">
                        ${urun.uyari ? `<div class="text-[10px] text-accent mb-1"><i data-lucide="alert-triangle" style="width:12px; height:12px;"></i> ${urun.uyari}</div>` : ''}
                        <input type="text" class="bg-dark border border-white-10 rounded text-sm p-2 w-full text-white mb-1 o-ad uppercase" value="${cleanedName}" data-orijinal="${urun.gemini_adi || ''}">
                        <div class="o-status-container text-[10px] mb-2 px-1 italic flex items-center gap-1"></div>
                        <div class="grid gap-2" style="display:grid; grid-template-columns: 0.6fr 1fr 0.8fr 1.2fr;">
                            <div class="flex-col">
                                <label class="text-xs text-muted mb-1 block text-center">Fatura</label>
                                <input type="number" class="bg-dark border border-white-10 rounded text-sm p-2 w-full text-white text-center o-miktar" value="${urun.miktar || ''}" step="0.01">
                            </div>
                            <div class="flex-col">
                                <label class="text-xs text-muted mb-1 block text-center">Birim (Detay)</label>
                                <input type="text" class="bg-dark border border-white-10 rounded text-sm p-2 w-full text-white text-center o-birim-detay" value="${birimDetay}">
                            </div>
                            <div class="flex-col">
                                <label class="text-xs text-accent font-bold mb-1 block text-center">Eski Stok</label>
                                <input type="number" class="bg-dark border border-white-10 rounded text-sm p-2 w-full text-white text-center o-eski-stok" placeholder="">
                            </div>
                            <div class="flex-col">
                                <label class="text-xs text-primary font-bold mb-1 block text-center">Toplam Stok</label>
                                <input type="text" class="bg-dark border border-primary/30 rounded text-sm p-2 w-full text-white text-center o-toplam-stok font-bold" readonly>
                            </div>
                        </div>
                    </div>
                </div>`;
            checklist.appendChild(li);
            setupAdListener(li);
            updateLiveTotal(li);
        });
    }

    scannerContainer.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
};

/**
 * Setup listener for name changes in scanned items
 */
window.setupAdListener = function(li) {
    const inputAd = li.querySelector('.o-ad');
    if (!inputAd) return;

    const listener = () => {
        const ad = inputAd.value.trim();
        const found = Alias.findMatch(ad, window.globalUrunler);
        const statusCont = li.querySelector('.o-status-container');
        const inputEskiStok = li.querySelector('.o-eski-stok');

        if (found) {
            if (statusCont) {
                const upperAd = found.ad.toUpperCase();
                statusCont.className = 'o-status-container text-[10px] mb-2 px-1 italic flex items-center gap-1 text-success';
                statusCont.innerHTML = `<i data-lucide="check-circle" style="width:10px; height:10px;"></i> <span>✅ EŞLEŞTİ: ${upperAd}</span>`;
                // Input değerini de eşleşen isme (büyük harf) çevir
                inputAd.value = upperAd;
            }
            // Eski stok kutusunu boş bırakıyoruz
            if (inputEskiStok) inputEskiStok.placeholder = "";
        } else {
            // Eşleşme yoksa sadece girilen yazıyı büyük harf yap
            inputAd.value = inputAd.value.toUpperCase();
            if (statusCont) {
                statusCont.className = 'o-status-container text-[10px] mb-2 px-1 italic flex items-center gap-1 text-muted';
                statusCont.innerHTML = `<i data-lucide="help-circle" style="width:10px; height:10px;"></i> <span>❓ YENİ ÜRÜN</span>`;
            }
            if (inputEskiStok) inputEskiStok.placeholder = 'Yeni';
        }
        updateLiveTotal(li);
        if (window.lucide) lucide.createIcons();
    };

    inputAd.addEventListener('input', listener);
    listener(); // Sayfa yüklendiğinde ilk eşleşmeyi kontrol et
    li.querySelector('.o-miktar').addEventListener('input', () => updateLiveTotal(li));
    li.querySelector('.o-birim-detay').addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[.]/g, "").toUpperCase();
        updateLiveTotal(li);
    });
    if (li.querySelector('.o-eski-stok')) {
        li.querySelector('.o-eski-stok').addEventListener('input', () => updateLiveTotal(li));
    }
};

/**
 * Update total stock calculation on the fly
 */
window.updateLiveTotal = function(li) {
    const inputMiktar = li.querySelector('.o-miktar');
    const inputBirimDet = li.querySelector('.o-birim-detay');
    const inputEskiStok = li.querySelector('.o-eski-stok');
    const inputTotal = li.querySelector('.o-toplam-stok');

    if (!inputMiktar || !inputTotal) return;

    const m = inputMiktar.value;
    const b = inputBirimDet.value;
    const e = inputEskiStok ? inputEskiStok.value : "";
    
    // Find current product to get display unit
    const ad = li.querySelector('.o-ad').value;
    const product = Alias.findMatch(ad, window.globalUrunler);
    const displayUnit = product ? product.birim : Utils.getDisplayUnit(inputBirimDet.value);

    const artis = Inventory.calculateArtis(m, b, displayUnit);
    
    // Kullanıcı isteği: Sadece faturadan giren toplamı göster (Eski stoğu ekleme)
    const toplamVal = Utils.safeParseFloat(artis);
    const toplamDisplay = Number.isInteger(toplamVal) ? toplamVal : toplamVal.toFixed(2);
    inputTotal.value = `${toplamDisplay} ${displayUnit}`;
};
