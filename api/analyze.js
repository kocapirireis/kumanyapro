const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PDFDocument } = require("pdf-lib");
const unitHelper = require("./unitHelper.js");

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

  console.log("--- ANALIZ v14.24 (Mega JSON Fix) BAŞLADI ---");
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
          { text: "Extract invoice items into a JSON array named 'urunler'. Each object: {urun_adi, miktar, birim, birim_detay}. ONLY return minified JSON string." }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        maxOutputTokens: 4000, // 41 satır için güvenli alan
        responseMimeType: "application/json"
      }
    });

    const response = await result.response;
    rawText = response.text().trim();
    console.timeEnd("2_Gemini_Lite_Yanit_Suresi");

    console.time("3_JSON_Parse_Islemi");
    
    // v14.24 - GELİŞMİŞ JSON AYIKLAMA VE TAMİR
    let jsonToParse = rawText;
    
    // 1. Regex ile JSON bloğunu bul (Markdown block'ları veya ön ekleri temizler)
    const jsonMatch = rawText.match(/\{[\s\S]*/);
    if (jsonMatch) jsonToParse = jsonMatch[0];

    let finalData = null;
    try {
        finalData = JSON.parse(jsonToParse);
    } catch (parseErr) {
        console.warn("JSON Tamir Modu Aktif...");
        
        // 2. Kırısal Tamir (Truncation kurtarma)
        let lastClosingBrace = jsonToParse.lastIndexOf('}');
        if (lastClosingBrace !== -1) {
            let fixedStr = jsonToParse.substring(0, lastClosingBrace + 1);
            
            // Eğer urunler dizisi içindeyse kapatmayı tamamla
            if (fixedStr.includes('"urunler":')) {
                // Sondaki olası virgülü temizle (Örn: ...}, ]})
                fixedStr = fixedStr.replace(/,\s*$/, "");
                if (fixedStr.split('{').length > fixedStr.split('}').length) {
                   // Hala açık parantez varsa (bir objenin ortasında kesildiyse), bir önceki objeye geri git
                   let secondLastBrace = fixedStr.substring(0, fixedStr.length - 1).lastIndexOf('}');
                   if (secondLastBrace !== -1) {
                       fixedStr = fixedStr.substring(0, secondLastBrace + 1);
                   }
                }
                fixedStr = fixedStr.replace(/,\s*$/, "") + ']}';
            } else {
                fixedStr += '}';
            }
            
            try {
                finalData = JSON.parse(fixedStr);
                console.log("JSON başarıyla kurtarıldı. Ürün sayısı:", finalData.urunler?.length);
            } catch (e2) {
                throw new Error("Kritik JSON Hatası: Veri tamir edilemeyecek kadar bozuk.");
            }
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
      raw: rawText ? rawText.substring(Math.max(0, rawText.length - 200)) : "No response"
    });
  }
};
