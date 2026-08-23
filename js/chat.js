let currentChatBusiness = null;
let currentChatCustomer = null;
let chatRealtimeSubscription = null;

// --- ABRIR CHAT DESDE EL CLIENTE HACIA EL COMERCIO ---
function openCustomerChat(bizName) {
    if (!currentUser) {
        if (typeof openAuthModal === 'function') openAuthModal('login');
        return;
    }

    currentChatBusiness = decodeURIComponent(bizName || window.appState?.activeBusinessName || '');
    currentChatCustomer = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email || 'Cliente';

    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = `
        <div class="flex flex-col h-[420px] justify-between">
            <!-- Header Chat -->
            <div class="flex items-center justify-between pb-3 border-b border-neutral-100 shrink-0">
                <div class="flex items-center space-x-2.5">
                    <div class="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center text-xs font-bold">
                        ${currentChatBusiness.substring(0, 2).toUpperCase()}
                    </div>
                    <div class="text-left">
                        <h4 class="text-xs font-bold text-black truncate max-w-[190px]">${currentChatBusiness}</h4>
                        <span class="text-[9px] text-emerald-600 font-mono block">● En línea</span>
                    </div>
                </div>
                <button onclick="closeChatModal()" class="w-7 h-7 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-black">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Contenedor Mensajes -->
            <div id="chatMessagesContainer" class="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1 allow-scroll">
                <div class="text-center py-6">
                    <i data-lucide="loader-2" class="w-4 h-4 mx-auto animate-spin text-neutral-400"></i>
                </div>
            </div>

            <!-- Input Envío -->
            <div class="pt-2 border-t border-neutral-100 flex items-center space-x-2 shrink-0">
                <input type="text" id="chatInputText" placeholder="Escribe tu consulta personalizada..." 
                    onkeydown="if(event.key === 'Enter') sendChatMessage('customer')"
                    class="flex-1 bg-neutral-50 border border-neutral-200/80 rounded-xl px-3 py-2.5 text-xs text-black focus:outline-none focus:border-black transition">
                <button onclick="sendChatMessage('customer')" class="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center active:scale-90 transition shrink-0 shadow-sm">
                    <i data-lucide="send" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `;

    lucide.createIcons();
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent?.classList.remove('scale-95');
    }, 10);

    loadChatMessages('customer');
}

// --- ABRIR BANDEJA DE MENSAJES PARA EL NEGOCIO ---
async function openBusinessMessagesModal() {
    if (!currentBusiness) return;

    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = `
        <div class="space-y-4 text-left">
            <div class="text-center space-y-1">
                <h3 class="text-base font-bold text-black">Bandeja de Mensajes</h3>
                <p class="text-[11px] text-neutral-500">Consultas de clientes en tiempo real.</p>
            </div>

            <div id="businessConversationsList" class="space-y-2 max-h-72 overflow-y-auto pr-1 allow-scroll">
                <div class="text-center py-6">
                    <i data-lucide="loader-2" class="w-4 h-4 mx-auto animate-spin text-neutral-400"></i>
                </div>
            </div>

            <button onclick="closeChatModal()" class="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black font-semibold rounded-xl text-xs transition">
                Cerrar
            </button>
        </div>
    `;

    lucide.createIcons();
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent?.classList.remove('scale-95');
    }, 10);

    // Cargar conversaciones agrupadas por cliente
    try {
        const { data, error } = await supabaseClient
            .from('messages')
            .select('*')
            .ilike('business_name', `%${currentBusiness.name}%`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const container = document.getElementById('businessConversationsList');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `<p class="text-xs text-neutral-400 text-center py-8">No tienes mensajes ni consultas aún.</p>`;
            return;
        }

        // Agrupar por nombre de cliente
        const uniqueCustomers = {};
        data.forEach(m => {
            const clientName = m.sender_type === 'customer' ? m.sender_name : m.receiver_name;
            if (clientName && !uniqueCustomers[clientName]) {
                uniqueCustomers[clientName] = m;
            }
        });

        let listHtml = '';
        Object.keys(uniqueCustomers).forEach(client => {
            const lastMsg = uniqueCustomers[client];
            listHtml += `
                <div onclick="openBusinessChatWithCustomer('${encodeURIComponent(client)}')" class="p-3 bg-neutral-50 hover:bg-neutral-100 rounded-2xl border border-neutral-200/60 flex items-center justify-between cursor-pointer transition active:scale-98">
                    <div class="flex items-center space-x-3 overflow-hidden">
                        <div class="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold shrink-0">
                            ${client.substring(0, 2).toUpperCase()}
                        </div>
                        <div class="overflow-hidden">
                            <span class="text-xs font-bold text-black block truncate">${client}</span>
                            <span class="text-[10px] text-neutral-500 block truncate">${lastMsg.text}</span>
                        </div>
                    </div>
                    <i data-lucide="chevron-right" class="w-4 h-4 text-neutral-400 shrink-0"></i>
                </div>
            `;
        });

        container.innerHTML = listHtml;
        lucide.createIcons();

    } catch (e) {
        console.error("Error cargando bandeja:", e);
    }
}

