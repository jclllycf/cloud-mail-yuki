<template>
  <header class="letter-header" :class="{'reader-utilities':route.meta.name==='content'}">
    <div class="heading-group">
      <button class="letter-button letter-icon-button menu-toggle" :aria-label="$t('letter.navigation')" :aria-expanded="uiStore.asideShow" @click="changeAside"><LetterIcon name="menu" /></button>
      <div class="page-heading" v-if="route.meta.name!=='content'"><h1>{{ $t(route.meta.title) }}</h1><p v-if="['email','send','star','draft'].includes(route.meta.name)">{{ accountStore.currentAccount.name || userStore.user.name }} · {{ accountStore.currentAccount.email || userStore.user.email }}</p></div>
    </div>
    <div class="header-utility">
      <button v-if="route.meta.name!=='content'" v-perm="'email:send'" class="letter-button primary compose-entry" @click="openSend"><LetterIcon name="compose" /><span>{{ $t('letter.compose') }}</span></button>
      <AppearancePicker />
      <button class="letter-button letter-icon-button" :aria-label="$t('letter.notices')" :title="$t('letter.notices')" @click="openNotice"><LetterIcon name="notice" /></button>
      <el-dropdown ref="userinfoRef" trigger="click" @visible-change="e => userInfoShow = e" popper-class="detail-dropdown">
        <button class="letter-button profile-entry" :aria-label="$t('profile')" :aria-expanded="userInfoShow"><span class="letter-identity">{{ formatName(userStore.user.email) }}</span><LetterIcon name="chevron" /></button>
        <template #dropdown>
          <div class="user-details">
            <div class="details-avatar">
              {{ formatName(userStore.user.email) }}
            </div>
            <div class="user-name">
              {{ userStore.user.name }}
            </div>
            <button class="detail-email" @click="copyEmail(userStore.user.email)">
              {{ userStore.user.email }}
            </button>
            <div class="detail-user-type">
              <el-tag>{{ userStore.user.role.name }}</el-tag>
            </div>
            <div class="action-info">
              <div>
                <span style="margin-right: 10px">{{ $t('sendCount') }}</span>
                <span style="margin-right: 10px">{{ $t('accountCount') }}</span>
              </div>
              <div>
                <div>
                  <span v-if="sendCount" style="margin-right: 5px">{{ sendCount }}</span>
                  <el-tag v-if="!hasPerm('email:send')">{{ sendType }}</el-tag>
                  <el-tag v-else>{{ sendType }}</el-tag>
                </div>
                <div>
                  <el-tag v-if="settingStore.settings.manyEmail || settingStore.settings.addEmail">
                    {{ $t('disabled') }}
                  </el-tag>
                  <span v-else-if="accountCount && hasPerm('account:add')"
                        style="margin-right: 5px">{{ $t('totalUserAccount', {msg: accountCount}) }}</span>
                  <el-tag v-else-if="!accountCount && hasPerm('account:add')">{{ $t('unlimited') }}</el-tag>
                  <el-tag v-else-if="!hasPerm('account:add')">{{ $t('unauthorized') }}</el-tag>
                </div>
              </div>
            </div>
            <div class="logout">
              <el-button type="primary" :loading="logoutLoading" @click="clickLogout">{{ $t('logOut') }}</el-button>
            </div>
          </div>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>
<script setup>
import router from "@/router";
import LetterIcon from '@/components/letter-icon.vue'
import AppearancePicker from '@/components/appearance-picker.vue'
import {useAccountStore} from '@/store/account.js'
import {logout} from "@/request/login.js";
import {Icon} from "@iconify/vue";
import {useUiStore} from "@/store/ui.js";
import {useUserStore} from "@/store/user.js";
import {useRoute} from "vue-router";
import {computed, ref} from "vue";
import {useSettingStore} from "@/store/setting.js";
import {hasPerm} from "@/perm/perm.js"
import {useI18n} from "vue-i18n";
import {setExtend} from "@/utils/day.js"

const {t} = useI18n();
const route = useRoute();
const settingStore = useSettingStore();
const userStore = useUserStore();
const uiStore = useUiStore();
const accountStore = useAccountStore();
const logoutLoading = ref(false)
const userInfoShow = ref(false)
const userinfoRef = ref({})

const accountCount = computed(() => {
  return userStore.user.role.accountCount
})

