import { createPublicKey } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { derivePublicKeyPem, publicKeyPemToJwk } from './rsa-keys.util';
import { generateTestRsaKeyPair } from './testing/rsa-test-keypair';

describe('rsa-keys.util', () => {
  const { privateKeyPem, publicKeyPem } = generateTestRsaKeyPair();

  describe('derivePublicKeyPem', () => {
    it('suy ra đúng public key từ private key (PEM có newline thật)', () => {
      const derived = derivePublicKeyPem(privateKeyPem);
      expect(derived.trim()).toBe(publicKeyPem.trim());
    });

    it('chấp nhận private key dạng \\n escape (không có newline thật)', () => {
      const escaped = privateKeyPem.replace(/\n/g, '\\n');
      const derived = derivePublicKeyPem(escaped);
      expect(derived.trim()).toBe(publicKeyPem.trim());
    });

    it('public key suy ra được dùng để verify token ký bằng private key gốc', () => {
      const derived = derivePublicKeyPem(privateKeyPem);
      const token = jwt.sign({ sub: 'user-1' }, privateKeyPem, {
        algorithm: 'RS256',
      });
      expect(() =>
        jwt.verify(token, derived, { algorithms: ['RS256'] }),
      ).not.toThrow();
    });
  });

  describe('publicKeyPemToJwk', () => {
    it('trả đúng shape JWK (kty/n/e/kid/use/alg), không lộ private material', () => {
      const jwk = publicKeyPemToJwk(publicKeyPem, 'test-key-1');

      expect(jwk).toMatchObject({
        kty: 'RSA',
        kid: 'test-key-1',
        use: 'sig',
        alg: 'RS256',
      });
      expect(typeof jwk.n).toBe('string');
      expect(typeof jwk.e).toBe('string');
      expect(jwk).not.toHaveProperty('d');
      expect(jwk).not.toHaveProperty('p');
      expect(jwk).not.toHaveProperty('q');
    });

    it('JWK export đúng giá trị n/e để verify token thật (round-trip qua createPublicKey)', () => {
      const jwk = publicKeyPemToJwk(publicKeyPem, 'test-key-1');
      const token = jwt.sign({ sub: 'user-1' }, privateKeyPem, {
        algorithm: 'RS256',
        keyid: 'test-key-1',
      });

      const reconstructed = createPublicKey({
        key: { kty: jwk.kty, n: jwk.n, e: jwk.e },
        format: 'jwk',
      });
      const reconstructedPem = reconstructed
        .export({ type: 'spki', format: 'pem' })
        .toString();

      expect(() =>
        jwt.verify(token, reconstructedPem, { algorithms: ['RS256'] }),
      ).not.toThrow();
    });
  });
});
