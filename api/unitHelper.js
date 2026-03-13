/**
 * unitHelper.js
 * Ürün isminden birim ayıklama modülü. (v14.30 - İsim Koruma Modu)
 */

const STANDARD_UNITS = ["KG", "GR", "L", "ML", "ADET", "12LI", "30LU", "LU", "PAKET", "KOLI", "G", "LT", "LU", "LI"];

/**
 * İki metin arasındaki benzerlik oranını hesaplar (Dice's Coefficient).
 */
function getSimilarity(s1, s2) {
  const v1 = (s1 || "").toUpperCase().replace(/\s+/g, '');
  const v2 = (s2 || "").toUpperCase().replace(/\s+/g, '');
  if (v1 === v2) return 1.0;
  if (!v1 || !v2 || v1.length < 2 || v2.length < 2) return 0;
  const bigrams1 = new Set();
  for (let i = 0; i < v1.length - 1; i++) bigrams1.add(v1.substring(i, i + 2));
  const bigrams2 = new Set();
  for (let i = 0; i < v2.length - 1; i++) bigrams2.add(v2.substring(i, i + 2));
  let intersection = 0;
  for (const b of bigrams1) if (bigrams2.has(b)) intersection++;
  return (2.0 * intersection) / (bigrams1.size + bigrams2.size);
}

/**
 * Ürün isminden gramaj/hacim bilgisini ayıklar. (SADECE OKUMA - SİLME YOK)
 */
function extractUnitFromName(name) {
  if (!name) return null;
  // \d+ ile sayı zorunlu hale getirildi (100LU, 500GR, 5L gibi)
  const namePattern = /(\d+[.,]?\d*)\s*(KG|GR|G|ML|LT|LU|LI|L|ADET)/i; 
  const match = name.match(namePattern);
  
  if (match) {
    let val = match[1].replace(',', '.');
    let unit = match[2].toUpperCase();
    if (unit === "G") unit = "GR";
    if (unit === "LT") unit = "L";
    if (unit === "LI") unit = "LU";
    return `${val} ${unit}`;
  }
  return null;
}

/**
 * İSİM TEMİZLEME - DEVRE DIŞI BIRAKILDI (v14.30)
 * Kullanıcı isteği: Ürün adına asla dokunma, sadece büyük harfe çevir.
 */
function cleanProductName(name) {
  if (!name) return "";
  // Sadece büyük harf ve gereksiz boşluk temizliği
  return name.toUpperCase().trim();
}

/**
 * Ham metinden birimi ayıklar ve standartlaştırır.
 */
function normalizeUnit(rawUnit) {
  if (!rawUnit) return "ADET";
  let unit = (rawUnit || "").toString().toUpperCase().trim().replace(/[.'’]/g, '').replace(/\s+/g, ' ');
  
  const pattern = /(\d+[.,]?\d*)\s*(KG|GR|G|LT|ML|LU|LI|L|ADET)/i;
  const match = unit.match(pattern);
  
  if (match) {
    let val = match[1].replace(',', '.');
    let u = match[2].toUpperCase();
    if (u === "G") u = "GR";
    if (u === "LT" || u === "L") u = "L";
    if (u === "LI") u = "LU";
    return `${val} ${u}`;
  }
  
  const pureUnit = unit.replace(/\s+/g, '');
  if (STANDARD_UNITS.includes(pureUnit)) return pureUnit;
  return unit;
}

/**
 * Ürün objesini işle (v14.30 - İSİM KORUMA)
 */
function parseProduct(product) {
  if (!product) return null;
  
  let miktar = parseFloat(product.miktar) || 0;
  let rawBirim = (product.birim || product.birim_detay || "ADET").toString();
  
  // 1. İsimden Birim Ayıkla (Sadece kopyalamak için)
  let nameUnit = extractUnitFromName(product.urun_adi);
  
  // 2. Birimi Normalize Et
  let finalBirim = normalizeUnit(rawBirim);

  // KRİTİK: İsimde bir gramaj varsa ve kutu boşsa veya "ADET" ise kopyala
  if (nameUnit && (finalBirim === "ADET" || finalBirim === "" || finalBirim.length < nameUnit.length)) {
    finalBirim = nameUnit;
  }

  if (!finalBirim) finalBirim = "ADET";

  // 3. İSİM KORUMA: Gemini ne verdiyse o kalacak (Sadece Büyük Harf)
  let finalName = (product.urun_adi || "").toUpperCase().trim();

  // 4. TOPLAM STOK HESAPLAMA
  let calculatedMiktar = miktar;
  let calculatedBirim = finalBirim;

  const mMatch = finalBirim.match(/^([\d.,]+)\s*(KG|GR|G|L|LT|ML|LU|LI|ADET)?$/i);
  if (mMatch) {
    let carpan = parseFloat(mMatch[1].replace(",", ".")) || 1;
    let tag = (mMatch[2] || "ADET").toUpperCase();
    let total = miktar * carpan;
    
    if (tag === "GR" || tag === "G") {
      if (total >= 1000) { calculatedMiktar = Math.round(total/10)/100; calculatedBirim = "KG"; }
      else { calculatedMiktar = total; calculatedBirim = "GR"; }
    } else if (tag === "ML") {
      if (total >= 1000) { calculatedMiktar = Math.round(total/10)/100; calculatedBirim = "L"; }
      else { calculatedMiktar = total; calculatedBirim = "ML"; }
    } else {
      calculatedMiktar = total;
      calculatedBirim = (tag === "LT" || tag === "LI") ? (tag === "LI" ? "LU" : "L") : tag;
    }
  }

  return {
    ...product,
    urun_adi: finalName, // Geminiden gelen isim korunuyor
    miktar: miktar,
    birim: finalBirim,
    birim_detay: finalBirim,
    toplam_stok_ai: `${calculatedMiktar} ${calculatedBirim}`
  };
}

module.exports = {
  normalizeUnit,
  parseProduct,
  extractUnitFromName,
  STANDARD_UNITS
};
