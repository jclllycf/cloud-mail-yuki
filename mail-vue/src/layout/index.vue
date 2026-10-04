<template>
  <el-container class="layout" :inert="uiStore.composing" @keydown="sidebarKeys">
    <el-aside ref="sidebarRef" class="aside" :class="uiStore.asideShow ? 'aside-show' : 'el-aside-hide'" :inert="!uiStore.asideShow" :aria-hidden="!uiStore.asideShow"><Aside /></el-aside>
    <div class="sidebar-scrim" v-if="uiStore.asideShow && isMobile" @click="uiStore.asideShow=false" />
    <el-container class="main-container" :class="{'letter-reader-workspace':route.meta.name==='content'}" :inert="uiStore.asideShow && isMobile">
      <el-main><el-header><Header /></el-header><Main /></el-main>
    </el-container>
  </el-container>
  <writer ref="writerRef" />
</template>
<script setup>
import Aside from '@/layout/aside/index.vue'
import Header from '@/layout/header/index.vue'
import Main from '@/layout/main/index.vue'
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import {useRoute} from 'vue-router'
import {useUiStore} from "@/store/ui.js";
import writer from '@/layout/write/index.vue'

const uiStore = useUiStore();
const route = useRoute();
const sidebarRef = ref(null);
let sidebarTrigger = null;
watch(() => uiStore.asideShow, async open => {
  if (!isMobile.value) return;
  if (open) { sidebarTrigger = document.activeElement; await nextTick(); sidebarRef.value?.$el?.querySelector('button')?.focus({preventScroll:true}); }
  else if (sidebarTrigger?.isConnected) sidebarTrigger.focus({preventScroll:true});
});
function sidebarKeys(event) {
  if (!uiStore.asideShow || !isMobile.value) return;
  if (event.key === 'Escape') { event.preventDefault(); uiStore.asideShow=false; }
  if (event.key !== 'Tab') return;
  const nodes = [...sidebarRef.value.$el.querySelectorAll('button:not([disabled]),a[href]')].filter(el=>el.getClientRects().length);
  const first=nodes[0], last=nodes.at(-1);
  if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
  if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
}
const writerRef = ref({})
const isMobile = ref(window.innerWidth < 1025)
const handleResize = () => {
  isMobile.value = window.innerWidth < 1025
  uiStore.asideShow = window.innerWidth > 1024;
}

onMounted(() => {
  uiStore.writerRef = writerRef

  window.addEventListener('resize', handleResize)
  handleResize()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>
<style scoped>
.layout {height:100dvh;position:fixed;width:100%;top:0;left:0;overflow:hidden;background:var(--letter-surface-work)}
.aside {width:256px; flex-shrink:0; transition:transform 220ms var(--letter-ease)}
.el-aside-hide {position:fixed;left:0;height:100%;z-index:101;transform:translateX(-100%)}
.aside-show {transform:translateX(0);z-index:101}
.main-container {height:100%;min-width:0;overflow:hidden}
.el-main {padding:0;overflow:hidden;position:relative}
.el-header {height:112px;padding:0;background:var(--letter-surface-work)}
.sidebar-scrim {position:fixed;inset:0;background:var(--letter-scrim);z-index:100}
.letter-reader-workspace .el-header {height:0;position:absolute;top:0;right:0;width:240px;z-index:2}
@media(max-width:1024px){.aside-show{position:fixed;top:0;left:0;height:100%}}
@media(max-width:760px){.el-header{height:124px}.letter-reader-workspace .el-header{width:108px;right:8px}}
</style>
