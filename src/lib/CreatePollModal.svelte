<script lang="ts">
  import { fade, fly, scale } from "svelte/transition";
  import {
    X,
    Plus,
    Trash2,
    Image as ImageIcon,
    Sparkles,
    BarChart2,
    Trophy,
    ListOrdered,
    Wand2,
    RefreshCw,
    Users,
    Wand,
    Loader2,
    ArrowLeftRight,
    Check,
    Clock,
    ChevronUp,
    ChevronDown,
    List,
    GripVertical,
    Calendar,
    Infinity,
    Zap,
    User,
    UserPlus,
    Globe,
    Lock,
    Search,
    ChevronLeft,
    Info,
  } from "lucide-svelte";
  import { createEventDispatcher, onMount, tick } from "svelte";
  import { currentUser, isAuthenticated } from "$lib/stores/auth";
  import { apiPost } from "$lib/api/client";
  import AuthModal from "$lib/AuthModal.svelte";

  const dispatch = createEventDispatcher<{
    created: any;
  }>();

  interface Props {
    isOpen?: boolean;
    buttonColors?: string[];
  }

  let { isOpen = $bindable(false), buttonColors = [] }: Props = $props();

  // --- CONFIGURACIÓN DE TIPOS ---
  const CREATOR_TYPES = [
    {
      id: "standard",
      label: "Votar",
      icon: BarChart2,
      color: "from-[#9ec264] to-[#7a994a]",
      textColor: "text-[#9ec264]",
      hex: "#9ec264",
      helpTitle: "Modo Votar",
      helpDesc:
        "La encuesta clásica de VouTop. Los usuarios eligen su opción favorita entre todas las disponibles. Ideal para conocer la opinión general sobre un tema específico.",
    },
    {
      id: "quiz",
      label: "Trivial",
      icon: Trophy,
      color: "from-[#f0b100] to-[#c79200]",
      textColor: "text-[#f0b100]",
      hex: "#f0b100",
      helpTitle: "Modo Trivial",
      helpDesc:
        'Pon a prueba a tu audiencia. Debes marcar una de las opciones como "correcta". Los usuarios verán si han acertado o fallado inmediatamente después de votar.',
    },
    {
      id: "tierlist",
      label: "Ranking",
      icon: ListOrdered,
      color: "from-[#4f39f6] to-[#3a29b8]",
      textColor: "text-[#4f39f6]",
      hex: "#4f39f6",
      helpTitle: "Modo Ranking",
      helpDesc:
        "Los usuarios elegirán su tier list. Permite que cada usuario organice las opciones a su gusto para generar un orden de preferencia promedio.",
    },
    {
      id: "swipe",
      label: "Swipe",
      icon: ArrowLeftRight,
      color: "from-[#e7000b] to-[#b00008]",
      textColor: "text-[#e7000b]",
      hex: "#e7000b",
      helpTitle: "Modo Swipe",
      helpDesc:
        "Votación rápida estilo carrusel. Los usuarios deslizan cada opción individualmente para dar su aprobación o rechazo.",
    },
  ];

  const COLLAB_MODES = [
    {
      id: "me",
      label: "Solo yo",
      desc: "Nadie más puede añadir opciones",
      icon: Lock,
    },
    {
      id: "friends",
      label: "Solo mis amigos",
      desc: "Solo tus amigos pueden colaborar",
      icon: UserPlus,
    },
    {
      id: "selected",
      label: "Solo los elegidos",
      desc: "Selecciona cuentas específicas",
      icon: User,
    },
    {
      id: "anyone",
      label: "Cualquiera",
      desc: "Cualquier usuario puede añadir opciones",
      icon: Globe,
    },
  ];

  const MOCK_FOLLOWING = [
    {
      id: "u1",
      name: "Alex Marín",
      username: "@alexm",
      avatar: "bg-orange-500",
    },
    { id: "u2", name: "Sara Vega", username: "@sarav", avatar: "bg-pink-500" },
    {
      id: "u3",
      name: "Marcos Ruiz",
      username: "@mruiz",
      avatar: "bg-emerald-500",
    },
    {
      id: "u4",
      name: "Elena Soler",
      username: "@elenas",
      avatar: "bg-indigo-500",
    },
    {
      id: "u5",
      name: "David Ortíz",
      username: "@david_o",
      avatar: "bg-blue-500",
    },
  ];

  // --- ESTADOS ---
  let type = $state("standard");
  let question = $state("");
  let isSubmitting = $state(false);
  let showAuthModal = $state(false);

  // --- ESTADOS DE MODALES ---
  let showCollabModal = $state(false);
  let showDurationModal = $state(false);
  let showSortPanel = $state(false);
  let showHelpModal = $state(false);

  // --- ESTADOS DE COLABORACIÓN ---
  let collabMode = $state("me");
  let isSelectingUsers = $state(false);
  let selectedUserIds = $state<string[]>([]);
  let userSearchQuery = $state("");

  // --- ESTADOS DE DURACIÓN ---
  let startsNow = $state(true);
  let isIndefinite = $state(true);
  let startDate = $state("");
  let endDate = $state("");

  // --- GESTIÓN DE OPCIONES ---
  let options = $state([
    {
      id: "opt-1",
      title: "",
      image: "",
      colorFrom: "from-indigo-600",
      colorTo: "to-slate-900",
      isCorrect: false,
    },
    {
      id: "opt-2",
      title: "",
      image: "",
      colorFrom: "from-purple-600",
      colorTo: "to-slate-900",
      isCorrect: false,
    },
  ]);
  let draggedItemIndex = $state<number | null>(null);
  let correctOptionId = $state("opt-1");
  let activeIndex = $state(0);

  let scrollContainer: HTMLElement | null = $state(null);
  let modalScrollContainer: HTMLElement | null = $state(null);

  // --- LÓGICA DERIVADA ---
  let activeTypeData = $derived(
    CREATOR_TYPES.find((t) => t.id === type) || CREATOR_TYPES[0],
  );

  let filteredUsers = $derived(
    MOCK_FOLLOWING.filter(
      (u) =>
        u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(userSearchQuery.toLowerCase()),
    ),
  );

  // --- FUNCIONES ---
  function getDurationConfig() {
    const startText = startsNow
      ? "Ahora"
      : startDate
        ? startDate.split("T")[0].split("-").reverse().slice(0, 2).join("/")
        : "---";
    if (isIndefinite) {
      return { text: startText, indefinite: true };
    }
    const endText = endDate
      ? endDate.split("T")[0].split("-").reverse().slice(0, 2).join("/")
      : "---";
    return { text: `${startText} - ${endText}`, indefinite: false };
  }

  function getCollabLabel() {
    if (collabMode === "selected") return `${selectedUserIds.length} elegidos`;
    return (
      COLLAB_MODES.find((m) => m.id === collabMode)?.label || "Colaboración"
    );
  }

  function getTypeDescription() {
    switch (type) {
      case "standard":
        return "Encuesta normal con voto único";
      case "quiz":
        return "Esta opción será la correcta";
      case "tierlist":
        return "Los usuarios elegirán su tier list";
      case "swipe":
        return "Mejor opción para votos múltiples";
      default:
        return "";
    }
  }

  function handleScroll(e: Event) {
    const container = e.target as HTMLElement;
    const cardWidth = container.offsetWidth * 0.72 + 20;
    const index = Math.round(container.scrollLeft / cardWidth);

    if (!isNaN(index) && index !== activeIndex) {
      activeIndex = index;
    }
  }

  async function scrollToIndex(index: number) {
    if (scrollContainer) {
      const cards = scrollContainer.querySelectorAll(".option-card-unit");
      if (cards[index]) {
        cards[index].scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }
    }
  }

  function onDragStart(index: number) {
    draggedItemIndex = index;
  }

  function onDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    const newOptions = [...options];
    const draggedItem = newOptions[draggedItemIndex];
    newOptions.splice(draggedItemIndex, 1);
    newOptions.splice(index, 0, draggedItem);
    draggedItemIndex = index;
    options = newOptions;
  }

  function onDragEnd() {
    draggedItemIndex = null;
  }

  function handleTypeChange(newType: string) {
    type = newType;
    if (newType === "quiz") {
      const currentOption = options[activeIndex] || options[0];
      if (currentOption) correctOptionId = currentOption.id;
    }
  }

  function addOption() {
    if (options.length >= 10) return;
    const colors = [
      "from-indigo-600",
      "from-purple-600",
      "from-pink-600",
      "from-emerald-600",
      "from-orange-600",
      "from-red-600",
    ];
    const newId = `opt-${Date.now()}`;
    options = [
      ...options,
      {
        id: newId,
        title: "",
        image: "",
        colorFrom: colors[options.length % colors.length],
        colorTo: "to-slate-950",
        isCorrect: false,
      },
    ];

    setTimeout(async () => {
      await scrollToIndex(options.length - 1);
      activeIndex = options.length - 1;
      if (showSortPanel && modalScrollContainer) {
        modalScrollContainer.scrollTo({
          top: modalScrollContainer.scrollHeight,
          behavior: "smooth",
        });
      }
    }, 100);
  }

  function removeOption(id: string) {
    if (options.length <= 2) return;
    options = options.filter((o) => o.id !== id);
    if (activeIndex >= options.length) activeIndex = options.length - 1;
  }

  function updateOption(id: string, field: string, value: any) {
    options = options.map((o) => (o.id === id ? { ...o, [field]: value } : o));
  }

  function toggleUserSelection(userId: string) {
    if (selectedUserIds.includes(userId)) {
      selectedUserIds = selectedUserIds.filter((id) => id !== userId);
    } else {
      selectedUserIds = [...selectedUserIds, userId];
    }
  }

  async function handleSubmit() {
    if (!question.trim() || isSubmitting) return;

    if (!$isAuthenticated || !$currentUser) {
      showAuthModal = true;
      return;
    }

    isSubmitting = true;
    try {
      const pollData = {
        userId: $currentUser.userId || ($currentUser as any).id,
        title: question.trim(),
        type: type,
        options: options.map((opt, idx) => ({
          optionKey: opt.id,
          optionLabel: opt.title || `Opción ${idx + 1}`,
          color: opt.colorFrom.replace("from-", ""), // Extract color name from tailwind class
          imageUrl: opt.image || undefined,
          isCorrect: type === "quiz" ? opt.id === correctOptionId : false,
          displayOrder: idx,
        })),
        settings: {
          collabMode,
          selectedUserIds: collabMode === "selected" ? selectedUserIds : [],
          startsNow,
          isIndefinite,
          startDate: !startsNow ? startDate : undefined,
          endDate: !isIndefinite ? endDate : undefined,
        },
      };

      const response = await apiPost("/api/polls", pollData);
      dispatch("created", response.data);
      close();
    } catch (error) {
      console.error("Error creating poll:", error);
    } finally {
      isSubmitting = false;
    }
  }

  function close() {
    isOpen = false;
    resetForm();
  }

  function resetForm() {
    question = "";
    type = "standard";
    options = [
      {
        id: "opt-1",
        title: "",
        image: "",
        colorFrom: "from-indigo-600",
        colorTo: "to-slate-900",
        isCorrect: false,
      },
      {
        id: "opt-2",
        title: "",
        image: "",
        colorFrom: "from-purple-600",
        colorTo: "to-slate-900",
        isCorrect: false,
      },
    ];
    collabMode = "me";
    selectedUserIds = [];
    startsNow = true;
    isIndefinite = true;
  }
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-[100] flex flex-col bg-[#050505] text-slate-100 font-sans overflow-hidden select-none tracking-tight"
    transition:fade
  >
    <!-- HEADER -->
    <header
      class="px-6 py-4 flex justify-between items-center z-50 bg-black/50 backdrop-blur-xl border-b border-white/5 flex-shrink-0"
    >
      <button
        onclick={close}
        class="p-2 bg-white/5 rounded-full text-white/70 hover:text-white transition-all active:scale-90"
      >
        <X size={22} />
      </button>
      <div class="flex items-center gap-3">
        <button
          onclick={handleSubmit}
          disabled={!question.trim() || isSubmitting}
          class={`px-8 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${question.trim() && !isSubmitting ? "bg-white text-black shadow-xl" : "bg-slate-900 text-slate-600 opacity-50"}`}
        >
          {#if isSubmitting}
            <div class="flex items-center gap-2">
              <Loader2 size={16} class="animate-spin" />
              <span>Procesando</span>
            </div>
          {:else}
            Lanzar
          {/if}
        </button>
      </div>
    </header>

    <main class="flex-1 flex flex-col min-h-0 overflow-hidden relative">
      <!-- MODAL GESTIÓN OPCIONES -->
      {#if showSortPanel}
        <div class="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div
            class="absolute inset-0 bg-black/80 backdrop-blur-md"
            onclick={() => (showSortPanel = false)}
          />
          <div
            class="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl flex flex-col max-h-[85vh]"
            in:scale={{ start: 0.95, duration: 300 }}
          >
            <div class="flex justify-between items-center py-2 mb-4">
              <h3
                class="text-xl font-black uppercase tracking-widest text-white/90 ml-2"
              >
                Gestionar opciones
              </h3>
              <button
                onclick={() => (showSortPanel = false)}
                class="p-3 bg-white/5 rounded-full"><X size={20} /></button
              >
            </div>

            <div
              bind:this={modalScrollContainer}
              class="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar"
            >
              {#each options as opt, idx (opt.id)}
                <div
                  draggable="true"
                  ondragstart={() => onDragStart(idx)}
                  ondragover={(e) => onDragOver(e, idx)}
                  ondragend={onDragEnd}
                  class={`relative border border-white/10 rounded-2xl p-4 flex items-center gap-4 transition-all duration-200 overflow-hidden cursor-grab active:cursor-grabbing ${draggedItemIndex === idx ? "opacity-20 scale-95 border-[#9ec264]" : "opacity-100"}`}
                >
                  <div
                    class={`absolute inset-0 bg-gradient-to-br ${opt.colorFrom} ${opt.colorTo} opacity-40 -z-10`}
                  />
                  <div class="absolute inset-0 bg-black/20 -z-10" />
                  <GripVertical size={18} class="text-white/40 flex-shrink-0" />
                  <div
                    class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0 relative"
                  >
                    {#if opt.image}
                      <img
                        src={opt.image}
                        class="w-full h-full object-cover"
                        alt=""
                      />
                    {:else}
                      <ImageIcon size={18} class="text-white/10" />
                    {/if}
                  </div>
                  <div
                    class="flex-1 min-w-0 text-sm font-bold text-white/90 truncate"
                  >
                    {opt.title || "Sin título"}
                  </div>
                  <button
                    onclick={() => removeOption(opt.id)}
                    class="p-2 text-red-500/50 hover:text-red-500 transition-colors relative z-10"
                    ><Trash2 size={18} /></button
                  >
                </div>
              {/each}
            </div>

            <div class="flex gap-3 mt-6">
              <button
                onclick={addOption}
                disabled={options.length >= 10}
                class="flex-1 py-4 bg-[#9ec264]/20 text-[#9ec264] border border-[#9ec264]/30 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
              >
                <Plus size={18} strokeWidth={4} />
                Añadir
              </button>
              <button
                onclick={() => (showSortPanel = false)}
                class="flex-[1.5] py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- MODAL DURACIÓN -->
      {#if showDurationModal}
        <div class="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div
            class="absolute inset-0 bg-black/80 backdrop-blur-md"
            onclick={() => (showDurationModal = false)}
          />
          <div
            class="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl"
            in:scale={{ start: 0.95, duration: 300 }}
          >
            <div class="flex justify-between items-center mb-8">
              <h3
                class="text-xl font-black uppercase tracking-widest text-white/90"
              >
                Duración
              </h3>
              <button
                onclick={() => (showDurationModal = false)}
                class="p-2 bg-white/5 rounded-full"><X size={20} /></button
              >
            </div>
            <div class="space-y-8 flex-1">
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <div class="flex items-center gap-4">
                    <div
                      class={`w-16 h-16 flex items-center justify-center rounded-2xl transition-all ${startsNow ? "bg-[#9ec264]/10 text-[#9ec264]" : "bg-white/5 text-white/20"}`}
                    >
                      <Zap size={24} />
                    </div>
                    <div>
                      <h4 class="text-base font-black uppercase tracking-wider">
                        Inicio
                      </h4>
                      <p
                        class="text-[10px] text-white/40 uppercase tracking-tighter"
                      >
                        {startsNow ? "Al instante" : "Programado"}
                      </p>
                    </div>
                  </div>
                  <button
                    onclick={() => (startsNow = !startsNow)}
                    class={`w-14 h-7 rounded-full p-1 transition-all ${startsNow ? "bg-[#9ec264]/80" : "bg-white/10"}`}
                    ><div
                      class={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${startsNow ? "translate-x-7" : "translate-x-0"}`}
                    /></button
                  >
                </div>
                {#if !startsNow}
                  <input
                    type="datetime-local"
                    bind:value={startDate}
                    class="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-[#9ec264] transition-all"
                  />
                {/if}
              </div>
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <div class="flex items-center gap-4">
                    <div
                      class={`w-16 h-16 flex items-center justify-center rounded-2xl transition-all ${isIndefinite ? "bg-[#9ec264]/10 text-[#9ec264]" : "bg-white/5 text-white/20"}`}
                    >
                      <Infinity size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h4 class="text-base font-black uppercase tracking-wider">
                        Cierre
                      </h4>
                      <p
                        class="text-[10px] text-white/40 uppercase tracking-tighter"
                      >
                        {isIndefinite ? "Indefinida" : "Límite"}
                      </p>
                    </div>
                  </div>
                  <button
                    onclick={() => (isIndefinite = !isIndefinite)}
                    class={`w-14 h-7 rounded-full p-1 transition-all ${isIndefinite ? "bg-[#9ec264]/80" : "bg-white/10"}`}
                    ><div
                      class={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${isIndefinite ? "translate-x-7" : "translate-x-0"}`}
                    /></button
                  >
                </div>
                {#if !isIndefinite}
                  <input
                    type="datetime-local"
                    bind:value={endDate}
                    class="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-[#9ec264] transition-all"
                  />
                {/if}
              </div>
            </div>
            <button
              onclick={() => (showDurationModal = false)}
              class="mt-10 w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all"
              >Guardar</button
            >
          </div>
        </div>
      {/if}

      <!-- MODAL COLABORACIÓN -->
      {#if showCollabModal}
        <div class="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div
            class="absolute inset-0 bg-black/80 backdrop-blur-md"
            onclick={() => {
              showCollabModal = false;
              isSelectingUsers = false;
            }}
          />
          <div
            class="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
            in:fly={{ y: 50, duration: 300 }}
          >
            <div class="flex justify-between items-center mb-6">
              <h3
                class="text-xl font-black uppercase tracking-widest text-white/90"
              >
                {isSelectingUsers ? "Elegir Usuarios" : "Colaboración"}
              </h3>
              <button
                onclick={() => {
                  showCollabModal = false;
                  isSelectingUsers = false;
                }}
                class="p-2 bg-white/5 rounded-full"><X size={20} /></button
              >
            </div>
            {#if !isSelectingUsers}
              <div class="grid gap-4 flex-1">
                {#each COLLAB_MODES as mode}
                  <button
                    onclick={() => {
                      if (mode.id === "selected") isSelectingUsers = true;
                      else {
                        collabMode = mode.id;
                        showCollabModal = false;
                      }
                    }}
                    class={`flex items-center gap-5 p-6 rounded-2xl border transition-all duration-300 ${collabMode === mode.id ? "bg-[#9ec264]/20 border-[#9ec264]/40 shadow-xl" : "bg-white/5 border-white/5 text-white/50"}`}
                  >
                    <div
                      class={`p-4 rounded-xl ${collabMode === mode.id ? "bg-[#9ec264]/20" : "bg-black/20"}`}
                    >
                      <mode.icon
                        size={26}
                        class={collabMode === mode.id
                          ? "text-[#9ec264]"
                          : "text-white/40"}
                      />
                    </div>
                    <div class="text-left flex-1">
                      <p
                        class={`font-black uppercase tracking-wider text-sm ${collabMode === mode.id ? "text-white" : "text-white/70"}`}
                      >
                        {mode.label}
                      </p>
                      <p
                        class={`text-[10px] tracking-tight ${collabMode === mode.id ? "text-white/60" : "text-white/30"}`}
                      >
                        {mode.desc}
                      </p>
                    </div>
                    {#if collabMode === mode.id && mode.id !== "selected"}
                      <Check size={22} class="ml-auto text-[#9ec264]" />
                    {/if}
                  </button>
                {/each}
              </div>
            {:else}
              <div class="flex flex-col flex-1 overflow-hidden">
                <div class="relative mb-6">
                  <Search
                    class="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"
                    size={18}
                  />
                  <input
                    bind:value={userSearchQuery}
                    placeholder="Buscar usuario..."
                    class="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:border-[#9ec264]/40 transition-all"
                  />
                </div>
                <div
                  class="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar"
                >
                  {#each filteredUsers as user}
                    <button
                      onclick={() => toggleUserSelection(user.id)}
                      class={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${selectedUserIds.includes(user.id) ? "bg-[#9ec264]/10 border-[#9ec264]/30" : "bg-white/5 border-transparent"}`}
                    >
                      <div
                        class={`w-10 h-10 rounded-full ${user.avatar} flex items-center justify-center text-white font-black text-sm`}
                      >
                        {user.name[0]}
                      </div>
                      <div class="text-left flex-1">
                        <p class="font-bold text-sm text-white">{user.name}</p>
                      </div>
                      <div
                        class={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedUserIds.includes(user.id) ? "bg-white border-white text-[#9ec264] scale-110" : "border-white/10"}`}
                      >
                        {#if selectedUserIds.includes(user.id)}
                          <Check size={14} strokeWidth={4} />
                        {/if}
                      </div>
                    </button>
                  {/each}
                </div>
                <button
                  onclick={() => {
                    collabMode = "selected";
                    isSelectingUsers = false;
                    showCollabModal = false;
                  }}
                  class="mt-6 w-full py-4 bg-[#9ec264] text-black rounded-2xl font-black uppercase tracking-widest shadow-2xl"
                  >Confirmar ({selectedUserIds.length})</button
                >
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- MODAL DE AYUDA / INFO -->
      {#if showHelpModal && activeTypeData}
        <div
          class="fixed inset-0 z-[200] flex items-center justify-center p-6"
          transition:fade
        >
          <div
            class="absolute inset-0 bg-black/80 backdrop-blur-md"
            onclick={() => (showHelpModal = false)}
          />
          <div
            class="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl"
            in:scale={{ start: 0.95, duration: 300 }}
          >
            <div class="flex flex-col items-center text-center">
              <div
                class="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-lg"
                style="background-color: {activeTypeData.hex}20; border: 1px solid {activeTypeData.hex}40"
              >
                <activeTypeData.icon
                  size={36}
                  style="color: {activeTypeData.hex}"
                />
              </div>
              <h3
                class="text-2xl font-black uppercase tracking-widest mb-4"
                style="color: {activeTypeData.hex}"
              >
                {activeTypeData.helpTitle}
              </h3>
              <p class="text-white/60 text-sm leading-relaxed mb-8">
                {activeTypeData.helpDesc}
              </p>
              <button
                onclick={() => (showHelpModal = false)}
                class="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl"
                >Entendido</button
              >
            </div>
          </div>
        </div>
      {/if}

      <!-- PREGUNTA Y CONFIGURACIÓN SUPERIOR -->
      <div class="px-6 pt-4 pb-2 flex-shrink-0">
        <textarea
          autofocus
          bind:value={question}
          placeholder="¿Qué quieres preguntar?"
          class="w-full bg-transparent border-none focus:ring-0 p-0 text-3xl font-black text-white placeholder-white/40 resize-none leading-none tracking-tighter outline-none appearance-none"
          rows="2"
        />
        <div class="flex items-center justify-center gap-2 mt-4">
          <button
            onclick={() => (showDurationModal = true)}
            class="flex items-center gap-3 px-6 py-2.5 bg-white/5 rounded-full border border-white/5 text-white active:scale-95 transition-all"
          >
            <Clock size={16} class="text-white/70" />
            <div
              class="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5"
            >
              {#if getDurationConfig().indefinite}
                <span>{getDurationConfig().text}</span>
                <span class="opacity-30">-</span>
                <Infinity size={18} strokeWidth={3} class="text-white" />
              {:else}
                <span>{getDurationConfig().text}</span>
              {/if}
            </div>
          </button>
          <button
            onclick={() => (showSortPanel = true)}
            class="flex items-center gap-3 px-6 py-2.5 bg-white/5 rounded-full border border-white/5 text-white/40 active:scale-90 transition-all text-[11px] font-black uppercase tracking-wider"
          >
            <List size={16} />
            Opciones ({options.length})
          </button>
        </div>
      </div>

      <!-- ÁREA CENTRAL: CARDS + PAGINACIÓN + INFO -->
      <div
        class="flex-1 flex flex-col justify-center min-h-0 py-1 overflow-hidden relative"
      >
        <div
          bind:this={scrollContainer}
          onscroll={handleScroll}
          class="flex h-full max-h-[580px] overflow-x-auto scrollbar-hide px-12 items-center gap-5 pb-0"
        >
          {#each options as opt, idx (opt.id)}
            <div
              class="option-card-unit real-option-card-main flex-shrink-0 w-[72vw] sm:w-[320px] h-full flex flex-col relative"
            >
              <div
                class={`flex-1 rounded-2xl border-2 shadow-2xl overflow-hidden relative transition-all duration-300 ${type === "quiz" && correctOptionId === opt.id ? "border-yellow-400 shadow-yellow-500/20" : "border-white/10"}`}
              >
                <div
                  class={`absolute inset-0 bg-gradient-to-br ${opt.colorFrom} ${opt.colorTo}`}
                >
                  {#if opt.image}
                    <img
                      src={opt.image}
                      class="w-full h-full object-cover animate-in fade-in"
                      alt=""
                    />
                  {/if}
                  <div
                    class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/10 to-transparent"
                  />
                </div>
                <div
                  class="absolute top-6 left-6 z-30 bg-black/40 backdrop-blur-xl px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 text-white/70"
                >
                  #{idx + 1}
                </div>
                <div
                  class="absolute inset-0 z-10 flex flex-col items-center justify-center p-10 text-center"
                >
                  <textarea
                    bind:value={opt.title}
                    placeholder="Escribe..."
                    class="w-full bg-transparent border-none focus:ring-0 p-0 text-2xl font-black text-white placeholder-white/30 resize-none leading-none outline-none appearance-none"
                    rows="3"
                  />
                </div>
                <div
                  class="absolute bottom-8 left-0 right-0 z-20 flex flex-col items-center gap-3 px-6"
                >
                  <div class="flex gap-2">
                    {#if type === "quiz"}
                      <button
                        onclick={() => (correctOptionId = opt.id)}
                        class={`p-4 rounded-2xl backdrop-blur-md border transition-all ${correctOptionId === opt.id ? "bg-[#f0b100] border-yellow-300 text-black shadow-[#f0b100]/20" : "bg-black/40 border-white/10 text-white/40"}`}
                        ><Trophy size={20} /></button
                      >
                    {/if}
                    <button
                      onclick={() =>
                        updateOption(
                          opt.id,
                          "image",
                          opt.image
                            ? ""
                            : `https://picsum.photos/seed/${opt.id}/800/1200`,
                        )}
                      class="p-4 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 text-white/60 active:scale-90 transition-all"
                      ><ImageIcon size={20} /></button
                    >
                  </div>
                </div>
              </div>
            </div>
          {/each}
          {#if options.length < 10}
            <div
              class="option-card-unit flex-shrink-0 w-[72vw] sm:w-[320px] h-full rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center transition-all relative bg-white/[0.01]"
            >
              <button
                onclick={addOption}
                class={`absolute top-1/2 -translate-y-1/2 z-[60] flex items-center justify-center text-white active:scale-90 transition-all duration-500 ease-in-out ${activeIndex === options.length ? "left-1/2 -translate-x-1/2 scale-150" : "md:left-1/2 md:-translate-x-1/2 -left-2 translate-x-0 scale-100"}`}
              >
                <Plus size={48} strokeWidth={3} />
              </button>
            </div>
          {/if}
          <div class="flex-shrink-0 w-2 h-full"></div>
        </div>

        <!-- NAVEGACIÓN E INFO -->
        <div class="flex flex-col items-center flex-shrink-0 py-4 mt-2">
          <div class="flex justify-center items-center gap-2 mb-4 md:hidden">
            {#each options as opt, idx (opt.id)}
              <button
                onclick={() => scrollToIndex(idx)}
                class={`transition-all duration-300 active:scale-90 ${activeIndex === idx ? "bg-white w-6 h-1 shadow-[0_0_10px_rgba(255,255,255,0.4)]" : "bg-white/10 w-1 h-1"} rounded-full`}
              />
            {/each}
            {#if options.length < 10}
              <button
                onclick={() => scrollToIndex(options.length)}
                class={`transition-all duration-300 active:scale-90 flex items-center justify-center ${activeIndex === options.length ? "text-white" : "text-white/20"}`}
              >
                <Plus
                  size={activeIndex === options.length ? 12 : 10}
                  strokeWidth={activeIndex === options.length ? 4 : 3}
                />
              </button>
            {/if}
          </div>
          <div class="h-14 flex flex-col items-center gap-2">
            {#if activeTypeData}
              <div
                class="flex items-center gap-3 px-3 py-2 rounded-full border backdrop-blur-xl shadow-lg transition-all"
                style="background-color: {activeTypeData.hex}15; border-color: {activeTypeData.hex}30"
              >
                <activeTypeData.icon
                  size={14}
                  style="color: {activeTypeData.hex}"
                />
                <span
                  class="text-[10px] font-black uppercase tracking-[0.15em] leading-none"
                  style="color: {activeTypeData.hex}"
                  >{activeTypeData.label}</span
                >
                <div class="w-px h-3 bg-white/10 mx-0.5" />
                <button
                  onclick={() => (showHelpModal = true)}
                  class="p-1 -mr-1 rounded-full text-white/40 hover:text-white transition-colors"
                  ><Info size={14} /></button
                >
              </div>
              <span
                class="text-[10px] font-black uppercase tracking-wider whitespace-nowrap opacity-60 mt-1"
                style="color: {activeTypeData.hex}">{getTypeDescription()}</span
              >
            {/if}
          </div>
        </div>
      </div>
    </main>

    <!-- DOCK INFERIOR -->
    <footer
      class="relative z-50 bg-black border-t border-white/5 pb-6 pt-4 flex-shrink-0"
    >
      <div class="flex flex-col items-center gap-6">
        <button
          onclick={() => (showCollabModal = true)}
          class={`flex items-center gap-2.5 px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all border active:scale-95 ${collabMode !== "me" ? "bg-[#9ec264]/80 text-black border-[#9ec264] shadow-xl" : "bg-white/5 text-white/40 border-white/5"}`}
        >
          <Users size={14} />
          {getCollabLabel()}
        </button>
        <div
          class="flex justify-center items-center gap-3 px-6 w-full max-w-md"
        >
          {#each CREATOR_TYPES as t}
            <button
              onclick={() => handleTypeChange(t.id)}
              class={`flex flex-col items-center gap-2 flex-1 transition-all duration-300 ${type === t.id ? "scale-105 opacity-100" : "opacity-30 grayscale"}`}
            >
              <div
                class={`p-3 rounded-2xl w-full flex items-center justify-center transition-all ${type === t.id ? `bg-gradient-to-br ${t.color} shadow-lg ring-1 ring-white/10` : "bg-slate-900 hover:bg-slate-800"}`}
              >
                {#if t.id === "swipe"}
                  <ArrowLeftRight size={20} class="text-white" />
                {:else}
                  <t.icon size={20} class="text-white" />
                {/if}
              </div>
              <span
                class={`text-[9px] font-black uppercase tracking-tighter ${type === t.id ? "text-white" : "text-slate-500"}`}
                >{t.label}</span
              >
            </button>
          {/each}
        </div>
      </div>
    </footer>

    <style>
      .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 20px;
      }
      .scrollbar-hide::-webkit-scrollbar {
        display: none;
      }
      .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    </style>
  </div>
{/if}

{#if showAuthModal}
  <AuthModal bind:isOpen={showAuthModal} />
{/if}
