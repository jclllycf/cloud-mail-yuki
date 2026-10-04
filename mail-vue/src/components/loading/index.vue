<template>
  <LetterIcon name="loader" :width="size" :height="size" />
</template>

<script>
import LetterIcon from '@/components/letter-icon.vue'
export default {
  components: {LetterIcon},
  props: {
    size: {
      type: Number,
      default: 30
    }
  }
}
</script>
