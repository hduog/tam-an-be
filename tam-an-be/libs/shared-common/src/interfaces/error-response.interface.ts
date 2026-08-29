/**
 * Standard error envelope for the whole API — introduced by Issue #10
 * since no baseline format was actually built in Sprint 0 (only planned).
 * Every module going forward reuses this, not just AuthModule.
 */
export interface ErrorResponseBody {
  statusCode: number;
  errorCode: string;
  message: string | string[];
  path: string;
  timestamp: string;
}
