import { defineStore } from 'pinia'
import {readTheme, applyTheme} from '@/theme/themes.js'

export const useUiStore = defineStore('ui', {
    state: () => ({
        asideShow: window.innerWidth > 1024,
        accountShow: false,
        composing: false,
        backgroundLoading: true,
        changeNotice: 0,
        writerRef: null,
        changePreview: 0,
        previewData: {},
        key: 0,
        theme: readTheme(),
        dark: readTheme() === 'cocoa',
        asideCount: {
            email: 0,
            send: 0,
            sysEmail: 0
        }
    }),
    actions: {
        setTheme(id) {
            this.theme = applyTheme(id, true)
            this.dark = this.theme === 'cocoa'
        },
        showNotice() {
            this.changeNotice ++
        },
        previewNotice(data) {
            this.previewData = data
            this.changePreview ++
        }
    },
    persist: {
        pick: [], // Appearance has its own validated, versioned storage key.
    },
})
