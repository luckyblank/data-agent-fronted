<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({ modelValue: String, loading: Boolean, compact: Boolean })
const emit = defineEmits(['update:modelValue', 'send', 'stop', 'dictionary'])
const textarea = ref(null)
const canSend = computed(() => Boolean(props.modelValue?.trim()) && !props.loading)

function resize() {
  if (!textarea.value) return
  textarea.value.style.height = 'auto'
  textarea.value.style.height = `${Math.min(textarea.value.scrollHeight, 160)}px`
}

function onKeydown(event) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  if (canSend.value) emit('send')
}

watch(() => props.modelValue, async () => { await nextTick(); resize() })
defineExpose({ focus: () => textarea.value?.focus() })
</script>

<template>
  <form class="query-composer" :class="{ compact, 'is-loading': loading }" @submit.prevent="canSend && emit('send')">
    <div class="composer-input-row">
      <span v-if="!compact" class="composer-spark"><AppIcon name="spark" :size="23" /></span>
      <textarea ref="textarea" :value="modelValue" @input="emit('update:modelValue', $event.target.value)" @keydown="onKeydown" :rows="compact ? 1 : 2" aria-label="输入你的数据问题" :placeholder="compact ? '继续提出一个完整的数据问题…' : '描述你想了解的数据，例如：去年各地区的销售额是多少？'" :disabled="loading" />
    </div>
    <div class="composer-bottom">
      <button type="button" class="dataset-chip" @click="emit('dictionary')" title="查看当前数据集的字段说明"><AppIcon name="database" :size="14" /> 订单分析数仓 <AppIcon name="down" :size="12" /></button>
      <div class="composer-actions">
        <span class="keyboard-hint"><kbd>Enter</kbd> 发送 <span>·</span> <kbd>Shift + Enter</kbd> 换行</span>
        <button v-if="loading" type="button" class="send-button stop-button" @click="emit('stop')"><AppIcon name="stop" :size="15" /><span>停止接收</span></button>
        <button v-else type="submit" class="send-button" :disabled="!canSend"><span>{{ compact ? '发送' : '开始分析' }}</span><AppIcon name="send" :size="18" /></button>
      </div>
    </div>
  </form>
</template>
