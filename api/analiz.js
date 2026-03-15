import { sbFetch, hesaplaStokMap, isAuthorized, sendError } from '../utils/supabase.js';

export default async function handler(req, res) {
    if (!isAuthorized(req)) {
        return sendError(res, 401, 'Geçersiz veya eksik şifre.');
    }

    try {
        const [urunlerRes, hareketlerRes] = await Promise.all([
            sbFetch('/rest/v1/urunler?select=*'),
            sbFetch('/rest/v1/hareketler?select=*&order=tarih.asc')
        ]);
        const stokMap = hesaplaStokMap(hareketlerRes);
        
        const veri = urunlerRes.map(u => {
            const urunHareketler = hareketlerRes.filter(h => h.urun_adi === u.ad);
            const cikislar = urunHareketler.filter(h => h.tip === 'CIKIS');
            let aylikTuketim = 0;
            
            if (cikislar.length > 0) {
                const otuzGunOnce = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                aylikTuketim = cikislar.filter(h => new Date(h.tarih) > otuzGunOnce).reduce((s, h) => s + parseFloat(h.miktar), 0);
            } else {
                const baslangiclar = urunHareketler.filter(h => h.tip === 'BASLANGIC').sort((a, b) => new Date(a.tarih) - new Date(b.tarih));
                const girisler = urunHareketler.filter(h => h.tip === 'GIRIS').sort((a, b) => new Date(a.tarih) - new Date(b.tarih));
                let toplamTuketim = 0, toplamGun = 0;
                for (let i = 0; i < baslangiclar.length; i++) {
                    const oncekiGiris = girisler.filter(g => new Date(g.tarih) < new Date(baslangiclar[i].tarih)).pop();
                    if (oncekiGiris) {
                        const tuketilen = parseFloat(oncekiGiris.miktar) - parseFloat(baslangiclar[i].miktar);
                        const gunFarki = (new Date(baslangiclar[i].tarih) - new Date(oncekiGiris.tarih)) / (1000 * 60 * 60 * 24);
                        if (tuketilen > 0 && gunFarki > 0) { toplamTuketim += tuketilen; toplamGun += gunFarki; }
                    }
                }
                if (toplamGun > 0) aylikTuketim = (toplamTuketim / toplamGun) * 30;
            }
            
            const mevcutStok = stokMap[u.ad] || 0;
            const kacAyYeter = aylikTuketim > 0 ? mevcutStok / aylikTuketim : 99;
            return { 
                urunAdi: u.ad, 
                mevcutStok, 
                aylikTuketim: parseFloat(aylikTuketim.toFixed(1)), 
                kacAyYeter: parseFloat(kacAyYeter.toFixed(1)), 
                kategori: (u.kategori || 'diger').toLowerCase(), 
                birim: u.birim || '', 
                takip: u.takip 
            };
        });

        return res.status(200).json({ basarili: true, veri });

    } catch (err) {
        console.error('API Hatasi - analiz:', err);
        return sendError(res, 500, err.message);
    }
}
