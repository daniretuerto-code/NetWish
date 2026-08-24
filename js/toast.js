// js/toast.js

window.showToast = function(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    
    // Crear el contenedor si no existe en el DOM
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'fixed top-5 inset-x-0 max-w-xs mx-auto z-50 flex flex-col gap-2 pointer-events-none px-4';
        document.body.appendChild(container);
    }

    // Configuración de iconos según el tipo de mensaje
    const icons = {
        success: 'check',
        error: 'alert-circle',
        info: 'info'
    };
    const iconName = icons[type] || 'info';

    // Elemento Toast con estética minimalista monocromática
    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-black text-white text-xs font-medium shadow-2xl border border-neutral-800 transition-all duration-300 opacity-0 -translate-y-2';
    toast.innerHTML = `
        <i data-lucide="${iconName}" class="w-4 h-4 text-white shrink-0"></i>
        <span class="flex-1 leading-tight">${message}</span>
    `;

    container.appendChild(toast);
    
    // Renderizar icono Lucide si la librería está cargada
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Animación de entrada suave
    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', '-translate-y-2');
    });

    // Desaparición automática tras 3.5 segundos
    setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
};