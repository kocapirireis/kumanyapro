function urunGuncelle(urunAdi, alan, deger) {
  let paramKey = "";
  if (alan === 'kategori') paramKey = "kategori";
  if (alan === 'takip') {
    paramKey = "takip";
    // Supabase boolean (true/false) bekliyor
    deger = (deger === 'EVET' || deger === true);
  }
  
  if (paramKey === "") throw new Error("Gecersiz alan: " + alan);

  const payload = {};
  payload[paramKey] = deger;
  
  // v14.51 - Tablo adı 'urunler' olarak sabitlendi
  const sonuc = supabasePatch(`/rest/v1/urunler?ad=eq.${encodeURIComponent(urunAdi)}`, payload);
  if (sonuc && !sonuc.error) {
    return true;
  }
  
  throw new Error("Urun guncellenemedi: " + urunAdi);
}