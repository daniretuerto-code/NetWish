// js/chat.js

let currentChatBusiness = null;
let currentChatCustomer = null;
let chatRealtimeSubscription = null;
let bizGlobalUnreadSubscription = null;

// --- ABRIR CHAT DESDE EL CLIENTE HACIA EL COMERCIO ---
function openCustomerChat(bizName) {
    if (typeof currentUser === 'undefined' || !currentUser) {
        if (typeof openAuthModal === 'function') openAuthModal('login');
        return;
    }

    currentChatBusiness = decodeURIComponent(bizName || window.appState?.activeBusinessName || '');
    currentChatCustomer = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email || 'Cliente';

    window.openModalCustom(`
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
                <input type="text" id="chatInputText" placeholder="Escribe tu consulta o pedido a medida..." 
                    onkeydown="if(event.key === 'Enter') sendChatMessage('customer')"
                    class="flex-1 bg-neutral-50 border border-neutral-200/80 rounded-2xl px-3.5 py-3 text-xs text-black focus:outline-none focus:border-black transition">
                <button onclick="sendChatMessage('customer')" class="w-11 h-11 rounded-2xl bg-black text-white flex items-center justify-center active:scale-90 transition shrink-0 shadow-md">
                    <i data-lucide="send" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `);

    loadChatMessages('customer');
}

// --- ACTUALIZACIÓN REACTIVA DEL BADGE ROJO EN LA BARRA INFERIOR ---
async function updateBusinessNavUnreadBadge() {
    if (!currentBusiness) return;
    const dot = document.getElementById('bizNavUnreadDot');
    if (!dot) return;

    try {
        const cleanBizName = (currentBusiness.name || '').trim();
        const { count, error } = await supabaseClient
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .ilike('business_name', `%${cleanBizName}%`)
            .eq('sender_type', 'customer')
            .eq('is_read', false);

        if (!error && typeof count === 'number') {
            if (count > 0) {
                dot.classList.remove('hidden');
            } else {
                dot.classList.add('hidden');
            }
        }
    } catch (e) {
        console.warn("Consulta contador no leídos nav:", e);
    }
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
    if (typeof lucide !== 'undefined') lucide.createIcons();

    updateBusinessNavUnreadBadge();

    if (!bizGlobalUnreadSubscription && typeof supabaseClient.channel === 'function') {
        bizGlobalUnreadSubscription = supabaseClient
            .channel('public:messages_global_unread')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
                updateBusinessNavUnreadBadge();
                if (typeof activeTab !== 'undefined' && activeTab === 'business-messages') {
                    renderBusinessMessagesTab();
                }
            })
            .subscribe();
    }

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
                    <p class="text-[10px] text-neutral-400">Cuando los clientes inicien un chat directo o pedido personalizado, aparecerán aquí en tiempo real.</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        const customerDataMap = {};
        data.forEach(m => {
            const clientName = m.sender_type === 'customer' ? m.sender_name : m.receiver_name;
            if (!clientName) return;

            if (!customerDataMap[clientName]) {
                customerDataMap[clientName] = {
                    lastMessage: m,
                    unreadCount: 0,
                    avatarUrl: null
                };
            }

            if (m.sender_type === 'customer' && m.is_read === false) {
                customerDataMap[clientName].unreadCount += 1;
            }

            if (m.avatar_url && !customerDataMap[clientName].avatarUrl) {
                customerDataMap[clientName].avatarUrl = m.avatar_url;
            }
        });

        let listHtml = '';
        Object.keys(customerDataMap).forEach(client => {
            const entry = customerDataMap[client];
            const lastMsg = entry.lastMessage;
            const unread = entry.unreadCount;
            const avatar = entry.avatarUrl;
            const dateStr = lastMsg.created_at ? new Date(lastMsg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';

            let avatarMarkup = '';
            if (avatar) {
                avatarMarkup = `
                    <div class="relative w-10 h-10 shrink-0">
                        <img src="${avatar}" class="w-10 h-10 rounded-2xl object-cover border border-neutral-200/80 shadow-sm" alt="${client}">
                        <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-xs border border-neutral-100">
                            <svg class="w-2.5 h-2.5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                        </div>
                    </div>
                `;
            } else {
                avatarMarkup = `
                    <div class="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
                        ${client.substring(0, 2).toUpperCase()}
                    </div>
                `;
            }

            const unreadBadge = unread > 0 ? `
                <div class="flex items-center space-x-1 bg-rose-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold shadow-xs">
                    <span>${unread}</span>
                    <span class="text-[8px] uppercase tracking-wider">${unread === 1 ? 'nuevo' : 'nuevos'}</span>
                </div>
            ` : '';

            listHtml += `
                <div onclick="openBusinessChatWithCustomer('${encodeURIComponent(client)}', '${encodeURIComponent(avatar || '')}')" 
                    class="p-4 ${unread > 0 ? 'bg-rose-50/40 border-rose-200/80 shadow-xs' : 'bg-white border-neutral-200/80'} hover:bg-neutral-50 rounded-3xl border shadow-sm flex items-center justify-between cursor-pointer transition active:scale-98">
                    
                    <div class="flex items-center space-x-3.5 overflow-hidden flex-1 mr-2">
                        ${avatarMarkup}
                        <div class="overflow-hidden">
                            <div class="flex items-center space-x-2">
                                <span class="text-xs font-bold text-black block truncate ${unread > 0 ? 'text-rose-950 font-black' : ''}">${client}</span>
                                ${unread > 0 ? '<span class="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse"></span>' : ''}
                            </div>
                            <span class="text-[11px] ${unread > 0 ? 'text-rose-900 font-semibold' : 'text-neutral-500'} block truncate mt-0.5">${lastMsg.text}</span>
                        </div>
                    </div>

                    <div class="flex flex-col items-end space-y-1.5 shrink-0">
                        <span class="text-[9px] font-mono ${unread > 0 ? 'text-rose-600 font-bold' : 'text-neutral-400'}">${dateStr}</span>
                        ${unreadBadge}
                    </div>
                </div>
            `;
        });

        container.innerHTML = listHtml;
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (e) {
        console.error("Error cargando mensajes del negocio:", e);
        container.innerHTML = `<p class="text-xs text-rose-500 text-center py-6">Error al sincronizar mensajes.</p>`;
    }
}

