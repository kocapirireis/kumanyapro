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
  const v1 = s1.toUpperCase().replace(/\s+/g, '');
  const v2 = s2.toUpperCase().replace(/\s+/g, '');
  
  if (v1 === v2) return 1.0;
  if (v1.length < 2 || v2.length < 2) return 0;

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
 * Ham metinden birimi ayıklar ve standartlaştırır.
 * Örn: "800GR" -> "GR", "30'LU" -> "30LU"
 */
function normalizeUnit(rawUnit) {
  if (!rawUnit) return "ADET";
  
  let unit = rawUnit.toUpperCase().trim()
    .replace(/[.'’]/g, '') // Nokta ve kesme işaretlerini temizle
    .replace(/\s+/g, '');  // Boşlukları kaldır

  // 1. Doğrudan standart listede var mı?
  if (STANDARD_UNITS.includes(unit)) return unit;

  // 2. Regex ile kalıp yakalama
  const patterns = [
    { regex: /(\d+)\s*(KG|GR|G|L|LT|ML|LU|ADET)/i, transform: (m) => m[1] + m[2].toUpperCase() },
    { regex: /(KG|GR|G|L|LT|ML|LU|ADET)/i, transform: (m) => m[1].toUpperCase() }
  ];

  for (const p of patterns) {
    const match = unit.match(p.regex);
    if (match) {
        const found = p.transform(match);
        if (STANDARD_UNITS.includes(found)) return found;
        if (found === "G") return "GR";
        if (found === "LT") return "L";
    }
  }

  // 3. Bulanık Eşleşme (Fuzzy Match - %80 eşik)
  let bestMatch = unit;
  let highestScore = 0;

  for (const std of STANDARD_UNITS) {
    const score = getSimilarity(unit, std);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = std;
    }
  }

  return highestScore >= 0.8 ? bestMatch : unit;
}

module.exports = {
  normalizeUnit,
  STANDARD_UNITS
};
