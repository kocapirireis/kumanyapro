function stokOku() {
  const tData = supabaseGet("/rest/v1/urunler?select=*&order=ad.asc") || [];
  const hData = supabaseGet("/rest/v1/hareketler?select=*&order=tarih.desc") || [];

  // v14.41 - Dizi Kontrolü ve Hata Yönetimi
  const safetyTData = Array.isArray(tData) ? tData : [];
  const safetyHData = Array.isArray(hData) ? hData : [];

  const stokMap = {};
  // Tersten (tarih.asc gibi) hesaplamak için kopyasını çeviriyoruz veya veriyi ona göre işliyoruz
  // hData desc geldiği için stok hesaplaması için geçici bir asc listeye ihtiyaç var
  [...safetyHData].reverse().forEach(r => {
    const ad = r.urun_adi;
    const miktar = parseFloat(r.toplam_stok || r.miktar) || 0;
    const tip = r.tip;
    
    if (tip === 'BASLANGIC' || tip === 'SAYIM') {
      stokMap[ad] = miktar;
    } else if (tip === 'GIRIS') {
      stokMap[ad] = (stokMap[ad] || 0) + miktar;
    } else if (tip === 'CIKIS') {
      stokMap[ad] = (stokMap[ad] || 0) - miktar;
    }
  });

  const urunler = safetyTData.map(r => {
    const mevS = stokMapAra(stokMap, r.ad);
    return {
      id: r.id, ad: r.ad, birim: r.birim, miktar: mevS, minStok: r.min_stok || r.minStok, kategori: r.kategori, takip: (r.takip === 'EVET' || r.takip === true)
    };
  });

  // En güncel 50 hareket (Zaten desc geldiği için slice yeterli)
  const sonHareketler = safetyHData.slice(0, 50).map(r => ({
    tarih: r.tarih, urun_adi: r.urun_adi, miktar: r.toplam_stok || r.miktar, birim: r.birim, tip: r.tip, not: r.notlar || r.not, id: r.id
  }));

  return { urunler, sonHareketler };
}

/**
 * v6.0 - Bulk Insert (Toplu Kayıt)
 * Tüm ürünleri ve hareketleri tek bir seferde kaydeder.
 */
function stoklariKaydet(veriPaketi) {
  const { urunler, tip } = veriPaketi;
  return stokEkle(urunler, tip);
}

