import {daeGlobal, daeRestartOnly} from './daeSettings';
import {snippet} from './snippet';
import type {Capabilities} from '../model';
import type {Engine, EngineReason, EngineSubject} from './types';

// dae reads its API settings from `api { }` at startup; a reload that changes them is rejected, and the file holding
// them is hidden from the API (cmd/config_editor.go hiddenConfigSourceName).
const api = (key: string) => `api.${key}`;
const lacks: EngineReason = {code: 'build-lacks'};
const writeSwitch = {key: api('config_write'), value: 'true'};
// dae reports its own facts inside the config resource: the layout it needs for writes, the sources it hides and the
// store it keeps them in (component/nativeapi/handlers.go).
type DaeConfig = {layout?: {kind?: string; reason?: string}; hidden_sources?: string[]; store?: {kind?: string}};
const extension = (capabilities: Capabilities): DaeConfig | undefined =>
  (capabilities.resources.config as unknown as Record<string, unknown>)['x-dae'] as DaeConfig | undefined;
// dae config.rs running: the loaded sources and the engine's command channel.
const unlessRunning = (resources: Capabilities['resources']): EngineReason => ({code: resources.config.available ? 'starting-or-stopping' : 'config-unloaded'});

function reason(subject: EngineSubject, capabilities: Capabilities): EngineReason | undefined {
  const resources = capabilities.resources;
  // A resource an older build leaves out is off because that build does not have it, which is all dae can say.
  if (capabilities.unreported?.includes(subject as keyof Capabilities['resources'])) return lacks;
  switch (subject) {
    // dae cmd/config_editor.go: sources load with the running generation, and writes need api.config_write and the
    // managed layout (config.dae includes config.d/*.dae and api.dae).
    case 'config': {
      if (!resources.config.available) return {code: 'config-unloaded'};
      if (resources.config.writable !== false) return undefined;
      // The API switch takes precedence in dae's own reason: the layout is only reported when writes are on.
      return extension(capabilities)?.layout?.reason === 'layout_unmanaged'
        ? {code: 'layout-unmanaged'}
        : {code: 'writes-off', settings: [writeSwitch]};
    }
    // Creating sources, the forms, the rule and group editors and activating a revision all write the configuration
    // (config_editor.go: create is false, config_patch follows the same switch).
    case 'create':
    case 'global_settings':
    case 'mode':
    case 'rule_edit':
    case 'group_edit':
    case 'restore':
      return reason('config', capabilities);
    // dae cmd/config_nodes.go writes inline nodes to config.d/node.dae and never to the entry file, which is read-only
    // on purpose (`entry_source`); a node edit can still be refused with a name or link conflict.
    case 'manage':
      return {code: 'main-file-read-only'};
    // Probes and subscription refreshes run against the running generation.
    case 'probes':
    case 'subscriptions':
      return {code: 'starting-or-stopping'};
    // dae control: assets come from the installation and are never downloaded through the API, so there is no download
    // URL or schedule for the page to set (geodata.can_update is false).
    case 'geodata':
      return undefined;
    case 'geodata_settings':
      return {code: 'no-switch'};
    // dae implements its flows as a bounded ring that records whether or not a client reads it: there is no on-demand
    // recording to wait out, so the page shows no grace period.
    case 'flows':
      return resources.flows.available ? undefined : lacks;
    // Validation, reload, suspend and resume all follow the running generation (operations adapter).
    case 'config_validate':
    case 'reload':
    case 'suspend':
    case 'resume':
      return unlessRunning(resources);
    // dae resolves routing traces without a live DNS lookup (resolve_modes is `none` only); no setting turns the live
    // mode on.
    case 'trace_live':
      return {code: 'no-switch'};
    // dae has no configuration extension: export, import and revisions are not routes at all.
    case 'export':
    case 'import':
    case 'revisions':
      return {code: 'no-switch'};
    // dae always offers these.
    case 'validate_full':
    case 'selection':
    case 'close':
    case 'dns_cache_read':
    case 'dns_cache_delete':
    case 'dns_cache_flush':
      return undefined;
    default:
      return lacks;
  }
}

export const dae: Engine = {
  id: 'dae',
  dialect: 'dae',
  // dae docs/en/configuration/api.md: share links parse for these schemes; anything else answers 422.
  nodeLinkSchemes: ['http', 'socks', 'socks4', 'socks4a', 'socks5', 'ss', 'ssr', 'trojan', 'vmess', 'vless', 'hysteria2', 'tuic', 'juicity', 'anytls', 'naive'],
  flowDemandGraceSeconds: null,
  globalSettings: daeGlobal,
  restartOnly: daeRestartOnly,
  // The unit the dae install guide creates (docs/en/user-guide/run-as-daemon.md).
  restartCommand: 'systemctl restart dae',
  reason,
  // dae control/datapath_snapshot.go counts TC attachments only; the cgroup, sk_lookup and dae0peer attaches are not
  // read back, so their state stays unverified.
  uncheckedHooks: ['cgroup', 'sk_lookup', 'dae0peer'],
  // dae hides `api.dae` from the API instead of redacting a returned source, so no source needs the page's care.
  holdsCredentials: () => false,
  snippet,
  redactedSections: () => [],
  daeText: true
};
