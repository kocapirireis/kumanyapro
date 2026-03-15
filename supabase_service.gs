// --- SUPABASE YARDIMCI VE API FONKSİYONLARI ---

function getSupabaseHeaders() {
  const supabaseKey = CONFIG.SUPABASE_KEY || PropertiesService.getScriptProperties().getProperty('SUPABASE_KEY');
  if (!supabaseKey) throw new Error("SUPABASE_KEY bulunamadi.");
  
  return {
    "apikey": supabaseKey,
    "Authorization": "Bearer " + supabaseKey,
    "Content-Type": "application/json"
  };
}

function getSupabaseUrl() {
  const url = CONFIG.SUPABASE_URL || PropertiesService.getScriptProperties().getProperty('SUPABASE_URL');
  if (!url) throw new Error("SUPABASE_URL bulunamadi.");
  return url;
}

/** 
 * GET ISTEK 
 */
function supabaseGet(endpoint) {
  const options = {
    "method": "get",
    "headers": getSupabaseHeaders(),
    "muteHttpExceptions": true
  };
  const response = UrlFetchApp.fetch(getSupabaseUrl() + endpoint, options);
  return parseResponse(response);
}

/** 
 * POST ISTEK 
 */
function supabasePost(endpoint, payload) {
  const options = {
    "method": "post",
    "headers": getSupabaseHeaders(),
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  const response = UrlFetchApp.fetch(getSupabaseUrl() + endpoint, options);
  return parseResponse(response);
}

/** 
 * PATCH ISTEK 
 */
function supabasePatch(endpoint, payload) {
  const options = {
    "method": "patch",
    "headers": getSupabaseHeaders(),
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  const response = UrlFetchApp.fetch(getSupabaseUrl() + endpoint, options);
  return parseResponse(response);
}

/** 
 * DELETE ISTEK 
 */
function supabaseDelete(endpoint) {
  const options = {
    "method": "delete",
    "headers": getSupabaseHeaders(),
    "muteHttpExceptions": true
  };
  const response = UrlFetchApp.fetch(getSupabaseUrl() + endpoint, options);
  return parseResponse(response);
}

function parseResponse(response) {
  const code = response.getResponseCode();
  const text = response.getContentText();
  
  if (code >= 200 && code < 300) {
    if (!text) return { success: true };
    try {
      return JSON.parse(text);
    } catch (e) {
      Logger.log("PARSING_ERROR: Yanıt JSON formatında değil. İçerik özeti: " + text.substring(0, 100));
      if (text.trim().startsWith("<")) {
        throw new Error("Supabase bir HTML sayfası döndürdü (Muhtemelen bir hata sayfası veya login yönlendirmesi). HTTP " + code);
      }
      throw new Error("Yanıt ayrıştırılamadı: " + e.message);
    }
  } else {
    logHata("SUPABASE_ERROR", new Error("HTTP " + code + ": " + text));
    // v14.41 - Hata gizlenmiyor, doğrudan fırlatılıyor
    throw new Error("Supabase Hatası (HTTP " + code + "): " + text);
  }
}

// --- İŞ MANTIĞI VE VERİ ÇEKME FONKSİYONLARI ---

/**
 * AI.gs dosyasının promptu için Supabase'deki ürün isimlerini çeker.
 */
/**
 * Supabase "hareketler" tablosuna yeni bir stok hareketi ekler.
 * (v4.9 - Yeni Kolon Uyumluluğu)
 */
function insertHareket(ad, miktar, birim, kategori, faturaMiktar, birimDetay, notlar) {
  const payload = {
    "urun_adi": ad,
    "toplam_stok": miktar,      // Nihai hesaplanan rakam (5.6 vb) - Supabase'deki yeni kolon
    "birim": birim,
    "tip": "GIRIS",
    "kategori": kategori || "diger",
    "fatura_miktar": faturaMiktar,
    "birim_detay": birimDetay,
    "notlar": notlar || "Fatura ile eklendi",
    "tarih": new Date().toISOString()
  };
  
  return supabasePost("/rest/v1/hareketler", payload);
}
