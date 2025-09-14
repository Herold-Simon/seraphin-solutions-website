// Simple in-memory database for demo purposes
// Note: This will reset on each serverless function restart
// In production, use a real database like MongoDB, PostgreSQL, etc.

// Global cache to store data between function calls
global.appCache = global.appCache || {
  accounts: {},
  passwords: {}
};

const accounts = global.appCache.accounts;
const passwords = global.appCache.passwords;

// Account management functions
function createAccount(username, adminPassword, deviceId, statistics) {
  accounts[username] = {
    username,
    deviceId,
    statistics,
    isActive: true,
    createdAt: new Date().toISOString()
  };
  
  // Store the admin password separately
  passwords[username] = adminPassword;
  
  console.log(`Account created: ${username} with device: ${deviceId}`);
  return true;
}

function getAccount(username) {
  return accounts[username] || null;
}

function getPassword(username) {
  return passwords[username] || null;
}

function updatePassword(username, newPassword) {
  if (accounts[username]) {
    passwords[username] = newPassword;
    console.log(`Password updated for user: ${username}`);
    return true;
  }
  return false;
}

function updateStatistics(username, newStatistics) {
  if (accounts[username]) {
    accounts[username].statistics = newStatistics;
    accounts[username].lastUpdated = new Date().toISOString();
    return true;
  }
  return false;
}

function getStatistics(username) {
  return accounts[username]?.statistics || null;
}

module.exports = {
  createAccount,
  getAccount,
  getPassword,
  updatePassword,
  updateStatistics,
  getStatistics
};
