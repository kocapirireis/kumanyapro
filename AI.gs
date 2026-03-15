/**
 * AI.gs
 * Gemini API ile fatura görseli işleme ve File API yönetimi. (v12.0)
 */

/**
 * Fatura görselini işler ve sonuçları Fatura.gs'ye iletir.
 */
function faturaOku(imageBase64) {
  try {
    const sonuc = geminiParse(imageBase64);
    return faturaIsle(sonuc);
  } catch (e) {
    logHata("faturaOku", e);
    return { "urunler": [], "hata": "Sistem hatası: " + e.message };
  }
}

/**
 * Gemini API'ye görseli File API üzerinden gönderir ve analiz eder. (v12.0)
 */
function geminiParse(imageBase64) {
  const api_key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!api_key) throw new Error("GEMINI_API_KEY eksik");

  let fileUri = null;
  try {
    // 1. Görseli Google File API'ye yükle
    const uploadResult = uploadFileToGemini(imageBase64);
    fileUri = uploadResult.file.uri;
    Logger.log("Dosya yüklendi: " + fileUri);

    // v12.0 - Gemini 3.1 & Ultra Sade Prompt
    const modelName = "gemini-3.1-flash-lite-preview"; 
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelName + ":generateContent?key=" + api_key;

    const prompt = "Extract table to JSON.";

    const payload = {
      "contents": [
        {
          "parts": [
            { "text": prompt },
            {
              "file_data": {
                "mime_type": "image/jpeg",
                "file_uri": fileUri
              }
            }
          ]
        }
      ],
      "generationConfig": { 
        "temperature": 0,
        "max_output_tokens": 2048,
        "response_mime_type": "application/json",
        "response_schema": {
          "type": "OBJECT",
          "properties": {
            "urunler": {
              "type": "ARRAY",
              "items": {
                "type": "OBJECT",
                "properties": {
                  "urun_adi": { "type": "STRING" },
                  "miktar": { "type": "NUMBER" },
                  "birim": { "type": "STRING" },
                  "guven": { "type": "NUMBER" },
                  "kategori": { "type": "STRING" }
                },
                "required": ["urun_adi", "miktar", "birim"]
              }
            }
          }
        }
      }
    };

    const options = {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 429) throw new Error("KOTA_DOLDU");
    if (responseCode !== 200) {
      Logger.log("Analiz Hatası (getContentText): " + responseText);
      throw new Error("Analiz sırasında hata (HTTP " + responseCode + ")");
    }

    const result = JSON.parse(responseText);
    if (!result.candidates || result.candidates.length === 0 || !result.candidates[0].content) {
      throw new Error("Yapay Zeka geçerli bir yanıt oluşturamadı.");
    }

    let rawText = result.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
    
    Logger.log("Gemini Yanıtı: " + rawText);

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      Logger.log("JSON Parse Hatası: " + e.message);
      return { "urunler": [] };
    }

    // v8.7+ Zeki Dizi Kontrolü
    if (!parsed || !parsed.urunler) {
      const keys = Object.keys(parsed);
      const listKey = keys.find(k => Array.isArray(parsed[k]));
      parsed = { "urunler": listKey ? parsed[listKey] : (Array.isArray(parsed) ? parsed : []) };
    }

    return parsed;

  } finally {
    // 2. Analiz sonrası dosyayı Google sunucularından temizle
    if (fileUri) {
      try {
        deleteFileFromGemini(fileUri);
        Logger.log("Dosya sunucudan silindi.");
      } catch (e) {
        Logger.log("Dosya silinirken hata (önemsiz): " + e.message);
      }
    }
  }
}

/**
 * v11.0 - Kesin Çözüm: Binary Multipart Paketleme
 * Görseli bozulmadan Google File API'ye yükler.
 */
function uploadFileToGemini(imageBase64) {
  const api_key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const [header, base64Data] = imageBase64.split(",");
  const mimeType = header.match(/:(.*?);/)[1] || "image/jpeg";
  
  const metadata = {
    file: { display_name: "fatura_" + new Date().getTime() }
  };
  
  const url = "https://generativelanguage.googleapis.com/upload/v1beta/files?key=" + api_key;
  const boundary = "-------" + new Date().getTime();
  
  // Binary paketleme: Parçaları bytes olarak birleştir
  const part1Header = "--" + boundary + "\r\n" +
                      "Content-Type: application/json; charset=UTF-8\r\n\r\n";
  const part1Body = JSON.stringify(metadata) + "\r\n";
  
  const part2Header = "--" + boundary + "\r\n" +
                      "Content-Disposition: form-data; name=\"file\"; filename=\"fatura.jpg\"\r\n" +
                      "Content-Type: " + mimeType + "\r\n\r\n";
  
  const part2Footer = "\r\n--" + boundary + "--";
  
  const imageData = Utilities.base64Decode(base64Data);
  
  // v11.0 - Kesin Çözüm: Doğrudan bytes dizisi birleşimi (Concat)
  const payloadBytes = [].concat(
    Utilities.newBlob(part1Header).getBytes(),
    Utilities.newBlob(part1Body).getBytes(),
    Utilities.newBlob(part2Header).getBytes(),
    imageData,
    Utilities.newBlob(part2Footer).getBytes()
  );

  const options = {
    method: "post",
    contentType: "multipart/related; boundary=" + boundary,
    payload: payloadBytes,
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    Logger.log("Yükleme Hatası (getContentText): " + response.getContentText());
    throw new Error("Dosya yükleme hatası (HTTP " + response.getResponseCode() + ")");
  }
  
  return JSON.parse(response.getContentText());
}

/**
 * Yüklenen dosyayı siler. (File API v1beta)
 */
function deleteFileFromGemini(fileUri) {
  const api_key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const url = fileUri + "?key=" + api_key;
  
  const options = {
    method: "delete",
    muteHttpExceptions: true
  };
  
  UrlFetchApp.fetch(url, options);
}

/**
 * AI'dan gelen ham verileri merkezi hesaplama modülüyle işler.
 */
function hesaplaVeDonustur(hamVeriler) {
  if (!hamVeriler || !hamVeriler.urunler) return { "urunler": [], "hata": "Veri okunamadı" };

  try {
    let sonuclar = stoklariHesapla(hamVeriler.urunler);
    sonuclar = mevcutStoklaTopla(sonuclar);
    return { "urunler": sonuclar, "hata": null };
  } catch (e) {
    logHata("hesaplaVeDonustur", e);
    return { "urunler": [], "hata": "Hesaplama hatası: " + e.message };
  }
}