/**
 * @module Utils
 * @description Metin, birim temizleme ve normalizasyon yardımcıları
 */

const Utils = {
    /**
     * Türkçe karakterleri İngilizce karşılıklarına çevirir (İç mantık için).
     */
    trToEn: function(str) {
        if (!str) return "";
        return String(str)
            .replace(/[İIı]/g, 'I').replace(/[Şş]/g, 'S')
            .replace(/[Çç]/g, 'C').replace(/[Ğğ]/g, 'G')
            .replace(/[Üü]/g, 'U').replace(/[Öö]/g, 'O')
            .toUpperCase();
    },

    /**
     * Ürün ismini eşleşme ve arama için STANDARTLAŞTIRIR.
     */
    normalizeAd: function(ad) {
        if (!ad) return "";
        let clean = this.trToEn(ad)
            // 1. Birim ve miktar ibarelerini temizle
            .replace(/(\d+[.,]?\d*)\s*(KG|GR|GM|G|L|LT|ML|ADET|PAKET|KOLI|CL|MT|X|T)(LI|LU|LU|LI|IK|UK)?/gi, "")
            // 2. Özel karakterleri ve fazla boşlukları temizle
            .replace(/[^A-Z0-9]/g, "")
            .trim();
        return clean;
    },

    /**
     * Ürün ismini EKRAN GÖSTERİMİ için temizler.
     */
    cleanAd: function(ad) {
        if (!ad) return "";
        let text = String(ad).toUpperCase();
        
        // Temizleme kuralı (Türkçe ekleri de kapsar)
        const unitRegex = /(\d+[.,]?\d*)\s*(ADET|PAKET|KOLI|GRAM|GR|KG|ML|LT|CL|MT|GM|L|G|X|T)(Ü|İ|LI|Lİ|LU|LÜ|LİK|LUK)?(\s|$)/gi;
        
        let clean = text.replace(unitRegex, " ")
                        .replace(/\s*\d+\s*(ADET|PAKET|KOLI|KG|GR|ML|LT|L|G|T)(Ü|İ|LI|Lİ|LU|LÜ|LİK|LUK)?(\s|$)/gi, " ")
                        .replace(/\(.*\)/g, "")
                        .replace(/[*\-_#]/g, " ")
                        .replace(/\s+/g, " ").trim();
        
        // Sondaki tekil anlamsız karakteri sil
        clean = clean.replace(/\s+[A-Z0-9İIŞŞĞĞÜÜÖÖ]$/g, "");
        return clean.trim();
    },

    /**
     * Birim detay metninden ana birimi (KG, L, ADET) tahmin eder.
     */
    getDisplayUnit: function(birimDetay) {
        if (!birimDetay) return "ADET";
        const bd = this.trToEn(birimDetay).replace(/[.]/g, "").trim();
        
        // KG Grubu
        if (bd.match(/(\d+|^)\s*(KG|GRAM|GR|G|GM)(\s|$)/i) || bd === "KG" || bd === "GR") return "KG";
        
        // L Grubu (Sadece saf L veya LT ise, LU/LI ekleri yoksa)
        const isPackage = bd.match(/(LI|LU|IK|UK)(\s|$)/i);
        if (!isPackage && (bd.match(/(\d+|^)\s*(LT|ML|CL|L)(\s|$)/i) || bd === "LT" || bd === "L")) return "L";
        
        return "ADET";
    },

    /**
     * Ürün adından çıkarılan miktar bilgisini (5L, 100LÜ vb.) geri getirir.
     */
    extractBirimDetay: function(ad) {
        if (!ad) return "";
        const text = String(ad).toUpperCase();
        // Türkçe takıları da içeren miktar yakalama
        const match = text.match(/(\d+[.,]?\d*)\s*(ADET|PAKET|KOLI|GRAM|GR|KG|ML|LT|CL|MT|GM|L|G|X|T)(Ü|İ|LI|Lİ|LU|LÜ|LİK|LUK)?(\s|$)/i);
        if (match) {
            return match[0].replace(/[.]/g, "").trim();
        }
        return "";
    },

    /**
     * Eşleşme kontrolü (Gelişmiş)
     */
    isMatched: function(a, b) {
        const na = this.normalizeAd(a);
        const nb = this.normalizeAd(b);
        if (!na || !nb) return false;
        if (na === nb) return true;
        
        if (na.length <= 3 || nb.length <= 3) return na === nb;
        return na.includes(nb) || nb.includes(na);
    },

    /**
     * Sayısal değerleri güvenli bir şekilde parse eder.
     */
    safeParseFloat: function(val, fallback = 0) {
        if (val === undefined || val === null || val === "") return fallback;
        const parsed = parseFloat(String(val).replace(',', '.'));
        return isNaN(parsed) ? fallback : parsed;
    },

    /**
     * Gram/ML değerlerini KG/L birimine ölçekler.
     */
    scaleToMainUnit: function(value, unitStr) {
        const u = this.trToEn(unitStr);
        if (u.includes("GR") || u.includes(" G") || u.includes("ML")) {
            return value / 1000;
        }
        return value;
    }
};

window.Utils = Utils;
