// In-memory account store for created accounts
// In production, this would be a real database
let createdAccounts = [];

// Add a new account
function addAccount(username, password, deviceId, accountToken) {
  // Remove existing account with same username if exists
  createdAccounts = createdAccounts.filter(acc => acc.username !== username);
  
  // Add new account
  createdAccounts.push({
    username,
    password,
    deviceId,
    accountToken,
    createdAt: new Date().toISOString()
  });
  
  console.log(`Account added: ${username} (${createdAccounts.length} total accounts)`);
}

// Validate account credentials
function validateAccount(username, password) {
  const account = createdAccounts.find(acc => 
    acc.username === username && acc.password === password
  );
  
  if (account) {
    console.log(`Account validated: ${username}`);
    return { valid: true, account };
  } else {
    console.log(`Account validation failed: ${username}`);
    return { valid: false };
  }
}

// Get all accounts (for debugging)
function getAllAccounts() {
  return createdAccounts;
}

// Delete account
function deleteAccount(username) {
  const initialLength = createdAccounts.length;
  createdAccounts = createdAccounts.filter(acc => acc.username !== username);
  
  if (createdAccounts.length < initialLength) {
    console.log(`Account deleted: ${username}`);
    return true;
  }
  return false;
}

module.exports = {
  addAccount,
  validateAccount,
  getAllAccounts,
  deleteAccount
};
