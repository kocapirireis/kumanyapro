const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PDFDocument } = require("pdf-lib");

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

  console.log("--- MODELDEN KAYNAKLI HIZ OPTIMIZASYONU BAŞLADI ---");
  console.time("Toplam_Sure");

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

    console.time("2_Gemini_API_Yanit_Suresi");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ motor: "gemini-flash-latest" });

    // v13.15 - API Lag Çözümleri: Reddit ve topluluk verilerine dayanarak optimize edildi
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
          { text: "Extract invoice: {urun_adi, miktar, birim}" }
        ]
      }],
      generationConfig: {
        temperature: 1.0,           // Lag sorununu çözen anahtar değer
        topK: 40,                  // Hız ve tutarlılık dengesi
        maxOutputTokens: 500,      // Kısa cevap, hızlı sonuç
        responseMimeType: "application/json",
        thinking_level: "low"      // Derin düşünmeyi engelleyip hıza odaklayan parametre
      }
    });

    const response = await result.response;
    let text = response.text();
    console.timeEnd("2_Gemini_API_Yanit_Suresi");

    const jsonMatch = text.trim().match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    const finalData = JSON.parse(jsonStr);

    console.timeEnd("Toplam_Sure");
    res.status(200).json(finalData);
  } catch (err) {
    if (console.timeEnd) try { console.timeEnd("Toplam_Sure"); } catch(e) {}
    console.error("Vercel Backend Hatası:", err);
    res.status(500).json({ error: "Yanıt Hatası", details: err.message });
  }
};
