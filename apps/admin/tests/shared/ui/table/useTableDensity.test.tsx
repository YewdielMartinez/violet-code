import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  TABLE_DENSITY_KEY,
  getTableDensity,
  setTableDensity,
  useTableDensity,
} from '@/shared/ui/table/useTableDensity';

describe('useTableDensity', () => {
  afterEach(() => {
    cleanup();
    setTableDensity('regular');
    localStorage.clear();
  });

  it('empieza cómoda, alterna a compacta y lo guarda', () => {
    const { result } = renderHook(() => useTableDensity());
    expect(result.current.density).toBe('regular');
    act(() => result.current.toggle());
    expect(result.current.density).toBe('compact');
    expect(getTableDensity()).toBe('compact');
    expect(localStorage.getItem(TABLE_DENSITY_KEY)).toBe('compact');
    act(() => result.current.toggle());
    expect(result.current.density).toBe('regular');
  });

  it('comparte la preferencia entre todas las tablas montadas', () => {
    const a = renderHook(() => useTableDensity());
    const b = renderHook(() => useTableDensity());
    act(() => a.result.current.toggle());
    expect(b.result.current.density).toBe('compact');
  });
});
