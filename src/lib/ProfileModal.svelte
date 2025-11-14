<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { X, User, Settings, LogOut, Shield, HelpCircle, Bell, Moon, Sun, Globe } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';
  import { currentUser } from '$lib/stores';
  import { logout } from '$lib/stores/auth';
  
  const dispatch = createEventDispatcher();
  
  interface Props {
    isOpen?: boolean;
  }
  
  let { isOpen = $bindable(false) }: Props = $props();
  
  // Swipe handlers para cerrar modal (como type-options-sheet)
  let modalTouchStartY = 0;
  
  function handleModalSwipeStart(e: TouchEvent) {
    modalTouchStartY = e.touches[0].clientY;
  }
  
  function handleModalSwipeMove(e: TouchEvent) {
    const deltaY = e.touches[0].clientY - modalTouchStartY;
    if (deltaY > 100) {
      closeModal();
    }
  }
  
  // Mock stats del usuario
  const userStats = {
    polls: 24,
    votes: 156,
    followers: 432,
    following: 89
  };
  
  function closeModal() {
    isOpen = false;
  }
  
  function handleLogout() {
    console.log('[ProfileModal] 🚪 Cerrando sesión...');
    
    // Limpiar autenticación OAuth
    logout();
    
    // Limpiar también usuario de prueba
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('votetok-test-user');
    }
    
    // Limpiar currentUser del store principal
    currentUser.set(null);
    
    console.log('[ProfileModal] ✅ Sesión cerrada');
    dispatch('logout');
    closeModal();
    
    // Recargar página para limpiar todo el estado
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }
  
  function handleSettings() {
    console.log('Abrir configuración');
    dispatch('settings');
    closeModal();
  }
  
  function handlePrivacy() {
    console.log('Abrir privacidad');
    dispatch('privacy');
  }
  
  function handleHelp() {
    console.log('Abrir ayuda');
    dispatch('help');
  }
  
  function handleNotifications() {
    console.log('Configurar notificaciones');
    dispatch('notifications');
  }
  
  function handleTheme() {
    console.log('Cambiar tema');
    dispatch('theme');
  }
  
  function handleLanguage() {
    console.log('Cambiar idioma');
    dispatch('language');
  }
</script>

