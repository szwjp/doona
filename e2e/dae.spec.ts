import {expect, test} from './fixtures';

// The demo backend's dae scenario: dae's capabilities, its managed layout and its own configuration vocabulary.
test.use({storage: {'doona-mock-engine': 'dae'}});

test('names dae as the engine and lists only the files dae exposes', async ({page}) => {
  await page.goto('/#/config?tab=source');
  await expect(page.getByText('dae v0.0.0-dae-demo').first()).toBeVisible();
  // dae hides api.dae, and the entry file is the one read-only source.
  // The first option is the picker's empty label; the rest are the files dae exposes.
  await expect
    .poll(async () => (await page.locator('select:visible option').allTextContents()).slice(1))
    .toEqual([
      '/etc/dae/config.dae',
      '/etc/dae/config.d/global.dae',
      '/etc/dae/config.d/main.dae',
      '/etc/dae/config.d/rules.dae',
      '/var/lib/dae/subscriptions/harbor.dae'
    ]);
  await expect(page.getByText('The backend does not accept writes to this file, so it can only be viewed.')).toBeVisible();
});

test('opens the global form on an include and offers dae own settings', async ({page}) => {
  await page.goto('/#/config?tab=global');
  // The entry file has no global section, so the form opens on the include that does.
  await expect(page.locator('select:visible').first()).toHaveValue('src-global:0');
  await expect(page.getByText('Disable transparent huge pages')).toBeVisible();
  await expect(page.getByText('TLS fragmentation')).toHaveCount(1);
  // dae has no runtime settings, so the tab that edits them is not offered.
  await expect(page.getByRole('tab', {name: /Runtime/i})).toHaveCount(0);
});

test('offers dae policies and writes a new group to the file that holds the section', async ({page}) => {
  await page.goto('/#/policies');
  await page
    .getByRole('button', {name: /New group/i})
    .first()
    .click();
  const dialog = page.locator('[role=dialog]');
  // dae's policies, not honk's score, roundrobin or fallback.
  await dialog.getByRole('button', {name: /Selection policy/}).click();
  for (const policy of ['Fixed', 'Random', 'Manual']) await expect(page.getByRole('option', {name: new RegExp(policy, 'i')}).first()).toBeVisible();
  await expect(page.getByRole('option', {name: /^Score/})).toHaveCount(0);
  await page.keyboard.press('Escape');
  await dialog.getByLabel(/Group name/i).fill('dae-test');
  await dialog.getByRole('button', {name: /^Create/}).click();
  await expect(page.getByText('Configuration for dae-test written and reloaded')).toBeVisible();
  // The declaration lands in main.dae, the include that holds the group section, not in the read-only entry file.
  await page.goto('/#/config');
  const modules = page.locator('.rp-content');
  await expect(modules.getByText('main.dae:34-', {exact: false})).toBeVisible();
  await expect(modules.getByText('18 groups')).toBeVisible();
});

test('writes the outbound mode into the file that holds routing', async ({page}) => {
  await page.goto('/#/activity');
  await page.getByRole('radiogroup', {name: 'Outbound mode'}).getByRole('radio', {name: 'Direct', exact: true}).click();
  await page.locator('[data-instance="mode"]').getByRole('button', {name: 'Apply', exact: true}).click();
  await page.getByRole('alertdialog', {name: 'Apply Direct mode?'}).getByRole('button', {name: 'Apply', exact: true}).click();
  await expect(page.locator('.rp-toast.positive', {hasText: 'reloaded: Direct'})).toBeVisible();
  // The marker went into the include that holds routing; the card reads it back from there.
  await expect(page.getByRole('radiogroup', {name: 'Outbound mode'}).getByRole('radio', {name: 'Direct', exact: true})).toHaveAttribute('aria-checked', 'true');
});
