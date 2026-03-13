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
        .map(item => {
          const rawName = (item.urun_adi || "").trim(); // Temizlenmeden önceki hali
          const processed = unitHelper.parseProduct(item);
          if (processed) processed.raw_adi = rawName; // Ham ismi objeye yapıştır
          return processed;
        })
        .filter(item => item !== null);
      
      // v14.33 - AKILLI İSİM HAFIZASI (ALIAS) ENTEGRASYONU
      try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY;
        
        if (supabaseUrl && supabaseKey) {
          // v14.49 - Limit artırıldı ve daha agresif arama
          const aliasRes = await fetch(`${supabaseUrl}/rest/v1/urunler?select=ad,alias&limit=5000`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
          });
          
          if (aliasRes.ok) {
            const urunlerList = await aliasRes.json();
            if (Array.isArray(urunlerList)) {
              const normalize = (str) => {
                if (!str) return "";
                return str.toString().toUpperCase()
                  .replace(/[İIı]/g, 'I').replace(/[Şş]/g, 'S')
                  .replace(/[Çç]/g, 'C').replace(/[Ğğ]/g, 'G')
                  .replace(/[Üü]/g, 'U').replace(/[Öö]/g, 'O')
                  .replace(/[^A-Z0-9]/g, ""); 
              };

              finalData.urunler = finalData.urunler.map(u => {
                const originalGeminiName = (u.raw_adi || u.urun_adi || "").toUpperCase().trim();
                const cleanedGeminiName = (u.urun_adi || "").toUpperCase().trim();
                
                const keyRaw = normalize(originalGeminiName);
                const keyCleaned = normalize(cleanedGeminiName);

                const match = urunlerList.find(dbU => {
                  const dbKey = normalize(dbU.ad);
                  if (dbKey && (dbKey === keyRaw || dbKey === keyCleaned)) return true;
                  
                  // v14.52 - Gelişmiş Alias Ayrıştırıcı (Array veya String farketmez)
                  let aliases = [];
                  if (Array.isArray(dbU.alias)) {
                    aliases = dbU.alias;
                  } else if (typeof dbU.alias === 'string') {
                    // Postgres formatı: "{item1,item2}" veya normal string
                    aliases = dbU.alias.replace(/[{}]/g, "").split(",").map(s => s.trim());
                  }

                  return aliases.some(a => {
                    const aKey = normalize(a);
                    return aKey && (aKey === keyRaw || aKey === keyCleaned);
                  });
                });
                
                if (match) {
                  u.gemini_adi = originalGeminiName;
                  u.urun_adi = match.ad;
                  u.match_status = "matched";
                } else {
                  u.gemini_adi = originalGeminiName;
                  u.match_status = "new";
                }
                return u;
              });
            }
          }
        }
      } catch (aliasErr) {
        console.warn("Backend Alias eşleştirme hatası:", aliasErr.message);
      }
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
