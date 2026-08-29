import { generateKeyPairSync } from 'crypto';

/**
 * In ra 1 RSA keypair mới để paste vào .env (JWT_PRIVATE_KEY) của
 * auth-service. Public key chỉ in ra để tham khảo — không cần lưu, mọi
 * nơi cần public key đều tự suy ra từ private key lúc runtime.
 *
 * Chạy: npm run generate:jwt-keypair
 */
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

console.log('# Paste dòng dưới vào .env của auth-service:');
console.log(`JWT_PRIVATE_KEY="${privateKey.replace(/\n/g, '\\n')}"`);
console.log();
console.log('# Public key (chỉ để tham khảo, không cần lưu ở đâu):');
console.log(publicKey);
