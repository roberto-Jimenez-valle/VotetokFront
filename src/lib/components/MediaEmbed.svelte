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
    autoplay = false, // Por defecto SIEMPRE false para ahorrar GPU
  }: Props = $props();

  let embedType: string = $state("");
  let embedHTML: string = $state("");
  let metadata: any = $state(null);
  let loading: boolean = $state(true);
  let error: boolean = $state(false);

  // Procesar embedHTML para agregar/quitar autoplay y limpiar UI
  function processEmbedHTML(html: string): string {
    if (!html) return "";

    let processed = html;

    // Para iframes de YouTube
    if (
      processed.includes("youtube.com/embed") ||
      processed.includes("youtu.be")
    ) {
      processed = processed.replace(/src="([^"]+)"/, (match, url) => {
        // Limpiar parámetros de autoplay/mute existentes
        let cleanUrl = url
          .replace(/[&?]autoplay=[01]/gi, '')
          .replace(/[&?]mute=[01]/gi, '')
          .replace(/[&?]muted=[01]/gi, '');
        
        const separator = cleanUrl.includes("?") ? "&" : "?";
        // Parámetros para controles y API (fs=1 habilita fullscreen)
        let params =
          "controls=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&fs=1&disablekb=1&playsinline=1&enablejsapi=1&disableCastApi=1";

        if (autoplay) {
          params += "&autoplay=1&mute=1"; // mute=1 necesario para iOS autoplay
        }

        return `src="${cleanUrl}${separator}${params}"`;
      });
      
      // Agregar atributos allow y loading lazy al iframe para iOS y rendimiento
      if (!processed.includes('allow="')) {
        processed = processed.replace('<iframe', '<iframe allow="encrypted-media; fullscreen; picture-in-picture"');
      }
      if (!processed.includes('loading="')) {
        processed = processed.replace('<iframe', '<iframe loading="lazy" importance="low"');
      }
    }

    // Para iframes de Vimeo
    if (processed.includes("player.vimeo.com")) {
      processed = processed.replace(/src="([^"]+)"/, (match, url) => {
        // Limpiar parámetros de autoplay/mute existentes
        let cleanUrl = url
          .replace(/[&?]autoplay=[01]/gi, '')
          .replace(/[&?]mute=[01]/gi, '')
          .replace(/[&?]muted=[01]/gi, '');
        
        const separator = cleanUrl.includes("?") ? "&" : "?";
        let params = "controls=1&byline=0&portrait=0&title=0";

        if (autoplay) {
          params += "&autoplay=1&muted=1"; // muted=1 necesario para iOS
        }

        return `src="${cleanUrl}${separator}${params}"`;
      });
      
      // Agregar atributos allow y loading lazy al iframe
      if (!processed.includes('allow="')) {
        processed = processed.replace('<iframe', '<iframe allow="autoplay; encrypted-media; fullscreen; picture-in-picture"');
      }
      if (!processed.includes('loading="')) {
        processed = processed.replace('<iframe', '<iframe loading="lazy"');
      }
    }

    // Para iframes de Spotify
    if (processed.includes("open.spotify.com/embed")) {
      processed = processed.replace(/src="([^"]+)"/, (match, url) => {
        // Limpiar parámetros de autoplay existentes
        let cleanUrl = url.replace(/[&?]autoplay=[01]/gi, '');
        
        // Solo agregar autoplay si está habilitado
        if (autoplay) {
          const separator = cleanUrl.includes("?") ? "&" : "?";
          return `src="${cleanUrl}${separator}autoplay=1"`;
        }
        return `src="${cleanUrl}"`;
      });
      
      // Agregar loading lazy al iframe
      if (!processed.includes('loading="')) {
        processed = processed.replace('<iframe', '<iframe loading="lazy"');
      }
    }

    // Para iframes de SoundCloud
    if (processed.includes("soundcloud.com") || processed.includes("w.soundcloud.com")) {
      if (!processed.includes('loading="')) {
        processed = processed.replace('<iframe', '<iframe loading="lazy"');
      }
      if (!processed.includes('allow="')) {
        processed = processed.replace('<iframe', '<iframe allow="autoplay"');
      }
    }

    // Para iframes de TikTok
    if (processed.includes("tiktok.com")) {
      processed = processed.replace(/src="([^"]+)"/, (match, url) => {
        let cleanUrl = url.replace(/[&?]autoplay=[01]/gi, '');
        if (!autoplay) {
          return `src="${cleanUrl}"`;
        }
        const separator = cleanUrl.includes("?") ? "&" : "?";
        return `src="${cleanUrl}${separator}autoplay=1"`;
      });
      if (!processed.includes('allow="')) {
        processed = processed.replace('<iframe', '<iframe allow="autoplay; encrypted-media; fullscreen"');
      }
      if (!processed.includes('loading="')) {
        processed = processed.replace('<iframe', '<iframe loading="lazy"');
      }
    }

    // Para iframes de Twitch
    if (processed.includes("twitch.tv") || processed.includes("player.twitch.tv")) {
      processed = processed.replace(/src="([^"]+)"/, (match, url) => {
        let cleanUrl = url.replace(/[&?]autoplay=(true|false)/gi, '');
        const separator = cleanUrl.includes("?") ? "&" : "?";
        const autoplayParam = autoplay ? 'true' : 'false';
        return `src="${cleanUrl}${separator}autoplay=${autoplayParam}&muted=false"`;
      });
      if (!processed.includes('allow="')) {
        processed = processed.replace('<iframe', '<iframe allow="autoplay; fullscreen"');
      }
      if (!processed.includes('loading="')) {
        processed = processed.replace('<iframe', '<iframe loading="lazy"');
      }
    }

    // Para iframes de Dailymotion
    if (processed.includes("dailymotion.com")) {
      processed = processed.replace(/src="([^"]+)"/, (match, url) => {
        let cleanUrl = url.replace(/[&?]autoplay=[01]/gi, '').replace(/[&?]mute=[01]/gi, '');
        const separator = cleanUrl.includes("?") ? "&" : "?";
        let params = "ui-start-screen-info=0&controls=1";
        if (autoplay) {
          params += "&autoplay=1&mute=1";
        }
        return `src="${cleanUrl}${separator}${params}"`;
      });
      if (!processed.includes('allow="')) {
        processed = processed.replace('<iframe', '<iframe allow="autoplay; fullscreen; picture-in-picture"');
      }
      if (!processed.includes('loading="')) {
        processed = processed.replace('<iframe', '<iframe loading="lazy"');
      }
    }

    // Para videos HTML5
    if (processed.includes("<video")) {
      if (autoplay && !processed.includes("autoplay")) {
        processed = processed.replace("<video", "<video autoplay");
      }
      // muted es crítico para autoplay en iOS
      if (autoplay && !processed.includes("muted")) {
        processed = processed.replace("<video", "<video muted");
      }
      if (!processed.includes("playsinline")) {
        processed = processed.replace("<video", "<video playsinline");
      }
      // Ocultar controles si estamos en modo full
      if (mode === "full" && processed.includes("controls")) {
        processed = processed.replace("controls", "");
      }
    }

    // Agregar loading="lazy" a cualquier iframe restante (ej: otros embeds)
    if (processed.includes("<iframe") && !processed.includes('loading="')) {
      processed = processed.replace(/<iframe/g, '<iframe loading="lazy"');
    }

    // LIMPIEZA FINAL: Si autoplay está desactivado, eliminar TODOS los rastros de autoplay/mute
    if (!autoplay) {
      // Limpiar de URLs dentro de src=""
      processed = processed.replace(/([?&])autoplay=[01]/gi, '$1');
      processed = processed.replace(/([?&])mute=[01]/gi, '$1');
      processed = processed.replace(/([?&])muted=[01]/gi, '$1');
      processed = processed.replace(/([?&])auto_play=(true|false|[01])/gi, '$1');
      // Limpiar parámetros vacíos que quedan (ej: ?& o &&)
      processed = processed.replace(/\?&/g, '?');
      processed = processed.replace(/&&+/g, '&');
      processed = processed.replace(/&"/g, '"');
      processed = processed.replace(/\?"/g, '"');
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
      loading = false;
      error = true;
      return;
    }

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
        return;
      }

      // Detectar SoundCloud directamente y generar embed
      if (url.includes("soundcloud.com")) {
        embedType = "SoundCloud";
        embedHTML = `<iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false"></iframe>`;
        loading = false;
        return;
      }

      // Detectar TikTok y generar embed
      if (url.includes("tiktok.com") || url.includes("vm.tiktok.com")) {
        embedType = "TikTok";
        const videoId = url.match(/video\/(\d+)/)?.[1] || '';
        if (videoId) {
          embedHTML = `<iframe src="https://www.tiktok.com/embed/v2/${videoId}" width="100%" height="100%" frameborder="0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
          loading = false;
          return;
        }
        // Si no encontramos videoId, usar oEmbed
        await fetchMetadata(url);
        return;
      }

      // Detectar Twitch y generar embed
      if (url.includes("twitch.tv")) {
        embedType = "Twitch";
        const channelMatch = url.match(/twitch\.tv\/([^\/\?]+)/);
        const videoMatch = url.match(/twitch\.tv\/videos\/(\d+)/);
        const clipMatch = url.match(/twitch\.tv\/[^\/]+\/clip\/([^\/\?]+)/) || url.match(/clips\.twitch\.tv\/([^\/\?]+)/);
        
        if (clipMatch) {
          embedHTML = `<iframe src="https://clips.twitch.tv/embed?clip=${clipMatch[1]}&parent=${window.location.hostname}" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`;
        } else if (videoMatch) {
          embedHTML = `<iframe src="https://player.twitch.tv/?video=${videoMatch[1]}&parent=${window.location.hostname}" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`;
        } else if (channelMatch) {
          embedHTML = `<iframe src="https://player.twitch.tv/?channel=${channelMatch[1]}&parent=${window.location.hostname}" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`;
        }
        loading = false;
        return;
      }

      // Detectar Twitter/X y generar embed
      if (url.includes("twitter.com") || url.includes("x.com")) {
        embedType = "Twitter";
        // Twitter requiere script externo, usar oEmbed
        await fetchMetadata(url);
        return;
      }

      // Detectar Apple Music y generar embed
      if (url.includes("music.apple.com")) {
        embedType = "Apple Music";
        // Convertir URL a embed URL
        const embedUrl = url.replace("music.apple.com", "embed.music.apple.com");
        embedHTML = `<iframe src="${embedUrl}" width="100%" height="175" frameborder="0" allow="autoplay; encrypted-media" sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation" style="border-radius: 12px;"></iframe>`;
        loading = false;
        return;
      }

      // Detectar Deezer y generar embed
      if (url.includes("deezer.com")) {
        embedType = "Deezer";
        const trackMatch = url.match(/track\/(\d+)/);
        const albumMatch = url.match(/album\/(\d+)/);
        const playlistMatch = url.match(/playlist\/(\d+)/);
        
        if (trackMatch) {
          embedHTML = `<iframe src="https://widget.deezer.com/widget/dark/track/${trackMatch[1]}" width="100%" height="130" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>`;
        } else if (albumMatch) {
          embedHTML = `<iframe src="https://widget.deezer.com/widget/dark/album/${albumMatch[1]}" width="100%" height="300" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>`;
        } else if (playlistMatch) {
          embedHTML = `<iframe src="https://widget.deezer.com/widget/dark/playlist/${playlistMatch[1]}" width="100%" height="300" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>`;
        }
        loading = false;
        return;
      }

      // Detectar Dailymotion y generar embed
      if (url.includes("dailymotion.com") || url.includes("dai.ly")) {
        embedType = "Dailymotion";
        const videoMatch = url.match(/video\/([a-z0-9]+)/i) || url.match(/dai\.ly\/([a-z0-9]+)/i);
        if (videoMatch) {
          embedHTML = `<iframe src="https://www.dailymotion.com/embed/video/${videoMatch[1]}" width="100%" height="100%" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
        }
        loading = false;
        return;
      }

      // Detectar Bandcamp y generar embed
      if (url.includes("bandcamp.com")) {
        embedType = "Bandcamp";
        // Bandcamp requiere oEmbed para obtener el ID correcto
        await fetchMetadata(url);
        return;
      }

      // TODOS los demás enlaces pasan por el sistema oEmbed/link-preview centralizado
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
      // Usar nuestro API de link-preview (oEmbed + Open Graph)
      try {
        const response = await fetch(
          `/api/link-preview?url=${encodeURIComponent(url)}`,
        );

        if (response.ok) {
          const result = await response.json();

          // Los datos están en result.data
          const data = result.data || result;

          if (data) {
            // Si tiene HTML embebido de oEmbed, usarlo
            if (data.embedHtml || data.html) {
              embedType = data.providerName || data.provider || "oembed";
              embedHTML = data.embedHtml || data.html;
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

    const response = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(url)}`,
      { signal: controller.signal },
    );
    clearTimeout(timeoutId);

    const data = await response.json();

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
      embedType = "generic"; // Asegurar que se muestre como card
    } else {
      // Fallback si Microlink falla
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

  // Cleanup cuando el componente se desmonte - destruir iframes completamente
  let containerRef: HTMLDivElement;
  
  // Cleanup: destruir iframes INMEDIATAMENTE cuando el componente se desmonte
  $effect(() => {
    return () => {
      if (containerRef) {
        const iframes = containerRef.querySelectorAll("iframe");
        iframes.forEach((iframe) => {
          // Detener reproducción ANTES de destruir
          try {
            const src = iframe.src || "";
            if (src.includes("youtube.com") || src.includes("youtu.be")) {
              iframe.contentWindow?.postMessage(
                '{"event":"command","func":"stopVideo","args":""}',
                "*"
              );
            } else if (src.includes("vimeo.com")) {
              iframe.contentWindow?.postMessage('{"method":"pause"}', "*");
            }
          } catch (e) {
            // Ignorar errores de cross-origin
          }
          
          // Vaciar src INMEDIATAMENTE para liberar memoria/GPU
          iframe.src = "about:blank";
          // Remover del DOM completamente
          iframe.remove();
        });
        
        // También limpiar videos HTML5
        const videos = containerRef.querySelectorAll("video");
        videos.forEach((video) => {
          video.pause();
          video.src = "";
          video.load(); // Forzar descarga de recursos
          video.remove();
        });
      }
    };
  });

  // Pausar medios cuando autoplay cambia a false
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
                }
              } catch (err) {
                console.warn(
                  "[MediaEmbed] No se pudo extraer URL original del proxy",
                );
              }
            }

            // Emitir evento antes de aplicar fallback
            if (img.src !== fallbackUrl && !img.src.includes(fallbackUrl)) {
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
    overflow: hidden !important;
    overflow-x: hidden !important;
    overflow-y: hidden !important;
    background: #000000;
    display: block;
    /* Ocultar scrollbars agresivamente */
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
    max-width: 100%;
  }
  
  .media-embed::-webkit-scrollbar,
  .media-embed *::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    background: transparent !important;
  }
  
  .media-embed *,
  .media-embed *::before,
  .media-embed *::after {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
    overflow: hidden !important;
    overflow-x: hidden !important;
    max-width: 100%;
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
    overflow: hidden;
    /* Ocultar scrollbars */
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  
  .embed-container::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }

  .embed-container :global(iframe),
  .embed-container :global(video),
  .embed-container :global(img) {
    width: 100%;
    height: 100%;
    object-fit: contain;
    overflow: hidden;
  }
  
  /* Ocultar scrollbars en iframes */
  .embed-container :global(iframe) {
    scrollbar-width: none;
    -ms-overflow-style: none;
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
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
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
