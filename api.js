/* API and Data Sync Logic */

/**
 * Main API call router - routes to Vercel Serverless Functions
 */
async function apiCall(islem, payload = {}) {
    const controller = new AbortController();
    const timeoutLimit = (islem === 'faturaOku' || islem === 'analizHesapla' || islem === 'stokOku') ? 60000 : 20000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutLimit);

    try {
        console.log(`[API] ${islem} başlatılıyor...`);
        const token = localStorage.getItem('userToken') || payload.token;

        let endpoint = '';
        if (islem === 'faturaOku') endpoint = '/api/analyze';
        else if (islem === 'stokOku') endpoint = '/api/stokOku';
        else if (islem === 'stokEkle') endpoint = '/api/stokEkle';
        else if (islem === 'analizHesapla') endpoint = '/api/analiz';
        else if (islem === 'tokenKontrol' || islem === 'ping') endpoint = '/api/auth';
        else endpoint = '/api/ayarlar'; // tumSistemiSifirla, hareketGeriAl, vs.

        let bodyPayload = { islem, token, payload };

        if (islem === 'faturaOku') {
            bodyPayload = { islem, token, imageBase64: payload.imageBase64 };
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            if (response.status === 401) {
                console.error("[API] 401 Unauthorized - Oturum geçersiz.");
                if (window.logoutApp) window.logoutApp();
                throw new Error("Oturum süresi dolmuş. Lütfen tekrar giriş yapın.");
            }
            let errorMsg = 'Backend bağlantı hatası: ' + response.status;
            try { 
                const err = await response.json(); 
                errorMsg = err.error || errorMsg; 
            } catch(e) {}
            throw new Error(errorMsg);
        }

        const result = await response.json();

        if (islem === 'faturaOku') {
            if (result && result.urunler) return result;
            throw new Error(result.error || 'Analiz başarısız');
        }

        if (result.basarili) {
            return result.veri !== undefined ? result.veri : true;
        }
        
        throw new Error(result.error || 'İşlem başarısız');

    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') throw new Error('İşlem zaman aşımına uğradı. (Sunucu çok yavaş)');
        if (error instanceof TypeError && (error.message === 'Failed to fetch' || error.message === 'Load failed')) {
            throw new Error('Bağlantı kesildi. Vercel backend durumunu kontrol edin.');
        }
        console.error('API Call Hatası:', error);
        throw error;
    }
}
