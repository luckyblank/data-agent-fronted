<script setup>
import { computed, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import ResultPanel from './ResultPanel.vue'
import { nodeDescriptions } from '../data/workspace'

const props = defineProps({ turn: { type: Object, required: true }, loading: Boolean })
defineEmits(['retry', 'notify'])
const expanded = ref(props.turn.status === 'running')
const successfulSteps = computed(() => props.turn.steps.filter(step => step.status === 'success').length)
const runningSteps = computed(() => props.turn.steps.filter(step => step.status === 'running'))
const statusTitle = computed(() => ({ running: '正在分析你的问题', success: '已完成数据查询', error: '查询遇到了一点问题', stopped: '已停止接收结果' }[props.turn.status] || '查询记录'))

watch(() => props.turn.status, status => { if (status === 'success') expanded.value = false })
</script>

<template>
  <article class="query-turn">
    <div class="user-question"><span class="user-question-label">你</span><p>{{ turn.question }}</p></div>
    <div class="assistant-response">
      <div class="assistant-heading"><span class="assistant-avatar"><AppIcon name="spark" :size="17" /></span><span class="assistant-name">数智助手</span><span class="assistant-caption">让分析有据可循</span></div>
      <div class="response-body">
        <div class="response-status" :class="turn.status"><span v-if="turn.status === 'running'" class="spinner" /><AppIcon v-else :name="turn.status === 'success' ? 'check' : turn.status === 'error' ? 'warning' : 'stop'" :size="17" /><h3>{{ statusTitle }}</h3><span v-if="turn.duration" class="response-duration">{{ turn.duration.toFixed(1) }}s</span></div>

        <div class="execution-panel" :class="{ expanded }">
          <button class="execution-toggle" :aria-expanded="expanded" @click="expanded = !expanded"><span><AppIcon name="layers" :size="16" /><strong>执行过程</strong><span class="step-count">{{ successfulSteps }} 个节点已完成</span></span><span class="execution-toggle-right"><span v-if="runningSteps.length" class="running-label">{{ runningSteps.map(step => step.text).join(' · ') }}</span><AppIcon name="down" :size="15" /></span></button>
          <ol v-if="expanded && turn.steps.length" class="execution-steps">
            <li v-for="(step, index) in turn.steps" :key="step.text" :class="step.status"><span class="step-status"><span v-if="step.status === 'running'" class="spinner" /><AppIcon v-else-if="step.status === 'success'" name="check" :size="12" /><AppIcon v-else-if="step.status === 'error'" name="close" :size="12" /><span v-else>{{ index + 1 }}</span></span><div><span class="step-name">{{ step.text }}</span><p>{{ nodeDescriptions[step.text] || '处理当前查询任务' }}</p></div><span class="step-timing">{{ step.status === 'running' ? '处理中' : step.status === 'error' ? '失败' : step.status === 'stopped' ? '已中断' : step.duration ? step.duration.toFixed(1) + 's' : '完成' }}</span></li>
          </ol>
          <p v-else-if="expanded" class="waiting-message">正在连接问数服务，等待执行状态…</p>
        </div>

        <div v-if="turn.error" class="query-error" role="alert"><AppIcon name="warning" :size="19" /><div><strong>未能完成本次查询</strong><p>{{ turn.error }}</p><button class="text-button" :disabled="loading" @click="$emit('retry', turn.question)"><AppIcon name="refresh" :size="14" />重新查询</button></div></div>
        <p v-if="turn.status === 'stopped'" class="stopped-note">已关闭本次结果流。你可以修改问题后重新查询。</p>
        <ResultPanel v-if="turn.hasResult" :rows="turn.rows" :row-count="turn.rowCount" :question="turn.question" @notify="$emit('notify', $event)" />
        <div v-if="turn.status === 'running' && !turn.hasResult" class="analysis-loading"><span /><span /><span /><p>正在从业务数据中寻找答案</p></div>
        <p v-if="turn.status === 'success'" class="result-disclaimer"><AppIcon name="database" :size="13" />结果来自业务数仓，请结合业务口径核对。</p>
      </div>
    </div>
  </article>
</template>
