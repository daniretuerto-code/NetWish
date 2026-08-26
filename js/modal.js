// js/modal.js

window.openModalCustom = function(htmlContent) {
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');

    if (!modal || !modalBody) return;

    modalBody.innerHTML = htmlContent;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    modal.classList.remove('hidden');
    modal.style.display = "flex";
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        if (modalContent) modalContent.classList.remove('scale-95');
    }, 10);
};

window.closeCustomModal = function() {
    if (typeof window.stopCamera === 'function') window.stopCamera();
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    if (!modal) return;

    modal.classList.add('opacity-0');
    if (modalContent) modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.style.display = "";
    }, 200);
};

window.closeModal = window.closeCustomModal;