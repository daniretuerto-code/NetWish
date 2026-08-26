// js/scanner.js

window.currentCameraStream = null;
window.scanningInterval = null;

// =======================================================
// 1. GENERACIÓN DE CÓDIGO QR PERSONAL
// =======================================================
window.openPersonalQR = function() {
    const user = (typeof currentUser !== 'undefined') ? currentUser : null;
    if (!user) { 
        if (typeof openAuthModal === 'function') openAuthModal('login'); 
        else alert("Debes iniciar sesión para ver tu código QR.");
        return; 
    }

    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');
    const meta = user.user_metadata || {};

    if (!modal || !modalBody) return;

    modalBody.innerHTML = `
        <div class="space-y-4 text-center">
            <h3 class="text-base font-bold text-black">Tu Código QR Personal</h3>
            <p class="text-xs text-neutral-500">Muestra este código para recibir pagos o transferencias.</p>
            <div id="realQRCodeContainer" class="w-52 h-52 bg-white border border-neutral-200 rounded-3xl mx-auto flex items-center justify-center p-3 relative shadow-sm"></div>
            <div class="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/60">
                <span class="block text-xs font-bold text-black">${meta.name || 'Usuario'} ${meta.surname || ''}</span>
                <span class="block text-[10px] text-neutral-400 font-mono">ID: NW-${meta.initials || 'USER'}-${user.id ? user.id.substring(0,6) : 'PAL'}</span>
            </div>
            <button onclick="window.closeCustomModal()" class="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-xs transition active:scale-95 shadow-md">Cerrar</button>
        </div>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    modal.classList.remove('hidden');
    modal.style.display = "flex";
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        if (modalContent) modalContent.classList.remove('scale-95'); 
    }, 10);

    const qrContainer = document.getElementById('realQRCodeContainer');
    if (qrContainer && typeof QRCode !== 'undefined') {
        qrContainer.innerHTML = "";
        new QRCode(qrContainer, {
            text: `NETWISH_PAY:${meta.name || 'Usuario'}:${user.email || ''}`,
            width: 170, 
            height: 170, 
            colorDark: "#000000", 
            colorLight: "#ffffff", 
            correctLevel: QRCode.CorrectLevel.H
        });
    }
};

// =======================================================
// 2. QR DE NEGOCIO EN MODAL
// =======================================================
window.openBusinessQR = function() {
    const biz = (typeof currentBusiness !== 'undefined') ? currentBusiness : null;
    if (!biz) return;
    
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) return;

    modalBody.innerHTML = `
        <div class="space-y-4 text-center">
            <h3 class="text-base font-bold text-black">QR de Cobro Comercial</h3>
            <p class="text-xs text-neutral-500">Muestra este código a tus clientes para recibir cobros en <strong class="text-black">${biz.name}</strong>.</p>
            <div id="businessQRCodeContainer" class="w-52 h-52 bg-white border border-neutral-200 rounded-3xl mx-auto flex items-center justify-center p-3 relative shadow-sm"></div>
            <div class="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/60">
                <span class="block text-xs font-bold text-black">${biz.name}</span>
                <span class="block text-[10px] text-neutral-400 font-mono uppercase tracking-widest mt-0.5">${biz.category || 'Comercio'}</span>
            </div>
            <button onclick="window.closeCustomModal()" class="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-xs transition active:scale-95 shadow-md">Ocultar QR</button>
        </div>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    modal.classList.remove('hidden');
    modal.style.display = "flex";
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        if (modalContent) modalContent.classList.remove('scale-95'); 
    }, 10);

    const container = document.getElementById('businessQRCodeContainer');
    if (container && typeof QRCode !== 'undefined') {
        container.innerHTML = "";
        const safeName = biz.name ? biz.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "Comercio";
        new QRCode(container, {
            text: `NETWISH_BUSINESS:${safeName}:${biz.id || biz.name}`,
            width: 170, 
            height: 170, 
            colorDark: "#000000", 
            colorLight: "#ffffff", 
            correctLevel: QRCode.CorrectLevel.H
        });
    }
};

