/**
 * unitHelper.js
 * Ürün isminden birim ayıklama ve ismi temizleme modülü. (v14.18)
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
 * Ürün isminden gramaj/hacim bilgisini ayıklar. (Gelişmiş v14.18)
 */
function extractUnitFromName(name) {
  if (!name) return null;
  
  // ÖNCELİK: Uzun birimler (LU, LI, KG, GR)
  // Bu regex 100'lü, 12'li gibi yapıları Litre (L) ile karıştırmadan yakalar
  const namePattern = /(\d+[.,]?\d*)\s*(KG|GR|G|ML|LT|LU|LI|L|ADET)/i; 
  const match = name.match(namePattern);
  
  if (match) {
    let val = match[1].replace(',', '.');
    let unit = match[2].toUpperCase();
    
    // Dönüşümler
    if (unit === "G") unit = "GR";
    if (unit === "LT") unit = "L";
    if (unit === "LI") unit = "LU"; // 12'li -> 12LU standardı
    
    return `${val} ${unit}`;
  }
  return null;
}

/**
 * Ürün ismindeki gereksiz birim, ambalaj ve sayı bilgilerini temizler.
 */
function cleanProductName(name) {
  if (!name) return "";
  
  let cleaned = name.toUpperCase();

  // 1. Gramaj ve hacimleri temizle (100'lü, 500GR, 5L, 7.5KG vb.)
  // ' işaretli veya işaretsiz sayıları ve birimleri temizler
  const unitPattern = /(\d+[.,]?\d*)\s*['’]?\s*(KG|GR|G|L|LT|ML|LU|LI|ADET)/gi;
  cleaned = cleaned.replace(unitPattern, ' ');
  
  // 2. Ekstra ambalaj ve tek harf kirliliklerini temizle
  const extraWords = ["TENEKE", "PET", "CAM", "SISE", "KOVA", "PAKET", "KOLI"];
  const extraPattern = new RegExp(`\\b(${extraWords.join('|')})\\b`, 'gi');
  cleaned = cleaned.replace(extraPattern, ' ');
  
  // 3. Sonda veya arada kalan anlamsız tek harfleri (I, Ü, İ gibi) temizle
  cleaned = cleaned.replace(/\b[A-ZÇĞİÖŞÜ]\b/g, ' '); 

  // Gereksiz boşlukları, tireleri ve özel karakterleri temizle
  return cleaned.replace(/[./'’\-–]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Ham metinden birimi ayıklar ve standartlaştırır.
 */
function normalizeUnit(rawUnit) {
  if (!rawUnit) return "ADET";
  let unit = rawUnit.toUpperCase().trim().replace(/[.'’]/g, '').replace(/\s+/g, ' ');
  
  // Regex: Önce uzun kalıplar (KG, GR, LU, LI)
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
  
  let bestMatch = pureUnit;
  let highestScore = 0;
  for (const std of STANDARD_UNITS) {
    const score = getSimilarity(pureUnit, std);
    if (score > highestScore) { highestScore = score; bestMatch = std; }
  }
  return highestScore >= 0.8 ? bestMatch : unit;
}

/**
 * Ürün objesini temizler
 */
function parseProduct(product) {
  if (!product) return null;
  
  let miktar = parseFloat(product.miktar) || 0;
  let rawBirim = (product.birim || product.birim_detay || "").toString();
  
  // Önce ürün isminden birim yakalamaya çalış (Daha güvenli)
  let nameUnit = extractUnitFromName(product.urun_adi);
  let finalBirim = normalizeUnit(rawBirim);

  // KRİTİK: Eğer isimden net bir gramaj veya "100LU" yakaladıysak, kutudaki (hatalı olabilen) birimin önüne geçsin.
  if (nameUnit && (finalBirim === "ADET" || finalBirim === "" || finalBirim.length < nameUnit.length)) {
    finalBirim = nameUnit;
  }

  // Sayısal temizlik (Strip quantity if it repeats)
  const qtyPattern = new RegExp(`^${miktar}\\s*`, 'i');
  if (finalBirim.match(qtyPattern)) {
    finalBirim = finalBirim.replace(qtyPattern, '').trim();
  }

  if (!finalBirim || finalBirim === "") finalBirim = "ADET";

  // En son ismi temizle (İçindeki az önce ayıklanan birimleri siler)
  let cleanedName = cleanProductName(product.urun_adi);

  // HESAPLAMA (Toplam Stok):
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
    urun_adi: cleanedName, // Artik "POŞET ÇAY Ü" yerine "POŞET ÇAY" kalacak
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
