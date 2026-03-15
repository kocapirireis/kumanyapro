/**
 * UI Rendering Functions
 * Version: 4.0 (Restore)
 */

/**
 * Render Inventory Page
 */
function renderInventoryList(data) {
    const container = document.getElementById('inventory-list');
    if (!container) return;
    
    const filter = window.currentInventoryFilter || 'TRACKED';
    const searchQuery = document.querySelector('.search-bar input')?.value.toLocaleLowerCase('tr') || '';

    // Clear and Show Loader
    container.innerHTML = "";
    
    // Grouping by category
    const categorized = {};
    data.forEach(item => {
        const matchesSearch = item.urun.toLocaleLowerCase('tr').includes(searchQuery);
        const matchesFilter = (filter === 'ALL') || 
                            (filter === 'TRACKED' && item.takip) || 
                            (filter === 'UNTRACKED' && !item.takip);

        if (matchesSearch && matchesFilter) {
            const cat = item.kategori || "Diğer";
            if (!categorized[cat]) categorized[cat] = [];
            categorized[cat].push(item);
        }
    });

    if (Object.keys(categorized).length === 0) {
        container.innerHTML = `<div class="py-10 text-center text-muted">Ürün bulunamadı.</div>`;
        return;
    }

    for (const [cat, items] of Object.entries(categorized)) {
        const section = document.createElement('div');
        section.className = "cat-section mb-6";
        section.innerHTML = `<h3 class="cat-title mb-3 font-bold text-sm uppercase text-primary">${cat}</h3>`;
        
        const list = document.createElement('div');
        list.className = "space-y-3";
        
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = "inventory-card glass flex justify-between items-center p-4";
            
            const isCritical = item.miktar <= (item.kritik || 0);
            
            card.innerHTML = `
                <div class="inv-info">
                    <h4 class="font-bold">${item.urun}</h4>
                    <p class="text-[10px] text-muted uppercase tracking-wider">${item.birim}</p>
                </div>
                <div class="inv-amount text-right">
                    <div class="text-lg font-bold ${isCritical ? 'text-danger' : 'text-white'}">${item.miktar}</div>
                    <div class="text-[10px] font-medium opacity-40">MEVCUT</div>
                </div>
            `;
            list.appendChild(card);
        });
        
        section.appendChild(list);
        container.appendChild(section);
    }
}

/**
 * Dashboard (Home) Updates
 */
function updateDashboard(data) {
    // Toplam Ürün
    document.getElementById('total-urun-count').innerHTML = `${data.length} <span class="text-xs font-normal text-muted">Kalem</span>`;
    
    // Kritik Stok Sayısı
    const criticals = data.filter(i => i.takip && i.miktar <= (i.kritik || 0));
    const banner = document.getElementById('critical-stock-banner');
    
    if (criticals.length > 0) {
        banner.classList.remove('hidden');
        document.getElementById('critical-stock-title').innerText = `Kritik Seviye: ${criticals.length} Ürün`;
        document.getElementById('critical-stock-list').innerText = criticals.slice(0, 3).map(i => i.urun).join(', ') + (criticals.length > 3 ? '...' : '');
    } else {
        banner.classList.add('hidden');
    }

    // Hareketler - Son 5
    // api.js'den gelen data içinde 'hareketler' de olabilir, yoksa stokOku'dan sonra ayrı çekilebilir.
    // Şimdilik demo
    renderHomeActivity();
}

/**
 * Stok Sayım Listesi (Sayfa 3 - Tab 2)
 */
function renderStokSayimList() {
    const container = document.getElementById('stok-sayim-items');
    if (!container || !window.globalUrunler) return;

    const data = window.globalUrunler.filter(i => i.takip);
    container.innerHTML = "";

    data.sort((a,b) => a.urun.localeCompare(b.urun, 'tr')).forEach(item => {
        const row = document.createElement('div');
        row.className = "stok-sayim-row";
        row.innerHTML = `
            <div class="text-sm font-medium pr-2 overflow-hidden whitespace-nowrap overflow-ellipsis" style="padding-left:8px;">${item.urun}</div>
            <div class="text-center font-bold text-primary">${item.miktar} <span class="text-[9px] text-muted">${item.birim}</span></div>
            <div class="flex justify-center">
                <input type="number" step="any" class="sayim-input" data-ad="${item.urun}" placeholder="---" 
                    style="width:80%; background:rgba(0,0,0,0.2); border:1px solid var(--border-color); border-radius:6px; color:white; text-align:center; padding:4px 0; font-weight:bold; font-size:14px; outline:none;">
            </div>
        `;
        container.appendChild(row);
    });
}

