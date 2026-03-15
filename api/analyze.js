import { isAuthorized, sendError } from '../utils/supabase.js';
import * as unitHelper from './unitHelper.js';

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    return sendError(res, 401, "Geçersiz veya eksik şifre.");
  }

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return sendError(res, 400, "Görüntü verisi eksik.");

    // AI API Simulation / Proxy Logic (GEMINI)
    // Bu kısım normalde harici bir servise gider, v21 backend yapısında bu dosya işlenir.
    console.log("[AI] Fatura analizi başlatılıyor...");
    
    // Simülasyon verisi (Gerçek akışta Gemini API çağrılır)
    const mockResult = {
        urunler: [
            { ad: "Örnek Ürün", miktar: 1, birim: "ADET" }
        ]
    };

    const finalData = {
        urunler: mockResult.urunler.map(u => unitHelper.parseProduct({ urun_adi: u.ad, miktar: u.miktar, birim: u.birim }))
    };

    res.status(200).json(finalData);

  } catch (err) {
    console.error("Fatura Analiz Hatası:", err);
    res.status(500).json({ error: "Fatura okunamadı", details: err.message });
  }
}
