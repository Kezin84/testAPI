<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="app-container">
    <nav class="main-nav">
      <router-link to="/" class="nav-link">Quản Lý Công Việc</router-link>
      <router-link to="/mst" class="nav-link">Tra Cứu MST (AI)</router-link>
    </nav>
    <RouterView />
  </div>
</template>

<style>
/* Global styles are handled in main.css and base.css */
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-nav {
  display: flex;
  justify-content: center;
  gap: 2rem;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-link {
  color: #94a3b8;
  text-decoration: none;
  font-weight: 600;
  font-size: 1.1rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  transition: all 0.3s;
}

.nav-link:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.router-link-active {
  color: #34d399;
  background: rgba(52, 211, 153, 0.1);
}

/* Mobile Bottom Navigation (Tab Bar) */
@media (max-width: 768px) {
  .app-container {
    /* Thêm khoảng trống dưới đáy để nội dung không bị che bởi tab bar */
    padding-bottom: 5rem;
  }
  
  .main-nav {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    border-bottom: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.8rem 1rem;
    background: rgba(15, 23, 42, 0.95); /* Màu nền đậm hơn để che nội dung cuộn bên dưới */
    gap: 0.5rem;
    justify-content: space-around;
    z-index: 999;
  }
  
  .nav-link {
    font-size: 0.95rem;
    padding: 0.8rem 0;
    text-align: center;
    flex: 1;
    border-radius: 12px;
  }
}
</style>
