import { expect, test } from '@playwright/test';
const projectId = '10000000-0000-4000-8000-000000000003';
test('seeded list, create, and refreshed detail persist through the real API', async ({ page }) => {
  const title = `Browser request ${Date.now()}`;
  await page.goto(`/projects/${projectId}/change-requests`);
  await expect(page.getByRole('heading', { name: 'Change requests' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Export dashboard data' })).toBeVisible();
  await page.getByRole('link', { name: 'New request' }).click();
  await page.getByLabel('Title').fill(title);
  await page
    .getByLabel('Description')
    .fill('A real browser smoke test creates and verifies this persisted request.');
  await page.getByRole('button', { name: 'Submit request' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
});
