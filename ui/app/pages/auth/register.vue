<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  middleware: [
    function () {
      return navigateTo('/auth/login')
    },
  ],
})
</script>

<template>
  <div>Redirecting to login...</div>
</template>
