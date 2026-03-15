function faturaIsle(hamVeriler) {
  const islenmis = hesaplaVeDonustur(hamVeriler);
  if (islenmis.hata) return islenmis;

  // v14.78 - Merkezi utils.gs üzerinden isim eşleştirme (normalizeAd kullanılıyor)
  try {
    const urunlerList = supabaseGet("/rest/v1/urunler?select=ad,alias&limit=5000") || [];
    
    islenmis.urunler = islenmis.urunler.map(u => {
      const geminiAdiHam = (u.urun_adi_ham || u.ad || "").trim();
      const keyRaw = normalizeAd(geminiAdiHam);
      
      u.gemini_adi = geminiAdiHam; 
      u.match_status = "new";

      if (Array.isArray(urunlerList) && urunlerList.length > 0) {
        const match = urunlerList.find(dbU => {
          const dbKey = normalizeAd(dbU.ad);
          if (dbKey && (dbKey === keyRaw)) return true;
          
          let aliases = [];
          if (Array.isArray(dbU.alias)) aliases = dbU.alias;
          else if (typeof dbU.alias === 'string') {
            aliases = dbU.alias.replace(/[{}]/g, "").split(",").map(s => s.trim()).filter(s => s);
          }

          const aliasMatch = aliases.some(a => {
            const aKey = normalizeAd(a);
            return aKey && (aKey === keyRaw);
          });

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
