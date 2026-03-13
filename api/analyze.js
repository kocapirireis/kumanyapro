const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PDFDocument } = require("pdf-lib");

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

  console.log("--- ANALİZ BAŞLADI ---");
  console.time("Toplam_Sure");

  try {
    // 1. Görsel Hazırlama
    console.time("1_Gorsel_Hazirlama");
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Buffer.from(cleanBase64, 'base64');
    console.timeEnd("1_Gorsel_Hazirlama");

    // 2. PDF Dönüşümü (PDF Trick)
    console.time("2_PDF_Donusumu");
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
    console.timeEnd("2_PDF_Donusumu");

    // 3. Gemini API İsteyi
    console.time("3_Gemini_API_Istegi");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

    const result = await model.generateContent([
      {
        inlineData: {
          data: Buffer.from(pdfBytes).toString("base64"),
          mimeType: "application/pdf"
        }
      },
      "Extract table to JSON with a root key 'urunler' containing a list of objects. Each object MUST have these exact keys: 'urun_adi' (string), 'miktar' (number), 'birim' (string), 'birim_detay' (string), and 'toplam_stok_ai' (the same number as miktar)."
    ]);

    const response = await result.response;
    const text = response.text();
    console.timeEnd("3_Gemini_API_Istegi");

    // 4. JSON Ayrıştırma ve Yanıt
    console.time("4_JSON_Isleme");
    const jsonStr = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)?.[0] || text;
    const finalData = JSON.parse(jsonStr);
    console.timeEnd("4_JSON_Isleme");

    console.timeEnd("Toplam_Sure");
    console.log("--- ANALİZ TAMAMLANDI ---");
    
    res.status(200).json(finalData);
  } catch (err) {
    console.timeEnd("Toplam_Sure");
    console.error("Vercel Backend Hatası:", err);
    res.status(500).json({ error: err.message });
  }
};
