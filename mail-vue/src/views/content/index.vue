<template>
  <article class="box letter-reader" v-loading="loading">
    <div class="header-actions">
      <button class="letter-button reader-back" @click="handleBack"><LetterIcon name="back" /><span>{{ $t('letter.back') }}</span></button>
      <div class="reader-actions">
        <button class="letter-button" v-if="emailStore.contentData.showReply" v-perm="'email:send'" @click="openReply"><LetterIcon name="reply"/><span>{{ $t('reply') }}</span></button>
        <button class="letter-button" v-if="emailStore.contentData.showReply" v-perm="'email:send'" @click="openForward"><LetterIcon name="forward"/><span>{{ $t('forward') }}</span></button>
        <button class="letter-button letter-icon-button" v-if="emailStore.contentData.showStar" @click="changeStar" :aria-label="$t('star')" :aria-pressed="!!email.isStar"><LetterIcon name="star" /></button>
        <button class="letter-button letter-icon-button" v-perm="'email:delete'" @click="handleDelete" :aria-label="$t('delete')"><LetterIcon name="delete" /></button>
      </div>
    </div>
    <el-scrollbar class="scrollbar">
      <div class="container">
        <h1 class="email-title">{{ email.subject || $t('letter.noSubject') }}</h1>
        <div class="content">
          <div class="email-info">
            <div class="sender-metadata"><span class="letter-identity">{{ (email.name || email.sendEmail || '?')[0]?.toUpperCase() }}</span><div class="sender-name"><strong>{{ email.name }}</strong><span>{{ email.sendEmail }}</span></div><time class="date">{{ formatDetailDate(email.createTime) }}</time></div>
            <details class="recipient-metadata"><summary>{{ $t('recipient') }} · {{ formateReceive(email.recipient) }}</summary><p>{{ $t('from') }}: {{ email.name }} &lt;{{ email.sendEmail }}&gt;</p><p>{{ $t('recipient') }}: {{ formateReceive(email.recipient) }}</p><p>{{ formatDetailDate(email.createTime) }}</p></details>
            <el-alert v-if="email.status === 3" :closable="false" :title="toMessage(email.message)" class="email-msg" type="error" show-icon />
            <el-alert v-if="email.status === 4" :closable="false" :title="$t('complained')" class="email-msg" type="warning" show-icon />
            <el-alert v-if="email.status === 5" :closable="false" :title="$t('delayed')" class="email-msg" type="warning" show-icon />
          </div>
          <el-scrollbar class="htm-scrollbar" :class="!email.attList?.length ? 'bottom-distance' : ''">
            <ShadowHtml class="shadow-html" :html="formatImage(email.content)" v-if="email.content" />
            <pre v-else class="email-text">{{ email.text }}</pre>
          </el-scrollbar>
          <section class="att" v-if="email.attList?.length > 0">
            <div class="att-title"><strong>{{ $t('attachments') }}</strong><span>{{ $t('attCount',{total: email.attList.length}) }}</span></div>
            <div class="att-box"><div class="att-item" v-for="att in email.attList" :key="att.attId">
              <span class="att-icon"><LetterIcon v-bind="getIconByName(att.filename)" /></span><span class="att-name">{{ att.filename }}</span><span class="att-size">{{ formatBytes(att.size) }}</span>
              <div class="opt-icon"><button class="letter-button letter-icon-button" v-if="isImage(att.filename)" @click="showImage(att.key)" :aria-label="$t('preview')+' '+att.filename"><LetterIcon name="eye" /></button><a class="letter-button letter-icon-button" :href="cvtR2Url(att.key)" download :aria-label="$t('letter.download')+' '+att.filename"><LetterIcon name="download" /></a></div>
            </div></div>
          </section>
        </div>
      </div>
    </el-scrollbar>
    <el-image-viewer v-if="showPreview" :url-list="srcList" show-progress @close="showPreview=false" />
  </article>
</template>
<script setup>
import LetterIcon from "@/components/letter-icon.vue"
import ShadowHtml from '@/components/shadow-html/index.vue'
import {computed, reactive, ref, watch, onMounted, onUnmounted} from "vue";
import {useRouter, useRoute} from 'vue-router'
import {ElMessage, ElMessageBox} from 'element-plus'
import {emailDelete, emailRead, emailDetail} from "@/request/email.js";

import {useEmailStore} from "@/store/email.js";
import {useAccountStore} from "@/store/account.js";
import {formatDetailDate} from "@/utils/day.js";
import {starAdd, starCancel} from "@/request/star.js";
import {getExtName, formatBytes} from "@/utils/file-utils.js";
import {cvtR2Url,toOssDomain} from "@/utils/convert.js";
import {getIconByName} from "@/utils/icon-utils.js";
import {useSettingStore} from "@/store/setting.js";
import {allEmailDelete} from "@/request/all-email.js";
import {useUiStore} from "@/store/ui.js";
import {useI18n} from "vue-i18n";
import {EmailUnreadEnum} from "@/enums/email-enum.js";

