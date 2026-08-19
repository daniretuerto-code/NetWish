document.addEventListener('DOMContentLoaded', async () => {
    // 1. Comprobamos si venimos de un enlace de recuperación de contraseña
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
        openNewPasswordModal();
    }

    // 2. Comprobamos si hay sesión de usuario personal activa
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
    }

    // 3. Comprobamos si hay sesión de negocio activa
    const savedBusiness = localStorage.getItem('netwish_business');
    if (savedBusiness) {
        currentBusiness = JSON.parse(savedBusiness);
        switchTab('business-dashboard');
        document.getElementById('businessTitleName').innerText = currentBusiness.name;
        generateBusinessQR(currentBusiness);
        renderBusinessOrders(); // Carga las ventas en el panel
    } else {
        updateHeaderAvatar();
        renderProfileView();
    }

    // Inicializamos eventos y cargamos comercios
    initHoldButtonListeners();
    loadPublicBusinesses(); 
});

function renderProfileView() {
    const container = document.getElementById('profileContentContainer');

    if (currentBusiness) {
        // PERFIL EXCLUSIVO DE EMPRESA
        container.innerHTML = `
            <div class="flex items-center space-x-4 p-5 rounded-[32px] bg-black text-white shadow-xl">
                <div class="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-bold text-xs shrink-0">
                    <i data-lucide="store" class="w-6 h-6 text-white"></i>
                </div>
                <div class="overflow-hidden text-left flex-1">
                    <h2 class="text-base font-bold text-white truncate">${currentBusiness.name}</h2>
                    <p class="text-[10px] text-neutral-400 truncate mt-0.5">Perfil de Empresa • ${currentBusiness.category || 'Comercio'}</p>
                </div>
            </div>

            <div class="space-y-2 pt-4">
                <span class="text-[9px] font-mono uppercase tracking-widest text-neutral-400 px-1">Ajustes y Sesión</span>
                <div class="bg-neutral-50/80 border border-neutral-200/60 rounded-[32px] overflow-hidden shadow-sm">
                    <button onclick="openModal('Información Pública')" class="w-full px-5 py-4 text-left flex justify-between items-center hover:bg-neutral-100/60 transition border-b border-neutral-200/60">
                        <span class="text-xs font-bold text-black">Editar Perfil Público</span>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-neutral-400 shrink-0"></i>
                    </button>
                    <button onclick="openModal('Soporte Comercios')" class="w-full px-5 py-4 text-left flex justify-between items-center hover:bg-neutral-100/60 transition border-b border-neutral-200/60">
                        <span class="text-xs font-bold text-black">Soporte técnico NetWish</span>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-neutral-400 shrink-0"></i>
                    </button>
                    <button onclick="logoutBusiness()" class="w-full px-5 py-4 text-left flex justify-between items-center hover:bg-rose-50/60 transition text-rose-600 bg-rose-50/40">
                        <span class="text-xs font-bold flex items-center space-x-2">
                            <i data-lucide="log-out" class="w-4 h-4"></i>
                            <span>Volver al modo personal</span>
                        </span>
                    </button>
                </div>
            </div>
        `;
    } else if (currentUser) {
        // PERFIL PERSONAL
        const meta = currentUser.user_metadata || {};
        container.innerHTML = `
            <div class="flex items-center space-x-4 p-5 rounded-[32px] bg-neutral-50/80 border border-neutral-200/60 shadow-sm">
                <div class="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center font-bold text-xs shadow-md shrink-0">
                    ${meta.initials || 'NW'}
                </div>
                <div class="overflow-hidden text-left">
                    <h2 class="text-xs font-bold text-black truncate">${meta.name || ''} ${meta.surname || ''}</h2>
                    <p class="text-[10px] text-neutral-500 truncate">${currentUser.email} • Nac: ${meta.dob || ''}</p>
                </div>
            </div>

            <div class="space-y-2 pt-2">
                <span class="text-[9px] font-mono uppercase tracking-widest text-neutral-400 px-1">Configuración</span>
                <div class="bg-neutral-50/80 border border-neutral-200/60 rounded-[32px] overflow-hidden shadow-sm">
                    <button onclick="openModal('Métodos de Pago')" class="w-full px-5 py-4 text-left flex justify-between items-center hover:bg-neutral-100/60 transition border-b border-neutral-200/60">
                        <span class="text-xs font-bold text-black">Métodos de pago seguros</span>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-neutral-400 shrink-0"></i>
                    </button>
                    <button onclick="openModal('Mis Reservas')" class="w-full px-5 py-4 text-left flex justify-between items-center hover:bg-neutral-100/60 transition border-b border-neutral-200/60">
                        <span class="text-xs font-bold text-black">Mis reservas y tickets</span>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-neutral-400 shrink-0"></i>
                    </button>
                    <button onclick="openBusinessLoginModal()" class="w-full px-5 py-4 text-left flex justify-between items-center hover:bg-neutral-100/60 transition border-b border-neutral-200/60 bg-black/5">
                        <span class="text-xs font-bold text-black flex items-center space-x-2">
                            <i data-lucide="store" class="w-4 h-4 text-neutral-700"></i>
                            <span>¿Tienes un negocio? Acceso comercios</span>
                        </span>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-neutral-400 shrink-0"></i>
                    </button>
                    <button onclick="logoutUser()" class="w-full px-5 py-4 text-left flex justify-between items-center hover:bg-rose-50/60 transition text-rose-600">
                        <span class="text-xs font-bold">Cerrar sesión</span>
                        <i data-lucide="log-out" class="w-4 h-4 shrink-0"></i>
                    </button>
                </div>
            </div>
        `;
    } else {
        // NO LOGUEADO
        container.innerHTML = `
            <div class="p-8 rounded-[32px] bg-neutral-50/80 border border-neutral-200/60 text-center space-y-4 shadow-sm">
                <div class="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center mx-auto shadow-md">
                    <i data-lucide="user" class="w-6 h-6"></i>
                </div>
                <div class="space-y-1">
                    <h2 class="text-sm font-bold text-black">Inicia sesión en NetWish</h2>
                    <p class="text-xs text-neutral-500">Accede a tu cuenta segura en la nube para gestionar tus pagos y códigos QR.</p>
                </div>
                <button onclick="openAuthModal('login')" class="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-xs tracking-wide transition hover:bg-neutral-800 shadow-md">
                    Iniciar Sesión / Registrarse
                </button>
            </div>
        `;
    }
    lucide.createIcons();
}

