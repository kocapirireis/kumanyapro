const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PDFDocument } = require("pdf-lib");

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

  try {
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
    const jsonStr = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)?.[0] || text;
    
    res.status(200).json(JSON.parse(jsonStr));
  } catch (err) {
    console.error("Vercel Backend Hatası:", err);
    res.status(500).json({ error: err.message });
  }
};
