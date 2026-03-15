/**
 * calculations.gs
 * Matematiksel hesaplamalar ve birim çevrimlerini yöneten merkezi modül. (v8.0)
 */

/**
 * Ham birim ve miktar bilgisini işleyerek standart birim ve miktarı hesaplar.
 * Örn: miktar=8, birim="700GR" -> { miktar: 5.6, birim: "kg" }
 */
function birimHesapla(hamMiktar, hamBirim) {
  let miktar = parseFloat(String(hamMiktar).replace(',', '.')) || 0;
  let birimStr = (hamBirim || "").toUpperCase().trim();
  
  let miktarComputed = miktar;
  let birimTag = "ADET";

  // Regex: 500GR, 5L, 1.5KG gibi yapıları ayıkla
  // [1]: Sayı (500, 5, 1.5), [2]: Birim (GR, L, KG)
  const match = birimStr.match(/^([\d.,]+)\s*(KG|GR|G|L|LT|ML|LU|ADET|PAKET|KOLI)?$/i);
  
  if (match) {
    let carpan = parseFloat(match[1].replace(",", ".")) || 1;
    let tag = (match[2] || "ADET").toUpperCase();
    
    // TEMEL FORMÜL: Fatura Adedi x Paket Gramajı/Hacmi
    miktarComputed = miktar * carpan;
    
    if (tag === "GR" || tag === "G") {
      if (miktarComputed >= 1000) {
        miktarComputed = Math.round((miktarComputed / 1000) * 100) / 100;
        birimTag = "KG";
      } else {
        birimTag = "GR";
      }
    } else if (tag === "ML") {
      if (miktarComputed >= 1000) {
        miktarComputed = Math.round((miktarComputed / 1000) * 100) / 100;
        birimTag = "L";
      } else {
        birimTag = "ML";
      }
    } else if (tag === "L" || tag === "LT") {
      birimTag = "L";
    } else if (tag === "KG") {
      birimTag = "KG";
    } else {
      birimTag = "ADET";
    }
  } else {
    // Sayı yoksa (Sadece "KG" veya "ADET" yazıyorsa)
    if (birimStr.includes("KG")) birimTag = "KG";
    else if (birimStr.includes("GR") || birimStr === "G") birimTag = "GR";
    else if (birimStr.includes("L") || birimStr === "LT") birimTag = "L";
    else if (birimStr.includes("ML")) birimTag = "ML";
    else birimTag = "ADET";
  }

  return {
    miktar: miktarComputed,
    birim: birimTag
  };
}

/**
 * v8.7 - Zeki Dizi Bulucu (Intelligent Array Finder)
 * Bir obje içindeki ilk listeyi bulur veya objeyi listeye çevirir.
 */
function ensureArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  
  if (typeof data === 'object') {
    const keys = Object.keys(data);
    const listKey = keys.find(k => Array.isArray(data[k]));
    if (listKey) return data[listKey];
    return [data];
  }
  
  return [];
}

/**
 * Faturadan gelen ürünleri, mevcut stok verileriyle (isteğe bağlı) veya kendi içinde toplar.
 */
function stoklariHesapla(aiUrunler) {
  // v8.7 - Kesin Çözüm: Zeki Dizi Kontrolü
  const tData = ensureArray(aiUrunler);
  
  if (tData.length === 0) {
    Logger.log("No data found in Gemini response (stoklariHesapla)");
    return [];
  }

  const sonuclar = [];
  for (const u of tData) {
    const hamUrunAdi = (u.urun_adi || u.ad || "").trim();
    const ad = hamUrunAdi.toLowerCase();
    if (!ad) continue;

    const hesaplanan = birimHesapla(u.miktar, u.birim);
    const miktar = hesaplanan.miktar;
    const birim = hesaplanan.birim;

    const mevcut = sonuclar.find(x => x.ad === ad && x.birim === birim);
    if (mevcut) {
      mevcut.miktar = Math.round((mevcut.miktar + miktar) * 100) / 100;
      mevcut.toplam_stok_ai = mevcut.miktar + " " + birim.toUpperCase();
    } else {
      sonuclar.push({ 
        ad, 
        miktar, 
        birim, 
        birim_detay: u.birim || "", 
        toplam_stok_ai: miktar + " " + birim.toUpperCase(), 
        miktar_fatura: parseFloat(u.miktar) || 0, 
        guven: parseFloat(u.guven) || 0.8, 
        kategori: u.kategori || "diger",
        urun_adi_ham: hamUrunAdi // v14.57 - Ham ismi hafıza sistemi için koruyoruz
      });
    }
  }

  return sonuclar;
}

/**
 * Mevcut stok verisini Supabase'den çekip, yeni gelen miktarla toplar.
 * Kullanıcının "Stok Toplama" gereksinimini karşılar.
 */
function mevcutStoklaTopla(yeniUrunler) {
  // v8.7 - Kesin Çözüm: Zeki Dizi Kontrolü
  const tData = ensureArray(yeniUrunler);
  
  if (tData.length === 0) {
    Logger.log("No data found (mevcutStoklaTopla)");
    return [];
  }

  const mevcutVeri = stokOku() || { urunler: [] }; 
  const mevcutUrunler = mevcutVeri.urunler || [];
  
  return tData.map(yeni => {
    const mevcut = mevcutUrunler.find(m => urunEslestir(m.ad, yeni.ad));
    const eskiMiktar = mevcut ? mevcut.miktar : 0;
    
    return {
      ...yeni,
      eski_stok: eskiMiktar,
      yeni_toplam_stok: Math.round((eskiMiktar + yeni.miktar) * 100) / 100
    };
  });
}

/**
 * AI.gs promptu için Supabase'deki ürün isimlerini çeker.
 * (Eksik olan getMevcutUrunlerSupabase yerini alır)
 */
function getMevcutUrunlerSupabase() {
  try {
    const data = supabaseGet("/rest/v1/urunler?select=ad") || [];
    
    // v8.7 - Kesin Çözüm: Zeki Dizi Kontrolü
    const safetyData = ensureArray(data);
    
    if (safetyData.length === 0) {
      Logger.log("No products found in Supabase");
    }
    
    return safetyData.map(r => r.ad).join(", ");
  } catch (e) {
    Logger.log("Ürün listesi çekilemedi: " + e.message);
    return "";
  }
}
