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

test('development sign-in, invite copy, acceptance, and capability hiding use the real stack', async ({
  page,
  browser,
}) => {
  await page.goto(`/projects/${projectId}/change-requests`);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Development sign in' })).toBeVisible();
  await page.getByLabel('Email').fill('  ADMIN@CLIENT.TEST ');
  await page.getByRole('button', { name: 'Sign in locally' }).click();
  await expect(page.getByRole('heading', { name: 'Change requests' })).toBeVisible();
  await page.getByRole('link', { name: 'Access · Northstar Demo Co.' }).click();
  await expect(page.getByRole('heading', { name: 'Access management' })).toBeVisible();

  const inviteEmail = `browser-invite-${Date.now()}@client.test`;
  await page.getByLabel('First name').fill('Browser');
  await page.getByLabel('Last name').fill('Invitee');
  await page.getByLabel('Email').fill(inviteEmail);
  await page.getByRole('button', { name: 'Create invitation' }).click();
  const acceptanceUrl = await page.getByLabel('Local acceptance link').inputValue();
  expect(acceptanceUrl).toContain('#token=');

  const inviteeContext = await browser.newContext();
  try {
    const inviteePage = await inviteeContext.newPage();
    const localAcceptanceUrl = new URL(acceptanceUrl);
    localAcceptanceUrl.hostname = '127.0.0.1';
    await inviteePage.goto(localAcceptanceUrl.toString());
    await expect(inviteePage).toHaveURL(/\/invitations\/accept$/);
    await expect(inviteePage.getByRole('heading', { name: 'Invitation accepted' })).toBeVisible();
    await inviteePage.getByRole('link', { name: 'Continue to Client Hub' }).click();
    await expect(inviteePage.getByRole('heading', { name: 'Change requests' })).toBeVisible();
    await expect(inviteePage.getByText(inviteEmail)).toBeVisible();
    await expect(inviteePage.getByRole('link', { name: /Access · Northstar Demo Co\./ })).not.toBeVisible();
    expect(
      await inviteePage.evaluate(() => window.localStorage.getItem('appsolo.developmentUserId')),
    ).toBeTruthy();
    expect(await inviteePage.evaluate(() => JSON.stringify(window.localStorage))).not.toContain('token=');
  } finally {
    await inviteeContext.close();
  }
});
