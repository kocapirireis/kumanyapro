import crypto from 'crypto';
import { sbFetch, hesaplaStokMap, isAuthorized, sendError } from '../utils/supabase.js';

export default async function handler(req, res) {
    if (!isAuthorized(req)) {
        return sendError(res, 401, 'Geçersiz veya eksik şifre.');
    }

    try {
        const { payload = {} } = req.body;
        const urunlerParam = payload.urunler || [];
        const islemTip = payload.tip || 'GIRIS';

        // 1. Fetch current stocks
        const hareketlerRes = await sbFetch('/rest/v1/hareketler?select=*&order=tarih.asc');
        const stokMap = hesaplaStokMap(hareketlerRes);
        
        let count = 0;
        for (let i = 0; i < urunlerParam.length; i++) {
            const e = urunlerParam[i];
            if (!e.ad || e.miktar === 0) continue;
            
            const urunAd = e.ad.toString().trim();
            const artis = parseFloat(e.miktar);
            
            let current = stokMap[urunAd] || 0;
            let yeniStok = current;
            
            if (islemTip === 'SAYIM') {
                 yeniStok = artis;
            } else if (islemTip === 'CIKIS') {
                 yeniStok = current - artis;
            } else { // GIRIS
                 yeniStok = current + artis;
            }
            
            // Update local map for the next item in the same batch
            stokMap[urunAd] = yeniStok;

            const harNot = `Fatura/Sayım - Değişim: ${artis}`;
            await sbFetch('/rest/v1/hareketler', {
                method: 'POST',
                headers: { 'Prefer': 'return=minimal' },
                body: JSON.stringify([{
                    id: crypto.randomUUID(),
                    tarih: new Date().toISOString(),
                    urun_adi: urunAd,
                    miktar: Math.abs(artis),
                    toplam_stok: yeniStok,
                    birim: e.birim || '',
                    tip: islemTip,
                    notlar: harNot
                }])
            });

            // Upsert: Ad ile kontrol et, yoksa ekle. Varsa birimi/kategoriyi bozma (veya güncelleme).
            const mevcutUrunler = await sbFetch(`/rest/v1/urunler?ad=eq.${encodeURIComponent(urunAd)}&select=id,birim`);
            if (!mevcutUrunler || mevcutUrunler.length === 0) {
                 await sbFetch('/rest/v1/urunler', {
                     method: 'POST',
                     headers: { 'Prefer': 'return=minimal' },
                     body: JSON.stringify([{
                          id: e.id || crypto.randomUUID(),
                          ad: urunAd,
                          birim: e.birim || '',
                          kategori: e.kategori || 'diger',
                          takip: 'EVET'
                     }])
                 });
            } else if (e.birim && !mevcutUrunler[0].birim) {
                // Birim boşsa güncelle
                await sbFetch(`/rest/v1/urunler?id=eq.${mevcutUrunler[0].id}`, {
                    method: 'PATCH',
                    headers: { 'Prefer': 'return=minimal' },
                    body: JSON.stringify({ birim: e.birim })
                });
            }
            count++;
        }
        return res.status(200).json({ basarili: true, veri: `${count} işlem kaydedildi.` });

    } catch (err) {
        console.error('API Hatasi - stokEkle:', err);
        return sendError(res, 500, err.message);
    }
}
