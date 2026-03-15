import crypto from 'crypto';
import { sbFetch, isAuthorized, sendError } from '../utils/supabase.js';

export default async function handler(req, res) {
    if (!isAuthorized(req)) {
        return sendError(res, 401, 'Geçersiz veya eksik şifre.');
    }

    try {
        const { urunler, mod } = req.body.payload;
        let count = 0;

        for (const e of urunler) {
            // Önce urun var mı kontrol et
            const mevcutUrunler = await sbFetch(`/rest/v1/urunler?ad=eq.${encodeURIComponent(e.ad)}`);
            
            // Hareket ekle
            await sbFetch('/rest/v1/hareketler', {
                method: 'POST',
                headers: { 'Prefer': 'return=minimal' },
                body: JSON.stringify([{
                    id: crypto.randomUUID(),
                    tarih: new Date().toISOString(),
                    urun_adi: e.ad,
                    miktar: e.miktar,
                    birim: e.birim,
                    tip: mod === 'overwrite' ? 'SAYIM' : 'GIRIS',
                    notlar: mod === 'overwrite' ? 'Stok Sayımı' : 'Fatura Girişi'
                }])
            });

            if (mevcutUrunler.length === 0) {
                 // Yeni ürün ekle
                 await sbFetch('/rest/v1/urunler', {
                     method: 'POST',
                     headers: { 'Prefer': 'return=minimal' },
                     body: JSON.stringify([{
                          id: crypto.randomUUID(),
                          ad: e.ad,
                          birim: e.birim,
                          takip: 'EVET'
                     }])
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
