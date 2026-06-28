// __tests__/app/verify-email/page.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VerifyEmailPage from '@/app/verify-email/page';
import { authAPI } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  authAPI: {
    verifyEmail: jest.fn(),
  },
}));

const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

const api = authAPI as jest.Mocked<typeof authAPI>;

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSearchParams = new URLSearchParams();
  });

  test('показывает «Подтверждение...» пока запрос не завершён', () => {
    mockSearchParams.set('token', 'abc');
    api.verifyEmail.mockReturnValue(new Promise(() => {}));
    render(<VerifyEmailPage />);
    expect(screen.getByText(/подтверждение/i)).toBeInTheDocument();
  });

  test('без токена показывает ошибку «Токен не найден»', async () => {
    render(<VerifyEmailPage />);
    await screen.findByText(/токен не найден/i);
    expect(api.verifyEmail).not.toHaveBeenCalled();
  });

  test('успешная верификация: показывает сообщение и кнопку «Войти»', async () => {
    mockSearchParams.set('token', 'valid-token');
    api.verifyEmail.mockResolvedValue({ message: 'Email подтверждён' });
    render(<VerifyEmailPage />);
    await screen.findByText(/email подтверждён/i);
    expect(screen.getByRole('button', { name: /войти/i })).toBeInTheDocument();
    expect(api.verifyEmail).toHaveBeenCalledWith('valid-token');
  });

  test('ошибка верификации: показывает сообщение и кнопку «На главную»', async () => {
    mockSearchParams.set('token', 'bad-token');
    api.verifyEmail.mockRejectedValue(new Error('Токен недействителен'));
    render(<VerifyEmailPage />);
    await screen.findByText(/токен недействителен/i);
    expect(screen.getByRole('button', { name: /на главную/i })).toBeInTheDocument();
  });

  test('кнопка «Войти» редиректит на / и устанавливает sessionStorage', async () => {
    mockSearchParams.set('token', 'valid-token');
    api.verifyEmail.mockResolvedValue({ message: 'Email подтверждён' });
    render(<VerifyEmailPage />);
    await screen.findByRole('button', { name: /войти/i });
    await userEvent.click(screen.getByRole('button', { name: /войти/i }));
    expect(sessionStorage.getItem('openLoginModal')).toBe('true');
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  test('кнопка «На главную» редиректит на /', async () => {
    mockSearchParams.set('token', 'bad-token');
    api.verifyEmail.mockRejectedValue(new Error('Ошибка'));
    render(<VerifyEmailPage />);
    await screen.findByRole('button', { name: /на главную/i });
    await userEvent.click(screen.getByRole('button', { name: /на главную/i }));
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
