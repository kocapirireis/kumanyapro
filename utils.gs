function response(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- EŞLEŞTIRME FONKSİYONLARI ---

// v14.70 - Vercel analyze.js ile Senkronize Normalizasyon
function normalizeAd(ad) {
  if (!ad) return "";
  let clean = String(ad).toUpperCase()
    .replace(/(\d+[.,]?\d*)\s*(KG|GR|GM|G|L|LT|ML|ADET|PAKET|KOLI|CL|MT|X|GR\.|KG\.)/gi, "")
    .replace(/\s*\d+\s*(GR|KG|ML|LT|L|G| ADET| PAKET| KOLI)\b/gi, "")
    .replace(/\(\d+.*\)/g, "")
    .replace(/\s+/g, " ").trim();
  
  return clean
    .replace(/[İIı]/g, 'I').replace(/[Şş]/g, 'S')
    .replace(/[Çç]/g, 'C').replace(/[Ğğ]/g, 'G')
    .replace(/[Üü]/g, 'U').replace(/[Öö]/g, 'O')
    .replace(/[^A-Z0-9]/g, "")
    .trim(); 
}

function urunEslestir(a, b) {
  const na = normalizeAd(a), nb = normalizeAd(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  
  // 3 karakterden kısa ise sadece tam eşleşme
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