const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PDFDocument } = require("pdf-lib");

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

  console.log("--- ULTRA HIZ OPTIMIZASYONU (DPI & Token Limit) BAŞLADI ---");
  console.time("Toplam_Sure");

  try {
    console.time("1_PDF_Hafifletme");
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Buffer.from(cleanBase64, 'base64');

    const pdfDoc = await PDFDocument.create();
    let image;
    try {
      image = await pdfDoc.embedJpg(imageBytes);
    } catch (e) {
      image = await pdfDoc.embedPng(imageBytes);
    }

    // v13.14 - DPI Hafifletme: Görüntü boyutlarını %50 küçülterek PDF'i hafiflet
    const scale = 0.5;
    const dims = image.scale(scale);
    
    const page = pdfDoc.addPage([dims.width, dims.height]);
    page.drawImage(image, { x: 0, y: 0, width: dims.width, height: dims.height });
    const pdfBytes = await pdfDoc.save();
    console.timeEnd("1_PDF_Hafifletme");

    console.time("2_Gemini_Flash_Isteği");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest",
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        maxOutputTokens: 500, // v13.14 - Gereksiz düşünmeyi engeller
        responseMimeType: "application/json"
      }
    });

    const result = await model.generateContent([
      {
        inlineData: {
          data: Buffer.from(pdfBytes).toString("base64"),
          mimeType: "application/pdf"
        }
      },
      "Extract invoice: {urun_adi, miktar, birim}"
    ]);

    const response = await result.response;
    let text = response.text();
    console.timeEnd("2_Gemini_Flash_Isteği");

    const jsonMatch = text.trim().match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    
    const finalData = JSON.parse(jsonStr);

    console.timeEnd("Toplam_Sure");
    res.status(200).json(finalData);
  } catch (err) {
    if (console.timeEnd) try { console.timeEnd("Toplam_Sure"); } catch(e) {}
    console.error("Vercel Backend Hatası:", err);
    res.status(500).json({ error: "Süreç Hatası", details: err.message });
  }
};
