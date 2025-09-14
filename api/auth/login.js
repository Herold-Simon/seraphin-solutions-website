// Token verification endpoint
module.exports = function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Kein gültiger Token' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  try {
    // Decode the token (in production, use proper JWT verification)
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [username, timestamp] = decoded.split(':');
    
    // Check if token is not too old (24 hours)
    const tokenAge = Date.now() - parseInt(timestamp);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (tokenAge > maxAge) {
      return res.status(401).json({ message: 'Token abgelaufen' });
    }
    
    // For demo: Accept any valid token with valid username
    if (username && username.trim().length > 0) {
      return res.status(200).json({
        message: 'Token gültig',
        username: username
      });
    }
    
    return res.status(401).json({ message: 'Ungültiger Benutzername' });
  } catch (error) {
    return res.status(401).json({ message: 'Ungültiger Token' });
  }
}
