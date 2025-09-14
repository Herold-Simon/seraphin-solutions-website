// Simple in-memory database for demo purposes
// In production, you would use a real database like MongoDB, PostgreSQL, etc.

let accounts = new Map();
let statistics = new Map();

// Initialize with some demo accounts
accounts.set('admin', {
  username: 'admin',
  password: 'admin123', // In production, this would be hashed
  deviceId: 'demo-device',
  createdAt: new Date().toISOString(),
  isActive: true
});

accounts.set('demo', {
  username: 'demo', 
  password: 'demo123',
  deviceId: 'demo-device-2',
  createdAt: new Date().toISOString(),
  isActive: true
});

// Account management functions
function createAccount(username, password, deviceId, statisticsData) {
  accounts.set(username, {
    username: username,
    password: password,
    deviceId: deviceId,
    createdAt: new Date().toISOString(),
    isActive: true
  });
  
  // Store initial statistics
  statistics.set(username, {
    ...statisticsData,
    lastUpdated: new Date().toISOString()
  });
  
  return true;
}

function getAccount(username) {
  return accounts.get(username);
}

function updateStatistics(username, statisticsData) {
  if (statistics.has(username)) {
    statistics.set(username, {
      ...statisticsData,
      lastUpdated: new Date().toISOString()
    });
    return true;
  }
  return false;
}

function getStatistics(username) {
  return statistics.get(username);
}

function getAllAccounts() {
  return Array.from(accounts.values());
}

function getAllStatistics() {
  return Array.from(statistics.entries()).map(([username, data]) => ({
    username,
    ...data
  }));
}

module.exports = {
  createAccount,
  getAccount,
  updateStatistics,
  getStatistics,
  getAllAccounts,
  getAllStatistics
};
