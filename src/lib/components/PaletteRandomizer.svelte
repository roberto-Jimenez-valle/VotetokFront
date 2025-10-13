<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  // Paletas predefinidas elegantes (50+ variaciones)
  const palettes = [
    // Clásicas oscuras
    { name: 'GitHub Dark', bg: '#000000', sphere: '#161b22', stroke: '#30363d', noData: '#181a20' },
    { name: 'Carbon', bg: '#0a0a0a', sphere: '#1a1a1a', stroke: '#2e2e2e', noData: '#141414' },
    { name: 'Obsidian', bg: '#0b0b0d', sphere: '#14141a', stroke: '#1f1f28', noData: '#101016' },
    { name: 'Charcoal', bg: '#0f0f0f', sphere: '#1c1c1c', stroke: '#303030', noData: '#161616' },
    
    // Púrpuras y morados
    { name: 'Deep Purple', bg: '#0a0015', sphere: '#1a0b2e', stroke: '#3d1e6d', noData: '#16003e' },
    { name: 'Midnight Purple', bg: '#0f0a1e', sphere: '#1a1234', stroke: '#2e2052', noData: '#150f28' },
    { name: 'Violet Night', bg: '#100920', sphere: '#1e1238', stroke: '#3a2561', noData: '#180e2d' },
    { name: 'Lavender Dark', bg: '#12091f', sphere: '#21153a', stroke: '#3e2b66', noData: '#1a0f30' },
    { name: 'Amethyst', bg: '#0d0616', sphere: '#1b0f2e', stroke: '#351d52', noData: '#150a26' },
    { name: 'Plum Shadow', bg: '#110818', sphere: '#1f1230', stroke: '#3b2358', noData: '#170c24' },
    
    // Azules
    { name: 'Ocean Night', bg: '#001a2e', sphere: '#002642', stroke: '#284b63', noData: '#003049' },
    { name: 'Cyber Blue', bg: '#000d1a', sphere: '#001a33', stroke: '#00334d', noData: '#00152b' },
    { name: 'Navy Deep', bg: '#00101c', sphere: '#001e36', stroke: '#003d5c', noData: '#001829' },
    { name: 'Sapphire', bg: '#000f1f', sphere: '#001d3d', stroke: '#003b6b', noData: '#001733' },
    { name: 'Arctic Night', bg: '#0a1420', sphere: '#14263d', stroke: '#284a66', noData: '#101d2e' },
    { name: 'Deep Sea', bg: '#001218', sphere: '#002331', stroke: '#00455a', noData: '#001b26' },
    { name: 'Prussian', bg: '#001529', sphere: '#002845', stroke: '#004d73', noData: '#001f3a' },
    { name: 'Cobalt', bg: '#000e1a', sphere: '#001c35', stroke: '#00385e', noData: '#001628' },
    
    // Verdes
    { name: 'Forest Dark', bg: '#0d1b0f', sphere: '#1b2e1f', stroke: '#2d4a33', noData: '#19291c' },
    { name: 'Emerald Night', bg: '#081512', sphere: '#102822', stroke: '#1d4a3d', noData: '#0d1e19' },
    { name: 'Pine Shadow', bg: '#0a1410', sphere: '#142620', stroke: '#244836', noData: '#101d18' },
    { name: 'Jade Dark', bg: '#091713', sphere: '#112924', stroke: '#1f4a40', noData: '#0e201c' },
    { name: 'Moss Night', bg: '#0f1810', sphere: '#1a2e1e', stroke: '#2e5238', noData: '#15221a' },
    { name: 'Teal Deep', bg: '#081615', sphere: '#0f2928', stroke: '#1a4d4a', noData: '#0c1f1e' },
    
    // Rojos y cálidos
    { name: 'Crimson Dark', bg: '#1a0000', sphere: '#2b0808', stroke: '#4a1414', noData: '#1f0303' },
    { name: 'Ruby Night', bg: '#180005', sphere: '#2a0a10', stroke: '#4d1a25', noData: '#1e0408' },
    { name: 'Burgundy', bg: '#150008', sphere: '#26000f', stroke: '#45001f', noData: '#1b000c' },
    { name: 'Mahogany', bg: '#1a0a05', sphere: '#2e1710', stroke: '#4d2b20', noData: '#22100a' },
    { name: 'Maroon Deep', bg: '#1c0608', sphere: '#300f15', stroke: '#521d28', noData: '#240a0f' },
    
    // Naranjas y amarillos oscuros
    { name: 'Amber Dark', bg: '#1a1200', sphere: '#2e2200', stroke: '#524000', noData: '#221a00' },
    { name: 'Bronze Night', bg: '#1a0f00', sphere: '#2e1c00', stroke: '#523600', noData: '#221400' },
    { name: 'Copper', bg: '#1c1008', sphere: '#301e10', stroke: '#543820', noData: '#24180c' },
    
    // Grises y neutrales
    { name: 'Slate', bg: '#0e1012', sphere: '#1a1e24', stroke: '#2e3640', noData: '#14181c' },
    { name: 'Steel', bg: '#0f1113', sphere: '#1c2026', stroke: '#303840', noData: '#151a1e' },
    { name: 'Graphite', bg: '#0d0f10', sphere: '#191d20', stroke: '#2d3338', noData: '#13161a' },
    { name: 'Iron', bg: '#101214', sphere: '#1e2226', stroke: '#343c44', noData: '#161a1e' },
    { name: 'Titanium', bg: '#0c0e10', sphere: '#171b20', stroke: '#2a3238', noData: '#12161a' },
    
    // Cyan y turquesa
    { name: 'Cyan Deep', bg: '#001a1c', sphere: '#002e33', stroke: '#00545c', noData: '#00242a' },
    { name: 'Turquoise Night', bg: '#00181a', sphere: '#002c30', stroke: '#004f56', noData: '#00212a' },
    { name: 'Aqua Dark', bg: '#001618', sphere: '#00292e', stroke: '#004a52', noData: '#001f24' },
    
    // Marrones
    { name: 'Chocolate', bg: '#120a05', sphere: '#22140a', stroke: '#3d2615', noData: '#1a1008' },
    { name: 'Coffee', bg: '#140c08', sphere: '#261810', stroke: '#452d20', noData: '#1c1410' },
    { name: 'Espresso', bg: '#100805', sphere: '#1e1210', stroke: '#382320', noData: '#180e0a' },
    { name: 'Walnut', bg: '#130a06', sphere: '#24150f', stroke: '#41291e', noData: '#1b110c' },
    
    // Tonos fríos mixtos
    { name: 'Indigo Night', bg: '#08091a', sphere: '#0f1233', stroke: '#1e245c', noData: '#0c0e26' },
    { name: 'Periwinkle', bg: '#0a0d1c', sphere: '#131a36', stroke: '#253361', noData: '#0e1428' },
    { name: 'Storm', bg: '#0c1015', sphere: '#161e28', stroke: '#293847', noData: '#12181f' },
    { name: 'Thunder', bg: '#0a0f14', sphere: '#141d26', stroke: '#263644', noData: '#10161c' },
    
    // Paletas únicas
    { name: 'Void', bg: '#030303', sphere: '#0a0a0a', stroke: '#141414', noData: '#070707' },
    { name: 'Abyss', bg: '#000203', sphere: '#000a0f', stroke: '#00141f', noData: '#00070c' },
    { name: 'Eclipse', bg: '#050208', sphere: '#0f0a15', stroke: '#1f1428', noData: '#0a0610' },
    { name: 'Nebula', bg: '#08050f', sphere: '#140a1e', stroke: '#281438', noData: '#100818' },
  ];
  
  let currentPaletteIndex = 0;
  
  function randomizePalette() {
    // Elegir una paleta aleatoria diferente a la actual
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * palettes.length);
    } while (newIndex === currentPaletteIndex && palettes.length > 1);
    
    currentPaletteIndex = newIndex;
    const palette = palettes[currentPaletteIndex];
    
    // Disparar evento con la nueva paleta
    dispatch('palettechange', palette);
    
    // Mostrar notificación
    showNotification(palette.name);
  }
  
  function showNotification(paletteName: string) {
    const notification = document.createElement('div');
    notification.textContent = `🎨 ${paletteName}`;
    notification.style.cssText = `
      position: fixed;
      top: 114px;
      right: 16px;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 99999;
      animation: slideInFade 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOutFade 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }
</script>

<button 
  class="palette-randomizer" 
  onclick={randomizePalette}
  aria-label="Cambiar paleta aleatoriamente"
  title="Cambiar paleta de colores"
>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="13.5" cy="6.5" r=".5"/>
    <circle cx="17.5" cy="10.5" r=".5"/>
    <circle cx="8.5" cy="7.5" r=".5"/>
    <circle cx="6.5" cy="12.5" r=".5"/>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
  </svg>
</button>

<style>
  .palette-randomizer {
    position: fixed;
    top: 60px;
    right: 80px;
    z-index: 99999;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    color: white;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
  }
  
  .palette-randomizer:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transform: scale(1.05);
  }
  
  .palette-randomizer:active {
    transform: scale(0.95);
  }
  
  .palette-randomizer svg {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  }
  
  @keyframes slideInFade {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes slideOutFade {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(20px);
    }
  }
  
  /* Animación de entrada */
  .palette-randomizer {
    animation: slideIn 0.4s ease-out 0.1s both;
  }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
