<script lang="ts">
	let showCodeInput = $state(false);
	let codeValue = $state('');
	let errorMessage = $state('');
	let clickCount = $state(0);
	let clickTimer: NodeJS.Timeout | null = null;

	const SECRET_CODE = '031188';

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
			// Código correcto, dar acceso directamente sin selección de usuario
			localStorage.setItem('votetok-access', 'granted');
			// Recargar la página para entrar a la aplicación
			window.location.reload();
		} else {
			errorMessage = 'Código incorrecto';
			codeValue = '';
			setTimeout(() => {
				errorMessage = '';
			}, 2000);
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
	}
</style>
