// js/directory.js

// 1. BASE DE DATOS LOCAL (FALLBACK Y ESTRUCTURA)
window.localBusinessesData = [
    {
        id: 'juancp-music',
        name: 'JUUANCP Producción Musical',
        category: 'ocio',
        categoryLabel: 'Record Label',
        tag: 'RECORD LABEL',
        location: 'Palencia Centro',
        description: 'Instrumentales & Beats exclusivos',
        image: 'https://gamjjnyomhnyswbxlhgq.supabase.co/storage/v1/object/public/public-images/juancp-cover.jpg',
        isOpen: true,
        catalogType: 'beats'
    },
    {
        id: 'barberia-urbana',
        name: 'Barbería Urbana Palencia',
        category: 'pel',
        categoryLabel: 'Peluquería',
        tag: 'CITAS & TURNOS',
        location: 'Calle Mayor, Palencia',
        description: 'Próximo turno libre: 16:30',
        image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
        isOpen: true,
        catalogType: 'services'
    },
    {
        id: 'tahona-san-antolin',
        name: 'Tahona & Café San Antolín',
        category: 'pan',
        categoryLabel: 'Panadería',
        tag: 'CLICK & COLLECT',
        location: 'Plaza Mayor, Palencia',
        description: 'Recogida sin esperas: En 15 min',
        image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
        isOpen: true,
        catalogType: 'bakery'
    },
    {
        id: 'palbus-urbano',
        name: 'Palbus Líneas Urbanas',
        category: 'movil',
        categoryLabel: 'Movilidad',
        tag: 'GPS EN VIVO',
        location: 'Estación y Plaza Mayor',
        description: 'Frecuencias cada 12 min',
        image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
        isOpen: true,
        catalogType: 'transit'
    },
    {
        id: 'restaurante-san-marcos',
        name: 'Restaurante San Marcos',
        category: 'rest',
        categoryLabel: 'Restaurante',
        tag: 'QR MESA & CARTA',
        location: 'Calle Mayor Principal, Palencia',
        description: 'Cocina tradicional y tapas',
        image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
        isOpen: true,
        catalogType: 'menu'
    }
];

// 2. CARGA PRINCIPAL DEL DIRECTORIO
window.loadDirectoryBusinesses = async function() {
    const listContainer = document.getElementById('dynamicBusinessList');
    if (!listContainer) return;

    try {
        let businesses = window.localBusinessesData;

        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            const { data, error } = await supabaseClient.from('businesses').select('*');
            if (!error && data && data.length > 0) {
                businesses = data;
            }
        }

        renderBusinessCards(businesses, listContainer);

    } catch (err) {
        console.error("Error al cargar comercios:", err);
        renderBusinessCards(window.localBusinessesData, listContainer);
    }
};

