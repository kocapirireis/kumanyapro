import crypto from 'crypto';
import { sbFetch, isAuthorized, sendError } from '../utils/supabase.js';

export default async function handler(req, res) {
    if (!isAuthorized(req)) {
        return sendError(res, 401, 'Geçersiz veya eksik şifre.');
    }

    try {
        const { islem, payload = {} } = req.body;

        if (islem === 'hareketGeriAl') {
            await sbFetch(`/rest/v1/hareketler?id=eq.${payload.id}`, { method: 'DELETE' });
            return res.status(200).json({ basarili: true });
        }

        if (islem === 'topluHareketGeriAl') {
            const ids = payload.ids.map(id => `"${id}"`).join(',');
            await sbFetch(`/rest/v1/hareketler?id=in.(${ids})`, { method: 'DELETE' });
            return res.status(200).json({ basarili: true });
        }

        if (islem === 'takipGuncelle') {
            const { urunAdi, alan, deger } = payload;
            const col = alan === 'takip' ? 'takip' : alan === 'kategori' ? 'kategori' : null;
            if (!col) throw new Error('Geçersiz alan');
            await sbFetch(`/rest/v1/urunler?ad=eq.${encodeURIComponent(urunAdi)}`, { 
                method: 'PATCH', 
                body: JSON.stringify({ [col]: deger }), 
                headers: { Prefer: 'return=minimal' } 
            });
            return res.status(200).json({ basarili: true });
        }

        if (islem === 'urunGecmisiSifirla') {
            const { urunAdi, baslangicMiktar } = payload;
            await sbFetch(`/rest/v1/hareketler?urun_adi=eq.${encodeURIComponent(urunAdi)}`, { method: 'DELETE' });
            await sbFetch('/rest/v1/hareketler', { 
                method: 'POST', 
                body: JSON.stringify([{ 
                    id: crypto.randomUUID(), 
                    tarih: new Date().toISOString(), 
                    urun_adi: urunAdi, 
                    miktar: baslangicMiktar, 
                    birim: '', 
                    tip: 'BASLANGIC', 
                    notlar: 'Sıfırlama sonrası' 
                }]), 
                headers: { Prefer: 'return=minimal' } 
            });
            return res.status(200).json({ basarili: true });
        }

        if (islem === 'tumSistemiSifirla') {
            if (payload.onayKodu !== 'SIFIRLA') throw new Error('Onay kodu hatalı');
            // Supabase API requires a filter for DELETE unless explicitly enabled.
            // Using a broad filter that matches all existing rows.
            await sbFetch('/rest/v1/hareketler?id=neq.00000000-0000-0000-0000-000000000000', { method: 'DELETE' });
            await sbFetch('/rest/v1/urunler?id=neq.00000000-0000-0000-0000-000000000000', { method: 'DELETE' });
            return res.status(200).json({ basarili: true });
        }

        return sendError(res, 400, 'Bilinmeyen islem: ' + islem);

    } catch (err) {
        console.error('API Hatasi - ayarlar:', err);
        return sendError(res, 500, err.message);
    }
}
