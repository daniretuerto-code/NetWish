// js/directory.js

window.allPublicBusinesses = window.allPublicBusinesses || [];
let currentCategoryFilter = '';
let currentCategoryBusinesses = [];

async function loadPublicBusinesses() {
    const listContainer = document.getElementById('dynamicBusinessList');
    if (!listContainer) return;
    
    try {
        const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabase;
        if (!client) return;

        const { data, error } = await client.from('businesses').select('*');
        if (error) throw error;
        
        const uniqueBusinesses = [];
        const seenNames = new Set();
        
        (data || []).forEach(biz => {
            let rawName = biz.name || biz.Nombre || biz.username || '';
            let cleanName = rawName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            if (cleanName && !seenNames.has(cleanName)) {
                seenNames.add(cleanName);
                uniqueBusinesses.push(biz);
            }
        });
        
        window.allPublicBusinesses = uniqueBusinesses;
        allPublicBusinesses = uniqueBusinesses;
        renderBusinessDirectory(window.allPublicBusinesses);
    } catch (err) {
        console.error("Error cargando directorio:", err);
        listContainer.innerHTML = `<p class="text-xs text-center text-rose-500 py-4">Error al cargar el directorio urbano.</p>`;
    }
}

function renderBusinessDirectory(businesses) {
    const listContainer = document.getElementById('dynamicBusinessList');
    if (!listContainer) return;
    
    const items = businesses || window.allPublicBusinesses || [];
    
    if (items.length === 0) {
        listContainer.innerHTML = `
            <div class="py-12 text-center space-y-3">
                <div class="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400 shadow-inner">
                    <i data-lucide="clock" class="w-7 h-7"></i>
                </div>
                <h3 class="text-base font-bold text-black">Próximamente</h3>
                <p class="text-xs text-neutral-500 px-4">Aún no hay locales dados de alta. ¡Estamos trabajando en ello!</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    let html = '';
    items.forEach(biz => {
        const name = biz.name || biz.Nombre || biz.username || 'Comercio';
        const cat = (biz.category || biz.Categoria || '').toLowerCase();
        
        let icon = 'store'; 
        let colorClass = 'text-neutral-600'; 
        let bgClass = 'bg-neutral-500/10 border-neutral-500/20';
        
        if (cat.includes('pan') || cat.includes('comercio') || cat.includes('bakery')) { 
            icon = 'shopping-bag'; colorClass = 'text-amber-600'; bgClass = 'bg-amber-500/10 border-amber-500/20'; 
        } else if (cat.includes('pel')) { 
            icon = 'scissors'; colorClass = 'text-blue-600'; bgClass = 'bg-blue-500/10 border-blue-500/20'; 
        } else if (cat.includes('rest') || cat.includes('bar')) { 
            icon = 'utensils'; colorClass = 'text-rose-600'; bgClass = 'bg-rose-500/10 border-rose-500/20'; 
        } else if (cat.includes('movil') || cat.includes('taxi')) {
            icon = 'car'; colorClass = 'text-emerald-600'; bgClass = 'bg-emerald-500/10 border-emerald-500/20';
        } else if (cat.includes('disco') || cat.includes('music') || cat.includes('produ') || cat.includes('estudio')) {
            icon = 'disc'; colorClass = 'text-yellow-500'; bgClass = 'bg-amber-500/20 border-amber-500/40';
        }

        const safeName = encodeURIComponent(name);
        const safeCat = encodeURIComponent(cat);
        const safeEmail = encodeURIComponent(biz.notification_email || '');

        html += `
            <button onclick="openPublicBusiness('${safeName}', '${safeCat}', '${safeEmail}')" class="w-full p-4 rounded-3xl bg-white border border-neutral-200/80 shadow-sm flex items-center space-x-4 active:scale-95 transition-transform text-left">
                <div class="w-12 h-12 rounded-xl ${bgClass} flex items-center justify-center shrink-0">
                    <i data-lucide="${icon}" class="w-5 h-5 ${colorClass}"></i>
                </div>
                <div class="flex-1 overflow-hidden">
                    <h3 class="text-sm font-bold text-black truncate">${name}</h3>
                    <p class="text-[10px] text-neutral-500 truncate mt-0.5">${biz.category || 'Comercio Local'} • Click & Collect</p>
                </div>
                <i data-lucide="chevron-right" class="w-4 h-4 text-neutral-300"></i>
            </button>
        `;
    });
    listContainer.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function filterDirectory() {
    const query = document.getElementById('directorySearch').value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const source = window.allPublicBusinesses.length ? window.allPublicBusinesses : allPublicBusinesses;
    const filtered = source.filter(biz => {
        const name = (biz.name || biz.Nombre || biz.username || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const cat = (biz.category || biz.Categoria || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return name.includes(query) || cat.includes(query);
    });
    renderBusinessDirectory(filtered);
}

function goToDirectory(filter) {
    const titleText = document.getElementById('categoryViewTitle');
    let titleMap = {
        'pan': 'Panaderías',
        'rest': 'Restaurantes',
        'pel': 'Peluquerías',
        'movil': 'Movilidad Urbana',
        'ocio': 'Ocio y Cultura',
        'comercio': 'Comercios Locales',
        'disco': 'Producción Musical & Beats'
    };

    if (titleText) titleText.innerText = titleMap[filter] || 'Categoría';
    currentCategoryFilter = filter;

    const source = window.allPublicBusinesses.length ? window.allPublicBusinesses : allPublicBusinesses;
    currentCategoryBusinesses = source.filter(biz => {
        const cat = (biz.category || biz.Categoria || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return cat.includes(filter);
    });

    renderCategoryDirectory(currentCategoryBusinesses);
    
    const searchInput = document.getElementById('categorySearch');
    if (searchInput) searchInput.value = '';

    if (typeof switchTab === 'function') switchTab('category');
}

function renderCategoryDirectory(businesses) {
    const listContainer = document.getElementById('dynamicCategoryList');
    if (!listContainer) return;
    
    if (!businesses || businesses.length === 0) {
        listContainer.innerHTML = `
            <div class="py-12 text-center space-y-3">
                <div class="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400 shadow-inner">
                    <i data-lucide="clock" class="w-7 h-7"></i>
                </div>
                <h3 class="text-base font-bold text-black">Próximamente</h3>
                <p class="text-xs text-neutral-500 px-4">Aún no hay locales de esta categoría dados de alta. ¡Estamos trabajando en ello!</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    let html = '';
    businesses.forEach(biz => {
        const name = biz.name || biz.Nombre || biz.username || 'Comercio';
        const cat = (biz.category || biz.Categoria || '').toLowerCase();
        
        let icon = 'store'; 
        let colorClass = 'text-neutral-600'; 
        let bgClass = 'bg-neutral-500/10 border-neutral-500/20';
        
        if (cat.includes('pan') || cat.includes('comercio') || cat.includes('bakery')) { 
            icon = 'shopping-bag'; colorClass = 'text-amber-600'; bgClass = 'bg-amber-500/10 border-amber-500/20'; 
        } else if (cat.includes('pel')) { 
            icon = 'scissors'; colorClass = 'text-blue-600'; bgClass = 'bg-blue-500/10 border-blue-500/20'; 
        } else if (cat.includes('rest') || cat.includes('bar')) { 
            icon = 'utensils'; colorClass = 'text-rose-600'; bgClass = 'bg-rose-500/10 border-rose-500/20'; 
        } else if (cat.includes('disco') || cat.includes('music') || cat.includes('produ') || cat.includes('estudio')) {
            icon = 'disc'; colorClass = 'text-yellow-500'; bgClass = 'bg-amber-500/20 border-amber-500/40';
        }

        const safeName = encodeURIComponent(name);
        const safeCat = encodeURIComponent(cat);
        const safeEmail = encodeURIComponent(biz.notification_email || '');

        html += `
            <button onclick="openPublicBusiness('${safeName}', '${safeCat}', '${safeEmail}')" class="w-full p-4 rounded-3xl bg-white border border-neutral-200/80 shadow-sm flex items-center space-x-4 active:scale-95 transition-transform text-left">
                <div class="w-12 h-12 rounded-xl ${bgClass} flex items-center justify-center shrink-0">
                    <i data-lucide="${icon}" class="w-5 h-5 ${colorClass}"></i>
                </div>
                <div class="flex-1 overflow-hidden">
                    <h3 class="text-sm font-bold text-black truncate">${name}</h3>
                    <p class="text-[10px] text-neutral-500 truncate mt-0.5">${biz.category || 'Comercio Local'} • Click & Collect</p>
                </div>
                <i data-lucide="chevron-right" class="w-4 h-4 text-neutral-300"></i>
            </button>
        `;
    });
    listContainer.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function filterCategoryView() {
    const query = document.getElementById('categorySearch').value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const filtered = currentCategoryBusinesses.filter(biz => {
        const name = (biz.name || biz.Nombre || biz.username || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const cat = (biz.category || biz.Categoria || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return name.includes(query) || cat.includes(query);
    });
    renderCategoryDirectory(filtered);
}