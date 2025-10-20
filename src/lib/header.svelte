<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import SinglePollSection from './globe/cards/sections/SinglePollSection.svelte';
  import { currentUser } from '$lib/stores';
  import '$lib/styles/trending-ranking.css';
  
  const dispatch = createEventDispatcher();

  type TrendingUser = {
    id: number;
    name: string;
    avatar: string;
    username: string;
  };

  let users = $state<TrendingUser[]>([]);
  let selectedUser = $state<TrendingUser | null>(null);
  let userPolls = $state<any[]>([]);
  let isLoadingPolls = $state(false);
  let currentPollIndex = $state(0);
  
  // Estados para swipe/arrastre
  let swipeStartX = 0;
  let swipeStartY = 0;
  let isSwiping = false;
  
  // Estados para SinglePollSection
  let pollStates = $state<Record<string, 'expanded' | 'collapsed'>>({});
  let activeAccordions = $state<Record<string, number | null>>({});
  let currentPages = $state<Record<string, number>>({});
  let userVotes = $state<Record<string, string>>({});
  let multipleVotes = $state<Record<string, string[]>>({});
  let displayVotes = $state<Record<string, string>>({});
  let pollTitleExpanded = $state<Record<string, boolean>>({});
  let pollTitleTruncated = $state<Record<string, boolean>>({});
  let pollTitleElements = $state<Record<string, HTMLElement>>({});
  let voteEffectStates = $state<Record<string, boolean>>({});

  onMount(async () => {
    console.log('[Header] 🚀 Iniciando carga de usuarios...');
    try {
      // Cargar usuarios que tienen rells o saves activos
      const url = '/api/users/with-activity?limit=8';
      console.log('[Header] Fetching:', url);
      
      const res = await fetch(url);
      console.log('[Header] Response status:', res.status, res.ok);
      
      if (res.ok) {
        const result = await res.json();
        console.log('[Header] Response data:', result);
        
        if (result.data && result.data.length > 0) {
          users = result.data.map((user: any) => ({
            id: user.id,
            name: user.displayName || user.username,
            avatar: user.avatarUrl || '/default-avatar.png',
            username: user.username
          }));
          console.log('[Header] ✅ Usuarios cargados:', users.length, users);
        } else {
          console.warn('[Header] ⚠️ No hay usuarios con actividad');
          users = [];
        }
      } else {
        const errorText = await res.text();
        console.error('[Header] ❌ Error en respuesta:', res.status, errorText);
        users = [];
      }
    } catch (e) {
      console.error('[Header] ❌ Error cargando usuarios:', e);
      users = [];
    }
    console.log('[Header] 🏁 Carga finalizada. Total usuarios:', users.length);
  });

  async function handleAvatarClick(user: TrendingUser) {
    selectedUser = user;
    userPolls = [];
    currentPollIndex = 0; // Reiniciar al primer índice
    isLoadingPolls = true;
    
    console.log('[Header] Loading polls for user:', user.id, user.name);
    
    try {
      // Cargar encuestas con interacciones del usuario (guardadas o reposteadas)
      const response = await fetch(`/api/polls/user-interactions?userId=${user.id}&types=save,repost&limit=20`);
      console.log('[Header] Response status:', response.status, response.ok);
      
      if (response.ok) {
        const result = await response.json();
        console.log('[Header] Polls loaded:', result.data?.length || 0, 'polls');
        
        // Transformar datos para compatibilidad con SinglePollSection
        const transformedPolls = (result.data || []).map((poll: any) => ({
          ...poll,
          // Asegurar que tiene las propiedades necesarias
          id: poll.id?.toString() || poll.id,
          question: poll.title || poll.question,
          region: 'Global',
          options: (poll.options || []).map((opt: any) => ({
            ...opt,
            key: opt.optionKey || opt.key,
            label: opt.optionLabel || opt.label,
            votes: opt._count?.votes || opt.voteCount || opt.votes || 0,
            color: opt.color || '#10b981'
          })),
          totalVotes: poll._count?.votes || poll.totalVotes || 0,
          totalViews: poll._count?.interactions || poll.totalViews || 0
        }));
        
        console.log('[Header] Transformed polls:', transformedPolls);
        userPolls = transformedPolls;
        
        // Inicializar todos los polls como expandidos para permitir votación directa
        transformedPolls.forEach((poll: any) => {
          pollStates[poll.id] = 'expanded';
          activeAccordions[poll.id] = 0; // Primera opción activa
          currentPages[poll.id] = 0;
        });
      } else {
        console.warn('[Header] Failed to load polls, status:', response.status);
        const errorData = await response.text();
        console.warn('[Header] Error response:', errorData);
        userPolls = [];
      }
    } catch (error) {
      console.error('[Header] Error loading user polls:', error);
      userPolls = [];
    } finally {
      isLoadingPolls = false;
      console.log('[Header] Loading complete. Polls count:', userPolls.length);
    }
  }

  function closeModal() {
    selectedUser = null;
    userPolls = [];
    currentPollIndex = 0;
  }
  
  function nextPoll() {
    if (currentPollIndex < userPolls.length - 1) {
      currentPollIndex++;
    }
  }
  
  function prevPoll() {
    if (currentPollIndex > 0) {
      currentPollIndex--;
    }
  }
  
  function nextUser() {
    const currentIndex = users.findIndex(u => u.id === selectedUser?.id);
    if (currentIndex !== -1 && currentIndex < users.length - 1) {
      handleAvatarClick(users[currentIndex + 1]);
    }
  }
  
  function prevUser() {
    const currentIndex = users.findIndex(u => u.id === selectedUser?.id);
    if (currentIndex !== -1 && currentIndex > 0) {
      handleAvatarClick(users[currentIndex - 1]);
    }
  }
  
  function goToPoll(index: number) {
    currentPollIndex = index;
  }
  
  // Handlers para swipe
  function handleSwipeStart(e: MouseEvent | TouchEvent) {
    const target = e.target as HTMLElement;
    
    // Si es un botón u otro control, no iniciar swipe
    if (target.closest('button:not(.progress-bar), input, textarea, select, a')) {
      isSwiping = false;
      return;
    }
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    swipeStartX = clientX;
    swipeStartY = clientY;
    isSwiping = true;
  }
  
  function handleSwipeMove(e: MouseEvent | TouchEvent) {
    if (!isSwiping) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - swipeStartX;
    const deltaY = clientY - swipeStartY;
    
    // Si el movimiento todavía es muy pequeño, no cancelar aún
    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      return;
    }
    
    // Solo swipe horizontal, no vertical
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      console.log('[Header] ❌ Swipe cancelado: movimiento vertical');
      isSwiping = false;
      return;
    }
  }
  
  function handleSwipeEnd(e: MouseEvent | TouchEvent) {
    if (!isSwiping) {
      return;
    }
    
    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as MouseEvent).clientX;
    const deltaX = clientX - swipeStartX;
    const threshold = 50; // mínimo 50px para contar como swipe
    
    console.log('[Header] Swipe end:', { deltaX, threshold });
    
    if (Math.abs(deltaX) > threshold) {
      if (deltaX < 0) {
        // Swipe izquierda -> siguiente
        console.log('[Header] 👉 Swipe izquierda detectado');
        if (currentPollIndex < userPolls.length - 1) {
          console.log('[Header] Siguiente encuesta');
          nextPoll();
        } else {
          console.log('[Header] Siguiente usuario');
          nextUser();
        }
      } else {
        // Swipe derecha -> anterior
        console.log('[Header] 👈 Swipe derecha detectado');
        if (currentPollIndex > 0) {
          console.log('[Header] Encuesta anterior');
          prevPoll();
        } else {
          console.log('[Header] Usuario anterior');
          prevUser();
        }
      }
    } else {
      console.log('[Header] Swipe muy corto, ignorado');
    }
    
    isSwiping = false;
  }
  
  // Handlers para eventos de SinglePollSection
  function handleSetActive(event: CustomEvent) {
    const { pollId, index } = event.detail;
    console.log('[Header] 🔓 Activando opción:', { pollId, index });
    pollStates[pollId] = 'expanded';
    activeAccordions[pollId] = index;
  }
  
  function handleOptionClick(event: CustomEvent) {
    const { pollId, optionKey, optionColor } = event.detail;
    console.log('[Header] 🗳️ Click en opción:', { pollId, optionKey, optionColor });
    
    // Actualizar voto local mutando directamente
    userVotes[pollId] = optionKey;
    displayVotes[pollId] = optionKey;
    
    // Mostrar efecto visual
    voteEffectStates[pollId] = true;
    setTimeout(() => {
      voteEffectStates[pollId] = false;
    }, 1000);
    
    console.log('[Header] ✅ Voto registrado:', { pollId, optionKey, userVotes: {...userVotes} });
    
    // TODO: Enviar voto al servidor
    // En un rell, el voto debería ir al poll original
  }
  
  function handleOpenInGlobe(event: CustomEvent) {
    const { poll } = event.detail;
    console.log('[Header] 🌍 Abrir en globo:', poll);
    
    // Disparar evento al componente padre para que lo propague a GlobeGL
    dispatch('openPollInGlobe', { poll });
    
    // Cerrar la modal
    closeModal();
  }
  
  function handlePageChange(event: CustomEvent) {
    const { pollId, page } = event.detail;
    console.log('[Header] 📄 Cambio de página:', { pollId, page });
    currentPages[pollId] = page;
  }
  
  function handleAddOption(event: CustomEvent) {
    const { pollId, previewColor } = event.detail;
    console.log('[Header] ➕ Agregar opción:', { pollId, previewColor });
    
    // Encontrar el poll y agregar una nueva opción en edición
    const pollIndex = userPolls.findIndex(p => p.id === pollId);
    if (pollIndex !== -1) {
      const newOptionKey = `temp_${Date.now()}`;
      userPolls[pollIndex].options = [
        ...userPolls[pollIndex].options,
        {
          key: newOptionKey,
          label: '',
          votes: 0,
          color: previewColor,
          isEditing: true
        }
      ];
      console.log('[Header] ✅ Nueva opción agregada temporalmente');
    }
  }
  
  function handleConfirmMultiple(event: CustomEvent) {
    const { pollId } = event.detail;
    console.log('[Header] ✓ Confirmar múltiple:', { pollId, selected: multipleVotes[pollId] });
    
    // Marcar como votado
    if (multipleVotes[pollId] && multipleVotes[pollId].length > 0) {
      // Guardar el primer voto seleccionado como voto principal
      userVotes[pollId] = multipleVotes[pollId][0];
      displayVotes[pollId] = multipleVotes[pollId][0];
      
      console.log('[Header] ✅ Votos múltiples confirmados:', multipleVotes[pollId]);
      // TODO: Enviar votos múltiples al servidor
    }
  }
  
  function handleClearVote(event: CustomEvent) {
    const { pollId } = event.detail;
    console.log('[Header] 🗑️ Limpiar voto:', { pollId });
    delete userVotes[pollId];
    delete displayVotes[pollId];
    delete multipleVotes[pollId];
  }
  
  function handlePublishOption(event: CustomEvent) {
    const { pollId, optionKey, label, color } = event.detail;
    console.log('[Header] 📤 Publicar opción:', { pollId, optionKey, label, color });
    
    // TODO: Enviar nueva opción al servidor
    // Por ahora, solo actualizar localmente
    const pollIndex = userPolls.findIndex(p => p.id === pollId);
    if (pollIndex !== -1) {
      const optionIndex = userPolls[pollIndex].options.findIndex((o: any) => o.key === optionKey);
      if (optionIndex !== -1) {
        userPolls[pollIndex].options[optionIndex] = {
          ...userPolls[pollIndex].options[optionIndex],
          label,
          color,
          isEditing: false
        };
        console.log('[Header] ✅ Opción publicada localmente');
      }
    }
  }
  
  function handleCancelEditing(event: CustomEvent) {
    const { pollId, optionKey } = event.detail;
    console.log('[Header] ❌ Cancelar edición:', { pollId, optionKey });
    
    // Eliminar opción temporal
    const pollIndex = userPolls.findIndex(p => p.id === pollId);
    if (pollIndex !== -1) {
      userPolls[pollIndex].options = userPolls[pollIndex].options.filter((o: any) => o.key !== optionKey);
      console.log('[Header] ✅ Opción temporal eliminada');
    }
  }
  
  function handleOpenColorPicker(event: CustomEvent) {
    console.log('[Header] 🎨 Abrir selector de color:', event.detail);
    // TODO: Implementar selector de color
  }

