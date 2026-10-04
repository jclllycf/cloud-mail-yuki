<template>
  <svg class="letter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-for="(path, index) in paths[name] || paths.mail" :key="index" :d="path" />
  </svg>
</template>
<script setup>
defineProps({ name: { type: String, default: 'mail' } })
const paths = {
  mail: ['M3 5h18v14H3z', 'm3 6 9 7 9-7'], inbox: ['M4 4h16l2 12v4H2v-4z', 'M2 16h6l2 3h4l2-3h6'],
  send: ['m3 3 19 9-19 9 4-9z', 'M7 12h15'], draft: ['M5 3h10l4 4v14H5z', 'M15 3v5h4', 'M8 12h8M8 16h5'],
  star: ['m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4L2.8 9.7l6.4-.9z'],
  settings: ['m9 3-1 3-3 1-2 3 2 2v3l3 2 1 4h6l1-4 3-2v-3l2-2-2-3-3-1-1-3z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  chart: ['M4 3v17h17', 'M8 15v-4M13 15V6M18 15V9'], users: ['M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M5 21v-3a7 7 0 0 1 14 0v3', 'M19 4a3 3 0 0 1 0 6M21 14a5 5 0 0 1 1 4'],
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4', 'M12 15v2'], ticket: ['M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4z', 'M15 5v3m0 3v2m0 3v3'],
  chevron: ['m8 10 4 4 4-4'], menu: ['M4 6h16M4 12h16M4 18h16'], close: ['m6 6 12 12M6 18 18 6'],
  plus: ['M12 5v14M5 12h14'], refresh: ['M20 7V3l-3 3a8 8 0 1 0 3 10', 'M20 7h-5'],
  delete: ['M4 7h16M9 7V3h6v4M6 7l1 14h10l1-14M10 11v6M14 11v6'], read: ['M3 9l9-6 9 6v12H3z', 'm3 9 9 7 9-7'],
  back: ['M20 12H4m6-6-6 6 6 6'], reply: ['m9 5-6 6 6 6', 'M3 11h10a8 8 0 0 1 8 8'], forward: ['m15 5 6 6-6 6', 'M21 11H11a8 8 0 0 0-8 8'],
  copy: ['M8 8h13v13H8z', 'M16 8V3H3v13h5'], more: ['M4 12h.01M12 12h.01M20 12h.01'],
  palette: ['M21 12a9 9 0 1 0-9 9c3 0 0-5 3-5h3a3 3 0 0 0 3-4z', 'M7 8h.01M12 6h.01M17 8h.01M6 13h.01'],
  notice: ['M3 10h4l13-5v14l-13-5H3z', 'm7 14 2 7h4l-2-6'], check: ['m5 12 4 4 10-10'],
  attachment: ['m8 14 7-7a3 3 0 0 1 4 4l-9 9a5 5 0 0 1-7-7l10-10'], eye: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  download: ['M12 3v12m-5-5 5 5 5-5', 'M4 16v5h16v-5'], compose: ['M4 15 16 3l5 5L9 20H4z', 'm13 6 5 5'], sort: ['M6 3v18m-3-3 3 3 3-3', 'M13 6h8M13 12h6M13 18h3']
}
</script>
