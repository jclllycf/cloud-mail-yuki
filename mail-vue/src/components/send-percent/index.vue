<template>
  <div class="percent">
    <LetterIcon name="loader" width="18" height="18" />
    <div>
      <span>{{value}}%</span>
      <span style="margin-left: 5px">{{desc}}</span>
    </div>
  </div>
</template>
<script setup>
import LetterIcon from "@/components/letter-icon.vue"

defineProps({
  value: [Number,String],
  desc: [String]
})
</script>

<style scoped lang="scss">
.percent {
  display: flex;
  gap: 10px;
}
</style>