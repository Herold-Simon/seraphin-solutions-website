// Token verification endpoint
export default function handler(req, res) {
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
    
    return res.status(200).json({
      message: 'Token gültig',
      username: username
    });
  } catch (error) {
    return res.status(401).json({ message: 'Ungültiger Token' });
  }
}
