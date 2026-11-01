import type {SettingsSection} from '../../dae/settings';

// dae config/config.go Global: only the fields dae actually parses from `global`, with their accepted scalar widths.
// The labels are the ones the configuration page already shows; a field whose label does not exist yet stays out.
export const daeGlobal: SettingsSection = {
  name: 'global',
  fields: [
    {key: 'lan_interface', label: 'config.global.lan_interface', group: 'interfaces', type: 'list', bareItems: true},
    {key: 'wan_interface', label: 'config.global.wan_interface', group: 'interfaces', type: 'list', bareItems: true},
    {key: 'tproxy_port', label: 'config.global.tproxy_port', group: 'interfaces', type: 'integer', max: '65535'},
    {key: 'tproxy_port_protect', label: 'config.global.tproxy_port_protect', group: 'interfaces', type: 'boolean'},
    {key: 'so_mark_from_dae', label: 'config.global.so_mark_from_dae', group: 'interfaces', type: 'integer', max: '4294967295'},
    {key: 'pprof_port', label: 'config.global.pprof_port', group: 'interfaces', type: 'integer', max: '65535'},
    {key: 'auto_config_kernel_parameter', label: 'config.global.auto_config_kernel_parameter', group: 'interfaces', type: 'boolean'},
    {key: 'disable_waiting_network', label: 'config.global.disable_waiting_network', group: 'interfaces', type: 'boolean'},
    {key: 'log_level', label: 'config.global.log_level', group: 'logging', type: 'text', choices: ['trace', 'debug', 'info', 'warn', 'error', 'off']},
    {key: 'tcp_check_url', label: 'config.global.tcp_check_url', group: 'checks', type: 'list'},
    {key: 'tcp_check_http_method', label: 'config.global.tcp_check_http_method', group: 'checks', type: 'text'},
    {key: 'udp_check_dns', label: 'config.global.udp_check_dns', group: 'checks', type: 'list'},
    {key: 'check_interval', label: 'config.global.check_interval', group: 'checks', type: 'duration', units: ['', 'ms', 's', 'm', 'h']},
    {key: 'check_tolerance', label: 'config.global.check_tolerance', group: 'checks', type: 'duration', units: ['', 'ms', 's']},
    {key: 'dial_mode', label: 'config.global.dial_mode', group: 'dialing', type: 'text', choices: ['ip', 'domain', 'domain+', 'domain++']},
    {key: 'sniffing_timeout', label: 'config.global.sniffing_timeout', group: 'dialing', type: 'duration', units: ['', 'ms', 's']},
    {key: 'bootstrap_resolver', label: 'config.global.bootstrap_resolver', group: 'dialing', type: 'text'},
    {key: 'fallback_resolver', label: 'config.global.fallback_resolver', group: 'dialing', type: 'text'},
    {key: 'allow_insecure', label: 'config.global.allow_insecure', group: 'dialing', type: 'boolean'},
    {key: 'tls_implementation', label: 'config.global.tls_implementation', group: 'dialing', type: 'text'},
    {key: 'utls_imitate', label: 'config.global.utls_imitate', group: 'dialing', type: 'text'},
    {key: 'tls_fragment', label: 'config.global.tls_fragment', group: 'dialing', type: 'boolean'},
    {key: 'tls_fragment_length', label: 'config.global.tls_fragment_length', group: 'dialing', type: 'text'},
    {key: 'tls_fragment_interval', label: 'config.global.tls_fragment_interval', group: 'dialing', type: 'text'},
    {key: 'mptcp', label: 'config.global.mptcp', group: 'dialing', type: 'boolean'},
    {key: 'bandwidth_max_tx', label: 'config.global.bandwidth_max_tx', group: 'bandwidth', type: 'text'},
    {key: 'bandwidth_max_rx', label: 'config.global.bandwidth_max_rx', group: 'bandwidth', type: 'text'}
  ]
};

// dae applies a reload to the datapath in place, but the listener, the port and the resolver set belong to the
// process: changing them takes a restart. cmd/run_reload_worker.go refuses a reload that changes the `api` section,
// and cmd/run_reload.go restarts the DNS listener around a generation handover.
export const daeRestartOnly = [
  'lan_interface',
  'wan_interface',
  'tproxy_port',
  'tproxy_port_protect',
  'so_mark_from_dae',
  'pprof_port',
  'auto_config_kernel_parameter',
  'disable_waiting_network',
  'log_level',
  'tcp_check_url',
  'tcp_check_http_method',
  'udp_check_dns',
  'check_interval',
  'check_tolerance',
  'dial_mode',
  'sniffing_timeout',
  'bootstrap_resolver',
  'fallback_resolver',
  'allow_insecure',
  'tls_implementation',
  'utls_imitate',
  'tls_fragment',
  'tls_fragment_length',
  'tls_fragment_interval',
  'mptcp',
  'bandwidth_max_tx',
  'bandwidth_max_rx'
];
