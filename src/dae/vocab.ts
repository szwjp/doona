import type {Group} from '../api/model';
import type {Key} from '../i18n';

// The two dae text dialects doona writes: honk's parser (crates/honk-config/src/parser) and dae's (config/desc.go).
// Both read the same syntax, but each accepts its own vocabulary, so the editor's completions and the pickers read
// the tables by dialect.
export type Dialect = 'honk' | 'dae';
// The global keys each parser reads.
export const globalKeys: Record<Dialect, readonly string[]> = {
  honk: [
    'tproxy_port',
    'tproxy_port_protect',
    'pprof_port',
    'so_mark_from_dae',
    'log_level',
    'log_file',
    'disable_waiting_network',
    'lan_interface',
    'wan_interface',
    'auto_config_kernel_parameter',
    'data_dir',
    'store_subscribe',
    'tcp_check_url',
    'tcp_check_http_method',
    'udp_check_dns',
    'check_interval',
    'check_tolerance',
    'dial_mode',
    'nfqueue_enable',
    'allow_insecure',
    'sniffing_timeout',
    'tls_implementation',
    'utls_imitate',
    'tls_fragment',
    'tls_fragment_length',
    'tls_fragment_interval',
    'mptcp',
    'bootstrap_resolver',
    'fallback_resolver',
    'bandwidth_max_tx',
    'bandwidth_max_rx',
    'udp_warm_node_count',
    'preconnect_node_count',
    'max_concurrent_dials'
  ],
  // dae config/config.go `Global`, minus the keys it marks deprecated.
  dae: [
    'tproxy_port',
    'tproxy_port_protect',
    'so_mark_from_dae',
    'log_level',
    'tcp_check_url',
    'tcp_check_http_method',
    'udp_check_dns',
    'check_interval',
    'check_tolerance',
    'lan_interface',
    'wan_interface',
    'allow_insecure',
    'dial_mode',
    'disable_waiting_network',
    'disable_thp',
    'auto_config_kernel_parameter',
    'sniffing_timeout',
    'auto_sniff_punt',
    'tls_implementation',
    'utls_imitate',
    'tls_fragment',
    'tls_fragment_length',
    'tls_fragment_interval',
    'pprof_port',
    'mptcp',
    'bootstrap_resolver',
    'fallback_resolver',
    'bandwidth_max_tx',
    'bandwidth_max_rx',
    'udphop_interval',
    'bpf_conn_state_map_size'
  ]
};
// Which contract kind a native policy expression behaves as, read as each engine reads it: the name before `(`,
// trimmed, in ASCII lower case; other unknown names stay undefined.
// honk: legacy min and random run as a selector, and `honk` is rejected as the old name of `score`.
// dae (config/desc.go): select switches one member, fixed pins one, random re-rolls per connection, and min, min_avg10
// and min_moving_avg pick by latency.
const policyKinds: Record<Dialect, Record<string, Group['policy']['kind']>> = {
  honk: {
    select: 'selector',
    selector: 'selector',
    fixed: 'selector',
    min: 'selector',
    random: 'selector',
    urltest: 'urltest',
    min_moving_avg: 'urltest',
    min_avg10: 'urltest',
    min_last_delay: 'urltest',
    roundrobin: 'loadbalance',
    round_robin: 'loadbalance',
    loadbalance: 'loadbalance',
    balance: 'loadbalance',
    fallback: 'fallback',
    score: 'score'
  },
  dae: {
    select: 'selector',
    fixed: 'fixed',
    random: 'random',
    min: 'urltest',
    min_avg10: 'urltest',
    min_moving_avg: 'urltest'
  }
};
// The kinds that pick a member by hand: honk's selector (its legacy fixed and min read as one), and dae's selector and
// fixed. A policy text neither parser reads picks by hand in honk, which falls back to a selector, but not in dae,
// which rejects it.
export const manualPolicyKinds: Record<Dialect, readonly Group['policy']['kind'][]> = {
  honk: ['selector'],
  dae: ['selector', 'fixed']
};
export const unknownPolicyIsManual: Record<Dialect, boolean> = {honk: true, dae: false};
export function policyKind(native: string, dialect: Dialect = 'honk'): Group['policy']['kind'] | undefined {
  const base = native
    .split('(', 1)[0]
    .trim()
    .replace(/[A-Z]/g, letter => letter.toLowerCase());
  return Object.hasOwn(policyKinds[dialect], base) ? policyKinds[dialect][base] : undefined;
}
// Written out rather than read from policyKinds, so completion keeps to the spellings each engine's parser shares.
export const policies: Record<Dialect, readonly string[]> = {
  // honk reads dae's `random` as an unknown policy and falls back to a selector, so it is left out.
  honk: ['select', 'urltest', 'roundrobin', 'fallback', 'score', 'fixed', 'min_moving_avg', 'min_avg10', 'min_last_delay', 'loadbalance'],
  dae: ['random', 'fixed', 'select', 'min', 'min_avg10', 'min_moving_avg']
};
// The policies a new group can start with, in the order the picker offers them.
export const newGroupPolicies: Record<Dialect, Array<{id: string; label: Key; description: Key}>> = {
  honk: [
    {id: 'score', label: 'policy.kind.score', description: 'group.policy.scoreHint'},
    {id: 'min_moving_avg', label: 'policy.kind.urltest', description: 'group.policy.fastestHint'},
    {id: 'fallback', label: 'policy.kind.fallback', description: 'group.policy.fallbackHint'},
    {id: 'roundrobin', label: 'policy.kind.loadbalance', description: 'group.policy.spreadHint'},
    {id: 'select', label: 'policy.kind.selector', description: 'group.policy.manualHint'}
  ],
  dae: [
    {id: 'min_moving_avg', label: 'policy.kind.urltest', description: 'group.policy.fastestHint'},
    {id: 'min_avg10', label: 'policy.kind.urltest', description: 'group.policy.fastestHint'},
    {id: 'min', label: 'policy.kind.urltest', description: 'group.policy.lastHint'},
    {id: 'select', label: 'policy.kind.selector', description: 'group.policy.manualHint'},
    {id: 'fixed', label: 'policy.kind.fixed', description: 'group.policy.fixedHint'},
    {id: 'random', label: 'policy.kind.random', description: 'group.policy.randomHint'}
  ]
};
// Built-in outbounds, as nodes, groups and rules name them; a rule may add `(must)`, which keeps DNS traffic from
// being hijacked for that rule.
export const builtinOutboundNames = ['direct', 'block'] as const;
type BuiltinOutbound = (typeof builtinOutboundNames)[number];
export const builtinOutbounds = [...builtinOutboundNames, ...builtinOutboundNames.map(name => `${name}(must)`)];
// A bare name only: where `(must)` can appear, in rule text, the callers strip or list it themselves.
export const isBuiltinOutbound = (name: string | null | undefined): name is BuiltinOutbound =>
  name != null && (builtinOutboundNames as readonly string[]).includes(name);
