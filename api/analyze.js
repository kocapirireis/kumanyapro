const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PDFDocument } = require("pdf-lib");

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

  console.log("--- YENI NESIL ANALIZ (3.1 Flash Lite) BAŞLADI ---");
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

    // PDF ölçeğini koruyarak hafifletme (v13.24)
    const scale = 0.5;
    const dims = image.scale(scale);
    const page = pdfDoc.addPage([dims.width, dims.height]);
    page.drawImage(image, { x: 0, y: 0, width: dims.width, height: dims.height });
    const pdfBytes = await pdfDoc.save();
    console.timeEnd("1_PDF_Hazirlama");

    console.time("2_Gemini_3.1_Lite_Yanit_Suresi");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Şampiyon model: gemini-3.1-flash-lite-preview (v13.24)
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
          { text: "Extract invoice items into 'urunler' array with {urun_adi, miktar, birim}. Use only JSON format." }
        ]
      }],
      generationConfig: {
        temperature: 1.0,
        topK: 40,
        maxOutputTokens: 1000,
        responseMimeType: "application/json"
      }
    });

    const response = await result.response;
    rawText = response.text();
    console.log("Modelin Ham Cevabı:", rawText);
    console.timeEnd("2_Gemini_3.1_Lite_Yanit_Suresi");

    console.time("3_JSON_Parse_Islemi");
    // JSON Temizleme
    const jsonMatch = rawText.trim().match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
    
    const finalData = JSON.parse(jsonStr);
    console.timeEnd("3_JSON_Parse_Islemi");

    console.timeEnd("Toplam_Sure");
    res.status(200).json(finalData);

  } catch (err) {
    if (console.timeEnd) {
        try { console.timeEnd("1_PDF_Hazirlama"); } catch(e) {}
        try { console.timeEnd("2_Gemini_3.1_Lite_Yanit_Suresi"); } catch(e) {}
        try { console.timeEnd("Toplam_Sure"); } catch(e) {}
    }
    console.error("Vercel Backend Hatası Detay:", err);
    res.status(500).json({ 
      error: "Analiz Verisi Okunamadı", 
      details: err.message,
      raw: rawText ? rawText.substring(0, 100) : "No response"
    });
  }
};
