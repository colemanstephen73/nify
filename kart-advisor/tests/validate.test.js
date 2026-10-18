import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateFile } from '../tools/validate-data.js';
import { loadYamlTree } from '../tools/build-data.js';
import { validateAll } from '../tools/validate-data.js';

const base = { schema_version: 1, sources: { s1: { url: 'https://example.com', confidence: 'manufacturer' } } };

test('the shipped knowledge base is valid', () => {
  assert.deepEqual(validateAll(loadYamlTree()), []);
});

test('uncited value is rejected', () => {
  const e = validateFile('x', { ...base, a: { value: 5, confidence: 'manufacturer' } });
  assert.equal(e.length, 1);
  assert.match(e[0], /no sources/);
});

test('inferred value with a derivation is allowed without a source', () => {
  assert.deepEqual(validateFile('x', { ...base, a: { value: 5, confidence: 'inferred', derivation: 'from b' } }), []);
});

test('unknown source id, bad confidence, inverted range, bad rule field are rejected', () => {
  const e = validateFile('x', {
    ...base,
    a: { value: 1, sources: ['nope'], confidence: 'guess' },
    r: { min: 5, max: 1 },
    limits: [{ field: 'turbo', op: 'max', value: 1, sources: ['s1'], confidence: 'manufacturer' }],
  });
  assert.equal(e.length, 4, e.join('\n'));
});

test('null values (unknowns) need no source', () => {
  assert.deepEqual(validateFile('x', { ...base, a: { value: null, confidence: 'unknown' } }), []);
});
