<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { X, Send, Heart, MessageCircle, MoreHorizontal, Trash2, Loader2 } from 'lucide-svelte';
  import { currentUser } from '$lib/stores/auth';
  import { apiGet, apiPost, apiDelete } from '$lib/api/client';
  import AuthModal from '$lib/AuthModal.svelte';
  
  interface Comment {
    id: number;
    content: string;
    createdAt: string;
    likesCount: number;
    user: {
      id: number;
      username: string;
      displayName: string;
      avatarUrl?: string;
      verified?: boolean;
    };
    replies?: Comment[];
    parentCommentId?: number;
  }
  
  // Props
  let { 
    isOpen = $bindable(false),
    pollId,
    pollTitle = ''
  }: {
    isOpen: boolean;
    pollId: number;
    pollTitle?: string;
  } = $props();
  
  // State
  let comments = $state<Comment[]>([]);
  let newComment = $state('');
  let replyingTo = $state<Comment | null>(null);
  let loading = $state(false);
  let submitting = $state(false);
  let error = $state<string | null>(null);
  let inputRef = $state<HTMLTextAreaElement | null>(null);
  
  // Auth modal
  let showAuthModal = $state(false);
  
  // Swipe to close
  let touchStartY = 0;
  let currentTranslateY = $state(0);
  let isDragging = $state(false);
  
  const DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23374151"/%3E%3Cpath d="M20 20a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0 2c-5.33 0-16 2.67-16 8v4h32v-4c0-5.33-10.67-8-16-8z" fill="%236b7280"/%3E%3C/svg%3E';
  
  // Load comments when modal opens
  $effect(() => {
    if (isOpen && pollId) {
      loadComments();
    }
  });
  
  async function loadComments() {
    loading = true;
    error = null;
    
    try {
      const response = await apiGet(`/api/polls/${pollId}/comments`);
      comments = response.data || [];
    } catch (err: any) {
      error = err.message || 'Error al cargar comentarios';
      console.error('Error loading comments:', err);
    } finally {
      loading = false;
    }
  }
  
  async function submitComment() {
    if (!newComment.trim() || !$currentUser) return;
    
    submitting = true;
    
    try {
      const payload = {
        content: newComment.trim(),
        parentCommentId: replyingTo?.id || null,
        userId: ($currentUser as any).userId || ($currentUser as any).id
      };
      
      const response = await apiPost(`/api/polls/${pollId}/comments`, payload);
      
      if (replyingTo) {
        // Add reply to parent comment
        const parentIndex = comments.findIndex(c => c.id === replyingTo!.id);
        if (parentIndex !== -1) {
          if (!comments[parentIndex].replies) {
            comments[parentIndex].replies = [];
          }
          comments[parentIndex].replies!.push(response.data);
        }
      } else {
        // Add new top-level comment
        comments = [response.data, ...comments];
      }
      
      newComment = '';
      replyingTo = null;
    } catch (err: any) {
      console.error('Error posting comment:', err);
      error = err.message || 'Error al publicar comentario';
    } finally {
      submitting = false;
    }
  }
  
  async function deleteComment(commentId: number) {
    try {
      await apiDelete(`/api/polls/${pollId}/comments/${commentId}`);
      
      // Remove from list
      comments = comments.filter(c => c.id !== commentId);
      
      // Also remove from replies
      comments = comments.map(c => ({
        ...c,
        replies: c.replies?.filter(r => r.id !== commentId)
      }));
    } catch (err: any) {
      console.error('Error deleting comment:', err);
    }
  }
  
  function startReply(comment: Comment) {
    replyingTo = comment;
    setTimeout(() => inputRef?.focus(), 100);
  }
  
  function cancelReply() {
    replyingTo = null;
  }
  
  function close() {
    isOpen = false;
    replyingTo = null;
    newComment = '';
  }
  
  function getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }
  
  // Touch handlers for swipe to close
  function handleTouchStart(e: TouchEvent) {
    touchStartY = e.touches[0].clientY;
    isDragging = true;
  }
  
  function handleTouchMove(e: TouchEvent) {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - touchStartY;
    if (deltaY > 0) {
      currentTranslateY = deltaY;
    }
  }
  
  function handleTouchEnd() {
    isDragging = false;
    if (currentTranslateY > 150) {
      close();
    }
    currentTranslateY = 0;
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitComment();
    }
  }
</script>

