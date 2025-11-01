/* nav update: 2025-10-27 – GlassNav v2.1
   - Injects styles (no separate CSS file needed)
   - Active state + curved underline sizing
   - Rim glow + glass blur
*/
(function () {
  // 1) Inject CSS once
  function injectStyles() {
    if (document.getElementById('glassnav-styles')) return;
    const css = `
/* === GlassNav v2.1 (injected) ============================== */
.glassnav{
  position:sticky; top:0; z-index:80;
  margin:20px;                     /* inset from page edges */
  border-radius:18px;
  background: rgba(12,20,36,.55);  /* liquid glass */
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  border:1px solid rgba(255,255,255,.12);
  /* rim glow + lift */
  box-shadow:
    0 0 20px rgba(95,245,248,.25),
    0 0 40px rgba(122,162,255,.15),
    inset 0 0 10px rgba(255,255,255,.05),
    0 10px 30px rgba(90,160,255,.15);
}
.nav-inner{
  height:64px;
  display:flex; align-items:center; justify-content:space-between;
  padding:0 28px;
}
.nav-logo img{
  height:44px; width:auto; display:block;
  filter: drop-shadow(0 0 6px rgba(122,162,255,.35));
}

.nav-toggle{
  display:none;
  margin-left:auto;
  padding:10px;
  border:1px solid rgba(255,255,255,.18);
  border-radius:12px;
  background:rgba(12,20,36,.65);
  color:#E9EEFB;
  align-items:center;
  justify-content:center;
  min-width:44px;
  height:44px;
  line-height:0;
  cursor:pointer;
  transition:background .2s ease, border-color .2s ease, color .2s ease;
}
.nav-toggle:hover,
.nav-toggle:focus-visible{
  background:rgba(26,44,72,.75);
  border-color:rgba(122,162,255,.45);
  color:#7AA2FF;
  outline:none;
}
.nav-toggle .icon-burger{
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:5px;
}
.nav-toggle .icon-burger span{
  display:block;
  width:24px; height:2px;
  border-radius:2px;
  background:currentColor;
  transition:transform .2s ease, opacity .2s ease;
}
.nav-toggle .icon-close{
  display:none;
  font-size:24px;
  line-height:1;
  font-weight:600;
}
.glassnav.is-open .nav-toggle .icon-burger{ display:none; }
.glassnav.is-open .nav-toggle .icon-close{ display:block; }
.glassnav.is-open .nav-toggle{
  background:rgba(26,44,72,.8);
  border-color:rgba(122,162,255,.45);
  color:#7AA2FF;
}

.nav-list{
  display:flex; gap:36px; margin:0; padding:0; list-style:none;
}
.nav-link{
  position:relative;
  display:inline-flex; align-items:center; justify-content:center;
  color:#E9EEFB; text-decoration:none;
  font-weight:550; font-size:16px; line-height:1;
  transition: color .18s ease, text-shadow .18s ease, font-size .18s ease;
}
.nav-link:hover,
.nav-link:focus-visible{
  color:#7AA2FF;
  text-shadow:0 0 6px rgba(122,162,255,.5);
  outline:none;
}
.nav-link .label{ position:relative; z-index:1; }

/* Curved underline */
.nav-link .underline{
  position:absolute; left:50%; bottom:-8px; transform:translateX(-50%);
  width:100%; height:14px; overflow:visible;
  opacity:0; transition:opacity .18s ease, filter .18s ease;
}
.nav-link .underline path{
  fill:none; stroke-linecap:round; stroke-width:2;
  stroke:url(#grad-default);
}
.nav-link:hover .underline,
.nav-link:focus-visible .underline{ opacity:.55; }

/* Active page: larger text + brighter underline */
.nav-link.is-active{
  font-size:17.5px;               /* ~ +10% */
  color:#7AA2FF;
  text-shadow:0 0 10px rgba(122,162,255,.65);
}
.nav-link.is-active .underline{ opacity:1; filter: drop-shadow(0 0 6px rgba(122,162,255,.55)); }
.nav-link.is-active .underline path{ stroke:url(#grad-active); }

/* Reduce motion */
@media (prefers-reduced-motion: reduce){
  .nav-link, .nav-link .underline{ transition:none !important; }
}
@media (max-width: 900px){
  .glassnav{ margin:12px; }
  .nav-inner{
    height:auto;
    flex-wrap:wrap;
    row-gap:12px;
    padding:12px 18px 18px;
  }
  .nav-toggle{ display:inline-flex; }
  .nav-list{
    display:none;
    flex-direction:column;
    gap:18px;
    width:100%;
    padding-top:4px;
    border-top:1px solid rgba(255,255,255,.12);
  }
  .glassnav.is-open .nav-list{ display:flex; }
  .nav-list li{ width:100%; }
  .nav-link{
    justify-content:flex-start;
    width:100%;
  }
}
/* ============================================================ */
    `.trim();
    const style = document.createElement('style');
    style.id = 'glassnav-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // 2) Ensure gradient defs exist once (for the curved underline stroke)
  function ensureGradients() {
    if (document.getElementById('glassnav-gradients')) return;
    const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    sprite.setAttribute('width', '0');
    sprite.setAttribute('height', '0');
    sprite.setAttribute('aria-hidden', 'true');
    sprite.setAttribute('focusable', 'false');
    sprite.id = 'glassnav-gradients';
    sprite.style.position = 'absolute';
    sprite.innerHTML = `
      <defs>
        <linearGradient id="grad-default" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#5FF5F8"/>
          <stop offset="100%" stop-color="#7AA2FF"/>
        </linearGradient>
        <linearGradient id="grad-active" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#7AA2FF"/>
          <stop offset="100%" stop-color="#5FF5F8"/>
        </linearGradient>
      </defs>
    `;
    document.body.appendChild(sprite);
  }

  // 3) Active state + underline sizing
  function setupNavLogic() {
    const nav = document.querySelector('.glassnav');
    if (!nav) return;

    const links = Array.from(nav.querySelectorAll('.nav-link'));
    if (!links.length) return;

    const toggle = nav.querySelector('.nav-toggle');
    const navList = nav.querySelector('.nav-list');

    function setNavOpen(open) {
      if (!toggle || !navList) return;
      const canMatch = typeof window.matchMedia === 'function';
      const isMobile = canMatch ? window.matchMedia('(max-width: 900px)').matches : false;
      if (!isMobile) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open navigation menu');
        navList.removeAttribute('aria-hidden');
        return;
      }

      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
      navList.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    if (toggle && navList) {
      setNavOpen(false);
      toggle.addEventListener('click', () => {
        const open = !nav.classList.contains('is-open');
        setNavOpen(open);
      });

      if (typeof window.matchMedia === 'function') {
        const mq = window.matchMedia('(min-width: 901px)');
        const mqHandler = () => { setNavOpen(false); };
        if (typeof mq.addEventListener === 'function') {
          mq.addEventListener('change', mqHandler);
        } else if (typeof mq.addListener === 'function') {
          mq.addListener(mqHandler);
        }
      }

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && nav.classList.contains('is-open')) {
          setNavOpen(false);
          toggle.focus();
        }
      });
    }

    // Set active from URL if server didn't add .is-active
    function setActiveFromURL() {
      const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
      let matched = false;

      for (const a of links) {
        const href = (a.getAttribute('href') || '').toLowerCase().replace(/^\.\//, '');
        const isMatch =
          href === path ||
          (path === '' && href.includes('index.html')) ||
          (path === 'index.html' && href.includes('index.html'));

        a.classList.toggle('is-active', isMatch);
        if (isMatch) {
          a.setAttribute('aria-current', 'page');
          matched = true;
        } else {
          a.removeAttribute('aria-current');
        }
      }
      if (!matched) {
        const home = nav.querySelector('.nav-link[data-page="home"]');
        if (home) {
          home.classList.add('is-active');
          home.setAttribute('aria-current', 'page');
        }
      }
    }

    // Size each underline to label width (keeps the nice curved line)
    function sizeUnderlines() {
      for (const a of links) {
        const label = a.querySelector('.label');
        const svg = a.querySelector('.underline');
        const path = svg ? svg.querySelector('path') : null;
        if (!label || !svg || !path) continue;

        const w = Math.ceil(label.getBoundingClientRect().width) + 12; // 6px padding each side
        svg.setAttribute('width', w);
        svg.setAttribute('viewBox', `0 0 ${w} 14`);

        const mid = Math.round(w / 2);
        const right = w - 6;
        // Shallow arc: starts at y=10, peaks at y=2 mid, ends at y=10 (ends curve up)
        path.setAttribute('d', `M6,10 Q${mid},2 ${right},10`);
      }
    }

    // Public hook if other scripts update nav text dynamically
    window.BASE_GlassNav = {
      refresh() { setActiveFromURL(); sizeUnderlines(); }
    };

    setActiveFromURL();
    sizeUnderlines();

    window.addEventListener('resize', sizeUnderlines);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(sizeUnderlines).catch(()=>{});
    }

    // If labels change via DOM mutations, keep underline in sync
    const mo = new MutationObserver(sizeUnderlines);
    mo.observe(nav, { subtree:true, childList:true, characterData:true });

    if (toggle && links.length) {
      for (const link of links) {
        link.addEventListener('click', () => {
          if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 900px)').matches) {
            setNavOpen(false);
          }
        });
      }
    }
  }

  // Boot
  injectStyles();
  // Wait for body to exist to append gradients safely
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureGradients();
      setupNavLogic();
    });
  } else {
    ensureGradients();
    setupNavLogic();
  }
})();