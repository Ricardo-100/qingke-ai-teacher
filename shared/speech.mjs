// Provider-independent spoken text. The displayed formula is never changed.
const letters = ['诶','比','西','迪','伊','艾弗','吉','艾尺','艾','杰伊','凯','艾尔','艾姆','恩','欧','皮','丘','阿尔','艾丝','提','优','维','达布留','艾克斯','歪','泽德'];
const greekNames = ['alpha','beta','gamma','delta','epsilon','zeta','eta','theta','iota','kappa','lambda','mu','nu','xi','omicron','pi','rho','sigma','tau','upsilon','phi','chi','psi','omega'];
const greekReadings = ['阿尔法','贝塔','伽马','德尔塔','艾普西龙','泽塔','伊塔','西塔','约塔','卡帕','拉姆达','缪','纽','克西','奥密克戎','派','柔','西格玛','陶','宇普西龙','斐','希','普西','欧米伽'];
const commands = { ...Object.fromEntries(greekNames.map((n,i) => [n,greekReadings[i]])), varepsilon:'艾普西龙', varphi:'斐', vartheta:'西塔', varrho:'柔', partial:'偏导', nabla:'梯度', times:'乘以', cdot:'乘以', odot:'逐元素乘以', leq:'小于等于', le:'小于等于', geq:'大于等于', ge:'大于等于', neq:'不等于', ne:'不等于', approx:'约等于', equiv:'恒等于', infty:'无穷大', in:'属于', notin:'不属于', to:'趋于', rightarrow:'趋于', mapsto:'映射到', ldots:'省略号', cdots:'省略号', sin:'正弦', cos:'余弦', tan:'正切', log:'对数', ln:'自然对数', exp:'指数函数', max:'最大值', min:'最小值', det:'行列式' };
const unicode = Object.fromEntries([...'αβγδεζηθικλμνξοπρστυφχψω'].map((c,i) => [c,greekReadings[i]]));
Object.assign(unicode, { 'ϵ':commands.epsilon, 'ϕ':commands.phi, 'Ω':commands.omega, 'Σ':commands.sigma, 'Π':commands.pi, 'Δ':commands.delta, 'Γ':commands.gamma, 'Λ':commands.lambda, 'Θ':commands.theta, 'Ψ':commands.psi });
const symbols = { '=':'等于', '+':'加', '-':'减', '−':'减', '×':'乘以', '·':'乘以', '⊙':'逐元素乘以', '/':'除以', '÷':'除以', '<':'小于', '>':'大于', '≤':'小于等于', '≥':'大于等于', '≠':'不等于', '≈':'约等于', '∞':'无穷大', '∂':'偏导', '∇':'梯度', '∈':'属于', '→':'趋于', ...unicode };
const subDigits = { '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','ᵢ':'i','ⱼ':'j','ₖ':'k','ₙ':'n' };
const powers = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-' };
const spell = word => [...word].map(c => letters[c.toLowerCase().charCodeAt(0) - 97]).join('，');

