export default async function handler(req, res, body) {
  const { mevcutStokMap = {} } = body;

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SB_URL || !SB_KEY) {
    throw new Error("Supabase yapılandırması eksik (Environment Variables).");
  }

  const headers = {
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    const [urunlerRes, hareketlerRes] = await Promise.all([
      fetch(`${SB_URL}/rest/v1/urunler?select=*`, { headers }).then(r => r.json()),
      fetch(`${SB_URL}/rest/v1/hareketler?select=*&order=tarih.asc`, { headers }).then(r => r.json())
    ]);

    const takipEdilenler = urunlerRes.filter(u => u.takip === true || u.takip === 'EVET');
    const kategoriMap = {};
    urunlerRes.forEach(u => kategoriMap[u.ad] = u.kategori);

    const isTakipte = (ad) => takipEdilenler.some(u => urunEslestir(u.ad, ad));
    const getKategori = (ad) => {
      const eslesen = urunlerRes.find(u => urunEslestir(u.ad, ad));
      return eslesen ? eslesen.kategori : 'diger';
    };

    if (hareketlerRes.length === 0) return res.status(200).json([]);

    const stats = {};
    const simdi = new Date();

    hareketlerRes.forEach(r => {
      if (!r.urun_adi) return;
      const tarih = new Date(r.tarih);
      const ad = r.urun_adi;
      const miktar = parseFloat(r.miktar) || 0;
      const tip = r.tip;

      if (!isTakipte(ad)) return;

      if (!stats[ad]) {
        stats[ad] = { ilkGiris: tarih, toplamGiris: 0, anlikStok: 0, toplamTuketim: 0, kategori: getKategori(ad) };
      }

      if (tarih < stats[ad].ilkGiris) stats[ad].ilkGiris = tarih;

      if (tip === 'BASLANGIC' || tip === 'SAYIM') {
        if (stats[ad].anlikStok > miktar) {
          stats[ad].toplamTuketim += (stats[ad].anlikStok - miktar);
        }
        stats[ad].anlikStok = miktar;
        if (tip === 'BASLANGIC') stats[ad].toplamGiris += miktar;
      } else if (tip === 'GIRIS') {
        stats[ad].toplamGiris += miktar;
        stats[ad].anlikStok += miktar;
      } else if (tip === 'CIKIS') {
        stats[ad].toplamTuketim += miktar;
        stats[ad].anlikStok -= miktar;
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

    const result = Object.keys(stats).map(ad => {
      const s = stats[ad];
      const mevcutStok = s.anlikStok;
      const tuketim = s.toplamTuketim;
      const farkMs = simdi.getTime() - s.ilkGiris.getTime();
      let sureAy = farkMs / (1000 * 60 * 60 * 24 * 30.44);
      if (sureAy < 0.01) sureAy = 0.01;
      const aylikOrtalama = tuketim / sureAy;
      const kacAyYeter = aylikOrtalama > 0 ? (mevcutStok / aylikOrtalama) : 999;
      return {
        urunAdi: ad, toplamGiris: s.toplamGiris, mevcutStok: mevcutStok,
        tuketim: tuketim, ilkGiris: s.ilkGiris, kategori: s.kategori,
        sureAy: sureAy.toFixed(2), aylikOrtalama: aylikOrtalama.toFixed(2),
        kacAyYeter: (function() {
          if (kacAyYeter > 100) return "100+ Ay";
          let ay = Math.floor(kacAyYeter);
          let hafta = Math.round((kacAyYeter - ay) * 4);
          if (hafta === 4) { ay += 1; hafta = 0; }
          const resArr = [];
          if (ay > 0) resArr.push(ay + " Ay");
          if (hafta > 0) resArr.push(hafta + " Hafta");
          return resArr.join(" ") || "0 Ay";
        })()
      };
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

function normalizeAd(ad) {
  return String(ad || '').toUpperCase().trim()
    .replace(/\s+/g, ' ')
    .replace(/[İ]/g, 'I').replace(/[Şş]/g, 'S')
    .replace(/[Çç]/g, 'C').replace(/[Ğğ]/g, 'G')
    .replace(/[Üü]/g, 'U').replace(/[Öö]/g, 'O');
}

function urunEslestir(a, b) {
  const na = normalizeAd(a), nb = normalizeAd(b);
  return na === nb || na.startsWith(nb) || nb.startsWith(na);
}
