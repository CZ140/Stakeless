import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../env.js';

// Google's public signing keys. createRemoteJWKSet caches them in-process and
// refetches automatically when Google rotates keys (honouring cache headers),
// so we verify ID tokens without an extra dependency or per-request fetch.
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export interface GoogleProfile {
  googleId: string; // the 'sub' claim — a stable, unique Google user id
  email: string;
  emailVerified: boolean;
  name: string | null;
}

// Verify a Google Identity Services ID token (the `credential` the GSI button
// hands back). Confirms the signature against Google's JWKS, that it hasn't
// expired, that it was issued by Google, and — critically — that it was minted
// for *our* client (audience). Throws a coded error on any failure.
export async function verifyGoogleCredential(credential: string): Promise<GoogleProfile> {
  if (!env.GOOGLE_CLIENT_ID) {
    throw Object.assign(new Error('Google sign-in is not configured'), { code: 'GOOGLE_NOT_CONFIGURED' });
  }

  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(credential, GOOGLE_JWKS, {
      issuer: GOOGLE_ISSUERS,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = result.payload as Record<string, unknown>;
  } catch {
    throw Object.assign(new Error('Invalid Google credential'), { code: 'INVALID_GOOGLE_TOKEN' });
  }

  const googleId = typeof payload['sub'] === 'string' ? payload['sub'] : '';
  const email = typeof payload['email'] === 'string' ? payload['email'] : '';
  if (!googleId || !email) {
    throw Object.assign(new Error('Google credential missing required claims'), { code: 'INVALID_GOOGLE_TOKEN' });
  }

  return {
    googleId,
    email: email.toLowerCase(),
    // Google sends email_verified as a real boolean, but older payloads used the
    // string 'true' — accept both.
    emailVerified: payload['email_verified'] === true || payload['email_verified'] === 'true',
    name: typeof payload['name'] === 'string' ? payload['name'] : null,
  };
}
