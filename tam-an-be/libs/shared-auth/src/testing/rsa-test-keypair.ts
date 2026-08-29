import { generateKeyPairSync } from 'crypto';

/**
 * CHỈ dùng trong test — sinh 1 cặp RSA keypair thật để ký/verify token
 * RS256 trong các spec tích hợp (guard, controller), tránh phải mock
 * toàn bộ chuỗi ký/verify. Không export qua `index.ts` của lib.
 */
export function generateTestRsaKeyPair(): {
  privateKeyPem: string;
  publicKeyPem: string;
} {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { privateKeyPem: privateKey, publicKeyPem: publicKey };
}