// =======================================================
// 3. ACTIVADOR ROBUSTO DEL ESCÁNER QR
// =======================================================
window.startCameraModal = async function() {
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');

    if (!modal || !modalBody) return;

    modalBody.innerHTML = `
        <div class="space-y-4 text-center">
            <div class="space-y-1">
                <span class="text-[9px] font-mono uppercase tracking-widest text-neutral-400">LECTOR ÓPTICO</span>
                <h3 class="text-base font-bold text-black">Escáner QR</h3>
            </div>
            <div class="w-full h-64 bg-black rounded-3xl overflow-hidden relative flex items-center justify-center shadow-inner">
                <video id="cameraPreview" playsinline autoplay muted class="w-full h-full object-cover"></video>
                <canvas id="qrCanvas" class="hidden"></canvas>
                <div class="absolute inset-0 border border-white/20 m-6 rounded-2xl pointer-events-none flex items-center justify-center">
                    <div class="w-36 h-36 border-2 border-white rounded-2xl animate-pulse"></div>
                </div>
            </div>
            <p class="text-[11px] text-neutral-400">Enfoca a una mesa, comercio o usuario.</p>
            <button onclick="window.closeCustomModal()" class="w-full py-3 bg-neutral-100 hover:bg-neutral-200 text-black font-bold rounded-xl text-xs transition active:scale-95">Cerrar Cámara</button>
        </div>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    modal.classList.remove('hidden');
    modal.style.display = "flex";
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        if (modalContent) modalContent.classList.remove('scale-95'); 
    }, 10);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("El navegador no permite acceso a la cámara en este entorno (usa HTTPS o Localhost).");
        window.closeCustomModal();
        return;
    }

    try {
        window.currentCameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: { ideal: "environment" } } 
        });
        const videoElement = document.getElementById('cameraPreview');
        if (videoElement) { 
            videoElement.srcObject = window.currentCameraStream; 
            videoElement.setAttribute("playsinline", "true");
            videoElement.setAttribute("autoplay", "true");
            videoElement.setAttribute("muted", "true");
            await videoElement.play(); 
            startUniversalScanningLoop(); 
        }
    } catch (error) {
        console.warn("Acceso a cámara:", error);
        alert("Permiso de cámara no concedido o dispositivo ocupado.");
        window.closeCustomModal();
    }
};

function startUniversalScanningLoop() {
    const video = document.getElementById('cameraPreview');
    const canvas = document.getElementById('qrCanvas');
    if (!video || !canvas) return;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (window.scanningInterval) clearInterval(window.scanningInterval);

    window.scanningInterval = setInterval(() => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.height = video.videoHeight;
            canvas.width = video.videoWidth;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            
            if (typeof jsQR !== 'undefined') {
                const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
                if (code && code.data) {
                    clearInterval(window.scanningInterval);
                    window.stopCamera(); // Detiene el stream sin cerrar el modal
                    processScannedQRData(code.data);
                }
            }
        }
    }, 150);
}

// =======================================================
// 4. PROCESAMIENTO INTELIGENTE DEL CÓDIGO QR
// =======================================================
function processScannedQRData(rawText) {
    const qrText = (rawText || '').trim();

    // 1. Detección de Mesa por URL o parámetros
    if (qrText.includes('table=') || qrText.includes('biz=')) {
        try {
            let bizName = 'Restaurante Dani';
            let tableNum = 1;

            if (qrText.startsWith('http')) {
                const url = new URL(qrText);
                bizName = decodeURIComponent(url.searchParams.get('biz') || bizName);
                tableNum = parseInt(url.searchParams.get('table') || '1', 10);
            } else {
                const matchBiz = qrText.match(/biz=([^&]+)/);
                const matchTable = qrText.match(/table=(\d+)/);
                if (matchBiz) bizName = decodeURIComponent(matchBiz[1]);
                if (matchTable) tableNum = parseInt(matchTable[1], 10);
            }

            window.appState = window.appState || {};
            window.appState.activeBusinessName = bizName;
            window.appState.activeTableNumber = tableNum;

            if (typeof window.openTableSessionView === 'function') {
                window.openTableSessionView(bizName, tableNum);
                return;
            }
        } catch (e) {
            console.warn("Error parseando URL de mesa:", e);
        }
    }

    // 2. Detección de Mesa por Formato de Protocolo (NETWISH_TABLE:Restaurante:1)
    if (qrText.startsWith('NETWISH_TABLE:')) {
        const parts = qrText.split(':');
        const bizName = parts[1] || 'Restaurante Dani';
        const tableNum = parseInt(parts[2] || '1', 10);

        window.appState = window.appState || {};
        window.appState.activeBusinessName = bizName;
        window.appState.activeTableNumber = tableNum;

        if (typeof window.openTableSessionView === 'function') {
            window.openTableSessionView(bizName, tableNum);
            return;
        }
    }

    // 3. QR de Cobro Directo (NETWISH_PAY o NETWISH_BUSINESS)
    if (qrText.startsWith('NETWISH_PAY:') || qrText.startsWith('NETWISH_BUSINESS:')) {
        window.closeCustomModal();
        const parts = qrText.split(':');
        const targetPayee = parts[1] || 'Establecimiento NetWish';
        
        if (typeof window.openPaymentView === 'function') {
            window.openPaymentView(targetPayee);
        } else if (typeof switchTab === 'function') {
            const payeeNameEl = document.getElementById('payeeNameDisplay');
            if (payeeNameEl) payeeNameEl.innerText = targetPayee;
            switchTab('payment');
        }
        return;
    }

    // Si no coincide con ninguno, cerramos el modal e informamos
    window.closeCustomModal();
    alert(`Contenido leído: ${qrText}`);
}

// =======================================================
// 5. DETENCIÓN Y CIERRE DE MODAL
// =======================================================
window.stopCamera = function() {
    if (window.scanningInterval) { 
        clearInterval(window.scanningInterval); 
        window.scanningInterval = null; 
    }
    if (window.currentCameraStream) { 
        window.currentCameraStream.getTracks().forEach(track => track.stop()); 
        window.currentCameraStream = null; 
    }
};

window.closeCustomModal = function() {
    window.stopCamera();
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
window.startCamera = window.startCameraModal;