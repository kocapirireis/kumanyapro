import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res, body) {
  const { gorsel } = body;

  if (!gorsel) {
    throw new Error("Görsel verisi eksik.");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Aşağıdaki fatura görselindeki ürünleri analiz et ve şu JSON formatında dön:
    {
      "urunler": [
        {"ad": "Ürün Adı", "miktar": 1.5, "birim": "Kg/Adet", "kategori": "temel-gida/temizlik/vb"}
      ]
    }
    
    Kurallar:
    1. Sadece net ürün adlarını al.
    2. Miktarları sayısal (float) olarak belirle.
    3. JSON dışında hiçbir metin yazma.
  `;

  try {
    const base64Data = gorsel.split(',')[1] || gorsel;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg"
        }
      }
    ]);

    const response = await result.response;
    let text = response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(text);
    return res.status(200).json(parsedData);
  } catch (error) {
    throw new Error("Fatura okuma işlemi başarısız oldu: " + error.message);
  }
}
