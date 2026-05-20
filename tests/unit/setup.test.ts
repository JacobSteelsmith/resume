import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('testing framework setup', () => {
  it('vitest runs correctly', () => {
    expect(true).toBe(true);
  });

  it('fast-check is available', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return typeof n === 'number';
      }),
    );
  });
});
