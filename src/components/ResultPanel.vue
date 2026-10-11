<script setup>
import { computed, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import { createCsv, formatCell, formatNumber, getColumns, numericColumns, numericValue } from '../utils/result'

const props = defineProps({ rows: { type: Array, default: () => [] }, rowCount: Number, question: String })
const emit = defineEmits(['notify'])
const activeTab = ref('table')
const search = ref('')
const sortColumn = ref('')
const sortDirection = ref(1)
const page = ref(1)
const pageSize = ref(10)
const chartType = ref('bar')
const labelColumn = ref('')
const valueColumn = ref('')
const columns = computed(() => getColumns(props.rows))
const measures = computed(() => numericColumns(props.rows, columns.value))
const processedRows = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  const result = keyword ? props.rows.filter(row => columns.value.some(column => formatCell(row[column]).toLowerCase().includes(keyword))) : [...props.rows]
  if (sortColumn.value) {
    const column = sortColumn.value
    const numeric = measures.value.includes(column)
    result.sort((a, b) => {
      if (a[column] == null && b[column] == null) return 0
      if (a[column] == null) return 1
      if (b[column] == null) return -1
      if (numeric) {
        if (numericValue(a[column]) === null && numericValue(b[column]) === null) return 0
        if (numericValue(a[column]) === null) return 1
        if (numericValue(b[column]) === null) return -1
      }
      const comparison = numeric ? numericValue(a[column]) - numericValue(b[column]) : formatCell(a[column]).localeCompare(formatCell(b[column]), 'zh-CN', { numeric: true })
      return comparison * sortDirection.value
    })
  }
  return result
})
const pageCount = computed(() => Math.max(1, Math.ceil(processedRows.value.length / pageSize.value)))
const pagedRows = computed(() => processedRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
const chartRows = computed(() => processedRows.value.filter(row => numericValue(row[valueColumn.value]) !== null).slice(0, 24))

watch([columns, measures], () => {
  labelColumn.value = columns.value.find(column => !measures.value.includes(column)) || columns.value.find(column => /year|month|date|年|月|日期/i.test(column)) || ''
  valueColumn.value = measures.value.find(column => column !== labelColumn.value && /amount|total|sales|count|quantity|gmv|销售|数量|总|金额/i.test(column)) || measures.value.find(column => column !== labelColumn.value) || measures.value[0] || ''
}, { immediate: true })
watch([search, pageSize, sortColumn, sortDirection], () => { page.value = 1 })

function sortBy(column) {
  if (sortColumn.value === column) sortDirection.value *= -1
  else { sortColumn.value = column; sortDirection.value = 1 }
}

function exportCsv() {
  const blob = new Blob([createCsv(processedRows.value, columns.value)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `数智底座_查询结果_${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  emit('notify', `已导出 ${processedRows.value.length} 条数据`)
}

const chart = computed(() => {
  const left = 78, right = 740, top = 24, bottom = 226
  const values = chartRows.value.map(row => numericValue(row[valueColumn.value]))
  const low = Math.min(0, ...values), high = Math.max(0, ...values)
  const span = high - low || 1
  const min = low < 0 ? low - span * 0.12 : 0
  const max = high > 0 ? high + span * 0.12 : (low === 0 ? 1 : 0)
  const scale = value => bottom - (value - min) / (max - min) * (bottom - top)
  const slot = (right - left) / Math.max(values.length, 1)
  const points = values.map((value, index) => ({
    x: left + slot * (index + 0.5), y: scale(value), value,
    label: labelColumn.value ? formatCell(chartRows.value[index][labelColumn.value]) : String(index + 1),
  }))
  return { left, right, top, bottom, zero: scale(0), barWidth: Math.max(3, Math.min(54, slot * 0.58)), points, line: points.map(point => `${point.x},${point.y}`).join(' '), ticks: Array.from({ length: 5 }, (_, index) => { const value = min + (max - min) * index / 4; return { value, y: scale(value) } }) }
})
</script>

<template>
  <section class="result-panel" aria-label="查询结果">
    <div class="result-heading">
      <div class="result-title"><span class="result-check"><AppIcon name="check" :size="15" /></span><h3>查询结果</h3><span class="result-count">{{ rowCount ?? rows.length }} 条数据</span></div>
      <button class="text-button export-button" :disabled="!processedRows.length" @click="exportCsv" title="导出当前筛选和排序后的全部数据"><AppIcon name="download" :size="16" />导出 CSV</button>
    </div>

    <div v-if="!rows.length" class="result-empty">
      <span class="empty-illustration"><AppIcon name="search" :size="28" /></span>
      <h4>这次查询没有匹配到数据</h4>
      <p>试试调整时间范围、地区或商品条件，再发起一次查询。</p>
    </div>

    <template v-else>
      <div v-if="rowCount > rows.length" class="saved-result-note"><AppIcon name="help" :size="15" />此历史会话保留了前 {{ rows.length }} 行数据，重新查询可获取完整结果。</div>
      <div class="result-toolbar">
        <div class="segmented-control" aria-label="结果展示方式">
          <button :class="{ active: activeTab === 'table' }" :aria-pressed="activeTab === 'table'" @click="activeTab = 'table'"><AppIcon name="table" :size="15" />数据表格</button>
          <button :class="{ active: activeTab === 'chart' }" :aria-pressed="activeTab === 'chart'" :disabled="!measures.length" :title="measures.length ? '根据查询结果生成图表' : '结果中没有可绘制的数值字段'" @click="activeTab = 'chart'"><AppIcon name="chart" :size="15" />可视化</button>
        </div>
        <label class="result-search"><AppIcon name="search" :size="15" /><input v-model="search" aria-label="筛选查询结果" placeholder="搜索结果…" /></label>
      </div>

      <template v-if="activeTab === 'table'">
        <div class="result-table-scroll" tabindex="0" aria-label="查询数据表，可横向滚动">
          <table class="result-table">
            <thead><tr><th class="row-index">#</th><th v-for="column in columns" :key="column" :class="{ numeric: measures.includes(column) }" :aria-sort="sortColumn === column ? (sortDirection === 1 ? 'ascending' : 'descending') : 'none'"><button @click="sortBy(column)">{{ column }}<AppIcon name="down" :size="12" :class="{ 'sort-ascending': sortColumn === column && sortDirection === 1, 'sort-active': sortColumn === column }" /></button></th></tr></thead>
            <tbody><tr v-for="(row, index) in pagedRows" :key="index"><td class="row-index">{{ (page - 1) * pageSize + index + 1 }}</td><td v-for="column in columns" :key="column" :class="{ numeric: measures.includes(column), 'null-cell': row[column] == null }">{{ formatCell(row[column]) }}</td></tr></tbody>
          </table>
          <div v-if="!processedRows.length" class="filter-empty">没有包含「{{ search }}」的结果</div>
        </div>
        <div class="table-footer">
          <span>{{ processedRows.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, processedRows.length)}` : '0' }} / {{ processedRows.length }} 条<span class="field-count"> · {{ columns.length }} 个字段</span></span>
          <div class="pagination"><select v-model.number="pageSize" aria-label="每页显示条数"><option :value="10">10 条 / 页</option><option :value="20">20 条 / 页</option><option :value="50">50 条 / 页</option></select><button class="icon-button" :disabled="page <= 1" @click="page--" aria-label="上一页"><AppIcon name="chevron" :size="15" class="rotate-180" /></button><span>{{ page }} / {{ pageCount }}</span><button class="icon-button" :disabled="page >= pageCount" @click="page++" aria-label="下一页"><AppIcon name="chevron" :size="15" /></button></div>
        </div>
      </template>

      <div v-else class="chart-panel">
        <div class="chart-controls">
          <div class="chart-selects"><label>维度<select v-model="labelColumn"><option value="">行序号</option><option v-for="column in columns" :key="column" :value="column">{{ column }}</option></select></label><label>数值<select v-model="valueColumn"><option v-for="column in measures" :key="column" :value="column">{{ column }}</option></select></label></div>
          <div class="segmented-control chart-type"><button :class="{ active: chartType === 'bar' }" :aria-pressed="chartType === 'bar'" @click="chartType = 'bar'">柱状图</button><button :class="{ active: chartType === 'line' }" :aria-pressed="chartType === 'line'" @click="chartType = 'line'">折线图</button></div>
        </div>
        <div v-if="chartRows.length" class="chart-scroll">
          <svg viewBox="0 0 760 276" class="data-chart" role="img" :aria-label="`${valueColumn}的${chartType === 'bar' ? '柱状' : '折线'}图，共 ${chartRows.length} 条数据`">
            <g v-for="(tick, index) in chart.ticks" :key="index"><line :x1="chart.left" :x2="chart.right" :y1="tick.y" :y2="tick.y" class="chart-grid" /><text :x="chart.left - 12" :y="tick.y + 4" text-anchor="end" class="chart-axis-label">{{ formatNumber(tick.value) }}</text></g>
            <line :x1="chart.left" :x2="chart.right" :y1="chart.zero" :y2="chart.zero" class="chart-baseline" />
            <polyline v-if="chartType === 'line'" :points="chart.line" fill="none" class="chart-line" stroke-width="2.5" />
            <g v-for="(point, index) in chart.points" :key="index">
              <rect v-if="chartType === 'bar'" :x="point.x - chart.barWidth / 2" :y="Math.min(point.y, chart.zero)" :width="chart.barWidth" :height="Math.max(1, Math.abs(chart.zero - point.y))" rx="3" class="chart-bar" tabindex="0"><title>{{ point.label }}：{{ formatCell(point.value) }}</title></rect>
              <circle v-else :cx="point.x" :cy="point.y" r="4" class="chart-point" tabindex="0"><title>{{ point.label }}：{{ formatCell(point.value) }}</title></circle>
              <text v-if="chart.points.length <= 12 || index % Math.ceil(chart.points.length / 10) === 0" :x="point.x" y="252" text-anchor="middle" class="chart-axis-label">{{ point.label.length > 9 ? point.label.slice(0, 8) + '…' : point.label }}<title>{{ point.label }}</title></text>
            </g>
          </svg>
        </div>
        <div v-else class="filter-empty">当前筛选没有可绘制的数值数据</div>
        <p class="chart-note">图表基于查询结果绘制，按当前排序展示前 {{ chartRows.length }} 条有效数据（最多 24 条）。完整数据可在表格中查看或导出。</p>
      </div>
    </template>
  </section>
</template>
