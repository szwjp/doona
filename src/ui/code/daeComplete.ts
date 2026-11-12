import {autocompletion, type Completion, type CompletionContext, type CompletionResult} from '@codemirror/autocomplete';
import * as vocab from '../../dae/vocab';
import type {Dialect} from '../../dae/vocab';
import {scanConfig, type TextBlock} from '../../dae/text';
import type {GroupEntry} from '../../dae/groups';

const sections = ['global', 'subscription', 'node', 'group', 'dns', 'routing'].map(label => ({label, type: 'keyword'}));
// Each dialect's tables are built once; honk's is the default until a caller names the engine.
const globalKeys = (Object.keys(vocab.globalKeys) as Dialect[]).map(dialect => ({
  dialect,
  items: vocab.globalKeys[dialect].map(label => ({label, type: 'property' as const, apply: label + ': '}))
}));
const conditions = ['domain', 'dip', 'sip', 'dport', 'sport', 'l4proto', 'ipversion', 'pname', 'mac', 'dscp', 'qname', 'qtype', 'upstream'].map(label => ({
  label,
  type: 'function',
  apply: label + '('
}));
const matchers = ['geosite', 'geoip', 'suffix', 'full', 'keyword', 'regex'].map(label => ({label, type: 'constant', apply: label + ':'}));
const policies = (Object.keys(vocab.policies) as Dialect[]).map(dialect => ({
  dialect,
  items: vocab.policies[dialect].map(label => ({label, type: 'constant' as const}))
}));
const forDialect = <I>(table: Array<{dialect: Dialect; items: I[]}>, dialect: Dialect): I[] =>
  (table.find(entry => entry.dialect === dialect) ?? table[0]).items;
const builtins = vocab.builtinOutbounds.map(label => ({label, type: 'keyword'}));
const dnsRequestActions = ['asis', 'reject'].map(label => ({label, type: 'keyword'}));
const dnsResponseActions = ['accept', 'reject'].map(label => ({label, type: 'keyword'}));
const routingWords = [
  {label: 'fallback', type: 'keyword', apply: 'fallback: '},
  {label: 'include', type: 'keyword', apply: 'include '}
];

type Named = Pick<GroupEntry, 'name' | 'written'>;
// What `->` may name: groups in routing, upstreams in dns.
export type CompletionNames = {groups: Named[]; upstreams: Named[]; dialect?: Dialect};
// Listed by name; inserted as the header or key writes it, quotes included, since honk matches that text.
const written = (list: Named[]) => list.map(item => ({label: item.name, apply: item.written, type: 'variable'}));

export function completeDae(context: CompletionContext, names: () => CompletionNames): CompletionResult | null {
  const word = context.matchBefore(/[\w.-]*/);
  if (!word) return null;
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  const afterArrow = /->\s*[\w.-]*$/.test(before) || /^\s*fallback:\s*[\w.-]*$/.test(before);
  // An empty word only opens the list where the next token is obvious: right after an arrow.
  if (word.from === word.to && !context.explicit && !afterArrow) return null;
  const text = context.state.doc.sliceString(0, context.pos);
  const {blocks, tokens} = scanConfig(text);
  const last = tokens.at(-1);
  if (last?.to === context.pos && (last.kind === 'quoted' || last.kind === 'comment')) return null;
  // The blocks the cursor is inside, outermost first.
  const open: string[] = [];
  const atCursor = (block: TextBlock) => block.close === context.pos;
  for (let block = blocks.find(atCursor); block; block = block.children.find(atCursor)) open.push(block.name);
  const section = open[0];
  let options: Completion[];
  // The group and upstream names are read from the configuration text, so only the branches that list them ask.
  let named: CompletionNames | undefined;
  const resolve = () => (named ??= names());
  if (afterArrow) {
    const {groups, upstreams} = resolve();
    if (section !== 'dns') options = [...written(groups), ...builtins];
    else options = [...written(upstreams), ...(open.includes('response') ? dnsResponseActions : dnsRequestActions)];
  } else if (/\b(domain|dip|sip|qname)\(\s*[\w.-]*$/.test(before)) {
    options = matchers;
  } else if (section === undefined) {
    options = sections.map(item => ({
      ...item,
      // The cursor lands on the indented blank line inside the new section.
      apply: (view, _completion, from, to) => {
        const insert = item.label + ' {\n  \n}';
        view.dispatch({changes: {from, to, insert}, selection: {anchor: from + item.label.length + 4}});
      }
    }));
  } else if (section === 'routing' || section === 'dns') {
    options = [...conditions, ...routingWords];
  } else if (section === 'global') {
    options = forDialect(globalKeys, resolve().dialect ?? 'honk');
  } else if (section === 'group') {
    const offered = forDialect(policies, resolve().dialect ?? 'honk');
    options = /\bpolicy\s*:\s*[\w.-]*$/.test(before)
      ? offered
      : [...offered.map(item => ({...item, apply: 'policy: ' + item.label})), {label: 'filter', type: 'property', apply: 'filter: '}];
  } else {
    return null;
  }
  return {from: word.from, options, validFor: /^[\w.-]*$/};
}

export function daeCompletion(names: () => CompletionNames) {
  return autocompletion({override: [context => completeDae(context, names)]});
}
