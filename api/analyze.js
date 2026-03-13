const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PDFDocument } = require("pdf-lib");

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

  console.log("--- MODEL ISMI GUNCELLEME (1.5 Flash) BAŞLADI ---");
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
    
    // v13.17 - Model ismi sadeleştirildi (Hata alırsak yedek: gemini-flash-latest)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash" 
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
          { text: "Extract invoice items to JSON array 'urunler' with {urun_adi, miktar, birim}. ONLY JSON." }
        ]
      }],
      generationConfig: {
        temperature: 1.0,
        topK: 40,
        maxOutputTokens: 500,
        responseMimeType: "application/json"
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
    
    // YEDEK MEKANIZMA: Eğer 1.5-flash hata verirse otomatik olarak çalışan diğer isme yönlendirilecek mesajı veriyoruz
    res.status(500).json({ 
      error: "Model Erişimi Başarısız", 
      details: err.message,
      suggestion: "gemini-1.5-flash ismi çalışmadıysa bir sonraki denemede gemini-flash-latest ismine dönebiliriz."
    });
  }
};
