/**
 * Script que fuerza el scroll vertical a estar siempre habilitado
 * Elimina bloqueos dinámicos de overflow y touch-action
 */

export function enableScrollEverywhere() {
  if (typeof window === 'undefined') return;

  // Forzar estilos en body y html
  const forceScrollStyles = () => {
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.overflowY = 'auto';
    document.documentElement.style.touchAction = 'pan-y pinch-zoom';
    
    document.body.style.overflow = 'auto';
    document.body.style.overflowY = 'auto';
    document.body.style.touchAction = 'pan-y pinch-zoom';
  };

  // Aplicar inmediatamente
  forceScrollStyles();

  // Observar cambios en los estilos y re-aplicar
  const observer = new MutationObserver(() => {
    forceScrollStyles();
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style', 'class']
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['style', 'class']
  });

  // Re-aplicar cada 100ms por si acaso
  const interval = setInterval(forceScrollStyles, 100);

  // Cleanup
  return () => {
    observer.disconnect();
    clearInterval(interval);
  };
}
