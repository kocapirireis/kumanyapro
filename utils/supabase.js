const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
export const GUVENLIK_TOKEN = process.env.GUVENLIK_TOKEN;

export async function sbFetch(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        ...(options.headers || {})
    };

    const res = await fetch(SUPABASE_URL + path, { ...options, headers });
    if (!res.ok) {
        let errMsg = 'Supabase hatası: ' + res.status;
        try {
            const err = await res.json();
            errMsg = err.message || err.error || errMsg;
        } catch (e) { }
        throw new Error(errMsg);
    }
    if (res.status === 204 || res.status === 201) return null;
    return await res.json();
}

export function hesaplaStokMap(hareketler) {
    const map = {};
    hareketler.forEach(r => {
        const ad = r.urun_adi;
        const m = parseFloat(r.toplam_stok || r.miktar) || 0;
        if (r.tip === 'BASLANGIC' || r.tip === 'SAYIM') map[ad] = m;
        else if (r.tip === 'GIRIS') map[ad] = (map[ad] || 0) + m;
        else if (r.tip === 'CIKIS') map[ad] = (map[ad] || 0) - m;
    });
    return map;
}

export function isAuthorized(req) {
    // KULLANICI TALEBİ: Şifresiz giriş için yetkilendirme kontrolü devre dışı.
    return true; 
}

export function sendError(res, statusCode, errMessage) {
    return res.status(statusCode).json({ basarili: false, error: errMessage });
}
