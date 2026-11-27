import { ageFromBirthDate } from '../age';

test.each([
  ['1985-06-15', new Date(2026, 5, 14), 40],
  ['1985-06-15', new Date(2026, 5, 15), 41],
  ['2000-02-29', new Date(2025, 1, 28), 24],
  ['2000-02-29', new Date(2025, 2, 1), 25],
  ['2001-02-29', new Date(2026, 5, 15), null],
  ['2026-06-16', new Date(2026, 5, 15), null],
])('calculates age from %s on %s', (birth, today, expected) => {
  expect(ageFromBirthDate(birth, today)).toBe(expected);
});
