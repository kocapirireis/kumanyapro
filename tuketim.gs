function analizHesapla(mevcutStokMap = {}) {
  // v14.53 - Tablo adı 'urunler' olarak güncellendi
  const tData = supabaseGet("/rest/v1/urunler?select=*") || [];
  const hData = supabaseGet("/rest/v1/hareketler?select=*&order=tarih.asc") || [];
  
  // Fuzzy takip kontrolü
  const takipEdilenler = tData.filter(r => r.takip === 'EVET' || r.takip === true).map(r => r.ad);
  const kategoriMap = {};
  tData.forEach(r => kategoriMap[r.ad] = r.kategori);

  function isTakipte(ad) {
    return takipEdilenler.some(t => urunEslestir(t, ad));
  }

  function getKategori(ad) {
    return kategoriMap[ad] || 'diger';
  }

  if (hData.length === 0) return [];

  const stats = {};
  const simdi = new Date();

  hData.forEach(r => {
    const ad = r.urun_adi || r.urunAdi;
    if (!ad) return;
    const tarih = new Date(r.tarih);
    const miktar = parseFloat(r.toplam_stok || r.miktar) || 0;
    const tip = r.tip;

    if (!isTakipte(ad)) return;

    if (!stats[ad]) {
      stats[ad] = { ilkGiris: tarih, toplamGiris: 0, anlikStok: 0, toplamTuketim: 0, kategori: getKategori(ad) };
    }

    if (tarih < stats[ad].ilkGiris) stats[ad].ilkGiris = tarih;

    if (tip === 'BASLANGIC') {
      if (stats[ad].anlikStok > miktar) {
        stats[ad].toplamTuketim += (stats[ad].anlikStok - miktar);
      }
      stats[ad].anlikStok = miktar;
      stats[ad].toplamGiris += miktar;
    } else if (tip === 'GIRIS') {
      stats[ad].toplamGiris += miktar;
      stats[ad].anlikStok += miktar;
    } else if (tip === 'CIKIS') {
      stats[ad].toplamTuketim += miktar;
      stats[ad].anlikStok -= miktar;
    } else if (tip === 'SAYIM') {
      if (stats[ad].anlikStok > miktar) {
        stats[ad].toplamTuketim += (stats[ad].anlikStok - miktar);
      }
      stats[ad].anlikStok = miktar;
    }
  });

  Object.keys(mevcutStokMap).forEach(ad => {
    if (stats[ad]) {
      const guncelMevcut = parseFloat(mevcutStokMap[ad]);
      if (stats[ad].anlikStok > guncelMevcut) {
        stats[ad].toplamTuketim += (stats[ad].anlikStok - guncelMevcut);
      }
      stats[ad].anlikStok = guncelMevcut;
    }
  });

  return Object.keys(stats).map(ad => {
    const s = stats[ad];
    const mevcutStok = s.anlikStok;
    const tuketim = s.toplamTuketim;
    
    const farkMs = simdi.getTime() - s.ilkGiris.getTime();
    let sureAy = farkMs / (1000 * 60 * 60 * 24 * 30.44);
    if (sureAy < 0.01) sureAy = 0.01;

    const aylikOrtalama = tuketim / sureAy;
    const kacAyYeter = aylikOrtalama > 0 ? (mevcutStok / aylikOrtalama) : 999;

    return {
      urunAdi: ad,
      toplamGiris: s.toplamGiris,
      mevcutStok: mevcutStok,
      tuketim: tuketim,
      ilkGiris: s.ilkGiris,
      kategori: s.kategori,
      sureAy: sureAy.toFixed(2),
      aylikOrtalama: aylikOrtalama.toFixed(2),
      kacAyYeterRaw: kacAyYeter,
      kacAyYeter: (function() {
        if (kacAyYeter > 100) return "100+ Ay";
        let ay = Math.floor(kacAyYeter);
        let hafta = Math.round((kacAyYeter - ay) * 4);
        if (hafta === 4) { ay += 1; hafta = 0; }
        return (ay + " Ay " + (hafta > 0 ? hafta + " Hafta" : "")).trim().replace(/^0 Ay /, "");
      })()
    };
  });
}