</script>

<header class="top-0 left-0 right-0 z-50" style="position: fixed;">
	<div class="w-full flex flex-col">
		<!-- Logo y Toggle unificado -->
		<div class="transition-opacity duration-300 ease-in-out px-2 sm:px-4">
			<div class="flex items-center justify-between h-8 sm:h-10 w-full">
				<h1 
					class="logo-text text-xl sm:text-3xl font-extrabold tracking-tight"
					style="color: var(--logo-color, white);"
				>VouTop</h1>
				<div id="theme-toggle-slot"></div>
			</div>
		</div>

		<!-- User Avatars (Trending) -->
		{#if users.length > 0}
			<div class="avatars-scroll-wrapper">
				<div class="avatars-scroll-container">
					<div class="avatars-inner-container">
						{#each users as user, i}
							<button 
								class="avatar-lg clickable" 
								style="z-index: {users.length - i};"
								onclick={() => handleAvatarClick(user)}
								title={user.name}
							>
								<img 
									src={user.avatar} 
									alt={user.name}
									loading="lazy"
									style="width: 100%; height: 100%; object-fit: cover; border-radius: 999px;"
								/>
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>
</header>
<!-- Contenedor de encuestas sin modal -->
{#if selectedUser}
	<div class="polls-fullscreen-container">
		<!-- Barra de avatares superior con scroll horizontal -->
		<div class="top-avatars-bar">
			<div class="avatars-scroll-horizontal">
				{#each users as user (user.id)}
					<button
						class="avatar-small-btn {selectedUser?.id === user.id ? 'active' : ''}"
						onclick={() => handleAvatarClick(user)}
						aria-label={user.name}
					>
						<img 
							src={user.avatar} 
							alt={user.name}
							style="width: 100%; height: 100%; object-fit: cover; border-radius: 999px;"
						/>
					</button>
				{/each}
			</div>
		</div>
		
		<button class="close-polls-btn" onclick={closeModal} aria-label="Cerrar encuestas">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="18" y1="6" x2="6" y2="18"/>
				<line x1="6" y1="6" x2="18" y2="18"/>
			</svg>
		</button>
		
		{#if isLoadingPolls}
			<div class="loading-spinner">
				<div class="spinner-circle"></div>
			</div>
		{:else if userPolls.length > 0}
			<!-- Indicadores de progreso tipo Instagram -->
			<div class="progress-indicators">
				{#each userPolls as poll, index (poll.id)}
					<button 
						class="progress-bar {index === currentPollIndex ? 'active' : ''}"
						onclick={() => goToPoll(index)}
						aria-label="Ir a encuesta {index + 1}"
					></button>
				{/each}
			</div>
			
			<!-- Contenedor con la encuesta actual -->
			<div class="polls-carousel">
				{#if userPolls[currentPollIndex]}
					{@const currentPoll = userPolls[currentPollIndex]}
					<div class="poll-card-wrapper active">
						<!-- Indicador de usuario (rell o publicación normal) -->
						{#if currentPoll.isRell && currentPoll.originalPoll}
							<!-- Rell: mostrar "X republicó de Y" -->
							<div class="post-indicator-instagram">
								<div class="post-avatar-container">
									<img 
										class="post-small-avatar" 
										src={currentPoll.user?.avatarUrl || '/default-avatar.png'} 
										alt={currentPoll.user?.displayName || 'Usuario'}
									/>
									<div class="rell-icon-badge">
										<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
											<path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>
										</svg>
									</div>
								</div>
								<div class="post-text">
									<span class="post-user-name">{currentPoll.user?.displayName || currentPoll.user?.username || 'Usuario'}</span>
									<span class="post-label">republicó de</span>
									<span class="post-original-user">{currentPoll.originalPoll.user?.displayName || 'Usuario'}</span>
								</div>
							</div>
						{:else}
							<!-- Publicación normal: mostrar "X publicó" -->
							<div class="post-indicator-instagram">
								<div class="post-avatar-container">
									<img 
										class="post-small-avatar" 
										src={currentPoll.user?.avatarUrl || '/default-avatar.png'} 
										alt={currentPoll.user?.displayName || 'Usuario'}
									/>
								</div>
								<div class="post-text">
									<span class="post-user-name">{currentPoll.user?.displayName || currentPoll.user?.username || 'Usuario'}</span>
									<span class="post-label">publicó</span>
								</div>
							</div>
						{/if}
						
						<SinglePollSection
							poll={currentPoll}
							pollIndex={currentPollIndex}
							state={pollStates[currentPoll.id] || 'expanded'}
							activeAccordionIndex={activeAccordions[currentPoll.id] ?? 0}
							currentPage={currentPages[currentPoll.id] || 0}
							{userVotes}
							{multipleVotes}
							{displayVotes}
							{pollTitleExpanded}
							{pollTitleTruncated}
							{pollTitleElements}
							voteEffectActive={voteEffectStates[currentPoll.id] || false}
							voteEffectPollId={null}
							voteClickX={0}
							voteClickY={0}
							voteIconX={0}
							voteIconY={0}
							voteEffectColor="#10b981"
							on:setActive={handleSetActive}
							on:optionClick={handleOptionClick}
							on:openInGlobe={handleOpenInGlobe}
							on:pageChange={handlePageChange}
							on:addOption={handleAddOption}
							on:confirmMultiple={handleConfirmMultiple}
							on:clearVote={handleClearVote}
							on:publishOption={handlePublishOption}
							on:cancelEditing={handleCancelEditing}
							on:openColorPicker={handleOpenColorPicker}
						/>
					</div>
				{/if}
			</div>
			
			<!-- Área de navegación inferior -->
			<div 
				class="nav-area-bottom"
				role="navigation"
				aria-label="Controles de navegación"
				onmousedown={handleSwipeStart}
				onmousemove={handleSwipeMove}
				onmouseup={handleSwipeEnd}
				onmouseleave={handleSwipeEnd}
				ontouchstart={handleSwipeStart}
				ontouchmove={handleSwipeMove}
				ontouchend={handleSwipeEnd}
			>
				<button 
					class="nav-btn-bottom nav-prev" 
					onclick={() => {
						if (currentPollIndex > 0) prevPoll();
						else prevUser();
					}}
					disabled={users.findIndex(u => u.id === selectedUser?.id) === 0 && currentPollIndex === 0}
					aria-label="Anterior"
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M15 18l-6-6 6-6"/>
					</svg>
				</button>
				
				<div class="swipe-hint">
					← Desliza para navegar →
				</div>
				
				<button 
					class="nav-btn-bottom nav-next" 
					onclick={() => {
						if (currentPollIndex < userPolls.length - 1) nextPoll();
						else nextUser();
					}}
					disabled={users.findIndex(u => u.id === selectedUser?.id) === users.length - 1 && currentPollIndex === userPolls.length - 1}
					aria-label="Siguiente"
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M9 18l6-6-6-6"/>
					</svg>
				</button>
			</div>
		{:else}
			<div class="no-polls-message">
				Este usuario aún no ha publicado encuestas
			</div>
		{/if}
	</div>
{/if}


<style>
	.avatars-scroll-wrapper {
		width: 100%;
		margin-top: 8px; /* Reducido para ocupar menos espacio */
		padding-bottom: 6px;
		position: relative;
		/* CRÍTICO para móvil: permitir scroll horizontal */
		touch-action: pan-x;
		-webkit-overflow-scrolling: touch;
	}
	
	.avatars-scroll-container {
		overflow-x: scroll; /* Forzar scroll horizontal */
		overflow-y: hidden;
		-webkit-overflow-scrolling: touch;
		scroll-behavior: smooth;
		width: 100%;
		padding: 5px 16px; /* Padding de 5px arriba y abajo */
		/* CRÍTICO para móvil: permitir scroll horizontal */
		touch-action: pan-x;
		/* Ocultar scrollbar */
		scrollbar-width: none; /* Firefox */
		-ms-overflow-style: none; /* IE y Edge */
	}
	
	/* Ocultar scrollbar en WebKit (Chrome, Safari, Edge) */
	.avatars-scroll-container::-webkit-scrollbar {
		display: none !important;
		width: 0 !important;
		height: 0 !important;
	}
	
	.avatars-inner-container {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: max-content; /* Forzar que el contenido no se envuelva */
		width: max-content;
		/* Asegurar que funcione en móvil */
		flex-wrap: nowrap;
		white-space: nowrap;
	}
	
	/* Centrar avatares en desktop */
	@media (min-width: 768px) {
		.avatars-scroll-container {
			display: flex;
			justify-content: center;
			overflow-x: auto;
		}
		
		.avatars-inner-container {
			width: auto;
			min-width: auto;
		}
	}
	
	.avatar-lg {
		width: 48px;
		height: 48px;
		border-radius: 999px;
		border: 3px solid rgba(255, 255, 255, 0.4);
		flex-shrink: 0;
	}
	
	.avatar-lg.clickable {
		cursor: pointer;
		transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
		background: none;
		padding: 0;
	}
	
	.avatar-lg.clickable:hover {
		box-shadow: 0 0 20px 8px rgba(255, 255, 255, 0.6),
		            0 0 40px 12px rgba(255, 255, 255, 0.3),
		            0 0 60px 16px rgba(255, 255, 255, 0.1);
		filter: brightness(1.2);
		border-color: rgba(255, 255, 255, 0.9);
	}
	
	.avatar-lg.clickable:active {
		transform: scale(1.05);
	}
	
	/* Contenedor fullscreen para encuestas */
	.polls-fullscreen-container {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 100%);
		z-index: 999999;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 80px 0 120px;
		animation: fadeIn 0.2s ease;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		pointer-events: auto;
	}
	
	/* Barra de avatares superior */
	.top-avatars-bar {
		position: fixed;
		top: 0;
		left: 0;
		right: 80px; /* Espacio para el botón X */
		height: 70px;
		background: linear-gradient(180deg, rgba(10, 10, 15, 0.98) 0%, rgba(10, 10, 15, 0) 100%);
		backdrop-filter: blur(10px);
		z-index: 1000000;
		display: flex;
		align-items: center;
		padding: 10px 0 10px 16px;
		pointer-events: auto;
	}
	
	.avatars-scroll-horizontal {
		display: flex;
		gap: 12px;
		overflow-x: auto;
		overflow-y: hidden;
		padding: 5px 0;
		scrollbar-width: none; /* Firefox */
		-ms-overflow-style: none; /* IE/Edge */
	}
	
	.avatars-scroll-horizontal::-webkit-scrollbar {
		display: none; /* Chrome, Safari, Opera */
	}
	
	.avatar-small-btn {
		width: 48px;
		height: 48px;
		min-width: 48px;
		min-height: 48px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.3);
		background: none;
		padding: 0;
		cursor: pointer;
		transition: all 0.3s ease;
		position: relative;
		overflow: hidden;
	}
	
	.avatar-small-btn:hover {
		transform: scale(1.05);
		border-color: rgba(255, 255, 255, 0.6);
		box-shadow: 0 0 12px rgba(255, 255, 255, 0.3);
	}
	
	.avatar-small-btn.active {
		border: 3px solid white;
		box-shadow: 0 0 16px rgba(255, 255, 255, 0.5);
	}
	
	.avatar-small-btn:active {
		transform: scale(0.95);
	}
	
	.close-polls-btn {
		position: fixed;
		top: 12px;
		right: 12px;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
		z-index: 1000000;
	}
	
	.close-polls-btn svg {
		width: 18px;
		height: 18px;
	}
	
	.close-polls-btn:hover {
		background: rgba(0, 0, 0, 0.6);
		transform: scale(1.1);
	}
	
	.close-polls-btn:active {
		transform: scale(0.9);
	}
	
	/* Indicadores de progreso tipo Instagram */
	.progress-indicators {
		position: fixed;
		top: 70px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 4px;
		z-index: 1000001;
		max-width: 700px;
		width: calc(100% - 40px);
		padding: 0 20px;
	}
	
	.progress-bar {
		flex: 1;
		height: 3px;
		background: rgba(255, 255, 255, 0.3);
		border: none;
		border-radius: 2px;
		cursor: pointer;
		transition: all 0.3s ease;
		padding: 0;
	}
	
	.progress-bar.active {
		background: white;
		box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
	}
	
	.progress-bar:hover:not(.active) {
		background: rgba(255, 255, 255, 0.5);
	}
	
	/* Carrusel */
	.polls-carousel {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 700px;
		width: 100%;
		position: relative;
		pointer-events: auto;
		touch-action: auto;
	}
	
	/* Área de navegación inferior con swipe */
	.nav-area-bottom {
		position: fixed;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		max-width: 700px;
		width: calc(100% - 40px);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 16px 24px;
		background: rgba(20, 20, 30, 0.95);
		backdrop-filter: blur(20px);
		border-radius: 50px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		z-index: 1000001;
		cursor: grab;
		user-select: none;
		touch-action: none;
		pointer-events: auto;
	}
	
	.nav-area-bottom:active {
		cursor: grabbing;
	}
	
	.swipe-hint {
		flex: 1;
		text-align: center;
		color: rgba(255, 255, 255, 0.5);
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.5px;
		pointer-events: none;
	}
	
	/* Botones de navegación inferior */
	.nav-btn-bottom {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.3s ease;
		flex-shrink: 0;
	}
	
	.nav-btn-bottom:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.2);
		transform: scale(1.1);
	}
	
	.nav-btn-bottom:active:not(:disabled) {
		transform: scale(0.95);
	}
	
	.nav-btn-bottom:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
	
	/* Responsive para móviles */
	@media (max-width: 768px) {
		.nav-area-bottom {
			bottom: 10px;
			width: calc(100% - 24px);
			padding: 12px 16px;
		}
		
		.nav-btn-bottom {
			width: 40px;
			height: 40px;
		}
		
		.swipe-hint {
			font-size: 11px;
		}
	}
	
	/* Wrapper para cada poll - sin bordes, máximo espacio */
	.poll-card-wrapper {
		background: transparent;
		border: none;
		overflow: visible;
		transition: none;
		pointer-events: auto;
		touch-action: auto;
	}
	
	/* Indicador de publicación estilo Instagram */
	.post-indicator-instagram {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		background: transparent;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}
	
	.post-avatar-container {
		position: relative;
		width: 24px;
		height: 24px;
		flex-shrink: 0;
	}
	
	.post-small-avatar {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		object-fit: cover;
		border: 1.5px solid rgba(255, 255, 255, 0.2);
	}
	
	.rell-icon-badge {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 14px;
		height: 14px;
		background: #0095f6;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid rgba(30, 30, 40, 0.95);
	}
	
	.rell-icon-badge svg {
		width: 8px;
		height: 8px;
		color: white;
	}
	
	.post-text {
		display: flex;
		align-items: center;
		gap: 4px;
		flex: 1;
		font-size: 13px;
		line-height: 1.3;
		overflow: hidden;
	}
	
	.post-user-name {
		color: rgba(255, 255, 255, 0.9);
		font-weight: 600;
		flex-shrink: 0;
	}
	
	.post-label {
		color: rgba(255, 255, 255, 0.5);
		font-weight: 400;
		flex-shrink: 0;
	}
	
	.post-original-user {
		color: rgba(255, 255, 255, 0.9);
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	.loading-spinner {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 60px 20px;
		max-width: 700px;
		width: 100%;
	}
	
	.spinner-circle {
		width: 48px;
		height: 48px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-top-color: rgba(255, 255, 255, 0.8);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	
	.no-polls-message {
		text-align: center;
		color: rgba(255, 255, 255, 0.5);
		padding: 40px 20px;
		font-size: 14px;
		font-style: italic;
		max-width: 700px;
		width: 100%;
	}
	
	/* Ajustes para polls - permitir funcionamiento normal */
	.poll-card-wrapper :global(.poll-item) {
		background: transparent !important;
		border: none !important;
		padding: 8px !important;
		margin: 0 !important;
		pointer-events: auto !important;
		touch-action: auto !important;
	}
	
	.poll-card-wrapper :global(.poll-header) {
		margin-bottom: 8px;
	}
	
	.poll-card-wrapper :global(.vote-cards-grid) {
		gap: 8px;
		margin-top: 8px;
		/* NO forzar padding que pueda interferir con el drag */
	}
	
	.poll-card-wrapper :global(.vote-card) {
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		cursor: grab;
		touch-action: pan-x pan-y !important;
		user-select: none;
		-webkit-user-drag: none;
	}
	
	.poll-card-wrapper :global(.vote-card:active) {
		cursor: grabbing;
	}
	
	.poll-card-wrapper :global(.vote-cards-grid) {
		touch-action: pan-x pan-y !important;
		user-select: none;
	}
	
	.poll-card-wrapper :global(.bottom-controls-container),
	.poll-card-wrapper :global(.vote-summary-info) {
		margin-top: 8px;
		padding: 8px;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}
	
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	
	@keyframes scaleIn {
		from {
			opacity: 0;
			transform: scale(0.9);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
