import type {SettingsSection} from '../../dae/settings';

// dae config/config.go `Global`: only the fields its parser reads, in the sections the dae manual groups them in.
// Deprecated keys (auto_config_firewall_rule, enable_local_tcp_fast_redirect) and fields without a description there
// are left out, so the form cannot write a key a build has stopped honoring.
export const daeGlobal: SettingsSection = {
  name: 'global',
  fields: [
    // config/config.go Global; the dae manual's global section (docs/en/configuration/separate-config.md).
    {key: 'lan_interface', label: 'config.global.lan_interface', group: 'interfaces', type: 'list', bareItems: true},
    {key: 'wan_interface', label: 'config.global.wan_interface', group: 'interfaces', type: 'list', bareItems: true},
    {key: 'tproxy_port', label: 'config.global.tproxy_port', group: 'interfaces', type: 'integer', max: '65535'},
    {key: 'tproxy_port_protect', label: 'config.global.tproxy_port_protect', group: 'interfaces', type: 'boolean'},
    // uint32; dae auto-selects an internal mark when the key is absent, so an explicit 0 is meaningful.
    {key: 'so_mark_from_dae', label: 'config.global.so_mark_from_dae', group: 'interfaces', type: 'integer', max: '4294967295'},
    {key: 'pprof_port', label: 'config.global.pprof_port', group: 'interfaces', type: 'integer', max: '65535'},
    {key: 'auto_config_kernel_parameter', label: 'config.global.auto_config_kernel_parameter', group: 'interfaces', type: 'boolean'},
    {key: 'disable_waiting_network', label: 'config.global.disable_waiting_network', group: 'interfaces', type: 'boolean'},
    {key: 'disable_thp', label: 'config.global.disable_thp', group: 'interfaces', type: 'boolean'},
    // dae config/desc.go: error, warn, info, debug, trace; there is no `off` level.
    {key: 'log_level', label: 'config.global.log_level', group: 'logging', type: 'text', choices: ['trace', 'debug', 'info', 'warn', 'error']},
    {key: 'tcp_check_url', label: 'config.global.tcp_check_url', group: 'checks', type: 'list'},
    {key: 'tcp_check_http_method', label: 'config.global.tcp_check_http_method', group: 'checks', type: 'text'},
    {key: 'udp_check_dns', label: 'config.global.udp_check_dns', group: 'checks', type: 'list'},
    {key: 'check_interval', label: 'config.global.check_interval', group: 'checks', type: 'duration', units: ['', 'ms', 's', 'm', 'h']},
    {key: 'check_tolerance', label: 'config.global.check_tolerance', group: 'checks', type: 'duration', units: ['', 'ms', 's']},
    {key: 'dial_mode', label: 'config.global.dial_mode', group: 'dialing', type: 'text', choices: ['ip', 'domain', 'domain+', 'domain++']},
    {key: 'sniffing_timeout', label: 'config.global.sniffing_timeout', group: 'dialing', type: 'duration', units: ['', 'ms', 's']},
    {key: 'auto_sniff_punt', label: 'config.global.auto_sniff_punt', group: 'dialing', type: 'boolean'},
    {key: 'mptcp', label: 'config.global.mptcp', group: 'dialing', type: 'boolean'},
    {key: 'bootstrap_resolver', label: 'config.global.bootstrap_resolver', group: 'dialing', type: 'text'},
    {key: 'fallback_resolver', label: 'config.global.fallback_resolver', group: 'dialing', type: 'text'},
    {key: 'allow_insecure', label: 'config.global.allow_insecure', group: 'dialing', type: 'boolean'},
    {key: 'tls_implementation', label: 'config.global.tls_implementation', group: 'dialing', type: 'text'},
    {key: 'utls_imitate', label: 'config.global.utls_imitate', group: 'dialing', type: 'text'},
    {key: 'tls_fragment', label: 'config.global.tls_fragment', group: 'dialing', type: 'boolean'},
    {key: 'tls_fragment_length', label: 'config.global.tls_fragment_length', group: 'dialing', type: 'text'},
    {key: 'tls_fragment_interval', label: 'config.global.tls_fragment_interval', group: 'dialing', type: 'text'},
    {key: 'bandwidth_max_tx', label: 'config.global.bandwidth_max_tx', group: 'bandwidth', type: 'text'},
    {key: 'bandwidth_max_rx', label: 'config.global.bandwidth_max_rx', group: 'bandwidth', type: 'text'},
    {key: 'udphop_interval', label: 'config.global.udphop_interval', group: 'bandwidth', type: 'duration', units: ['', 'ms', 's', 'm', 'h']},
    // A uint32 entry cap on the shared eBPF connection-state map.
    {key: 'bpf_conn_state_map_size', label: 'config.global.bpf_conn_state_map_size', group: 'storage', type: 'integer', max: '4294967295'}
  ]
};

// dae applies a reloaded `global` section in place; only the map's entry cap is fixed when the eBPF map is created, and
// a same-port reload keeps the live map (config/desc.go bpf_conn_state_map_size). The `api` section, the one other
// restart-only part of the configuration, is not part of this form; dae hides its file from the API entirely.
export const daeRestartOnly = ['bpf_conn_state_map_size'];
