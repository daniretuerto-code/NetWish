// Inicialización de Iconos
lucide.createIcons();

// Conexión Supabase
const SUPABASE_URL = 'https://gamjjnyomhnyswbxlhgq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_096WH9RGLik4I_DsDR5iBg_QEKxC7bK';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Conexión Telegram
const BOT_TOKEN = '8852301765:AAGaOxNX4yusfsfIGUgDkY7xvQU_QJe-fuU';
const CHAT_ID = '7731711390';

// Variables Globales
let currentUser = null;
let currentBusiness = null; 
let currentStream = null;
let scanningInterval = null;

let activePayee = "";
let rawAmountString = "000"; 

let cartTotalValue = 0.00;
let cartItemCount = 0;
let cartItemsList = []; 
let isCartCheckout = false;
let pendingOrderDetails = {}; 
let allPublicBusinesses = []; 

let holdTimer = null;
let progressInterval = null;
let holdProgress = 0;

// Función de notificaciones
async function sendToTelegram(htmlText) {
    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, text: htmlText, parse_mode: 'HTML' })
        });
    } catch (error) {
        console.error("Error Telegram:", error);
    }
}