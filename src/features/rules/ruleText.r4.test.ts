// The r4 engine reports the rule's source text as its expression and its source location, so doona can locate every
// rule of these lists. The sample is a live router's real configuration, and the payload is the r4 /rules and
// /dns/rules response predicted from it (dae's r4 build had not shipped when this was written).
import {expect, it} from 'vitest';
import {dnsRuleAnchor, dnsRuleTarget, removeRule, replaceRule, replaceRuleTarget, ruleAnchor} from '../../dae/ruleText';
import {dnsRulePositions, rulePositions, ruleWritable} from '../shared/rule';
import {translate, type Translator} from '../../i18n';
import type {ConfigSource, DnsRuleList, RuleList} from '../../api/model';
import sampleText from '../../dae/__fixtures__/r4.json?raw';

const t: Translator = (key, params) => translate('en', key, params);
const sample = JSON.parse(sampleText) as {sources: ConfigSource[]; rules: RuleList; dnsRules: DnsRuleList};
const r4Sources = sample.sources;
const r4RoutingRules = sample.rules;
const r4DnsRules = sample.dnsRules;
const routingSourceId = 'src_845522dfc34ebacd';
const dnsSourceId = 'src_04ea3cefc8e6df08';
const routingSource = r4Sources.find(source => source.id === routingSourceId)!;
const dnsSource = r4Sources.find(source => source.id === dnsSourceId)!;
const routingText = routingSource.content;
const dnsText = dnsSource.content;

it('locates every rule of the live /rules response, including its must targets, in the source it names', () => {
  for (const rule of r4RoutingRules.rules) {
    expect(rule.source).not.toBeNull();
    expect(ruleAnchor(routingSource, rule)).not.toBeNull();
    expect(ruleWritable(rule, r4Sources)).toBe(true);
    // A rule of the other file does not anchor here, even when its line holds something.
    expect(ruleAnchor({...routingSource, id: 'other'}, rule)).toBeNull();
  }
  // A writable source with anchors gives the dialog places: the fallback and the first rule.
  expect(rulePositions(r4RoutingRules.rules, r4RoutingRules.generation_id, r4Sources, null, t).map(position => position.id)).toEqual([
    'traffic:fallback',
    'traffic:0'
  ]);
});

it('keeps a must rule as written when its target did not change, and writes an ordinary target when it did', () => {
  // `mac(...) -> must_direct` is reported as outbound `direct` and `must: true`; the same target must not rewrite the
  // source into the engine's spelling.
  const mustRule = r4RoutingRules.rules.find(rule => rule.rule_id === 'traffic:3')!;
  const anchor = ruleAnchor(routingSource, mustRule)!;
  expect(routingText.slice(anchor.target!.from, anchor.target!.to).trim()).toBe('must_direct');
  expect(replaceRuleTarget(routingText, anchor, 'direct', true)).toBe(routingText);
  expect(replaceRule(routingText, anchor, 'mac(00:00:00:00:00:00)', 'direct', true)).toBe(
    routingText.replace("mac('00:00:00:00:00:00') -> must_direct", 'mac(00:00:00:00:00:00) -> must_direct')
  );
  expect(replaceRuleTarget(routingText, anchor, 'proxy', false)).toBe(
    routingText.replace("mac('00:00:00:00:00:00') -> must_direct", "mac('00:00:00:00:00:00') -> proxy")
  );
  // The list says this rule is not a must rule, so the line no longer holds it: never edit its neighbour.
  expect(ruleAnchor(routingSource, {...mustRule, must: false})).toBeNull();
  // The parenthesised spelling of the same must target anchors too, and also stays byte-identical.
  const parenRule = r4RoutingRules.rules.find(rule => rule.rule_id === 'traffic:0')!;
  const parenAnchor = ruleAnchor(routingSource, parenRule)!;
  expect(replaceRuleTarget(routingText, parenAnchor, 'proxy', true)).toBe(routingText);
  expect(replaceRule(routingText, parenAnchor, 'dip(1.1.1.1) && dport(443)', 'proxy', true)).toContain('dip(1.1.1.1) && dport(443) -> proxy(must)\n');
});

