/**
 * UI Rendering Functions
 * Version: 4.1 (Empty Data Fix)
 */

window.inventoryFilter = 'TRACKED';

window.setInventoryFilter = function(filter, element) {
    window.inventoryFilter = filter;
    document.querySelectorAll('#view-inventory .pill-btn').forEach(opt => opt.classList.remove('active'));
    if (element) element.classList.add('active');
    if (window.renderInventoryList) {
        window.renderInventoryList(window.globalUrunler || []);
    }
};

window.showToast = function(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'alert-circle';
    if (type === 'warning') icon = 'alert-triangle';
    toast.innerHTML = `<i data-lucide="${icon}" style="width:18px; height:18px;"></i><span></span><div class="toast-progress" style="animation-duration: ${duration}ms"></div>`;
    toast.querySelector('span').textContent = message;
    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();
    setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 400); }, duration);
}

function renderInventoryList(data) {
    const container = document.getElementById('inventory-list');
    if (!container) return;
    
    // BUG FIX: data boş ise boş dizi kullan
    const urunler = data || [];
    const filter = window.inventoryFilter || 'TRACKED';
    const searchQuery = document.querySelector('.search-bar input')?.value.toLocaleLowerCase('tr') || '';

    container.innerHTML = "";
    
    const categorized = {};
    urunler.forEach(item => {
        const matchesSearch = item.urun?.toLocaleLowerCase('tr').includes(searchQuery) || 
                              item.ad?.toLocaleLowerCase('tr').includes(searchQuery);
        const matchesFilter = (filter === 'ALL') || 
                            (filter === 'TRACKED' && (item.takip === true || item.takip === 'EVET')) || 
                            (filter === 'UNTRACKED' && !(item.takip === true || item.takip === 'EVET'));

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
                    <h4 class="font-bold">${item.ad || item.urun}</h4>
                    <p class="text-[10px] text-muted uppercase tracking-wider">${item.birim || 'ADET'}</p>
                </div>
                <div class="inv-amount text-right">
                    <div class="text-lg font-bold ${isCritical ? 'text-danger' : 'text-white'}">${item.miktar || 0}</div>
                    <div class="text-[10px] font-medium opacity-40">MEVCUT</div>
                </div>
            `;
            list.appendChild(card);
        });
        section.appendChild(list);
        container.appendChild(section);
    }
}

function updateDashboard(data) {
    const urunler = data || [];
    document.getElementById('total-urun-count').innerHTML = `${urunler.length} <span class="text-xs font-normal text-muted">Kalem</span>`;
    const criticals = urunler.filter(i => (i.takip === true || i.takip === 'EVET') && i.miktar <= (i.kritik || 0));
    const banner = document.getElementById('critical-stock-banner');
    if (criticals.length > 0) {
        banner.classList.remove('hidden');
        document.getElementById('critical-stock-title').innerText = `Kritik Seviye: ${criticals.length} Ürün`;
        document.getElementById('critical-stock-list').innerText = criticals.slice(0, 3).map(i => i.ad || i.urun).join(', ') + (criticals.length > 3 ? '...' : '');
    } else {
        banner.classList.add('hidden');
    }
}

function renderStokSayimList() {
    const container = document.getElementById('stok-sayim-items');
    if (!container) return;
    const data = (window.globalUrunler || []).filter(i => (i.takip === true || i.takip === 'EVET'));
    container.innerHTML = "";
    if (data.length === 0) {
        container.innerHTML = `<div class="py-4 text-center text-muted text-sm">Takip edilen ürün yok.</div>`;
        return;
    }
    data.sort((a,b) => (a.ad || a.urun).localeCompare((b.ad || b.urun), 'tr')).forEach(item => {
        const row = document.createElement('div');
        row.className = "stok-sayim-row";
        row.innerHTML = `
            <div class="text-sm font-medium pr-2 overflow-hidden whitespace-nowrap text-ellipsis">${item.ad || item.urun}</div>
            <div class="text-center font-bold text-primary">${item.miktar || 0} <span class="text-[9px] text-muted">${item.birim || ''}</span></div>
            <div class="flex justify-center"><input type="number" step="any" class="sayim-input" data-ad="${item.ad || item.urun}" placeholder="---" style="width:80%; background:rgba(0,0,0,0.2); border:1px solid var(--border-color); border-radius:6px; color:white; text-align:center; padding:4px 0; font-weight:bold; font-size:14px; outline:none;"></div>
        `;
        container.appendChild(row);
    });
}

function renderScannedItems(items) {
    const list = document.querySelector('.checklist');
    if (!list) return;
    list.innerHTML = "";
    (items || []).forEach((item, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<label class="custom-checkbox"><input type="checkbox" checked class="scanned-checkbox" data-index="${index}"><span class="checkmark"></span><div class="check-content"><span class="font-bold">${item.ad}</span><span class="text-primary">${item.miktar} ${item.birim}</span></div></label>`;
        list.appendChild(li);
    });
}

