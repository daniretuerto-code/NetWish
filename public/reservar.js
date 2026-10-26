/* NetWish - boton "Reservar mesa" para la web de un restaurante.
   <script src="https://netwish.es/reservar.js" data-negocio="casa-lucio" async></script>
   Opcional: data-texto="Reservar" - data-posicion="izquierda" - data-boton="no" (solo el enlace en
   cualquier elemento con el atributo data-netwish-reservar). */
(function () {
  var script = document.currentScript || document.querySelector('script[data-negocio]');
  if (!script || window.__netwishReservar) return;
  window.__netwishReservar = true;
  var slug = script.getAttribute('data-negocio');
  if (!slug) return;
  var origin = new URL(script.src).origin;
  var url = origin + '/r/' + encodeURIComponent(slug) + '?embed=1';
  var label = script.getAttribute('data-texto') || 'Reservar mesa';
  var left = script.getAttribute('data-posicion') === 'izquierda';

  var css = document.createElement('style');
  css.textContent =
    '.nw-btn{position:fixed;bottom:20px;' + (left ? 'left' : 'right') + ':20px;z-index:2147483000;display:flex;align-items:center;gap:10px;height:54px;padding:0 22px 0 8px;border:0;border-radius:999px;background:#111;color:#fff;font:700 16px/1 -apple-system,Segoe UI,Inter,Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);cursor:pointer}' +
    '.nw-btn i{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:#D4F25C;color:#111;font-style:normal;font-size:20px}' +
    '.nw-over{position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}' +
    '.nw-box{position:relative;width:min(480px,100%);height:min(780px,100%);background:#F2F0EB;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35)}' +
    '@media (max-width:520px){.nw-box{border-radius:0;height:100%}}' +
    '.nw-box iframe{width:100%;height:100%;border:0}' +
    '.nw-x{position:absolute;top:10px;right:10px;width:40px;height:40px;border:0;border-radius:50%;background:#111;color:#fff;font-size:22px;line-height:1;cursor:pointer;z-index:1}';
  document.head.appendChild(css);

  function open(e) {
    if (e) e.preventDefault();
    var over = document.createElement('div');
    over.className = 'nw-over';
    over.innerHTML = '<div class="nw-box" role="dialog" aria-label="' + label.replace(/"/g, '&quot;').replace(/</g, '&lt;') + '"><button class="nw-x" aria-label="Cerrar">\u00d7</button><iframe title="Reservar en NetWish" allow="clipboard-write"></iframe></div>';
    over.querySelector('iframe').src = url;
    var close = function () { over.remove(); document.removeEventListener('keydown', esc); };
    var esc = function (k) { if (k.key === 'Escape') close(); };
    over.querySelector('.nw-x').onclick = close;
    over.onclick = function (ev) { if (ev.target === over) close(); };
    document.addEventListener('keydown', esc);
    document.body.appendChild(over);
  }

  function ready() {
    var own = document.querySelectorAll('[data-netwish-reservar]');
    for (var i = 0; i < own.length; i++) own[i].addEventListener('click', open);
    if (script.getAttribute('data-boton') === 'no') return;
    var btn = document.createElement('button');
    btn.className = 'nw-btn';
    btn.type = 'button';
    btn.innerHTML = '<i>\u2726</i>';
    btn.appendChild(document.createTextNode(label));
    btn.onclick = open;
    document.body.appendChild(btn);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
