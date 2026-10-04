<template>
  <div class="content-box" ref="contentBox">
    <div ref="container" class="content-html"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  html: {
    type: String,
    required: true
  }
})

const container = ref(null)
const contentBox = ref(null)
let shadowRoot = null
let themeObserver = null

function updateContent() {
  if (!shadowRoot) return;

  // Keep the sender's body, attributes and styles intact. Body selectors in
  // author stylesheets work as well as inline styles (including single quotes).
  // innerHTML retains inert scripts; no author CSS is rewritten.
  let senderHtml = props.html;
  let senderBody = null;
  if (/<(?:html|body)\b/i.test(props.html)) {
    const parsedDocument = new DOMParser().parseFromString(props.html, 'text/html');
    senderHtml = [...parsedDocument.head.querySelectorAll('style')].map(style => style.outerHTML).join('');
    // HTML fragment parsing discards <body>. Create that node explicitly so
    // author selectors and attributes survive inside the shadow context.
    senderBody = document.createElement('body');
    for (const attribute of parsedDocument.body.attributes) senderBody.setAttribute(attribute.name, attribute.value);
    senderBody.innerHTML = parsedDocument.body.innerHTML;
  }
  shadowRoot.innerHTML = `
    <style>
      :host {
        all: initial;
        width: 100%;
        height: 100%;
        font-family: Inter, 'Helvetica Neue', Helvetica, 'PingFang SC',
                    'Hiragino Sans GB', 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: var(--letter-ink, inherit);
        word-break: break-word;
      }

      h1, h2, h3, h4 {
          font-size: 18px;
          font-weight: 700;
      }

      p {
        margin: 0;
      }

      a {
        text-decoration: none;
        color: var(--letter-information, #0E70DF);
      }

      .shadow-content {
        background: transparent;
        color: inherit;
        width: fit-content;
        height: fit-content;
        min-width: 100%;
      }

      :where(body) { margin: 0; }

      img:not(table img) {
        max-width: 100%;
        height: auto !important;
      }

    </style>
    <div class="shadow-content">
      ${senderHtml}
    </div>
  `;
  if (senderBody) shadowRoot.querySelector('.shadow-content').append(senderBody);
  keepSenderSurfaceReadable();
}

function keepSenderSurfaceReadable() {
  const content = shadowRoot.querySelector('.shadow-content');
  content.style.color = '';
  const body = content.querySelector('body');
  if (!body) return;
  // Explicit author ink always wins, including matching stylesheet declarations.
  const declaresInk = rules => [...rules].some(rule => {
    if (rule.style?.getPropertyValue('color')) {
      try { if (body.matches(rule.selectorText)) return true; } catch {}
    }
    return rule.cssRules ? declaresInk(rule.cssRules) : false;
  });
  if (body.style.getPropertyValue('color') || [...shadowRoot.querySelectorAll('style')].some(style => style.sheet && declaresInk(style.sheet.cssRules))) return;
  const channels = value => value.match(/[\d.]+/g)?.map(Number);
  const surface = channels(getComputedStyle(body).backgroundColor);
  if (!surface || surface.length < 3 || (surface.length === 4 && surface[3] !== 1)) return;
  const luminance = rgb => rgb.slice(0,3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((total,v,i) => total + v * [.2126,.7152,.0722][i],0);
  const ink = channels(getComputedStyle(content).color);
  const backgroundLuminance = luminance(surface);
  const inkLuminance = luminance(ink);
  const contrast = (Math.max(backgroundLuminance,inkLuminance) + .05) / (Math.min(backgroundLuminance,inkLuminance) + .05);
  if (contrast < 4.5) {
    // Only the inherited fallback on our wrapper changes; sender inline CSS is untouched.
    content.style.color = backgroundLuminance > .179 ? '#332e29' : '#f1e7dd';
  }
}

function autoScale() {
  if (!shadowRoot || !contentBox.value) return

  const parent = contentBox.value
  const shadowContent = shadowRoot.querySelector('.shadow-content')

  if (!shadowContent) return

  const parentWidth = parent.offsetWidth
  const childWidth = shadowContent.scrollWidth

  if (childWidth === 0) return

  const scale = parentWidth / childWidth

  const hostElement = shadowRoot.host
  hostElement.style.zoom = scale
}

onMounted(() => {
  shadowRoot = container.value.attachShadow({ mode: 'open' })
  updateContent()
  autoScale()
  themeObserver = new MutationObserver(keepSenderSurfaceReadable)
  themeObserver.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']})
})

onBeforeUnmount(() => themeObserver?.disconnect())

watch(() => props.html, () => {
  updateContent()
  autoScale()
})
</script>

<style scoped>
.content-box {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: Inter, "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif;
}

.content-html {
  width: 100%;
  height: 100%;
}
</style>
