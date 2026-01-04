<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage :key="route.path" />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
const route = useRoute()
</script>
