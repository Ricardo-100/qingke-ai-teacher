import test from 'node:test';
import assert from 'node:assert/strict';
import { speechText, speechSegments } from '../shared/speech.mjs';

test('each variable letter has its own TTS boundary across subscript spellings', () => {
  for (const source of ['Rij', 'R_ij', 'R_{ij}', 'R_{i,j}', 'R下标ij', 'R下划线i j']) {
    assert.deepEqual(speechSegments(source), ['R', 'I', 'J'].map(text => ({ text, lang: 'en-US' })));
  }
  assert.deepEqual(speechSegments('这里 Rij 等于零。').filter(s => s.lang === 'en-US').map(s => s.text), ['R', 'I', 'J']);
  assert.deepEqual(speechSegments('API 和 ReLU').filter(s => s.lang === 'en-US').map(s => s.text), ['API', 'ReLU']);
  assert.deepEqual(speechSegments('Rij', true, false), [{ text: 'Rij', lang: 'en-US' }]);
});
test('speech strips formatting and subscripts without changing displayed source', () => {
  const source = '**这里 $R_{ij}$ 与 R_ij 相等**';
  assert.equal(speechText(source, true, false), '这里 Rij 与 Rij 相等');
  assert.equal(speechText(source, false), source);
  assert.equal(speechText(String.raw`\frac{a}{b}`), '分数，分子是诶，分母是比，分数结束');
});

test('alternate subscript spellings produce exactly the same fixed letter reading', () => {
  for (const source of ['Rij', 'R_ij', 'R_{ij}', 'R_{i,j}', 'R下标ij', 'R下划线i j']) assert.equal(speechText(source), '阿尔，艾，杰伊');
  assert.equal(speechText('API 和 ReLU'), 'API 和 ReLU');
  assert.equal(speechText('R_{ij}', true, false), 'Rij');
});

test('Greek letters and powers have a provider-independent reading', () => {
  assert.equal(speechText('α + β = Ω'), speechText(String.raw`\alpha + \beta = \Omega`));
  assert.equal(speechText('x²'), speechText('x^2'));
  assert.equal(speechText('x³'), speechText('x^{3}'));
  assert.match(speechText('R^T'), /的转置/);
  assert.match(speechText('x^{-1}'), /负一次方/);
  assert.equal(speechText('x^-1'), speechText('x^{-1}'));
  assert.equal(speechText('x^12'), speechText('x^{12}'));
  assert.equal(speechText(String.raw`R^\top`), speechText('R^T'));
  assert.match(speechText('x^{k-1}'), /凯.*减.*1.*次方/);
});

test('nested fractions and radicals preserve numerator, denominator and grouping', () => {
  const result = speechText(String.raw`\frac{1}{\frac{a}{b}+\sqrt{x^{2}+1}}`);
  assert.match(result, /分子是1，分母是分数，分子是诶，分母是比，分数结束.*根号.*平方.*根号结束，分数结束/);
  assert.equal(speechText(String.raw`\frac{\partial L}{\partial h_{k-1}}`), '艾尔对艾尺，凯，减，1的偏导数');
  assert.equal(speechText('√(x+1)'), speechText(String.raw`\sqrt{x+1}`));
});

test('sum limits are read as bounds, rather than treating upper limits as exponents', () => {
  const sum = speechText(String.raw`\sum_{i=1}^{n}x_i`);
  assert.match(sum, /求和，下限为艾，等于，1，上限为恩/);
  assert.ok(!sum.includes('次方'));
  assert.equal(speechText('∑_{i=1}^{n}x_i'), sum);
});

test('malformed or deeply nested formulas terminate without leaking LaTeX commands', () => {
  assert.doesNotThrow(() => speechText(String.raw`\frac{a}{\sqrt{b`));
  assert.doesNotThrow(() => speechText('\\sqrt{'.repeat(100) + 'x' + '}'.repeat(100)));
});
