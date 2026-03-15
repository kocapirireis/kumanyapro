// --- WEB APP GIRIŞ NOKTALARI ---

function doGet(e) {
  // Eğer bir aksiyon istenmişse (e.g. ?action=tokenKontrol)
  if (e && e.parameter && e.parameter.action) {
    const action = e.parameter.action;
    if (action === 'tokenKontrol') {
      return response(tokenKontrol(e.parameter.token));
    }
  }

  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('KumanyaPro v4')
    .setFaviconUrl('https://img.icons8.com/fluency/48/anchor.png')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// --- İLK KURULUM ---
// Supabase altyapısına geçildiği için Google Sheets tablo oluşturma yapısı iptal edildi.
function setup() {
  Logger.log("Supabase altyapısı aktif, tablo kurulumuna gerek yok.");
}

function doPost(e) {
  try {
    // Veri kontrolü
    if (!e || !e.postData || !e.postData.contents) {
      return response({ basarili: false, hata: "Post verisi bos veya hatali." });
    }
    
    const data = JSON.parse(e.postData.contents);
    
    // Güvenlik Kontrolü
    const dogruToken = PropertiesService.getScriptProperties().getProperty('GUVENLIK_TOKEN');
    if (data.token !== dogruToken) {
      return response({ basarili: false, hata: "Gecersiz guvenlik tokeni." });
    }

    const { islem } = data;
    let result;

    switch (islem) {
      case 'tokenKontrol':
        result = tokenKontrol(data.params ? data.params.token : data.token);
        // Eğer param olarak gelmişse doğrudan result döner, üstte token kontrolü zaten yapıldı
        // Ancak bu endpoint özel bir durum: asıl giriş burada yapılıyor.
        break;
      case 'setup':
        result = setup();
        break;
      case 'stokOku':
        result = stokOku();
        break;
      case 'stokEkle':
        result = stokEkle(data.urunler, data.tip);
        break;
      case 'takipGuncelle':
        result = urunGuncelle(data.urunAdi, data.alan, data.deger);
        break;
      case 'faturaOku':
        if (typeof faturaOku !== 'undefined') {
          result = faturaOku(data.imageBase64);
        } else {
          throw new Error("faturaOku fonksiyonu backend tarafında bulunamadı. Lütfen AI.gs dosyasını kontrol edin.");
        }
        break;
      case 'hareketGeriAl':
        result = hareketGeriAl(data.id);
        break;
      case 'topluHareketGeriAl':
        result = topluHareketGeriAl(data.ids);
        break;
      case 'urunGecmisiSifirla':
        result = urunGecmisiSifirla(data.urunAdi, data.baslangicMiktar);
        break;
      case 'tumSistemiSifirla':
        result = tumSistemiSifirla(data.onayKodu);
        break;
      case 'analizHesapla':
        result = analizHesapla();
        break;
      case 'ping':
        result = "pong";
        break;
      default:
        throw new Error("Bilinmeyen islem: " + islem);
    }

    return response({ basarili: true, veri: result });

  } catch (error) {
    return response({ basarili: false, hata: error.toString() });
  }
}
