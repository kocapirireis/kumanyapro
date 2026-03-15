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
            takip: (u.takip === 'EVET' || u.takip === true),
            kategori: u.kategori || 'Diğer'
        }));
        
        return res.status(200).json({ basarili: true, veri: urunler });

    } catch (err) {
        console.error('API Hatasi - stokOku:', err);
        return sendError(res, 500, err.message);
    }
}
