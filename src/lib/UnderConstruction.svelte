<script lang="ts">
	let showCodeInput = $state(false);
	let showUserSelection = $state(false);
	let codeValue = $state('');
	let errorMessage = $state('');
	let clickCount = $state(0);
	let clickTimer: NodeJS.Timeout | null = null;
	let selectedUserId = $state<number | null>(null);

	const SECRET_CODE = '031188';

	// Lista de usuarios disponibles para testing
	const availableUsers = [
		{
			id: 1,
			username: 'maria_gonzalez',
			displayName: 'María González',
			email: 'maria@votetok.com',
			avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
			verified: true,
			bio: 'Activista social y política',
			countryIso3: 'ESP',
			subdivisionId: '1',
			role: 'user'
		},
		{
			id: 2,
			username: 'carlos_lopez',
			displayName: 'Carlos López',
			email: 'carlos@votetok.com',
			avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
			verified: true,
			bio: 'Analista político',
			countryIso3: 'ESP',
			subdivisionId: '2',
			role: 'user'
		},
		{
			id: 3,
			username: 'laura_sanchez',
			displayName: 'Laura Sánchez',
			email: 'laura@votetok.com',
			avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop',
			verified: false,
			bio: 'Periodista independiente',
			countryIso3: 'MEX',
			subdivisionId: '3',
			role: 'user'
		},
		{
			id: 4,
			username: 'juan_martin',
			displayName: 'Juan Martín',
			email: 'juan@votetok.com',
			avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop',
			verified: true,
			bio: 'Economista',
			countryIso3: 'ARG',
			subdivisionId: '4',
			role: 'user'
		},
		{
			id: 5,
			username: 'sofia_herrera',
			displayName: 'Sofía Herrera',
			email: 'sofia@votetok.com',
			avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop',
			verified: false,
			bio: 'Estudiante de ciencias políticas',
			countryIso3: 'COL',
			subdivisionId: '5',
			role: 'user'
		}
	];

	function handleLogoClick() {
		clickCount++;
		
		if (clickTimer) {
			clearTimeout(clickTimer);
		}

		if (clickCount >= 3) {
			showCodeInput = true;
			clickCount = 0;
			return;
		}

		clickTimer = setTimeout(() => {
			clickCount = 0;
		}, 800);
	}

	function handleCodeSubmit(e?: Event) {
		e?.preventDefault();
		
		if (codeValue === SECRET_CODE) {
			// Código correcto, mostrar selección de usuarios
			showCodeInput = false;
			showUserSelection = true;
			codeValue = '';
		} else {
			errorMessage = 'Código incorrecto';
			codeValue = '';
			setTimeout(() => {
				errorMessage = '';
			}, 2000);
		}
	}

	function selectUser(userId: number) {
		selectedUserId = userId;
		const user = availableUsers.find(u => u.id === userId);
		if (user) {
			// Guardar usuario en localStorage
			localStorage.setItem('votetok-test-user', JSON.stringify(user));
			localStorage.setItem('votetok-access', 'granted');
			// Recargar la página
			window.location.reload();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			showCodeInput = false;
			codeValue = '';
			errorMessage = '';
		}
	}
</script>

