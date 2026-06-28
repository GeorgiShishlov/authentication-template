// __tests__/app/reset-password/page.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetPasswordPage from '@/app/reset-password/page';
import { authAPI } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  authAPI: {
    resetPassword: jest.fn(),
  },
}));

const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

const api = authAPI as jest.Mocked<typeof authAPI>;

const VALID_PASSWORD = 'Secret1!';

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSearchParams = new URLSearchParams();
  });

  // ── без токена ────────────────────────────────────────────────────────────

  test('без токена показывает «Недействительная ссылка»', () => {
    render(<ResetPasswordPage />);
    expect(screen.getByText(/недействительная ссылка/i)).toBeInTheDocument();
  });

  test('без токена кнопка «На страницу входа» редиректит на /', async () => {
    render(<ResetPasswordPage />);
    await userEvent.click(screen.getByRole('button', { name: /на страницу входа/i }));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  // ── с токеном ─────────────────────────────────────────────────────────────

  test('с токеном показывает форму «Новый пароль»', () => {
    mockSearchParams.set('token', 'tok123');
    render(<ResetPasswordPage />);
    expect(screen.getByRole('heading', { name: /новый пароль/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/новый пароль/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/повторите пароль/i)).toBeInTheDocument();
  });

  // ── валидация ─────────────────────────────────────────────────────────────

  test('пустая отправка показывает «Пароль обязателен»', async () => {
    mockSearchParams.set('token', 'tok123');
    render(<ResetPasswordPage />);
    fireEvent.submit(screen.getByPlaceholderText(/новый пароль/i).closest('form')!);
    await screen.findByText(/пароль обязателен/i);
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  test('несовпадающие пароли показывают «Пароли не совпадают»', async () => {
    mockSearchParams.set('token', 'tok123');
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByPlaceholderText(/новый пароль/i), VALID_PASSWORD);
    await userEvent.type(screen.getByPlaceholderText(/повторите пароль/i), 'DifferentPass1!');
    fireEvent.submit(screen.getByPlaceholderText(/новый пароль/i).closest('form')!);
    await screen.findByText(/пароли не совпадают/i);
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  test('слабый пароль показывает ошибки валидации', async () => {
    mockSearchParams.set('token', 'tok123');
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByPlaceholderText(/новый пароль/i), 'weak');
    fireEvent.submit(screen.getByPlaceholderText(/новый пароль/i).closest('form')!);
    await screen.findByText(/не менее 6 символов/i);
  });

  // ── успешный сброс ────────────────────────────────────────────────────────

  test('успешный сброс показывает сообщение и кнопку «Войти»', async () => {
    mockSearchParams.set('token', 'tok123');
    api.resetPassword.mockResolvedValue({ message: 'Пароль успешно изменён' });
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByPlaceholderText(/новый пароль/i), VALID_PASSWORD);
    await userEvent.type(screen.getByPlaceholderText(/повторите пароль/i), VALID_PASSWORD);
    fireEvent.submit(screen.getByPlaceholderText(/новый пароль/i).closest('form')!);
    await screen.findByText(/пароль успешно изменён/i);
    expect(api.resetPassword).toHaveBeenCalledWith('tok123', VALID_PASSWORD);
    expect(screen.getByRole('button', { name: /войти/i })).toBeInTheDocument();
  });

  test('кнопка «Войти» после успеха редиректит на /', async () => {
    mockSearchParams.set('token', 'tok123');
    api.resetPassword.mockResolvedValue({ message: 'Пароль успешно изменён' });
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByPlaceholderText(/новый пароль/i), VALID_PASSWORD);
    await userEvent.type(screen.getByPlaceholderText(/повторите пароль/i), VALID_PASSWORD);
    fireEvent.submit(screen.getByPlaceholderText(/новый пароль/i).closest('form')!);
    await screen.findByRole('button', { name: /войти/i });
    await userEvent.click(screen.getByRole('button', { name: /войти/i }));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  // ── ошибка сервера ────────────────────────────────────────────────────────

  test('ошибка сервера отображается на форме', async () => {
    mockSearchParams.set('token', 'tok123');
    api.resetPassword.mockRejectedValue(new Error('Токен истёк'));
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByPlaceholderText(/новый пароль/i), VALID_PASSWORD);
    await userEvent.type(screen.getByPlaceholderText(/повторите пароль/i), VALID_PASSWORD);
    fireEvent.submit(screen.getByPlaceholderText(/новый пароль/i).closest('form')!);
    await screen.findByText(/токен истёк/i);
  });

  // ── индикатор силы пароля ─────────────────────────────────────────────────

  test('слабый пароль показывает «Слабый»', async () => {
    mockSearchParams.set('token', 'tok123');
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByPlaceholderText(/новый пароль/i), 'aaa');
    await screen.findByText(/слабый/i);
  });

  test('надёжный пароль показывает «Надёжный»', async () => {
    mockSearchParams.set('token', 'tok123');
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByPlaceholderText(/новый пароль/i), 'SecurePass1!long');
    await screen.findByText(/надёжный/i);
  });

  // ── show/hide пароля ──────────────────────────────────────────────────────

  test('кнопка глаза переключает видимость пароля', async () => {
    mockSearchParams.set('token', 'tok123');
    render(<ResetPasswordPage />);
    const newPasswordInput = screen.getByPlaceholderText(/новый пароль/i);
    expect(newPasswordInput).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByLabelText(/показать пароль/i));
    expect(newPasswordInput).toHaveAttribute('type', 'text');
  });
});