// --- ABRIR CHAT INDIVIDUAL DEL NEGOCIO CON UN CLIENTE (MODAL) ---
async function openBusinessChatWithCustomer(encodedClient, encodedAvatar = '') {
    const client = decodeURIComponent(encodedClient);
    const avatar = decodeURIComponent(encodedAvatar);
    currentChatBusiness = currentBusiness.name;
    currentChatCustomer = client;

    // 1. Marcar mensajes de este cliente como leídos de inmediato
    try {
        await supabaseClient
            .from('messages')
            .update({ is_read: true })
            .ilike('business_name', `%${currentBusiness.name}%`)
            .ilike('sender_name', `%${client}%`)
            .eq('sender_type', 'customer');
            
        updateBusinessNavUnreadBadge();
    } catch (err) {
        console.warn("Aviso marcando mensajes como leídos:", err);
    }

    let headerAvatarMarkup = '';
    if (avatar) {
        headerAvatarMarkup = `
            <div class="relative w-9 h-9 shrink-0">
                <img src="${avatar}" class="w-9 h-9 rounded-2xl object-cover border border-neutral-200" alt="${client}">
                <div class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center border border-neutral-100">
                    <svg class="w-2 h-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                </div>
            </div>
        `;
    } else {
        headerAvatarMarkup = `
            <div class="w-9 h-9 rounded-2xl bg-black text-white flex items-center justify-center text-xs font-bold shadow-sm shrink-0">
                ${client.substring(0, 2).toUpperCase()}
            </div>
        `;
    }

    window.openModalCustom(`
        <div class="flex flex-col h-[430px] justify-between text-left">
            <!-- Header Chat Negocio -->
            <div class="flex items-center justify-between pb-3 border-b border-neutral-100 shrink-0">
                <div class="flex items-center space-x-2.5">
                    <button onclick="closeChatModal(); renderBusinessMessagesTab();" class="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center text-black active:scale-90 transition mr-0.5">
                        <i data-lucide="arrow-left" class="w-4 h-4"></i>
                    </button>
                    ${headerAvatarMarkup}
                    <div class="text-left overflow-hidden">
                        <h4 class="text-xs font-bold text-black truncate max-w-[170px]">${client}</h4>
                        <span class="text-[9px] text-neutral-400 font-mono block">Cliente Directo</span>
                    </div>
                </div>
                <button onclick="closeChatModal(); renderBusinessMessagesTab();" class="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-black active:scale-90 transition">
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
    `);

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

        if (!chatRealtimeSubscription && typeof supabaseClient.channel === 'function') {
            chatRealtimeSubscription = supabaseClient
                .channel('public:messages_single_chat')
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
        container.innerHTML = `<p class="empty-chat-placeholder text-[11px] text-neutral-400 text-center py-8">Inicia la conversación. Envía tu consulta o solicitud personalizada.</p>`;
        return;
    }

    let html = '';
    messages.forEach(m => {
        const isMine = (currentRole === 'customer' && m.sender_type === 'customer') ||
                       (currentRole === 'business' && m.sender_type === 'business');
        const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Ahora';

        let avatarBubble = '';
        if (!isMine && m.avatar_url) {
            avatarBubble = `<img src="${m.avatar_url}" class="w-6 h-6 rounded-full object-cover mr-1.5 self-end mb-1 border border-neutral-200/80" alt="Avatar">`;
        }

        html += `
            <div class="flex items-end ${isMine ? 'justify-end' : 'justify-start'}">
                ${avatarBubble}
                <div class="flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[80%]">
                    <div class="px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${isMine ? 'bg-black text-white rounded-br-none' : 'bg-neutral-100 text-black rounded-bl-none'}">
                        ${m.text}
                    </div>
                    <span class="text-[8px] text-neutral-400 font-mono mt-0.5 px-1">${timeStr}</span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function appendSingleMessage(msg, currentRole) {
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return;

    const emptyPlaceholder = container.querySelector('.empty-chat-placeholder');
    if (emptyPlaceholder) emptyPlaceholder.remove();

    const isMine = (currentRole === 'customer' && msg.sender_type === 'customer') ||
                   (currentRole === 'business' && msg.sender_type === 'business');
    const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Ahora';

    let avatarBubble = '';
    if (!isMine && msg.avatar_url) {
        avatarBubble = `<img src="${msg.avatar_url}" class="w-6 h-6 rounded-full object-cover mr-1.5 self-end mb-1 border border-neutral-200/80" alt="Avatar">`;
    }

    const msgEl = document.createElement('div');
    msgEl.className = `flex items-end ${isMine ? 'justify-end' : 'justify-start'}`;
    msgEl.innerHTML = `
        ${avatarBubble}
        <div class="flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[80%]">
            <div class="px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${isMine ? 'bg-black text-white rounded-br-none' : 'bg-neutral-100 text-black rounded-bl-none'}">
                ${msg.text}
            </div>
            <span class="text-[8px] text-neutral-400 font-mono mt-0.5 px-1">${timeStr}</span>
        </div>
    `;

    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
}

// --- ENVÍO DE MENSAJES ---
async function sendChatMessage(senderType) {
    const input = document.getElementById('chatInputText');
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    input.value = '';

    let userAvatar = null;
    if (senderType === 'customer' && typeof currentUser !== 'undefined' && currentUser) {
        userAvatar = currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || null;
    }

    const payload = {
        business_name: currentChatBusiness,
        sender_name: senderType === 'customer' ? currentChatCustomer : currentChatBusiness,
        sender_id: typeof currentUser !== 'undefined' && currentUser ? currentUser.id : 'anon',
        receiver_name: senderType === 'customer' ? currentChatBusiness : currentChatCustomer,
        text: text,
        sender_type: senderType,
        avatar_url: userAvatar,
        is_read: false,
        created_at: new Date().toISOString()
    };

    appendSingleMessage(payload, senderType);

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
    window.closeCustomModal();
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof currentBusiness !== 'undefined' && currentBusiness) {
        updateBusinessNavUnreadBadge();
    }
});