<div class="construction-page">
	<div class="construction-content">
		<!-- Logo animado -->
		<div class="logo-container" role="button" tabindex="0" onclick={handleLogoClick} onkeydown={(e) => e.key === 'Enter' && handleLogoClick()}>
			<div class="logo-circle">
				<svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
					<circle cx="50" cy="50" r="45" stroke="url(#gradient)" stroke-width="3" fill="none" />
					<path d="M50 20 L65 45 L50 40 L35 45 Z" fill="url(#gradient)" />
					<circle cx="50" cy="50" r="8" fill="url(#gradient)" />
					<defs>
						<linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
							<stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
						</linearGradient>
					</defs>
				</svg>
			</div>
			<h1 class="logo-text">VoteTok</h1>
		</div>

		<!-- Título principal -->
		<h2 class="main-title">Sitio en Construcción</h2>
		<p class="subtitle">Estamos trabajando en algo increíble</p>

		<!-- Barra de progreso -->
		<div class="progress-container">
			<div class="progress-bar">
				<div class="progress-fill"></div>
			</div>
			<p class="progress-text">Lanzamiento próximamente...</p>
		</div>

		<!-- Características -->
		<div class="features">
			<div class="feature-item">
				<div class="feature-icon">🌍</div>
				<p>Votaciones Globales</p>
			</div>
			<div class="feature-item">
				<div class="feature-icon">📊</div>
				<p>Resultados en Tiempo Real</p>
			</div>
			<div class="feature-item">
				<div class="feature-icon">🎨</div>
				<p>Visualización 3D</p>
			</div>
		</div>

		<!-- Campo de código (oculto hasta triple click) -->
		{#if showCodeInput}
			<div class="code-input-container">
				<form onsubmit={handleCodeSubmit}>
					<input
						type="password"
						bind:value={codeValue}
						onkeydown={handleKeydown}
						placeholder="Código de acceso"
						class="code-input"
					/>
					<button type="submit" class="code-submit">
						Entrar
					</button>
				</form>
				{#if errorMessage}
					<p class="error-message">{errorMessage}</p>
				{/if}
				<p class="code-hint">Presiona ESC para cancelar</p>
			</div>
		{/if}

		<!-- Selección de usuario (después de código correcto) -->
		{#if showUserSelection}
			<div class="user-selection-container">
				<h3 class="selection-title">Selecciona tu usuario</h3>
				<p class="selection-subtitle">Elige con qué usuario quieres entrar a la aplicación</p>
				
				<div class="users-grid">
					{#each availableUsers as user}
						<button 
							class="user-card" 
							class:selected={selectedUserId === user.id}
							onclick={() => selectUser(user.id)}
						>
							<div class="user-avatar-container">
								<img src={user.avatarUrl} alt={user.displayName} class="user-avatar" />
								{#if user.verified}
									<div class="verified-badge">✓</div>
								{/if}
							</div>
							<div class="user-info">
								<div class="user-name">{user.displayName}</div>
								<div class="user-username">@{user.username}</div>
								<div class="user-bio">{user.bio}</div>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- Footer -->
	<footer class="construction-footer">
		<p>&copy; 2024 VoteTok. Todos los derechos reservados.</p>
	</footer>
</div>

<style>
	.construction-page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		padding: 2rem;
		position: relative;
		overflow: hidden;
	}

	.construction-page::before {
		content: '';
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
		background-size: 50px 50px;
		animation: moveGrid 20s linear infinite;
	}

	@keyframes moveGrid {
		0% { transform: translate(0, 0); }
		100% { transform: translate(50px, 50px); }
	}

	.construction-content {
		position: relative;
		z-index: 1;
		text-align: center;
		max-width: 600px;
		width: 100%;
		background: rgba(255, 255, 255, 0.95);
		padding: 3rem 2rem;
		border-radius: 20px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.logo-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		margin-bottom: 2rem;
		cursor: pointer;
		user-select: none;
		transition: transform 0.2s ease;
	}

	.logo-container:hover {
		transform: scale(1.05);
	}

	.logo-circle {
		animation: rotate 10s linear infinite;
	}

	@keyframes rotate {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.logo-text {
		font-size: 2.5rem;
		font-weight: 700;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		margin: 0;
	}

	.main-title {
		font-size: 2rem;
		font-weight: 700;
		color: #2d3748;
		margin: 0 0 0.5rem 0;
	}

	.subtitle {
		font-size: 1.125rem;
		color: #718096;
		margin: 0 0 2rem 0;
	}

	.progress-container {
		margin: 2rem 0;
	}

	.progress-bar {
		width: 100%;
		height: 8px;
		background: #e2e8f0;
		border-radius: 10px;
		overflow: hidden;
		margin-bottom: 0.5rem;
	}

	.progress-fill {
		height: 100%;
		width: 65%;
		background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
		border-radius: 10px;
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.7; }
	}

	.progress-text {
		font-size: 0.875rem;
		color: #a0aec0;
		margin: 0;
	}

	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1.5rem;
		margin: 2rem 0;
	}

	.feature-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
		border-radius: 12px;
		transition: transform 0.2s ease;
	}

	.feature-item:hover {
		transform: translateY(-5px);
	}

	.feature-icon {
		font-size: 2rem;
	}

	.feature-item p {
		font-size: 0.875rem;
		font-weight: 600;
		color: #4a5568;
		margin: 0;
	}

	.code-input-container {
		margin-top: 2rem;
		padding: 1.5rem;
		background: #f7fafc;
		border-radius: 12px;
		animation: slideDown 0.3s ease;
	}

	.code-input-container form {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.code-input {
		width: 100%;
		padding: 0.75rem 1rem;
		font-size: 1rem;
		border: 2px solid #cbd5e0;
		border-radius: 8px;
		margin-bottom: 0.75rem;
		transition: border-color 0.2s ease;
	}

	.code-input:focus {
		outline: none;
		border-color: #667eea;
	}

	.code-submit {
		width: 100%;
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		font-weight: 600;
		color: white;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.code-submit:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}

	.error-message {
		color: #e53e3e;
		font-size: 0.875rem;
		margin: 0.5rem 0 0 0;
		font-weight: 600;
	}

	.code-hint {
		font-size: 0.75rem;
		color: #a0aec0;
		margin: 0.5rem 0 0 0;
	}

	.construction-footer {
		position: relative;
		z-index: 1;
		margin-top: 2rem;
		color: rgba(255, 255, 255, 0.8);
		font-size: 0.875rem;
	}

	.construction-footer p {
		margin: 0;
	}

	.user-selection-container {
		margin-top: 2rem;
		padding: 1.5rem;
		background: #f7fafc;
		border-radius: 12px;
		animation: slideDown 0.3s ease;
	}

	.selection-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: #2d3748;
		margin: 0 0 0.5rem 0;
	}

	.selection-subtitle {
		font-size: 0.875rem;
		color: #718096;
		margin: 0 0 1.5rem 0;
	}

	.users-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		max-height: 400px;
		overflow-y: auto;
		padding-right: 0.5rem;
	}

	.users-grid::-webkit-scrollbar {
		width: 6px;
	}

	.users-grid::-webkit-scrollbar-track {
		background: #e2e8f0;
		border-radius: 3px;
	}

	.users-grid::-webkit-scrollbar-thumb {
		background: #cbd5e0;
		border-radius: 3px;
	}

	.users-grid::-webkit-scrollbar-thumb:hover {
		background: #a0aec0;
	}

	.user-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: white;
		border: 2px solid #e2e8f0;
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
		width: 100%;
	}

	.user-card:hover {
		border-color: #667eea;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
	}

	.user-card.selected {
		border-color: #667eea;
		background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
	}

	.user-avatar-container {
		position: relative;
		flex-shrink: 0;
	}

	.user-avatar {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid #e2e8f0;
	}

	.verified-badge {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 20px;
		height: 20px;
		background: #667eea;
		color: white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 700;
		border: 2px solid white;
	}

	.user-info {
		flex: 1;
		min-width: 0;
	}

	.user-name {
		font-size: 1rem;
		font-weight: 700;
		color: #2d3748;
		margin-bottom: 0.25rem;
	}

	.user-username {
		font-size: 0.875rem;
		color: #667eea;
		margin-bottom: 0.5rem;
	}

	.user-bio {
		font-size: 0.75rem;
		color: #718096;
		line-height: 1.4;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		.construction-content {
			padding: 2rem 1.5rem;
		}

		.logo-text {
			font-size: 2rem;
		}

		.main-title {
			font-size: 1.5rem;
		}

		.features {
			grid-template-columns: 1fr;
		}

		.user-card {
			padding: 0.875rem;
		}

		.user-avatar {
			width: 50px;
			height: 50px;
		}

		.user-name {
			font-size: 0.875rem;
		}

		.user-username {
			font-size: 0.75rem;
		}

		.user-bio {
			font-size: 0.6875rem;
		}
	}
</style>