const sendType = computed(() => {

  if (settingStore.settings.send === 1) {
    return t('disabled')
  }

  if (!hasPerm('email:send')) {
    return t('unauthorized')
  }

  if (userStore.user.role.sendType === 'ban') {
    return t('sendBanned')
  }

  if (userStore.user.role.sendType === 'internal') {
    return t('sendInternal')
  }

  if (!userStore.user.role.sendCount) {
    return t('unlimited')
  }

  if (userStore.user.role.sendType === 'day') {
    return t('daily')
  }

  if (userStore.user.role.sendType === 'count') {
    return t('total')
  }
})

const sendCount = computed(() => {


  if (!hasPerm('email:send')) {
    return null
  }

  if (userStore.user.role.sendType === 'ban') {
    return null
  }

  if (userStore.user.role.sendType === 'internal') {
    return null
  }

  if (!userStore.user.role.sendCount) {
    return null
  }

  if (settingStore.settings.send === 1) {
    return null
  }

  return userStore.user.sendCount + '/' + userStore.user.role.sendCount
})

function userInfoHide(e) {
    if (userInfoShow.value) {
        userinfoRef.value.handleClose()
    } else {
        userinfoRef.value.handleOpen()
    }
}

async function copyEmail(email) {
  try {
    await navigator.clipboard.writeText(email);
    ElMessage({
      message: t('copySuccessMsg'),
      type: 'success',
      plain: true,
    })
  } catch (err) {
    console.error(`${t('copyFailMsg')}:`, err);
    ElMessage({
      message: t('copyFailMsg'),
      type: 'error',
      plain: true,
    })
  }
}

function changeLang(lang) {
  setExtend(lang === 'en' ? 'en' : 'zh-cn')
  settingStore.lang = lang
}

function openNotice() {
  uiStore.showNotice()
}

function openSend() {
  uiStore.writerRef.open()
}

function changeAside() {
  uiStore.asideShow = !uiStore.asideShow
}

function clickLogout() {
  logoutLoading.value = true
  logout().then(() => {
    localStorage.removeItem("token")
    router.replace('/login')
  }).finally(() => {
    logoutLoading.value = false
  })
}

function formatName(email) {
  return email[0]?.toUpperCase() || ''
}

</script>
<style scoped>
.letter-header { display:flex; justify-content:space-between; align-items:center; gap:20px; height:100%; padding:24px 32px; background:var(--letter-surface-work); }
.heading-group { display:flex; align-items:center; gap:12px; min-width:0; }
.page-heading { min-width:0; } h1 { font-size:28px; font-weight:600; letter-spacing:-.7px; line-height:1.25; } .page-heading p { margin-top:7px; font-size:12px; color:var(--letter-muted); overflow-wrap:anywhere; }
.header-utility { display:flex; align-items:center; gap:6px; flex-shrink:0; } .compose-entry { margin-right:16px; }
.profile-entry { padding:0 4px; } .profile-entry .letter-icon { width:15px; } .menu-toggle { display:none; }
.reader-utilities { padding:10px 24px; height:56px; } .reader-utilities .heading-group { display:none; } .reader-utilities .header-utility { margin-left:auto; }
.user-details { width:290px; padding:24px; display:flex; flex-direction:column; align-items:center; color:var(--letter-ink); gap:12px; }
.details-avatar { width:46px; height:46px; background:var(--letter-identity-bg); color:var(--letter-selected-ink); display:grid; place-items:center; border-radius:8px; font-size:20px; }
.user-name { font-size:18px; font-weight:600; } .detail-email { font-size:13px; color:var(--letter-muted); overflow-wrap:anywhere; }
.action-info { align-self:stretch; display:grid; grid-template-columns:1fr auto; padding-top:16px; border-top:1px solid var(--letter-line); font-size:12px; }
.action-info > div { display:flex; flex-direction:column; gap:12px; } .action-info > div:last-child > div { display:flex; align-items:center; min-height:24px; } .logout { width:100%; padding-top:12px; } .logout .el-button { width:100%; }
@media(max-width:1100px){ .letter-header{padding-inline:24px} .compose-entry{margin-right:4px} }
@media(max-width:1024px){.menu-toggle{display:flex}}
@media(max-width:760px){.letter-header{padding:18px 16px; gap:6px; align-items:flex-start} h1{font-size:24px} .page-heading p{font-size:11px; max-width:200px} .header-utility{gap:0; flex-wrap:wrap; justify-content:flex-end; max-width:152px} .compose-entry{order:4; margin:8px 0 0; width:100%; min-height:34px; padding:0 8px; font-size:12px} .profile-entry .letter-icon{display:none} .profile-entry .letter-identity{width:28px;height:28px} .reader-utilities{padding:0;height:56px} .reader-utilities .compose-entry{display:none}}
</style>
