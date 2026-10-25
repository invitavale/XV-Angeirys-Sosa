/* =========================================================
   Lista de regalos — XV Angeirys
   Conectada a Supabase (proyecto Invitavale), evento "xv-angeirys".
   - get_claimed_gifts(p_event)            → ids ya reservados
   - claim_gifts(p_event, p_item_ids, p_name) → reserva (sin repetir)
   ========================================================= */
(function () {
    'use strict';

    const SB_URL = 'https://nsujtmfmyoeibbvwkzez.supabase.co';
    const SB_KEY = 'sb_publishable_vngm39TRXt50jchjL2_gGQ_kZIl_n_P';
    const EVENT  = 'xv-angeirys';

    const ITEMS = [
        ['r01', 'Productos para el cabello y accesorios', '1 gelatina Extreme transparente, 2 gelatinas transparentes, 3 ceras Gala, 4 pulseras doradas y cadenas doradas sencillas.'],
        ['r02', 'Pantalón cargo', 'Azul cielo, de Zara o Bershka. Talla 36.'],
        ['r03', 'Tops lisos', 'Talla S, de Stradivarius, Zara o Bershka.'],
        ['r04', 'Tenis ASICS', 'Dorados con blanco. US 7.5 · UK 6.5 · EU 40.5 · 25.5 cm.'],
        ['r05', 'Tenis New Balance 9060', 'Blancos o negros. US men 7.5 · UK 6.5 · US women 9 · 25.5 cm.'],
        ['r06', 'Carteras pequeñas', 'Blancas, beige, rosado suave o negras.'],
        ['r07', 'Sandalias Tommy Hilfiger', 'Blancas o crema. Talla 9.'],
        ['r08', 'Colonias Victoria’s Secret', 'De olores dulces.'],
        ['r09', 'Cremas Bath & Body Works', 'De olores dulces o para la noche.'],
        ['r10', 'Tenis Adidas Samba', 'Negros. Talla 9.'],
        ['r11', 'Polos oversize', 'Amarillo, gris, blanco, rosado viejo o azul claro.'],
        ['r12', 'Pijamas de seda con pantalón', 'Blusa talla S y pantalón talla M. Confirmar tallas.'],
        ['r13', 'Cortinas rosado suave', '4 cortinas y 2 fundas para almohadas.'],
        ['r14', 'Cortinas blancas', '4 cortinas y 2 fundas para almohadas.'],
        ['r15', 'Sábanas', 'Grises o rosa suave, tamaño 60. Confirmar la medida.'],
        ['r16', 'Trajes de baño', 'De una pieza, manga larga. Talla S.'],
        ['r17', 'Accesorios de playa', 'Cartera playera y accesorios para la playa.'],
        ['r18', 'Pulsera Pandora', 'De plata.'],
        ['r19', 'Charms para Pandora', 'De plata.'],
        ['r20', 'Medias deportivas', 'Nike, Adidas o New Balance.'],
        ['r21', 'Zapatillas de medio tacón', 'Plateadas. Talla 9.'],
        ['r22', 'Zapatillas de medio tacón', 'Beige. Talla 9.'],
        ['r23', 'Conjunto de vestir de lino', 'Talla S.'],
        ['r24', 'Toalla de baño', 'Rosada y personalizada.'],
        ['r25', 'Cadena y guillo', 'De plata, sencillos.']
    ];

    let claimed = new Set();
    let selected = new Set();
    let loaded = false;
    let busy = false;

    const $ = (id) => document.getElementById(id);

    async function rpc(fn, body) {
        const res = await fetch(SB_URL + '/rest/v1/rpc/' + fn, {
            method: 'POST',
            headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('rpc ' + fn + ' ' + res.status);
        return res.json();
    }

    function status(msg, kind) {
        const el = $('glStatus');
        if (!el) return;
        el.textContent = msg || '';
        el.className = 'gl-status' + (kind ? ' is-' + kind : '');
    }

    function render() {
        const grid = $('glGrid');
        if (!grid) return;
        grid.innerHTML = '';
        ITEMS.forEach(([id, title, detail], i) => {
            const taken = claimed.has(id);
            const sel = selected.has(id);
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'gl-item' + (taken ? ' is-taken' : '') + (sel ? ' is-selected' : '');
            card.disabled = taken;
            card.setAttribute('aria-pressed', sel ? 'true' : 'false');
            card.innerHTML =
                '<span class="gl-img"><img src="regalos/' + id + '.jpg" alt="" loading="lazy">' +
                (taken ? '<span class="gl-badge">Reservado</span>' : '<span class="gl-check" aria-hidden="true"></span>') +
                '</span>' +
                '<span class="gl-num">' + (i + 1) + '</span>' +
                '<span class="gl-title"></span>' +
                '<span class="gl-detail"></span>';
            card.querySelector('.gl-title').textContent = title;
            card.querySelector('.gl-detail').textContent = detail;
            if (!taken) card.addEventListener('click', () => toggle(id));
            grid.appendChild(card);
        });
        updateFoot();
    }

    function toggle(id) {
        if (selected.has(id)) selected.delete(id); else selected.add(id);
        render();
    }

    function updateFoot() {
        const n = selected.size;
        const count = $('glCount');
        const btn = $('glConfirm');
        const free = ITEMS.length - claimed.size;
        if (count) {
            count.textContent = n === 0
                ? (loaded ? 'Toca un regalo para elegirlo · ' + free + ' disponibles' : 'Toca un regalo para elegirlo')
                : n + (n === 1 ? ' regalo elegido' : ' regalos elegidos');
        }
        if (btn) btn.disabled = n === 0 || busy;
    }

    async function load(keepStatus) {
        if (!keepStatus) status('Cargando regalos disponibles…');
        try {
            const ids = await rpc('get_claimed_gifts', { p_event: EVENT });
            claimed = new Set(Array.isArray(ids) ? ids : []);
            selected.forEach(id => { if (claimed.has(id)) selected.delete(id); });
            loaded = true;
            if (!keepStatus) status('');
        } catch (e) {
            status('No pudimos cargar la lista en este momento. Revisa tu conexión e inténtalo de nuevo.', 'error');
        }
        render();
    }

    async function confirmGifts() {
        if (busy || selected.size === 0) return;
        const input = $('glName');
        const name = (input && input.value || '').trim();
        if (!name) {
            status('Escribe tu nombre para reservar tu regalo.', 'error');
            if (input) input.focus();
            return;
        }
        busy = true; updateFoot();
        status('Reservando…');
        try {
            const r = await rpc('claim_gifts', { p_event: EVENT, p_item_ids: Array.from(selected), p_name: name });
            if (!r || r.ok === false) throw new Error('claim');
            const got = r.claimed || [];
            const lost = r.taken || [];
            got.forEach(id => claimed.add(id));
            lost.forEach(id => claimed.add(id));
            selected.clear();
            if (got.length && !lost.length) {
                status('¡Gracias, ' + name + '! Tu regalo quedó reservado. 💗', 'ok');
                if (typeof showToast === 'function') showToast('¡Regalo reservado!', 'Gracias por tu detalle, ' + name + '.');
            } else if (got.length) {
                status('Reservamos ' + got.length + ' regalo(s). Algunos ya los había elegido otra persona.', 'ok');
            } else {
                status('Ese regalo ya lo eligió otra persona. Por favor elige otro.', 'error');
            }
            await load(true);
        } catch (e) {
            status('No se pudo reservar. Inténtalo de nuevo en un momento.', 'error');
        }
        busy = false; updateFoot();
    }

    function openGiftList() {
        const m = $('giftListModal');
        if (!m) return;
        m.removeAttribute('hidden');
        requestAnimationFrame(() => m.classList.add('is-open'));
        document.documentElement.classList.add('gl-lock');
        render();
        load();
    }

    function closeGiftList() {
        const m = $('giftListModal');
        if (!m) return;
        m.classList.remove('is-open');
        document.documentElement.classList.remove('gl-lock');
        setTimeout(() => m.setAttribute('hidden', ''), 250);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeGiftList();
    });

    window.openGiftList = openGiftList;
    window.closeGiftList = closeGiftList;
    window.confirmGifts = confirmGifts;
})();
