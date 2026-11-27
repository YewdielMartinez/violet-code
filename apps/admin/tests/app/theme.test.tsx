import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@yewdiel21/motion-kit/react';
import { getTheme, initTheme, setMode, setTheme, themeHeadScript } from '@yewdiel21/motion-kit/theme';
import { RETIRED_THEMES, retiredThemeHeadScript, sanitizeStoredTheme } from '@/app/retiredThemes';
import { THEME_CHOICES } from '@/app/preferences';
import { registerCustomThemes, SALMVERSE_THEME, THEME_STORAGE_KEY } from '@/app/theme';
import { AppearanceMenu } from '@/features/settings/AppearanceMenu';

describe('Salmverse custom theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-mk-theme');
    document.documentElement.removeAttribute('data-mk-mode');
    initTheme({ default: 'blue', mode: 'system', storageKey: THEME_STORAGE_KEY });
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

    const script = themeHeadScript({ default: 'blue', mode: 'system', storageKey: THEME_STORAGE_KEY });
    new Function(script)();

    expect(document.documentElement.getAttribute('data-mk-theme')).toBe('salmverse');
    expect(document.documentElement.getAttribute('data-mk-mode')).toBe('dark');
  });

  it('allows selecting Salmverse from AppearanceMenu and syncs aria-pressed with built-in swatches', () => {
    registerCustomThemes();
    render(
      <ThemeProvider defaultTheme="blue" mode="system" storageKey={THEME_STORAGE_KEY}>
        <AppearanceMenu open onOpenChange={() => {}} />
      </ThemeProvider>,
    );

    const salmverseButton = screen.getByRole('button', { name: SALMVERSE_THEME.label });
    const blueButton = screen.getByRole('button', { name: 'Blue' });

    expect(blueButton.getAttribute('aria-pressed')).toBe('true');
    expect(salmverseButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(salmverseButton);

    expect(document.documentElement.getAttribute('data-mk-theme')).toBe('salmverse');
    expect(salmverseButton.getAttribute('aria-pressed')).toBe('true');
    expect(blueButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(blueButton);

    expect(document.documentElement.getAttribute('data-mk-theme')).toBe('blue');
    expect(salmverseButton.getAttribute('aria-pressed')).toBe('false');
    expect(blueButton.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Temas retirados (purple, neogreen)', () => {
  beforeEach(() => localStorage.clear());

  it('migra purple/neogreen guardados a salmverse conservando el modo', () => {
    for (const id of RETIRED_THEMES) {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ id, mode: 'dark' }));
      expect(sanitizeStoredTheme(THEME_STORAGE_KEY)).toBe(true);
      expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) ?? '{}')).toEqual({ id: 'salmverse', mode: 'dark' });
    }
  });

  it('no toca temas vigentes ni valores inválidos', () => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ id: 'blue', mode: 'light' }));
    expect(sanitizeStoredTheme(THEME_STORAGE_KEY)).toBe(false);
    localStorage.setItem(THEME_STORAGE_KEY, '{no-json');
    expect(sanitizeStoredTheme(THEME_STORAGE_KEY)).toBe(false);
    expect(THEME_CHOICES).not.toContain('purple');
    expect(THEME_CHOICES).not.toContain('neogreen');
  });

  it('el script de <head> aplica la migración antes de themeHeadScript', () => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ id: 'purple', mode: 'dark' }));
    new Function(retiredThemeHeadScript(THEME_STORAGE_KEY))();
    new Function(themeHeadScript({ default: 'salmverse', mode: 'system', storageKey: THEME_STORAGE_KEY }))();
    expect(document.documentElement.getAttribute('data-mk-theme')).toBe('salmverse');
    expect(document.documentElement.getAttribute('data-mk-mode')).toBe('dark');
  });
});
