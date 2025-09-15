// api/debug.js - Debug-API für Umgebungsvariablen
module.exports = async function handler(req, res) {
  // CORS-Header setzen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // OPTIONS-Anfrage für Preflight behandeln
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  return res.status(200).json({
    success: true,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      supabaseUrl: supabaseUrl ? 'Set (length: ' + supabaseUrl.length + ')' : 'Not set',
      supabaseKey: supabaseServiceKey ? 'Set (length: ' + supabaseServiceKey.length + ')' : 'Not set',
      allEnvVars: Object.keys(process.env).filter(key => key.includes('SUPABASE'))
    },
    timestamp: new Date().toISOString()
  });
};
