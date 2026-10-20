import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAction, validateLesson, extractJSON } from '../shared/protocol.mjs';

test('annotation anchors use actual PDF target bounds instead of hallucinated coordinates', () => {
  const target = { id: 'formula', x: .2, y: .3, w: .4, h: .05 };
  const result = normalizeAction({ type: 'circle', targetId: 'formula', x: .8, y: .8 }, [target]);
  assert.deepEqual([result.x, result.y, result.w, result.h], [.2, .3, .4, .05]);
  assert.throws(() => normalizeAction({ type: 'circle', targetId: 'missing' }, [target]), /不存在/);
});
test('malformed model content cannot become executable drawing commands', () => {
  assert.throws(() => normalizeAction({ type: 'script', x: .1, y: .1 }), /无效/);
  assert.throws(() => normalizeAction({ type: 'circle', x: 'NaN', y: .1 }), /位置/);
  assert.throws(() => validateLesson({ beats: [{ speech: '' }] }), /讲解/);
  assert.throws(() => extractJSON('<script>'), /格式/);
  const result = normalizeAction({ type: 'note', x: 2, y: -2, w: 9, h: 5, text: 'a'.repeat(500) });
  assert.ok(result.x + result.w <= 1 && result.y + result.h <= 1);
  assert.equal(result.text.length, 240);
});
test('quiz answers must reference a real option', () => {
  const beats = [{ speech: '讲解', actions: [], board: '' }];
  const valid = validateLesson({ beats, quiz: { question: '?', options: ['a', 'b'], answer: 1 } });
  assert.equal(valid.quiz.answer, 1);
  assert.equal(validateLesson({ beats, quiz: { question: '?', options: ['a', 'b'], answer: 7 } }).quiz, undefined);
  assert.equal(extractJSON('```json\n{"beats":[]}\n```').beats.length, 0);
});

test('keyword highlighting uses measured text advances and rejects invented phrases', () => {
  const target = { id: 'word', text: 'a test', x: .2, y: .3, w: .4, h: .03, charEdges: [0, .1, .2, .4, .6, .8, 1] };
  const result = normalizeAction({ type: 'highlight', targetId: 'word', quote: 'test' }, [target]);
  assert.ok(Math.abs(result.x - .28) < 1e-10);
  assert.ok(Math.abs(result.w - .32) < 1e-10);
  assert.equal(result.h, .03);
  assert.throws(() => normalizeAction({ type: 'circle', targetId: 'word', quote: 'absent' }, [target]), /关键词/);
  assert.throws(() => normalizeAction({ type: 'highlight', targetId: 'word', quote: 'test' }, [{ ...target, charEdges: undefined }]), /精确定位/);
});
