import {useCallback, useMemo} from 'react';
import {useCapabilities} from './runtime';
import {useCompleteness, useConfig, useConfigEditor, type ConfigTransform} from './config';
import type {ConfigDiagnostic, ConfigSource} from '../api/model';
import {LocalError} from '../api/error';
import {offered} from '../api/capabilities';
import {scanConfig} from '../dae/text';

// Apply small edits to a source through shared preparation, optional full validation, If-Match write, and reload.
export type MainSourceEdit = {
  // The file doona writes a new declaration to when it cannot tell which one holds the section: the writable main
  // file, else the first writable source. An engine may keep its entry file read-only and every section in an
  // include, as dae's managed layout does.
  main: ConfigSource | null;
  // The writable source an edit of `section` goes to: the file that already holds the section (the main file first),
  // else `main`. Null while no writable source is complete.
  target: (section: string) => ConfigSource | null;
  // Whether the backend lets this page write at all: configuration content and writes both offered.
  writable: boolean;
  busy: boolean;
  error: Error | null;
  retry: () => void;
  // Never rejects: a dialog shows the outcome inline, a background edit as a toast.
  apply: (transform: ConfigTransform, origin?: ConfigSource) => Promise<EditResult>;
};
// A writable source whose text the page cannot reproduce: one notice for every page that reads it.
const incompleteSource = new LocalError('config.incomplete');
// The writable source an edit of `section` goes to: the file that already holds the section (the main file first),
// else the writable main file, else the first writable source. `complete` says whether a source's text may be written
// back as it was read.
export function pickTarget(sources: readonly ConfigSource[], complete: (source: ConfigSource) => boolean | undefined, section?: string): ConfigSource | null {
  const usable = sources.filter(source => source.writable && complete(source) === true);
  const fallback = usable.find(source => source.kind === 'main') ?? usable[0] ?? null;
  if (!section) return fallback;
  const holds = usable.filter(source => scanConfig(source.content).blocks.some(block => block.name === section));
  return holds.find(source => source.kind === 'main') ?? holds[0] ?? fallback;
}
// `invalid` keeps the diagnostics of the preflight, so the edit can say which lines were refused, as a refused write does.
export type EditResult = {kind: 'ok'} | {kind: 'invalid'; diagnostics: ConfigDiagnostic[]} | {kind: 'cancelled'} | {kind: 'failed'; error: unknown};

// `checking`: a writable source is there and its completeness is still being checked, as after each write.
export function useMainSourceEdit(): MainSourceEdit & {checking: boolean} {
  const resources = useCapabilities().data?.resources;
  const writable = offered(resources, 'config', {whileLoading: false}) && resources?.config.writable === true;
  const config = useConfig(offered(resources, 'config', {whileLoading: false}));
  const editor = useConfigEditor(config.refetch, {rethrow: true, shared: 'main-source-edit'});
  const sources = useMemo(() => config.data?.sources ?? [], [config.data?.sources]);
  const complete = useCompleteness(sources);
  const writableSources = sources.filter(source => source.writable);
  // A source whose text the page cannot reproduce, such as a redacted copy, is not written back.
  const pick = (section?: string) => pickTarget(sources, complete, section);
  const main = pick();
  // While a digest check is still running nothing is wrong yet; the notice waits for a verdict.
  const incomplete = writableSources.some(source => complete(source) === false);
  const error = config.error ?? (incomplete ? incompleteSource : null);
  const {apply} = editor;
  return {
    main,
    target: pick,
    checking: !main && writableSources.some(source => complete(source) === null),
    writable,
    busy: editor.busy !== null,
    error,
    retry: config.refetch,
    apply: useCallback<MainSourceEdit['apply']>(
      async (transform, origin = main ?? undefined): Promise<EditResult> => {
        if (!origin) return {kind: 'failed', error: error ?? new LocalError('config.incomplete')};
        try {
          const result = await apply(origin, transform);
          if (!result) return {kind: 'cancelled'};
          if (result.diagnostics) return {kind: 'invalid', diagnostics: result.diagnostics};
          return {kind: 'ok'};
        } catch (failure) {
          return {kind: 'failed', error: failure};
        }
      },
      [main, apply, error]
    )
  };
}
