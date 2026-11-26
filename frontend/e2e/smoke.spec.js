import { test, expect } from '@playwright/test';

test('landing page renders and exposes auth actions', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText(/Bienestar|Bienven|vida saludable/i);
  await expect(page.getByRole('button', { name: /Iniciar|Login/i }).first()).toBeVisible();
});

test('login form validates an empty submission', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Iniciar|Login/i }).first().click();
  await expect(page.getByTestId('login-title')).toBeVisible();
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('login-email')).toBeFocused();
});
