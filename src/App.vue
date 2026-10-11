<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from './components/AppIcon.vue'
import QueryComposer from './components/QueryComposer.vue'
import QueryResponse from './components/QueryResponse.vue'
import { useWorkspace } from './composables/useWorkspace'
import { dictionary, scenarios } from './data/workspace'

const { activeSession, activeId, loading, notice, serviceState, recentSessions, newSession, openSession, toggleFavorite, deleteSession, sendQuestion, stopQuery, notify } = useWorkspace()
const view = ref('chat')
const question = ref('')
const sidebarOpen = ref(false)
const composer = ref(null)
const content = ref(null)
const guideDialog = ref(null)
const searchDialog = ref(null)
const searchInput = ref(null)
const historySearch = ref('')
const favoriteOnly = ref(false)
const selectedCategory = ref('全部场景')
const dictionarySearch = ref('')
const selectedTable = ref('fact_order')
const theme = ref(readTheme())
const navItems = [{ id: 'chat', label: '智能问数', icon: 'chat' }, { id: 'templates', label: '分析模板', icon: 'grid' }, { id: 'dictionary', label: '数据字典', icon: 'book' }]
const pageTitle = computed(() => navItems.find(item => item.id === view.value)?.label)
const categories = ['全部场景', '经营分析', '商品分析', '客户分析']
const templateList = computed(() => selectedCategory.value === '全部场景' ? scenarios : scenarios.filter(item => item.category === selectedCategory.value))
const visibleSessions = computed(() => recentSessions.value.filter(session => (!favoriteOnly.value || session.favorite) && session.title.toLowerCase().includes(historySearch.value.trim().toLowerCase())))
const filteredTables = computed(() => dictionary.filter(table => `${table.name} ${table.label} ${table.description} ${table.fields.map(field => field.name + field.label).join(' ')}`.toLowerCase().includes(dictionarySearch.value.trim().toLowerCase())))
const currentTable = computed(() => dictionary.find(table => table.name === selectedTable.value))
const serviceLabel = computed(() => ({ idle: '等待查询', connecting: '连接中', connected: '已连接', error: '连接异常' }[serviceState.value]))
const conversationCount = computed(() => recentSessions.value.length)
const todayLabel = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())
let scrollScheduled = false

function readTheme() {
  try { return localStorage.getItem('shuzhi-theme') === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}

watch(theme, value => {
  document.documentElement.dataset.theme = value
  try { localStorage.setItem('shuzhi-theme', value) } catch { /* Theme still works when storage is unavailable. */ }
}, { immediate: true })

function navigate(id) {
  view.value = id
  sidebarOpen.value = false
  nextTick(() => { if (content.value) content.value.scrollTop = 0 })
}

async function startNew() {
  newSession()
  question.value = ''
  navigate('chat')
  await nextTick()
  composer.value?.focus()
}

async function useTemplate(prompt) {
  question.value = prompt
  navigate('chat')
  await nextTick()
  composer.value?.focus()
}

function selectSession(id) {
  openSession(id)
  question.value = ''
  navigate('chat')
  searchDialog.value?.close()
}

async function submitQuestion(prompt = question.value) {
  if (!prompt.trim() || loading.value) return
  question.value = ''
  view.value = 'chat'
  await sendQuestion(prompt)
}

function scrollToLatest(force = false) {
  const el = content.value
  if (!el || view.value !== 'chat') return
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 190
  if (!force && !nearBottom) return
  if (scrollScheduled) return
  scrollScheduled = true
  nextTick(() => {
    if (content.value) content.value.scrollTop = content.value.scrollHeight
    scrollScheduled = false
  })
}

watch(() => activeSession.value?.turns.length, () => scrollToLatest(true))
watch(() => activeSession.value?.turns.map(turn => `${turn.steps.map(step => step.status).join(',')}:${turn.status}:${turn.rows.length}`).join('|'), () => scrollToLatest())

async function openSearch() {
  guideDialog.value?.close()
  historySearch.value = ''
  favoriteOnly.value = false
  searchDialog.value?.showModal()
  await nextTick()
  searchInput.value?.focus()
}

function onKeydown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    openSearch()
  }
  if (event.key === 'Escape') sidebarOpen.value = false
}

function closeBackdrop(event) {
  if (event.target !== event.currentTarget) return
  const rect = event.currentTarget.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close()
}

