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

        if (islem === 'tumSistemiSifirla') {
            if (payload.onayKodu !== 'SIFIRLA') throw new Error('Onay kodu hatalı');
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
