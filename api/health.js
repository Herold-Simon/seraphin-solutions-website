// Health check endpoint
module.exports = function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  return res.status(200).json({
    status: 'ok',
    message: 'Seraphin Solutions API is running',
    timestamp: new Date().toISOString()
  });
}
