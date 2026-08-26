// api/download.js

export default async function handler(req, res) {
    const { url, filename } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Falta la URL del archivo' });
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('No se pudo obtener el archivo remoto');

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const safeFilename = (filename || 'beat-master.mp3').replace(/[^a-zA-Z0-9_\-\.]/g, '_');

        // Forzar la cabecera de descarga estricta que evita el reproductor
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        
        return res.send(buffer);
    } catch (error) {
        console.error("Error en endpoint de descarga:", error);
        return res.status(500).json({ error: 'Error procesando la descarga' });
    }
}