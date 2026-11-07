// Basic hardening: allowed origins and protective response headers.
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})(:\d+)?$/

// Only this computer, the local network and origins listed in CORS_ORIGINS may call the API from a browser.
function allowedOrigin(origin, extra = process.env.CORS_ORIGINS) {
  if (!origin) return true
  const listed = String(extra || '').split(',').map(item => item.trim().replace(/\/$/, '')).filter(Boolean)
  return LOCAL.test(origin) || listed.includes(origin)
}
function headers(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  })
  if (req.path.startsWith('/api/') && !res.get('Cache-Control')) res.set('Cache-Control', 'no-store')
  next()
}
module.exports = { allowedOrigin, headers }