function openBusinessLoginModal() {
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = `
        <div class="space-y-4 text-left">
            <div class="text-center space-y-1">
                <h3 class="text-base font-bold text-black">Acceso de Comercios</h3>
                <p class="text-[11px] text-neutral-500">Introduce las credenciales de tu establecimiento en Palencia.</p>
            </div>
            
            <div class="space-y-3 pt-2">
                <div>
                    <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Usuario de Comercio</label>
                    <input type="text" id="bizUser" placeholder="ej. panaderia" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-3 px-3.5 text-xs text-black focus:outline-none focus:border-black">
                </div>
                <div>
                    <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Contraseña</label>
                    <input type="password" id="bizPass" placeholder="••••••••" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-3 px-3.5 text-xs text-black focus:outline-none focus:border-black">
                </div>
            </div>

            <button onclick="authenticateBusiness()" class="w-full py-3.5 bg-black text-white font-semibold rounded-xl text-xs tracking-wide shadow-md">
                Entrar al Panel de Negocio
            </button>

            <div class="text-center pt-2 border-t border-neutral-100">
                <p class="text-[11px] text-neutral-500">¿Tienes un negocio y aún no estás en NetWish?</p>
                <button onclick="openBusinessSignupRequest()" class="text-xs font-bold text-black underline mt-0.5 hover:text-neutral-700">
                    Solicita tu alta aquí
                </button>
            </div>
            
            <button onclick="closeModal()" class="w-full py-1 text-neutral-400 font-medium text-xs text-center">
                Cancelar
            </button>
        </div>
    `;
    lucide.createIcons();

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
    }, 10);
}

