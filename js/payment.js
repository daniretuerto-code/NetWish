let rawAmountString = "000";
let holdTimer = null;
let holdProgress = 0;
let isHolding = false;

function appendNum(num) {
    if (rawAmountString.length >= 8) return;
    if (rawAmountString === "000" || rawAmountString === "0") {
        rawAmountString = num;
    } else {
        rawAmountString += num;
    }
    updateAmountDisplay();
}

function clearNum() {
    if (rawAmountString.length > 1) {
        rawAmountString = rawAmountString.slice(0, -1);
    } else {
        rawAmountString = "0";
    }
    updateAmountDisplay();
}

function updateAmountDisplay() {
    const display = document.getElementById('payAmountDisplay');
    if (!display) return;
    
    let val = parseInt(rawAmountString, 10) || 0;
    let formatted = (val / 100).toLocaleString('es-ES', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
    
    display.innerText = formatted;
}

// --- GESTOR INTERACTIVO DE CONFIRMACIÓN POR RETENCIÓN (HOLD) ---
document.addEventListener('DOMContentLoaded', () => {
    const btnContainer = document.getElementById('holdButtonContainer');
    if (!btnContainer) return;

    const startHold = (e) => {
        e.preventDefault();
        const val = parseInt(rawAmountString, 10) || 0;
        if (val <= 0) {
            alert("Introduce un importe válido para continuar.");
            return;
        }

        isHolding = true;
        holdProgress = 0;
        const progressBar = document.getElementById('progressBar');

        holdTimer = setInterval(() => {
            if (!isHolding) return;
            holdProgress += 4;
            if (progressBar) progressBar.style.width = holdProgress + '%';

            if (holdProgress >= 100) {
                clearInterval(holdTimer);
                isHolding = false;
                executeFullPayment(false);
            }
        }, 30);
    };

    const endHold = () => {
        if (!isHolding) return;
        isHolding = false;
        clearInterval(holdTimer);
        holdProgress = 0;
        const progressBar = document.getElementById('progressBar');
        if (progressBar) progressBar.style.width = '0%';
    };

    btnContainer.addEventListener('mousedown', startHold);
    btnContainer.addEventListener('touchstart', startHold, { passive: false });
    window.addEventListener('mouseup', endHold);
    window.addEventListener('touchend', endHold);
});

// --- EJECUCIÓN DEL PAGO Y NOTIFICACIÓN POR WHATSAPP ---
async function executeFullPayment(isReservation = false) {
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');

    let totalVal = isCartCheckout ? cartTotalValue : (parseInt(rawAmountString, 10) / 100);
    let itemsDesc = isCartCheckout 
        ? cartItemsList.map(i => `${i.qty}x ${i.name}`).join(', ') 
        : 'Pago Directo Terminal';
        
    let customerName = currentUser 
        ? (currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email || 'Cliente') 
        : 'Cliente';

    let orderDate = pendingOrderDetails?.date || new Date().toISOString().split('T')[0];
    let orderTime = pendingOrderDetails?.time || "Inmediato";
    let statusText = isReservation ? 'Pendiente (Pago en local)' : 'Pagado Online';

    // Inserción en Supabase
    try {
        const { error } = await supabaseClient
            .from('orders')
            .insert([{
                business_name: activePayee,
                customer: customerName,
                items: itemsDesc,
                total: totalVal,
                date: orderDate,
                time: orderTime,
                status: statusText
            }]);

        if (error) console.warn("Aviso Supabase Orders:", error);
    } catch (err) {
        console.warn("Fallo inserción orden:", err);
    }

    // Consulta de teléfono del comercio para WhatsApp
    let bizPhone = null;
    try {
        const { data } = await supabaseClient
            .from('businesses')
            .select('phone, telefono')
            .ilike('name', `%${activePayee}%`)
            .maybeSingle();

        if (data) {
            bizPhone = data.phone || data.telefono;
        }
    } catch (e) {
        console.warn("Consulta teléfono:", e);
    }

    // Preparar mensaje de WhatsApp
    let waUrl = "";
    if (bizPhone) {
        let cleanPhone = bizPhone.replace(/\D/g, '');
        if (!cleanPhone.startsWith('34') && cleanPhone.length === 9) {
            cleanPhone = '34' + cleanPhone;
        }

        const msgText = encodeURIComponent(
            `🚀 *Nuevo Pedido NetWish*\n\n` +
            `👤 *Cliente:* ${customerName}\n` +
            `📦 *Pedido:* ${itemsDesc}\n` +
            `💰 *Total:* ${totalVal.toFixed(2)} €\n` +
            `📅 *Cita/Recogida:* ${orderDate} - ${orderTime}\n` +
            `📌 *Estado:* ${statusText}`
        );

        waUrl = `https://wa.me/${cleanPhone}?text=${msgText}`;
    }

    // Mostrar modal de éxito con opción directa de WhatsApp
    if (modalBody) {
        modalBody.innerHTML = `
            <div class="text-center space-y-4 py-3">
                <div class="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                    <i data-lucide="check" class="w-8 h-8"></i>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-black">${isReservation ? 'Reserva Confirmada' : 'Pago Completado'}</h3>
                    <p class="text-xs text-neutral-500 mt-1">Se ha registrado tu pedido correctamente con ${activePayee}.</p>
                </div>

                <div class="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 text-left space-y-1">
                    <span class="text-[10px] text-neutral-400 font-mono uppercase block">Detalles</span>
                    <span class="text-xs font-bold text-black block truncate">${itemsDesc}</span>
                    <span class="text-sm font-extrabold text-black block mt-1">${totalVal.toFixed(2)} €</span>
                </div>

                ${waUrl ? `
                    <a href="${waUrl}" target="_blank" class="w-full py-3.5 bg-emerald-600 text-white font-bold rounded-2xl text-xs shadow-md flex items-center justify-center space-x-2 active:scale-95 transition">
                        <i data-lucide="message-circle" class="w-4 h-4"></i>
                        <span>Enviar WhatsApp al Negocio</span>
                    </a>
                ` : ''}

                <button onclick="finishPaymentFlow()" class="w-full py-3 bg-black text-white font-semibold rounded-2xl text-xs active:scale-95 transition">
                    Volver al Inicio
                </button>
            </div>
        `;
        lucide.createIcons();
    }

    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modalContent?.classList.remove('scale-95');
        }, 10);
    }
}

function finishPaymentFlow() {
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    
    if (modal) {
        modal.classList.add('opacity-0');
        modalContent?.classList.add('scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }

    rawAmountString = "000";
    cartItemsList = [];
    cartTotalValue = 0;
    cartItemCount = 0;
    isCartCheckout = false;

    const progressBar = document.getElementById('progressBar');
    if (progressBar) progressBar.style.width = '0%';

    switchTab('home');
}