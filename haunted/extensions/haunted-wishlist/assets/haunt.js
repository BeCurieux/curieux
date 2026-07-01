// Storefront logic for Haunted Wishlist. Talks to the app through the App Proxy
// at /apps/haunted/*. Push permission is requested ONLY on the save click —
// never on page load (cold prompts get permanently blocked). CLAUDE.md §Storefront.
(function () {
  var PROXY = '/apps/haunted';
  var SUB_KEY = 'haunt_subscriber_id';

  function subId() { return localStorage.getItem(SUB_KEY); }
  function setSubId(id) { localStorage.setItem(SUB_KEY, id); }

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  // 0 = just saved (full glow), 1 = fully faded (~21 days). Deterministic; never
  // stored. Mirrors src/lib/fade.ts.
  function glow(savedAtMs) {
    var fade = Math.min(1, Math.max(0, (Date.now() - savedAtMs) / (21 * 24 * 3600 * 1000)));
    return 1 - fade;
  }

  async function ensurePushSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    var cfg = await fetch(PROXY + '/config').then(function (r) { return r.json(); });
    if (!cfg.vapidPublicKey) return null;

    var reg = await navigator.serviceWorker.register(PROXY + '/sw', { scope: '/' });
    await navigator.serviceWorker.ready;

    // This is the moment we ask — on an explicit save, never on load.
    var perm = await Notification.requestPermission();
    if (perm !== 'granted') return null;

    var sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cfg.vapidPublicKey),
      });
    }
    var body = { endpoint: sub.endpoint, keys: sub.toJSON().keys };
    var res = await fetch(PROXY + '/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (r) { return r.json(); });
    if (res.subscriber_id) setSubId(res.subscriber_id);
    return res.subscriber_id || null;
  }

  async function save(product) {
    // 1) create the wishlist item, 2) THEN request push opt-in.
    var sid = subId() || (await ensurePushSubscription());
    if (!sid) sid = subId();
    var payload = Object.assign({ subscriber_id: sid }, product);
    var res = await fetch(PROXY + '/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (r) { return r.json(); });
    // If we had no subscriber yet, opt in now and retry the attach.
    if (!sid) {
      sid = await ensurePushSubscription();
      if (sid) {
        await fetch(PROXY + '/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign({ subscriber_id: sid }, product)),
        });
      }
    }
    return res;
  }

  function wireSaveButtons() {
    document.querySelectorAll('[data-haunt-save]').forEach(function (btn) {
      if (btn.dataset.hauntBound) return;
      btn.dataset.hauntBound = '1';
      btn.addEventListener('click', async function () {
        btn.disabled = true;
        btn.textContent = 'binding a little spirit…';
        try {
          await save({
            product_id: btn.getAttribute('data-product-id'),
            variant_id: btn.getAttribute('data-variant-id') || null,
            title: btn.getAttribute('data-title'),
            image_url: btn.getAttribute('data-image') || null,
            price_cents: parseInt(btn.getAttribute('data-price-cents'), 10),
            in_stock: btn.getAttribute('data-in-stock') !== 'false',
          });
          btn.textContent = '👻 saved — it will haunt you';
        } catch (e) {
          btn.textContent = 'let it haunt you';
          btn.disabled = false;
        }
      });
    });
  }

  async function renderWishlist() {
    var mount = document.querySelector('[data-haunt-wishlist]');
    if (!mount) return;
    var sid = subId();
    var items = [];
    if (sid) {
      var res = await fetch(PROXY + '/wishlist?subscriber_id=' + encodeURIComponent(sid))
        .then(function (r) { return r.json(); });
      items = res.items || [];
    }
    if (items.length === 0) {
      mount.innerHTML = '<p class="haunt-empty">No little ghosts yet. Save something you love.</p>';
      return;
    }
    mount.innerHTML = '';
    items.forEach(function (it) {
      var g = glow(new Date(it.saved_at).getTime());
      var card = document.createElement('div');
      card.className = 'haunt-card';
      card.style.opacity = String(0.5 + 0.5 * g);
      card.style.boxShadow = '0 0 ' + (8 + 28 * g) + 'px rgba(255,184,107,' + (0.15 + 0.5 * g) + ')';
      card.innerHTML =
        (it.image_url ? '<img src="' + it.image_url + '" alt="">' : '') +
        '<div class="haunt-title">' + it.title + '</div>' +
        '<div class="haunt-actions">' +
        '<a class="haunt-reunite" href="/products/' + String(it.product_id).split("/").pop() + '">Reunite</a>' +
        '<button class="haunt-release" data-id="' + it.id + '">Release</button>' +
        '</div>';
      card.querySelector('.haunt-release').addEventListener('click', async function () {
        await fetch(PROXY + '/wishlist?id=' + encodeURIComponent(it.id), { method: 'DELETE' });
        card.style.transition = 'opacity .6s ease';
        card.style.opacity = '0';
        setTimeout(function () { card.remove(); }, 600);
      });
      mount.appendChild(card);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    wireSaveButtons();
    renderWishlist();
  });
})();
