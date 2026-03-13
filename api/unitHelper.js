/**
 * unitHelper.js
 * Birim ayıklama, standartlaştırma ve bulanık eşleşme (fuzzy matching) modülü.
 */

const STANDARD_UNITS = ["KG", "GR", "L", "ML", "ADET", "12LI", "30LU", "LU", "PAKET", "KOLI", "G", "LT"];

/**
 * İki metin arasındaki benzerlik oranını hesaplar (Dice's Coefficient).
 * 0 ile 1 arasında bir değer döner. 1 = Tam eşleşme.
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
  for (const b of bigrams1) {
    if (bigrams2.has(b)) intersection++;
  }

  return (2.0 * intersection) / (bigrams1.size + bigrams2.size);
}

/**
 * Ürün isminden birim bilgisini (Örn: 500GR, 5L) ayıklar.
 */
function extractUnitFromName(name) {
  if (!name) return null;
  // İsmin sonundaki veya içindeki 500GR, 1.5KG gibi yapıları yakala
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
 * Örn: "800GR" -> "GR", "30'LU" -> "30LU"
 */
function normalizeUnit(rawUnit) {
  if (!rawUnit) return "ADET";
  
  // Eğer sadece "ADET" veya türeviyse ve biz isimden daha iyi bir şey bulduysak onu kullanacağız.
  let unit = rawUnit.toUpperCase().trim()
    .replace(/[.'’]/g, '') // Nokta ve kesme işaretlerini temizle
    .replace(/\s+/g, ' ');  // Boşlukları tek boşluğa düşür

  // Regex ile sayı + birim kalıbı yakalama (Örn: "6 ADET", "30 KG")
  const pattern = /(\d+[.,]?\d*)\s*(KG|GR|G|L|LT|ML|LU|ADET)/i;
  const match = unit.match(pattern);
  
  if (match) {
    let val = match[1].replace(',', '.');
    let u = match[2].toUpperCase();
    if (u === "G") u = "GR";
    if (u === "LT") u = "L";
    return `${val} ${u}`;
  }

  // Eğer sayı yoksa doğrudan standart listede mi bak
  const pureUnit = unit.replace(/\s+/g, '');
  if (STANDARD_UNITS.includes(pureUnit)) return pureUnit;

  // Bulanık Eşleşme
  let bestMatch = pureUnit;
  let highestScore = 0;
  for (const std of STANDARD_UNITS) {
    const score = getSimilarity(pureUnit, std);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = std;
    }
  }

  return highestScore >= 0.8 ? bestMatch : unit;
}

/**
 * Bir ürün objesini alır, birimini normalize eder ve temizlenmiş ürün döner.
 */
function parseProduct(product) {
  if (!product) return null;
  
  let rawBirim = (product.birim || product.birim_detay || "").toString();
  let nameUnit = extractUnitFromName(product.urun_adi);
  
  let finalBirim = normalizeUnit(rawBirim);

  // KRİTİK DÜZELTME: Eğer isimden net bir birim bulduysak (Örn: 800 GR) 
  // ve gelen ham birim sadece "ADET" içeriyorsa, isimdeki birimi tercih et.
  if (nameUnit && (finalBirim.includes("ADET") || finalBirim === "ADET")) {
    finalBirim = nameUnit;
  }

  // Eğer "6 ADET" gibi bir şey kaldıysa ve isimde birim bulamadıysak, 
  // faturadaki miktar kutusuyla çakışmaması için sadece birimi de bırakabiliriz ama 
  // kullanıcı "kutucuğun içinde sadece ayıkladığımız birim kalsın" dediği için:
  
  return {
    ...product,
    birim: finalBirim,
    miktar: parseFloat(product.miktar) || 0
  };
}

module.exports = {
  normalizeUnit,
  parseProduct,
  extractUnitFromName,
  STANDARD_UNITS
};
