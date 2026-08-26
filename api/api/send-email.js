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
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.warn("Falta RESEND_API_KEY en variables de entorno.");
            return res.status(200).json({ success: true, warning: 'Simulado por falta de API Key' });
        }

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'NetWish Palencia <onboarding@resend.dev>',
                to: Array.isArray(to) ? to : [to],
                subject: subject,
                html: html
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Error en Resend API');
        }

        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error("Error en api/send-email:", err);
        return res.status(500).json({ error: err.message });
    }
}