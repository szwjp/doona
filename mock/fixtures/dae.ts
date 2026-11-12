import type {Capabilities, ConfigDiagnostic, ConfigSource} from '../../src/api/model';
import {scanConfig} from '../../src/dae/text';
import * as honk from './configuration';
import {capabilities as honkCapabilities} from './capabilities';
import {ago} from './clock';

// dae's capabilities (component/nativeapi/handlers.go): no runtime settings and no configuration extension, geodata
// from the installation, providers refreshed but never created, and its own facts inside the config resource.
const daeConfig = {
  available: true,
  writable: true,
  create: false,
  max_bytes: 1048576,
  max_sources: 32,
  layout: 'managed',
  hidden_sources: ['api.dae'],
  store: {kind: 'file'}
};
export const daeCapabilities: Capabilities = {
  ...honkCapabilities,
  extensions: {},
  profiles: ['base'],
  resources: {
    ...honkCapabilities.resources,
    // dae omits the resource entirely; the page reads an absent one as unavailable.
    runtime_settings: {available: false},
    providers: {...honkCapabilities.resources.providers, can_manage: false},
    geodata: {available: true, can_update: false, assets: ['geoip', 'geosite']},
    config: {...daeConfig, 'x-dae': {store: daeConfig.store, layout: {kind: 'managed', reason: ''}, hidden_sources: daeConfig.hidden_sources}} as never,
    groups: {...honkCapabilities.resources.groups, max_patch_operations: 2},
    // dae keeps a ring of closed flows whether or not a client reads it, and traces routing without a live lookup.
    flows: {...honkCapabilities.resources.flows, recording: 'on', min_flows: undefined, max_flows: 2048, retention_seconds: 900, max_steps_per_flow: 1},
    routing_trace: {...honkCapabilities.resources.routing_trace, resolve_modes: ['none']}
  }
};

// The blocks of a configuration text, for moving them into dae's per-section files.
function blockText(text: string, name: string): string {
  const block = scanConfig(text).blocks.find(item => item.name === name);
  return block ? text.slice(block.from, block.to + 1) : '';
}
function withoutBlocks(text: string, names: string[]): string {
  let left = text;
  for (const name of names) {
    const block = scanConfig(left).blocks.find(item => item.name === name);
    if (!block) continue;
    const from = left.lastIndexOf('\n', block.from - 1) + 1;
    const to = left.indexOf('\n', block.to);
    left = left.slice(0, from) + (to === -1 ? '' : left.slice(to + 1));
  }
  return left.replace(/\n{3,}/g, '\n\n').trimStart();
}

// dae's managed layout (cmd/config_layout.go): config.dae holds only the include of config.d/*.dae and api.dae, and is
// the one read-only source; every section lives in an include. The seed content is honk's demo, split the same way.
// honk's template names policies dae does not have: score becomes its latency pick, min_last_delay its `min`.
const daeMain = withoutBlocks(honk.configMain, ['global', 'include'])
  .replaceAll('policy: score', 'policy: min_moving_avg')
  .replaceAll('policy: min_last_delay', 'policy: min');
export const daeEntry = `# Managed by dae: everything lives in config.d, and this file is never written.
include {
  config.d/*.dae
  api.dae
}
`;
// The same text the seeded includes hold, for the inventory fixtures to activate without the entry file.
export const daeInventoryConfig = daeMain;
export const daeSources: Array<Omit<ConfigSource, 'content_sha256' | 'bytes' | 'line_count'> & {content: string; onDisk?: string}> = [
  // api.dae is hidden from the API (x-dae.hidden_sources), so the page never lists it.
  {id: 'src-entry', path: '/etc/dae/config.dae', kind: 'main', writable: false, loaded_at: ago(3600), content: daeEntry},
  {
    id: 'src-global',
    path: '/etc/dae/config.d/global.dae',
    kind: 'include',
    writable: true,
    loaded_at: ago(3600),
    content: blockText(honk.configMain, 'global') + '\n'
  },
  {id: 'src-main', path: '/etc/dae/config.d/main.dae', kind: 'include', writable: true, loaded_at: ago(3600), content: daeMain},
  {id: 'src-rules', path: '/etc/dae/config.d/rules.dae', kind: 'include', writable: true, loaded_at: ago(3600), content: honk.configRulesFile},
  // A subscription's nodes are the provider's to write, not the page's.
  {
    id: 'src-harbor',
    path: '/var/lib/dae/subscriptions/harbor.dae',
    kind: 'subscription',
    writable: false,
    loaded_at: ago(1800),
    content: honk.configSubscription,
    onDisk: honk.configSubscription.replaceAll('<redacted>', 'demo@edge.example.net:443')
  }
];

// dae reads api.dae but hides it from the API, so it exists for include resolution and validation only.
export const daeHiddenSources: typeof daeSources = [
  {
    id: 'src-api',
    path: '/etc/dae/api.dae',
    kind: 'include',
    writable: false,
    loaded_at: ago(3600),
    content: "api {\n  enabled: true\n  listen: '127.0.0.1:9527'\n  secret: 'demo-token'\n  allow_anonymous_loopback: true\n  config_write: true\n}\n"
  }
];
export const daeConfiguration = {
  hiddenSources: daeHiddenSources,
  // dae applies the global section on reload; only the hidden `api` block needs a restart.
  restartOnly: [],
  // dae has no runtime settings resource; the configuration's own values are all it applies.
  runtimeSettings: honk.runtimeSettings,
  faultSettings: honk.faultSettings,
  configSources: daeSources,
  faultSources: daeSources,
  faultDisk: daeSources,
  configRules: honk.configRules,
  configNotes: [] as ConfigDiagnostic[]
};
