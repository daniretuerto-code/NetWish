let currentChatBusiness = null;
let currentChatCustomer = null;
let chatRealtimeSubscription = null;

// --- ABRIR CHAT DESDE EL CLIENTE HACIA EL COMERCIO ---
function openCustomerChat(bizName) {
    if (typeof currentUser === 'undefined' || !currentUser) {
        if (typeof openAuthModal === 'function') openAuthModal('login');
        return;
    }

    currentChatBusiness = decodeURIComponent(bizName || window.appState?.activeBusinessName || '');
    currentChatCustomer = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email || 'Cliente';

    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = `
        <div class="flex flex-col h-[430px] justify-between text-left">
            <!-- Header Chat -->
            <div class="flex items-center justify-between pb-3 border-b border-neutral-100 shrink-0">
                <div class="flex items-center space-x-2.5">
                    <div class="w-9 h-9 rounded-2xl bg-black text-white flex items-center justify-center text-xs font-bold shadow-sm">
                        ${currentChatBusiness.substring(0, 2).toUpperCase()}
                    </div>
                    <div class="text-left">
                        <h4 class="text-xs font-bold text-black truncate max-w-[190px]">${currentChatBusiness}</h4>
                        <span class="text-[9px] text-emerald-600 font-mono flex items-center space-x-1">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                            <span>En línea</span>
                        </span>
                    </div>
                </div>
                <button onclick="closeChatModal()" class="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-black active:scale-90 transition">
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
                    class="flex-1 bg-neutral-50 border border-neutral-200/80 rounded-2xl px-3.5 py-3 text-xs text-black focus:outline-none focus:border-black transition">
                <button onclick="sendChatMessage('customer')" class="w-11 h-11 rounded-2xl bg-black text-white flex items-center justify-center active:scale-90 transition shrink-0 shadow-md">
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

// --- RENDERIZADO DE LA PESTAÑA DEDICADA DE MENSAJES (MODO COMERCIO) ---
async function renderBusinessMessagesTab() {
    if (!currentBusiness) return;
    const container = document.getElementById('businessMessagesTabContent');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-12">
            <i data-lucide="loader-2" class="w-5 h-5 mx-auto animate-spin text-neutral-400 mb-2"></i>
            <p class="text-xs text-neutral-400">Cargando conversaciones...</p>
        </div>
    `;
    lucide.createIcons();

    try {
        const cleanBizName = (currentBusiness.name || '').trim();
        const { data, error } = await supabaseClient
            .from('messages')
            .select('*')
            .ilike('business_name', `%${cleanBizName}%`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="p-8 rounded-3xl bg-neutral-50/70 border border-neutral-100 text-center space-y-2">
                    <i data-lucide="message-square-off" class="w-6 h-6 mx-auto text-neutral-300"></i>
                    <p class="text-xs font-bold text-black">Sin mensajes recibidos</p>
                    <p class="text-[10px] text-neutral-400">Cuando los clientes inicien un chat directo, aparecerán aquí en tiempo real.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

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
            const dateStr = lastMsg.created_at ? new Date(lastMsg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
            listHtml += `
                <div onclick="openBusinessChatWithCustomer('${encodeURIComponent(client)}')" class="p-4 bg-white hover:bg-neutral-50 rounded-3xl border border-neutral-200/80 shadow-sm flex items-center justify-between cursor-pointer transition active:scale-98">
                    <div class="flex items-center space-x-3.5 overflow-hidden flex-1 mr-2">
                        <div class="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
                            ${client.substring(0, 2).toUpperCase()}
                        </div>
                        <div class="overflow-hidden">
                            <span class="text-xs font-bold text-black block truncate">${client}</span>
                            <span class="text-[11px] text-neutral-500 block truncate mt-0.5">${lastMsg.text}</span>
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        <span class="text-[9px] font-mono text-neutral-400 block">${dateStr}</span>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-neutral-400 ml-auto mt-1"></i>
                    </div>
                </div>
            `;
        });

        container.innerHTML = listHtml;
        lucide.createIcons();

    } catch (e) {
        console.error("Error cargando mensajes del negocio:", e);
        container.innerHTML = `<p class="text-xs text-rose-500 text-center py-6">Error al sincronizar mensajes.</p>`;
    }
}

