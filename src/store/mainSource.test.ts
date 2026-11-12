import {expect, it} from 'vitest';
import type {ConfigSource} from '../api/model';
import {pickTarget} from './mainSource';

const source = (id: string, kind: ConfigSource['kind'], content: string, patch: Partial<ConfigSource> = {}): ConfigSource => ({
  id,
  path: `/etc/engine/${id}.dae`,
  kind,
  writable: true,
  content: content,
  content_sha256: '0'.repeat(64),
  bytes: content.length,
  line_count: content ? content.split('\n').length : 0,
  loaded_at: '2026-11-12T00:00:00Z',
  ...patch
});
const allComplete = () => true;

it('prefers the main file when it holds the section, and the include that holds it otherwise', () => {
  const main = source('main', 'main', 'global {\n  log_level: info\n}\n');
  const groups = source('groups', 'include', 'group {\n  proxy {\n    policy: select\n  }\n}\n');
  const sources = [main, groups];
  expect(pickTarget(sources, allComplete)).toBe(main);
  expect(pickTarget(sources, allComplete, 'global')).toBe(main);
  expect(pickTarget(sources, allComplete, 'group')).toBe(groups);
  // A section no writable file holds falls back to the main file.
  expect(pickTarget(sources, allComplete, 'routing')).toBe(main);
});

it('writes an engine whose entry file is read-only to its includes', () => {
  const entry = source('entry', 'main', 'include {\n  config.d/*.dae api.dae\n}\n', {writable: false});
  const global = source('global', 'include', 'global {\n  tproxy_port: 12345\n}\n');
  const routing = source('routing', 'include', 'routing {\n  fallback: direct\n}\n');
  const sources = [entry, global, routing];
  // Nothing tells which file a new declaration belongs in, so the first writable one takes it.
  expect(pickTarget(sources, allComplete)).toBe(global);
  expect(pickTarget(sources, allComplete, 'routing')).toBe(routing);
  expect(pickTarget(sources, allComplete, 'group')).toBe(global);
});

it('writes nothing when the file that holds the section cannot be written back', () => {
  const redacted = source('main', 'main', "node {\n  a: 'ss://<redacted>'\n}\n");
  const groups = source('groups', 'include', 'group {\n  proxy {\n    policy: select\n  }\n}\n');
  const complete = (item: ConfigSource) => item.id !== 'main';
  // The node section lives in the unreadable main file: no copy goes into another file.
  expect(pickTarget([redacted, groups], complete, 'node')).toBeNull();
  // No section named: a readable main file wins; an unreadable one leaves nothing to write to.
  expect(pickTarget([redacted, groups], complete)).toBeNull();
  // An engine whose entry file is read-only and readable writes its includes.
  const entry = source('entry', 'main', 'include {\n  config.d/*.dae\n}\n', {writable: false});
  expect(pickTarget([entry, groups], complete, 'group')).toBe(groups);
});

it('answers nothing while no source is writable', () => {
  const main = source('main', 'main', 'global { }', {writable: false});
  expect(pickTarget([main], allComplete)).toBeNull();
  expect(pickTarget([], allComplete, 'group')).toBeNull();
});
