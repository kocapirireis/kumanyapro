import { isAuthorized, sendError, GUVENLIK_TOKEN } from '../utils/supabase.js';

export default async function handler(req, res) {
    if (req.body?.islem === 'ping') {
        return res.status(200).json({ basarili: true });
    }

    if (!GUVENLIK_TOKEN) {
        return sendError(res, 500, 'Sunucu hatası: GUVENLIK_TOKEN ayarlanmamış.');
    }

    if (!isAuthorized(req)) {
        return sendError(res, 401, 'Geçersiz veya eksik şifre.');
    }

    try {
        const { islem } = req.body;
        
        if (islem === 'tokenKontrol') {
            return res.status(200).json({ basarili: true, veri: true });
        }

        return sendError(res, 400, 'Bilinmeyen islem: ' + islem);

    } catch (err) {
        console.error('API Hatasi - auth:', err);
        return sendError(res, 500, err.message);
    }
}