function openBusinessSignupRequest() {
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="space-y-3 text-left">
            <div class="text-center space-y-0.5">
                <h3 class="text-base font-bold text-black">Solicitud de Alta Comercial</h3>
                <p class="text-[11px] text-neutral-500">Únete a la red urbana exclusiva de NetWish.</p>
            </div>
            
            <div class="space-y-2 pt-1">
                <div>
                    <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Ciudad</label>
                    <input type="text" id="reqBizCity" value="Palencia" readonly class="w-full bg-neutral-100 border border-neutral-200 rounded-xl py-2 px-3 text-xs text-neutral-600 focus:outline-none">
                </div>
                <div>
                    <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Calle / Ubicación</label>
                    <input type="text" id="reqBizAddress" placeholder="ej. C/ Mayor, 12" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2 px-3 text-xs text-black focus:outline-none focus:border-black">
                </div>
                <div>
                    <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Nombre del Negocio</label>
                    <input type="text" id="reqBizName" placeholder="ej. Panadería La Milagros" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2 px-3 text-xs text-black focus:outline-none focus:border-black">
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Categoría</label>
                        <select id="reqBizCategory" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2 px-2 text-xs text-black focus:outline-none focus:border-black">
                            <option value="Panadería">Panadería</option>
                            <option value="Peluquería">Peluquería</option>
                            <option value="Restaurante">Restaurante</option>
                            <option value="Comercio General">Comercio General</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Modalidad</label>
                        <select id="reqBizType" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2 px-2 text-xs text-black focus:outline-none focus:border-black">
                            <option value="Local físico">Local físico</option>
                            <option value="Online / Reparto">Online / Reparto</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Correo Electrónico (Email)</label>
                        <input type="email" id="reqBizEmail" placeholder="correo@negocio.com" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2 px-3 text-xs text-black focus:outline-none focus:border-black">
                    </div>
                    <div>
                        <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Número de Teléfono</label>
                        <input type="tel" id="reqBizPhone" placeholder="600 000 000" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2 px-3 text-xs text-black focus:outline-none focus:border-black">
                    </div>
                </div>
            </div>

            <button onclick="submitBusinessRequest()" class="w-full py-3 bg-black text-white font-semibold rounded-xl text-xs tracking-wide shadow-md mt-1">
                Enviar Solicitud al Equipo
            </button>
            
            <button onclick="openBusinessLoginModal()" class="w-full py-1 text-neutral-400 font-medium text-xs text-center">
                Volver al acceso
            </button>
        </div>
    `;
    lucide.createIcons();
}

async function submitBusinessRequest() {
    const city = document.getElementById('reqBizCity').value.trim();
    const address = document.getElementById('reqBizAddress').value.trim();
    const name = document.getElementById('reqBizName').value.trim();
    const category = document.getElementById('reqBizCategory').value;
    const type = document.getElementById('reqBizType').value;
    const email = document.getElementById('reqBizEmail').value.trim();
    const phone = document.getElementById('reqBizPhone').value.trim();

    if (!address || !name || !email || !phone) {
        alert("Por favor, rellena todos los campos.");
        return;
    }

    const messageHtml = `✨ <b>NUEVA SOLICITUD DE COMERCIO</b> ✨\n\n` +
                        `🏬 <b>Negocio:</b> ${name}\n\n` +
                        `📍 <b>Ciudad:</b> ${city}\n\n` +
                        `🗺 <b>Ubicación:</b> ${address}\n\n` +
                        `🏷 <b>Categoría:</b> ${category}\n\n` +
                        `📦 <b>Modalidad:</b> ${type}\n\n` +
                        `📧 <b>Email:</b> ${email}\n\n` +
                        `📱 <b>Teléfono:</b> ${phone}\n\n` +
                        `──────────────────\n` +
                        `<i>Enviado desde la app NetWish Palencia</i>`;

    await sendToTelegram(messageHtml);

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="space-y-4 text-center py-6">
            <div class="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <i data-lucide="check" class="w-7 h-7"></i>
            </div>
            <div class="space-y-1">
                <h3 class="text-base font-bold text-black">¡Solicitud Registrada!</h3>
                <p class="text-xs text-neutral-500 leading-relaxed">Hemos registrado tu establecimiento <strong class="text-black">${name}</strong>. Nos pondremos en contacto contigo muy pronto.</p>
            </div>
            <button onclick="closeModal()" class="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-xs">Entendido</button>
        </div>
    `;
    lucide.createIcons();
}

