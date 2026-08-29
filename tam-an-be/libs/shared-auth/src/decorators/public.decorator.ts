import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a Guest-tier endpoint as exempt when JwtAuthGuard is applied
 * at controller level (e.g. via APP_GUARD in a future sprint).
 * Endpoints protected individually via `@UseGuards(JwtAuthGuard)` don't
 * need this — it only matters once the guard is registered globally.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
