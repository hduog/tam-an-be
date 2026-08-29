import { ConfigService } from '@nestjs/config';
import { UserRole } from '@shared-auth';
import { UsersServiceClient } from './users-service-client';

describe('UsersServiceClient', () => {
  let client: UsersServiceClient;
  let fetchMock: jest.Mock<
    Promise<{ ok: boolean; status: number }>,
    [string, RequestInit]
  >;

  const payload = {
    userId: 'user-1',
    role: UserRole.USER,
    identityCreatedAt: new Date('2026-01-01T00:00:00Z'),
    displayName: 'Người dùng',
  };

  beforeEach(() => {
    const config = new ConfigService({
      USERS_SERVICE_URL: 'http://users-service.local',
      INTERNAL_API_KEY: 'x'.repeat(32),
    });
    client = new UsersServiceClient(config);
    fetchMock = jest.fn<
      Promise<{ ok: boolean; status: number }>,
      [string, RequestInit]
    >();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('createProfile', () => {
    it('gọi đúng URL/method/header/body', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 201 });

      await client.createProfile(payload);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://users-service.local/internal/users',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Internal-Api-Key': 'x'.repeat(32),
          }) as unknown,
        }),
      );
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1] as { body: string }).body,
      ) as Record<string, unknown>;
      expect(body).toEqual({
        user_id: 'user-1',
        role: UserRole.USER,
        identity_created_at: '2026-01-01T00:00:00.000Z',
        display_name: 'Người dùng',
      });
    });

    it('response non-2xx: ném lỗi', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      await expect(client.createProfile(payload)).rejects.toThrow();
    });

    it('fetch reject (lỗi mạng/timeout): ném lỗi', async () => {
      fetchMock.mockRejectedValue(new Error('network error'));

      await expect(client.createProfile(payload)).rejects.toThrow(
        'network error',
      );
    });
  });

  describe('deleteProfile', () => {
    it('thành công: không throw', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200 });

      await expect(client.deleteProfile('user-1')).resolves.toBeUndefined();
    });

    it('response non-2xx: không throw (best-effort)', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      await expect(client.deleteProfile('user-1')).resolves.toBeUndefined();
    });

    it('fetch reject (lỗi mạng/timeout): không throw (best-effort)', async () => {
      fetchMock.mockRejectedValue(new Error('network error'));

      await expect(client.deleteProfile('user-1')).resolves.toBeUndefined();
    });
  });
});