function stokEkle(urunler, tip) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    // v14.50 - Kesin Tablo Adı: 'urunler'
    let tData = supabaseGet("/rest/v1/urunler?select=id,ad,alias") || [];
    if (!Array.isArray(tData)) tData = [];
    
    const existingUrunler = tData.map(r => r.ad);
    const tarih = new Date().toISOString();
    const rowsToAppend = [];
    const newUrunler = [];
    const aliasesToUpdate = [];

    urunler.forEach(item => {
      const guncelAd = (item.ad || "").trim();
      const hamGeminiAdi = (item.eslestirilen_alias || "").trim();
      const itemId = item.id || "";

      // v14.75 - Resmi İsim Belirleme
      let resmiAd = guncelAd;
      let urun = null;

      if (itemId) {
        urun = tData.find(u => u.id == itemId);
      } else {
        urun = tData.find(u => {
          if (urunEslestir(u.ad, guncelAd)) return true;
          let aliases = Array.isArray(u.alias) ? u.alias : (typeof u.alias === 'string' ? u.alias.replace(/[{}]/g, "").split(",").map(s => s.trim()).filter(s => s) : []);
          return aliases.some(a => urunEslestir(a, guncelAd));
        });
      }

      if (urun) {
        resmiAd = urun.ad; // Matematik için resmi ismi kullan
        // v14.70 - Alias Kayıt
        if (hamGeminiAdi && hamGeminiAdi.toUpperCase() !== resmiAd.toUpperCase()) {
          let currentAliases = new Set();
          if (Array.isArray(urun.alias)) urun.alias.forEach(a => currentAliases.add(a.toUpperCase().trim()));
          else if (typeof urun.alias === 'string') {
            urun.alias.replace(/[{}]/g, "").split(",").map(s => s.trim().toUpperCase()).filter(s => s).forEach(a => currentAliases.add(a));
          }

          const normalizedHamAd = hamGeminiAdi.toUpperCase().trim();
          if (!currentAliases.has(normalizedHamAd)) {
            const updatedAliases = Array.from(currentAliases);
            updatedAliases.push(hamGeminiAdi);
            aliasesToUpdate.push({ ad: urun.ad, alias: updatedAliases });
            urun.alias = updatedAliases;
          }
        }
      } else {
        // Yeni ürün kaydı
        newUrunler.push({ 
          ad: guncelAd, 
          birim: item.birim || 'Adet', 
          min_stok: 0, 
          kategori: item.kategori || 'diger', 
          takip: true,
          alias: hamGeminiAdi ? [hamGeminiAdi] : [] 
        });
        tData.push({ ad: guncelAd, alias: hamGeminiAdi ? [hamGeminiAdi] : [] });
      }

      // v14.73 - Kayıt İşlemleri (Resmi İsimle)
      if (tip === 'GIRIS' && item.eskiStok !== undefined && item.eskiStok !== "" && !isNaN(parseFloat(item.eskiStok))) {
        rowsToAppend.push({ 
          tarih: tarih, urun_adi: resmiAd, toplam_stok: parseFloat(item.eskiStok.toString().replace(',', '.')), 
          birim: item.birim || 'Adet', tip: 'SAYIM', notlar: 'Fatura oncesi manuel duzeltme', id: Utilities.getUuid(),
          fatura_miktar: 0, birim_detay: '' 
        });
      }

      const islemTip = (tip === 'BAŞLANGIÇ' || tip === 'BASLANGIC') ? 'BASLANGIC' : tip;
      rowsToAppend.push({ 
        tarih: tarih, urun_adi: resmiAd, toplam_stok: parseFloat(item.toplam_stok || item.miktar || 0), 
        birim: item.birim || 'Adet', tip: islemTip, fatura_miktar: parseFloat(item.fatura_miktar) || 0,
        birim_detay: item.birim_detay || '', notlar: item.notlar || '', id: Utilities.getUuid() 
      });
    });

    // v14.67 - HTTP 400 Hatasını Önlemek İçin Normalizasyon
    const normalizePayload = (arr) => {
      if (arr.length === 0) return arr;
      const allKeys = [...new Set(arr.flatMap(Object.keys))];
      return arr.map(obj => {
        const newObj = {};
        allKeys.forEach(k => newObj[k] = obj[k] !== undefined ? obj[k] : null);
        return newObj;
      });
    };

    // 1. Yeni Ürünleri Kaydet
    if (newUrunler.length > 0) supabasePost("/rest/v1/urunler", normalizePayload(newUrunler));

    // 2. Hareketleri Kaydet
    if (rowsToAppend.length > 0) supabasePost("/rest/v1/hareketler", normalizePayload(rowsToAppend));

    // v14.63 - Alias güncellemelerini toplu (fetchAll) yaparak hızlandıralım
    if (aliasesToUpdate.length > 0) {
      const baseUrl = getSupabaseUrl();
      const headers = getSupabaseHeaders();
      const requests = aliasesToUpdate.map(upd => ({
        url: baseUrl + `/rest/v1/urunler?ad=eq.${encodeURIComponent(upd.ad)}`,
        method: "patch",
        headers: headers,
        payload: JSON.stringify({ alias: upd.alias }),
        muteHttpExceptions: true
      }));

      const responses = UrlFetchApp.fetchAll(requests);
      responses.forEach((res, index) => {
        const code = res.getResponseCode();
        if (code < 200 || code >= 300) {
          Logger.log("!! ALIAS KAYIT HATASI !! -> Ürün: " + aliasesToUpdate[index].ad + " Kod: " + code);
        }
      });
    }

    return true;
  } catch (e) {
    logHata("stokEkle", e);
    throw e;
  } finally {
    try { lock.releaseLock(); } catch (e) {} 
  }
}

function hareketGeriAl(id) {
  Logger.log("Geri alma isteği ID: " + id);
  supabaseDelete("/rest/v1/hareketler?id=eq." + id);
  return true;
}

function topluHareketGeriAl(ids) {
  if (!ids || !Array.isArray(ids) || ids.length === 0) return true;
  Logger.log("Toplu geri alma isteği. Adet: " + ids.length);
  
  const idString = ids.map(id => `"${id}"`).join(',');
  supabaseDelete(`/rest/v1/hareketler?id=in.(${idString})`);
  
  Logger.log("Toplu geri alma tamamlandı.");
  return true;
}

function urunGecmisiSifirla(urunAdi, yeniBaslangic) {
  supabaseDelete(`/rest/v1/hareketler?urun_adi=eq.${encodeURIComponent(urunAdi)}`);
  
  supabasePost("/rest/v1/hareketler", [{
    tarih: new Date().toISOString(), urun_adi: urunAdi, toplam_stok: yeniBaslangic, birim: "", tip: "BASLANGIC", notlar: "Sifirlama sonrasi", id: Utilities.getUuid()
  }]);
  
  return true;
}

function tumSistemiSifirla(onayKodu) {
  if (onayKodu !== 'SIFIRLA') throw new Error("Onay kodu hatali.");
  supabaseDelete("/rest/v1/urunler?ad=not.is.null");
  supabaseDelete("/rest/v1/hareketler?id=not.is.null");
  return true;
}