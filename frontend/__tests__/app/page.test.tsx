// __tests__/app/page.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from '@/app/page';
import { authAPI } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  trackPage: jest.fn(),
  authAPI: {
    login: jest.fn(),
    register: jest.fn(),
    forgotPassword: jest.fn(),
  },
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

const api = authAPI as jest.Mocked<typeof authAPI>;

// Открывает модальное окно кликом по кнопке «Войти» в шапке
const openModal = async () => {
  await userEvent.click(screen.getByRole('button', { name: /^войти$/i }));
};

// Возвращает форму внутри модального окна
const getForm = () => screen.getByPlaceholderText(/электронная почта/i).closest('form')!;

describe('Home + AuthModal (login/register/forgot)', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  // ── начальный рендер ──────────────────────────────────────────────────────

  test('отображает кнопку «Войти» в шапке по умолчанию', () => {
    render(<Home />);
    expect(screen.getByRole('button', { name: /^войти$/i })).toBeInTheDocument();
  });

  test('клик «Войти» открывает модальное окно с заголовком и полем пароля', async () => {
    render(<Home />);
    await openModal();
    expect(screen.getByRole('heading', { name: /войти в аккаунт/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/пароль/i)).toBeInTheDocument();
  });

  // ── переключение режимов ──────────────────────────────────────────────────

  test('клик «Нет аккаунта» переключает в режим регистрации', async () => {
    render(<Home />);
    await openModal();
    await userEvent.click(screen.getByRole('button', { name: /нет аккаунта/i }));
    expect(screen.getByRole('heading', { name: /создать аккаунт/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /зарегистрироваться/i })).toBeInTheDocument();
  });

  test('клик «Забыли пароль» переключает в режим forgot', async () => {
    render(<Home />);
    await openModal();
    await userEvent.click(screen.getByRole('button', { name: /забыли пароль/i }));
    expect(screen.getByRole('heading', { name: /восстановление/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/^пароль$/i)).not.toBeInTheDocument();
  });

  test('из forgot «Вернуться ко входу» возвращает в login', async () => {
    render(<Home />);
    await openModal();
    await userEvent.click(screen.getByRole('button', { name: /забыли пароль/i }));
    await userEvent.click(screen.getByRole('button', { name: /вернуться ко входу/i }));
    expect(screen.getByRole('heading', { name: /войти в аккаунт/i })).toBeInTheDocument();
  });

  // ── login ─────────────────────────────────────────────────────────────────

  test('login: сабмит всегда вызывает authAPI.login (без клиентской валидации)', async () => {
    api.login.mockRejectedValue(new Error('Неверный email или пароль'));
    render(<Home />);
    await openModal();
    fireEvent.submit(getForm());
    await screen.findByText(/неверный email или пароль/i);
    expect(api.login).toHaveBeenCalled();
  });

  test('login успешный: вызывает authAPI.login и редиректит в /profile', async () => {
    api.login.mockResolvedValue({ message: 'ok' });
    render(<Home />);
    await openModal();
    await userEvent.type(screen.getByPlaceholderText(/электронная почта/i), 'a@b.com');
    await userEvent.type(screen.getByPlaceholderText(/пароль/i), 'Secret1!');
    fireEvent.submit(getForm());
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/profile'));
    expect(api.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'Secret1!' });
  });

  test('login: ошибка сервера отображается', async () => {
    api.login.mockRejectedValue(new Error('Неверный пароль'));
    render(<Home />);
    await openModal();
    await userEvent.type(screen.getByPlaceholderText(/электронная почта/i), 'a@b.com');
    await userEvent.type(screen.getByPlaceholderText(/пароль/i), 'Secret1!');
    fireEvent.submit(getForm());
    await screen.findByText(/неверный пароль/i);
    expect(mockPush).not.toHaveBeenCalled();
  });

  // ── register ─────────────────────────────────────────────────────────────

  test('register: валидация слабого пароля показывает ошибки', async () => {
    render(<Home />);
    await openModal();
    await userEvent.click(screen.getByRole('button', { name: /нет аккаунта/i }));
    await userEvent.type(screen.getByPlaceholderText(/электронная почта/i), 'a@b.com');
    await userEvent.type(screen.getByPlaceholderText(/пароль/i), 'weak');
    fireEvent.submit(getForm());
    await screen.findByText(/не менее 6 символов/i);
  });

  test('register успешный: показывает сообщение от сервера', async () => {
    api.register.mockResolvedValue({ message: 'Проверьте почту' });
    render(<Home />);
    await openModal();
    await userEvent.click(screen.getByRole('button', { name: /нет аккаунта/i }));
    await userEvent.type(screen.getByPlaceholderText(/электронная почта/i), 'a@b.com');
    await userEvent.type(screen.getByPlaceholderText(/пароль/i), 'Secret1!');
    fireEvent.submit(getForm());
    await screen.findByText(/проверьте почту/i);
    expect(api.register).toHaveBeenCalledWith({ email: 'a@b.com', password: 'Secret1!' });
  });

  // ── индикатор силы пароля ─────────────────────────────────────────────────

  test('register: слабый пароль показывает «Слабый»', async () => {
    render(<Home />);
    await openModal();
    await userEvent.click(screen.getByRole('button', { name: /нет аккаунта/i }));
    await userEvent.type(screen.getByPlaceholderText(/пароль/i), 'aaa');
    await screen.findByText(/слабый/i);
  });

  test('register: надёжный пароль показывает «Надёжный»', async () => {
    render(<Home />);
    await openModal();
    await userEvent.click(screen.getByRole('button', { name: /нет аккаунта/i }));
    await userEvent.type(screen.getByPlaceholderText(/пароль/i), 'SecurePass1!long');
    await screen.findByText(/надёжный/i);
  });

  // ── show/hide пароля ──────────────────────────────────────────────────────

  test('кнопка глаза переключает тип поля пароля', async () => {
    render(<Home />);
    await openModal();
    const passwordInput = screen.getByPlaceholderText(/пароль/i);
    expect(passwordInput).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByLabelText(/показать пароль/i));
    expect(passwordInput).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByLabelText(/скрыть пароль/i));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  // ── forgot ────────────────────────────────────────────────────────────────

  test('forgot: успешная отправка показывает сообщение', async () => {
    api.forgotPassword.mockResolvedValue({ message: 'Инструкции отправлены' });
    render(<Home />);
    await openModal();
    await userEvent.click(screen.getByRole('button', { name: /забыли пароль/i }));
    await userEvent.type(screen.getByPlaceholderText(/электронная почта/i), 'a@b.com');
    fireEvent.submit(getForm());
    await screen.findByText(/инструкции отправлены/i);
    expect(api.forgotPassword).toHaveBeenCalledWith('a@b.com');
  });

  test('forgot: пустой email показывает ошибку без вызова API', async () => {
    render(<Home />);
    await openModal();
    await userEvent.click(screen.getByRole('button', { name: /забыли пароль/i }));
    fireEvent.submit(getForm());
    await screen.findByText(/email обязателен/i);
    expect(api.forgotPassword).not.toHaveBeenCalled();
  });

  test('forgot: ошибка сервера (429) отображается', async () => {
    api.forgotPassword.mockRejectedValue(new Error('Слишком много попыток'));
    render(<Home />);
    await openModal();
    await userEvent.click(screen.getByRole('button', { name: /забыли пароль/i }));
    await userEvent.type(screen.getByPlaceholderText(/электронная почта/i), 'a@b.com');
    fireEvent.submit(getForm());
    await screen.findByText(/слишком много попыток/i);
  });
});
