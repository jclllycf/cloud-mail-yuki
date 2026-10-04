<template>
  <button v-if="interactive" type="button" class="letter-glyph-action" v-bind="attrs" :aria-label="actionLabel" :title="attrs.title || actionLabel">
    <svg class="letter-icon" :class="{'letter-icon-spin': name === 'loader'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" :data-letter-icon="name" :data-missing-icon="!glyph || undefined" :style="sizeStyle" v-html="glyph?.body || ''" />
  </button>
  <svg v-else v-bind="attrs" class="letter-icon" :class="{'letter-icon-spin': name === 'loader'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" :data-letter-icon="name" :data-missing-icon="!glyph || undefined" :style="sizeStyle" v-html="glyph?.body || ''" />
</template>
<script setup>
import {computed, watchEffect, useAttrs} from 'vue'
import i18n from '@/i18n/index.js'
import registry from '@/assets/icons/warm-letter/registry.json'
defineOptions({inheritAttrs: false})
const props = defineProps({
  name: {type: String, required: true},
  width: [String, Number], height: [String, Number], color: String,
})
const glyph = computed(() => Object.hasOwn(registry, props.name) ? registry[props.name] : undefined)
const attrs = useAttrs()
// Element Plus service layers can mount without the page app context.
const locale = i18n.global.locale
const interactive = computed(() => !!attrs.onClick)
const actionLabels = {plus:['添加','Add'], search:['搜索','Search'], refresh:['刷新','Refresh'],
  'sort-up':['时间升序','Oldest first'], 'sort-down':['时间降序','Newest first'], delete:['删除','Delete']}
const actionLabel = computed(() => attrs['aria-label'] || actionLabels[props.name]?.[locale.value === 'zh' ? 0 : 1] || props.name)
const cssSize = value => typeof value === 'number' || /^\d+(\.\d+)?$/.test(value) ? `${value}px` : value
const sizeStyle = computed(() => ({width: cssSize(props.width), height: cssSize(props.height), color: props.color || undefined}))
watchEffect(() => {
  if (!glyph.value) {
    const message = `[Warm Letter] Unknown icon "${props.name}". Add an exact SVG to the local registry.`
    if (import.meta.env.DEV) throw new Error(message)
    console.error(message)
  }
})
</script>
<style>
.letter-icon {flex-shrink:0;vertical-align:middle}
.letter-glyph-action {display:inline-flex;align-items:center;justify-content:center;min-width:32px;min-height:32px;border-radius:5px;vertical-align:middle;flex-shrink:0}
.letter-glyph-action:hover {background:var(--letter-surface-hover)}
.letter-icon-spin {animation:letter-icon-spin 1s linear infinite}
@keyframes letter-icon-spin {to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce) {.letter-icon-spin {animation:none}}
</style>
