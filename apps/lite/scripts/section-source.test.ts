import {expect, it} from 'vitest';
import {createMockApi} from '../../../mock';
import {canWrite} from '../src/config';
import {readSource} from '../src/api';

// `engine: 'dae'` serves dae's managed layout: a read-only entry file and every section in an include. The lite demo
// wrapper replaces the seed with its own, so this reads the shared backend's dae scenario directly.
const dae = () => createMockApi({engine: 'dae', isolated: true});

it('reads each section from the writable file that holds it', async () => {
  const api = await dae();
  expect((await readSource(api, 'global')).id).toBe('src-global');
  expect((await readSource(api, 'node')).id).toBe('src-main');
  expect((await readSource(api, 'routing')).id).toBe('src-main');
  // Nothing names a section: the entry file has no writable text, so the first writable include is the page's base.
  expect((await readSource(api)).id).toBe('src-global');
});

it('keeps the read-only entry file out of the settings pages', async () => {
  const api = await dae();
  const capabilities = await api.capabilities();
  const source = await readSource(api, 'global');
  expect(source.writable).toBe(true);
  expect(canWrite({api, capabilities, address: 'test'}, source)).toBe(true);
  // The entry file is still listed, and still read-only.
  const entry = (await api.config()).sources.find(item => item.kind === 'main')!;
  expect(entry.writable).toBe(false);
  expect(canWrite({api, capabilities, address: 'test'}, entry)).toBe(false);
});