it('anchors quoted parameters and edits only the condition, keeping the trailing spelling', () => {
  const quoted = r4RoutingRules.rules.find(rule => rule.source?.line === 9)!;
  const anchor = ruleAnchor(routingSource, quoted)!;
  expect(replaceRule(routingText, anchor, "dip(224.0.0.0/3, 'ff00::/8') && l4proto(udp)", 'direct', false)).toBe(
    routingText.replace("dip(224.0.0.0/3, 'ff00::/8') -> direct", "dip(224.0.0.0/3, 'ff00::/8') && l4proto(udp) -> direct")
  );
  expect(removeRule(routingText, anchor)).not.toContain("dip(224.0.0.0/3, 'ff00::/8') -> direct");
});

it('locates every DNS rule of the live /dns/rules response and its fallback in its list', () => {
  for (const rule of r4DnsRules.request) expect(dnsRuleAnchor(dnsSource, rule, 'request')).not.toBeNull();
  for (const rule of r4DnsRules.response) expect(dnsRuleAnchor(dnsSource, rule, 'response')).not.toBeNull();
  // The list is the one that holds the statement: a line of the other list does not anchor here.
  const request = r4DnsRules.request[1];
  expect(dnsRuleAnchor(dnsSource, request, 'response')).toBeNull();
  expect(dnsRulePositions('request', r4DnsRules.request, r4Sources, t).map(position => position.id)).toEqual(['dns-request:fallback', 'dns-request:0']);
  expect(dnsRulePositions('response', r4DnsRules.response, r4Sources, t).map(position => position.id)).toEqual(['dns-response:fallback', 'dns-response:0']);
});

it('sends a DNS rule to the upstream its line names, keeping the source spelling of the upstream', () => {
  const request = r4DnsRules.request.find(rule => rule.rule_id === 'dns-request:1')!;
  expect(dnsRuleTarget(request)).toBe('alidns');
  const anchor = dnsRuleAnchor(dnsSource, request, 'request')!;
  expect(replaceRule(dnsText, anchor, 'qname(suffix: example.com)', 'alidns', false)).toBe(
    dnsText.replace('node(name_regex: ".*") -> alidns', 'qname(suffix: example.com) -> alidns')
  );
  expect(replaceRuleTarget(dnsText, anchor, 'cloudflare', false)).toBe(
    dnsText.replace('node(name_regex: ".*") -> alidns', 'node(name_regex: ".*") -> cloudflare')
  );
  // An upstream the list names in another case still anchors; another name does not.
  expect(dnsRuleAnchor(dnsSource, {...request, upstream: 'AliDNS'}, 'request')).not.toBeNull();
  expect(dnsRuleAnchor(dnsSource, {...request, upstream: 'googledns'}, 'request')).toBeNull();
});

it('treats a written DNS fallback as a fallback rule whose target is the action or upstream it names', () => {
  const requestFallback = r4DnsRules.request.at(-1)!;
  expect(requestFallback.kind).toBe('fallback');
  expect(dnsRuleTarget(requestFallback)).toBe('cloudflare');
  expect(dnsRuleAnchor(dnsSource, requestFallback, 'request')).not.toBeNull();
  expect(replaceRuleTarget(dnsText, dnsRuleAnchor(dnsSource, requestFallback, 'request')!, 'alidns', false)).toBe(
    dnsText.replace('fallback: cloudflare', 'fallback: alidns')
  );
  const responseFallback = r4DnsRules.response.at(-1)!;
  expect(dnsRuleTarget(responseFallback)).toBe('accept');
  expect(dnsRuleAnchor(dnsSource, responseFallback, 'response')).not.toBeNull();
});
