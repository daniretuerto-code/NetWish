// Forces a file download for beats bought in NetWish. Only files from the
// project's own public "beats" bucket are allowed, so this can't be used as an open proxy.
import { SUPABASE_URL } from './_lib.js';

const ALLOWED_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/beats/`;

export default async function handler(req, res) {
  const { url, filename } = req.query;
  if (typeof url !== 'string' || !url.startsWith(ALLOWED_PREFIX) || url.includes('..')) {
    return res.status(400).json({ error: 'Archivo no permitido' });
  }

  try {
    const response = await fetch(url, { redirect: 'error' });
    if (!response.ok) return res.status(404).json({ error: 'Archivo no encontrado' });

    const buffer = Buffer.from(await response.arrayBuffer());
    const safeFilename = String(filename || 'beat-master.mp3').replace(/[^a-zA-Z0-9_\-.]/g, '_').slice(0, 120);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Cache-Control', 'private, max-age=0');
    return res.send(buffer);
  } catch (error) {
    console.error('download', error);
    return res.status(500).json({ error: 'Error procesando la descarga' });
  }
}
