import { createPublicKey } from 'crypto';

export interface SigningJwk {
  kty: 'RSA';
  n: string;
  e: string;
  kid: string;
  use: 'sig';
  alg: 'RS256';
}

/**
 * Secrets manager và một số cách nạp env hay làm mất newline thật trong
 * PEM, thay bằng chuỗi `\n` escape — chấp nhận cả 2 dạng thay vì chỉ
 * dạng có newline thật.
 */
export function normalizePem(pem: string): string {
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
}

/** Suy ra public key (PEM) từ private key (PEM) — không lưu 2 biến riêng để tránh lệch nhau. */
export function derivePublicKeyPem(privateKeyPem: string): string {
  const publicKey = createPublicKey(normalizePem(privateKeyPem));
  return publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

/** Chuyển public key (PEM) sang dạng JWK dùng để expose qua GET /auth/jwks.json. */
export function publicKeyPemToJwk(
  publicKeyPem: string,
  kid: string,
): SigningJwk {
  const publicKey = createPublicKey(normalizePem(publicKeyPem));
  const jwk = publicKey.export({ format: 'jwk' }) as { n: string; e: string };
  return {
    kty: 'RSA',
    n: jwk.n,
    e: jwk.e,
    kid,
    use: 'sig',
    alg: 'RS256',
  };
}
