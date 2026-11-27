import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@yewdiel21/motion-kit/react';

vi.mock('@/shared/auth/session', () => ({
  refreshSession: vi.fn(() => Promise.resolve(null)),
}));

import { router } from '@/app/router';

afterEach(cleanup);

describe('rutas públicas', () => {
  it('declara /login y /aviso-de-privacidad fuera del guard de autenticación', () => {
    const publicPaths = router.routes.filter((r) => r.path).map((r) => r.path);
    expect(publicPaths).toContain('/login');
    expect(publicPaths).toContain('/aviso-de-privacidad');
  });

  it('el aviso de privacidad se muestra sin sesión, como página completa', async () => {
    const memory = createMemoryRouter(router.routes, { initialEntries: ['/aviso-de-privacidad'] });
    render(
      <ThemeProvider>
        <RouterProvider router={memory} />
      </ThemeProvider>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Aviso de privacidad' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
