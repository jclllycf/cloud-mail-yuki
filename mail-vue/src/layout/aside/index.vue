<template>
  <aside class="letter-navigation" :aria-label="$t('letter.navigation')">
    <div class="letter-brand"><span class="brand-mark"><LetterIcon name="mail" /></span><div><strong>{{ settingStore.settings.title }}</strong><small>Warm Letter</small></div><button class="letter-button letter-icon-button sidebar-close" :aria-label="$t('letter.close')" @click="ui.asideShow=false"><LetterIcon name="close" /></button></div>
    <button class="letter-account-entry" @click="openAccount" :disabled="!canSwitch" :aria-label="$t('letter.accountSwitch')">
      <span class="letter-identity">{{ (account.currentAccount.name || account.currentAccount.email || user.user.email || 'Y')[0]?.toUpperCase() }}</span>
      <span class="account-label"><strong>{{ account.currentAccount.name || user.user.name }}</strong><small>{{ account.currentAccount.email || user.user.email }}</small></span><LetterIcon name="chevron" v-if="canSwitch" />
    </button>
    <div class="letter-scope" role="group" :aria-label="$t('letter.workspace')">
      <button :aria-pressed="!admin" @click="router.push({name:'email'})"><LetterIcon name="mail" />{{ $t('letter.mail') }}</button>
      <button v-perm="adminPerms" :aria-pressed="admin" @click="openAdmin"><LetterIcon name="chart" />{{ $t('manage') }}</button>
    </div>
    <nav class="letter-nav-list">
      <template v-if="!admin">
        <router-link v-for="item in mailLinks.filter(item=>!item.perm || hasPerm(item.perm))" :key="item.name" :to="{name:item.name}" class="letter-nav-link" :class="{current: route.meta.name === item.name || item.name === 'email' && route.meta.name === 'content'}" :aria-current="route.meta.name === item.name ? 'page' : undefined" >
          <LetterIcon :name="item.icon" /><span>{{ $t(item.label) }}</span>
        </router-link>
      </template>
      <template v-else>
        <router-link v-for="item in adminLinks" :key="item.name" :to="{name:item.name}" class="letter-nav-link" :class="{current:route.meta.name === item.name}" :aria-current="route.meta.name === item.name ? 'page' : undefined" v-perm="item.perm"><LetterIcon :name="item.icon" /><span>{{ $t(item.label) }}</span></router-link>
      </template>
    </nav>
    <div class="letter-nav-footer"><router-link :to="{name:'setting'}" class="letter-nav-link" :class="{current:route.meta.name === 'setting'}"><LetterIcon name="settings" /><span>{{ $t('settings') }}</span></router-link><p>{{ $t('letter.desk') }}</p></div>
  </aside>
</template>
<script setup>
import router from '@/router/index.js'
import {useRoute} from 'vue-router'
import {computed} from 'vue'
import {useSettingStore} from '@/store/setting.js'
import {useUiStore} from '@/store/ui.js'
import {useAccountStore} from '@/store/account.js'
import {useUserStore} from '@/store/user.js'
import {hasPerm} from '@/perm/perm.js'
import LetterIcon from '@/components/letter-icon.vue'
const settingStore=useSettingStore(), ui=useUiStore(), account=useAccountStore(), user=useUserStore(), route=useRoute()
const adminPerms=['all-email:query','user:query','role:query','setting:query','analysis:query','reg-key:query']
const adminLinks=[{name:'analysis',label:'analytics',icon:'chart',perm:'analysis:query'},{name:'user',label:'allUsers',icon:'users',perm:'user:query'},{name:'all-email',label:'allMail',icon:'inbox',perm:'all-email:query'},{name:'role',label:'permissions',icon:'lock',perm:'role:query'},{name:'reg-key',label:'inviteCode',icon:'ticket',perm:'reg-key:query'},{name:'sys-setting',label:'SystemSettings',icon:'settings',perm:'setting:query'}]
const mailLinks=[{name:'email',label:'inbox',icon:'inbox',perm:null},{name:'send',label:'sent',icon:'send',perm:'email:send'},{name:'draft',label:'drafts',icon:'draft',perm:'email:send'},{name:'star',label:'starred',icon:'star',perm:null}]
const admin=computed(()=>adminLinks.some(item=>item.name===route.meta.name))
const canSwitch=computed(()=>hasPerm('account:query') && settingStore.settings.manyEmail===0)
function openAccount(){if(canSwitch.value){ui.asideShow=window.innerWidth>1024;ui.accountShow=true}}
function openAdmin(){const first=adminLinks.find(item=>hasPerm(item.perm));if(first)router.push({name:first.name})}
</script>
<style scoped>
.letter-navigation { height:100%; display:flex; flex-direction:column; padding:28px 18px 18px; background:var(--letter-surface-nav); border-right:1px solid var(--letter-line); overflow:auto; }
.letter-brand { display:flex; align-items:center; gap:10px; margin:0 4px 30px; }
.brand-mark { width:35px; height:35px; display:grid; place-items:center; color:var(--letter-accent); border:1px solid var(--letter-control-border); border-radius:8px; }
.letter-brand strong { font-size:18px; letter-spacing:-.3px; }
.letter-brand small { display:block; font-size:11px; color:var(--letter-muted); letter-spacing:1px; }
.letter-account-entry { display:flex; align-items:center; gap:10px; width:100%; text-align:left; padding:12px 6px; margin-bottom:24px; border-block:1px solid var(--letter-line); }
.letter-account-entry:disabled { cursor:default; opacity:1; }
.account-label { flex:1; min-width:0; }.account-label strong { font-size:13px; display:block; }.account-label small { display:block; font-size:11px; color:var(--letter-muted); overflow-wrap:anywhere; margin-top:3px; }
.letter-scope { display:flex; gap:4px; margin-bottom:20px; background:var(--letter-surface-work); border:1px solid var(--letter-line); padding:4px; border-radius:6px; }
.letter-scope button { flex:1; display:flex; align-items:center; justify-content:center; gap:6px; min-height:32px; font-size:12px; border-radius:3px; transition:background 160ms; }
.letter-scope button[aria-pressed=true] { background:var(--letter-surface-selected); color:var(--letter-selected-ink); font-weight:600; }.letter-scope .letter-icon { width:16px; height:16px; }
.letter-nav-list { display:flex; flex-direction:column; gap:6px; }
.letter-nav-link { display:flex; align-items:center; gap:12px; text-decoration:none; color:var(--letter-ink); padding:11px 12px; min-height:44px; position:relative; border-radius:5px; transition:background 160ms, color 160ms; font-size:14px; }
.letter-nav-link:hover { background:var(--letter-surface-hover); }.letter-nav-link.current { background:var(--letter-surface-selected); color:var(--letter-selected-ink); font-weight:600; }.letter-nav-link.current::before { content:''; position:absolute; left:0; top:10px; bottom:10px; width:3px; background:var(--letter-accent); border-radius:2px; }.letter-nav-link.current .letter-icon { stroke-width:2; fill:color-mix(in srgb,var(--letter-accent) 12%,transparent); }
.letter-nav-footer { margin-top:auto; padding-top:32px; }.letter-nav-footer p { padding:18px 12px 0; font-size:11px; color:var(--letter-muted); }.sidebar-close { display:none; margin-left:auto; }
@media(max-width:1024px){.sidebar-close{display:flex}.letter-navigation{padding-top:22px}}
</style>