const uiStore = useUiStore();
const settingStore = useSettingStore();
const accountStore = useAccountStore();
const emailStore = useEmailStore();
const router = useRouter()
const route = useRoute()
const loading = ref(false)
const email = computed(() => emailStore.contentData.email || {
  emailId: 0,
  attList: [],
  content: '',
  text: '',
  recipient: '[]',
})
const showPreview = ref(false)
const srcList = reactive([])

const { t } = useI18n()
let isDeepLinking = false

watch(() => accountStore.currentAccountId, () => {
  if (isDeepLinking) return
  handleBack()
})

async function loadDeepLinkEmail(emailId) {
  if (!emailId) return
  isDeepLinking = true
  loading.value = true
  try {
    const detail = await emailDetail(emailId)
    if (detail) {
      if (detail.accountId && detail.accountId !== accountStore.currentAccountId) {
        accountStore.currentAccountId = detail.accountId
      }
      emailStore.detailMap[detail.emailId] = detail
      emailStore.contentData.email = emailStore.toContentEmail(detail)
      emailStore.contentData.delType = 'logic'
      emailStore.contentData.showUnread = true
      emailStore.contentData.showStar = true
      emailStore.contentData.showReply = true
    }
  } catch (e) {
    console.error('Failed to load email by deep link:', e)
    ElMessage.error(t('emailNotFound') || 'Email not found or access denied')
  } finally {
    loading.value = false
    setTimeout(() => {
      isDeepLinking = false
    }, 300)
  }
}

watch(
  () => route.query.id,
  (newId) => {
    if (newId && String(emailStore.contentData.email?.emailId) !== String(newId)) {
      loadDeepLinkEmail(newId)
    }
  }
)

let readRequesting = false

function tryMarkRead() {
  if (!emailStore.contentData.showUnread || readRequesting) return
  const current = email.value
  if (!current?.emailId || current.unread !== EmailUnreadEnum.UNREAD) return

  // 等详情数据就绪（detailMap 已写入，或正文已有内容）再标已读
  const full = emailStore.detailMap[current.emailId]
  const detailReady = !!full || !!(current.content || current.text)
  if (!detailReady) return

  readRequesting = true
  const emailId = current.emailId
  current.unread = EmailUnreadEnum.READ
  if (emailStore.detailMap[emailId]) {
    emailStore.detailMap[emailId].unread = EmailUnreadEnum.READ
  }
  emailStore.markListRead(emailId)
  emailRead([emailId]).finally(() => {
    readRequesting = false
  })
}

watch(
  () => [
    email.value?.emailId,
    email.value?.content,
    email.value?.text,
    emailStore.detailMap[email.value?.emailId]
  ],
  () => tryMarkRead(),
  { flush: 'post' }
)

onMounted(async () => {
  const queryId = route.query.id
  if (queryId && (!emailStore.contentData.email || String(emailStore.contentData.email.emailId) !== String(queryId))) {
    await loadDeepLinkEmail(queryId)
  } else if (!queryId && !emailStore.contentData.email?.emailId) {
    router.replace('/inbox')
    return
  }
  tryMarkRead()
  window.addEventListener('keydown', handleKeyDown);
})

onUnmounted(() => {
  emailStore.contentData.showUnread = false;
  readRequesting = false
  window.removeEventListener('keydown', handleKeyDown);
})

function handleKeyDown(event) {
  if (event.key !== 'Escape') return;
  if (showPreview.value) return;
  if (document.querySelector('.el-message-box')) return;
  const writeBox = document.querySelector('.write-box');
  if (writeBox && writeBox.offsetParent !== null) return;
  handleBack();
}

function openReply() {
  uiStore.writerRef.openReply(email.value)
}

function openForward() {
  uiStore.writerRef.openForward(email.value)
}

function toMessage(message) {
  return  message ? JSON.parse(message).message : '';
}

function formatImage(content) {
  content = content || '';
  const domain = settingStore.settings.r2Domain;
  return  content.replace(/{{domain}}/g, toOssDomain(domain) + '/');
}

function showImage(key) {
  if (!isImage(key)) return;
  const url = cvtR2Url(key)
  srcList.length = 0
  srcList.push(url)
  showPreview.value = true
}

function isImage(filename) {
  return ['png', 'jpg', 'jpeg', 'bmp', 'gif','jfif'].includes(getExtName(filename))
}

function formateReceive(recipient) {
  if (!recipient) return ''
  recipient = JSON.parse(recipient)
  return recipient.map(item => item.address).join(', ')
}

