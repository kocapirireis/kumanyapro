/**
 * KumanyaPro v4 - Supabase Backend (Google Apps Script)
 */

const CONFIG = {
  SUPABASE_URL: PropertiesService.getScriptProperties().getProperty('SUPABASE_URL'),
  SUPABASE_KEY: PropertiesService.getScriptProperties().getProperty('SUPABASE_KEY'),
  GUVENLIK_TOKEN: PropertiesService.getScriptProperties().getProperty('GUVENLIK_TOKEN'),
  GEMINI_API_KEY: PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')
};

function tokenKontrol(token) {
  const dogruToken = PropertiesService.getScriptProperties().getProperty('GUVENLIK_TOKEN');
  if (token === dogruToken) {
    return { basarili: true };
  } else {
    return { basarili: false, hata: "Gecersiz token" };
  }
}