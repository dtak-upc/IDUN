import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relationshipGroups, type ReviewSource } from './relationshipGroups.ts';

const source = (id: string, row: string, cells = ['city-1', 'Paris']) => ({ source: id, name: 'cities.csv', columns: ['id', 'name'], record: { record_id: row, cells }, anchor_column: 1 });
const pair = (candidate: string, left: ReviewSource = source('A', 'a1'), right: ReviewSource = source('B', 'b1')) => ({ candidate, left, right });
const row = (candidate: string, relation: string, direction = 'undirected') => ({ candidate, relation, direction, evidence_quote: 'same city', left_link: 'l', right_link: 'r' });

test('groups different predicates on exact pairs across documents without mutating outputs', () => {
  const rows = [row('P1', 'REFERS_TO_SAME_ENTITY'), row('P2', 'MATCH_CITY_DATA'), row('P3', 'EQUIVALENT_ENTITY')];
  const before = JSON.stringify(rows);
  const result = relationshipGroups([pair('P1'), pair('P2'), pair('P3')], rows);
  assert.equal(result.groups.length, 1); assert.equal(result.groups[0].labels.length, 3);
  assert.equal(JSON.stringify(rows), before);
});
test('never conflates filenames, opposite directions or reverse source order', () => {
  const cases = [pair('P1'), pair('P2', source('C', 'a1')), pair('P3'), pair('P4', source('B', 'b1'), source('A', 'a1'))];
  assert.equal(relationshipGroups(cases, [row('P1', 'ONE'), row('P2', 'TWO'), row('P3', 'THREE', 'a_to_b'), row('P4', 'FOUR')]).groups.length, 0);
});
test('explicit composite review keys group duplicate key values but not nulls or partial matches', () => {
  const cases = [pair('P1'), pair('P2', source('A', 'a2')), pair('P3', source('A', 'a3', ['', 'Paris'])), pair('P4', source('A', 'a4', ['city-1', 'Other']))];
  const rows = cases.map((c, i) => row(c.candidate, `REL_${i}`));
  assert.equal(relationshipGroups(cases, rows).groups.length, 0);
  const result = relationshipGroups(cases, rows, { A: [0, 1] });
  assert.equal(result.groups.length, 1); assert.equal(result.groups[0].rows.length, 2); assert.equal(result.skipped, 1);
});
test('unknown identities and repeated instances of a single predicate produce no suggestion', () => {
  const noId = { ...source('A', 'a1'), source: undefined };
  const result = relationshipGroups([pair('P1'), pair('P2'), pair('P3', noId)], [row('P1', 'ONE'), row('P2', 'ONE'), row('P3', 'TWO')]);
  assert.equal(result.groups.length, 0); assert.equal(result.skipped, 1);
});
