/**
 * @module Alias
 * @description Ürün eşleştirme ve hafıza (alias) yönetimi
 */

const Alias = {
    /**
     * Faturadan gelen ismi veritabanındaki ürünlerle eşleştirir.
     * @param {string} incomingName - Faturadaki ürün adı
     * @param {Array} dbProducts - Veritabanındaki ürün listesi
     * @returns {Object|null} Eşleşen ürün bilgisi (id, ad) veya null
     */
    findMatch: function(incomingName, dbProducts) {
        if (!incomingName || !dbProducts) return null;

        const targetName = incomingName.trim();
        
        // 1. Doğrudan İsim Eşleşmesi (Normalleştirilmiş)
        const directMatch = dbProducts.find(p => Utils.isMatched(p.ad, targetName));
        if (directMatch) return directMatch;

        // 2. Alias (Takma Ad) Dizisi İçinde Arama
        const aliasMatch = dbProducts.find(p => {
            let aliases = [];
            if (Array.isArray(p.alias)) {
                aliases = p.alias;
            } else if (typeof p.alias === 'string') {
                // PostgreSQL Array formatını ({alias1,alias2}) temizle ve diziye çevir
                aliases = p.alias.replace(/[{}]/g, "").split(",").map(s => s.trim()).filter(s => s);
            }
            
            return aliases.some(a => Utils.isMatched(a, targetName));
        });

        return aliasMatch || null;
    },

    /**
     * Yeni bir takma adı hafızaya alıp almamaya karar verir.
     * @param {Object} product - Mevcut ürün
     * @param {string} newAliasCandidate - Yeni isim adayı (Gemini'den gelen orijinal isim)
     * @returns {Array|null} Güncellenmiş alias dizisi veya null (gerek yoksa)
     */
    getUpdatedAliases: function(product, newAliasCandidate) {
        if (!product || !newAliasCandidate) return null;
        
        const officialName = product.ad.toUpperCase().trim();
        const candidate = newAliasCandidate.toUpperCase().trim();

        // Eğer aday isim zaten resmi isimle aynıysa kaydetmeye gerek yok
        if (candidate === officialName) return null;

        let currentAliases = new Set();
        if (Array.isArray(product.alias)) {
            product.alias.forEach(a => currentAliases.add(a.toUpperCase().trim()));
        } else if (typeof product.alias === 'string') {
            product.alias.replace(/[{}]/g, "").split(",")
                .map(s => s.trim().toUpperCase())
                .filter(s => s)
                .forEach(a => currentAliases.add(a));
        }

        // Eğer aday zaten alias listesinde varsa kaydetmeye gerek yok
        if (currentAliases.has(candidate)) return null;

        // Yeni ismi ekle ve diziyi döndür
        const updatedList = Array.from(currentAliases);
        updatedList.push(newAliasCandidate.trim());
        return updatedList;
    }
};

window.Alias = Alias;