export function speechText(text, clean = true, spellVariables = true, depth = 0, native = false) {
  if (!clean) return text;
  // Bound recursive work on malformed or adversarial model output.
  if (depth > 24) return '复杂公式';
  const source = String(text)
    .replace(/([A-Za-z])\s*(?:下划线|下标)\s*([A-Za-z0-9](?:\s*[A-Za-z0-9])*)/g, (_, base, index) => `${base}_{${index.replace(/\s/g, '')}}`)
    .replace(/```(?:latex|math)?\s*([\s\S]*?)```/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(^|\n)\s*#{1,6}\s+/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .replace(/[₀-₉ᵢⱼₖₙ]+/g, s => '_{' + [...s].map(c => subDigits[c]).join('') + '}')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, s => '^{' + [...s].map(c => powers[c]).join('') + '}')
    .replace(/∑/g, '\\sum ').replace(/∏/g, '\\prod ').replace(/∫/g, '\\int ').replace(/√/g, '\\sqrt ');
  let pos = 0, math = false;
  const out = [];
  const skip = () => { while (pos < source.length && /\s/.test(source[pos])) pos++; };
  const read = (raw, formula = true) => speechText(formula ? '$' + raw + '$' : raw, true, spellVariables, depth + 1, native);
  // Balanced arguments support nested fractions, radicals, and subscripts.
  const argument = () => {
    skip();
    if (source[pos] === '{' || source[pos] === '(') {
      const open = source[pos], close = open === '{' ? '}' : ')';
      const start = ++pos; let balance = 1;
      while (pos < source.length && balance) { const c = source[pos++]; if (c === open) balance++; if (c === close) balance--; }
      return source.slice(start, balance ? pos : pos - 1);
    }
    if (source[pos] === '\\') { const start = pos++; while (pos < source.length && /[A-Za-z]/.test(source[pos])) pos++; return source.slice(start, pos); }
    return source[pos++] || '';
  };
  while (pos < source.length) {
    const c = source[pos++];
    if (c === '\\') {
      const match = source.slice(pos).match(/^[A-Za-z]+/);
      if (!match) {
        const next = source[pos++];
        if (next === '(' || next === '[') math = true;
        else if (next === ')' || next === ']') math = false;
        else if (next === '\\') out.push('；');
        else if (!',;! '.includes(next || ' ')) out.push(next || '');
        continue;
      }
      const command = match[0]; pos += command.length; const name = command.toLowerCase();
      if (['left','right','displaystyle','textstyle','limits','nolimits'].includes(name)) continue;
      if (['frac','dfrac','tfrac'].includes(name)) {
        const numerator = argument(), denominator = argument();
        const top = numerator.match(/^\\partial\s+([\s\S]+)$/), bottom = denominator.match(/^\\partial\s+([\s\S]+)$/);
        if (top && bottom) out.push(`${read(top[1])}对${read(bottom[1])}的偏导数`);
        else out.push(`分数，分子是${read(numerator)}，分母是${read(denominator)}，分数结束`);
        continue;
      }
      if (name === 'sqrt') {
        skip(); let degree = '';
        if (source[pos] === '[') { pos++; const start = pos; while (pos < source.length && source[pos] !== ']') pos++; degree = source.slice(start, pos); if (source[pos] === ']') pos++; }
        out.push(`${degree ? read(degree) + '次方根' : '根号'}，${read(argument())}，根号结束`); continue;
      }
      if (['text','textrm','mathrm','mathbf','mathit','mathbb','operatorname','overline','underline','hat','bar','vec'].includes(name)) {
        const prefix = { overline:'上划线', underline:'', hat:'帽子符号', bar:'上划线', vec:'向量' }[name] || '';
        out.push(prefix + read(argument(), !['text','textrm','operatorname'].includes(name))); continue;
      }
      if (['sum','prod','int','lim'].includes(name)) {
        let lower = '', upper = ''; skip();
        for (let i = 0; i < 2 && ['_','^'].includes(source[pos]); i++) { const kind = source[pos++], value = argument(); if (kind === '_') lower = read(value); else upper = read(value); skip(); }
        out.push(`${{sum:'求和',prod:'连乘',int:'积分',lim:'求极限'}[name]}${lower ? '，下限为' + lower : ''}${upper ? '，上限为' + upper : ''}，`); continue;
      }
      if (['begin','end'].includes(name)) { const env = argument(); out.push(/matrix|array/.test(env) ? name === 'begin' ? '矩阵，' : '，矩阵结束' : ''); continue; }
      // Never hand unknown LaTeX command names to the voice engine as English prose.
      out.push(commands[name] ? '，' + commands[name] + '，' : '，'); continue;
    }
    if (c === '$') { math = !math; if (source[pos] === '$') pos++; continue; }
    if (c === '_') { const value = read(argument()); out.push(value ? (spellVariables ? '，' : '') + value : ''); continue; }
    if (c === '^') {
      skip();
      const unbracedNumber = source.slice(pos).match(/^[+-]?\d+(?:\.\d+)?/);
      const power = unbracedNumber ? (pos += unbracedNumber[0].length, unbracedNumber[0]) : argument().trim();
      out.push(power === '2' ? '的平方' : power === '3' ? '的立方' : ['T','\\top'].includes(power) ? '的转置' : power === '-1' ? '的负一次方' : '的' + read(power) + '次方'); continue;
    }
    if (/[A-Za-z]/.test(c)) {
      const rest = source.slice(pos).match(/^[A-Za-z]*/)[0], word = c + rest; pos += rest.length;
      const isVariable = math || word.length === 1 || /^[A-Z][ijkmn]{1,2}$/.test(word) || ['_','^'].includes(source[pos]);
      out.push(spellVariables && isVariable ? '，' + (native ? '\uE000' + [...word.toUpperCase()].join(', ') + '\uE001' : spell(word)) + '，' : word); continue;
    }
    if (c === '{' || c === '}') continue;
    if (c === '(' || c === ')') { out.push(c === '(' ? '，左括号，' : '，右括号，'); continue; }
    if (c === '&' || c === ',') { out.push('，'); continue; }
    out.push(symbols[c] ? '，' + symbols[c] + '，' : c);
  }
  return out.join('').replace(/\s+/g, ' ').replace(/\s*，\s*/g, '，').replace(/，+/g, '，').replace(/，的(?=平方|立方|转置|负一次方)/g, '的').replace(/，([。！？；])/g, '$1').replace(/^[，\s]+|[，\s]+$/g, '').trim();
}

// Keep the language boundary through formula parsing, including nested arguments.
// English voices pronounce letter names; Chinese phonetic substitutes are never used.
export function speechSegments(text, clean = true, spellVariables = true) {
  if (!clean) return [{ text: String(text), lang: 'zh-CN' }];
  const parsed = speechText(text, clean, spellVariables, 0, true);
  const parts = parsed.split(/(\uE000[^\uE001]*\uE001|[A-Za-z][A-Za-z\s,.'’-]*)/g);
  const segments = [];
  let previousWasLetter = false;
  for (const part of parts) {
    // A comma-separated string is still a single utterance to a TTS model.
    // Give every variable letter its own synthesis boundary so it cannot become a word.
    if (part.startsWith('\uE000')) {
      for (const letter of part.match(/[A-Z]/g) || []) segments.push({ text: letter, lang: 'en-US' });
      previousWasLetter = true;
      continue;
    }
    const english = /^[A-Za-z]/.test(part);
    const value = part.replace(/[\uE000\uE001]/g, '').trim();
    if (!value) continue;
    if (!/[\p{L}\p{N}]/u.test(value)) {
      if (segments.length) segments.at(-1).text += value;
      continue;
    }
    const lang = english ? 'en-US' : 'zh-CN';
    const previous = segments.at(-1);
    if (previous?.lang === lang && !previousWasLetter) previous.text += (/[\s，,。.!?;；]$/.test(previous.text) ? ' ' : lang === 'en-US' ? ', ' : '，') + value;
    else segments.push({ text: value, lang });
    previousWasLetter = false;
  }
  return segments.map(part => part.lang === 'en-US' ? { ...part, text: part.text.replace(/，/g, ', ').replace(/。/g, '. ').replace(/\s+/g, ' ').replace(/[,\s]+$/, '') } : part);
}
