import {afterEach, expect, it, vi} from 'vitest';
import {createMockApi} from './index';
import {ApiError} from '../src/api/error';

const dae = () => createMockApi({engine: 'dae'});

it('reports dae and serves its managed layout', async () => {
  const api = dae();
  const version = await api.version();
  expect(version.engine).toMatchObject({name: 'dae'});
  const capabilities = await api.capabilities();
  expect(capabilities.resources.runtime_settings.available).toBe(false);
  expect(capabilities.resources.providers.can_manage).toBe(false);
  expect(capabilities.extensions ?? {}).toEqual({});
  expect(capabilities.resources.config).toMatchObject({writable: true, create: false});
  const config = await api.config();
  const sources = config.sources;
  const entry = sources.find(source => source.kind === 'main')!;
  // dae's entry file is read-only and holds only the include block.
  expect(entry).toMatchObject({writable: false});
  expect(entry.content).toContain('config.d/*.dae');
  expect(entry.content).toContain('api.dae');
  // No source is api.dae: dae hides it from the API.
  expect(sources.some(source => source.path.endsWith('/api.dae'))).toBe(false);
  for (const section of ['global', 'node', 'group', 'dns', 'routing']) expect(sources.some(source => source.content.includes(`${section} {`))).toBe(true);
});

afterEach(() => vi.useRealTimers());

it('writes only the includes, and never the entry file', async () => {
  vi.useFakeTimers();
  const api = dae();
  const config = await api.config();
  const entry = config.sources.find(source => source.kind === 'main')!;
  await expect(api.replaceConfigSource(entry.id, entry.content, `"${entry.content_sha256}"`)).rejects.toMatchObject({
    status: 403,
    code: 'permission_denied'
  });
  const global = config.sources.find(source => source.id === 'src-global')!;
  const accepted = await api.replaceConfigSource(global.id, global.content.replace('12345', '23456'), `"${global.content_sha256}"`);
  await vi.advanceTimersByTimeAsync(1000);
  expect((await api.operation(accepted.operation_id)).status).toBe('succeeded');
  const written = (await api.config()).sources.find(source => source.id === 'src-global')!;
  expect(written.content).toContain('23456');
});

it('serves the sections the page reads from the includes', async () => {
  const api = dae();
  const rules = await api.rules();
  expect(rules.rules.length).toBeGreaterThan(0);
  const groups = await api.groups();
  expect(groups.length).toBeGreaterThan(0);
  const nodes = await api.nodes();
  expect(nodes.nodes.length).toBeGreaterThan(0);
  const ref = (await api.runtime()).generation.config_revision;
  expect(ref).toBeTruthy();
});

it('does not claim a configuration extension or runtime settings', async () => {
  const api = dae();
  await expect(api.runtimeSettings()).rejects.toMatchObject({status: 404, code: 'capability_not_supported'});
  // dae has no configuration extension, so the mock serves no export route to ask.
  const error = await api
    .exportConfig({
      management: () => ({
        export: false,
        import: false,
        revisions: false,
        replaceRequired: false,
        canActivate: false,
        off: {export: true, import: true, revisions: true}
      }),
      store: () => undefined,
      paths: {
        export: '/api/v1/x-dae/config/export',
        import: '/api/v1/x-dae/config/import',
        revisions: '/api/v1/x-dae/config/revisions',
        activate: '/api/v1/x-dae/config/revisions/{revision}/activate'
      },
      exportFilename: () => 'config.dae'
    })
    .then(
      () => null,
      (failure: unknown) => failure as ApiError
    );
  expect(error?.status).toBe(404);
});
