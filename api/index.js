export default async function handler(req, res) {
  // CORS ayarları
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // Apps Script'ten gelen 'text/plain' formatındaki POST isteklerini işle
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      // JSON değilse olduğu gibi bırak
    }
  }

  const { islem } = body || {};

  try {
    switch (islem) {
      case 'ping':
        return res.status(200).json({ basarili: true });
      
      case 'tokenKontrol':
        const { token } = body;
        const securityToken = process.env.SECURITY_TOKEN;
        return res.status(200).json({ veri: token === securityToken });

      case 'faturaOku':
        const faturaOku = (await import('./faturaOku.js')).default;
        return await faturaOku(req, res, body);

      case 'analizHesapla':
        const analizHesapla = (await import('./analizHesapla.js')).default;
        return await analizHesapla(req, res, body);

      default:
        return res.status(400).json({ error: `Geçersiz işlem: ${islem}` });
    }
  } catch (error) {
    console.error('API Hatası:', error);
    return res.status(500).json({ error: error.message });
  }
}