{#if isOpen}
  <!-- Overlay -->
  <div
    class="modal-overlay"
    transition:fade={{ duration: 200 }}
    onclick={closeModal}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === 'Escape' && closeModal()}
  ></div>

  <!-- Modal -->
  <div
    class="modal-container"
    transition:fly={{ y: '100%', duration: 300 }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="profile-modal-title"
    ontouchstart={handleModalSwipeStart}
    ontouchmove={handleModalSwipeMove}
  >
    <!-- Header -->
    <div class="modal-header">
      <h2 id="profile-modal-title">Mi Perfil</h2>
      <button onclick={closeModal} class="close-btn" aria-label="Cerrar">
        <X size={24} />
      </button>
    </div>

    <!-- Content -->
    <div class="modal-content">
      <!-- Perfil del usuario -->
      <div class="profile-section">
        <div class="profile-avatar">
          <img src={$currentUser?.avatarUrl || 'https://i.pravatar.cc/150?u=maria'} alt={$currentUser?.displayName || 'Usuario'} />
          {#if $currentUser?.verified}
            <div class="verified-badge">✓</div>
          {/if}
        </div>
        <div class="profile-info">
          <h3>{$currentUser?.displayName || 'Usuario'}</h3>
          <p class="username">@{$currentUser?.username || 'usuario'}</p>
          {#if $currentUser?.countryIso3}
            <p class="location">{$currentUser.countryIso3}</p>
          {/if}
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">{userStats.polls}</div>
          <div class="stat-label">Encuestas</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{userStats.votes}</div>
          <div class="stat-label">Votos</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{userStats.followers}</div>
          <div class="stat-label">Seguidores</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{userStats.following}</div>
          <div class="stat-label">Siguiendo</div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Menú de opciones -->
      <div class="menu-section">
        <h4 class="menu-title">Cuenta</h4>
        
        <button class="menu-item" onclick={handleSettings}>
          <Settings size={20} />
          <span>Configuración</span>
        </button>
        
        <button class="menu-item" onclick={handleNotifications}>
          <Bell size={20} />
          <span>Notificaciones</span>
        </button>
        
        <button class="menu-item" onclick={handlePrivacy}>
          <Shield size={20} />
          <span>Privacidad y seguridad</span>
        </button>
      </div>

      <div class="divider"></div>

      <div class="menu-section">
        <h4 class="menu-title">Apariencia</h4>
        
        <button class="menu-item" onclick={handleTheme}>
          <Moon size={20} />
          <span>Modo oscuro</span>
          <div class="toggle-switch active">
            <div class="toggle-thumb"></div>
          </div>
        </button>
        
        <button class="menu-item" onclick={handleLanguage}>
          <Globe size={20} />
          <span>Idioma</span>
          <span class="menu-value">Español</span>
        </button>
      </div>

      <div class="divider"></div>

      <div class="menu-section">
        <h4 class="menu-title">Soporte</h4>
        
        <button class="menu-item" onclick={handleHelp}>
          <HelpCircle size={20} />
          <span>Ayuda y soporte</span>
        </button>
      </div>

      <div class="divider"></div>

      <!-- Botón de logout -->
      <button class="logout-btn" onclick={handleLogout}>
        <LogOut size={20} />
        <span>Cerrar sesión</span>
      </button>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 30000;
    backdrop-filter: blur(8px);
  }
  
  @media (min-width: 768px) {
    .modal-overlay {
      right: auto;
      width: 700px;
    }
  }

  .modal-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #181a20;
    z-index: 30001;
    display: flex;
    flex-direction: column;
  }

  @media (min-width: 768px) {
    .modal-container {
      left: 0;
      right: auto;
      width: 100%;
      max-width: 700px;
      border-radius: 0 1.25rem 0 0;
      box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.4);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    padding-top: calc(1rem + env(safe-area-inset-top));
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
    position: sticky;
    top: 0;
    background: #181a20;
    z-index: 10;
  }

  .modal-header h2 {
    font-size: 24px;
    font-weight: 700;
    color: white;
    margin: 0;
  }

  .close-btn {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    padding-bottom: calc(5rem + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .profile-section {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
  }

  .profile-avatar {
    position: relative;
    flex-shrink: 0;
  }

  .profile-avatar img {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid rgba(255, 255, 255, 0.1);
  }

  .verified-badge {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 24px;
    height: 24px;
    background: #3b82f6;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    border: 3px solid #16181e;
  }

  .profile-info {
    flex: 1;
  }

  .profile-info h3 {
    font-size: 20px;
    font-weight: 700;
    color: white;
    margin: 0 0 4px 0;
  }

  .username {
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    margin: 0 0 4px 0;
  }

  .location {
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    margin: 0;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }

  .stat-item {
    text-align: center;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
  }

  .stat-value {
    font-size: 20px;
    font-weight: 700;
    color: white;
    margin-bottom: 4px;
  }

  .stat-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 20px 0;
  }

  .menu-section {
    margin-bottom: 20px;
  }

  .menu-title {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 12px 0;
  }

  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.03);
    border: none;
    border-radius: 12px;
    color: white;
    font-size: 15px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    margin-bottom: 6px;
  }

  .menu-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .menu-item span:first-of-type {
    flex: 1;
  }

  .menu-value {
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
  }

  .toggle-switch {
    width: 44px;
    height: 24px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    position: relative;
    transition: all 0.3s;
  }

  .toggle-switch.active {
    background: #3b82f6;
  }

  .toggle-thumb {
    width: 18px;
    height: 18px;
    background: white;
    border-radius: 50%;
    position: absolute;
    top: 3px;
    left: 3px;
    transition: all 0.3s;
  }

  .toggle-switch.active .toggle-thumb {
    left: 23px;
  }

  .logout-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    background: rgba(239, 68, 68, 0.15);
    border: none;
    border-radius: 16px;
    color: #ef4444;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .logout-btn:hover {
    background: rgba(239, 68, 68, 0.25);
    transform: scale(1.02);
  }

</style>
