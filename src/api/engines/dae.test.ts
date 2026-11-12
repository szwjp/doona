import {describe, expect, it} from 'vitest';
import {capabilities} from '../../../mock/fixtures';
import type {Capabilities} from '../model';
import {engineOf, type EngineSubject} from '.';
import {daeGlobal} from './daeSettings';
import {scanConfig} from '../../dae/text';

type Resources = Capabilities['resources'];
const patched = (patch: {[K in keyof Resources]?: Partial<Resources[K]>}): Capabilities => ({
  ...capabilities,
  resources: Object.fromEntries(
    Object.entries(capabilities.resources).map(([id, resource]) => [id, {...resource, ...patch[id as keyof Resources]}])
  ) as Resources
});
const dae = engineOf({engine: {name: 'dae', version: 'v0.9.0'}});

describe('dae', () => {
  it('is the adapter for the engine name dae reports', () => {
    expect(dae.id).toBe('dae');
    expect(dae.daeText).toBe(true);
    expect(dae.restartCommand).toBe('systemctl restart dae');
    // dae configures its API from a hidden file and applies the rest by reload; only the map's cap waits for a restart.
    expect(dae.restartOnly).toEqual(['bpf_conn_state_map_size']);
    // dae records a fixed ring of closed flows, so there is no on-demand grace period to wait out.
    expect(dae.flowDemandGraceSeconds).toBeNull();
  });

  it('accepts the share-link schemes dae parses and not honk-only ones', () => {
    // dae docs/en/configuration/api.md lists vless, vmess, trojan, ss, ssr, socks, http, hysteria2, tuic, juicity,
    // anytls and naive.
    for (const scheme of ['http', 'socks', 'socks5', 'ss', 'ssr', 'trojan', 'vmess', 'vless', 'hysteria2', 'tuic', 'juicity', 'anytls', 'naive'])
      expect(dae.nodeLinkSchemes).toContain(scheme);
    expect(dae.nodeLinkSchemes).not.toContain('garbage');
    // honk's legacy hysteria v1 scheme is not in dae's list.
    expect(dae.nodeLinkSchemes).not.toContain('hysteria');
  });

  it('offers the global fields dae parses and leaves honk-only ones out', () => {
    expect(daeGlobal.name).toBe('global');
    const keys = daeGlobal.fields.map(field => field.key);
    for (const key of ['tproxy_port', 'so_mark_from_dae', 'disable_thp', 'auto_sniff_punt', 'udphop_interval', 'bpf_conn_state_map_size'])
      expect(keys).toContain(key);
    for (const key of [
      'data_dir',
      'store_subscribe',
      'udp_warm_node_count',
      'preconnect_node_count',
      'nfqueue_enable',
      'max_concurrent_dials',
      'log_file',
      'enable_local_tcp_fast_redirect'
    ])
      expect(keys).not.toContain(key);
    // A key the schema lists twice would write two fields.
    expect(new Set(keys).size).toBe(keys.length);
    // dae config/desc.go names error, warn, info, debug and trace; `off` is honk's.
    expect(daeGlobal.fields.find(field => field.key === 'log_level')?.choices).not.toContain('off');
    expect(dae.globalSettings).toBe(daeGlobal);
  });

  it('puts every configuration write behind api.config_write', () => {
    const readOnly = patched({config: {writable: false}});
    const writesOff = {code: 'writes-off', settings: [{key: 'api.config_write', value: 'true'}]};
    expect(dae.reason('config', readOnly)).toEqual(writesOff);
    for (const subject of ['create', 'global_settings', 'mode', 'rule_edit', 'group_edit', 'restore'] satisfies EngineSubject[])
      expect(dae.reason(subject, readOnly)).toEqual(writesOff);
    for (const subject of ['create', 'global_settings', 'mode', 'rule_edit', 'group_edit', 'restore'] satisfies EngineSubject[])
      expect(dae.reason(subject, capabilities)).toBeUndefined();
    expect(dae.reason('config', patched({config: {available: false}}))).toEqual({code: 'config-unloaded'});
  });

  it('explains node edits, services and what dae never switches on', () => {
    // dae writes inline nodes to config.d/node.dae and never to the entry file.
    expect(dae.reason('manage', capabilities)).toEqual({code: 'main-file-read-only'});
    for (const subject of ['probes', 'subscriptions'] satisfies EngineSubject[])
      expect(dae.reason(subject, capabilities)).toEqual({code: 'starting-or-stopping'});
    // Reload, suspend, resume and validation follow the running generation.
    for (const subject of ['config_validate', 'reload', 'suspend', 'resume'] satisfies EngineSubject[]) {
      expect(dae.reason(subject, capabilities)).toEqual({code: 'starting-or-stopping'});
      expect(dae.reason(subject, patched({config: {available: false}}))).toEqual({code: 'config-unloaded'});
    }
    // Geodata comes from the installation and a trace never resolves a domain live: no setting turns either on.
    expect(dae.reason('geodata_settings', capabilities)).toEqual({code: 'no-switch'});
    expect(dae.reason('trace_live', capabilities)).toEqual({code: 'no-switch'});
    // dae has no export, import or revision routes.
    for (const subject of ['export', 'import', 'revisions'] satisfies EngineSubject[]) expect(dae.reason(subject, capabilities)).toEqual({code: 'no-switch'});
    // dae always offers these.
    for (const subject of ['validate_full', 'selection', 'close', 'dns_cache_read', 'dns_cache_delete', 'dns_cache_flush'] satisfies EngineSubject[])
      expect(dae.reason(subject, capabilities)).toBeUndefined();
    expect(dae.reason('flows', capabilities)).toBeUndefined();
    expect(dae.reason('flows', patched({flows: {available: false}}))).toEqual({code: 'build-lacks'});
  });

  it('has no credentials to protect: dae hides its API source instead of redacting a returned one', () => {
    expect(dae.holdsCredentials({content: "api {\n  secret: '<redacted>'\n}"})).toBe(false);
    expect(dae.redactedSections(scanConfig("api {\n  secret: '<redacted>'\n}").blocks)).toEqual([]);
  });

  it('nests each setting in its section', () => {
    expect(dae.snippet([{key: 'api.config_write', value: 'true'}])).toBe('api {\n  config_write: true\n}');
  });
});
