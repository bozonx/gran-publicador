<script setup lang="ts">
const isSidebarOpen = ref(false)

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}

function closeSidebar() {
  isSidebarOpen.value = false
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
    <!-- Header -->
    <LayoutHeader @toggle-sidebar="toggleSidebar" />

    <div class="flex">
      <!-- Sidebar overlay (mobile) -->
      <Transition
        enter-active-class="transition-opacity duration-300"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-300"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isSidebarOpen"
          class="fixed inset-0 z-40 bg-black/50 lg:hidden"
          @click="closeSidebar"
        />
      </Transition>

      <!-- Sidebar -->
      <aside
        class="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto"
        :class="isSidebarOpen ? 'translate-x-0' : '-translate-x-full'"
      >
        <!-- Sidebar header (mobile close button) -->
        <div
          class="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800 lg:hidden"
        >
          <span class="text-lg font-semibold text-gray-900 dark:text-white">Menu</span>
          <UButton
            variant="ghost"
            color="neutral"
            icon="i-heroicons-x-mark"
            @click="closeSidebar"
          />
        </div>

        <!-- Navigation -->
        <div class="p-4 pt-4 lg:pt-6">
          <LayoutNavigation />
        </div>
      </aside>

      <!-- Main content -->
      <main class="flex-1 min-w-0">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <slot />
        </div>
      </main>
    </div>

    <!-- Global Modals -->
    <UiConfirmUnsavedChanges />
  </div>
</template>
