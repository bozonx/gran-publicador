<script setup lang="ts">
import ContentLibraryManager from '~/components/content/ContentLibraryManager.vue'

definePageMeta({
  middleware: 'auth',
})
</script>

<template>
  <div class="p-6">
    <ContentLibraryManager scope="personal" />
  </div>
</template>
