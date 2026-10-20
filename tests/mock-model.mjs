// Manual browser QA only. This fixture is never used as an application fallback.
import http from 'node:http';
http.createServer(async (req, res) => {
  let input = ''; for await (const chunk of req) input += chunk;
  const request = JSON.parse(input);
  const source = JSON.parse(typeof request.messages[1].content === 'string' ? request.messages[1].content : request.messages[1].content[0].text);
  const target = source.targets[1] || source.targets[0];
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
    beats: [{ speech: source.question ? '补充：先比较两个位置的变化。' : '请看课件中的这个重点。', actions: target ? [{ type: 'circle', targetId: target.id }] : [], board: source.question ? '测试补讲：两个点 → 平均变化率' : '测试板书：平均变化率 = Δy / Δx' }],
    ...(source.question ? {} : { quiz: { question: '测试：斜率描述什么？', options: ['变化率', '颜色'], answer: 0, explanation: '斜率表示纵向变化除以横向变化。' } }),
  }) } }] }));
}).listen(8870, '127.0.0.1', () => console.log('Browser QA mock provider: http://127.0.0.1:8870/v1'));
