<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  type ThemeMode = "light" | "dark";

  let isDark = $state(true);
  let currentPaletteIndex = $state(0);
  let isDragging = false;
  let startX = 0;
  let showPulse = $state(false);
  let currentPaletteColor = $state("#667eea"); // Color inicial
  let showPalettePicker = $state(false);
  let longPressTimer: number | null = null;
  let longPressTriggered = false;

  // Sistema de guardado de tema
  let lastPaletteChangeTime = 0;
  let showSaveModal = $state(false);
  let modalShowTime = 0;
  let rafId: number | null = null;
  let pendingSaveData: any = null;

  // Paletas oscuras (organizadas por tonalidades de arriba abajo)
  const darkPalettes = [
    // Grises/Negros
    {
      name: "Carbon",
      bg: "#0a0a0a",
      sphere: "#1a1a1a",
      stroke: "#2e2e2e",
      noData: "#141414",
      atmosphere: "#1a1a1a",
    },
    {
      name: "Dark",
      bg: "#000000",
      sphere: "#161b22",
      stroke: "#30363d",
      noData: "#181a20",
      atmosphere: "#161b22",
    },
    {
      name: "Slate",
      bg: "#0e1012",
      sphere: "#1a1e24",
      stroke: "#2e3640",
      noData: "#14181c",
      atmosphere: "#1a1e24",
    },
    {
      name: "Steel",
      bg: "#0f1113",
      sphere: "#1c2026",
      stroke: "#303840",
      noData: "#151a1e",
      atmosphere: "#1c2026",
    },
    {
      name: "Graphite",
      bg: "#0d0f10",
      sphere: "#191d20",
      stroke: "#2d3338",
      noData: "#13161a",
      atmosphere: "#191d20",
    },
    // Púrpuras/Violetas
    {
      name: "Deep Purple",
      bg: "#0a0015",
      sphere: "#1a0b2e",
      stroke: "#3d1e6d",
      noData: "#16003e",
      atmosphere: "#1a0b2e",
    },
    {
      name: "Midnight Purple",
      bg: "#0f0a1e",
      sphere: "#1a1234",
      stroke: "#2e2052",
      noData: "#150f28",
      atmosphere: "#1a1234",
    },
    {
      name: "Violet Night",
      bg: "#100920",
      sphere: "#1e1238",
      stroke: "#3a2561",
      noData: "#180e2d",
      atmosphere: "#1e1238",
    },
    {
      name: "Indigo Night",
      bg: "#08091a",
      sphere: "#0f1233",
      stroke: "#1e245c",
      noData: "#0c0e26",
      atmosphere: "#0f1233",
    },
    {
      name: "Magenta Night",
      bg: "#1a001a",
      sphere: "#2e002e",
      stroke: "#4d004d",
      noData: "#240024",
      atmosphere: "#2e002e",
    },
    // Azules
    {
      name: "Ocean Night",
      bg: "#001a2e",
      sphere: "#002642",
      stroke: "#284b63",
      noData: "#003049",
      atmosphere: "#002642",
    },
    {
      name: "Cyber Blue",
      bg: "#000d1a",
      sphere: "#001a33",
      stroke: "#00334d",
      noData: "#00152b",
      atmosphere: "#001a33",
    },
    {
      name: "Navy Deep",
      bg: "#00101c",
      sphere: "#001e36",
      stroke: "#003d5c",
      noData: "#001829",
      atmosphere: "#001e36",
    },
    {
      name: "Arctic Night",
      bg: "#0a1420",
      sphere: "#14263d",
      stroke: "#284a66",
      noData: "#101d2e",
      atmosphere: "#14263d",
    },
    // Cyan/Aqua/Turquesa
    {
      name: "Aqua Deep",
      bg: "#001a1a",
      sphere: "#002e2e",
      stroke: "#004d4d",
      noData: "#002424",
      atmosphere: "#002e2e",
    },
    {
      name: "Teal Deep",
      bg: "#081615",
      sphere: "#0f2928",
      stroke: "#1a4d4a",
      noData: "#0c1f1e",
      atmosphere: "#0f2928",
    },
    {
      name: "Turquoise Night",
      bg: "#001a15",
      sphere: "#002e26",
      stroke: "#004d42",
      noData: "#002219",
      atmosphere: "#002e26",
    },
    // Verdes
    {
      name: "Forest Dark",
      bg: "#0d1b0f",
      sphere: "#1b2e1f",
      stroke: "#2d4a33",
      noData: "#19291c",
      atmosphere: "#1b2e1f",
    },
    {
      name: "Emerald Night",
      bg: "#081512",
      sphere: "#102822",
      stroke: "#1d4a3d",
      noData: "#0d1e19",
      atmosphere: "#102822",
    },
    {
      name: "Jade Dark",
      bg: "#091713",
      sphere: "#112924",
      stroke: "#1f4a40",
      noData: "#0e201c",
      atmosphere: "#112924",
    },
    {
      name: "Lime Dark",
      bg: "#0f1a00",
      sphere: "#1c2e00",
      stroke: "#304d00",
      noData: "#162200",
      atmosphere: "#1c2e00",
    },
    // Amarillos/Dorados
    {
      name: "Gold Dark",
      bg: "#1a1500",
      sphere: "#2e2600",
      stroke: "#4d4200",
      noData: "#221c00",
      atmosphere: "#2e2600",
    },
    {
      name: "Amber Dark",
      bg: "#1a1200",
      sphere: "#2e2200",
      stroke: "#524000",
      noData: "#221a00",
      atmosphere: "#2e2200",
    },
    // Naranjas/Marrones
    {
      name: "Orange Night",
      bg: "#1a0800",
      sphere: "#2e1400",
      stroke: "#4d2400",
      noData: "#220e00",
      atmosphere: "#2e1400",
    },
    {
      name: "Copper Night",
      bg: "#1a0d00",
      sphere: "#2e1800",
      stroke: "#4d2800",
      noData: "#221100",
      atmosphere: "#2e1800",
    },
    {
      name: "Bronze Night",
      bg: "#1a0f00",
      sphere: "#2e1c00",
      stroke: "#523600",
      noData: "#221400",
      atmosphere: "#2e1c00",
    },
    // Rojos/Rosas
    {
      name: "Crimson Dark",
      bg: "#1a0000",
      sphere: "#2b0808",
      stroke: "#4a1414",
      noData: "#1f0303",
      atmosphere: "#2b0808",
    },
    {
      name: "Ruby Night",
      bg: "#180005",
      sphere: "#2a0a10",
      stroke: "#4d1a25",
      noData: "#1e0408",
      atmosphere: "#2a0a10",
    },
    {
      name: "Burgundy",
      bg: "#150008",
      sphere: "#26000f",
      stroke: "#45001f",
      noData: "#1b000c",
      atmosphere: "#26000f",
    },
    {
      name: "Pink Dark",
      bg: "#1a0010",
      sphere: "#2e001e",
      stroke: "#4d0033",
      noData: "#220016",
      atmosphere: "#2e001e",
    },
  ];

  // Paletas claras (organizadas por tonalidades de arriba abajo)
  const lightPalettes = [
    // Grises/Blancos
    {
      name: "Cloud",
      bg: "#d0d2d4",
      sphere: "#bcc0c4",
      stroke: "#a8adb2",
      noData: "#c4c7ca",
    },
    {
      name: "Pearl",
      bg: "#d3d3d3",
      sphere: "#c0c0c0",
      stroke: "#adadad",
      noData: "#c8c8c8",
    },
    {
      name: "Silver",
      bg: "#c8cacc",
      sphere: "#b5b8bb",
      stroke: "#a1a5a9",
      noData: "#bdc0c3",
    },
    {
      name: "Cream",
      bg: "#d7d7d7",
      sphere: "#c7c7c7",
      stroke: "#b7b7b7",
      noData: "#cfcfcf",
    },
    {
      name: "Ivory",
      bg: "#d8d8d6",
      sphere: "#c8c8c4",
      stroke: "#b8b8b2",
      noData: "#d0d0cd",
    },
    // Púrpuras/Violetas
    {
      name: "Lavender Mist",
      bg: "#d0cfe0",
      sphere: "#bdbccf",
      stroke: "#aaa8be",
      noData: "#c6c5d8",
    },
    {
      name: "Lilac Dream",
      bg: "#d2d0e1",
      sphere: "#bfbdd1",
      stroke: "#aca9c0",
      noData: "#c8c6d9",
    },
    {
      name: "Purple Haze",
      bg: "#c5c3d8",
      sphere: "#b2b0c5",
      stroke: "#9e9bb2",
      noData: "#bbb9ce",
    },
    {
      name: "Violet Soft",
      bg: "#d8d0e0",
      sphere: "#c5bdd1",
      stroke: "#b0a8be",
      noData: "#cec6d8",
    },
    // Azules
    {
      name: "Sky Whisper",
      bg: "#c8d7e1",
      sphere: "#b5c7d1",
      stroke: "#a0b6c0",
      noData: "#becfd9",
    },
    {
      name: "Ice Blue",
      bg: "#c9d8e2",
      sphere: "#b6c8d2",
      stroke: "#a1b7c1",
      noData: "#bfd0da",
    },
    {
      name: "Ocean Mist",
      bg: "#c0d0d8",
      sphere: "#adc0c8",
      stroke: "#98afb7",
      noData: "#b6c8d0",
    },
    {
      name: "Steel Blue",
      bg: "#b8c8d0",
      sphere: "#a5b8c0",
      stroke: "#90a7af",
      noData: "#aec0c8",
    },
    // Cyan/Aqua/Turquesa
    {
      name: "Aqua Light",
      bg: "#c0d8d8",
      sphere: "#adc8c8",
      stroke: "#98b7b7",
      noData: "#b6d0d0",
    },
    {
      name: "Turquoise Soft",
      bg: "#b8e0d8",
      sphere: "#a5d0c8",
      stroke: "#90bfb6",
      noData: "#add8d0",
    },
    // Verdes
    {
      name: "Mint Breeze",
      bg: "#c9d8d0",
      sphere: "#b6c8be",
      stroke: "#a1b7ab",
      noData: "#bfd0c6",
    },
    {
      name: "Sage Whisper",
      bg: "#cad9d0",
      sphere: "#b7c9be",
      stroke: "#a2b8ab",
      noData: "#c0d1c6",
    },
    {
      name: "Forest Mist",
      bg: "#c0d0c8",
      sphere: "#adc0b5",
      stroke: "#98afa0",
      noData: "#b6c8be",
    },
    {
      name: "Emerald Light",
      bg: "#b8d0c8",
      sphere: "#a5c0b5",
      stroke: "#90afa0",
      noData: "#aec8be",
    },
    {
      name: "Lime Light",
      bg: "#d0e0b8",
      sphere: "#c0d0a5",
      stroke: "#afbf90",
      noData: "#c8d8ad",
    },
    // Amarillos/Dorados
    {
      name: "Gold Light",
      bg: "#e0d8b0",
      sphere: "#d0c89d",
      stroke: "#bfb688",
      noData: "#d8d0a6",
    },
    {
      name: "Sand",
      bg: "#d8d0c8",
      sphere: "#c5bdb5",
      stroke: "#b0a89f",
      noData: "#cec6be",
    },
    {
      name: "Beige",
      bg: "#d8d0c0",
      sphere: "#c5bdad",
      stroke: "#b0a898",
      noData: "#cec6b6",
    },
    // Naranjas/Marrones
    {
      name: "Orange Light",
      bg: "#e0c8b8",
      sphere: "#d0b8a5",
      stroke: "#bfa690",
      noData: "#d8c0ad",
    },
    {
      name: "Copper Soft",
      bg: "#e0c8b0",
      sphere: "#d0b89d",
      stroke: "#bfa688",
      noData: "#d8c0a6",
    },
    {
      name: "Peach Silk",
      bg: "#dcd2ce",
      sphere: "#c9bfb9",
      stroke: "#b6aba4",
      noData: "#d6c8c3",
    },
    {
      name: "Terracotta",
      bg: "#d0c0b8",
      sphere: "#bdada5",
      stroke: "#a89890",
      noData: "#c6b6ae",
    },
    // Rosas/Rojos
    {
      name: "Rose Blush",
      bg: "#dcd0d3",
      sphere: "#c9bdc0",
      stroke: "#b6a9ad",
      noData: "#d6c6c9",
    },
    {
      name: "Coral Soft",
      bg: "#d8c8c8",
      sphere: "#c5b5b5",
      stroke: "#b0a0a0",
      noData: "#cebebe",
    },
    {
      name: "Pink Soft",
      bg: "#e0c0d0",
      sphere: "#d0adc0",
      stroke: "#bf98af",
      noData: "#d8b6c8",
    },
  ];

  onMount(() => {
    // Intentar cargar tema guardado de localStorage
    const savedTheme = loadSavedTheme();

    if (savedTheme) {
      // Aplicar tema guardado
      console.log("[Theme] Cargando tema guardado:", savedTheme);
      isDark = savedTheme.isDark;
      currentPaletteIndex = savedTheme.paletteIndex;

      // NO aplicar clase .dark aquí - ya lo hizo app.html
      // Solo verificar que esté sincronizado
      const hasDarkClass = document.documentElement.classList.contains("dark");
      console.log(
        "[Theme] onMount - Estado del DOM tiene .dark:",
        hasDarkClass,
        "isDark:",
        isDark,
      );

      if (hasDarkClass !== isDark) {
        console.warn("[Theme] ⚠️ DESINCRONIZACIÓN detectada! Corrigiendo...");
        if (isDark) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }

      const palettes = isDark ? darkPalettes : lightPalettes;
      const savedPalette = palettes[currentPaletteIndex];
      currentPaletteColor = savedPalette.sphere;

      console.log("[Theme] Paleta guardada a aplicar:", savedPalette);

      // Disparar evento con tema guardado - delay más largo para asegurar que GlobeGL esté listo
      setTimeout(() => {
        console.log(
          "[Theme] Disparando evento palettechange con paleta guardada",
        );
        dispatch("palettechange", { ...savedPalette, isDark });
        window.dispatchEvent(
          new CustomEvent("palettechange", {
            detail: { ...savedPalette, isDark },
          }),
        );
      }, 500); // Aumentado a 500ms
    } else {
      // Detectar tema actual (por defecto debe ser dark/luna)
      const hasDarkClass = document.documentElement.classList.contains("dark");
      isDark = hasDarkClass;

      // Si no tiene ninguna clase, forzar dark mode
      if (!hasDarkClass) {
        document.documentElement.classList.add("dark");
        isDark = true;
      }

      // Inicializar con el color de la primera paleta según el tema
      const initialPalettes = isDark ? darkPalettes : lightPalettes;
      const initialPalette = initialPalettes[0];
      currentPaletteColor = initialPalette.sphere;

      // IMPORTANTE: Disparar el evento inicial con delay
      // para asegurar que GlobeGL ya montó su listener
      setTimeout(() => {
        dispatch("palettechange", { ...initialPalette, isDark });
        // También disparar evento global
        window.dispatchEvent(
          new CustomEvent("palettechange", {
            detail: { ...initialPalette, isDark },
          }),
        );
      }, 200);
    }

    // Iniciar loop de verificación
    checkForSavePrompt();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  });

  function handleMouseDown(e: MouseEvent) {
    isDragging = false;
    startX = e.clientX;
    longPressTriggered = false;

    // Iniciar timer para long press (500ms)
    longPressTimer = window.setTimeout(() => {
      longPressTriggered = true;
      showPalettePicker = true;
    }, 500);
  }

  function handleMouseMove(e: MouseEvent) {
    if (e.buttons === 1) {
      // Si el botón está presionado
      const diff = Math.abs(e.clientX - startX);
      if (diff > 5) {
        // Umbral de 5px para considerar drag
        isDragging = true;
        // Cancelar long press si hay movimiento
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }
    }
  }

  function handleMouseUp(e: MouseEvent) {
    // Cancelar timer de long press
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    // Si se activó el long press, no hacer nada más
    if (longPressTriggered) {
      isDragging = false;
      return;
    }

    const diff = Math.abs(e.clientX - startX);

    if (!isDragging && diff < 5) {
      // Es un click → cambiar paleta
      cyclePalette();
    } else if (isDragging) {
      // Es un drag → cambiar tema día/noche
      isDark = !isDark;
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }

      // Actualizar color del botón según el nuevo tema
      const palettes = isDark ? darkPalettes : lightPalettes;
      currentPaletteColor =
        palettes[currentPaletteIndex % palettes.length].sphere;
      const newPalette = palettes[currentPaletteIndex % palettes.length];

      // Disparar evento de cambio de paleta para actualizar el globo
      dispatch("palettechange", { ...newPalette, isDark });
      window.dispatchEvent(
        new CustomEvent("palettechange", { detail: { ...newPalette, isDark } }),
      );

      dispatch("themechange", { mode: isDark ? "dark" : "light" });
    }

    isDragging = false;
  }

  function handleTouchStart(e: TouchEvent) {
    isDragging = false;
    startX = e.touches[0].clientX;
    longPressTriggered = false;

    // Iniciar timer para long press (500ms)
    longPressTimer = window.setTimeout(() => {
      longPressTriggered = true;
      showPalettePicker = true;
    }, 500);
  }

  function handleTouchMove(e: TouchEvent) {
    const diff = Math.abs(e.touches[0].clientX - startX);
    if (diff > 5) {
      isDragging = true;
      // Cancelar long press si hay movimiento
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    // Cancelar timer de long press
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    // Si se activó el long press, no hacer nada más
    if (longPressTriggered) {
      isDragging = false;
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const diff = Math.abs(endX - startX);

    if (!isDragging && diff < 5) {
      // Es un tap → cambiar paleta
      cyclePalette();
    } else if (isDragging) {
      // Es un drag → cambiar tema día/noche
      isDark = !isDark;
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }

      // Actualizar color del botón según el nuevo tema
      const palettes = isDark ? darkPalettes : lightPalettes;
      currentPaletteColor =
        palettes[currentPaletteIndex % palettes.length].sphere;
      const newPalette = palettes[currentPaletteIndex % palettes.length];

      // Disparar evento de cambio de paleta para actualizar el globo
      dispatch("palettechange", { ...newPalette, isDark });
      window.dispatchEvent(
        new CustomEvent("palettechange", { detail: { ...newPalette, isDark } }),
      );

      dispatch("themechange", { mode: isDark ? "dark" : "light" });
    }

    isDragging = false;
  }

  function cyclePalette() {
    // Elegir siguiente paleta según el tema actual (usar variable de estado, no DOM)
    console.log(
      "[Theme] cyclePalette - isDark:",
      isDark,
      "clase .dark en DOM:",
      document.documentElement.classList.contains("dark"),
    );
    const palettes = isDark ? darkPalettes : lightPalettes;

    currentPaletteIndex = (currentPaletteIndex + 1) % palettes.length;
    const palette = palettes[currentPaletteIndex];

    // Actualizar el color del botón al color de la paleta
    currentPaletteColor = palette.sphere;

    // Efecto visual de pulso
    showPulse = true;
    setTimeout(() => {
      showPulse = false;
    }, 600);

    console.log(
      "[Theme] Disparando palettechange:",
      palette.name,
      "isDark:",
      isDark,
    );
    // Disparar evento con la nueva paleta
    dispatch("palettechange", { ...palette, isDark });
    window.dispatchEvent(
      new CustomEvent("palettechange", { detail: { ...palette, isDark } }),
    );

    // Registrar cambio de paleta para sistema de guardado
    onPaletteChange(isDark);
  }

  function selectPalette(index: number) {
    const palettes = isDark ? darkPalettes : lightPalettes;

    currentPaletteIndex = index;
    const palette = palettes[index];

    // Actualizar el color del botón
    currentPaletteColor = palette.sphere;

    // Efecto visual de pulso
    showPulse = true;
    setTimeout(() => {
      showPulse = false;
    }, 600);

    // Disparar evento con la paleta seleccionada
    dispatch("palettechange", { ...palette, isDark });
    window.dispatchEvent(
      new CustomEvent("palettechange", { detail: { ...palette, isDark } }),
    );

    // Cerrar el picker
    showPalettePicker = false;

    // Registrar cambio de paleta para sistema de guardado
    onPaletteChange(isDark);
  }

  // Funciones del sistema de guardado
  function onPaletteChange(isDarkMode: boolean) {
    lastPaletteChangeTime = performance.now();
    showSaveModal = false; // Ocultar modal si estaba visible
    modalShowTime = 0;
    pendingSaveData = { isDark: isDarkMode, paletteIndex: currentPaletteIndex };
    console.log("[Theme] 🎨 Cambio de paleta registrado:", pendingSaveData);
  }

  function checkForSavePrompt() {
    const now = performance.now();

    // Verificar si han pasado 5 segundos desde el último cambio
    if (
      lastPaletteChangeTime > 0 &&
      !showSaveModal &&
      now - lastPaletteChangeTime >= 5000
    ) {
      console.log("[Theme] ⏰ 5 segundos pasados, mostrando modal de guardado");
      // Siempre mostrar modal para permitir actualizar tema guardado
      showSaveModal = true;
      modalShowTime = now;
      lastPaletteChangeTime = 0; // Resetear para evitar múltiples shows
    }

    // Auto-cerrar modal después de 4 segundos
    if (showSaveModal && modalShowTime > 0 && now - modalShowTime >= 4000) {
      console.log(
        "[Theme] ⏰ 4 segundos pasados, cerrando modal automáticamente",
      );
      showSaveModal = false;
      modalShowTime = 0;
    }

    rafId = requestAnimationFrame(checkForSavePrompt);
  }

  function saveTheme() {
    if (pendingSaveData) {
      const dataToSave = JSON.stringify(pendingSaveData);
      localStorage.setItem("voutop-theme", dataToSave);
      console.log("[Theme] ✅ Tema guardado en localStorage:", pendingSaveData);
      console.log("[Theme] Datos guardados:", dataToSave);
    } else {
      console.warn("[Theme] ⚠️ No hay pendingSaveData para guardar");
    }
    showSaveModal = false;
    modalShowTime = 0;
  }

  function dismissSaveModal() {
    showSaveModal = false;
    modalShowTime = 0;
  }

  function loadSavedTheme() {
    try {
      const saved = localStorage.getItem("voutop-theme");
      console.log("[Theme] localStorage raw:", saved);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log("[Theme] Tema parseado de localStorage:", parsed);
        return parsed;
      } else {
        console.log("[Theme] No hay tema guardado en localStorage");
      }
    } catch (e) {
      console.error("[Theme] ❌ Error al cargar tema guardado:", e);
    }
    return null;
  }
