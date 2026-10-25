import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import Icon from '../../components/Icon.jsx';
import { Mono, PageHeader, Sheet, useToast } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { safeSlug, updateBusiness, uploadPublicFile } from '../../lib/data.js';
import { CATEGORIES, kindOf } from '../../lib/categories.js';
import { businessUrl } from '../../lib/qr.js';
import { toneFor } from '../../lib/format.js';

const MAX_IMAGE_MB = 8;

function BusinessQrSheet({ open, onClose, business }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (open) QRCode.toDataURL(businessUrl(business.name), { margin: 1, width: 440 }).then(setSrc);
  }, [open, business.name]);
  return (
    <Sheet open={open} onClose={onClose} title="QR de tu negocio">
      <div className="stack printable" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="qr-box">{src ? <img src={src} alt="Código QR de tu negocio" /> : <div className="spinner" />}</div>
        <strong style={{ fontSize: 22 }}>Reserva en {business.name}</strong>
        <span className="small muted">Escanea para ver {kindOf(business) === 'restaurant' ? 'la carta y reservar mesa' : 'nuestros servicios y reservar'}</span>
      </div>
      <button className="btn primary block" style={{ marginTop: 14 }} onClick={() => window.print()}><Icon name="printer" size={18} /> Imprimir</button>
    </Sheet>
  );
}

export default function Settings() {
  const { business, refreshBusiness, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    category: business.category || '',
    telefono: business.telefono || '',
    notification_email: business.notification_email || '',
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value.slice(0, 160) }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateBusiness(business.username, {
        category: form.category.trim() || null,
        telefono: form.telefono.trim() || null,
        notification_email: form.notification_email.trim() || null,
      });
      await refreshBusiness();
      toast('Datos guardados');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const uploadImage = (field) => async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Elige una imagen', 'error'); return; }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) { toast(`La imagen no puede pasar de ${MAX_IMAGE_MB} MB`, 'error'); return; }
    setUploading(field);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const url = await uploadPublicFile('public-images', `${safeSlug(business.name)}/${field}_${Date.now()}.${ext}`, file);
      await updateBusiness(business.username, { [field]: url });
      await refreshBusiness();
      toast(field === 'cover_url' ? 'Portada actualizada' : 'Logo actualizado');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <PageHeader eyebrow={business.name} title="Ajustes" />

      <div className="cover" style={{ minHeight: 190, background: toneFor(business.name) }}>
        {business.cover_url && <img className="cover-img" src={business.cover_url} alt="" />}
        <span className="cover-shade" />
        <div className="row between" style={{ position: 'relative', marginTop: 'auto', padding: 18, alignItems: 'flex-end' }}>
          <span className="row" style={{ gap: 12 }}>
            <Mono name={business.name} image={business.image} size="lg" />
            <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', textShadow: '0 1px 12px rgba(0,0,0,.35)' }}>{business.name}</span>
          </span>
        </div>
      </div>

      <div className="bento">
        <label className="widget link stack" style={{ gap: 14, cursor: 'pointer' }}>
          <Icon name="image" size={24} />
          <strong>{uploading === 'cover_url' ? 'Subiendo…' : 'Cambiar portada'}</strong>
          <input type="file" accept="image/*" hidden onChange={uploadImage('cover_url')} />
        </label>
        <label className="widget link stack" style={{ gap: 14, cursor: 'pointer' }}>
          <Icon name="upload" size={24} />
          <strong>{uploading === 'image' ? 'Subiendo…' : 'Cambiar logo'}</strong>
          <input type="file" accept="image/*" hidden onChange={uploadImage('image')} />
        </label>
      </div>

      <form className="widget stack" onSubmit={save}>
        <h2 className="title-lg">Datos del negocio</h2>
        <div className="field">
          <label htmlFor="s-cat">Categoría</label>
          <input id="s-cat" className="input" list="cats" value={form.category} onChange={set('category')} />
          <datalist id="cats">{CATEGORIES.map((c) => <option key={c.key} value={c.label} />)}</datalist>
        </div>
        <div className="field"><label htmlFor="s-tel">Teléfono</label><input id="s-tel" className="input" type="tel" value={form.telefono} onChange={set('telefono')} /></div>
        <div className="field">
          <label htmlFor="s-mail">Correo para avisos de reservas</label>
          <input id="s-mail" className="input" type="email" value={form.notification_email} onChange={set('notification_email')} placeholder="reservas@tunegocio.es" />
        </div>
        <button className="btn primary block" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
      </form>

      <div className="widget" style={{ paddingBottom: 4 }}>
        {kindOf(business) === 'restaurant' && (
          <Link to="/panel/personalizar" className="list-row">
            <Icon name="gear" /><span className="grow t">Personaliza tu negocio</span><Icon name="chevron" size={18} />
          </Link>
        )}
        {kindOf(business) === 'beauty' && (
          <Link to="/panel/horario" className="list-row">
            <Icon name="calendar" /><span className="grow t">Horario y equipo</span><Icon name="chevron" size={18} />
          </Link>
        )}
        <button className="list-row" onClick={() => setPayOpen(true)}>
          <Icon name="qr" /><span className="grow t">QR para el escaparate o el mostrador</span><Icon name="chevron" size={18} />
        </button>
        <a className="list-row" href={businessUrl(business.name)} target="_blank" rel="noreferrer">
          <Icon name="store" /><span className="grow t">Ver mi página como cliente</span><Icon name="chevron" size={18} />
        </a>
        <button className="list-row" onClick={() => signOut().then(() => navigate('/negocios'))}>
          <Icon name="logout" /><span className="grow t">Cerrar sesión</span>
        </button>
      </div>

      <BusinessQrSheet open={payOpen} onClose={() => setPayOpen(false)} business={business} />
    </div>
  );
}