// --- ABRIR CHAT INDIVIDUAL DEL NEGOCIO CON UN CLIENTE ---
function openBusinessChatWithCustomer(encodedClient) {
    const client = decodeURIComponent(encodedClient);
    currentChatBusiness = currentBusiness.name;
    currentChatCustomer = client;

    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;

    modalBody.innerHTML = `
        <div class="flex flex-col h-[420px] justify-between">
            <!-- Header Chat Negocio -->
            <div class="flex items-center justify-between pb-3 border-b border-neutral-100 shrink-0">
                <div class="flex items-center space-x-2.5">
                    <button onclick="openBusinessMessagesModal()" class="w-7 h-7 rounded-xl bg-neutral-100 flex items-center justify-center text-black mr-1">
                        <i data-lucide="arrow-left" class="w-4 h-4"></i>
                    </button>
                    <div class="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold">
                        ${client.substring(0, 2).toUpperCase()}
                    </div>
                    <div class="text-left">
                        <h4 class="text-xs font-bold text-black truncate max-w-[170px]">${client}</h4>
                        <span class="text-[9px] text-neutral-400 font-mono block">Cliente</span>
                    </div>
                </div>
                <button onclick="closeChatModal()" class="w-7 h-7 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-black">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Contenedor Mensajes -->
            <div id="chatMessagesContainer" class="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1 allow-scroll">
                <div class="text-center py-6">
                    <i data-lucide="loader-2" class="w-4 h-4 mx-auto animate-spin text-neutral-400"></i>
                </div>
            </div>

            <!-- Input Envío Negocio -->
            <div class="pt-2 border-t border-neutral-100 flex items-center space-x-2 shrink-0">
                <input type="text" id="chatInputText" placeholder="Responder al cliente..." 
                    onkeydown="if(event.key === 'Enter') sendChatMessage('business')"
                    class="flex-1 bg-neutral-50 border border-neutral-200/80 rounded-xl px-3 py-2.5 text-xs text-black focus:outline-none focus:border-black transition">
                <button onclick="sendChatMessage('business')" class="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center active:scale-90 transition shrink-0 shadow-sm">
                    <i data-lucide="send" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `;

    lucide.createIcons();
    loadChatMessages('business');
}

// --- CARGAR Y SINCRONIZAR MENSAJES EN TIEMPO REAL ---
async function loadChatMessages(currentRole) {
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return;

    try {
        const { data, error } = await supabaseClient
            .from('messages')
            .select('*')
            .ilike('business_name', `%${currentChatBusiness}%`)
            .or(`sender_name.ilike.%${currentChatCustomer}%,receiver_name.ilike.%${currentChatCustomer}%`)
            .order('created_at', { ascending: true });

        if (error) throw error;

        renderMessagesList(data || [], currentRole);

        // Suscribirse a nuevos mensajes en vivo
        if (!chatRealtimeSubscription && typeof supabaseClient.channel === 'function') {
            chatRealtimeSubscription = supabaseClient
                .channel('public:messages')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                    if (payload.new && payload.new.business_name.toLowerCase().includes(currentChatBusiness.toLowerCase())) {
                        appendSingleMessage(payload.new, currentRole);
                    }
                })
                .subscribe();
        }

    } catch (err) {
        console.error("Error cargando chat:", err);
    }
}

function renderMessagesList(messages, currentRole) {
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return;

    if (messages.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-neutral-400 text-center py-8">Inicia la conversación. Envía tu primera consulta.</p>`;
        return;
    }

    let html = '';
    messages.forEach(m => {
        const isMine = (currentRole === 'customer' && m.sender_type === 'customer') ||
                       (currentRole === 'business' && m.sender_type === 'business');

        html += `
            <div class="flex flex-col ${isMine ? 'items-end' : 'items-start'}">
                <div class="max-w-[80%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${isMine ? 'bg-black text-white rounded-br-none' : 'bg-neutral-100 text-black rounded-bl-none'}">
                    ${m.text}
                </div>
                <span class="text-[8px] text-neutral-400 font-mono mt-0.5 px-1">${new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        `;
    });

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function appendSingleMessage(msg, currentRole) {
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return;

    const isMine = (currentRole === 'customer' && msg.sender_type === 'customer') ||
                   (currentRole === 'business' && msg.sender_type === 'business');

    const msgEl = document.createElement('div');
    msgEl.className = `flex flex-col ${isMine ? 'items-end' : 'items-start'}`;
    msgEl.innerHTML = `
        <div class="max-w-[80%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${isMine ? 'bg-black text-white rounded-br-none' : 'bg-neutral-100 text-black rounded-bl-none'}">
            ${msg.text}
        </div>
        <span class="text-[8px] text-neutral-400 font-mono mt-0.5 px-1">${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
    `;

    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
}

// --- ENVIAR MENSAJE ---
async function sendChatMessage(senderType) {
    const input = document.getElementById('chatInputText');
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    input.value = '';

    const payload = {
        business_name: currentChatBusiness,
        sender_name: senderType === 'customer' ? currentChatCustomer : currentChatBusiness,
        sender_id: currentUser?.id || 'anon',
        receiver_name: senderType === 'customer' ? currentChatBusiness : currentChatCustomer,
        text: text,
        sender_type: senderType
    };

    try {
        const { error } = await supabaseClient
            .from('messages')
            .insert([payload]);

        if (error) throw error;
    } catch (e) {
        alert("Error al enviar mensaje: " + e.message);
    }
}

function closeChatModal() {
    if (chatRealtimeSubscription) {
        supabaseClient.removeChannel(chatRealtimeSubscription);
        chatRealtimeSubscription = null;
    }
    if (typeof closeModal === 'function') closeModal();
}