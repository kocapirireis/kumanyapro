function response(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- EŞLEŞTIRME FONKSİYONLARI ---

/**
 * Türkçe karakterleri İngilizce karşılıklarına çevirir.
 * Frontend utils.js trToEn ile senkronize.
 */
function trToEn(str) {
  if (!str) return "";
  return String(str)
    .replace(/[İIı]/g, 'I').replace(/[Şş]/g, 'S')
    .replace(/[Çç]/g, 'C').replace(/[Ğğ]/g, 'G')
    .replace(/[Üü]/g, 'U').replace(/[Öö]/g, 'O')
    .toUpperCase();
}

/**
 * Ürün ismini eşleşme için normalleştirir.
 * Türkçe ekler (LÜ, Lİ) dahil tüm birim bilgilerini temizler.
 */
function normalizeAd(ad) {
  if (!ad) return "";
  let clean = trToEn(ad)
    // Birim + miktar + Türkçe ekleri (LI, LU, IK, UK) temizle
    .replace(/(\d+[.,]?\d*)\s*(KG|GR|GM|G|L|LT|ML|ADET|PAKET|KOLI|CL|MT|X|T)(LI|LU|IK|UK)?/gi, "")
    .replace(/\s*\d+\s*(GR|KG|ML|LT|L|G|ADET|PAKET|KOLI)(LI|LU|IK|UK)?/gi, "")
    .replace(/\(.*\)/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .trim();
  return clean;
}

function urunEslestir(a, b) {
  const na = normalizeAd(a), nb = normalizeAd(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  
  if (na.length <= 3 || nb.length <= 3) return na === nb;

  return na.includes(nb) || nb.includes(na);
}

function stokMapAra(stokMap, urunAdi) {
  if (stokMap[urunAdi] !== undefined) return stokMap[urunAdi];
  for (const key in stokMap) {
    if (urunEslestir(key, urunAdi)) return stokMap[key];
  }
  return 0;
}
