// __tests__/app/admin/page.test.tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPage from '@/app/admin/page';
import { adminAPI } from '@/lib/adminApi';

jest.mock('@/lib/adminApi', () => ({
  adminAPI: {
    check:      jest.fn(),
    login:      jest.fn(),
    logout:     jest.fn(),
    getUsers:   jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    getStats:   jest.fn(),
  },
}));

const api = adminAPI as jest.Mocked<typeof adminAPI>;

const fakeUsers = [
  {
    id: 'u1',
    username: 'alice',
    email: 'alice@test.com',
    password: '$2b$hash',
    email_verified: 1,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'u2',
    username: 'bob',
    email: 'bob@test.com',
    password: '$2b$hash2',
    email_verified: 0,
    created_at: '2024-01-02T00:00:00Z',
  },
];

function setupAuthed() {
  api.check.mockResolvedValue({});
  api.getUsers.mockResolvedValue({ users: fakeUsers });
}

describe('AdminPage — загрузка и аутентификация', () => {
  beforeEach(() => jest.clearAllMocks());

  test('показывает «Загрузка...» при проверке авторизации', () => {
    api.check.mockReturnValue(new Promise(() => {}));
    render(<AdminPage />);
    expect(screen.getByText(/загрузка/i)).toBeInTheDocument();
  });

  test('показывает форму входа, если не авторизован', async () => {
    api.check.mockRejectedValue(new Error('Unauthorized'));
    render(<AdminPage />);
    expect(await screen.findByText(/панель администратора/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Логин')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Пароль')).toBeInTheDocument();
  });

  test('неверные данные показывают сообщение об ошибке', async () => {
    api.check.mockRejectedValue(new Error('Unauthorized'));
    api.login.mockRejectedValue(new Error('Неверный логин или пароль'));
    render(<AdminPage />);
    await screen.findByPlaceholderText('Логин');
    await userEvent.type(screen.getByPlaceholderText('Логин'), 'admin');
    await userEvent.type(screen.getByPlaceholderText('Пароль'), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /войти/i }));
    expect(await screen.findByText('Неверный логин или пароль')).toBeInTheDocument();
  });

  test('успешный вход показывает панель с пользователями', async () => {
    api.check.mockRejectedValue(new Error('Unauthorized'));
    api.login.mockResolvedValue({});
    api.getUsers.mockResolvedValue({ users: fakeUsers });
    render(<AdminPage />);
    await screen.findByPlaceholderText('Логин');
    await userEvent.type(screen.getByPlaceholderText('Логин'), 'admin');
    await userEvent.type(screen.getByPlaceholderText('Пароль'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /войти/i }));
    expect(await screen.findByText('alice')).toBeInTheDocument();
  });
});

describe('AdminPage — панель управления', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAuthed();
  });

  test('отображает список пользователей', async () => {
    render(<AdminPage />);
    expect(await screen.findByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
  });

  test('показывает статус «Да» для подтверждённого email и «Нет» для неподтверждённого', async () => {
    render(<AdminPage />);
    await screen.findByText('alice');
    const rows = screen.getAllByRole('row');
    const aliceRow = rows.find(r => within(r).queryByText('alice'));
    const bobRow   = rows.find(r => within(r).queryByText('bob'));
    expect(within(aliceRow!).getByText('Да')).toBeInTheDocument();
    expect(within(bobRow!).getByText('Нет')).toBeInTheDocument();
  });

  test('клик «Создать пользователя» открывает модальное окно', async () => {
    render(<AdminPage />);
    await screen.findByText('alice');
    await userEvent.click(screen.getByRole('button', { name: /создать пользователя/i }));
    expect(screen.getByRole('heading', { name: /создать пользователя/i })).toBeInTheDocument();
  });

  test('создание пользователя вызывает adminAPI.createUser с корректными данными', async () => {
    api.createUser.mockResolvedValue({});
    render(<AdminPage />);
    await screen.findByText('alice');
    await userEvent.click(screen.getByRole('button', { name: /создать пользователя/i }));

    const modal = screen.getByRole('heading', { name: /создать пользователя/i })
      .closest('.rounded-2xl')!;
    const inputs = within(modal).getAllByRole('textbox');
    await userEvent.type(inputs[0], 'newuser');       // Имя
    await userEvent.type(inputs[1], 'new@test.com');  // Email
    const pwdInput = modal.querySelector('input[type="password"]') as HTMLElement;
    await userEvent.type(pwdInput, 'secret123');

    await userEvent.click(within(modal).getByRole('button', { name: /сохранить/i }));
    await waitFor(() => expect(api.createUser).toHaveBeenCalledWith({
      username: 'newuser',
      email:    'new@test.com',
      password: 'secret123',
    }));
  });

  test('клик «Изменить» открывает модал редактирования с данными пользователя', async () => {
    render(<AdminPage />);
    await screen.findByText('alice');
    const rows = screen.getAllByRole('row');
    const aliceRow = rows.find(r => within(r).queryByText('alice'))!;
    await userEvent.click(within(aliceRow).getByRole('button', { name: /изменить/i }));
    expect(screen.getByRole('heading', { name: /редактировать пользователя/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('alice')).toBeInTheDocument();
  });

  test('удаление пользователя при подтверждении вызывает adminAPI.deleteUser', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    api.deleteUser.mockResolvedValue({});
    render(<AdminPage />);
    await screen.findByText('alice');
    const rows = screen.getAllByRole('row');
    const aliceRow = rows.find(r => within(r).queryByText('alice'))!;
    await userEvent.click(within(aliceRow).getByRole('button', { name: /удалить/i }));
    expect(api.deleteUser).toHaveBeenCalledWith('u1');
  });

  test('отмена удаления не вызывает adminAPI.deleteUser', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AdminPage />);
    await screen.findByText('alice');
    const rows = screen.getAllByRole('row');
    const aliceRow = rows.find(r => within(r).queryByText('alice'))!;
    await userEvent.click(within(aliceRow).getByRole('button', { name: /удалить/i }));
    expect(api.deleteUser).not.toHaveBeenCalled();
  });

  test('выход из системы вызывает adminAPI.logout и возвращает форму входа', async () => {
    api.logout.mockResolvedValue({});
    render(<AdminPage />);
    await screen.findByText('alice');
    await userEvent.click(screen.getByRole('button', { name: /выйти/i }));
    expect(api.logout).toHaveBeenCalled();
    expect(await screen.findByPlaceholderText('Логин')).toBeInTheDocument();
  });
});
