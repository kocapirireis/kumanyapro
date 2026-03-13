/**
 * unitHelper.js
 * "Makarna 60 | 500GR" mantığına uygun birim ayıklama modülü. (v14.12)
 */

const STANDARD_UNITS = ["KG", "GR", "L", "ML", "ADET", "12LI", "30LU", "LU", "PAKET", "KOLI", "G", "LT"];

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
 * Ürün isminden gramaj/hacim bilgisini ayıklar.
 */
function extractUnitFromName(name) {
  if (!name) return null;
  const namePattern = /(\d+[.,]?\d*)\s*(KG|GR|G|L|LT|ML|LU|ADET)/i;
  const match = name.match(namePattern);
  if (match) {
    let val = match[1].replace(',', '.');
    let unit = match[2].toUpperCase();
    if (unit === "G") unit = "GR";
    if (unit === "LT") unit = "L";
    return `${val} ${unit}`;
  }
  return null;
}

/**
 * Ham metinden birimi ayıklar ve standartlaştırır.
 */
function normalizeUnit(rawUnit) {
  if (!rawUnit) return "ADET";
  let unit = rawUnit.toUpperCase().trim().replace(/[.'’]/g, '').replace(/\s+/g, ' ');
  const pattern = /(\d+[.,]?\d*)\s*(KG|GR|G|L|LT|ML|LU|ADET)/i;
  const match = unit.match(pattern);
  if (match) {
    let val = match[1].replace(',', '.');
    let u = match[2].toUpperCase();
    if (u === "G") u = "GR";
    if (u === "LT") u = "L";
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
 * Ürün objesini "Makarna 60 | 500GR" mantığına göre işler.
 */
function parseProduct(product) {
  if (!product) return null;
  
  let miktar = parseFloat(product.miktar) || 0;
  let rawBirim = (product.birim || product.birim_detay || "").toString();
  let nameUnit = extractUnitFromName(product.urun_adi);
  let finalBirim = normalizeUnit(rawBirim);

  // 1. ADET TEMİZLİĞİ: Eğer birim "60 ADET" gibi miktar içeriyorsa, miktarı sil.
  // Örn: miktar=60, birim="60 ADET" -> "ADET"
  const qtyPattern = new RegExp(`^${miktar}\\s*`, 'i');
  if (finalBirim.match(qtyPattern)) {
    finalBirim = finalBirim.replace(qtyPattern, '').trim();
  }

  // 2. İSİM ÖNCELİĞİ: Eğer isimden 500GR gibi net bilgi bulduysak ve mevcut birim zayıfsa (ADET vb.) isme güven.
  if (nameUnit && (finalBirim === "" || finalBirim === "ADET" || finalBirim.includes("ADET"))) {
    finalBirim = nameUnit;
  }

  // 3. BOŞ KALIRSA: Eğer temizlik sonrası boş kaldıysa standarda dön.
  if (!finalBirim || finalBirim === "") finalBirim = "ADET";

  return {
    ...product,
    miktar: miktar,
    birim: finalBirim,
    birim_detay: finalBirim // Her iki kutu da temiz veriyi görsün
  };
}

module.exports = {
  normalizeUnit,
  parseProduct,
  extractUnitFromName,
  STANDARD_UNITS
};
