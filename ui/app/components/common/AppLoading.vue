<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="fixed inset-0 z-100 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 transition-colors duration-500 overflow-hidden">

    <!-- Animated background accents -->
    <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/10 blur-[120px] rounded-full animate-pulse"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full animate-pulse [animation-delay:1s]"></div>

    <div class="relative flex flex-col items-center">
      <div class="relative w-24 h-24 mb-8">
        <!-- Spinner layers -->
        <div class="absolute inset-0 rounded-3xl bg-white dark:bg-gray-900 shadow-xl border border-gray-100 dark:border-gray-800 rotate-12 animate-[spin_10s_linear_infinite]"></div>
        <div class="absolute inset-0 rounded-3xl bg-white dark:bg-gray-900 shadow-lg border border-gray-200 dark:border-gray-800 -rotate-12 animate-[spin_8s_linear_infinite_reverse]"></div>
        
        <!-- Center Logo Container -->
        <div class="absolute inset-0 flex items-center justify-center rounded-3xl bg-white dark:bg-gray-900 shadow-2xl z-10 border border-gray-100 dark:border-gray-800">
          <UIcon name="i-heroicons-paper-airplane" class="w-10 h-10 text-primary-500 animate-bounce" />
        </div>

        <!-- Outer Progress Circle -->
        <div class="absolute -inset-4 border-2 border-primary-500/20 rounded-full"></div>
        <div class="absolute -inset-4 border-2 border-transparent border-t-primary-500 rounded-full animate-spin [animation-duration:1.5s]"></div>
      </div>
      
      <div class="flex flex-col items-center gap-3">
        <h2 class="text-2xl font-black tracking-tighter text-gray-900 dark:text-white uppercase">
          Gran Publicador
        </h2>
        <div class="flex items-center gap-2">
          <div class="flex gap-1">
            <div class="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce [animation-delay:0.1s]"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce [animation-delay:0.3s]"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce [animation-delay:0.5s]"></div>
          </div>
          <span class="text-xs font-bold text-gray-400 dark:text-gray-500 tracking-widest uppercase">
            {{ t('common.loading') }}
          </span>
        </div>
      </div>
    </div>

    <!-- Bottom brand line -->
    <div class="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-2 opacity-40">
        <span class="text-[10px] tracking-[0.4em] font-black text-gray-900 dark:text-white uppercase ml-[0.4em]">
            Management Elevated
        </span>
        <div class="h-px w-12 bg-gray-300 dark:bg-gray-700"></div>
    </div>
  </div>
</template>

<style scoped>
@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

