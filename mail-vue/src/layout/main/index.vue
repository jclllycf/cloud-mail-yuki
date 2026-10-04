<template>
  <div class="letter-main">
    <el-dialog :model-value="accountShow && hasPerm('account:query')" @update:model-value="uiStore.accountShow=$event" :title="$t('letter.accountSwitch')" width="560px" align-center class="letter-account-dialog">
      <account />
    </el-dialog>
    <router-view v-slot="{Component,route}">
      <Transition :css="false" @enter="motion.enter" @leave="motion.leave" @enter-cancelled="motion.cancel">
        <keep-alive :include="['email','all-email','send','sys-setting','star','user','role','analysis','reg-key','draft']">
          <component :is="Component" :key="route.name" class="main-view" />
        </keep-alive>
      </Transition>
    </router-view>
  </div>
</template>
<script setup>
import account from '@/layout/account/index.vue'
import {useLetterMotion} from '@/theme/motion.js'
import {useUiStore} from "@/store/ui.js";
import {useSettingStore} from "@/store/setting.js";
import {computed, onBeforeUnmount, onMounted, watch} from "vue";
import { useRoute } from 'vue-router'
import { hasPerm } from "@/perm/perm.js"

const settingStore = useSettingStore()
const uiStore = useUiStore();
const route = useRoute()
const motion = useLetterMotion(route)
let  innerWidth =  window.innerWidth

let elNotification = null

const accountShow = computed(() => {
  return uiStore.accountShow && settingStore.settings.manyEmail === 0
})

watch(() => uiStore.changeNotice, () => {

  const settings = settingStore.settings

  let data = {
    notice: settings.notice,
    noticeWidth: settings.noticeWidth,
    noticeTitle: settings.noticeTitle,
    noticeContent: settings.noticeContent,
    noticeType: settings.noticeType,
    noticeDuration: settings.noticeDuration,
    noticePosition: settings.noticePosition,
    noticeOffset: settings.noticeOffset
  }

  showNotice(data)
})

watch(() => uiStore.changePreview, () => {
  showNotice(uiStore.previewData)
})

function showNotice(data) {

  if (data.notice === 1) {
    return;
  }

  if (elNotification) {
    elNotification.close()
  }

  const style = document.createElement('style');
  style.innerHTML = `
  .custom-notice.el-notification {
    --el-notification-width: min(${data.noticeWidth}px,calc(100% - 30px)) !important;
  }
  `;

  document.head.appendChild(style);

  elNotification = ElNotification({
    title: data.noticeTitle,
    message: `<div style="width: 100%;height: 100%;">${data.noticeContent}</div>`,
    type: data.noticeType === 'none' ? '' : data.noticeType,
    duration: data.noticeDuration,
    position: data.noticePosition,
    offset: data.noticeOffset,
    dangerouslyUseHTMLString: true,
    customClass: 'custom-notice'
  })
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  handleResize()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

const handleResize = () => {
  if (['content','email','send'].includes(route.meta.name)) {
    if (innerWidth !==  window.innerWidth) {
      innerWidth = window.innerWidth;
      uiStore.accountShow = false;
    }
  }
}

</script>
<style scoped>
.letter-main { height:calc(100% - 112px); min-height:0; position:relative; overflow:hidden; }
.main-view { background:var(--letter-surface-work); }
@media(max-width:760px){ .letter-main{height:calc(100% - 124px)} }
</style>
<style>
.letter-account-dialog .account-box { height:min(560px,65dvh); }
.letter-account-dialog .el-dialog__body { padding-top:6px; }
.letter-reader-workspace .letter-main { height:100%; }
</style>
