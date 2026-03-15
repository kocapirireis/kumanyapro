/* API and Data Sync Logic */

// SB_HEADERS will be initialized when needed or after CONFIG is ready
var SB_HEADERS = {};

function initializeApi() {
    if (typeof CONFIG === 'undefined' || !CONFIG.SB_KEY) {
        console.error("[API] HATA: CONFIG.SB_KEY bulunamadı! config.js yüklenmemiş olabilir.");
        return;
    }
    SB_HEADERS = {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SB_KEY,
        'Authorization': 'Bearer ' + CONFIG.SB_KEY
    };
    console.log("[API] Başarıyla ilklendirildi.");
}

// İlk çağrıda ilklendir
setTimeout(initializeApi, 0);

/**
 * Sanitize data from API
 */
function temizleVeri(veri) {
    if (typeof veri === 'string') {
        const div = document.createElement('div');
        div.textContent = veri;
        return div.innerHTML;
    }
    if (Array.isArray(veri)) return veri.map(temizleVeri);
    if (veri && typeof veri === 'object') {
        const temiz = {};
        for (const key in veri) temiz[key] = temizleVeri(veri[key]);
        return temiz;
    }
    return veri;
}

/**
 * Supabase fetch wrapper
 */
async function sbFetch(path, options = {}) {
    const res = await fetch(SB_URL + path, { ...options, headers: { ...SB_HEADERS, ...(options.headers || {}) } });
    if (!res.ok) { 
        let errMsg = 'Supabase hatası: ' + res.status; 
        try { 
            const err = await res.json(); 
            errMsg = err.message || err.error || errMsg; 
        } catch(e) {} 
        throw new Error(errMsg); 
    }
    if (res.status === 204 || res.status === 201) return null;
    const data = await res.json();
    return temizleVeri(data);
}

/**
 * Calculate stock map from movements
 */
