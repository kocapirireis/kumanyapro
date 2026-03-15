/**
 * @module Inventory
 * @description Stok işlemleri, matematiksel hesaplamalar ve veritabanı senkronizasyonu
 */

const Inventory = {
    /**
     * Toplam stok artışını (veya manuel düzeltmeyi) hesaplar.
     * Ölçeklendirme (GR -> KG) hatalarını burada önler.
     */
    calculateArtis: function(faturaMiktari, birimDetay, displayUnit) {
        const miktar = Utils.safeParseFloat(faturaMiktari);
        
        let carpan = 1;
        const bDetay = (birimDetay || "").trim();
        // trToEn ile normalleştirip Türkçe ekleri (Lİ->LI, LÜ->LU) güvenle tanıyoruz
        const bNorm = Utils.trToEn(bDetay);
        
        // Paket eki tespiti (12Lİ, 100LÜ, ADET, PAKET, KOLI)
        const isPackageCount = bNorm.match(/(LI|LU|IK|UK|ADET|PAKET|KOLI)(\s|$)/);

        const mMatch = bNorm.match(/^([\d.,]+)\s*(.*)$/);
        if (mMatch && !isPackageCount) {
            carpan = Utils.safeParseFloat(mMatch[1]) || 1;
        }

        let rawArtis = miktar * carpan;
        
        // --- BİRİM ÖLÇEKLEME ---
        const targetUnit = displayUnit || Utils.getDisplayUnit(birimDetay);
        const dUnit = targetUnit.toUpperCase();
        
        // Gram/ML ölçekleme (GR->KG, ML->L)
        if (dUnit === "KG" && (bNorm.includes("GR") || bNorm.match(/\d+\s*G(\s|$)/))) {
            rawArtis = rawArtis / 1000;
        } else if (dUnit === "L" && (bNorm.includes("ML") || bNorm.includes("CL"))) {
            rawArtis = rawArtis / 1000;
        }

        return Utils.safeParseFloat(rawArtis);
    },

    /**
     * Veritabanına gönderilecek verileri düzenler (Object Key Normalizasyonu)
     * "All object keys must match" hatasını önler.
     */
    normalizePayload: function(items) {
        if (!items || items.length === 0) return [];
        
        // Tüm olası anahtarları topla
        const allKeys = new Set();
        items.forEach(item => {
            Object.keys(item).forEach(key => allKeys.add(key));
        });

        // Eksik anahtarlara null ata
        return items.map(item => {
            const normalized = {};
            allKeys.forEach(key => {
                normalized[key] = item[key] !== undefined ? item[key] : null;
            });
            return normalized;
        });
    },

    /**
     * Supabase API çağrısı için hazırlık yapar.
     */
    prepareSync: function(selectedItems, tip = 'GIRIS') {
        const payload = {
            urunler: [],
            tip: tip
        };

        selectedItems.forEach(item => {
            payload.urunler.push({
                id: item.id || '',
                ad: item.ad,
                fatura_miktar: item.fatura_miktar,
                birim_detay: item.birim_detay,
                toplam_stok: item.toplam_stok,
                birim: item.birim,
                kategori: item.kategori,
                eskiStok: item.eskiStok,
                eslestirilen_alias: item.originalName || item.eslestirilen_alias || ''
            });
        });

        return payload;
    }
};

window.Inventory = Inventory;