// 3. RENDERIZADO DE TARJETAS
function renderBusinessCards(dataList, container) {
    if (!dataList || dataList.length === 0) {
        container.innerHTML = '<p class="text-xs text-center text-neutral-400 py-6">No se encontraron locales.</p>';
        return;
    }

    container.innerHTML = dataList.map(biz => {
        const isJuancp = (biz.name || '').toUpperCase().includes('JUUANCP');
        const imgSrc = isJuancp 
            ? 'https://gamjjnyomhnyswbxlhgq.supabase.co/storage/v1/object/public/public-images/juancp-cover.jpg' 
            : (biz.image || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80');

        return `
            <article onclick='window.openPublicBusiness(${JSON.stringify(biz).replace(/'/g, "&apos;")})' class="p-4 rounded-3xl border border-neutral-200/80 bg-white hover:border-black transition cursor-pointer space-y-3 active:scale-[0.99] shadow-sm">
                <div class="flex items-start justify-between">
                    <div class="space-y-1">
                        <span class="inline-block px-2.5 py-0.5 rounded-md bg-neutral-100 text-neutral-700 text-[9px] font-mono uppercase tracking-wider">${biz.tag || biz.categoryLabel || 'Comercio'}</span>
                        <h3 class="text-sm font-bold text-black tracking-tight">${biz.name}</h3>
                        <p class="text-[11px] text-neutral-400">${biz.location || 'Palencia'}</p>
                    </div>
                    <div class="w-12 h-12 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center overflow-hidden shrink-0">
                        <img src="${imgSrc}" class="w-full h-full object-cover" onerror="this.src='https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80'">
                    </div>
                </div>
                <div class="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs font-medium">
                    <span class="text-neutral-500 text-[11px]">${biz.description || 'Disponible ahora'}</span>
                    <span class="font-bold text-black flex items-center gap-1">Ver <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i></span>
                </div>
            </article>
        `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// 4. APERTURA DE FICHA PÚBLICA DEL COMERCIO
window.openPublicBusiness = function(biz) {
    const publicView = document.getElementById('view-public-business');
    const imgEl = document.getElementById('publicBizImage');
    const nameEl = document.getElementById('publicBizName');
    const tagEl = document.getElementById('publicBizTag');

    if (nameEl) nameEl.innerText = biz.name || 'Comercio Local';
    if (tagEl) tagEl.innerText = biz.tag || biz.categoryLabel || 'Comercio';

    if (imgEl) {
        const isJuancp = (biz.name || '').toUpperCase().includes('JUUANCP');
        imgEl.src = isJuancp 
            ? 'https://gamjjnyomhnyswbxlhgq.supabase.co/storage/v1/object/public/public-images/juancp-cover.jpg' 
            : (biz.image || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80');
    }

    if (window.appState) {
        window.appState.activeBusinessName = biz.name;
        window.appState.activeBusinessId = biz.id;
    }

    if (publicView) {
        publicView.classList.remove('hidden');
        publicView.classList.add('flex');
        publicView.scrollTop = 0;
    }

    if (typeof window.loadBusinessCatalog === 'function') {
        window.loadBusinessCatalog(biz);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.goBackFromBusiness = function() {
    const publicView = document.getElementById('view-public-business');
    if (publicView) {
        publicView.classList.add('hidden');
        publicView.classList.remove('flex');
    }
};

// 5. NAVEGACIÓN Y FILTRO POR CATEGORÍAS (DESDE HOME)
window.goToDirectory = function(categoryCode) {
    const categoryView = document.getElementById('view-category');
    const titleEl = document.getElementById('categoryViewTitle');
    const listEl = document.getElementById('dynamicCategoryList');

    const titles = {
        'pan': 'Panaderías & Cafés',
        'rest': 'Restaurantes & Bares',
        'movil': 'Movilidad Urbana',
        'pel': 'Peluquerías & Barberías',
        'ocio': 'Ocio & Producción Musical'
    };

    if (titleEl) titleEl.innerText = titles[categoryCode] || 'Categoría';

    const filtered = window.localBusinessesData.filter(b => b.category === categoryCode);
    if (listEl) renderBusinessCards(filtered, listEl);

    if (categoryView) {
        categoryView.classList.remove('hidden');
        categoryView.classList.add('flex');
        categoryView.scrollTop = 0;
    }
};

// 6. BUSCADORES REACTIVOS
window.filterDirectory = function() {
    const query = (document.getElementById('directorySearch')?.value || '').toLowerCase();
    const articles = document.querySelectorAll('#dynamicBusinessList article');
    articles.forEach(art => {
        const text = art.innerText.toLowerCase();
        art.style.display = text.includes(query) ? 'block' : 'none';
    });
};

window.filterCategoryView = function() {
    const query = (document.getElementById('categorySearch')?.value || '').toLowerCase();
    const articles = document.querySelectorAll('#dynamicCategoryList article');
    articles.forEach(art => {
        const text = art.innerText.toLowerCase();
        art.style.display = text.includes(query) ? 'block' : 'none';
    });
};

// 7. CATÁLOGO ESPECÍFICO DE BEATS
window.openBeatsCatalogView = function() {
    const beatsView = document.getElementById('view-beats-catalog');
    if (beatsView) {
        beatsView.classList.remove('hidden');
        beatsView.classList.add('flex');
        beatsView.scrollTop = 0;
    }
    if (typeof window.loadBeatsCatalog === 'function') {
        window.loadBeatsCatalog();
    }
};

window.closeBeatsCatalogView = function() {
    const beatsView = document.getElementById('view-beats-catalog');
    if (beatsView) {
        beatsView.classList.add('hidden');
        beatsView.classList.remove('flex');
    }
};

// 8. INICIALIZADOR
document.addEventListener('DOMContentLoaded', () => {
    window.loadDirectoryBusinesses();
});