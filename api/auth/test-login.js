module.exports = async (req, res) => {
  // CORS-Header setzen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // OPTIONS-Request für CORS-Preflight behandeln
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Nur POST-Requests erlauben
  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.'
    });
    return;
  }

  try {
    const { username, password } = req.body;

    console.log('🔍 Test-Login versucht:', { username, password: password ? '***' : 'undefined' });

    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: 'Benutzername und Passwort sind erforderlich'
      });
      return;
    }

    // Simuliere einen erfolgreichen Login
    res.status(200).json({
      success: true,
      message: 'Test-Login erfolgreich!',
      user: {
        username: username,
        admin_user_id: 'test-admin-id-123'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Fehler im Test-Login:', error);
    res.status(500).json({
      success: false,
      error: 'Interner Serverfehler: ' + error.message
    });
  }
};
