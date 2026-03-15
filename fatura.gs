function faturaIsle(hamVeriler) {
  const islenmis = hesaplaVeDonustur(hamVeriler);
  if (islenmis.hata) return islenmis;

  // v14.58 - AKILLI İSİM HAFIZASI (ASIL BACKEND)
  try {
    const urunlerList = supabaseGet("/rest/v1/urunler?select=ad,alias&limit=5000") || [];
    
    const normalize = (str) => {
      if (!str) return "";
      // v14.64 - Birimleri ve sayıları temizle (Örn: "MAKARNA 500GR" -> "MAKARNA")
      let clean = str.toString().toLowerCase()
        .replace(/\d+[\s,.]*\d*\s*(kg|gr|g|l|lt|ml|adet|paket|koli|cl|mt|x)/gi, "")
        .replace(/\s+/g, " ").trim();
      
      // Türkçe karakterleri normalize et
      return clean
        .replace(/[ıİi]/g, 'i').replace(/[şŞ]/g, 's')
        .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g')
        .replace(/[üÜ]/g, 'u').replace(/[öÖ]/g, 'o')
        .replace(/[^a-z0-9]/g, ""); 
    };

    islenmis.urunler = islenmis.urunler.map(u => {
      const geminiAdiHam = (u.urun_adi_ham || u.ad || "").trim();
      const keyRaw = normalize(geminiAdiHam);
      
      u.gemini_adi = geminiAdiHam; 
      u.match_status = "new";

      if (Array.isArray(urunlerList) && urunlerList.length > 0) {
        const match = urunlerList.find(dbU => {
          const dbKey = normalize(dbU.ad);
          if (dbKey && (dbKey === keyRaw)) return true;
          
          let aliases = [];
          if (Array.isArray(dbU.alias)) aliases = dbU.alias;
          else if (typeof dbU.alias === 'string') {
            aliases = dbU.alias.replace(/[{}]/g, "").split(",").map(s => s.trim()).filter(s => s);
          }

          const aliasMatch = aliases.some(a => {
            const aKey = normalize(a);
            return aKey && (aKey === keyRaw);
          });

          if (!aliasMatch && keyRaw.length > 3) {
             // Debug logu ekleyelim (Eğer isim belli bir uzunluktaysa ve eşleşmediyse)
             // Logger.log(`Hafıza Sorgusu: [${keyRaw}] -> DB: [${dbKey}] Aliaslar: ${JSON.stringify(aliases)}`);
          }
          return aliasMatch;
        });

        if (match) {
          u.ad = match.ad;
          u.match_status = "matched";
        } else {
          Logger.log("Hafıza Eşleşmesi Bulunamadı: Aranan: " + keyRaw + " (Ham: " + geminiAdiHam + ")");
        }
      }
      return u;
    });
  } catch (e) {
    Logger.log("Hafıza eşleştirme hatası (Apps Script): " + e.message);
    // Hata olsa bile gemini_adi'ni doldurmaya çalışalım
    if (islenmis.urunler) {
      islenmis.urunler = islenmis.urunler.map(u => {
        if (!u.gemini_adi) u.gemini_adi = (u.urun_adi_ham || u.ad || "").toUpperCase().trim();
        if (!u.match_status) u.match_status = "new";
        return u;
      });
    }
  }

  return {
    "urunler": islenmis.urunler,
    "hata": null
  };
}
