const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PDFDocument } = require("pdf-lib");
const unitHelper = require("./unitHelper.js");

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

  console.log("--- ANALIZ v14.21 (Gelişmiş JSON Tamir) BAŞLADI ---");
  console.time("Toplam_Sure");

  let rawText = "";

  try {
    console.time("1_PDF_Hazirlama");
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Buffer.from(cleanBase64, 'base64');

    const pdfDoc = await PDFDocument.create();
    let image;
    try {
      image = await pdfDoc.embedJpg(imageBytes);
    } catch (e) {
      image = await pdfDoc.embedPng(imageBytes);
    }

    const scale = 0.5;
    const dims = image.scale(scale);
    const page = pdfDoc.addPage([dims.width, dims.height]);
    page.drawImage(image, { x: 0, y: 0, width: dims.width, height: dims.height });
    const pdfBytes = await pdfDoc.save();
    console.timeEnd("1_PDF_Hazirlama");

    console.time("2_Gemini_Lite_Yanit_Suresi");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // v14.21 - Daha stabil model ismi ve konfigurasyon
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash" // Flash 1.5 daha derin JSON destegi sunar
    });

    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          {
            inlineData: {
              data: Buffer.from(pdfBytes).toString("base64"),
              mimeType: "application/pdf"
            }
          },
          { text: "Extract invoice items into a JSON array named 'urunler'. Each object: {urun_adi, miktar, birim, birim_detay}. ONLY return JSON. Return minified JSON." }
        ]
      }],
      generationConfig: {
        temperature: 0.1, // Daha az 'yaratıcılık', daha stabil JSON
        topK: 1,
        maxOutputTokens: 4096, // 41+ satır için güvenli sınır
        responseMimeType: "application/json"
      }
    });

    const response = await result.response;
    rawText = response.text();
    console.timeEnd("2_Gemini_Lite_Yanit_Suresi");

    console.time("3_JSON_Parse_Islemi");
    
    // v14.21 - MEGA JSON TAMIR: Döngüsel Kurtarma
    let cleanJson = rawText.trim();
    let finalData = null;

    // JSON zaten tam ise direkt parse et
    try {
        finalData = JSON.parse(cleanJson);
    } catch (initialErr) {
        console.warn("JSON yarım geldi, tamir deneniyor...");
        
        // Yarım kalmış metni adım adım tamir et
        let attempt = cleanJson;
        let success = false;
        
        // Sondan geriye en son kapalı objeyi (}) bulana kadar dene
        while (attempt.length > 5 && !success) {
            let lastBrace = attempt.lastIndexOf('}');
            if (lastBrace === -1) break;
            
            attempt = attempt.substring(0, lastBrace + 1);
            
            // JSON yapısını zorla kapat (Trailing comma riskini de temizle)
            let tryFix = attempt;
            if (tryFix.includes('"urunler":')) {
                tryFix = tryFix.replace(/,\s*$/, ""); // Sondaki fazlalık virgülü sil
                tryFix += ']}';
            } else {
                tryFix += '}';
            }

            try {
                finalData = JSON.parse(tryFix);
                success = true;
                console.log("JSON başarıyla tamir edildi. Ürün sayısı:", finalData.urunler?.length);
            } catch (fixErr) {
                // Bu parantez de hatalıymış, bir öncekine bak
                attempt = attempt.substring(0, attempt.length - 1);
            }
        }
        
        if (!success) throw new Error("JSON Tamir Edilemedi: " + initialErr.message);
    }
    
    // UnitHelper Entegrasyonu
    if (finalData.urunler && Array.isArray(finalData.urunler)) {
      finalData.urunler = finalData.urunler
        .map(item => unitHelper.parseProduct(item))
        .filter(item => item !== null);
    }

    console.timeEnd("3_JSON_Parse_Islemi");
    console.timeEnd("Toplam_Sure");
    res.status(200).json(finalData);

  } catch (err) {
    console.error("Vercel Backend Hatası:", err);
    res.status(500).json({ 
      error: "Analiz Verisi Okunamadı", 
      details: err.message,
      raw: rawText ? rawText.substring(Math.max(0, rawText.length - 200)) : "No response"
    });
  }
};
