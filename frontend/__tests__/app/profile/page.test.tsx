// __tests__/app/profile/page.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfilePage from '@/app/profile/page';
import { authAPI } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  authAPI: {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    logout: jest.fn(),
  },
}));

// Stable reference — must not recreate object between renders, otherwise
// ProfilePage's useEffect([router]) would fire again and overwrite user state.
const mockPush = jest.fn();
const mockRouter = { push: mockPush };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/profile',
}));

const api = authAPI as jest.Mocked<typeof authAPI>;

const fakeUser = {
  id: 'uuid-123',
  username: 'testuser',
  email: 'test@example.com',
  created_at: '2024-01-01',
};

describe('ProfilePage', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  // ── загрузка ──────────────────────────────────────────────────────────────

  test('показывает «Загрузка...» пока запрос не завершён', () => {
    api.getProfile.mockReturnValue(new Promise(() => {})); // никогда не резолвится
    render(<ProfilePage />);
    expect(screen.getByText(/загрузка/i)).toBeInTheDocument();
  });

  test('отображает данные пользователя после загрузки', async () => {
    api.getProfile.mockResolvedValue({ user: fakeUser });
    render(<ProfilePage />);
    await screen.findByText('testuser');
    expect(screen.getAllByText('test@example.com').length).toBeGreaterThan(0);
  });

  test('редиректит на / если getProfile бросает ошибку', async () => {
    api.getProfile.mockRejectedValue(new Error('Unauthorized'));
    render(<ProfilePage />);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
  });

  // ── редактирование имени ──────────────────────────────────────────────────

  test('клик «Изменить» показывает поле ввода с текущим именем', async () => {
    api.getProfile.mockResolvedValue({ user: fakeUser });
    render(<ProfilePage />);
    await screen.findByText('testuser');
    await userEvent.click(screen.getByRole('button', { name: /изменить/i }));
    expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
  });

  test('«Отмена» скрывает поле ввода', async () => {
    api.getProfile.mockResolvedValue({ user: fakeUser });
    render(<ProfilePage />);
    await screen.findByText('testuser');
    await userEvent.click(screen.getByRole('button', { name: /изменить/i }));
    await userEvent.click(screen.getByRole('button', { name: /отмена/i }));
    expect(screen.queryByDisplayValue('testuser')).not.toBeInTheDocument();
    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

  test('«Сохранить» вызывает updateProfile и показывает «Имя обновлено»', async () => {
    api.getProfile.mockResolvedValue({ user: fakeUser });
    api.updateProfile.mockResolvedValue({ user: { ...fakeUser, username: 'newname' } });
    render(<ProfilePage />);
    await screen.findByText('testuser');
    await userEvent.click(screen.getByRole('button', { name: /изменить/i }));
    const input = screen.getByDisplayValue('testuser');
    await userEvent.clear(input);
    await userEvent.type(input, 'newname');
    await userEvent.click(screen.getByRole('button', { name: /сохранить/i }));
    await screen.findByText(/имя обновлено/i);
    expect(api.updateProfile).toHaveBeenCalledWith({ username: 'newname' });
    expect(screen.getByText('newname')).toBeInTheDocument();
  });

  test('updateProfile с ошибкой показывает сообщение об ошибке', async () => {
    api.getProfile.mockResolvedValue({ user: fakeUser });
    api.updateProfile.mockRejectedValue(new Error('Слишком длинное имя'));
    render(<ProfilePage />);
    await screen.findByText('testuser');
    await userEvent.click(screen.getByRole('button', { name: /изменить/i }));
    await userEvent.click(screen.getByRole('button', { name: /сохранить/i }));
    await screen.findByText(/слишком длинное имя/i);
  });

  // ── выход ─────────────────────────────────────────────────────────────────

  test('кнопка «Выйти» вызывает authAPI.logout и редиректит на /', async () => {
    api.getProfile.mockResolvedValue({ user: fakeUser });
    api.logout.mockResolvedValue({ message: 'ok' });
    render(<ProfilePage />);
    await screen.findByText('testuser');
    await userEvent.click(screen.getByRole('button', { name: /меню профиля/i }));
    await userEvent.click(screen.getByRole('button', { name: /выйти/i }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    expect(api.logout).toHaveBeenCalled();
  });
});
