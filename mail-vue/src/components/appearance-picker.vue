<template>
  <div class="letter-appearance" v-if="inline">
    <h2>{{ $t('letter.appearance') }}</h2>
    <div class="theme-choices" role="group" :aria-label="$t('letter.appearance')">
      <button v-for="theme in themes" :key="theme.id" class="theme-choice" :aria-pressed="ui.theme === theme.id" @click="ui.setTheme(theme.id)">
        <span class="theme-swatch" aria-hidden="true" :style="{background: theme.colors.accent}" />
        <span>{{ theme.name }}</span><LetterIcon name="check" v-if="ui.theme === theme.id" />
      </button>
    </div>
  </div>
  <el-dropdown v-else trigger="click" @command="ui.setTheme" popper-class="letter-theme-dropdown">
    <button class="letter-button" :aria-label="$t('letter.appearance')"><LetterIcon name="palette" /><span class="appearance-label">{{ $t('letter.appearance') }}</span></button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item v-for="theme in themes" :key="theme.id" :command="theme.id" :class="{'theme-current': ui.theme === theme.id}">
          <span class="theme-swatch" aria-hidden="true" :style="{background: theme.colors.accent}" />
          <span>{{ theme.name }}</span><LetterIcon name="check" v-if="ui.theme === theme.id" />
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>
<script setup>
import {themes} from '@/theme/themes.js'
import {useUiStore} from '@/store/ui.js'
import LetterIcon from '@/components/letter-icon.vue'
defineProps({ inline: Boolean })
const ui = useUiStore()
</script>
<style>
.theme-swatch {display:inline-block; width:16px; height:16px; border-radius:50%; flex-shrink:0;}
.letter-theme-dropdown .el-dropdown-menu__item {display:flex; gap:10px; min-width:196px; padding:10px 12px;}
.letter-theme-dropdown .letter-icon, .theme-choice .letter-icon {margin-left:auto; width:18px; height:18px;}
.theme-current { font-weight: 600; background: var(--letter-surface-selected); color: var(--letter-selected-ink); }
.letter-appearance h2 { font-size: 20px; margin-bottom: 16px; }
.theme-choices { display: flex; gap: 12px; flex-wrap: wrap; }
.theme-choice {border:1px solid var(--letter-control-border); padding:12px; display:flex; align-items:center; gap:10px; border-radius:6px; background:var(--letter-surface-paper); min-width:188px;}
.theme-choice[aria-pressed=true] { border-color: var(--letter-accent); box-shadow: inset 0 0 0 1px var(--letter-accent); }
@media(max-width:760px) { .appearance-label { display:none; } .theme-choices { flex-direction:column; } }
</style>
