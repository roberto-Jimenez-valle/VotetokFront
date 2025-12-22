<script lang="ts">
  import { X, Wand2, Sparkles } from 'lucide-svelte';
  import type { Post, PostType } from './types';
  import { generateOptions } from './helpers';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    onCreatePost: (post: Post) => void;
  }

  let { isOpen = $bindable(false), onClose, onCreatePost }: Props = $props();

  let creatorPrompt = $state('');
  let creatorMode = $state<PostType>('standard');
  let creatorLoading = $state(false);

  const modes: PostType[] = ['standard', 'quiz', 'tierlist', 'swipe'];

  async function handleCreate() {
    if (!creatorPrompt.trim()) return;
    creatorLoading = true;
    
    // Simulate AI generation
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const seed = Date.now();
    const newPost: Post = {
      id: `ai-${seed}`,
      type: creatorMode,
      author: 'Tu AI',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=AI-${seed}`,
      time: 'Ahora',
      question: creatorPrompt,
      totalVotes: 0,
      comments: 0,
      reposts: 0,
      likes: 0,
      options: generateOptions(4, `ai-${seed}`, 'Opción Generada', Math.random() > 0.5 ? 'image' : 'text')
    };
    
    onCreatePost(newPost);
    creatorLoading = false;
    isOpen = false;
    creatorPrompt = '';
  }

  function handleBackdropClick() {
    if (!creatorLoading) {
      onClose();
    }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div 
      class="absolute inset-0 bg-slate-950/80 backdrop-blur-xl transition-opacity"
      onclick={handleBackdropClick}
      onkeydown={(e) => e.key === 'Escape' && handleBackdropClick()}
      role="button"
      tabindex="-1"
    ></div>
    
    <!-- Modal -->
    <div class="relative bg-slate-900/90 w-full max-w-lg rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-white/5 p-8">
      <!-- Header -->
      <div class="flex justify-between items-center mb-8">
        <h2 class="text-2xl font-black text-white flex items-center gap-3">
          <span class="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
            <Wand2 class="text-white" size={20} />
          </span>
          Crear con IA
        </h2>
        <button 
          onclick={onClose} 
          disabled={creatorLoading}
          class="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <X size={24}/>
        </button>
      </div>
      
      <div class="space-y-8">
        <!-- Mode Selection -->
        <div>
          <span class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 block ml-1">
            Modo
          </span>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {#each modes as mode}
              <button 
                onclick={() => creatorMode = mode}
                class="relative overflow-hidden flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all duration-300 {creatorMode === mode ? 'bg-slate-800 border-transparent shadow-lg scale-105' : 'bg-slate-800/40 border-white/5 text-slate-400 hover:bg-slate-800/60'}"
              >
                <span class="text-[10px] font-bold capitalize {creatorMode === mode ? 'text-white' : ''}">
                  {mode}
                </span>
              </button>
            {/each}
          </div>
        </div>
        
        <!-- Prompt Input -->
        <div>
          <label for="creator-prompt" class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 block ml-1">
            Tu Prompt
          </label>
          <textarea 
            id="creator-prompt"
            bind:value={creatorPrompt}
            placeholder="Ej: Mejores villanos de películas..."
            class="w-full bg-slate-900 border border-white/10 rounded-2xl p-5 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all min-h-[120px] resize-none placeholder-slate-600 font-medium"
            disabled={creatorLoading}
          ></textarea>
        </div>
        
        <!-- Submit Button -->
        <button 
          onclick={handleCreate}
          disabled={creatorLoading || !creatorPrompt.trim()}
          class="w-full bg-white hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black py-4 rounded-2xl transition-all shadow-xl hover:scale-[1.02] flex items-center justify-center gap-2 text-sm"
        >
          {#if creatorLoading}
            <div class="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
            Generando...
          {:else}
            <Sparkles size={18} class="text-indigo-600"/>
            Generar
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
