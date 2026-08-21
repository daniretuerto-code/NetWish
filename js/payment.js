function appendNum(num) {
    if (rawAmountString === "000") {
        if (num !== "00") rawAmountString = num;
    } else {
        if (rawAmountString.length < 8) rawAmountString += num;
    }
    updateAmountDisplay();
}

function clearNum() {
    if (rawAmountString.length <= 3) rawAmountString = "000";
    else rawAmountString = rawAmountString.slice(0, -1);
    updateAmountDisplay();
}

function updateAmountDisplay() {
    const numericValue = parseInt(rawAmountString, 10) / 100;
    document.getElementById('payAmountDisplay').innerText = numericValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function initHoldButtonListeners() {
    const btn = document.getElementById('holdButtonContainer');
    const progressBar = document.getElementById('progressBar');
    if (!btn || !progressBar) return;

    progressBar.style.transition = 'width 0.02s linear';

    const startHold = (e) => {
        if (e && e.cancelable) e.preventDefault();
        if (holdTimer) return;
        
        holdProgress = 0;
        progressBar.style.width = '0%';
        
        holdTimer = setInterval(() => {
            holdProgress += 2; 
            progressBar.style.width = holdProgress + '%';
            
            if (holdProgress >= 100) {
                clearInterval(holdTimer);
                holdTimer = null;
                executeFullPayment(false); // Falso porque no es solo reserva, es pago completo
            }
        }, 20);
    };

    const cancelHold = (e) => {
        if (holdTimer) {
            clearInterval(holdTimer);
            holdTimer = null;
        }
        holdProgress = 0;
        progressBar.style.width = '0%';
    };

    btn.addEventListener('mousedown', startHold);
    btn.addEventListener('mouseup', cancelHold);
    btn.addEventListener('mouseleave', cancelHold);
    btn.addEventListener('touchstart', startHold, { passive: false });
    btn.addEventListener('touchend', cancelHold);
    btn.addEventListener('touchcancel', cancelHold);
}

function executeFullPayment(isReservationOnly = false) {
    const numericValue = parseInt(rawAmountString, 10) / 100;
    const finalValue = isReservationOnly ? cartTotalValue : numericValue;

    if (finalValue <= 0) { 
        alert("La cantidad a pagar no es válida."); 
        return; 
    }

    // Guardar pedido/reserva si venimos del carrito para que el comercio lo vea
    if (isCartCheckout) {
        const orders = JSON.parse(localStorage.getItem('netwish_global_orders') || '[]');
        
        let itemNames = cartItemsList.map(i => i.name).join(', ');
        if (itemNames.length > 30) itemNames = itemNames.substring(0,27) + '...';

        orders.push({
            id: Date.now(),
            businessName: activePayee,
            items: `${cartItemCount}x (${itemNames})`,
            total: finalValue,
            date: pendingOrderDetails.date,
            time: pendingOrderDetails.time,
            customer: currentUser ? (currentUser.user_metadata.name || currentUser.email.split('@')[0]) : "Cliente Invitado",
            status: isReservationOnly ? 'Pendiente (Pago Local)' : 'Pagado Online'
        });
        localStorage.setItem('netwish_global_orders', JSON.stringify(orders));
    }

    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');

    const title = isReservationOnly ? '¡Reserva confirmada!' : '¡Pago enviado con éxito!';
    const message = isReservationOnly 
        ? `Tu reserva en <strong class="text-black">${activePayee}</strong> ha sido anotada. Abonarás los ${finalValue.toFixed(2)}€ allí.`
        : `Has pagado <strong class="text-black">${finalValue.toFixed(2)} €</strong> a <strong class="text-black">${activePayee}</strong>.`;

    modalBody.innerHTML = `
        <div class="space-y-4 text-center py-6">
            <div class="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <i data-lucide="check" class="w-7 h-7"></i>
            </div>
            <div class="space-y-1">
                <h3 class="text-base font-bold text-black">${title}</h3>
                <p class="text-xs text-neutral-500">${message}</p>
                ${isCartCheckout ? `<p class="text-[10px] text-emerald-600 font-bold mt-2 bg-emerald-50 py-1 px-2 rounded-lg inline-block border border-emerald-100">Cita: ${pendingOrderDetails.date} a las ${pendingOrderDetails.time}</p>` : ''}
            </div>
            <button onclick="closeModal(); switchTab('home');" class="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-xs mt-4 shadow-md">Volver al Inicio</button>
        </div>
    `;
    lucide.createIcons();
    modal.classList.remove('hidden');
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        modalContent.classList.remove('scale-95'); 
    }, 10);
    
    // Reseteamos las variables del carrito global
    isCartCheckout = false; 
    cartItemsList = [];
}