function changeStar() {
  if (email.value.isStar) {
    email.value.isStar = 0;
    starCancel(email.value.emailId).then(() => {
      email.value.isStar = 0;
      emailStore.cancelStarEmailId = email.value.emailId
      setTimeout(() => emailStore.cancelStarEmailId = 0)
      emailStore.starScroll?.deleteEmail([email.value.emailId])
    }).catch((e) => {
      console.error(e)
      email.value.isStar = 1;
    })
  } else {
    email.value.isStar = 1;
    starAdd(email.value.emailId).then(() => {
      email.value.isStar = 1;
      emailStore.addStarEmailId = email.value.emailId
      setTimeout(() => emailStore.addStarEmailId = 0)
      emailStore.starScroll?.addItem(email.value)
    }).catch((e) => {
      console.error(e)
      email.value.isStar = 0;
    })
  }
}

const handleBack = () => {
  if (window.history.state && window.history.state.back) {
    router.back()
  } else {
    router.push('/inbox')
  }
}

const handleDelete = () => {
  ElMessageBox.confirm(t('delEmailConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    if (emailStore.contentData.delType === 'logic') {
      emailDelete(email.value.emailId).then(() => {
        ElMessage({
          message: t('delSuccessMsg'),
          type: 'success',
          plain: true,
        })
        emailStore.deleteIds = [email.value.emailId]
      })
    } else  {

      allEmailDelete(email.value.emailId).then(() => {
        ElMessage({
          message: t('delSuccessMsg'),
          type: 'success',
          plain: true,
        })
        emailStore.deleteIds = [email.value.emailId]
      })
    }

    router.back()
  })
}
</script>
<style scoped>
.box{height:100%;overflow:hidden;display:grid;grid-template-rows:56px minmax(0,1fr);background:var(--letter-surface-work)}
.header-actions{padding:0 270px 0 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--letter-line);font-size:13px}
.reader-actions{display:flex;align-items:center;gap:4px}.reader-actions [aria-pressed=true] .letter-icon{fill:var(--letter-accent)}
.scrollbar{height:100%;width:100%}.container{font-size:14px;background:var(--letter-surface-paper);border-inline:1px solid var(--letter-line);max-width:900px;min-height:100%;margin:auto;padding:48px 54px 64px}
.email-title{font-size:30px;font-weight:600;letter-spacing:-.6px;line-height:1.4;overflow-wrap:anywhere;max-width:780px;margin-bottom:26px}
.email-info{border-bottom:1px solid var(--letter-line);padding-bottom:24px;margin-bottom:32px}.sender-metadata{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.sender-name{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}.sender-name strong{font-size:14px}.sender-name span{font-size:12px;color:var(--letter-muted);overflow-wrap:anywhere}.date{font-size:11px;color:var(--letter-muted)}
.recipient-metadata{font-size:12px;color:var(--letter-muted);margin:14px 0 0 46px;overflow-wrap:anywhere}.recipient-metadata summary{cursor:pointer}.recipient-metadata p{margin:8px 0}.email-msg{margin-top:16px}
.email-text{font-family:inherit;white-space:pre-wrap;word-break:break-word;font-size:16px;line-height:1.85;max-width:720px;color:var(--letter-ink);margin:0}.shadow-html{background:transparent;color:var(--letter-ink);/* Sender surfaces are owned by the isolated HTML context. */}.htm-scrollbar{max-width:100%}.bottom-distance{margin-bottom:20px}
.att{margin-top:40px;padding-top:24px;border-top:1px solid var(--letter-line)}.att-title{display:flex;justify-content:space-between;font-size:13px;margin-bottom:12px}.att-title>span{color:var(--letter-muted);font-size:12px}.att-box{display:flex;flex-direction:column}.att-item{padding:10px 0;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--letter-line)}.att-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.att-size{font-size:11px;color:var(--letter-muted)}.opt-icon{display:flex;align-items:center;gap:2px}.opt-icon a{text-decoration:none}
@media(max-width:1100px){.container{padding:36px 32px}.header-actions{padding-left:16px;gap:4px}}
@media(max-width:760px){.header-actions{height:96px;flex-wrap:wrap;padding:0 120px 0 12px;position:relative;align-content:start}.reader-back{height:54px}.reader-actions{height:40px;position:absolute;left:12px;right:12px;bottom:1px;gap:6px}.reader-actions .letter-button{font-size:12px}.reader-actions .letter-icon-button:nth-last-child(2){margin-left:auto}.box{grid-template-rows:96px minmax(0,1fr)}.container{padding:30px 22px 44px;border:0}.email-title{font-size:25px;letter-spacing:-.4px;margin-bottom:24px;line-height:1.4}.date{display:block;width:100%;margin-left:46px;font-size:11px}.email-info{padding-bottom:22px;margin-bottom:28px}.email-text{font-size:15px;line-height:1.85}.recipient-metadata{margin-top:10px;font-size:11px}.att-item{gap:6px;flex-wrap:wrap}.att-name{font-size:12px}.att-size{font-size:10px}.opt-icon .letter-button{padding:6px;min-width:30px}.opt-icon .letter-icon{width:18px}}
</style>