async function authenticateBusiness() {
    const user = document.getElementById('bizUser').value.trim();
    const pass = document.getElementById('bizPass').value.trim();

    if (!user || !pass) {
        alert("Introduce tu usuario y contraseña.");
        return;
    }

    let data, error;
    try {
        const response = await supabaseClient
            .from('businesses')
            .select('*')
            .eq('username', user)
            .eq('password', pass);
        data = response.data;
        error = response.error;
    } catch (err) {
        alert("Error de conexión técnica con la base de datos: " + err.message);
        return;
    }

    if (error) {
        alert("Error devuelto por la base de datos: " + error.message);
        return;
    }

    if (!data || data.length === 0) {
        const { data: checkUser } = await supabaseClient.from('businesses').select('*').eq('username', user);
        if (checkUser && checkUser.length > 0) {
            alert(`El usuario existe, pero la CONTRASEÑA es incorrecta. Asegúrate de que es exactamente: "${pass}"`);
        } else {
            alert(`No se encuentra el usuario: "${user}".\n\nPor favor, entra a tu tabla de Supabase, borra el nombre de la celda y vuélvelo a escribir asegurándote de no dejar espacios en blanco al final.`);
        }
        return;
    }

    const biz = data[0];

    currentBusiness = {
        id: biz.id || 'biz_db',
        name: biz.name || biz.Nombre || 'Mi Negocio',
        category: biz.category || biz.Categoria || 'Comercio'
    };

    localStorage.setItem('netwish_business', JSON.stringify(currentBusiness));
    closeModal();
    switchTab('business-dashboard');
    document.getElementById('businessTitleName').innerText = currentBusiness.name;
    updateHeaderAvatar();
    generateBusinessQR(currentBusiness);
    renderBusinessOrders();
}

function logoutBusiness() {
    localStorage.removeItem('netwish_business');
    currentBusiness = null;
    updateHeaderAvatar();
    renderProfileView();
    switchTab('home'); 
}

function openAuthModal(initialMode = 'login') {
    renderAuthForm(initialMode);
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
    }, 10);
}

