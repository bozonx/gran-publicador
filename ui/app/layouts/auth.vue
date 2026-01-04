<script setup lang="ts">
// Public pages layout (login, register, etc.)
// Minimal layout with no navigation or extra UI elements
</script>

<template>
  <div class="min-h-screen relative overflow-hidden">
    <!-- Animated gradient background -->
    <div class="absolute inset-0 bg-gradient-mesh">
      <!-- Base gradient layer -->
      <div class="absolute inset-0 bg-linear-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-blue-900/20"></div>
      
      <!-- Animated gradient orbs -->
      <div class="gradient-orb gradient-orb-1"></div>
      <div class="gradient-orb gradient-orb-2"></div>
      <div class="gradient-orb gradient-orb-3"></div>
      <div class="gradient-orb gradient-orb-4"></div>
      
      <!-- Overlay for better content readability -->
      <div class="absolute inset-0 bg-white/30 dark:bg-gray-950/50 backdrop-blur-3xl"></div>
    </div>

    <!-- Content -->
    <div class="relative z-10">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.bg-gradient-mesh {
  background: 
    radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.15) 0px, transparent 50%),
    radial-gradient(at 100% 0%, rgba(168, 85, 247, 0.15) 0px, transparent 50%),
    radial-gradient(at 100% 100%, rgba(236, 72, 153, 0.15) 0px, transparent 50%),
    radial-gradient(at 0% 100%, rgba(14, 165, 233, 0.15) 0px, transparent 50%);
}

.gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.6;
  mix-blend-mode: multiply;
  animation: float 20s ease-in-out infinite;
}

.dark .gradient-orb {
  mix-blend-mode: screen;
  opacity: 0.3;
}

.gradient-orb-1 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.8) 0%, rgba(59, 130, 246, 0) 70%);
  top: -10%;
  left: -10%;
  animation-delay: 0s;
}

.gradient-orb-2 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.8) 0%, rgba(168, 85, 247, 0) 70%);
  top: -5%;
  right: -5%;
  animation-delay: -5s;
}

.gradient-orb-3 {
  width: 450px;
  height: 450px;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.8) 0%, rgba(236, 72, 153, 0) 70%);
  bottom: -10%;
  right: -10%;
  animation-delay: -10s;
}

.gradient-orb-4 {
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.8) 0%, rgba(14, 165, 233, 0) 70%);
  bottom: -5%;
  left: 10%;
  animation-delay: -15s;
}

@keyframes float {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(50px, -50px) scale(1.1);
  }
  50% {
    transform: translate(-30px, 30px) scale(0.9);
  }
  75% {
    transform: translate(30px, 50px) scale(1.05);
  }
}

/* Dark mode adjustments */
.dark .gradient-orb-1 {
  background: radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, rgba(59, 130, 246, 0) 70%);
}

.dark .gradient-orb-2 {
  background: radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, rgba(168, 85, 247, 0) 70%);
}

.dark .gradient-orb-3 {
  background: radial-gradient(circle, rgba(236, 72, 153, 0.4) 0%, rgba(236, 72, 153, 0) 70%);
}

.dark .gradient-orb-4 {
  background: radial-gradient(circle, rgba(14, 165, 233, 0.4) 0%, rgba(14, 165, 233, 0) 70%);
}
</style>
