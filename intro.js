/* =========================================================
   Intro en video + transición mágica hacia la invitación
   ---------------------------------------------------------
   Flujo:
   1. El video aparece en pausa. Al tocar cualquier parte de la
      pantalla arranca el video (sin sonido) y la música de fondo.
   2. Se reproduce intro.mp4 a pantalla completa.
   3. Al final del video (que termina en un destello dorado),
      la pantalla se ilumina, la portada "florece" detrás de la luz,
      estallan chispas doradas y caen pétalos de rosa.
   4. El nombre aparece letra por letra.
   5. Al bajar, cada sección aparece con un brillo suave.
   ========================================================= */
(function () {
    'use strict';

    const html = document.documentElement;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Activa los estilos de la intro solo si este script cargó bien.
    html.classList.add('xv-intro-ready', 'xv-locked');

    let layer, video, skipBtn, flash, canvas, tapHint;
    let state = 'idle'; // idle | playing | finishing | done
    let videoFailed = false;
    let safetyTimer = null;

    function $(id) { return document.getElementById(id); }

    function init() {
        layer = $('introLayer');
        video = $('introVideo');
        skipBtn = $('introSkip');
        flash = $('introFlash');
        canvas = $('magicCanvas');
        tapHint = $('introTap');

        splitName();
        setupScrollReveal();

        // Espera el toque: cualquier parte de la pantalla inicia todo.
        if (layer) {
            layer.classList.add('is-waiting');
            layer.addEventListener('click', onTap);
            // En iPhone/Safari el toque (touchend) cuenta como gesto del usuario: la música arranca ahí mismo.
            layer.addEventListener('touchend', onTap, { passive: true });
            document.addEventListener('keydown', (e) => {
                if (state === 'idle' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onTap(); }
            });
        }

        if (!video) { videoFailed = true; return; }

        video.addEventListener('error', () => { videoFailed = true; if (state === 'playing') finish(); }, true);
        video.addEventListener('playing', () => {
            clearTimeout(safetyTimer);
            layer.classList.add('is-running');
        });
        video.addEventListener('timeupdate', () => {
            // El video termina en un destello: empalmamos la luz un poquito antes.
            if (state === 'playing' && video.duration && video.currentTime >= video.duration - 0.45) finish();
        });
        video.addEventListener('ended', () => { if (state === 'playing') finish(); });
        video.addEventListener('waiting', () => layer && layer.classList.add('is-buffering'));
        video.addEventListener('canplay', () => layer && layer.classList.remove('is-buffering'));

        if (skipBtn) skipBtn.addEventListener('click', (e) => { e.stopPropagation(); finish(); });
        // Al tocar durante el video no pasa nada (evita saltos accidentales).
    }

    function canPlay() {
        return !!video && !videoFailed && video.canPlayType('video/mp4') !== '';
    }

    function onTap() {
        if (state !== 'idle') return;
        // La música arranca en este mismo toque (requisito de iPhone/Android).
        if (typeof window.startMusic === 'function') window.startMusic();
        start();
    }

    function start() {
        if (state !== 'idle') return;
        if (layer) layer.classList.remove('is-waiting');
        if (!canPlay()) { finish(); return; }

        state = 'playing';
        layer.classList.add('is-playing');
        video.muted = true; // el video no lleva sonido, solo la música de fondo
        try { video.currentTime = 0; } catch (e) {}

        const p = video.play();
        if (p && typeof p.catch === 'function') p.catch(() => finish());

        // Botón "Saltar" aparece después de un momento.
        setTimeout(() => skipBtn && state === 'playing' && skipBtn.classList.add('is-visible'), 1800);
        // Si en 8 s el video no ha arrancado (conexión muy lenta), seguimos.
        safetyTimer = setTimeout(() => {
            if (state === 'playing' && (video.paused || video.currentTime < 0.1)) finish();
        }, 8000);
    }

    function finish() {
        if (state === 'finishing' || state === 'done') return;
        state = 'finishing';
        clearTimeout(safetyTimer);

        if (flash) flash.classList.add('is-on');
        if (skipBtn) skipBtn.classList.remove('is-visible');

        setTimeout(() => {
            if (layer) layer.classList.add('is-gone');
            try { video.pause(); } catch (e) {}
            reveal();
        }, 520);
    }

    function reveal() {
        state = 'done';
        html.classList.remove('xv-locked');
        html.classList.add('xv-revealed');
        window.scrollTo(0, 0);

        if (flash) {
            flash.classList.add('is-on');
            // Doble rAF para que el navegador pinte el destello antes de disolverlo.
            // Un instante de luz plena (empalma con el destello del video) y se disuelve.
            setTimeout(() => flash.classList.add('is-out'), 260);
            setTimeout(() => { flash.style.display = 'none'; }, 2900);
        }
        if (layer) setTimeout(() => { layer.style.display = 'none'; }, 700);

        if (typeof window.showMusicButton === 'function') window.showMusicButton();
        if (!reduceMotion) Magic.run();
    }

    /* ---------- Nombre letra por letra ---------- */
    function splitName() {
        const el = document.querySelector('.hero-text .names');
        if (!el || el.dataset.split) return;
        const text = el.textContent.trim();
        el.dataset.split = '1';
        el.setAttribute('aria-label', text);
        el.textContent = '';
        [...text].forEach((ch, i) => {
            const s = document.createElement('span');
            s.className = 'xv-letter';
            s.setAttribute('aria-hidden', 'true');
            s.style.setProperty('--i', i);
            s.textContent = ch === ' ' ? '\u00A0' : ch;
            el.appendChild(s);
        });
    }

    /* ---------- Aparición suave al hacer scroll ---------- */
    function setupScrollReveal() {
        const targets = Array.from(document.querySelectorAll(
            '.content section, .content .footer, .content .section-divider'
        ));
        if (reduceMotion) return;
        targets.forEach(t => t.classList.add('xv-reveal'));

        // Revisión por posición: funciona igual dentro de visores/iframes y con
        // los separadores (que miden 0 px de alto y el observer no siempre detecta).
        let pending = targets.slice();
        let queued = false;
        function check() {
            queued = false;
            const vh = window.innerHeight || document.documentElement.clientHeight;
            pending = pending.filter(t => {
                const box = t.classList.contains('section-divider') ? (t.querySelector('img') || t) : t;
                const r = box.getBoundingClientRect();
                if (r.top < vh * 0.94 && r.bottom > -50) { t.classList.add('is-in'); return false; }
                return true;
            });
            if (!pending.length) {
                window.removeEventListener('scroll', onScroll);
                window.removeEventListener('resize', onScroll);
            }
        }
        function onScroll() { if (!queued) { queued = true; requestAnimationFrame(check); } }
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        document.addEventListener('touchmove', onScroll, { passive: true });
        setInterval(() => { if (pending.length) check(); }, 700);
        check();
    }

    /* ---------- Chispas doradas (canvas a pantalla completa) ---------- */
    const Magic = {
        ctx: null, w: 0, h: 0, dpr: 1, sparks: [], raf: 0,

        resize() {
            this.dpr = Math.min(window.devicePixelRatio || 1, 2);
            this.w = window.innerWidth;
            this.h = window.innerHeight;
            canvas.width = this.w * this.dpr;
            canvas.height = this.h * this.dpr;
            canvas.style.width = this.w + 'px';
            canvas.style.height = this.h + 'px';
            this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        },

        run() {
            Petals.run();
            if (!canvas || !canvas.getContext) return;
            this.ctx = canvas.getContext('2d');
            this.resize();
            window.addEventListener('resize', () => this.resize());
            canvas.classList.add('is-active');

            const small = this.w < 768;
            const cx = this.w / 2, cy = this.h * 0.48;
            const nSparks = small ? 90 : 150;
            for (let i = 0; i < nSparks; i++) {
                const a = Math.random() * Math.PI * 2;
                const sp = 2 + Math.random() * (small ? 7 : 10);
                this.sparks.push({
                    x: cx, y: cy,
                    vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                    r: 0.8 + Math.random() * 2.4,
                    life: 0, max: 70 + Math.random() * 70,
                    tw: Math.random() * Math.PI * 2
                });
            }

            cancelAnimationFrame(this.raf);
            const loop = () => {
                this.frame();
                if (this.sparks.length) this.raf = requestAnimationFrame(loop);
                else { this.ctx.clearRect(0, 0, this.w, this.h); canvas.classList.remove('is-active'); }
            };
            this.raf = requestAnimationFrame(loop);
        },

        frame() {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.w, this.h);
            ctx.globalCompositeOperation = 'lighter';
            for (let i = this.sparks.length - 1; i >= 0; i--) {
                const s = this.sparks[i];
                s.life++;
                s.vx *= 0.955; s.vy = s.vy * 0.955 + 0.035;
                s.x += s.vx; s.y += s.vy;
                const k = 1 - s.life / s.max;
                if (k <= 0) { this.sparks.splice(i, 1); continue; }
                const tw = 0.6 + 0.4 * Math.sin(s.tw + s.life * 0.3);
                const rad = s.r * 4;
                const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad);
                g.addColorStop(0, `rgba(255,248,225,${0.95 * k * tw})`);
                g.addColorStop(0.35, `rgba(246,214,140,${0.6 * k * tw})`);
                g.addColorStop(1, 'rgba(240,190,120,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';
        }
    };

    /* ---------- Lluvia de pétalos de rosa ----------
       - Canvas fijo (no depende del scroll) recortado al ancho de la
         invitación (.main-center): los pétalos nunca caen por fuera.
       - Fase 1 (~7 s): lluvia abundante al abrir la invitación.
       - Fase 2: pocos pétalos, cayendo de forma continua y suave.
       - Usa los pétalos reales de petalos.png (hoja de 15 recortes). */
    const Petals = {
        el: null, ctx: null, img: null, ready: false,
        w: 0, h: 0, dpr: 1, list: [], raf: 0, start: 0, lastSpawn: 0,
        CELL: 96, COUNT: 15,

        fit() {
            const box = document.querySelector('.main-center');
            const r = box ? box.getBoundingClientRect() : { left: 0, width: window.innerWidth };
            const left = Math.max(0, Math.round(r.left));
            const width = Math.min(Math.round(r.width), window.innerWidth - left);
            this.dpr = Math.min(window.devicePixelRatio || 1, 2);
            const oldW = this.w;
            this.w = width; this.h = window.innerHeight;
            this.el.style.left = left + 'px';
            this.el.style.width = width + 'px';
            this.el.style.height = this.h + 'px';
            this.el.width = width * this.dpr;
            this.el.height = this.h * this.dpr;
            this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            if (oldW && oldW !== width) this.list.forEach(p => { p.x = p.x / oldW * width; });
        },

        run() {
            this.el = document.getElementById('petalCanvas');
            if (!this.el || !this.el.getContext) return;
            this.ctx = this.el.getContext('2d');
            this.img = new Image();
            this.img.onload = () => { this.ready = true; };
            this.img.src = 'petalos.png';
            this.fit();
            window.addEventListener('resize', () => this.fit());
            this.el.classList.add('is-active');

            const small = this.w < 768;
            this.start = performance.now();
            this.lastSpawn = this.start;
            // Primera tanda ya repartida por la parte de arriba
            for (let i = 0; i < (small ? 12 : 18); i++) this.add(true);

            document.addEventListener('visibilitychange', () => {
                if (document.hidden) cancelAnimationFrame(this.raf);
                else { this.lastSpawn = performance.now(); this.loop(); }
            });
            this.loop();
        },

        loop() {
            cancelAnimationFrame(this.raf);
            let prev = performance.now();
            const tick = (t) => {
                const dt = Math.min(3, (t - prev) / 16.67); // normaliza a 60 fps
                prev = t;
                this.frame(t, dt);
                this.raf = requestAnimationFrame(tick);
            };
            this.raf = requestAnimationFrame(tick);
        },

        add(spread) {
            const small = this.w < 768;
            const size = (small ? 20 : 24) + Math.random() * (small ? 16 : 20);
            this.list.push({
                x: Math.random() * this.w,
                y: spread ? -20 - Math.random() * this.h * 0.6 : -40,
                s: size,
                k: (Math.random() * this.COUNT) | 0,
                vy: 0.7 + Math.random() * 0.9,
                sway: 0.4 + Math.random() * 1.1,
                phase: Math.random() * Math.PI * 2,
                rot: Math.random() * Math.PI * 2,
                vr: (Math.random() - 0.5) * 0.035,
                flip: Math.random() * Math.PI * 2,
                vf: 0.02 + Math.random() * 0.04,
                alpha: 0.85 + Math.random() * 0.15
            });
        },

        draw(p) {
            const ctx = this.ctx;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.scale(1, Math.max(0.25, Math.abs(Math.cos(p.flip)))); // giro en 3D
            ctx.globalAlpha = p.alpha;
            if (this.ready) {
                ctx.drawImage(this.img, p.k * this.CELL, 0, this.CELL, this.CELL, -p.s / 2, -p.s / 2, p.s, p.s);
            } else {
                const r = p.s * 0.4;
                ctx.fillStyle = '#F2A7BE';
                ctx.beginPath();
                ctx.moveTo(0, r);
                ctx.bezierCurveTo(r * 0.95, r * 0.35, r * 0.7, -r * 0.9, 0, -r * 0.55);
                ctx.bezierCurveTo(-r * 0.7, -r * 0.9, -r * 0.95, r * 0.35, 0, r);
                ctx.fill();
            }
            ctx.restore();
        },

        frame(t, dt) {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.w, this.h);
            const small = this.w < 768;
            const burst = t - this.start < 7000;
            // Fase 1: muchos pétalos. Fase 2: pocos pero continuos.
            const every = burst ? (small ? 200 : 130) : (small ? 1500 : 1100);
            const maxOnScreen = burst ? 80 : (small ? 7 : 11);
            if (t - this.lastSpawn > every && this.list.length < maxOnScreen) {
                this.add(false);
                this.lastSpawn = t;
            }
            for (let i = this.list.length - 1; i >= 0; i--) {
                const p = this.list[i];
                p.phase += 0.018 * dt;
                p.y += p.vy * dt;
                p.x += Math.sin(p.phase) * p.sway * dt;
                p.rot += p.vr * dt;
                p.flip += p.vf * dt;
                if (p.y > this.h + 50) { this.list.splice(i, 1); continue; }
                this.draw(p);
            }
        }
    };

    window.XVIntro = { start: onTap, finish, canPlay };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
