// FileForge / OnlineToolsWeb — site Worker
//
// All user file processing remains client-side. This Worker does NOT accept
// file uploads or proxy files to third-party services. It only serves the
// compiled static assets and adds security headers / canonical HTTPS handling.

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://huggingface.co https://*.huggingface.co https://cdn-lfs.huggingface.co https://*.hf.co",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "media-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join('; ');

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);

  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=()'
  );
  headers.set('Strict-Transport-Security', 'max-age=31536000');
  headers.set('Content-Security-Policy', CSP);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Canonical HTTPS handling. Cloudflare normally terminates TLS before the
    // Worker, but retaining this guard also covers deployments where the
    // original request scheme reaches the Worker.
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    // No API endpoints are exposed. Remove Background runs entirely in the
    // browser via the models used by src/main.js.
    if (url.pathname.startsWith('/api/')) {
      return withSecurityHeaders(
        new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        })
      );
    }

    const response = await env.ASSETS.fetch(request);
    return withSecurityHeaders(response);
  },
};
