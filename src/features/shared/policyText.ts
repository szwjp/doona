import {groupNameProblem, type GroupEntry} from '../../dae/groups';
import {enumLabel} from '../../i18n/enum';
import {isFragment} from '../../dae/text';
import type {Translator} from '../../i18n';
import {policyKindLabels} from '../../api/selectors';
import {manualPolicyKinds, newGroupPolicies, policyKind, unknownPolicyIsManual, type Dialect} from '../../dae/vocab';
import type {Group} from '../../api/model';

// A group without a policy line is a selector in honk, which is what `select` writes. dae requires `policy`, so the
// placeholder only ever shows before a new group writes one.
const IMPLIED = 'select';

// Translate native names without changing expressions saved by the editor.
export function policyLabel(value: string | null, t: Translator, dialect: Dialect = 'honk'): string {
  const native = value ?? IMPLIED;
  const kind = policyKind(native, dialect);
  return kind ? enumLabel(policyKindLabels, kind, t) : native;
}

// The engine reports the contract kind with the native text, so the kind labels an expression even when this build
// reads the text differently; the native text stays beside the label when the two differ.
export function groupPolicyText(policy: Pick<Group['policy'], 'kind' | 'native'>, t: Translator): {label: string; id?: string} {
  const label = enumLabel(policyKindLabels, policy.kind, t);
  const id = policy.native || policy.kind;
  return label === id ? {label} : {label, id};
}

// Whether a policy as written picks by hand: a selector, and dae's `fixed`, which pins one member. honk runs a policy
// it does not recognise as a selector too; dae rejects it, so an unreadable dae policy claims nothing.
export const manualPolicy = (value: string | null, dialect: Dialect = 'honk'): boolean => {
  const kind = policyKind(value ?? IMPLIED, dialect);
  return kind === undefined ? unknownPolicyIsManual[dialect] : manualPolicyKinds[dialect].includes(kind);
};

// The picker keeps a policy it does not offer as its own choice, so opening an editor never rewrites it.
export function policyChoices(value: string | null, t: Translator, dialect: Dialect = 'honk') {
  const items: Array<{id: string; label: string; desc?: string}> = newGroupPolicies[dialect].map(item => ({
    id: item.id,
    label: t(item.label),
    desc: t(item.description)
  }));
  return {
    selected: value ?? IMPLIED,
    items: value && !items.some(item => item.id === value) ? [{id: value, label: policyLabel(value, t, dialect)}, ...items] : items
  };
}

const nameProblems = {invalid: 'group.badName', taken: 'group.takenName'} as const;
export function groupNameError(name: string, taken: ReadonlySet<string>, t: Translator): string | null {
  if (!name.trim()) return t('nodes.nameMissing');
  const problem = groupNameProblem(name, taken);
  return problem ? t(nameProblems[problem]) : null;
}

// Values read from the file are written back as they were; only edited ones must fit on one line.
export function groupEditSafe(filters: string[], policy: string | null, entry: Pick<GroupEntry, 'filters' | 'policy'> | undefined): boolean {
  return filters.every(filter => entry?.filters.includes(filter) || isFragment(filter)) && (policy === (entry?.policy ?? null) || isFragment(policy ?? ''));
}