// --- ABRIR CHAT INDIVIDUAL DEL NEGOCIO CON UN CLIENTE (MODAL) ---
function openBusinessChatWithCustomer(encodedClient) {
    const client = decodeURIComponent(encodedClient);
    currentChatBusiness = currentBusiness.name;
    currentChatCustomer = client;

    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;

    modalBody.innerHTML = `
        <div class="flex flex-col h-[430px] justify-between text-left">
            <!-- Header Chat Negocio -->
            <div class="flex items-center justify-between pb-3 border-b border-neutral-100 shrink-0">
                <div class="flex items-center space-x-2.5">
                    <div class="w-9 h-9 rounded-2xl bg-black text-white flex items-center justify-center text-xs font-bold shadow-sm">
                        ${client.substring(0, 2).toUpperCase()}
                    </div>
                    <div class="text-left">
                        <h4 class="text-xs font-bold text-black truncate max-w-[190px]">${client}</h4>
                        <span class="text-[9px] text-neutral-400 font-mono block">Cliente Directo</span>
                    </div>
                </div>
                <button onclick="closeChatModal()" class="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-black active:scale-90 transition">
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
                    class="flex-1 bg-neutral-50 border border-neutral-200/80 rounded-2xl px-3.5 py-3 text-xs text-black focus:outline-none focus:border-black transition">
                <button onclick="sendChatMessage('business')" class="w-11 h-11 rounded-2xl bg-black text-white flex items-center justify-center active:scale-90 transition shrink-0 shadow-md">
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

    loadChatMessages('business');
}

// --- CARGA Y RENDERIZADO DE MENSAJES CON REALTIME ---
async function loadChatMessages(currentRole) {
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return;

    try {
        const cleanBiz = (currentChatBusiness || '').trim();
        const { data, error } = await supabaseClient
            .from('messages')
            .select('*')
            .ilike('business_name', `%${cleanBiz}%`)
            .or(`sender_name.ilike.%${currentChatCustomer}%,receiver_name.ilike.%${currentChatCustomer}%`)
            .order('created_at', { ascending: true });

        if (error) throw error;

        renderMessagesList(data || [], currentRole);

        // Suscripción Realtime
        if (!chatRealtimeSubscription && typeof supabaseClient.channel === 'function') {
            chatRealtimeSubscription = supabaseClient
                .channel('public:messages')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                    if (payload.new && payload.new.business_name.toLowerCase().includes(cleanBiz.toLowerCase())) {
                        appendSingleMessage(payload.new, currentRole);
                    }
                })
                .subscribe();
        }

    } catch (err) {
        console.error("Error cargando mensajes:", err);
    }
}

function renderMessagesList(messages, currentRole) {
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return;

    if (messages.length === 0) {
        container.innerHTML = `<p class="empty-chat-placeholder text-[11px] text-neutral-400 text-center py-8">Inicia la conversación. Envía tu primera consulta.</p>`;
        return;
    }

    let html = '';
    messages.forEach(m => {
        const isMine = (currentRole === 'customer' && m.sender_type === 'customer') ||
                       (currentRole === 'business' && m.sender_type === 'business');
        const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Ahora';

        html += `
            <div class="flex flex-col ${isMine ? 'items-end' : 'items-start'}">
                <div class="max-w-[80%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${isMine ? 'bg-black text-white rounded-br-none' : 'bg-neutral-100 text-black rounded-bl-none'}">
                    ${m.text}
                </div>
                <span class="text-[8px] text-neutral-400 font-mono mt-0.5 px-1">${timeStr}</span>
            </div>
        `;
    });

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function appendSingleMessage(msg, currentRole) {
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return;

    // Eliminar texto de chat vacío si existe
    const emptyPlaceholder = container.querySelector('.empty-chat-placeholder');
    if (emptyPlaceholder) emptyPlaceholder.remove();

    const isMine = (currentRole === 'customer' && msg.sender_type === 'customer') ||
                   (currentRole === 'business' && msg.sender_type === 'business');
    const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Ahora';

    const msgEl = document.createElement('div');
    msgEl.className = `flex flex-col ${isMine ? 'items-end' : 'items-start'}`;
    msgEl.innerHTML = `
        <div class="max-w-[80%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${isMine ? 'bg-black text-white rounded-br-none' : 'bg-neutral-100 text-black rounded-bl-none'}">
            ${msg.text}
        </div>
        <span class="text-[8px] text-neutral-400 font-mono mt-0.5 px-1">${timeStr}</span>
    `;

    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
}

// --- ENVÍO INMEDIATO CON RENDERIZADO OPTIMISTA (NO DESAPARECE) ---
async function sendChatMessage(senderType) {
    const input = document.getElementById('chatInputText');
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    input.value = '';

    const payload = {
        business_name: currentChatBusiness,
        sender_name: senderType === 'customer' ? currentChatCustomer : currentChatBusiness,
        sender_id: typeof currentUser !== 'undefined' && currentUser ? currentUser.id : 'anon',
        receiver_name: senderType === 'customer' ? currentChatBusiness : currentChatCustomer,
        text: text,
        sender_type: senderType,
        created_at: new Date().toISOString()
    };

    // 1. Renderizado optimista instantáneo en pantalla
    appendSingleMessage(payload, senderType);

    // 2. Persistencia en Supabase
    try {
        const { error } = await supabaseClient
            .from('messages')
            .insert([payload]);

        if (error) console.warn("Aviso guardado en tabla messages:", error);
    } catch (e) {
        console.error("Fallo insertando mensaje:", e);
    }
}

function closeChatModal() {
    if (chatRealtimeSubscription) {
        supabaseClient.removeChannel(chatRealtimeSubscription);
        chatRealtimeSubscription = null;
    }
    if (typeof closeModal === 'function') closeModal();
}