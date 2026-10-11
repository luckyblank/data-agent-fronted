import { computed, onBeforeUnmount, ref } from 'vue'
import { readQueryStream } from '../utils/queryStream'

const STORAGE_KEY = 'shuzhi-conversations-v1'
const MAX_SESSIONS = 30
const MAX_SAVED_ROWS = 500

function readSessions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(saved)) return []
    return saved.filter(session => session && typeof session.id === 'string' && typeof session.title === 'string' && Number.isFinite(session.updatedAt) && Array.isArray(session.turns))
      .slice(0, MAX_SESSIONS)
      .map(session => ({
        ...session,
        turns: session.turns.filter(turn => turn && typeof turn.question === 'string').map(turn => ({
          ...turn,
          steps: Array.isArray(turn.steps) ? turn.steps.map(step => ({ ...step, status: step.status === 'running' ? 'stopped' : step.status })) : [],
          rows: Array.isArray(turn.rows) ? turn.rows : [],
          status: turn.status === 'running' ? 'stopped' : turn.status,
        })),
      }))
  } catch {
    return []
  }
}

export function useWorkspace() {
  const sessions = ref(readSessions())
  const activeId = ref(null)
  const loading = ref(false)
  const notice = ref('')
  const serviceState = ref('idle')
  const activeSession = computed(() => sessions.value.find(session => session.id === activeId.value) || null)
  const recentSessions = computed(() => [...sessions.value].sort((a, b) => b.updatedAt - a.updatedAt))
  let controller = null
  let noticeTimer
  let lastPersist = 0

  function notify(message) {
    notice.value = message
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => { notice.value = '' }, 4500)
  }

  function persist() {
    try {
      const snapshot = sessions.value.map(session => ({
        ...session,
        turns: session.turns.slice(-20).map(turn => ({ ...turn, rows: turn.rows.slice(0, MAX_SAVED_ROWS) })),
      }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
      lastPersist = Date.now()
    } catch {
      notify('浏览器未能保存会话，当前查询仍可正常使用。')
    }
  }

  function newSession() {
    activeId.value = null
  }

  function openSession(id) {
    activeId.value = id
  }

  function toggleFavorite(id) {
    const session = sessions.value.find(item => item.id === id)
    if (!session) return
    session.favorite = !session.favorite
    persist()
    notify(session.favorite ? '已收藏此会话' : '已取消收藏')
  }

  function deleteSession(id) {
    if (loading.value && controller?.sessionId === id) {
      notify('请先停止当前查询，再删除会话。')
      return
    }
    sessions.value = sessions.value.filter(session => session.id !== id)
    if (activeId.value === id) activeId.value = null
    persist()
    notify('已删除此会话')
  }

  function stopQuery() {
    controller?.abort()
  }

  async function sendQuestion(question) {
    const query = question.trim()
    if (!query || loading.value) return false

    let session = activeSession.value
    if (!session) {
      session = { id: crypto.randomUUID(), title: query, createdAt: Date.now(), updatedAt: Date.now(), favorite: false, turns: [] }
      sessions.value.unshift(session)
      sessions.value = sessions.value.slice(0, MAX_SESSIONS)
      activeId.value = session.id
      session = activeSession.value
    }

    const turnId = crypto.randomUUID()
    session.turns.push({ id: turnId, question: query, status: 'running', steps: [], rows: [], rowCount: 0, hasResult: false, error: '', createdAt: Date.now(), duration: 0 })
    // Use the reactive object rather than the original plain object inserted above.
    const turn = session.turns.find(item => item.id === turnId)
    session.updatedAt = Date.now()
    loading.value = true
    serviceState.value = 'connecting'
    const requestController = new AbortController()
    requestController.sessionId = session.id
    controller = requestController
    persist()
    const start = performance.now()

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ query }),
        signal: requestController.signal,
      })
      if (response.ok) serviceState.value = 'connected'
      await readQueryStream(response, event => {
        if (event.type === 'progress' && typeof event.step === 'string') {
          let step = turn.steps.find(item => item.text === event.step)
          if (!step) {
            turn.steps.push({ text: event.step, status: event.status, startedAt: performance.now(), duration: 0 })
            step = turn.steps[turn.steps.length - 1]
          } else {
            step.status = event.status
          }
          if (event.status !== 'running') step.duration = (performance.now() - step.startedAt) / 1000
        } else if (event.type === 'result') {
          if (!Array.isArray(event.data) || event.data.some(row => row === null || typeof row !== 'object' || Array.isArray(row))) {
            throw new Error('查询结果不是有效的数据表，请检查后端返回格式。')
          }
          turn.rows = event.data
          turn.rowCount = event.data.length
          turn.hasResult = true
        } else if (event.type === 'error') {
          turn.error = event.message || '查询未能完成，请调整问题后重试。'
        }
        turn.duration = (performance.now() - start) / 1000
        if (Date.now() - lastPersist > 1200) persist()
      })

      if (turn.error) turn.status = 'error'
      else if (turn.hasResult) turn.status = 'success'
      else throw new Error('连接已结束，但尚未收到查询结果，请重试。')
    } catch (error) {
      if (requestController.signal.aborted) {
        turn.status = 'stopped'
      } else {
        turn.status = 'error'
        turn.error = error instanceof TypeError ? '无法连接问数服务，请确认后端已启动后重试。' : error.message || '查询失败，请稍后重试。'
        serviceState.value = 'error'
      }
    } finally {
      turn.duration = (performance.now() - start) / 1000
      for (const step of turn.steps) {
        if (step.status === 'running') step.status = turn.status === 'error' ? 'error' : 'stopped'
      }
      session.updatedAt = Date.now()
      loading.value = false
      controller = null
      persist()
    }
    return true
  }

  onBeforeUnmount(() => {
    controller?.abort()
    clearTimeout(noticeTimer)
  })

  return { sessions, activeSession, activeId, loading, notice, serviceState, recentSessions, newSession, openSession, toggleFavorite, deleteSession, sendQuestion, stopQuery, notify }
}
