import { sbFetch, hesaplaStokMap, isAuthorized, sendError } from '../utils/supabase.js';

export default async function handler(req, res) {
    if (!isAuthorized(req)) {
        return sendError(res, 401, 'Geçersiz veya eksik şifre.');
    }

    try {
        const [urunlerRes, hareketlerRes] = await Promise.all([
            sbFetch('/rest/v1/urunler?select=*&order=ad.asc'),
            sbFetch('/rest/v1/hareketler?select=*&order=tarih.asc')
        ]);
        
        const stokMap = hesaplaStokMap(hareketlerRes);
        const urunler = urunlerRes.map(u => ({
            id: u.id,
            ad: u.ad || 'İsimsiz Ürün',
            birim: u.birim || '',
            miktar: stokMap[u.ad] || 0,
            minStok: u.min_stok || u.minStok || 0,
            kategori: u.kategori || 'diger',
            takip: (u.takip === 'EVET' || u.takip === true),
            alias: u.alias || []
        }));
        
        const sonHareketler = hareketlerRes.slice(-50).reverse().map(r => ({
            tarih: r.tarih,
            urunAdi: r.urun_adi,
            miktar: parseFloat(r.toplam_stok || r.miktar || 0),
            birim: r.birim,
            tip: r.tip,
            not: r.notlar || r.not || '',
            id: r.id
        }));
        
        return res.status(200).json({ basarili: true, veri: { urunler, sonHareketler } });

    } catch (err) {
        console.error('API Hatasi - asd:', err);
        return sendError(res, 500, err.message);
    }
}
