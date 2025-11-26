<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  interface Props {
    url: string;
    width?: string;
    height?: string;
    mode?: "full" | "preview" | "linkedin"; // full = 180px alto, preview = 130px, linkedin = preview horizontal
    autoplay?: boolean;
  }

  let {
    url = "",
    mode = "preview",
    width = "100%",
    height = "100%",
    autoplay = false,
  }: Props = $props();

  let embedType: string = $state("");
  let embedHTML: string = $state("");
  let metadata: any = $state(null);
  let loading: boolean = $state(true);
  let error: boolean = $state(false);

  // Procesar embedHTML para agregar autoplay
  // Procesar embedHTML para agregar autoplay y limpiar UI
  function processEmbedHTML(html: string): string {
    if (!html) return "";

    let processed = html;

    // Para iframes de YouTube
    if (
      processed.includes("youtube.com/embed") ||
      processed.includes("youtu.be")
    ) {
      processed = processed.replace(/src="([^"]+)"/, (match, url) => {
        const separator = url.includes("?") ? "&" : "?";
        // Parámetros para controles y API
        let params =
          "controls=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&fs=0&disablekb=1&playsinline=1&enablejsapi=1";

        if (autoplay) {
          params += "&autoplay=1";
        }

        return `src="${url}${separator}${params}"`;
      });
    }

    // Para iframes de Vimeo
    if (processed.includes("player.vimeo.com")) {
      processed = processed.replace(/src="([^"]+)"/, (match, url) => {
        const separator = url.includes("?") ? "&" : "?";
        let params = "controls=1&byline=0&portrait=0&title=0";

        if (autoplay) {
          params += "&autoplay=1";
        }

        return `src="${url}${separator}${params}"`;
      });
    }

    // Para iframes de Spotify
    if (processed.includes("open.spotify.com/embed")) {
      processed = processed.replace(/src="([^"]+)"/, (match, url) => {
        // Spotify usa autoplay como parámetro
        if (autoplay && !url.includes("autoplay=1")) {
          const separator = url.includes("?") ? "&" : "?";
          return `src="${url}${separator}autoplay=1"`;
        }
        return match;
      });
    }

    // Para videos HTML5
    if (processed.includes("<video")) {
      if (autoplay && !processed.includes("autoplay")) {
        processed = processed.replace("<video", "<video autoplay");
      }
      if (!processed.includes("playsinline")) {
        processed = processed.replace("<video", "<video playsinline");
      }
      // Ocultar controles si estamos en modo full
      if (mode === "full" && processed.includes("controls")) {
        processed = processed.replace("controls", "");
      }
    }

    return processed;
  }

  /**
   * Convierte una URL de imagen externa a través del proxy de medios
   * Resuelve problemas de CORS y X-Frame-Options
   */
  function getProxiedImageUrl(imageUrl: string): string {
    if (!imageUrl) return imageUrl;

    try {
      const urlObj = new URL(imageUrl);
      const hostname = urlObj.hostname.toLowerCase();

      // Lista de dominios que sabemos que funcionan bien sin proxy
      const noProxyDomains = [
        "picsum.photos",
        "placehold.co",
        "via.placeholder.com",
        "ui-avatars.com",
        "dummyimage.com",
      ];

      const needsProxy = !noProxyDomains.some(
        (domain) => hostname === domain || hostname.endsWith("." + domain),
      );

      if (needsProxy) {
        // Usar nuestro proxy de medios
        return `/api/media-proxy?url=${encodeURIComponent(imageUrl)}`;
      }

      return imageUrl;
    } catch {
      return imageUrl;
    }
  }

  /**
   * Sistema de contenido embebido tipo LinkedIn
   *
   * CONTENIDO EMBEBIDO INTERACTIVO (iframes):
   * - YouTube: Videos embebidos
   * - Vimeo: Videos embebidos
   * - Spotify: Canciones, álbumes, playlists embebidas
   * - SoundCloud: Audio embebido
   * - Twitch: Videos de Twitch embebidos
   * - Megaphone: Podcasts embebidos
   * - Omny.fm: Podcasts embebidos
   * - SlideShare: Presentaciones (via metadata)
   *
   * CONTENIDO COMO PREVIEW (layout LinkedIn):
   * - Twitter/X: Preview con metadatos Open Graph
   * - Instagram: Preview con metadatos
   * - TikTok: Preview con metadatos
   * - Facebook: Preview con metadatos
   * - LinkedIn: Preview con metadatos
   * - Forbes, Bloomberg, NBC, etc.: Preview con metadatos
   * - Cualquier otro sitio: Preview con metadatos Open Graph
   */
  async function detectAndGenerateEmbed(url: string) {
    if (!url || url.trim() === "") {
      console.log("[MediaEmbed] URL vacía, no se procesará");
      loading = false;
      error = true;
      return;
    }

    console.log("[MediaEmbed] Procesando URL:", url);
    loading = true;
    error = false;

    try {
      // Detectar imágenes directas (no necesitan oEmbed)
      if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) {
        embedType = "generic";
        metadata = {
          title: new URL(url).hostname,
          description: "",
          image: getProxiedImageUrl(url),
          url: url,
        };
        loading = false;
        console.log("[MediaEmbed] Detectada imagen directa");
        return;
      }

      // TODOS los enlaces pasan por el sistema oEmbed/link-preview centralizado
      console.log(
        "[MediaEmbed] Usando sistema oEmbed/link-preview centralizado",
      );
      await fetchMetadata(url);
    } catch (err) {
      console.error("[MediaEmbed] Error generating embed:", err);
      error = true;
      loading = false;
    }
  }

  // Obtener metadatos con validación del backend
  async function fetchMetadata(url: string) {
    try {
      console.log("[MediaEmbed] Obteniendo preview con oEmbed/Open Graph...");

      // Usar nuestro API de link-preview (oEmbed + Open Graph)
      try {
        const response = await fetch(
          `/api/link-preview?url=${encodeURIComponent(url)}`,
        );

        if (response.ok) {
          const result = await response.json();
          console.log("[MediaEmbed] Respuesta del API:", result);

          // Los datos están en result.data
          const data = result.data || result;

          if (data) {
            // Si tiene HTML embebido de oEmbed, usarlo
            if (data.embedHtml || data.html) {
              embedType = data.providerName || data.provider || "oembed";
              embedHTML = data.embedHtml || data.html;
              console.log(
                "[MediaEmbed] ✅ oEmbed HTML recibido para:",
                embedType,
              );
            }
            // Si no, usar metadatos para preview
            else {
              // Usar placeholder si no hay imagen
              const imageUrl = data.image || data.imageProxied;
              const finalImage = imageUrl
                ? getProxiedImageUrl(imageUrl)
                : `https://placehold.co/400x250/1a1a2e/white?text=${encodeURIComponent(data.domain || new URL(url).hostname)}`;

              metadata = {
                title: data.title || "Sin título",
                description: data.description || "",
                image: finalImage,
                url: data.url || url,
              };
              embedType = data.type || "opengraph";
              console.log("[MediaEmbed] ✅ Metadata establecida:", {
                embedType,
                metadata,
                hasRealImage: !!imageUrl,
              });
            }
            loading = false;
            return;
          }
        }
      } catch (apiError) {
        console.log(
          "[MediaEmbed] API link-preview falló, usando Microlink fallback:",
          apiError,
        );
      }

      // Fallback a Microlink si el API falla
      try {
        await fetchMetadataWithMicrolink(url);
      } catch (microlinkError) {
        console.log(
          "[MediaEmbed] Microlink también falló, usando fallback manual:",
          microlinkError,
        );
        createFallbackMetadata(url);
      }
    } catch (err) {
      console.error("[MediaEmbed] Error fetching metadata:", err);
      createFallbackMetadata(url);
    } finally {
      loading = false;
    }
  }

  // Método original con Microlink como fallback
  async function fetchMetadataWithMicrolink(url: string) {
    // Timeout de 8 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    console.log("[MediaEmbed] Llamando a Microlink API...");
    const response = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(url)}`,
      { signal: controller.signal },
    );
    clearTimeout(timeoutId);

    const data = await response.json();
    console.log("[MediaEmbed] Respuesta de Microlink:", data);

    if (data.status === "success" && data.data) {
      let imageUrl = data.data.image?.url || "";

      // Fallbacks específicos por plataforma
      if (url.includes("instagram.com")) {
        if (!imageUrl || imageUrl.includes("static/images")) {
          imageUrl = "https://i.imgur.com/qj8nF2J.jpeg";
        }
      } else if (url.includes("tiktok.com")) {
        // TikTok suele tener imagen en los metadatos
        if (!imageUrl) {
          imageUrl = "https://placehold.co/220x130/000/FFF?text=TikTok";
        }
      } else if (url.includes("twitter.com") || url.includes("x.com")) {
        // Twitter/X suele tener imagen
        if (!imageUrl) {
          imageUrl = "https://placehold.co/220x130/1DA1F2/FFF?text=X";
        }
      } else if (url.includes("facebook.com")) {
        if (!imageUrl) {
          imageUrl = "https://placehold.co/220x130/1877F2/FFF?text=Facebook";
        }
      } else if (url.includes("pinterest.com")) {
        if (!imageUrl) {
          imageUrl = "https://placehold.co/220x130/E60023/FFF?text=Pinterest";
        }
      }

      // Fallback genérico
      if (!imageUrl) {
        imageUrl = "https://placehold.co/220x130/333/FFF?text=?";
      }

      metadata = {
        title: data.data.title || "Publicación detectada",
        description: data.data.description || new URL(url).hostname,
        image: imageUrl,
        url: url,
      };
      console.log("[MediaEmbed] Metadata creada:", metadata);
    } else {
      // Fallback si Microlink falla
      console.log("[MediaEmbed] Microlink falló, usando fallback");
      createFallbackMetadata(url);
    }
  }

  // Crear metadata de fallback
  function createFallbackMetadata(url: string) {
    try {
      const hostname = new URL(url).hostname;
      let placeholder = "https://placehold.co/220x130/333/FFF?text=?";
      let title = "Contenido";

      if (url.includes("instagram.com")) {
        placeholder = "https://placehold.co/220x130/E4405F/FFF?text=IG";
        title = "Instagram";
      } else if (url.includes("tiktok.com")) {
        placeholder = "https://placehold.co/220x130/000/FFF?text=TikTok";
        title = "TikTok";
      } else if (url.includes("twitter.com") || url.includes("x.com")) {
        placeholder = "https://placehold.co/220x130/1DA1F2/FFF?text=X";
        title = "X (Twitter)";
      } else if (url.includes("facebook.com")) {
        placeholder = "https://placehold.co/220x130/1877F2/FFF?text=FB";
        title = "Facebook";
      }

      metadata = {
        title: title,
        description: hostname,
        image: placeholder,
        url: url,
      };
      embedType = "generic"; // Asegurar que se muestre como card
      console.log("[MediaEmbed] Fallback metadata creada:", metadata);
    } catch (err) {
      console.error("[MediaEmbed] Error creando fallback:", err);
      error = true;
    }
  }

  // Detectar cuando cambia la URL
  $effect(() => {
    if (url) {
      detectAndGenerateEmbed(url);
    }
  });

  // Pausar medios cuando autoplay cambia a false
  let containerRef: HTMLDivElement;
  $effect(() => {
    if (!autoplay && containerRef) {
      // Buscar iframes dentro de este componente específico
      const iframes = containerRef.querySelectorAll("iframe");
      iframes.forEach((iframe) => {
        try {
          const src = iframe.src || "";

          // YouTube
          if (src.includes("youtube.com") || src.includes("youtu.be")) {
            iframe.contentWindow?.postMessage(
              '{"event":"command","func":"pauseVideo","args":""}',
              "*",
            );
          }

          // Vimeo
          if (src.includes("vimeo.com")) {
            iframe.contentWindow?.postMessage('{"method":"pause"}', "*");
          }

          // Spotify - necesita ser recargado completamente
          if (src.includes("spotify.com")) {
            // Guardar el src original
            const originalSrc = src;
            // Remover autoplay del src
            const newSrc = originalSrc
              .replace(/[?&]autoplay=1/, "")
              .replace(/autoplay=1[&]?/, "");

            // Solo recargar si realmente tenía autoplay
            if (originalSrc !== newSrc) {
              // Forzar recarga del iframe
              iframe.src = "";
              setTimeout(() => {
                iframe.src = newSrc;
              }, 10);
            }
          }
        } catch (e) {
          // Ignorar errores de cross-origin
        }
      });
    }
  });
</script>

<div
  bind:this={containerRef}
  class="media-embed"
  class:preview-mode={mode === "preview"}
  class:full-mode={mode === "full"}
  style="width: {width}; height: {height};"
>
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Cargando preview...</span>
    </div>
  {:else if error && !metadata}
    <div class="error-state">
      {#if !url || url.trim() === ""}
        <span>⚠️ No hay URL para mostrar</span>
      {:else}
        <span>⚠️ Error al cargar contenido</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          class="error-link"
        >
          Abrir enlace ↗
        </a>
      {/if}
    </div>
  {:else if embedHTML && embedHTML.trim() !== ""}
    <!-- Renderizar cualquier HTML de embed (oEmbed, etc.) -->
    <div class="embed-container">
      {@html processEmbedHTML(embedHTML)}
    </div>
  {:else if (embedType === "generic" || embedType === "opengraph" || embedType === "text" || embedType === "website") && metadata}
    <div class="mini-card linkedin-card">
      <div class="linkedin-image">
        <img
          src={metadata.image}
          alt={metadata.title}
          loading="lazy"
          data-original-url={url}
          onerror={(e) => {
            const img = e.target as HTMLImageElement;
            const fallbackUrl = "https://placehold.co/220x130/333/FFF?text=?";

            // Extraer URL original si viene del proxy
            let originalImageUrl = img.src;
            if (img.src.includes("/api/media-proxy?url=")) {
              try {
                const proxyUrl = new URL(img.src, window.location.origin);
                const urlParam = proxyUrl.searchParams.get("url");
                if (urlParam) {
                  originalImageUrl = decodeURIComponent(urlParam);
                  console.log(
                    "[MediaEmbed] URL original extraída del proxy:",
                    originalImageUrl,
                  );
                }
              } catch (err) {
                console.warn(
                  "[MediaEmbed] No se pudo extraer URL original del proxy",
                );
              }
            }

            // Emitir evento antes de aplicar fallback
            if (img.src !== fallbackUrl && !img.src.includes(fallbackUrl)) {
              console.log("[MediaEmbed] 🚨 Imagen falló:", originalImageUrl);
              console.log("[MediaEmbed] 📤 Emitiendo evento imageerror");
              dispatch("imageerror", {
                url: originalImageUrl, // URL original, no la del proxy
                originalUrl: url,
              });
              img.src = fallbackUrl;
            }
          }}
        />

        <!-- Texto GIPHY dentro del contenedor de la imagen -->
        <button
          class="linkedin-content"
          onclick={() => window.open(metadata.url, "_blank")}
          type="button"
          aria-label={`Abrir ${metadata.title}`}
        >
          <h4>{url.includes("giphy") ? "GIPHY" : metadata.title}</h4>
          {#if metadata.description && !url.includes("giphy")}
            <p>{metadata.description}</p>
          {/if}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .media-embed {
    position: relative;
    border-radius: 0;
    overflow: hidden;
    background: #000000;
    display: block;
  }

  .preview-mode {
    width: 100%;
    height: 100%;
    min-height: 130px;
  }

  .full-mode {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .loading-state,
  .error-state {
    width: 100%;
    height: 100%;
    min-height: 130px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.875rem;
    padding: 20px;
    box-sizing: border-box;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .embed-container {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .embed-container :global(iframe),
  .embed-container :global(video),
  .embed-container :global(img) {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .mini-card {
    width: 100%;
    height: 100%;
    background: #000000;
    border: none;
    border-radius: 0;
    position: relative;
    overflow: hidden;
    padding: 0;
    display: block;
  }

  .mini-card img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 1;
  }

  .mini-card h4 {
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    color: white;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mini-card p {
    margin: 2px 0 0;
    font-size: 9px;
    color: #ccc;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Layout: imagen arriba, texto debajo (en full mode) */
  .linkedin-card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    background: rgba(0, 0, 0, 0.95);
    border: none;
    min-height: 150px;
  }

  .linkedin-image {
    width: 100%;
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000000;
    position: relative;
  }

  .linkedin-image img {
    width: 100%;
    height: auto;
    max-height: calc(100vh - 200px);
    max-width: 100%;
    object-fit: contain;
    opacity: 1;
    display: block;
  }

  .linkedin-content {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    text-align: center;
    align-items: center;
    min-width: 0;
    max-width: 90%;
    gap: 2px;
    background: transparent;
    border: none;
    cursor: pointer;
    z-index: 10;
    pointer-events: auto;
    opacity: 0;
    animation: showText 0s linear 0.39s forwards;
  }

  @keyframes showText {
    to {
      opacity: 1;
    }
  }

  .linkedin-content:hover {
    background: transparent;
  }

  .linkedin-content h4 {
    margin: 0;
    font-size: 10px;
    font-weight: 600;
    color: white;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-clamp: 2;
    line-height: 1.4;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  }

  .linkedin-content p {
    margin: 0;
    font-size: 9px;
    color: rgba(255, 255, 255, 0.5);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    line-clamp: 1;
    line-height: 1.3;
  }

  /* Ajustes para modo full - texto superpuesto sobre imagen */
  .full-mode .linkedin-card {
    height: 100%;
    flex: 1;
  }

  .full-mode .linkedin-image {
    position: relative;
    flex: 1;
    height: 100%;
  }

  .full-mode .linkedin-image img {
    width: 100%;
    height: 100%;
    max-height: 100%;
    object-fit: contain;
    object-position: center;
  }

  /* Ajustes para modo preview (espacios pequeños) - superpuesto */
  .preview-mode .linkedin-card {
    min-height: 130px;
    height: 100%;
  }

  .preview-mode .linkedin-image {
    position: relative;
    height: 100%;
    flex: 1;
    display: block;
  }

  .preview-mode .linkedin-image img {
    height: 100%;
    max-height: none;
    object-fit: cover;
  }

  .preview-mode .linkedin-content {
    padding: 6px 8px;
    gap: 2px;
    max-width: 80%;
  }

  .preview-mode .linkedin-content h4 {
    font-size: 11px;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .preview-mode .linkedin-content p {
    font-size: 10px;
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }

  .error-state {
    color: rgba(255, 100, 100, 0.8);
  }

  .error-link {
    color: rgba(100, 150, 255, 0.9);
    text-decoration: none;
    font-size: 0.8rem;
    margin-top: 4px;
    padding: 4px 12px;
    border: 1px solid rgba(100, 150, 255, 0.3);
    border-radius: 6px;
    transition: all 0.2s;
  }

  .error-link:hover {
    background: rgba(100, 150, 255, 0.1);
    border-color: rgba(100, 150, 255, 0.6);
  }
</style>
