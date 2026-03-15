/**
 * @module Utils
 * @description Metin, birim temizleme ve normalizasyon yardımcıları
 */

const Utils = {
    /**
     * Ürün ismini temizler ve standartlaştırır.
     * İsim sonundaki miktar ve birim ibarelerini (500GR, 5LT vb.) temizler.
     */
    /**
     * Ürün ismini tespiti ve eşleşme için STANDARTLAŞTIRIR.
     * Boşlukları siler, sadece harf ve rakam bırakır.
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
            .replace(/[İIı]/g, 'I').replace(/[Şş]/g, 'S')
            .replace(/[Çç]/g, 'C').replace(/[Ğğ]/g, 'G')
            .replace(/[Üü]/g, 'U').replace(/[Öö]/g, 'O')
            .replace(/[^A-Z0-9]/g, "")
            .trim();
        return clean;
    },

    /**
     * Ürün ismini EKRAN GÖSTERİMİ için temizler.
     * Miktar ibarelerini siler ama kelimeler arası boşlukları korur.
     */
    cleanAd: function(ad) {
        if (!ad) return "";
        let clean = String(ad).toUpperCase()
            // 1. Birim, miktar ve Türkçe ekleri (Lİ, LÜ vb.) temizle
            // Örn: 100 LÜ, 12 Lİ, 500GR, 5LT
            .replace(/(\d+[.,]?\d*)\s*(ADET|PAKET|KOLI|GRAM|GR|KG|ML|LT|CL|MT|GM|L|G|X|T)(Ü|İ|LI|Lİ|LU|LÜ|LİK|LUK)?\.?\b/gi, "")
            .replace(/\s*\d+\s*(ADET|PAKET|KOLI|KG|GR|ML|LT|L|G|T)(Ü|İ|LI|Lİ|LU|LÜ|LİK|LUK)?\.?\b/gi, "")
            // 2. Parantezleri ve içeriğini temizle
            .replace(/\(.*\)/g, "")
            // 3. Özel karakterleri boşluğa çevir
            .replace(/[*\-_#]/g, " ")
            // 4. Fazla boşlukları temizle
            .replace(/\s+/g, " ").trim();
        
        // 5. Sondaki anlamsız tekil karakterleri temizle
        clean = clean.replace(/\s+[A-Z0-9İIŞŞĞĞÜÜÖÖ]$/g, "");
            
        return clean.trim();
    },

    /**
     * Birim detay metninden ana birimi (KG, L, ADET) tahmin eder.
     */
    getDisplayUnit: function(birimDetay) {
        if (!birimDetay) return "ADET";
        const bd = birimDetay.toUpperCase().trim().replace(/[.]/g, "");
        
        // KG Grubu (Hassas eşleşme: Boşluklu veya boşluksuz)
        if (bd.match(/(\d+|^)\s*(KG|GRAM|GR|G|GM)(\s|$)/i) || bd.includes("KG") || bd.includes("GRAM")) return "KG";
        
        // L Grubu (Hassas eşleşme: Boşluklu veya boşluksuz)
        // Yanına ek gelirse (LÜ, Lİ gibi) ADET'e düşer, saf L veya LT ise L olur.
        if (bd.match(/(\d+|^)\s*(LT|ML|CL|L)(\s|$)/i) || bd.includes("LT") || bd.includes("ML") || bd.includes(" L ")) return "L";
        
        return "ADET";
    },

    /**
     * Ürün adından çıkarılan miktar bilgisini (5L, 500GR vb.) geri getirir.
     */
    extractBirimDetay: function(ad) {
        if (!ad) return "";
        // İsimden miktar + birim + ek (LI, LÜ vb.) yapısını yakalar
        const match = String(ad).match(/(\d+[.,]?\d*)\s*(ADET|PAKET|KOLI|GRAM|GR|KG|ML|LT|CL|MT|GM|L|G|X|T)(Ü|İ|LI|Lİ|LU|LÜ|LİK|LUK)?\.?\b/i);
        if (match) {
            return match[0].toUpperCase().replace(/[.]/g, "").trim();
        }
        return "";
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
