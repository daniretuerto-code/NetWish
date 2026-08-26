// js/kitchen-kds.js

let kitchenRealtimeSub = null;

window.openKitchenOrdersModal = async function() {
    if (!currentBusiness) return;
    
    window.openModalCustom(`
        <div class="space-y-4 text-center py-6">
            <i data-lucide="loader-2" class="w-6 h-6 mx-auto animate-spin text-black mb-2"></i>
            <p class="text-xs text-neutral-500">Cargando comandas en cocina...</p>
        </div>
    `);

    window.subscribeToKitchenOrders();
    await window.renderKitchenOrdersList();
};

window.renderKitchenOrdersList = async function() {
    const modalBody = document.getElementById('modalBody');
    if (!modalBody || !currentBusiness) return;

    const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabase;
    let tableOrders = [];

    if (client) {
        try {
            const { data } = await client
                .from('table_sessions')
                .select('*')
                .ilike('business_name', `%${currentBusiness.name}%`)
                .neq('status', 'closed')
                .order('created_at', { ascending: true });

            if (data) tableOrders = data;
        } catch (e) {
            console.warn("Aviso consultando comandas de cocina:", e);
        }
    }

    modalBody.innerHTML = `
        <div class="space-y-4 text-left">
            <div class="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div class="flex items-center space-x-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <div>
                        <span class="text-[9px] font-mono uppercase tracking-widest text-neutral-400 font-bold block">PANTALLA DE COCINA</span>
                        <h3 class="text-base font-bold text-black">Comandas Activas</h3>
                    </div>
                </div>
                <button onclick="window.closeCustomModal()" class="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <div class="space-y-3 max-h-[420px] overflow-y-auto pr-1 allow-scroll" id="kitchenCardsContainer">
                ${tableOrders.length === 0 ? `
                    <div class="py-12 text-center space-y-2">
                        <i data-lucide="chef-hat" class="w-8 h-8 mx-auto text-neutral-300"></i>
                        <p class="text-xs font-bold text-neutral-500">No hay comandas pendientes</p>
                        <p class="text-[10px] text-neutral-400">Las comandas que envíen los comensales aparecerán aquí al instante.</p>
                    </div>
                ` : tableOrders.map(order => {
                    const items = order.items || [];
                    const timeStr = order.created_at ? new Date(order.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                    const isFullyPaid = order.status === 'paid' || parseFloat(order.remaining_amount) <= 0;

                    return `
                        <div class="p-4 bg-neutral-50 rounded-3xl border border-neutral-200/80 shadow-xs space-y-3 transition hover:border-black/30">
                            <div class="flex justify-between items-start border-b border-neutral-200/60 pb-2.5">
                                <div>
                                    <div class="flex items-center space-x-2">
                                        <span class="text-sm font-black text-black font-mono tracking-tight">MESA ${order.table_number}</span>
                                        ${isFullyPaid ? '<span class="text-[8px] bg-emerald-500/10 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full border border-emerald-500/20 font-mono">PAGADA</span>' : '<span class="text-[8px] bg-amber-500/10 text-amber-700 font-bold px-1.5 py-0.5 rounded-full border border-amber-500/20 font-mono">PENDIENTE PAGO</span>'}
                                    </div>
                                    <span class="text-[10px] text-neutral-400 font-mono">Entrada: ${timeStr} h</span>
                                </div>
                                <span class="text-xs font-black text-black font-mono">${parseFloat(order.total_amount || 0).toFixed(2)} €</span>
                            </div>

                            <div class="space-y-1.5">
                                ${items.map(dish => `
                                    <div class="flex justify-between items-center text-xs p-2 bg-white rounded-xl border border-neutral-100 shadow-2xs">
                                        <div class="flex items-center space-x-2 truncate">
                                            <span class="w-5 h-5 rounded-lg bg-black text-white font-mono font-bold text-[10px] flex items-center justify-center shrink-0">${dish.qty}x</span>
                                            <span class="font-bold text-neutral-800 truncate">${dish.name}</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>

                            <div class="grid grid-cols-2 gap-2 pt-1">
                                <button onclick="window.markKitchenOrderReady('${order.id}')" class="py-2.5 bg-white border border-neutral-200 hover:border-black text-black font-bold rounded-xl text-[11px] active:scale-95 transition flex items-center justify-center space-x-1.5 shadow-2xs">
                                    <i data-lucide="bell-ring" class="w-3.5 h-3.5 text-amber-500"></i>
                                    <span>Avisar Sala</span>
                                </button>
                                <button onclick="window.closeKitchenOrder('${order.id}')" class="py-2.5 bg-black hover:bg-neutral-800 text-white font-bold rounded-xl text-[11px] active:scale-95 transition flex items-center justify-center space-x-1.5 shadow-sm">
                                    <i data-lucide="check" class="w-3.5 h-3.5"></i>
                                    <span>Comanda Servida</span>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <button onclick="window.closeCustomModal()" class="w-full py-3 bg-neutral-100 hover:bg-neutral-200 text-black font-bold rounded-xl text-xs transition">
                Volver al Panel
            </button>
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.subscribeToKitchenOrders = function() {
    const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabase;
    if (!client || typeof client.channel !== 'function') return;

    if (kitchenRealtimeSub) {
        kitchenRealtimeSub.unsubscribe();
    }

    kitchenRealtimeSub = client
        .channel('kitchen_kds_channel')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'table_sessions' 
        }, () => {
            window.renderKitchenOrdersList();
        })
        .subscribe();
};

window.markKitchenOrderReady = function(sessionId) {
    if (typeof window.showToast === 'function') {
        window.showToast("¡Aviso enviado a sala! Platos listos.", "success");
    } else {
        alert("¡Aviso enviado a sala! Platos listos para servir.");
    }
};

window.closeKitchenOrder = async function(sessionId) {
    const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabase;
    if (client) {
        try {
            await client.from('table_sessions').update({ status: 'closed' }).eq('id', sessionId);
        } catch (e) {
            console.warn("Aviso cerrando comanda:", e);
        }
    }
    await window.renderKitchenOrdersList();
};