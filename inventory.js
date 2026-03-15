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
        const bDetay = (birimDetay || "").trim().toUpperCase();
        
        // Eğer birim detayında Lİ, LÜ gibi paket ekleri varsa çarpanı 1 kabul et (Kullanıcı paket sayısını girmek istiyor)
        const isPackageCount = bDetay.match(/(LI|Lİ|LU|LÜ|ADET|PAKET|KOLİ|KOLI)\b/i);

        const mMatch = bDetay.match(/^([\d.,]+)\s*(.*)$/);
        if (mMatch && !isPackageCount) {
            carpan = Utils.safeParseFloat(mMatch[1]) || 1;
        }

        let rawArtis = miktar * carpan;
        
        // --- HASSAS BİRİM HESAPLAMA ---
        // Eğer displayUnit (veritabanı) belirtilmemişse, faturadaki (Kg, LT vb.) birimi temel al.
        const targetUnit = displayUnit || Utils.getDisplayUnit(birimDetay);
        const dUnit = targetUnit.toUpperCase();
        const bDetayCap = bDetay.toUpperCase();
        
        // Gram/ML ölçekleme (Eğer hedef KG ise ve girdi GR ise 1000'e böl)
        if (dUnit === "KG" && (bDetayCap.includes("GR") || bDetayCap.includes(" G ") || bDetayCap.endsWith(" G"))) {
            rawArtis = rawArtis / 1000;
        } else if (dUnit === "L" && (bDetayCap.includes("ML") || bDetayCap.includes("CL"))) {
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
