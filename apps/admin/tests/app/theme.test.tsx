import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@yewdiel21/motion-kit/react';
import { getTheme, initTheme, setMode, setTheme, themeHeadScript } from '@yewdiel21/motion-kit/theme';
import { registerCustomThemes, SALMVERSE_THEME, THEME_STORAGE_KEY } from '@/app/theme';
import { AppearanceMenu } from '@/features/settings/AppearanceMenu';

describe('Salmverse custom theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-mk-theme');
    document.documentElement.removeAttribute('data-mk-mode');
    initTheme({ default: 'purple', mode: 'system', storageKey: THEME_STORAGE_KEY });
  });

  afterEach(() => {
    cleanup();
  });

  it('registers salmverse in motion-kit and persists selection in vc-theme without warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      registerCustomThemes();
      const state = setTheme(SALMVERSE_THEME.id);

      expect(state.id).toBe('salmverse');
      expect(getTheme().id).toBe('salmverse');
      expect(document.documentElement.getAttribute('data-mk-theme')).toBe('salmverse');
      expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) ?? '{}')).toEqual({
        id: 'salmverse',
        mode: 'system',
      });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('restores salmverse and dark mode before first paint via themeHeadScript', () => {
    registerCustomThemes();
    setTheme('salmverse');
    setMode('dark');

    document.documentElement.removeAttribute('data-mk-theme');
    document.documentElement.removeAttribute('data-mk-mode');

    const script = themeHeadScript({ default: 'purple', mode: 'system', storageKey: THEME_STORAGE_KEY });
    new Function(script)();

    expect(document.documentElement.getAttribute('data-mk-theme')).toBe('salmverse');
    expect(document.documentElement.getAttribute('data-mk-mode')).toBe('dark');
  });

  it('allows selecting Salmverse from AppearanceMenu and syncs aria-pressed with built-in swatches', () => {
    registerCustomThemes();
    render(
      <ThemeProvider defaultTheme="purple" mode="system" storageKey={THEME_STORAGE_KEY}>
        <AppearanceMenu open onOpenChange={() => {}} />
      </ThemeProvider>,
    );

    const salmverseButton = screen.getByRole('button', { name: SALMVERSE_THEME.label });
    const purpleButton = screen.getByRole('button', { name: 'Purple' });

    expect(purpleButton.getAttribute('aria-pressed')).toBe('true');
    expect(salmverseButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(salmverseButton);

    expect(document.documentElement.getAttribute('data-mk-theme')).toBe('salmverse');
    expect(salmverseButton.getAttribute('aria-pressed')).toBe('true');
    expect(purpleButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(purpleButton);

    expect(document.documentElement.getAttribute('data-mk-theme')).toBe('purple');
    expect(salmverseButton.getAttribute('aria-pressed')).toBe('false');
    expect(purpleButton.getAttribute('aria-pressed')).toBe('true');
  });
});
