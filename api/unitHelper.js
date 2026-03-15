/**
 * unitHelper.js
 * Ürün isminden birim ayıklama modülü.
 */

const STANDARD_UNITS = ["KG", "GR", "L", "ML", "ADET", "PAKET", "KOLI", "G", "LT"];

function extractUnitFromName(name) {
  if (!name) return null;
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

function cleanProductName(name) {
  if (!name) return "";
  let cleaned = name.toUpperCase();
  const unitRegex = /[\(\[]?(\d+[.,]?\d*)\s*(KG|GR|G|ML|LT|L)(?![A-ZÇĞİÖŞÜ])[\)\]]?/gi;
  cleaned = cleaned.replace(unitRegex, " ");
  return cleaned.replace(/\s+/g, ' ').trim();
}

function parseProduct(product) {
  if (!product) return null;
  let miktar = parseFloat(product.miktar) || 0;
  let rawBirim = (product.birim || "ADET").toString();
  let nameUnit = extractUnitFromName(product.urun_adi);
  
  let finalBirim = rawBirim;
  if (nameUnit) finalBirim = nameUnit;

  return {
    ...product,
    urun_adi: cleanProductName(product.urun_adi) || "Bilinmeyen Ürün", 
    miktar: miktar,
    birim: finalBirim
  };
}

export {
  parseProduct,
  extractUnitFromName
};
