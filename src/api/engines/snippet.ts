import type {EngineSetting} from './types';

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

// The engine's configuration text for a handful of settings, as the settings' own full names nest.
export const snippet = (settings: EngineSetting[]): string =>
  nest(
    settings.map(({key, value}) => ({path: key.split('.'), value})),
    ''
  ).join('\n');
