/**
 * unitHelper.js
 * Ürün isminden birim ayıklama modülü. (v14.36 - 'LÜ/'Lİ Kesin Çözüm)
 */

const STANDARD_UNITS = ["KG", "GR", "L", "ML", "ADET", "PAKET", "KOLI", "G", "LT"];

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
  
  // v14.36: Önce uzun ekleri kontrol et (100'LÜ, 12'Lİ gibi)
  // Bu ekler 'L' (Litre) ile karışmamalı
  const longUnitPattern = /(\d+[.,]?\d*)\s*['\s-]*(LÜ|Lİ|LU|LI|ADET|PAKET|KOLİ|KOLI)/i;
  const longMatch = name.match(longUnitPattern);
  if (longMatch) {
    return `${longMatch[1]} ADET`; // 100'LÜ -> 100 ADET
  }

  // Standart birimler (KG, GR, L, ML)
  // L harfini yakalarken arkasından harf gelmediğinden emin ol (\b veya boşluk)
  const stdPattern = /(\d+[.,]?\d*)\s*(KG|GR|G|ML|LT|L)(?![A-ZÇĞİÖŞÜ])/i; 
  const match = name.match(stdPattern);
  
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
 * ÜRÜN İSMİNİ TEMİZLE (v14.36)
 * 100'LÜ, 12'Lİ, 500GR, 5L gibi ifadelerin tamamını siler.
 * Kesme işareti ve sonrasındaki ekleri (Ü, İ, LU, LI) tam yakalar.
 */
function cleanProductName(name) {
  if (!name) return "";
  let cleaned = name.toUpperCase();

  // 1. 'LÜ, 'Lİ, -LÜ, LU gibi özel ekli adetleri temizle (Örn: 100'LÜ, 12'Lİ)
  const suffixRegex = /[\(\[]?(\d+[.,]?\d*)\s*['\s-]*(LÜ|Lİ|LU|LI|ADET)[\)\]]?/gi;
  cleaned = cleaned.replace(suffixRegex, " ");

  // 2. Standart birimleri temizle (KG, GR, L, ML)
  // Arkasından harf gelmeyen L'leri yakalar (Litre olanlar)
  const unitRegex = /[\(\[]?(\d+[.,]?\d*)\s*(KG|GR|G|ML|LT|L)(?![A-ZÇĞİÖŞÜ])[\)\]]?/gi;
  cleaned = cleaned.replace(unitRegex, " ");

  // 3. Temizlik sonrası bozulan boşlukları düzelt
  return cleaned.replace(/\s+/g, ' ').trim();
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
    if (u === "LI" || u === "LU") return "ADET"; // 100'lü gibi birimler adet sayılmalı
    return `${val} ${u}`;
  }
  
  const pureUnit = unit.replace(/\s+/g, '');
  if (STANDARD_UNITS.includes(pureUnit)) return pureUnit;
  return unit;
}

/**
 * Ürün objesini işle (v14.36 - EK VE HARF ARTIĞI KORUMASI)
 */
function parseProduct(product) {
  if (!product) return null;
  
  let miktar = parseFloat(product.miktar) || 0;
  let rawBirim = (product.birim || product.birim_detay || "ADET").toString();
  
  // 1. İsimden Birim Ayıkla
  let nameUnit = extractUnitFromName(product.urun_adi);
  
  // 2. Birimi Normalize Et
  let finalBirim = normalizeUnit(rawBirim);

  if (nameUnit && (finalBirim === "ADET" || finalBirim === "" || finalBirim.length < nameUnit.length)) {
    finalBirim = nameUnit;
  }

  if (!finalBirim) finalBirim = "ADET";

  // 3. İSİM TEMİZLEME
  let finalName = cleanProductName(product.urun_adi);

  // 4. TOPLAM STOK HESAPLAMA
  let calculatedMiktar = (isNaN(miktar) || miktar === null) ? 0 : miktar;
  let calculatedBirim = finalBirim || "ADET";

  const mMatch = calculatedBirim.match(/^([\d.,]+)\s*(KG|GR|G|L|LT|ML|LU|LI|ADET)?$/i);
  if (mMatch) {
    let carpan = parseFloat(mMatch[1].replace(",", ".")) || 1;
    let tag = (mMatch[2] || "ADET").toUpperCase();
    let total = calculatedMiktar * carpan;
    
    if (isNaN(total)) total = calculatedMiktar;
    
    if (tag === "GR" || tag === "G") {
      if (total >= 1000) { calculatedMiktar = Math.round(total/10)/100; calculatedBirim = "KG"; }
      else { calculatedMiktar = total; calculatedBirim = "GR"; }
    } else if (tag === "ML") {
      if (total >= 1000) { calculatedMiktar = Math.round(total/10)/100; calculatedBirim = "L"; }
      else { calculatedMiktar = total; calculatedBirim = "ML"; }
    } else {
      calculatedMiktar = total;
      calculatedBirim = (tag === "LT" || tag === "LI") ? (tag === "LI" ? "LU" : "L") : tag;
      if (tag === "LU" || tag === "LI") calculatedBirim = "ADET";
    }
  }

  // Final NaN Protection
  if (isNaN(calculatedMiktar)) calculatedMiktar = 0;
  if (calculatedBirim === "NaN" || !calculatedBirim) calculatedBirim = "ADET";

  return {
    ...product,
    urun_adi: finalName || "Bilinmeyen Ürün", 
    miktar: isNaN(miktar) ? 0 : miktar,
    birim: finalBirim || "ADET",
    birim_detay: finalBirim || "ADET",
    toplam_stok_ai: `${calculatedMiktar} ${calculatedBirim}`
  };
}

module.exports = {
  normalizeUnit,
  parseProduct,
  extractUnitFromName,
  STANDARD_UNITS
};
