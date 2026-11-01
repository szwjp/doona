import {describe, expect, it} from 'vitest';
import {engineOf} from '.';
import {dae} from './dae';
import {capabilities} from '../../../mock/fixtures';
import type {Capabilities} from '../model';
import type {EngineSubject} from './types';

// dae's capabilities as its native API reports them: the config resource carries its own x-dae extension, the
// groups and nodes are present, and the flow recorders have no switch to turn them off.
const daeCapabilities = {
  ...capabilities,
  resources: {
    ...capabilities.resources,
    config: {available: true, writable: true, create: false, max_bytes: 1048576, max_sources: 32},
    groups: {available: true, config_patch: false, selection: true, max_patch_operations: 1},
    nodes: {available: true, can_manage: true},
    providers: {available: true, can_refresh: false, can_manage: false, max_page_size: 1000},
    flows: {available: true, recording: 'on', scopes: ['userspace_tcp', 'userspace_udp']},
    logs: {available: true, levels: ['info'], filters: ['level', 'target']},
    dns_log: {available: true, max_records: 1000, max_page_size: 100},
    operations: {available: true, retention_seconds: 3600, max_replay_keys: 1024},
    reload: {available: true},
    suspend: {available: true},
    resume: {available: true}
  }
} as unknown as Capabilities;

const version = {engine: {name: 'dae', version: 'v2.1.1'}} as Parameters<typeof engineOf>[0];

describe('engineOf', () => {
  it('knows dae by its engine name', () => {
    expect(engineOf(version).id).toBe('dae');
    expect(engineOf(version)).toBe(dae);
    expect(engineOf({engine: {name: 'other', version: '1'}}).id).toBe('unknown');
  });
});

describe('dae', () => {
  it('names the api section for the settings that turn a feature off', () => {
    const readOnly = {
      ...daeCapabilities,
      resources: {...daeCapabilities.resources, config: {available: true, writable: false, create: false}}
    } as unknown as Capabilities;
    expect(dae.reason('config', readOnly)).toEqual({code: 'writes-off', settings: [{key: 'api.config_write', value: 'true'}]});
    expect(dae.reason('config', daeCapabilities)).toBeUndefined();
  });

  it('routes every configuration write through the config resource', () => {
    const readOnly = {
      ...daeCapabilities,
      resources: {...daeCapabilities.resources, config: {available: true, writable: false, create: false}}
    } as unknown as Capabilities;
    for (const subject of ['create', 'global_settings', 'mode', 'rule_edit', 'group_edit', 'restore', 'config_validate', 'reload'] as EngineSubject[])
      expect(dae.reason(subject, readOnly)).toEqual({code: 'writes-off', settings: [{key: 'api.config_write', value: 'true'}]});
  });

  it('offers the source editor and nothing else', () => {
    for (const subject of ['export', 'import', 'revisions', 'geodata_settings', 'trace_live'] as EngineSubject[])
      expect(dae.reason(subject, daeCapabilities)).toEqual({code: 'no-switch'});
  });

  it('records flows, logs and the DNS log without a switch to turn them off', () => {
    for (const subject of ['flows', 'logs', 'dns_log'] as EngineSubject[]) expect(dae.reason(subject, daeCapabilities)).toBeUndefined();
  });

  it('offers the features dae always has', () => {
    for (const subject of ['validate_full', 'selection', 'dns_cache_read', 'dns_cache_delete', 'dns_cache_flush'] as EngineSubject[])
      expect(dae.reason(subject, daeCapabilities)).toBeUndefined();
  });

  it('suspends and resumes through the operations resource', () => {
    expect(dae.reason('suspend', daeCapabilities)).toBeUndefined();
    expect(dae.reason('resume', daeCapabilities)).toBeUndefined();
    const withoutOperations = {
      ...daeCapabilities,
      resources: {...daeCapabilities.resources, operations: {available: false}}
    } as unknown as Capabilities;
    expect(dae.reason('suspend', withoutOperations)).toEqual({code: 'build-lacks'});
  });

  it('refuses a source that holds the listener secret', () => {
    expect(dae.holdsCredentials({content: "api {\n  secret: 'abc'\n}"} as never)).toBe(true);
    expect(dae.holdsCredentials({content: 'api {\n  enabled: true\n}'} as never)).toBe(false);
    expect(dae.holdsCredentials({content: 'global {\n  log_level: info\n}'} as never)).toBe(false);
  });

  it('redacts the api section and offers dae configuration text', () => {
    const blocks = [{name: 'api', children: [], text: "api {\n  secret: 'abc'\n}"}] as never;
    expect(dae.redactedSections(blocks)).toEqual([{block: blocks[0], name: 'api'}]);
    expect(dae.daeText).toBe(true);
  });

  it('writes dotted settings as nested sections', () => {
    expect(
      dae.snippet([
        {key: 'api.enabled', value: 'true'},
        {key: 'api.listen', value: "'127.0.0.1:9527'"}
      ])
    ).toBe("api {\n  enabled: true\n  listen: '127.0.0.1:9527'\n}");
  });

  it("names dae's restart command and the settings a restart needs", () => {
    expect(dae.restartCommand).toBe('systemctl restart dae');
    expect(dae.restartOnly).toContain('tproxy_port');
    expect(dae.globalSettings?.name).toBe('global');
  });
});
