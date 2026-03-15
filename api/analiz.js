import { sbFetch, hesaplaStokMap, isAuthorized, sendError } from '../utils/supabase.js';

export default async function handler(req, res) {
    if (!isAuthorized(req)) {
        return sendError(res, 401, 'Geçersiz veya eksik şifre.');
    }

    try {
        const hareketler = await sbFetch('/rest/v1/hareketler?select=*&order=tarih.asc');
        const stokMap = hesaplaStokMap(hareketler);

        const analiz = Object.keys(stokMap).map(urun => {
            const m = stokMap[urun];
            // Basit analiz mantığı - detay v14/v21'den korunuyor
            return {
                urun,
                mevcutStok: m,
                aylikTuketim: '-',
                stokBitis: m <= 0 ? 'KRİTİK' : 'YETERLİ'
            };
        });

        const onerilenSiparis = analiz.filter(a => a.stokBitis === 'KRİTİK').map(a => ({
            urun: a.urun,
            eksiMiktar: 1,
            birim: 'ADET'
        }));

        return res.status(200).json({ basarili: true, analiz, onerilenSiparis });

    } catch (err) {
        console.error('API Hatasi - analiz:', err);
        return sendError(res, 500, err.message);
    }
}
