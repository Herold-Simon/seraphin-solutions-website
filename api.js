// api.js - Einfache Test-API im Root
module.exports = async function handler(req, res) {
  // CORS-Header setzen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // OPTIONS-Anfrage für Preflight behandeln
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  return res.status(200).json({
    success: true,
    message: 'Root API funktioniert!',
    method: req.method,
    timestamp: new Date().toISOString(),
    path: req.url
  });
};
