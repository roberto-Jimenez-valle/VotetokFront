<script lang="ts">
	import { fade } from "svelte/transition";

	let showCodeInput = $state(false);
	let codeValue = $state("");
	let errorMessage = $state("");
	let clickCount = $state(0);
	let clickTimer: NodeJS.Timeout | null = null;

	const SECRET_CODE = "031188";

	function handleLogoClick() {
		clickCount++;

		if (clickTimer) {
			clearTimeout(clickTimer);
		}

		if (clickCount >= 5) {
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
			localStorage.setItem("voutop-access", "granted");
			window.location.reload();
		} else {
			errorMessage = "Acceso denegado";
			codeValue = "";
			setTimeout(() => {
				errorMessage = "";
			}, 2000);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			showCodeInput = false;
			codeValue = "";
			errorMessage = "";
		}
	}
</script>

<div class="construction-page">
	<div class="background-effects">
		<div class="glow-orb orb-1"></div>
		<div class="glow-orb orb-2"></div>
		<div class="grid-overlay"></div>
	</div>

	<div class="construction-content">
		<!-- Logotipo -->
		<div
			class="logo-container"
			role="button"
			tabindex="0"
			onclick={handleLogoClick}
			onkeydown={(e) => e.key === "Enter" && handleLogoClick()}
			title="VouTop - The Social Voting App"
		>
			<div class="logo-wrapper">
				<img src="/logo.png" alt="VouTop Logo" class="logo-img" />
				<div class="logo-glow"></div>
			</div>
			<!-- <h1 class="logo-text">VouTop</h1> -->
		</div>

		<!-- Textos -->
		<div class="text-content">
			<span class="status-badge">Versión Beta</span>
			<h2 class="main-title">Experiencia en Desarrollo</h2>
			<p class="subtitle">
				Estamos construyendo la nueva generación de votación social.
			</p>
		</div>

		<!-- Formulario Secreto -->
		{#if showCodeInput}
			<div class="code-modal-overlay" transition:fade={{ duration: 200 }}>
				<div class="code-input-container">
					<div class="modal-header">
						<h3>Acceso Anticipado</h3>
						<button
							class="close-btn"
							onclick={() => (showCodeInput = false)}>×</button
						>
					</div>
					<form onsubmit={handleCodeSubmit}>
						<div class="input-group">
							<input
								type="password"
								bind:value={codeValue}
								onkeydown={handleKeydown}
								placeholder="Ingresa tu clave..."
								class="code-input"
								autofocus
							/>
							<div class="input-line"></div>
						</div>
						<button type="submit" class="code-submit">
							Desbloquear
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M5 12h14M12 5l7 7-7 7" />
							</svg>
						</button>
					</form>
					{#if errorMessage}
						<p class="error-message">{errorMessage}</p>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Footer Simple -->
		<div class="footer-info">
			<p>&copy; {new Date().getFullYear()} VouTop Inc.</p>
		</div>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		background: #0f0f11;
		font-family: "Inter", system-ui, sans-serif;
	}

	.construction-page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: #050505;
		color: white;
		position: relative;
		overflow: hidden;
	}

	.background-effects {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.glow-orb {
		position: absolute;
		border-radius: 50%;
		filter: blur(80px);
		opacity: 0.4;
	}

	.orb-1 {
		width: 400px;
		height: 400px;
		background: #9ec264;
		top: -100px;
		left: -100px;
		animation: float 20s infinite ease-in-out;
	}

	.orb-2 {
		width: 300px;
		height: 300px;
		background: #4a5568;
		bottom: -50px;
		right: -50px;
		animation: float 15s infinite reverse ease-in-out;
	}

	.grid-overlay {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
			linear-gradient(
				90deg,
				rgba(255, 255, 255, 0.03) 1px,
				transparent 1px
			);
		background-size: 50px 50px;
		mask-image: radial-gradient(
			circle at center,
			black 40%,
			transparent 100%
		);
	}

	@keyframes float {
		0%,
		100% {
			transform: translate(0, 0);
		}
		50% {
			transform: translate(30px, 50px);
		}
	}

	.construction-content {
		position: relative;
		z-index: 10;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 2rem;
		max-width: 600px;
	}

	.logo-container {
		margin-bottom: 3rem;
		cursor: default;
	}

	.logo-wrapper {
		position: relative;
		width: 120px;
		height: 120px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.logo-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		position: relative;
		z-index: 2;
		filter: drop-shadow(0 0 20px rgba(158, 194, 100, 0.3));
	}

	.logo-glow {
		position: absolute;
		inset: 10px;
		background: radial-gradient(
			circle,
			rgba(158, 194, 100, 0.4) 0%,
			transparent 70%
		);
		filter: blur(20px);
		z-index: 1;
		animation: pulse 4s infinite ease-in-out;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.5;
			transform: scale(1);
		}
		50% {
			opacity: 0.8;
			transform: scale(1.1);
		}
	}

	.text-content {
		animation: slideUp 0.8s ease-out;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.status-badge {
		display: inline-block;
		padding: 6px 16px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 20px;
		font-size: 0.75rem;
		font-weight: 600;
		color: #9ec264;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-bottom: 1.5rem;
		backdrop-filter: blur(10px);
	}

	.main-title {
		font-size: 3rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		margin: 0 0 1rem 0;
		background: linear-gradient(to right, #fff, #a0aec0);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.subtitle {
		font-size: 1.125rem;
		color: #718096;
		max-width: 400px;
		margin: 0 auto;
		line-height: 1.6;
	}

	.footer-info {
		margin-top: 4rem;
		color: #4a5568;
		font-size: 0.875rem;
	}

	/* Secret Modal */
	.code-modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.8);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 20px;
	}

	.code-input-container {
		width: 100%;
		max-width: 380px;
		background: #111;
		border: 1px solid #333;
		border-radius: 16px;
		padding: 24px;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
		animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes scaleIn {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
	}

	.modal-header h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.close-btn {
		background: none;
		border: none;
		color: #666;
		font-size: 24px;
		cursor: pointer;
		padding: 4px;
		transition: color 0.2s;
	}

	.close-btn:hover {
		color: #fff;
	}

	.input-group {
		position: relative;
		margin-bottom: 24px;
	}

	.code-input {
		width: 100%;
		background: transparent;
		border: none;
		color: white;
		font-size: 1.5rem;
		font-weight: 500;
		padding: 8px 0;
		text-align: center;
		letter-spacing: 0.2em;
		outline: none;
	}

	.code-input::placeholder {
		color: #333;
		font-size: 1rem;
		letter-spacing: normal;
	}

	.input-line {
		height: 2px;
		background: #333;
		width: 100%;
		transition: background 0.3s;
	}

	.code-input:focus + .input-line {
		background: #9ec264;
	}

	.code-submit {
		width: 100%;
		padding: 14px;
		background: white;
		color: black;
		border: none;
		border-radius: 8px;
		font-weight: 600;
		font-size: 1rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		transition:
			transform 0.2s,
			background 0.2s;
	}

	.code-submit:hover {
		background: #eee;
		transform: translateY(-2px);
	}

	.error-message {
		color: #ef4444;
		text-align: center;
		margin-top: 16px;
		font-size: 0.875rem;
	}
</style>
