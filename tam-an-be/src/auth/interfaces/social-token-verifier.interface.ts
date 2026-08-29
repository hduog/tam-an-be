export interface VerifiedSocialToken {
  providerId: string;
  email: string;
  /** Không phải provider nào cũng trả tên (Apple thường không có). */
  displayName?: string;
}

/**
 * Cho phép AuthService test được mà không phải gọi mạng thật tới
 * Google/Apple. Khai báo dạng property (không phải method shorthand) để
 * tránh cảnh báo @typescript-eslint/unbound-method khi test tham chiếu
 * `verifier.verify` như 1 jest mock độc lập.
 */
export interface SocialTokenVerifier {
  verify: (idToken: string) => Promise<VerifiedSocialToken>;
}
