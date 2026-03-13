const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PDFDocument } = require("pdf-lib");
const unitHelper = require("./unitHelper.js");

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

  console.log("--- ANALIZ v14.25 (Cerrahi JSON Sanitizer) BAŞLADI ---");
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
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

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
          { text: "Extract invoice items into a JSON array named 'urunler'. Each object MUST have: {urun_adi, miktar, birim, birim_detay}. ONLY return the JSON object." }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        maxOutputTokens: 4000,
        responseMimeType: "application/json"
      }
    });

    const response = await result.response;
    rawText = response.text().trim();
    console.timeEnd("2_Gemini_Lite_Yanit_Suresi");

    console.time("3_JSON_Parse_Islemi");
    
    // v14.25 - CERRAHİ TEMİZLİK (Sanitizer)
    let processedJson = rawText;

    // 1. Gereksiz Markdown ve ön/son ekleri temizle
    const firstBrace = processedJson.indexOf('{');
    const lastBrace = Math.max(processedJson.lastIndexOf('}'), processedJson.lastIndexOf(']'));
    
    if (firstBrace !== -1 && lastBrace !== -1) {
        processedJson = processedJson.substring(firstBrace, lastBrace + 1);
    }

    let finalData = null;
    try {
        finalData = JSON.parse(processedJson);
    } catch (err) {
        console.warn("Otomatik Tamir Başlıyor...");
        
        // 2. Yarım Kalan JSON Kurtarma
        let attempt = processedJson;
        
        // Eğer dizi bittiyse (]) ama obje bitmediyse
        if (attempt.endsWith(']')) {
            attempt += '}';
        } else {
            // Tamamen yarım kaldıysa en son tam objeyi bul
            let lastCompleteObj = attempt.lastIndexOf('}');
            if (lastCompleteObj !== -1) {
                attempt = attempt.substring(0, lastCompleteObj + 1);
                attempt = attempt.replace(/,\s*$/, ""); // Sondaki virgülü sil
                if (attempt.includes('"urunler":')) attempt += ']}';
                else attempt += '}';
            }
        }

        try {
            finalData = JSON.parse(attempt);
        } catch (fatal) {
            console.error("Kurtarma Başarısız:", attempt);
            throw new Error("Veri çok uzun veya formatı bozuk (Kurtarılamadı).");
        }
    }
    
    // v14.29 - DEBUG: UnitHelper'a girmeden önceki ham veriyi logla
    console.log("UNITHELPER ÖNCESİ HAM VERİ:", JSON.stringify(finalData, null, 2));

    // UnitHelper Entegrasyonu
    if (finalData.urunler && Array.isArray(finalData.urunler)) {
      finalData.urunler = finalData.urunler
        .map(item => unitHelper.parseProduct(item))
        .filter(item => item !== null);
    }

    console.timeEnd("3_JSON_Parse_Islemi");
    res.status(200).json(finalData);

  } catch (err) {
    console.error("Final Backend Hatası:", err);
    res.status(500).json({ 
      error: "Analiz Verisi Okunamadı", 
      details: err.message,
      raw: rawText ? rawText.substring(Math.max(0, rawText.length - 200)) : "No response"
    });
  }
};
