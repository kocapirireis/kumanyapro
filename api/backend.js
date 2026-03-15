// Vercel Serverless Function - backend.js
// Handles all backend logic interacting securely with Supabase.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GUVENLIK_TOKEN = process.env.GUVENLIK_TOKEN;

// Helper to fetch from Supabase
async function sbFetch(path, options = {}) {
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

module.exports = async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ basarili: false, error: 'Method Not Allowed' });
    }

    try {
        const { islem, token, payload = {} } = req.body;

        // Security Check
        if (islem === 'ping') return res.status(200).json({ basarili: true });

        if (!token || token !== GUVENLIK_TOKEN) {
            return res.status(401).json({ basarili: false, error: 'Geçersiz veya eksik şifre.' });
        }

        if (islem === 'tokenKontrol') {
            return res.status(200).json({ basarili: true, veri: true });
        }

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
            
            return res.status(200).json({ basarili: true, veri: { urunler, sonHareketler } });
        }

        if (islem === 'stokEkle') {
            const urunlerParam = payload.urunler || [];
            const islemTip = payload.tip || 'GIRIS';

            // 1. Fetch current stocks
            const hareketlerRes = await sbFetch('/rest/v1/hareketler?select=*&order=tarih.asc');
            const stokMap = hesaplaStokMap(hareketlerRes);
            
            // 2. Prepare patches and inserts
            let count = 0;
            for (let i = 0; i < urunlerParam.length; i++) {
                const e = urunlerParam[i];
                if (!e.ad || e.miktar === 0) continue;
                
                const urunAd = e.ad.toString().trim();
                const artis = parseFloat(e.miktar);
                
                let current = stokMap[urunAd] || 0;
                let yeniStok = current;
                
                if (islemTip === 'SAYIM') {
                     yeniStok = artis; // Set exact
                } else if (islemTip === 'CIKIS') {
                     yeniStok = current - artis;
                } else { // GIRIS
                     yeniStok = current + artis;
                }
                
                // Add Movement Record
                const harNot = `Fatura/Sayım - Değişim: ${artis}`;
                await sbFetch('/rest/v1/hareketler', {
                    method: 'POST',
                    headers: { 'Prefer': 'return=minimal' },
                    body: JSON.stringify([{
                        id: crypto.randomUUID(),
                        tarih: new Date().toISOString(),
                        urun_adi: urunAd,
                        miktar: Math.abs(artis),
                        toplam_stok: yeniStok,
                        birim: e.birim,
                        tip: islemTip,
                        notlar: harNot
                    }])
                });

                // Upsert to Products if we don't have this product
                const mevcutUrunler = await sbFetch(`/rest/v1/urunler?ad=eq.${encodeURIComponent(urunAd)}&select=id`);
                if (!mevcutUrunler || mevcutUrunler.length === 0) {
                     await sbFetch('/rest/v1/urunler', {
                         method: 'POST',
                         headers: { 'Prefer': 'return=minimal' },
                         body: JSON.stringify([{
                              id: e.id || crypto.randomUUID(),
                              ad: urunAd,
                              birim: e.birim,
                              kategori: e.kategori || 'diger',
                              takip: 'EVET'
                         }])
                     });
                }
                count++;
            }
            return res.status(200).json({ basarili: true, veri: `${count} işlem kaydedildi.` });
        }

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
            await sbFetch('/rest/v1/hareketler?id=not.is.null', { method: 'DELETE' });
            await sbFetch('/rest/v1/urunler?ad=not.is.null', { method: 'DELETE' });
            return res.status(200).json({ basarili: true });
        }

        if (islem === 'analizHesapla') {
            const [urunlerRes, hareketlerRes] = await Promise.all([
                sbFetch('/rest/v1/urunler?select=*'),
                sbFetch('/rest/v1/hareketler?select=*&order=tarih.asc')
            ]);
            const stokMap = hesaplaStokMap(hareketlerRes);
            
            const veri = urunlerRes.map(u => {
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
                return { 
                    urunAdi: u.ad, 
                    mevcutStok, 
                    aylikTuketim: parseFloat(aylikTuketim.toFixed(1)), 
                    kacAyYeter: parseFloat(kacAyYeter.toFixed(1)), 
                    kategori: (u.kategori || 'diger').toLowerCase(), 
                    birim: u.birim || '', 
                    takip: u.takip 
                };
            });

            return res.status(200).json({ basarili: true, veri });
        }

        return res.status(400).json({ basarili: false, error: 'Bilinmeyen islem: ' + islem });

    } catch (err) {
        console.error('Backend Hatasi:', err);
        return res.status(500).json({ basarili: false, error: err.message });
    }
};