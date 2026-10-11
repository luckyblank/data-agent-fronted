import assert from 'node:assert/strict'
import test from 'node:test'
import { readQueryStream } from '../src/utils/queryStream.js'
import { createCsv, getColumns, numericColumns, numericValue } from '../src/utils/result.js'

function responseFrom(text, chunkSize = 1) {
  const bytes = new TextEncoder().encode(text)
  return new Response(new ReadableStream({ start(controller) {
    for (let offset = 0; offset < bytes.length; offset += chunkSize) controller.enqueue(bytes.slice(offset, offset + chunkSize))
    controller.close()
  } }), { headers: { 'Content-Type': 'text/event-stream' } })
}

test('SSE preserves Chinese characters across single-byte UTF-8 chunks', async () => {
  const expected = [{ type: 'progress', step: '召回字段取值', status: 'running' }, { type: 'result', data: [{ 地区: '华东', 销售额: '120.25' }] }]
  const received = []
  await readQueryStream(responseFrom(expected.map(event => `data: ${JSON.stringify(event)}\n\n`).join('')), event => received.push(event))
  assert.deepEqual(received, expected)
})

test('SSE handles CRLF, comments, multiline data, and an unterminated final event', async () => {
  const received = []
  await readQueryStream(responseFrom(': heartbeat\r\n\r\nevent: result\r\ndata: {"type":"result",\r\ndata: "data":[]}\r\n\r\ndata: {"type":"progress","step":"完成","status":"success"}', 3), event => received.push(event))
  assert.deepEqual(received, [{ type: 'result', data: [] }, { type: 'progress', step: '完成', status: 'success' }])
})

test('HTTP errors fail before parsing a non-SSE error response', async () => {
  await assert.rejects(readQueryStream(new Response('Bad Gateway', { status: 502 }), () => {}), /HTTP 502/)
})

test('malformed events produce an actionable error instead of disappearing', async () => {
  await assert.rejects(readQueryStream(responseFrom('data: {broken}\n\n'), () => {}), /数据格式异常/)
})

test('columns include fields absent from the first row', () => {
  assert.deepEqual(getColumns([{ 地区: '华东' }, { 地区: '华南', 金额: 5 }]), ['地区', '金额'])
})

test('numeric fields support MySQL decimal strings and reject empty, boolean, and mixed data', () => {
  const rows = [{ 销售额: '10.25', 备注: '10', 空值: '', 开关: true }, { 销售额: '-2.5', 备注: '未知', 空值: null, 开关: false }]
  assert.deepEqual(numericColumns(rows), ['销售额'])
  assert.equal(numericValue('1e3'), 1000)
  assert.equal(numericValue('  '), null)
  assert.equal(numericValue(false), null)
})

test('CSV preserves quotes, commas, line breaks and neutralizes text formulas', () => {
  const csv = createCsv([{ 名称: '=HYPERLINK("https://example.com")', 描述: 'a,b\nc', 金额: -5 }])
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.com"")"'))
  assert.ok(csv.includes('"a,b\nc"'))
  assert.ok(csv.includes('"-5"'))
})