function hesaplaStokMap(hareketler) {
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

/**
 * Main API call router
 */
async function apiCall(islem, payload = {}) {
    const controller = new AbortController();
    const timeoutLimit = (islem === 'faturaOku' || islem === 'analizHesapla') ? 60000 : 20000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutLimit);

    try {
        console.log(`[API] ${islem} baslatıldı... URL:`, CONFIG.APPS_SCRIPT_URL);
        
        if (!CONFIG.APPS_SCRIPT_URL) {
            throw new Error("Apps Script URL'si yapılandırılmamış (config.js eksik).");
        }

        const fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            signal: controller.signal
        };

        if (islem === 'tokenKontrol') {
            const data = { islem: 'tokenKontrol', token: payload.token };
            const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
                ...fetchOptions,
                body: JSON.stringify(data)
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error('Sunucu baglantısı kurulamadı (HTTP ' + response.status + ')');
            const result = await response.json();
            return result.veri;
        }

        if (islem === 'ping') return { basarili: true };

        if (islem === 'stokOku') {
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
            return { urunler, sonHareketler };
        }

        if (islem === 'stokEkle') {
            const token = localStorage.getItem('userToken');
            const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ 
                    islem: 'stokEkle', 
                    token: token, 
                    urunler: payload.urunler, 
                    tip: payload.tip 
                })
            });
            if (!response.ok) throw new Error('Backend bağlantı hatası');
            const result = await response.json();
            if (result.basarili) return result.veri;
            throw new Error(result.hata || 'Kayıt başarısız');
        }

        if (islem === 'hareketGeriAl') {
            await sbFetch(`/rest/v1/hareketler?id=eq.${payload.id}`, { method: 'DELETE' });
            return true;
        }

        if (islem === 'topluHareketGeriAl') {
            const ids = payload.ids.map(id => `"${id}"`).join(',');
            await sbFetch(`/rest/v1/hareketler?id=in.(${ids})`, { method: 'DELETE' });
            return true;
        }

        if (islem === 'takipGuncelle') {
            const { urunAdi, alan, deger } = payload;
            const col = alan === 'takip' ? 'takip' : alan === 'kategori' ? 'kategori' : null;
            if (!col) throw new Error('Geçersiz alan');
            await sbFetch(`/rest/v1/urunler?ad=eq.${encodeURIComponent(urunAdi)}`, { method: 'PATCH', body: JSON.stringify({ [col]: deger }), headers: { Prefer: 'return=minimal' } });
            return true;
        }

        if (islem === 'urunGecmisiSifirla') {
            const { urunAdi, baslangicMiktar } = payload;
            await sbFetch(`/rest/v1/hareketler?urun_adi=eq.${encodeURIComponent(urunAdi)}`, { method: 'DELETE' });
            await sbFetch('/rest/v1/hareketler', { method: 'POST', body: JSON.stringify([{ id: crypto.randomUUID(), tarih: new Date().toISOString(), urun_adi: urunAdi, miktar: baslangicMiktar, birim: '', tip: 'BASLANGIC', notlar: 'Sifirlama sonrasi' }]), headers: { Prefer: 'return=minimal' } });
            return true;
        }

        if (islem === 'tumSistemiSifirla') {
            if (payload.onayKodu !== 'SIFIRLA') throw new Error('Onay kodu hatalı');
            await sbFetch('/rest/v1/hareketler?id=neq.""', { method: 'DELETE' });
            await sbFetch('/rest/v1/urunler?id=gt.0', { method: 'DELETE' });
            return true;
        }

        if (islem === 'analizHesapla') {
            const [urunlerRes, hareketlerRes] = await Promise.all([
                sbFetch('/rest/v1/urunler?select=*'),
                sbFetch('/rest/v1/hareketler?select=*&order=tarih.asc')
            ]);
            const stokMap = hesaplaStokMap(hareketlerRes);
            return urunlerRes.map(u => {
                const urunHareketler = hareketlerRes.filter(h => h.urun_adi === u.ad);
                const cikislar = urunHareketler.filter(h => h.tip === 'CIKIS');
                let aylikTuketim = 0;
                if (cikislar.length > 0) {
                    const otuzGunOnce = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                    aylikTuketim = cikislar.filter(h => new Date(h.tarih) > otuzGunOnce).reduce((s, h) => s + parseFloat(h.miktar), 0);
                } else {
                    const baslangiclar = urunHareketler.filter(h => h.tip === 'BASLANGIC').sort((a, b) => new Date(a.tarih) - new Date(b.tarih));
                    const girisler = urunHareketler.filter(h => h.tip === 'GIRIS').sort((a, b) => new Date(a.tarih) - new Date(b.tarih));
                    let toplamTuketim = 0, toplamGun = 0;
                    for (let i = 0; i < baslangiclar.length; i++) {
                        const oncekiGiris = girisler.filter(g => new Date(g.tarih) < new Date(baslangiclar[i].tarih)).pop();
                        if (oncekiGiris) {
                            const tuketilen = parseFloat(oncekiGiris.miktar) - parseFloat(baslangiclar[i].miktar);
                            const gunFarki = (new Date(baslangiclar[i].tarih) - new Date(oncekiGiris.tarih)) / (1000 * 60 * 60 * 24);
                            if (tuketilen > 0 && gunFarki > 0) { toplamTuketim += tuketilen; toplamGun += gunFarki; }
                        }
                    }
                    if (toplamGun > 0) aylikTuketim = (toplamTuketim / toplamGun) * 30;
                }
                const mevcutStok = stokMap[u.ad] || 0;
                const kacAyYeter = aylikTuketim > 0 ? mevcutStok / aylikTuketim : 99;
                return { urunAdi: u.ad, mevcutStok, aylikTuketim: parseFloat(aylikTuketim.toFixed(1)), kacAyYeter: kacAyYeter.toFixed(1), kategori: (u.kategori || 'diger').toLowerCase(), birim: u.birim || '', takip: u.takip };
            });
        }

        if (islem === 'faturaOku') {
            const token = localStorage.getItem('userToken');
            const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ 
                    islem: 'faturaOku', 
                    token: token, 
                    imageBase64: payload.imageBase64 
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error('Backend bağlantı hatası');
            const result = await response.json();
            if (result.basarili) return result.veri;
            throw new Error(result.hata || 'Analiz başarısız');
        }

        throw new Error('Bilinmeyen işlem: ' + islem);
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('İslem zaman aşımına ugradı (Sunucu cok yavas). Lütfen tekrar deneyin.');
        }
        if (error instanceof TypeError && (error.message === 'Failed to fetch' || error.message === 'Load failed')) {
            throw new Error('Bağlantı kesildi. İnternetinizi veya Vercel/Apps Script durumunu kontrol edin.');
        }
        console.error('API Call Hatası:', error);
        throw error;
    }
}
