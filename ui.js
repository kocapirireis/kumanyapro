
const createUI = () => {
    const overlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    const toastContainer = document.getElementById('toast-container');
    const loader = document.createElement('div');
    loader.className = 'loader-overlay';
    loader.innerHTML = `
        <div class="spinner"></div>
        <div class="loading-text">Yükleniyor...</div>
    `;
    document.body.appendChild(loader);

    // Initial State Fix: Ensure modals are closed at startup
    if (overlay) overlay.classList.remove('active');

    const showModal = (contentHtml) => {
        modalContent.innerHTML = contentHtml;
        overlay.classList.add('active');
    };

    const hideModal = () => {
        overlay.classList.remove('active');
        setTimeout(() => { modalContent.innerHTML = ''; }, 300);
    };

    overlay.onclick = (e) => {
        if (e.target === overlay) hideModal();
    };

    return {
        showLoader: (text) => {
            loader.querySelector('.loading-text').innerText = text || 'Yükleniyor...';
            loader.classList.add('active');
        },
        hideLoader: () => loader.classList.remove('active'),
        
        showToast: (msg, type = 'info') => {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            const icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'exclamation-circle' : 'info-circle');
            toast.innerHTML = `<i class="fas fa-${icon}"></i> <span>${msg}</span><div class="toast-progress"></div>`;
            toastContainer.appendChild(toast);
            setTimeout(() => {
                toast.classList.add('hide');
                setTimeout(() => toast.remove(), 400);
            }, 3000);
        },

        renderDashboard: (data) => {
            document.getElementById('total-items').innerText = data.stok.length;
            const critical = data.stok.filter(i => i.durum === 'KRITIK').length;
            document.getElementById('critical-items').innerText = critical;
        },

        renderInventory: (items) => {
            const list = document.getElementById('inventory-list');
            list.innerHTML = '';
            
            // Render by category
            const cats = [...new Set(items.map(i => i.kategori))];
            
            // Render category tabs
            const tabContainer = document.getElementById('category-tabs');
            tabContainer.innerHTML = '<button class="tab active" data-category="all">Tümü</button>';
            cats.forEach(cat => {
                tabContainer.innerHTML += `<button class="tab" data-category="${cat}">${cat}</button>`;
            });

            // Tab click events
            tabContainer.querySelectorAll('.tab').forEach(tab => {
                tab.onclick = () => {
                    tabContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const selected = tab.dataset.category;
                    document.querySelectorAll('.category-group').forEach(group => {
                        if (selected === 'all' || group.dataset.category === selected) group.style.display = 'block';
                        else group.style.display = 'none';
                    });
                };
            });

            cats.forEach(cat => {
                const group = document.createElement('div');
                group.className = 'category-group';
                group.dataset.category = cat;
                group.innerHTML = `<div class="category-header">${cat}</div>`;
                
                const catItems = items.filter(i => i.kategori === cat);
                catItems.forEach(item => {
                    const card = document.createElement('div');
                    card.className = `inventory-card glass ${item.durum === 'KRITIK' ? 'border-left-indicator' : ''}`;
                    card.innerHTML = `
                        <div class="inv-main">
                            <span class="font-bold">${item.urun_adi}</span>
                            <span class="text-xs text-muted">${item.kategori} | ${item.birim}</span>
                        </div>
                        <div class="inv-controls">
                            <span class="font-bold ${item.durum === 'KRITIK' ? 'text-danger' : 'text-primary'}">${item.miktar}</span>
                            <button class="icon-btn text-xs" onclick="window.UI.showItemDetails('${item.urun_adi}')">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    `;
                    group.appendChild(card);
                });
                list.appendChild(group);
            });
        },

        renderActivity: (activities) => {
            const container = document.getElementById('recent-activity');
            container.innerHTML = '<h3 class="text-sm font-bold p-4 pb-2">Son Hareketler</h3>';
            
            activities.slice(0, 10).forEach(act => {
                const item = document.createElement('div');
                item.className = 'activity-item';
                const icon = act.tip === 'GIRIS' ? 'plus' : (act.tip === 'CIKIS' ? 'minus' : 'sync');
                const color = act.tip === 'GIRIS' ? 'success' : (act.tip === 'CIKIS' ? 'danger' : 'primary');
                
                item.innerHTML = `
                    <div class="activity-icon bg-${color}-light">
                        <i class="fas fa-${icon} text-${color}"></i>
                    </div>
                    <div class="activity-details">
                        <h4>${act.urun_adi}</h4>
                        <p>${new Date(act.tarih).toLocaleString('tr-TR')}</p>
                    </div>
                    <div class="activity-amount text-${color}">
                        ${act.tip === 'CIKIS' ? '-' : '+'}${act.miktar}
                    </div>
                `;
                container.appendChild(item);
            });
        },

        showScannerModal: () => {
            showModal(`
                <div class="text-center">
                    <div class="camera-icon-wrapper large-pulse mx-auto mb-6">
                        <i class="fas fa-camera text-3xl text-primary"></i>
                    </div>
                    <h3 class="text-lg font-bold mb-2">Fatura Tara</h3>
                    <p class="text-muted text-sm mb-6">Fatura fotoğrafını çekerek veya yükleyerek stokları otomatik güncelleyin.</p>
                    
                    <input type="file" id="camera-input" accept="image/*" capture="environment" class="hidden">
                    <button class="btn-primary w-full mb-3" onclick="document.getElementById('camera-input').click()">
                        FOTOĞRAF ÇEK
                    </button>
                    <button class="text-btn w-full" onclick="window.UI.hideModal()">İPTAL</button>
                </div>
            `);

            document.getElementById('camera-input').onchange = async (e) => {
                if (e.target.files.length > 0) {
                    UI.hideModal();
                    UI.showLoader('Fatura analiz ediliyor...');
                    // Logic to send file to Gemini API goes here
                    setTimeout(() => {
                        UI.hideLoader();
                        UI.showToast('Geliştirme aşamasında: Gemini OCR', 'info');
                    }, 2000);
                }
            };
        },

        showItemDetails: (itemName) => {
            const item = window.KUMANYA_DATA.stok.find(i => i.urun_adi === itemName);
            if (!item) return;

            showModal(`
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <h3 class="text-xl font-bold">${item.urun_adi}</h3>
                        <p class="text-muted text-sm">${item.kategori}</p>
                    </div>
                    <div class="bg-primary-light px-3 py-1 rounded-full text-primary font-bold">
                        ${item.miktar} ${item.birim}
                    </div>
                </div>

                <div class="flex gap-3 mb-6">
                    <button class="btn-primary flex-1 bg-success" onclick="window.UI.handleQuickMove('${item.urun_adi}', 'GIRIS')">
                        <i class="fas fa-plus"></i> EKLE
                    </button>
                    <button class="btn-primary flex-1 bg-danger" onclick="window.UI.handleQuickMove('${item.urun_adi}', 'CIKIS')">
                        <i class="fas fa-minus"></i> DÜŞ
                    </button>
                </div>

                <h4 class="text-xs font-bold text-muted uppercase tracking-widest mb-3">Hızlı İşlemler</h4>
                <div class="grid grid-cols-2 gap-2 mb-6">
                    <button class="pill-btn" onclick="window.UI.showCustomMove('${item.urun_adi}')">Özel Miktar</button>
                    <button class="pill-btn" onclick="window.UI.showSifirlaConfirm('${item.urun_adi}')">Stok Sıfırla</button>
                </div>

                <button class="text-btn w-full text-center" onclick="window.UI.hideModal()">KAPAT</button>
            `);
        },

        handleQuickMove: async (product, type) => {
            UI.showLoader('Güncelleniyor...');
            try {
                const res = await API.stok.ekle(product, 1, type);
                if (res.basarili) {
                    UI.hideModal();
                    UI.showToast(`${product} güncellendi`, 'success');
                    // Reload data
                    window.location.reload(); 
                }
            } catch (err) {
                UI.showToast('Hata: ' + err.message, 'error');
            } finally {
                UI.hideLoader();
            }
        },

        hideModal: () => hideModal(),
        
        filterInventory: (query, filterType = 'all') => {
            document.querySelectorAll('.inventory-card').forEach(card => {
                const name = card.querySelector('.font-bold').innerText.toLowerCase();
                const isCritical = card.classList.contains('border-left-indicator');
                
                let matches = name.includes(query);
                if (filterType === 'critical') matches = matches && isCritical;
                
                card.style.display = matches ? 'grid' : 'none';
            });
        },

        renderAnalysis: (data) => {
            // Implementation for analysis charts
        }
    };
};