</script>

<button
  class="unified-toggle"
  onmousedown={handleMouseDown}
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  aria-label="Toggle theme"
  title="Click: cambiar paleta | Drag: cambiar día/noche"
>
  <div class="toggle-track">
    <div
      class="toggle-icon"
      class:dark={isDark}
      class:pulse-effect={showPulse}
      style="background: {currentPaletteColor};"
    >
      {#if isDark}
        <!-- Luna -->
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      {:else}
        <!-- Sol -->
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      {/if}
    </div>
  </div>
</button>

<!-- Selector de paletas -->
{#if showPalettePicker}
  <div
    class="palette-picker-overlay"
    role="button"
    tabindex="0"
    onclick={() => (showPalettePicker = false)}
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showPalettePicker = false;
      }
    }}
  >
    <div
      class="palette-picker"
      role="dialog"
      aria-label="Selector de paletas"
      tabindex="0"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <div class="palette-picker-header">
        <h3>Selecciona una paleta</h3>
        <button class="close-btn" onclick={() => (showPalettePicker = false)}
          >✕</button
        >
      </div>
      <div class="palette-grid">
        {#each isDark ? darkPalettes : lightPalettes as palette, index}
          <button
            class="palette-item"
            class:active={currentPaletteIndex === index}
            onclick={() => selectPalette(index)}
            style="background: {palette.sphere};"
          >
            <span class="palette-name">{palette.name}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<!-- Snackbar de guardado de tema (top-right) -->
{#if showSaveModal}
  <div class="save-snackbar">
    <div class="save-snackbar-icon">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    </div>
    <div class="save-snackbar-content">
      <span class="save-snackbar-title">Guardar personalización</span>
      <span class="save-snackbar-subtitle"
        >Aplicar este tema en este dispositivo</span
      >
    </div>
    <div class="save-snackbar-actions">
      <button class="save-action-btn save-action-no" onclick={dismissSaveModal}>
        No
      </button>
      <button class="save-action-btn save-action-yes" onclick={saveTheme}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Guardar
      </button>
    </div>
    <button
      class="save-snackbar-close"
      onclick={dismissSaveModal}
      aria-label="Cerrar"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>
{/if}

<style>
  .unified-toggle {
    position: fixed;
    top: 4px;
    right: 120px; /* Más separado de "Para ti" */
    z-index: 10001;
    background: transparent;
    border: none;
    padding: 0;
    cursor: grab;
    -webkit-tap-highlight-color: transparent;
  }

  .unified-toggle:active {
    cursor: grabbing;
  }

  .toggle-track {
    width: 56px;
    height: 28px;
    background: rgba(0, 0, 0, 0.15);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .unified-toggle:hover .toggle-track {
    background: rgba(0, 0, 0, 0.2);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .toggle-icon {
    width: 24px;
    height: 24px;
    /* background dinámico aplicado por style="" */
    border-radius: 50%;
    position: absolute;
    top: 2px;
    left: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .toggle-icon.dark {
    transform: translateX(28px); /* Derecha cuando modo oscuro */
  }

  .toggle-icon.pulse-effect {
    animation: colorPulse 0.6s ease-out;
  }

  .toggle-icon svg {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  }

  @keyframes colorPulse {
    0%,
    100% {
      transform: scale(1);
      filter: brightness(1);
    }
    50% {
      transform: scale(1.1);
      filter: brightness(1.3);
    }
  }

  .toggle-icon.dark.pulse-effect {
    animation: colorPulseDark 0.6s ease-out;
  }

  @keyframes colorPulseDark {
    0%,
    100% {
      transform: translateX(28px) scale(1);
      filter: brightness(1);
    }
    50% {
      transform: translateX(28px) scale(1.1);
      filter: brightness(1.3);
    }
  }

  /* Estilos globales para modo claro */
  :global(html:not(.dark) header h1) {
    color: #1a1a1a !important;
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.5) !important;
  }

  :global(html:not(.dark) .tabs-trigger) {
    color: #1a1a1a !important;
  }

  :global(html:not(.dark) .tabs-trigger svg) {
    color: #1a1a1a !important;
  }

  /* Toggle integrado en modo claro */
  :global(html:not(.dark)) .toggle-track {
    background: rgba(255, 255, 255, 0.3);
    border: 1px solid rgba(0, 0, 0, 0.15);
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  :global(html:not(.dark)) .unified-toggle:hover .toggle-track {
    background: rgba(255, 255, 255, 0.4);
    border-color: rgba(0, 0, 0, 0.2);
  }

  /* Selector de paletas */
  .palette-picker-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 10002;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease-out;
  }

  .palette-picker {
    background: rgba(20, 20, 20, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 14px;
    max-width: 620px;
    width: 95%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.3s ease-out;
  }

  .palette-picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .palette-picker-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: #ffffff;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .palette-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
  }

  .palette-item {
    padding: 8px 6px;
    border-radius: 8px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    position: relative;
    overflow: hidden;
  }

  .palette-item:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .palette-item.active {
    border-color: #ffffff;
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.2);
  }

  .palette-name {
    color: #ffffff;
    font-size: 10px;
    font-weight: 500;
    text-align: center;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
    z-index: 1;
    line-height: 1.2;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
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

  /* Snackbar de guardado - estilo profesional tipo Material Design */
  .save-snackbar {
    position: fixed;
    top: 64px;
    right: 24px;
    z-index: 20000;

    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 20px;

    background: linear-gradient(
      135deg,
      rgba(24, 24, 27, 0.96),
      rgba(18, 18, 20, 0.96)
    );
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.06),
      inset 0 0 0 1px rgba(255, 255, 255, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);

    animation: slideInRight 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    max-width: 440px;
    min-height: 80px;
  }

  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .save-snackbar-icon {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      135deg,
      rgba(16, 185, 129, 0.12),
      rgba(5, 150, 105, 0.12)
    );
    border: 1.5px solid rgba(16, 185, 129, 0.3);
    border-radius: 12px;
    color: rgba(16, 185, 129, 0.95);
    box-shadow:
      0 0 0 4px rgba(16, 185, 129, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .save-snackbar-icon svg {
    width: 22px;
    height: 22px;
  }

  .save-snackbar-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .save-snackbar-title {
    font-size: 15px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.98);
    line-height: 1.3;
    letter-spacing: -0.01em;
  }

  .save-snackbar-subtitle {
    font-size: 13px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.65);
    line-height: 1.3;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .save-snackbar-subtitle::before {
    content: "";
    width: 4px;
    height: 4px;
    background: rgba(16, 185, 129, 0.6);
    border-radius: 50%;
    display: inline-block;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.6;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.2);
    }
  }

  .save-snackbar-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .save-action-btn {
    padding: 10px 20px; /* Más grande */
    border-radius: 9px;
    font-size: 14px; /* Más grande */
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
    min-height: 40px; /* Altura mínima */
  }

  .save-action-yes {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border: none;
    box-shadow:
      0 2px 12px rgba(16, 185, 129, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    position: relative;
    overflow: hidden;
  }

  .save-action-yes::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), transparent);
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .save-action-yes:hover {
    transform: translateY(-1px);
    box-shadow:
      0 4px 16px rgba(16, 185, 129, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  .save-action-yes:hover::before {
    opacity: 1;
  }

  .save-action-yes:active {
    transform: translateY(0);
  }

  .save-action-no {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .save-action-no:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.95);
  }

  .save-snackbar-close {
    flex-shrink: 0;
    width: 36px; /* Más grande */
    height: 36px; /* Más grande */
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s ease;
    margin-left: 8px;
  }

  .save-snackbar-close:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.8);
  }

  /* Modo claro para snackbar */
  :global(html:not(.dark)) .save-snackbar {
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.98),
      rgba(250, 250, 252, 0.98)
    );
    border-color: rgba(0, 0, 0, 0.12);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.12),
      0 0 0 1px rgba(0, 0, 0, 0.05),
      inset 0 1px 0 rgba(255, 255, 255, 0.8);
  }

  :global(html:not(.dark)) .save-snackbar-icon {
    background: linear-gradient(
      135deg,
      rgba(16, 185, 129, 0.08),
      rgba(5, 150, 105, 0.08)
    );
    border-color: rgba(16, 185, 129, 0.25);
    color: rgba(5, 150, 105, 0.9);
    box-shadow:
      0 0 0 4px rgba(16, 185, 129, 0.06),
      inset 0 1px 0 rgba(255, 255, 255, 0.5);
  }

  :global(html:not(.dark)) .save-snackbar-title {
    color: rgba(0, 0, 0, 0.95);
  }

  :global(html:not(.dark)) .save-snackbar-subtitle {
    color: rgba(0, 0, 0, 0.6);
  }

  :global(html:not(.dark)) .save-snackbar-subtitle::before {
    background: rgba(16, 185, 129, 0.7);
  }

  :global(html:not(.dark)) .save-action-no {
    background: rgba(0, 0, 0, 0.04);
    color: rgba(0, 0, 0, 0.75);
    border-color: rgba(0, 0, 0, 0.15);
  }

  :global(html:not(.dark)) .save-action-no:hover {
    background: rgba(0, 0, 0, 0.08);
    border-color: rgba(0, 0, 0, 0.2);
    color: rgba(0, 0, 0, 0.9);
  }

  :global(html:not(.dark)) .save-snackbar-close {
    background: rgba(0, 0, 0, 0.03);
    border-color: rgba(0, 0, 0, 0.1);
    color: rgba(0, 0, 0, 0.5);
  }

  :global(html:not(.dark)) .save-snackbar-close:hover {
    background: rgba(0, 0, 0, 0.06);
    border-color: rgba(0, 0, 0, 0.15);
    color: rgba(0, 0, 0, 0.75);
  }

  /* Responsive para móvil */
  @media (max-width: 640px) {
    .save-snackbar {
      top: 50px;
      left: 12px;
      right: 12px;
      max-width: none;
      padding: 14px 16px;
      min-height: 52px;
    }

    .save-snackbar-title {
      font-size: 14px;
    }

    .save-snackbar-subtitle {
      font-size: 12px;
    }

    .save-action-btn {
      padding: 6px 12px;
      font-size: 12px;
    }

    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  }
</style>
