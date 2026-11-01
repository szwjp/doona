import type {Capabilities, EffectiveConfig} from '../model';
import type {ConfigManagement, EngineConfig} from './types';

// dae reports its own extension inside the config resource rather than in a top-level `x-honk` member:
// capabilities.resources.config["x-dae"] = {store: {kind: 'file'}, layout: {kind, reason}, hidden_sources}.
type DaeConfig = EffectiveConfig & {
  'x-dae'?: {store?: {kind?: string; recorded?: boolean}; layout?: {kind?: string; reason?: string}; hidden_sources?: string[]};
};

// dae's native API has no x-honk style extension: it offers the contract's own source-level endpoints
// (GET /api/v1/config, GET /api/v1/config/sources, PUT /api/v1/config/sources/{id}, POST /api/v1/config/validate)
// and nothing else. There is no export, no import and no revision list, so the configuration page offers the
// source editor and nothing else.
function management(_capabilities: Capabilities | undefined): ConfigManagement {
  return {
    export: false,
    import: false,
    revisions: false,
    replaceRequired: false,
    canActivate: false,
    off: {export: false, import: false, revisions: false}
  };
}

// dae keeps the configuration on disk; there is no revision store, so the page is told nothing is recorded.
function configStore(config: EffectiveConfig | undefined) {
  const store = (config as DaeConfig | undefined)?.['x-dae']?.store;
  return store ? {recorded: store.recorded === true} : undefined;
}

// dae has no export endpoint, so these paths are placeholders the client never reaches: the management flags
// above keep every caller from asking for them.
export const daeConfig: EngineConfig = {
  management,
  store: configStore,
  paths: {
    export: '/api/v1/x-dae/config/export',
    import: '/api/v1/x-dae/config/import',
    revisions: '/api/v1/x-dae/config/revisions',
    activate: '/api/v1/x-dae/config/revisions/{revision}/activate'
  },
  exportFilename: () => 'dae.dae'
};
