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
        console.log("[UI] updateUI tetiklendi...");
        const response = await apiCall('stokOku');
        if (!response || !response.veri) {
            console.warn("[UI] Stok verisi gelmedi.");
            return;
        }

        const data = response.veri;
        window.globalUrunler = data.urunler || [];
        window.currentStokMap = {};
        window.currentIdMap = {};
        (data.urunler || []).forEach(u => {
            window.currentStokMap[u.ad] = u.miktar || 0;
            if (u.id) window.currentIdMap[u.id] = u.miktar || 0;
        });

        // Dashboard summaries (v20 IDs harmonized with index.html)
        const totalItems = document.getElementById('total-items');
        const criticalItems = document.getElementById('critical-items');
        
        if (totalItems) totalItems.textContent = (data.urunler || []).length;

        const kritikler = (data.urunler || []).filter(u => u.takip && u.miktar <= (u.minStok || 0));
        if (criticalItems) criticalItems.textContent = kritikler.length;

        // Recent Activity
        const activityList = document.getElementById('recent-activity');
        if (activityList && data.sonHareketler) {
            window.tumHareketler = data.sonHareketler;
            renderHomeActivity(5);
        }

        // Inventory List (if on inventory page)
        renderInventoryList(window.globalUrunler);
    } catch (err) {
        console.error('[updateUI] Hata:', err);
        showToast("Veriler yüklenirken bir sorun oluştu.", "error");
    }
};

/**
 * Render home activity list
 */
window.renderHomeActivity = function (limit) {
    const activityList = document.getElementById('recent-activity');
    if (!activityList || !window.tumHareketler) return;
    
    activityList.innerHTML = '';
    const liste = window.tumHareketler.slice(0, limit);
    
    if (liste.length === 0) {
        activityList.innerHTML = '<div class="text-center py-4 text-muted text-xs">Henüz hareket kaydı yok.</div>';
        return;
    }

    liste.forEach(h => {
        const date = new Date(h.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        const item = document.createElement('div');
        item.className = 'activity-item';
        
        const isUp = h.tip === 'GIRIS' || h.tip === 'BASLANGIC';
        const colorClass = isUp ? 'text-success' : 'text-danger';
        const icon = isUp ? 'plus-circle' : 'minus-circle';
        
        item.innerHTML = `
            <div class="activity-icon ${isUp ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}">
                <i class="fas fa-${icon} text-xs"></i>
            </div>
            <div class="activity-details">
                <h4 class="text-xs font-bold">${h.urun_adi || h.ad || 'Ürün'}</h4>
                <p class="text-[10px] text-muted">${date} • ${h.tip}</p>
            </div>
            <div class="activity-amount ${colorClass} text-xs font-bold">
                ${isUp ? '+' : '-'}${h.miktar}
            </div>
        `;
        activityList.appendChild(item);
    });
};

/**
 * Render main inventory list with category grouping
 */
window.renderInventoryList = function (urunler) {
    if (!urunler) return;
    const inventoryList = document.getElementById('inventory-list');
    if (!inventoryList) return;

    const searchInput = document.getElementById('inventory-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";

    inventoryList.innerHTML = '';
    
    const categories = {
        "et": "Et Ürünleri",
        "kahvalti": "Kahvaltılık",
        "kuru": "Kuru Gıda",
        "temizlik": "Temizlik",
        "diger": "Diğer"
    };

    // Filter and group
    const filtered = urunler.filter(u => (u.ad || "").toLowerCase().includes(searchTerm));
    
    if (filtered.length === 0) {
        inventoryList.innerHTML = '<div class="text-center py-12 text-muted text-sm">Ürün bulunamadı.</div>';
        return;
    }

    // Simplified listing for test
    filtered.forEach(u => {
        const card = document.createElement('div');
        card.className = 'inventory-card glass mb-2 p-3 flex justify-between items-center';
        card.innerHTML = `
            <div>
                <h4 class="text-sm font-bold">${u.ad}</h4>
                <p class="text-xs text-muted">${u.miktar} ${u.birim || ''}</p>
            </div>
            <div class="flex gap-2">
                <button class="icon-btn-sm" onclick="showItemDetail('${u.id}')"><i class="fas fa-chevron-right"></i></button>
            </div>
        `;
        inventoryList.appendChild(card);
    });
};

/**
 * Render Analytics Data
 */
window.updateAnalytics = async function () {
    const container = document.getElementById('ai-suggestions');
    if (!container) return;

    try {
        const res = await apiCall('analizHesapla');
        if (!res || !res.veri) return;
        
        const items = res.veri;
        if (items.length === 0) {
            container.innerHTML = '<div class="text-center py-8 text-muted text-xs">Henüz analiz verisi yok.</div>';
            return;
        }

        container.innerHTML = items.slice(0, 5).map(item => `
            <div class="suggestion-card glass mb-3">
                <div class="sugg-icon bg-primary-light">
                    <i class="fas fa-lightbulb text-primary"></i>
                </div>
                <div class="sugg-info">
                    <h4 class="text-xs font-bold">${item.urunAdi}</h4>
                    <p class="text-[10px] text-muted">Tahmini süre: <span class="white">${item.kacAyYeter || '?'} ay</span></p>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.warn("Analytics error:", err);
    }
};
