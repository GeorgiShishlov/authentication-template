// __tests__/lib/api.test.ts
import { authAPI } from '@/lib/api';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockResponse(body: object, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

describe('authAPI', () => {
  beforeEach(() => mockFetch.mockReset());

  describe('register', () => {
    test('отправляет POST /auth/register с credentials:include', async () => {
      mockFetch.mockReturnValue(mockResponse({ message: 'ok' }));
      await authAPI.register({ email: 'a@b.com', password: 'Secret1!' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        expect.objectContaining({ method: 'POST', credentials: 'include' })
      );
    });

    test('при ошибке сервера бросает Error с message', async () => {
      mockFetch.mockReturnValue(mockResponse({ message: 'Уже существует' }, 400));
      await expect(authAPI.register({ email: 'a@b.com', password: 'Secret1!' }))
        .rejects.toThrow('Уже существует');
    });
  });

  describe('login', () => {
    test('отправляет POST /auth/login', async () => {
      mockFetch.mockReturnValue(mockResponse({ message: 'ok' }));
      await authAPI.login({ email: 'a@b.com', password: 'Secret1!' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    test('401 бросает ошибку (без авто-refresh для /auth/login)', async () => {
      mockFetch.mockReturnValue(mockResponse({ message: 'Неверный пароль' }, 401));
      await expect(authAPI.login({ email: 'a@b.com', password: 'Secret1!' }))
        .rejects.toThrow('Неверный пароль');
    });
  });

  describe('logout', () => {
    test('отправляет POST /auth/logout', async () => {
      mockFetch.mockReturnValue(mockResponse({ message: 'ok' }));
      await authAPI.logout();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('getProfile', () => {
    test('отправляет GET /profile/me', async () => {
      mockFetch.mockReturnValue(mockResponse({ user: { id: '1' } }));
      const result = await authAPI.getProfile();
      expect(result.user.id).toBe('1');
    });

    test('при 401 пытается refresh, при успехе повторяет запрос', async () => {
      mockFetch
        .mockReturnValueOnce(mockResponse({ message: 'Unauthorized' }, 401)) // исходный
        .mockReturnValueOnce(mockResponse({ message: 'ok' }, 200))           // refresh
        .mockReturnValueOnce(mockResponse({ user: { id: '1' } }, 200));      // retry
      const result = await authAPI.getProfile();
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.user.id).toBe('1');
    });

    test('при 401 и неудачном refresh бросает ошибку сессии', async () => {
      mockFetch
        .mockReturnValueOnce(mockResponse({ message: 'Unauthorized' }, 401))
        .mockReturnValueOnce(mockResponse({ message: 'expired' }, 401));
      await expect(authAPI.getProfile()).rejects.toThrow(/сессия/i);
    });
  });

  describe('forgotPassword', () => {
    test('отправляет POST /auth/forgot-password', async () => {
      mockFetch.mockReturnValue(mockResponse({ message: 'ok' }));
      await authAPI.forgotPassword('a@b.com');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/forgot-password'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('resetPassword', () => {
    test('отправляет POST /auth/reset-password с token и password', async () => {
      mockFetch.mockReturnValue(mockResponse({ message: 'ok' }));
      await authAPI.resetPassword('tok123', 'NewSecret1!');
      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body).toEqual({ token: 'tok123', password: 'NewSecret1!' });
    });
  });
});
