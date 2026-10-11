/** Parse an SSE stream without assuming chunk boundaries match event boundaries. */
export async function readQueryStream(response, onEvent) {
  if (!response.ok) {
    throw new Error(`问数服务暂时不可用（HTTP ${response.status}），请检查后端服务后重试。`)
  }
  if (!response.body) throw new Error('服务器未返回数据流，请重试。')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  async function dispatch(block) {
    const data = block.split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).replace(/^ /, ''))
      .join('\n')
    if (!data || data === '[DONE]') return
    let event
    try {
      event = JSON.parse(data)
    } catch {
      throw new Error('服务返回的数据格式异常，请重新查询。')
    }
    if (event && typeof event === 'object') await onEvent(event)
  }

  async function drain() {
    let separator
    while ((separator = /\r?\n\r?\n/.exec(buffer))) {
      const block = buffer.slice(0, separator.index)
      buffer = buffer.slice(separator.index + separator[0].length)
      await dispatch(block)
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      await drain()
    }
    buffer += decoder.decode()
    await drain()
    if (buffer.trim()) await dispatch(buffer)
  } finally {
    // In case parsing fails, release the network stream as well as its lock.
    try { await reader.cancel() } catch { /* A failed/aborted stream is already closed. */ }
    reader.releaseLock()
  }
}
