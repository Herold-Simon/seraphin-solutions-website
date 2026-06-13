// api/_lib/db.js - Gemeinsame Helfer fuer die neue API-Struktur
// Supabase-Client (Service Role), CORS, Session-Auth, bcrypt-Passwoerter.
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const cookie = require('cookie');
const crypto = require('crypto');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const SESSION_COOKIE = 'session_token';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 Tage

function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseServiceKey);
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function send(res, status, payload) {
  res.status(status).json(payload);
}

// Vercel parst JSON-Body automatisch; Fallback fuer den Fall eines Strings.
function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

async function hashPassword(plain) {
  return bcrypt.hash(String(plain), 10);
}

async function verifyPassword(plain, hash) {
  if (!hash) return false;
  try {
    return await bcrypt.compare(String(plain), String(hash));
  } catch (e) {
    return false;
  }
}

function getCookies(req) {
  return cookie.parse(req.headers.cookie || '');
}

function buildSessionCookie(token, maxAgeSeconds) {
  return cookie.serialize(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: typeof maxAgeSeconds === 'number' ? maxAgeSeconds : Math.floor(SESSION_TTL_MS / 1000),
    path: '/'
  });
}

function clearSessionCookie() {
  return cookie.serialize(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  });
}

async function createSession(accountId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const { error } = await supabase
    .from('sessions')
    .insert({ account_id: accountId, session_token: token, expires_at: expiresAt });
  if (error) throw new Error(error.message);
  return token;
}

/**
 * Loest die aktuelle Session auf.
 * Liefert { token, sessionId, account, isMaster, effectiveAccountId, actingAccount } oder null.
 * Master-Accounts koennen ein anderes Konto "verkoerpern" (acting_account_id).
 */
async function resolveSession(req) {
  const cookies = getCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const { data: session } = await supabase
    .from('sessions')
    .select('id, account_id, acting_account_id, expires_at')
    .eq('session_token', token)
    .limit(1)
    .maybeSingle();

  if (!session) return null;

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await supabase.from('sessions').delete().eq('id', session.id);
    return null;
  }

  const { data: account } = await supabase
    .from('accounts')
    .select('id, username, is_master, created_at')
    .eq('id', session.account_id)
    .maybeSingle();

  if (!account) return null;

  let effectiveAccountId = account.id;
  let actingAccount = null;

  if (account.is_master && session.acting_account_id) {
    const { data: acting } = await supabase
      .from('accounts')
      .select('id, username, is_master, created_at')
      .eq('id', session.acting_account_id)
      .maybeSingle();
    if (acting) {
      effectiveAccountId = acting.id;
      actingAccount = acting;
    }
  }

  return {
    token,
    sessionId: session.id,
    account,
    isMaster: Boolean(account.is_master),
    effectiveAccountId,
    actingAccount
  };
}

function timestampToIso(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    const ms = value > 1e12 ? value : value * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

module.exports = {
  supabase,
  hasSupabaseConfig,
  setCors,
  send,
  readBody,
  hashPassword,
  verifyPassword,
  getCookies,
  createSession,
  resolveSession,
  buildSessionCookie,
  clearSessionCookie,
  timestampToIso,
  SESSION_COOKIE,
  SESSION_TTL_MS
};