/**
 * Scanned Items Render (Fatura/AI)
 */
function renderScannedItems(items) {
    const list = document.querySelector('.checklist');
    list.innerHTML = "";

    items.forEach((item, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <label class="custom-checkbox">
                <input type="checkbox" checked class="scanned-checkbox" data-index="${index}">
                <span class="checkmark"></span>
                <div class="check-content">
                    <span class="font-bold">${item.ad}</span>
                    <span class="text-primary">${item.miktar} ${item.birim}</span>
                </div>
            </label>
        `;
        list.appendChild(li);
    });
}

/**
 * Analytics Page Render
 */
async function loadAnalytics() {
    const container = document.getElementById('analytics-items');
    container.innerHTML = `<div class="text-center py-10 text-muted">Veriler analiz ediliyor...</div>`;
    
    try {
        const result = await apiCall('analizHesapla');
        if (result && result.analiz) {
            renderAnalyticsList(result.analiz);
            renderOrderSuggestions(result.onerilenSiparis);
            
            // Dashboard Average Days update
            updateAvgDays(result.analiz);
        }
    } catch (error) {
        container.innerHTML = `<div class="text-center py-10 text-danger">Hata: ${error.message}</div>`;
    }
}

function renderAnalyticsList(analiz) {
    const container = document.getElementById('analytics-items');
    container.innerHTML = "";

    analiz.forEach(item => {
        const row = document.createElement('div');
        row.className = "analiz-row";
        
        const bitisStr = item.stokBitis === "KRİTİK" ? `<span class="text-danger font-bold">KRİTİK</span>` :
                       item.stokBitis === "YETERLİ" ? `<span class="text-success">YETERLİ</span>` : 
                       item.stokBitis === "-" ? "-" : item.stokBitis;

        row.innerHTML = `
            <div style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.urun}</div>
            <div style="text-align:center; font-size:11px;">${bitisStr}</div>
            <div style="text-align:center; font-weight:bold;">${item.aylikTuketim}</div>
            <div style="text-align:center; font-weight:bold; color:var(--primary);">${item.mevcutStok}</div>
        `;
        container.appendChild(row);
    });
}

function renderOrderSuggestions(suggestions) {
    const container = document.querySelector('.order-suggestions');
    container.innerHTML = "";
    
    if (!suggestions || suggestions.length === 0) {
        container.innerHTML = `<div class="glass p-4 text-center text-muted">Şu an acil sipariş gerekmiyor.</div>`;
        return;
    }

    suggestions.forEach(item => {
        const card = document.createElement('div');
        card.className = "suggestion-card glass mb-3";
        card.innerHTML = `
            <div class="sugg-icon bg-warning-light text-warning">
                <i data-lucide="shopping-cart" style="width:20px; height:20px;"></i>
            </div>
            <div class="sugg-info">
                <h4>${item.urun}</h4>
                <p>Eksik: <span class="text-white font-bold">${item.eksiMiktar}</span> ${item.birim}</p>
            </div>
        `;
        container.appendChild(card);
    });
    
    if (window.lucide) window.lucide.createIcons();
}

/**
 * Helpers
 */
function updateAvgDays(analiz) {
    // Basit bir ortalama hesaplama demosudur
    const avgElem = document.getElementById('avg-days');
    if (!avgElem) return;

    let total = 0;
    let count = 0;
    analiz.forEach(a => {
        if (typeof a.stokBitis === 'number') {
            total += a.stokBitis;
            count++;
        }
    });

    if (count > 0) {
        const avg = Math.round(total / count);
        avgElem.innerHTML = `${avg} <span class="text-xs font-normal">Gün</span>`;
    }
}

/**
 * Settings UI Updates
 */
function updateSettingsFields(data) {
    const select = document.getElementById('settings-urun-sec');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = `<option value="">-- Ürün Seçin --</option>`;
    
    data.sort((a,b) => a.urun.localeCompare(b.urun, 'tr')).forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.urun;
        opt.innerText = item.urun;
        select.appendChild(opt);
    });
    
    select.value = currentVal;
}

/**
 * Internal UI Controls
 */
window.setInventoryFilter = (f, btn) => {
    window.currentInventoryFilter = f;
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderInventoryList(window.globalUrunler);
};