{#if isOpen}
  <!-- Overlay -->
  <div 
    class="comments-overlay"
    role="button"
    tabindex="-1"
    aria-label="Cerrar comentarios"
    onclick={close}
    onkeydown={(e) => e.key === 'Escape' && close()}
    transition:fade={{ duration: 200 }}
  ></div>
  
  <!-- Modal -->
  <div 
    class="comments-modal"
    style="transform: translateY({currentTranslateY}px)"
    transition:fly={{ y: '100%', duration: 300 }}
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
  >
    <!-- Handle -->
    <div class="modal-handle">
      <div class="handle-bar"></div>
    </div>
    
    <!-- Header -->
    <div class="modal-header">
      <h3 class="modal-title">Comentarios</h3>
      <button class="close-btn" onclick={close} type="button" aria-label="Cerrar">
        <X size={20} />
      </button>
    </div>
    
    <!-- Comments List -->
    <div class="comments-list">
      {#if loading}
        <div class="loading-state">
          <Loader2 class="animate-spin" size={32} />
          <p>Cargando comentarios...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <p>{error}</p>
          <button onclick={loadComments}>Reintentar</button>
        </div>
      {:else if comments.length === 0}
        <div class="empty-state">
          <MessageCircle size={48} strokeWidth={1.5} />
          <p>No hay comentarios aún</p>
          <span>Sé el primero en comentar</span>
        </div>
      {:else}
        {#each comments as comment (comment.id)}
          <div class="comment-item">
            <img 
              class="comment-avatar" 
              src={comment.user.avatarUrl || DEFAULT_AVATAR}
              alt={comment.user.displayName}
              loading="lazy"
            />
            <div class="comment-content">
              <div class="comment-header">
                <span class="comment-author">
                  {comment.user.displayName}
                  {#if comment.user.verified}
                    <svg class="verified-badge" viewBox="0 0 24 24" width="14" height="14">
                      <path fill="#3b82f6" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                    </svg>
                  {/if}
                </span>
                <span class="comment-time">{getRelativeTime(comment.createdAt)}</span>
              </div>
              <p class="comment-text">{comment.content}</p>
              <div class="comment-actions">
                <button class="action-btn" type="button">
                  <Heart size={14} />
                  <span>{comment.likesCount || ''}</span>
                </button>
                <button class="action-btn" type="button" onclick={() => startReply(comment)}>
                  <MessageCircle size={14} />
                  <span>Responder</span>
                </button>
                {#if $currentUser?.userId === comment.user.id}
                  <button class="action-btn delete" type="button" onclick={() => deleteComment(comment.id)}>
                    <Trash2 size={14} />
                  </button>
                {/if}
              </div>
              
              <!-- Replies -->
              {#if comment.replies && comment.replies.length > 0}
                <div class="replies-container">
                  {#each comment.replies as reply (reply.id)}
                    <div class="comment-item reply">
                      <img 
                        class="comment-avatar small" 
                        src={reply.user.avatarUrl || DEFAULT_AVATAR}
                        alt={reply.user.displayName}
                        loading="lazy"
                      />
                      <div class="comment-content">
                        <div class="comment-header">
                          <span class="comment-author">{reply.user.displayName}</span>
                          <span class="comment-time">{getRelativeTime(reply.createdAt)}</span>
                        </div>
                        <p class="comment-text">{reply.content}</p>
                        <div class="comment-actions">
                          <button class="action-btn" type="button">
                            <Heart size={12} />
                            <span>{reply.likesCount || ''}</span>
                          </button>
                          {#if $currentUser?.userId === reply.user.id}
                            <button class="action-btn delete" type="button" onclick={() => deleteComment(reply.id)}>
                              <Trash2 size={12} />
                            </button>
                          {/if}
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>
    
    <!-- Input Area -->
    <div class="input-area">
      {#if replyingTo}
        <div class="replying-to">
          <span>Respondiendo a <strong>@{replyingTo.user.username}</strong></span>
          <button onclick={cancelReply} type="button">
            <X size={14} />
          </button>
        </div>
      {/if}
      
      {#if $currentUser}
        <div class="input-row">
          <img 
            class="input-avatar" 
            src={$currentUser.avatarUrl || DEFAULT_AVATAR}
            alt="Tu avatar"
          />
          <textarea
            bind:this={inputRef}
            bind:value={newComment}
            placeholder={replyingTo ? 'Escribe tu respuesta...' : 'Añade un comentario...'}
            rows="1"
            onkeydown={handleKeydown}
          ></textarea>
          <button 
            class="send-btn"
            onclick={submitComment}
            disabled={!newComment.trim() || submitting}
            type="button"
          >
            {#if submitting}
              <Loader2 class="animate-spin" size={20} />
            {:else}
              <Send size={20} />
            {/if}
          </button>
        </div>
      {:else}
        <div class="input-row login-row">
          <button 
            class="login-btn"
            onclick={() => showAuthModal = true}
            type="button"
          >
            Inicia sesión para comentar
          </button>
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Auth Modal -->
  <AuthModal bind:isOpen={showAuthModal} />
{/if}

<style>
  .comments-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 9999998;
    backdrop-filter: blur(4px);
  }
  
  .comments-modal {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 92vh;
    max-height: 92vh;
    background: #1a1a1a;
    border-radius: 20px 20px 0 0;
    z-index: 9999999;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .modal-handle {
    padding: 12px;
    display: flex;
    justify-content: center;
  }
  
  .handle-bar {
    width: 40px;
    height: 4px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
  }
  
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .modal-title {
    font-size: 16px;
    font-weight: 600;
    color: white;
    margin: 0;
  }
  
  .close-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s;
  }
  
  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
  
  .comments-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    min-height: 100px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .comments-list::-webkit-scrollbar {
    width: 4px;
  }

  .comments-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .comments-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }
  
  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    color: rgba(255, 255, 255, 0.5);
    text-align: center;
    gap: 12px;
  }
  
  .empty-state span {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.3);
  }
  
  .error-state button {
    margin-top: 8px;
    padding: 8px 16px;
    background: #3b82f6;
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
  }
  
  .comment-item {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }
  
  .comment-item.reply {
    margin-left: 0;
    margin-bottom: 12px;
  }
  
  .comment-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }
  
  .comment-avatar.small {
    width: 28px;
    height: 28px;
  }
  
  .comment-content {
    flex: 1;
    min-width: 0;
  }
  
  .comment-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  
  .comment-author {
    font-size: 14px;
    font-weight: 600;
    color: white;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .verified-badge {
    flex-shrink: 0;
  }
  
  .comment-time {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }
  
  .comment-text {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.9);
    margin: 0 0 8px 0;
    line-height: 1.4;
    word-wrap: break-word;
  }
  
  .comment-actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  
  .action-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    cursor: pointer;
    padding: 4px 0;
    transition: color 0.2s;
  }
  
  .action-btn:hover {
    color: rgba(255, 255, 255, 0.8);
  }
  
  .action-btn.delete:hover {
    color: #ef4444;
  }
  
  .replies-container {
    margin-top: 12px;
    padding-left: 12px;
    border-left: 2px solid rgba(255, 255, 255, 0.1);
  }
  
  .input-area {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding: 12px 16px;
    padding-bottom: max(16px, calc(16px + env(safe-area-inset-bottom)));
    background: #1a1a1a;
    flex-shrink: 0;
  }
  
  .replying-to {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 8px;
    margin-bottom: 8px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
  }
  
  .replying-to strong {
    color: #3b82f6;
  }
  
  .replying-to button {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    padding: 2px;
    display: flex;
  }
  
  .input-row {
    display: flex;
    align-items: flex-end;
    gap: 12px;
  }
  
  .input-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }
  
  .input-row textarea {
    flex: 1;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    padding: 10px 16px;
    color: white;
    font-size: 14px;
    resize: none;
    outline: none;
    max-height: 100px;
    font-family: inherit;
  }
  
  .input-row textarea::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
  
  .input-row textarea:focus {
    border-color: rgba(59, 130, 246, 0.5);
  }
  
  .send-btn {
    background: #3b82f6;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }
  
  .send-btn:hover:not(:disabled) {
    background: #2563eb;
    transform: scale(1.05);
  }
  
  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .login-row {
    justify-content: center;
  }
  
  .login-btn {
    flex: 1;
    padding: 14px 24px;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    color: white;
    font-weight: 600;
    font-size: 15px;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .login-btn:hover {
    transform: scale(1.02);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }
  
  .login-btn:active {
    transform: scale(0.98);
  }
  
  :global(.animate-spin) {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @media (min-width: 640px) {
    .comments-modal {
      max-width: 800px;
      width: 800px;
      height: 80vh;
      max-height: 80vh;
      left: 50%;
      right: auto;
      margin-left: -400px; /* Half of max-width */
      border-radius: 20px 20px 0 0;
    }
  }
  
  @media (min-width: 1024px) {
    .comments-modal {
      max-width: 900px;
      width: 900px;
      margin-left: -450px;
    }
  }
</style>