function renderAuthForm(mode) {
    const modalBody = document.getElementById('modalBody');
    const isLogin = mode === 'login';

    modalBody.innerHTML = `
        <div class="space-y-3 text-left">
            <div class="text-center space-y-0.5">
                <h3 class="text-base font-bold text-black">${isLogin ? 'Iniciar Sesión' : 'Crear una cuenta'}</h3>
                <p class="text-[11px] text-neutral-500">${isLogin ? 'Introduce tus credenciales.' : 'Rellene sus datos personales.'}</p>
            </div>
            
            <div class="space-y-2.5 pt-1">
                ${!isLogin ? `
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Nombre</label>
                        <input type="text" id="authName" placeholder="Daniel" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs text-black focus:outline-none focus:border-black">
                    </div>
                    <div>
                        <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Apellidos</label>
                        <input type="text" id="authSurname" placeholder="Retuerto" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs text-black focus:outline-none focus:border-black">
                    </div>
                </div>
                <div>
                    <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Fecha de Nacimiento</label>
                    <input type="date" id="authDob" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs text-black focus:outline-none focus:border-black">
                </div>
                ` : ''}

                <div>
                    <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Correo Electrónico</label>
                    <input type="email" id="authEmail" placeholder="correo@ejemplo.com" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs text-black focus:outline-none focus:border-black">
                </div>

                ${!isLogin ? `
                <div>
                    <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Repetir Correo</label>
                    <input type="email" id="authEmailConfirm" placeholder="correo@ejemplo.com" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs text-black focus:outline-none focus:border-black">
                </div>
                ` : ''}

                <div>
                    <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Contraseña</label>
                    <input type="password" id="authPass" ${!isLogin ? 'oninput="checkPasswordStrength()"' : ''} placeholder="> 6 caracteres" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs text-black focus:outline-none focus:border-black">
                </div>
            </div>

            <button onclick="processAuthAction('${mode}')" class="w-full py-3.5 bg-black text-white font-semibold rounded-xl text-xs tracking-wide transition hover:bg-neutral-800 shadow-md mt-2">
                ${isLogin ? 'Entrar' : 'Completar Registro'}
            </button>
            
            ${isLogin ? `
            <div class="pt-2">
                <button onclick="signInWithGoogle()" class="w-full py-3.5 bg-white border border-neutral-200/90 rounded-xl text-xs font-semibold text-black flex items-center justify-center space-x-2.5 hover:bg-neutral-50 transition shadow-sm active:scale-98">
                    <svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.19v3.15C3.18 21.38 7.26 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.6H1.19C.43 8.13 0 9.87 0 12s.43 3.87 1.19 5.4l4.08-3.16z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.26 0 3.18 2.62 1.19 6.6l4.08 3.15c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
                    <span>Continuar con Google</span>
                </button>
            </div>
            ` : ''}

            <div class="text-center pt-2">
                ${isLogin ? `
                    <p class="text-xs text-neutral-500">¿No tienes cuenta? <button onclick="renderAuthForm('register')" class="text-black font-bold underline hover:text-neutral-700">Regístrate</button></p>
                ` : `
                    <p class="text-xs text-neutral-500">¿Ya tienes cuenta? <button onclick="renderAuthForm('login')" class="text-black font-bold underline hover:text-neutral-700">Inicia sesión</button></p>
                `}
            </div>

            <button onclick="closeModal()" class="w-full py-1 text-neutral-400 font-medium text-xs transition hover:text-black">
                Cancelar
            </button>
        </div>
    `;
    lucide.createIcons();
}

async function signInWithGoogle() {
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { 
            redirectTo: window.location.origin,
            queryParams: { prompt: 'select_account' }
        }
    });
    if (error) alert("Error al conectar con Google: " + error.message);
}

async function processAuthAction(mode) {
    const email = document.getElementById('authEmail').value.trim();
    const pass = document.getElementById('authPass').value.trim();
    if (!email) { alert("Introduce un correo válido."); return; }

    if (mode === 'register') {
        const name = document.getElementById('authName').value.trim();
        const surname = document.getElementById('authSurname').value.trim();
        const dob = document.getElementById('authDob').value;
        if (!name || !surname || !dob) { alert("Rellene todos los campos."); return; }
        const initials = (name[0] + (surname[0] || '')).toUpperCase();
        const { data, error } = await supabaseClient.auth.signUp({
            email, password: pass, options: { data: { name, surname, dob, initials } }
        });
        if (error) { alert("Error: " + error.message); return; }
        currentUser = data.user;
    } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
        if (error) { alert("Error al iniciar sesión."); return; }
        currentUser = data.user;
    }
    closeModal();
    updateHeaderAvatar();
    renderProfileView();
    switchTab('home');
}

async function logoutUser() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    updateHeaderAvatar();
    renderProfileView();
    switchTab('profile');
}