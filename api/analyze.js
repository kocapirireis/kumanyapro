const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PDFDocument } = require("pdf-lib");
const unitHelper = require("./unitHelper.js");

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

  console.log("--- ANALIZ v14.23 (3.1 Lite - Kararlı Sürüm) BAŞLADI ---");
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

    console.time("2_Gemini_3.1_Lite_Yanit_Suresi");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // v14.23 - Orijinal Model Geri Getirildi
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite-preview" 
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
          { text: "Extract invoice items into a JSON array named 'urunler'. Each object MUST have: {urun_adi, miktar, birim, birim_detay}. ONLY return JSON. Return minified JSON." }
        ]
      }],
      generationConfig: {
        temperature: 1.0,
        topK: 40,
        maxOutputTokens: 3500, // Uzun faturalar için genişletilmiş kapasite
        responseMimeType: "application/json"
      }
    });

    const response = await result.response;
    rawText = response.text();
    console.timeEnd("2_Gemini_3.1_Lite_Yanit_Suresi");

    console.time("3_JSON_Parse_Islemi");
    
    // v14.23 - Gelişmiş JSON Tamir (Geriye Dönük Ürün Kurtarma)
    let cleanJson = rawText.trim();
    let finalData = null;

    try {
        finalData = JSON.parse(cleanJson);
    } catch (parseErr) {
        console.warn("JSON Kesik Geldi, Tamir Ediliyor...");
        // Sondan başa doğru en son tam kapanmış objeyi (}) arar
        let lastStop = cleanJson.lastIndexOf('}');
        if (lastStop !== -1) {
            let fixed = cleanJson.substring(0, lastStop + 1);
            if (fixed.includes('"urunler":')) {
                fixed = fixed.replace(/,\s*$/, ""); // Varsa sondaki virgülü temizle
                fixed += ']}';
            } else {
                fixed += '}';
            }
            finalData = JSON.parse(fixed);
        } else {
            throw parseErr;
        }
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
      raw: rawText ? rawText.substring(Math.max(0, rawText.length - 150)) : "No response"
    });
  }
};
