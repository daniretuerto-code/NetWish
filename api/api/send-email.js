// api/send-email.js

export default async function handler(req, res) {
    // Configurar CORS para permitir peticiones desde la app
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
        return res.status(400).json({ error: 'Faltan parámetros obligatorios (to, subject, html)' });
    }

    try {
        // Usamos la API de Resend mediante fetch puro de Node (sin dependencias externas que fallen)
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        
        if (!RESEND_API_KEY) {
            console.warn("ADVERTENCIA: RESEND_API_KEY no está configurada en las variables de entorno de Vercel.");
            // Simulamos éxito para que la app no se bloquee en local si no hay clave
            return res.status(200).json({ success: true, warning: 'Simulado por falta de API Key' });
        }

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'NetWish Palencia <onboarding@resend.dev>',
                to: [to],
                subject: subject,
                html: html
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error enviando correo con Resend');
        }

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Error crítico en api/send-email:", error);
        return res.status(500).json({ error: error.message });
    }
}