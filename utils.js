/**
 * @module Utils
 * @description Metin, birim temizleme ve normalizasyon yardımcıları
 */

const Utils = {
    /**
     * Ürün ismini temizler ve standartlaştırır.
     * İsim sonundaki miktar ve birim ibarelerini (500GR, 5LT vb.) temizler.
     */
    normalizeAd: function(ad) {
        if (!ad) return "";
        let clean = String(ad).toUpperCase()
            // 1. Birim ve miktar ibarelerini temizle (500GR, 5 LT, 1KG vb.)
            .replace(/(\d+[.,]?\d*)\s*(KG|GR|GM|G|L|LT|ML|ADET|PAKET|KOLI|CL|MT|X|GR\.|KG\.)/gi, "")
            .replace(/\s*\d+\s*(GR|KG|ML|LT|L|G|ADET|PAKET|KOLI)\b/gi, "")
            // 2. Parantez içindeki ek bilgileri temizle
            .replace(/\(.*\)/g, "")
            // 3. Özel karakterleri ve fazla boşlukları temizle
            .replace(/\s+/g, " ").trim();
        
        // Türkçe karakter normalizasyonu ve sadece alfanümerik karakterler
        return clean
            .replace(/[İIı]/g, 'I').replace(/[Şş]/g, 'S')
            .replace(/[Çç]/g, 'C').replace(/[Ğğ]/g, 'G')
            .replace(/[Üü]/g, 'U').replace(/[Öö]/g, 'O')
            .replace(/[^A-Z0-9]/g, "")
            .trim();
    },

    /**
     * İki ürün isminin eşleşip eşleşmediğini kontrol eder.
     */
    isMatched: function(a, b) {
        const na = this.normalizeAd(a);
        const nb = this.normalizeAd(b);
        if (!na || !nb) return false;
        if (na === nb) return true;
        
        // 3 karakterden kısa ise sadece tam eşleşme (BAL, SU vb. koruması)
        if (na.length <= 3 || nb.length <= 3) return na === nb;

        // Bir ismin diğeri içinde geçip geçmediğini kontrol et
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
        const u = (unitStr || "").toUpperCase();
        if (u.includes("GR") || u.includes(" G") || u.includes("ML")) {
            return value / 1000;
        }
        return value;
    }
};

window.Utils = Utils;
