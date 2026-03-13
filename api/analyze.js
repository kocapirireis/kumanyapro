const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PDFDocument } = require("pdf-lib");

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

  console.log("--- STRICT JSON MODE (Flash Latest) BAŞLADI ---");
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
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    const pdfBytes = await pdfDoc.save();
    console.timeEnd("1_PDF_Hazirlama");

    console.time("2_Gemini_Flash_Latest_Isteği");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest",
      generationConfig: {
        temperature: 0.1, // Sıkı mod için temperature düşürüldü (v13.12)
        topK: 1
      }
    });

    const result = await model.generateContent([
      {
        inlineData: {
          data: Buffer.from(pdfBytes).toString("base64"),
          mimeType: "application/pdf"
        }
      },
      "Return ONLY a raw JSON object. Do not include any conversational text or markdown code blocks. Extract invoice data into 'urunler' array with keys: {urun_adi, miktar, birim}"
    ]);

    const response = await result.response;
    const text = response.text();
    console.timeEnd("2_Gemini_Flash_Latest_Isteği");

    console.time("3_JSON_Temizleme_ve_Parse");
    // v13.12 - JSON Fixer: Regex ile sadece JSON bloğunu ayıkla
    let cleanedText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    
    // En dıştaki { } veya [ ] bloğunu bul
    const jsonMatch = cleanedText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    const jsonStr = jsonMatch ? jsonMatch[0] : cleanedText;
    
    const finalData = JSON.parse(jsonStr);
    console.timeEnd("3_JSON_Temizleme_ve_Parse");

    console.timeEnd("Toplam_Sure");
    res.status(200).json(finalData);
  } catch (err) {
    if (console.timeEnd) try { console.timeEnd("Toplam_Sure"); } catch(e) {}
    console.error("Vercel Backend Hatası:", err);
    res.status(500).json({ 
      error: "JSON Format Hatası", 
      details: err.message,
      rawResponse: typeof text !== 'undefined' ? text.substring(0, 100) : "No Response"
    });
  }
};