async function loadAnalytics() {
    const container = document.getElementById('analytics-items');
    if (!container) return;
    container.innerHTML = `<div class="text-center py-10 text-muted">Veriler analiz ediliyor...</div>`;
    try {
        const result = await apiCall('analizHesapla');
        if (result && result.analiz) {
            renderAnalyticsList(result.analiz || []);
            renderOrderSuggestions(result.onerilenSiparis || []);
        } else {
            container.innerHTML = `<div class="text-center py-10 text-muted">Henüz veri yok.</div>`;
        }
    } catch (error) {
        container.innerHTML = `<div class="text-center py-10 text-danger">Bağlantı sorunu.</div>`;
    }
}

function renderAnalyticsList(analiz) {
    const container = document.getElementById('analytics-items');
    if (!container) return;
    container.innerHTML = "";
    if (analiz.length === 0) {
        container.innerHTML = `<div class="text-center py-10 text-muted">Analiz edilecek ürün yok.</div>`;
        return;
    }
    analiz.forEach(item => {
        const row = document.createElement('div');
        row.className = "analiz-row";
        const bitisStr = item.stokBitis === "KRİTİK" ? `<span class="text-danger font-bold">KRİTİK</span>` :
                       item.stokBitis === "YETERLİ" ? `<span class="text-success">YETERLİ</span>` : "-";
        row.innerHTML = `<div style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.urun}</div><div style="text-align:center; font-size:11px;">${bitisStr}</div><div style="text-align:center; font-weight:bold;">${item.aylikTuketim || '-'}</div><div style="text-align:center; font-weight:bold; color:var(--primary);">${item.mevcutStok || 0}</div>`;
        container.appendChild(row);
    });
}

function renderOrderSuggestions(suggestions) {
    const container = document.querySelector('.order-suggestions');
    if (!container) return;
    container.innerHTML = "";
    if (!suggestions || suggestions.length === 0) {
        container.innerHTML = `<div class="glass p-4 text-center text-muted">Şu an acil sipariş gerekmiyor.</div>`;
        return;
    }
    suggestions.forEach(item => {
        const card = document.createElement('div');
        card.className = "suggestion-card glass mb-3";
        card.innerHTML = `<div class="sugg-icon bg-warning-light text-warning"><i data-lucide="shopping-cart" style="width:20px; height:20px;"></i></div><div class="sugg-info"><h4>${item.urun}</h4><p>Eksik: <span class="text-white font-bold">${item.eksiMiktar}</span> ${item.birim}</p></div>`;
        container.appendChild(card);
    });
    if (window.lucide) window.lucide.createIcons();
}

function updateSettingsFields(data) {
    const select = document.getElementById('settings-urun-sec');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = `<option value="">-- Ürün Seçin --</option>`;
    (data || []).sort((a,b) => (a.ad || a.urun).localeCompare((b.ad || b.urun), 'tr')).forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.ad || item.urun;
        opt.innerText = item.ad || item.urun;
        select.appendChild(opt);
    });
    select.value = currentVal;
}

window.renderInventoryList = renderInventoryList;
window.updateDashboard = updateDashboard;
window.renderStokSayimList = renderStokSayimList;
window.renderScannedItems = renderScannedItems;
window.updateSettingsFields = updateSettingsFields;