function sessionDate(timestamp) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(timestamp))
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="workspace-shell">
    <button v-if="sidebarOpen" class="sidebar-backdrop" aria-label="关闭导航菜单" @click="sidebarOpen = false" />
    <aside class="sidebar" :class="{ 'is-open': sidebarOpen }" aria-label="工作空间导航">
      <button class="brand" @click="navigate('chat')" aria-label="数智底座首页"><span class="brand-mark"><AppIcon name="layers" :size="25" /></span><span><strong>数智底座<span class="brand-dot">.</span></strong><small>DATA INTELLIGENCE</small></span></button>
      <button class="workspace-selector" @click="navigate('dictionary')"><span class="workspace-icon"><AppIcon name="database" :size="17" /></span><span><strong>业务数据空间</strong><small>订单分析数仓</small></span><AppIcon name="down" :size="14" /></button>
      <button class="new-query-button" @click="startNew"><AppIcon name="plus" :size="18" /><span>新建问数</span><span class="new-query-symbol">N</span></button>
      <div class="nav-section-label">工作空间</div>
      <nav class="main-nav"><button v-for="item in navItems" :key="item.id" :class="{ active: view === item.id }" :aria-current="view === item.id ? 'page' : undefined" @click="navigate(item.id)"><AppIcon :name="item.icon" :size="18" /><span>{{ item.label }}</span><span v-if="item.id === 'chat'" class="nav-active-dot" /><span v-if="item.id === 'templates'" class="nav-badge">{{ scenarios.length }}</span></button></nav>
      <div class="history-heading"><span class="nav-section-label">最近会话</span><button class="icon-button" @click="openSearch" aria-label="搜索历史会话" title="搜索会话 Ctrl + K"><AppIcon name="search" :size="15" /></button></div>
      <div class="sidebar-history"><div v-if="!recentSessions.length" class="history-empty"><AppIcon name="chat" :size="23" /><p>你的每一次探索<br />都会保存在这里</p></div><div v-for="session in recentSessions.slice(0, 8)" :key="session.id" class="history-row" :class="{ active: activeId === session.id && view === 'chat' }"><button class="history-item" @click="selectSession(session.id)"><AppIcon :name="session.favorite ? 'star' : 'chat'" :size="15" /><span :title="session.title">{{ session.title }}</span></button><button class="history-delete icon-button" @click="deleteSession(session.id)" :aria-label="`删除会话：${session.title}`"><AppIcon name="trash" :size="13" /></button></div><button v-if="recentSessions.length > 8" class="all-history-button" @click="openSearch">查看全部 {{ conversationCount }} 个会话<AppIcon name="chevron" :size="13" /></button></div>
      <div class="sidebar-footer"><div class="workspace-info"><span class="workspace-info-icon"><AppIcon name="link" :size="17" /></span><div><strong>连接数据，发现价值</strong><small>自然语言驱动的业务分析</small></div></div><button class="sidebar-help" @click="guideDialog.showModal()"><AppIcon name="help" :size="16" /><span>使用指南</span><AppIcon name="chevron" :size="13" /></button><div class="sidebar-local-note"><span class="tiny-dot" />会话保存在当前浏览器</div></div>
    </aside>

    <main class="workspace-main">
      <header class="topbar"><div class="breadcrumb"><button class="icon-button mobile-menu" @click="sidebarOpen = !sidebarOpen" :aria-expanded="sidebarOpen" aria-label="打开导航菜单"><AppIcon name="menu" /></button><AppIcon name="home" :size="16" class="breadcrumb-home" /><span class="breadcrumb-parent">工作空间</span><span class="breadcrumb-divider">/</span><strong>{{ pageTitle }}</strong></div><div class="topbar-actions"><span class="connection-status" :class="serviceState"><span class="tiny-dot" />{{ serviceLabel }}</span><span class="topbar-separator" /><button class="icon-button" @click="openSearch" aria-label="搜索会话" title="搜索会话（Ctrl + K）"><AppIcon name="search" :size="18" /></button><button class="icon-button" @click="theme = theme === 'light' ? 'dark' : 'light'" :aria-label="theme === 'light' ? '切换深色模式' : '切换浅色模式'" :title="theme === 'light' ? '深色模式' : '浅色模式'"><AppIcon :name="theme === 'light' ? 'moon' : 'sun'" :size="18" /></button><span class="topbar-avatar" aria-label="当前工作空间">数</span></div></header>
      <div ref="content" class="workspace-content" :class="{ 'has-conversation': view === 'chat' && activeSession, 'secondary-page': view !== 'chat' }">
        <template v-if="view === 'chat' && !activeSession">
          <div class="welcome-page">
            <div class="page-eyebrow"><span>你的数据分析工作台</span><span class="today-label">{{ todayLabel }}</span></div>
            <section class="welcome-hero"><div class="hero-kicker"><span class="tiny-dot" />从问题出发，让数据说话</div><h1>业务问题，<span>直接问。</span></h1><p class="hero-description">不必写 SQL，用一句话探索你的业务数据。<br class="mobile-line-break" />从经营全貌到增长细节，每一个答案都有迹可循。</p><QueryComposer ref="composer" v-model="question" :loading="loading" @send="submitQuestion()" @stop="stopQuery" @dictionary="navigate('dictionary')" /><div class="hero-capabilities"><span><AppIcon name="chat" :size="14" />自然语言提问</span><span><AppIcon name="layers" :size="14" />执行过程可追踪</span><span><AppIcon name="chart" :size="14" />结果可视化</span></div></section>
            <section class="scenario-section"><div class="section-heading"><div><h2>从一个业务场景开始</h2><p>常用分析，一句话就能开启。</p></div><button class="text-button" @click="navigate('templates')">全部模板<AppIcon name="arrow" :size="15" /></button></div><div class="scenario-grid"><button v-for="scenario in scenarios.slice(0, 4)" :key="scenario.id" class="scenario-card" :class="scenario.color" @click="useTemplate(scenario.question)"><div class="scenario-card-top"><span class="scenario-icon"><AppIcon :name="scenario.icon" :size="21" /></span><span class="scenario-tag">{{ scenario.tag }}</span></div><h3>{{ scenario.title }}</h3><p>{{ scenario.description }}</p><div class="scenario-question">{{ scenario.question }}</div><span class="scenario-card-bottom">试试这个问题<AppIcon name="arrow" :size="16" /></span></button></div></section>
            <section class="knowledge-strip"><span class="knowledge-strip-icon"><AppIcon name="database" :size="24" /></span><div><h3>理解业务语言，连接真实数据</h3><p>围绕订单、地区、商品、客户与时间，探索多维业务洞察。</p></div><button class="text-button" @click="navigate('dictionary')">查看数据字典<AppIcon name="chevron" :size="14" /></button></section>
            <footer class="welcome-footer"><span>数智底座</span><span class="footer-dot">·</span>让每一次提问，走向有依据的决策</footer>
          </div>
        </template>
        <template v-else-if="view === 'chat'">
          <div class="conversation-page"><div class="conversation-heading"><div><span class="page-kicker">数据探索 / {{ activeSession.turns.length }} 次查询</span><h1>{{ activeSession.title }}</h1></div><button class="icon-button favorite-button" :class="{ 'is-favorite': activeSession.favorite }" :aria-label="activeSession.favorite ? '取消收藏会话' : '收藏会话'" :aria-pressed="activeSession.favorite" @click="toggleFavorite(activeSession.id)"><AppIcon name="star" :size="19" /></button></div><QueryResponse v-for="turn in activeSession.turns" :key="turn.id" :turn="turn" :loading="loading" @retry="submitQuestion($event)" @notify="notify" /><div class="conversation-bottom" /></div>
        </template>
        <template v-else-if="view === 'templates'">
          <div class="secondary-container"><div class="secondary-heading"><span class="page-kicker">ANALYSIS LIBRARY</span><h1>让好问题，成为好习惯。</h1><p>为常见业务场景准备的分析起点，点击模板即可调整问题。</p></div><div class="category-tabs" aria-label="场景分类"><button v-for="category in categories" :key="category" :class="{ active: selectedCategory === category }" :aria-pressed="selectedCategory === category" @click="selectedCategory = category">{{ category }}</button></div><div class="template-grid"><button v-for="scenario in templateList" :key="scenario.id" class="scenario-card template-card" :class="scenario.color" @click="useTemplate(scenario.question)"><div class="scenario-card-top"><span class="scenario-icon"><AppIcon :name="scenario.icon" :size="22" /></span><span class="scenario-tag">{{ scenario.category }}</span></div><h3>{{ scenario.title }}</h3><p>{{ scenario.description }}</p><div class="scenario-question">{{ scenario.question }}</div><span class="scenario-card-bottom">使用模板<AppIcon name="arrow" :size="16" /></span></button></div><p class="template-footnote"><AppIcon name="help" :size="14" />模板依据当前订单数仓配置设计。请根据实际数据调整时间范围与筛选条件。</p></div>
        </template>
        <template v-else-if="view === 'dictionary'">
          <div class="secondary-container dictionary-page"><div class="secondary-heading"><span class="page-kicker">BUSINESS CONTEXT</span><h1>先懂业务，再问数据。</h1><p>了解可查询的业务范围，让每个问题都更准确。</p></div><div class="dictionary-notice"><AppIcon name="book" :size="18" /><span>当前展示后端元数据配置的参考字典，包含 <strong>1 张事实表、4 张维度表</strong>。实际查询以数据库及知识库状态为准。</span></div><div class="dictionary-layout"><div class="dictionary-index"><label class="dictionary-search"><AppIcon name="search" :size="16" /><input v-model="dictionarySearch" placeholder="搜索表或字段" aria-label="搜索数据字典" /></label><button v-for="table in filteredTables" :key="table.name" :class="{ active: selectedTable === table.name }" @click="selectedTable = table.name"><AppIcon :name="table.icon" :size="18" /><span><strong>{{ table.label }}</strong><code>{{ table.name }}</code></span><AppIcon name="chevron" :size="14" /></button><p v-if="!filteredTables.length" class="dictionary-no-results">未找到匹配的表或字段</p></div><section class="dictionary-details"><div class="dictionary-table-heading"><span class="scenario-icon teal"><AppIcon :name="currentTable.icon" :size="22" /></span><div><h2>{{ currentTable.label }}<span class="type-badge">{{ currentTable.type }}</span></h2><code>{{ currentTable.name }}</code></div></div><p class="dictionary-description">{{ currentTable.description }}</p><div class="dictionary-fields-scroll"><table class="dictionary-fields"><thead><tr><th>字段名称</th><th>业务说明 / 常用别名</th><th>字段角色</th></tr></thead><tbody><tr v-for="field in currentTable.fields" :key="field.name"><td><code>{{ field.name }}</code></td><td>{{ field.label }}</td><td><span class="field-role" :class="{ measure: field.role === '度量' }">{{ field.role }}</span></td></tr></tbody></table></div><div class="dictionary-tip"><AppIcon name="spark" :size="17" /><p>直接使用「销售额」「地区」「品类」等业务词汇提问，系统会匹配对应字段与真实取值。</p></div></section></div></div>
        </template>
      </div>
      <div v-if="view === 'chat' && activeSession" class="conversation-composer"><div><QueryComposer ref="composer" v-model="question" :loading="loading" compact @send="submitQuestion()" @stop="stopQuery" @dictionary="navigate('dictionary')" /><p>每次查询请包含完整的时间、指标与筛选条件。</p></div></div>
    </main>
    <Transition name="toast"><div v-if="notice" class="toast-message" role="status"><AppIcon name="check" :size="17" />{{ notice }}</div></Transition>
    <dialog ref="guideDialog" class="workspace-dialog guide-dialog" aria-labelledby="guide-title" @click="closeBackdrop"><div class="dialog-heading"><span class="dialog-icon"><AppIcon name="spark" :size="23" /></span><button class="icon-button" @click="guideDialog.close()" aria-label="关闭使用指南"><AppIcon name="close" /></button></div><span class="page-kicker">QUICK START</span><h2 id="guide-title">从一个好问题开始。</h2><p class="dialog-description">把业务需求说清楚，数智助手会完成检索、查询和结果展示。</p><ol class="guide-steps"><li><span>01</span><div><strong>说清时间、指标和维度</strong><p>例如「统计去年各地区的销售总额，按金额降序排列」。</p></div></li><li><span>02</span><div><strong>查看真实执行进度</strong><p>展开执行过程，查看字段、指标、取值召回，以及 SQL 生成、校验与执行状态。</p></div></li><li><span>03</span><div><strong>把结果变成业务洞察</strong><p>搜索和排序数据、切换图表，或导出 CSV 继续分析。</p></div></li></ol><div class="guide-note">每次提问独立执行，请提供完整条件。停止接收会关闭前端数据流，后端任务是否终止取决于服务实现。会话与结果保存在当前浏览器，历史结果最多保存 500 行。</div><button class="primary-button guide-start" @click="guideDialog.close(); startNew()">开始我的第一次探索<AppIcon name="arrow" :size="17" /></button></dialog>
    <dialog ref="searchDialog" class="workspace-dialog search-dialog" aria-labelledby="history-title" @click="closeBackdrop"><div class="search-dialog-heading"><h2 id="history-title">查找历史会话</h2><button class="icon-button" @click="searchDialog.close()" aria-label="关闭会话搜索"><AppIcon name="close" /></button></div><label class="history-search-input"><AppIcon name="search" :size="20" /><input ref="searchInput" v-model="historySearch" placeholder="输入问题关键词…" aria-label="搜索历史问题" /><kbd>ESC</kbd></label><div class="search-history-filter"><span>{{ visibleSessions.length }} 个会话</span><button :class="{ active: favoriteOnly }" @click="favoriteOnly = !favoriteOnly" :aria-pressed="favoriteOnly"><AppIcon name="star" :size="14" />只看收藏</button></div><div class="search-session-list"><button v-for="session in visibleSessions" :key="session.id" @click="selectSession(session.id)"><AppIcon :name="session.favorite ? 'star' : 'chat'" :size="18" /><span><strong>{{ session.title }}</strong><small>{{ session.turns.length }} 次查询 · {{ sessionDate(session.updatedAt) }}</small></span><AppIcon name="chevron" :size="16" /></button><div v-if="!visibleSessions.length" class="search-empty"><AppIcon name="search" :size="30" /><p>{{ conversationCount ? '没有找到匹配的会话' : '开始一次数据探索，建立你的第一条会话' }}</p></div></div></dialog>
  </div>
</template>
