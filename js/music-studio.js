// js/music-studio.js

window.currentlyPlayingAudio = null;
window.currentPlayingBtnId = null;
window.currentLoadedBeatsList = [];
window.lastVisitedBeatsView = false;

window.openBeatsCatalogView = function() {
    stopCurrentAudio();
    window.lastVisitedBeatsView = true;
    const beatsView = document.getElementById('view-beats-catalog');
    if (!beatsView) return;

    renderBeatsCatalogList(window.currentLoadedBeatsList);

    const pubBizView = document.getElementById('view-public-business');
    if (pubBizView) pubBizView.classList.add('hidden');

    beatsView.classList.remove('hidden');
    beatsView.classList.add('flex');
    beatsView.scrollTop = 0;
    
    updateCartDisplay();
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.closeBeatsCatalogView = function() {
    stopCurrentAudio();
    window.lastVisitedBeatsView = false;
    const beatsView = document.getElementById('view-beats-catalog');
    if (beatsView) {
        beatsView.classList.add('hidden');
        beatsView.classList.remove('flex');
    }

    const pubBizView = document.getElementById('view-public-business');
    if (pubBizView) {
        pubBizView.classList.remove('hidden');
    }

    updateCartDisplay();
};

function renderBeatsCatalogList(list) {
    const container = document.getElementById('dynamicBeatsCatalogList');
    if (!container) return;

    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="p-8 rounded-3xl bg-neutral-50 border border-neutral-200/60 text-center space-y-2">
                <i data-lucide="disc" class="w-6 h-6 mx-auto text-neutral-300"></i>
                <p class="text-xs font-bold text-black">No hay beats disponibles</p>
                <p class="text-[10px] text-neutral-400">El estudio aún no ha subido instrumentales terminadas a la venta.</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    container.innerHTML = list.map(item => renderSingleProductCard(item, true)).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.filterBeatsCatalogView = function() {
    const q = (document.getElementById('beatsCatalogSearch')?.value || '').toLowerCase();
    const filtered = (window.currentLoadedBeatsList || []).filter(item => {
        const name = (item.name || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        return name.includes(q) || desc.includes(q);
    });
    renderBeatsCatalogList(filtered);
};

function togglePlayPreview(encodedUrl, iconId) {
    const url = decodeURIComponent(encodedUrl);
    if (!url) return;

    const iconEl = document.getElementById(iconId);

    if (window.currentlyPlayingAudio && window.currentlyPlayingAudio.src === url && !window.currentlyPlayingAudio.paused) {
        window.currentlyPlayingAudio.pause();
        if (iconEl) {
            iconEl.setAttribute('data-lucide', 'play');
            iconEl.classList.add('ml-0.5');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        return;
    }

    stopCurrentAudio();

    window.currentlyPlayingAudio = new Audio(url);
    window.currentPlayingBtnId = iconId;

    if (iconEl) {
        iconEl.setAttribute('data-lucide', 'pause');
        iconEl.classList.remove('ml-0.5');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    window.currentlyPlayingAudio.play().catch(e => {
        console.error("Error reproduciendo audio:", e);
        stopCurrentAudio();
    });

    window.currentlyPlayingAudio.onended = () => {
        stopCurrentAudio();
    };
}

function stopCurrentAudio() {
    if (window.currentlyPlayingAudio) {
        window.currentlyPlayingAudio.pause();
        window.currentlyPlayingAudio = null;
    }
    if (window.currentPlayingBtnId) {
        const iconEl = document.getElementById(window.currentPlayingBtnId);
        if (iconEl) {
            iconEl.setAttribute('data-lucide', 'play');
            iconEl.classList.add('ml-0.5');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        window.currentPlayingBtnId = null;
    }
}