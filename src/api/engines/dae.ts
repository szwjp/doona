import {daeGlobal, daeRestartOnly} from './daeSettings';
import {blockFields, scanConfig} from '../../dae/text';
import type {Key} from '../../i18n';
import type {Capabilities} from '../model';
import type {Engine, EngineReason, EngineSetting, EngineSubject} from './types';

// dae reads its API settings from the top-level `api { }` section, not from honk's `experimental.native_api`,
// and every field of it is restart-required (cmd/run_reload_worker.go refuses a reload that changes the section).
const api = (key: string) => `api.${key}`;
const lacks: EngineReason = {code: 'build-lacks'};

// dae refuses a write whose source text holds the listener secret, so a source that keeps one is not writable
// back (cmd/config_editor.go masks the secret and reports the content as incomplete). In dae the secret is a field
// of the top-level `api { }` block, where honk keeps it inside `experimental.native_api`.
function holdsApiSecret(text: string): boolean {
  const {blocks, tokens} = scanConfig(text);
  return blocks.some(block => block.name === 'api' && blockFields(text, block, tokens).some(field => field.name === 'secret'));
}

// The contract's read_only_reason names only the causes it defines, so dae reports the two it knows
// on its own -- the entry file and an unmanaged layout -- in the source's `x-dae` member
// (cmd/config_editor.go readOnlyReasons).
function readOnlyReason(source: Record<string, unknown>): {code: string; label: Key; note: Key} | undefined {
  const extension = source['x-dae'] as {read_only_reason?: unknown} | undefined;
  const reason = extension?.read_only_reason;
  if (reason === 'entry_source') return {code: 'entrySource', label: 'config.entrySource', note: 'config.entrySourceNote'};
  if (reason === 'layout_unmanaged') return {code: 'unmanaged', label: 'config.unmanaged', note: 'config.unmanagedNote'};
  return undefined;
}

// Writes dotted setting names as nested sections; consecutive settings in one section share it.
function nest(settings: Array<{path: string[]; value: string}>, indent: string): string[] {
  const lines: string[] = [];
  for (let i = 0; i < settings.length;) {
    const [head, ...rest] = settings[i].path;
    if (!rest.length) {
      lines.push(`${indent}${head}: ${settings[i++].value}`);
      continue;
    }
    const inner: typeof settings = [];
    for (; i < settings.length && settings[i].path.length > 1 && settings[i].path[0] === head; i++)
      inner.push({...settings[i], path: settings[i].path.slice(1)});
    lines.push(`${indent}${head} {`, ...nest(inner, `${indent}  `), `${indent}}`);
  }
  return lines;
}

function reason(subject: EngineSubject, capabilities: Capabilities): EngineReason | undefined {
  const resources = capabilities.resources;
  // A resource an older build leaves out is off because that build does not have it.
  if (capabilities.unreported?.includes(subject as keyof Capabilities['resources'])) return lacks;
  switch (subject) {
    // dae reads the configuration from disk and reloads from it. The editor is available when the config resource
    // is; writing needs api.config_write, which the API refuses to turn on without a secret.
    case 'config':
      if (!resources.config.available) return {code: 'config-unloaded'};
      return resources.config.writable === false ? {code: 'writes-off', settings: [{key: api('config_write'), value: 'true'}]} : undefined;
    // dae edits inline nodes in the managed source; a source layout that dae does not manage refuses them.
    case 'manage':
      return resources.nodes.available ? undefined : lacks;
    // Probes and subscription refreshes run only while dae is up.
    case 'probes':
    case 'subscriptions':
      return {code: 'starting-or-stopping'};
    // dae's geodata settings live in the configuration file; the API reports the assets it loaded but cannot
    // update them.
    case 'geodata':
      return resources.geodata.available ? undefined : {code: 'geodata-mismatch'};
    // dae records flows, logs and the DNS log unconditionally.
    case 'flows':
    case 'logs':
    case 'dns_log':
      return resources[subject].available ? undefined : lacks;
    // Creating sources, the forms, the rule and group editors and activating a revision all write the configuration.
    case 'create':
    case 'global_settings':
    case 'mode':
    case 'rule_edit':
    case 'group_edit':
    case 'restore':
    case 'config_validate':
    case 'reload':
      return reason('config', capabilities);
    // dae has no export, import or revision list: the configuration lives in files the operator owns.
    case 'export':
    case 'import':
    case 'revisions':
      return {code: 'no-switch'};
    // dae's geodata download URLs are in the configuration file, not in a state database.
    case 'geodata_settings':
      return {code: 'no-switch'};
    // dae suspends and resumes the datapath through SIGUSR1/SIGUSR2, so both are on.
    case 'suspend':
    case 'resume':
      return resources.operations?.available === false ? lacks : undefined;
    // dae has no live routing trace.
    case 'trace_live':
      return {code: 'no-switch'};
    // dae always offers these, so it has no reason to give.
    case 'validate_full':
    case 'selection':
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
  // dae docs/en/proxy-protocols.md: the URI schemes dae accepts.
  nodeLinkSchemes: ['http', 'https', 'socks4', 'socks4a', 'socks5', 'ss', 'ssr', 'vmess', 'vless', 'trojan', 'tuic', 'juicity', 'hysteria2', 'anytls'],
  // dae records flows for as long as the daemon runs; it has no on-demand grace.
  flowDemandGraceSeconds: null,
  globalSettings: daeGlobal,
  restartOnly: daeRestartOnly,
  // The service the install guide creates; the OpenWrt package uses `/etc/init.d/dae restart` instead.
  restartCommand: 'systemctl restart dae',
  reason,
  // Reading these back needs a BPF_PROG_QUERY per hook, or a switch into the daens namespace for dae0peer.
  uncheckedHooks: ['cgroup', 'sk_lookup', 'dae0peer'],
  holdsCredentials: source => holdsApiSecret(source.content),
  readOnlyReason,
  snippet: (settings: EngineSetting[]) =>
    nest(
      settings.map(({key, value}) => ({path: key.split('.'), value})),
      ''
    ).join('\n'),
  // dae redacts the listener secret when it returns a source, so `api { }` is not the file's text.
  redactedSections: blocks => blocks.filter(block => block.name === 'api').map(block => ({block, name: 'api'})),
  daeText: true
};
