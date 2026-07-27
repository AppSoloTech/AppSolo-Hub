import { expect, test } from '@playwright/test';
const projectId = '10000000-0000-4000-8000-000000000003';
const draftRequestId = '30000000-0000-4000-8000-000000000002';
const clarificationRequestId = '30000000-0000-4000-8000-000000000006';
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

test('internal exact draft submission and client approval persist through the real workflow', async ({
  page,
}) => {
  await page.goto(`/projects/${projectId}/change-requests`);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByLabel('Email').fill('developer@appsolo.test');
  await page.getByRole('button', { name: 'Sign in locally' }).click();
  await expect(page.getByRole('heading', { name: 'Change requests' })).toBeVisible();
  await page.goto(`/change-requests/${draftRequestId}`);
  await expect(page.getByRole('heading', { name: 'Edit draft estimate' })).toBeVisible();
  await page.getByLabel('Estimated hours').fill('1.5');
  await page.getByLabel('Hourly rate (USD)').fill('0.01');
  await page
    .getByLabel('Scope notes')
    .fill('Implement the exact browser-tested estimate scope and verification.');
  await expect(page.getByLabel('Estimated cost (server-derived)')).toHaveText('$0.02');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Draft estimate updated.')).toBeVisible();
  await page.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(page.getByText('Estimate submitted for client approval.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Submitted' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByLabel('Email').fill('admin@client.test');
  await page.getByRole('button', { name: 'Sign in locally' }).click();
  await expect(page.getByRole('heading', { name: 'Improve account search' })).toBeVisible();
  await page.goto(`/change-requests/${draftRequestId}`);
  await expect(page.getByRole('heading', { name: 'Respond to version 1' })).toBeVisible();
  await page.getByLabel('Decision note').fill('Approved through the browser workflow.');
  await page.getByRole('button', { name: 'Approve estimate' }).click();
  await expect(page.getByText('Estimate approved.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Approved' })).toBeVisible();
  await expect(page.getByText('Approved through the browser workflow.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Approved' })).toBeVisible();
  await expect(page.getByText('Approved through the browser workflow.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve estimate' })).not.toBeVisible();
});

test('internal-safe and client-visible clarification comments persist without resolving lifecycle', async ({
  page,
}) => {
  const internalBody = `Internal browser context ${Date.now()}`;
  const sharedBody = `Client clarification reply ${Date.now()}`;

  await page.goto(`/projects/${projectId}/change-requests`);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByLabel('Email').fill('developer@appsolo.test');
  await page.getByRole('button', { name: 'Sign in locally' }).click();
  await expect(page.getByRole('heading', { name: 'Change requests' })).toBeVisible();
  await page.goto(`/change-requests/${clarificationRequestId}`);

  await expect(page.getByText('Which thresholds are included in the estimate?')).toBeVisible();
  await expect(page.getByText('Clarification is needed.')).toBeVisible();
  await expect(page.getByLabel('Who can see this?')).toHaveValue('INTERNAL_ONLY');
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill(internalBody);
  await page.getByRole('button', { name: 'Add comment' }).click();
  await expect(page.getByText('Comment added.')).toBeVisible();
  await expect(page.getByText(internalBody)).toBeVisible();
  const internalArticle = page.locator('article').filter({ hasText: internalBody });
  await expect(internalArticle.getByText('Internal only', { exact: true })).toBeVisible();
  await expect(page.getByText('NEEDS CLARIFICATION · NORMAL priority')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByLabel('Email').fill('member@client.test');
  await page.getByRole('button', { name: 'Sign in locally' }).click();
  await expect(page.getByText('Morgan Member')).toBeVisible();
  await page.goto(`/change-requests/${clarificationRequestId}`);
  await expect(page.getByLabel('Who can see this?')).not.toBeVisible();
  await expect(page.getByText(internalBody)).not.toBeVisible();
  await expect(page.getByText('Internal only', { exact: true })).not.toBeVisible();
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill(sharedBody);
  await page.getByRole('button', { name: 'Add comment' }).click();
  await expect(page.getByText('Comment added.')).toBeVisible();
  await page.reload();
  await expect(page.getByText(sharedBody)).toBeVisible();
  await expect(page.getByText('Shared with client').last()).toBeVisible();
  await expect(page.getByText('Which thresholds are included in the estimate?')).toBeVisible();
  await expect(page.getByText('NEEDS CLARIFICATION · NORMAL priority')).toBeVisible();
});
