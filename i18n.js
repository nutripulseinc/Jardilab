/* Jardilab : choix de la langue (fr / de / it). Le français est la langue d'origine du site ;
   en allemand et en italien, les textes sont traduits à l'affichage grâce à i18n-de.js / i18n-it.js. */
(function () {
  var L = '';
  try { L = localStorage.getItem('vdl') || ''; } catch (e) {}
  if (!/^(fr|de|it)$/.test(L)) { var n = (navigator.language || 'fr').slice(0, 2); L = /^(de|it)$/.test(n) ? n : 'fr'; }
  window.LANG = L;
  window.LOC = { fr: 'fr-FR', de: 'de-CH', it: 'it-CH' }[L];
  document.documentElement.lang = L; document.documentElement.setAttribute('translate', 'no');
  window.setLang = function (l) { try { localStorage.setItem('vdl', l); } catch (e) {} location.reload(); };
  if (L === 'fr') return;

  // démarrage appelé par le dictionnaire une fois chargé
  window.__i18nStart = function (D0, P0) {
    var PRE = /^[\s‍️←-⇿☀-➿＋•·▸›‹:+\u{1F000}-\u{1FAFF}]+/u,
        SUF = /[\s‍️←-⇿☀-➿\u{1F000}-\u{1FAFF}]+$/u,
        norm = function (s) { return s.replace(/\s+/g, ' ').trim(); },
        D = {}, P = [];
    Object.keys(D0).forEach(function (k) { D[norm(k.replace(PRE, '').replace(SUF, ''))] = D0[k]; });
    P0.forEach(function (p) {
      var re = p[0].replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\d)\}/g, '(.+?)');
      P.push([new RegExp('^' + re + '$'), p[1]]);
    });
    function T(v) {
      var pre = (v.match(PRE) || [''])[0], rest = v.slice(pre.length), suf = (rest.match(SUF) || [''])[0],
          core = norm(rest.slice(0, rest.length - suf.length));
      if (!core) return v;
      var r = D[core];
      if (r === undefined) {
        for (var i = 0; i < P.length; i++) {
          var m = core.match(P[i][0]);
          if (m) { r = P[i][1].replace(/\{(\d)\}/g, function (_, j) { return T(m[+j + 1]); }); break; }
        }
      }
      return r === undefined ? v : pre + r + suf;
    }
    function tr2(s) { var r = T(s); return r; }
    window.__T = T;
    var seen = new WeakMap(), AT = ['placeholder', 'title', 'aria-label', 'alt'];
    // texte français libre (conseils IA, descriptions) : traduit à la demande via window.__tqFetch, avec cache local
    var FRW = /(?:^|[^a-zà-ÿ])(les|des|du|est|pour|avec|dans|une|aux|au|ou|où|qui|que|pas|sur|très|vos|votre|vous|cette|ses|leur|chaque|toutes|tous|sans|sont|peut|après|avant|entre|plus|être|mais|donc|aussi)(?=[^a-zà-ÿ]|$)/gi,
        DC = {}, DK = 'vdtx_' + L, pend = {}, fail = {}, tim = 0;
    try { DC = JSON.parse(localStorage.getItem(DK) || '{}'); } catch (e) {}
    function isFr(s) { var m = s.match(FRW); if (!m) return false; var u = {}; m.forEach(function (x) { u[x.toLowerCase()] = 1; }); return Object.keys(u).length >= 2; }
    function dyn(v) {
      var core = norm(v); if (core.length < 40 || !isFr(core)) return v;
      if (DC[core]) return v.slice(0, v.length - v.replace(/^\s+/, '').length) + DC[core] + v.slice(v.replace(/\s+$/, '').length);
      if (!fail[core] && window.__tqFetch) { pend[core] = 1; if (!tim) tim = setTimeout(go, 1200); }
      return v;
    }
    function go() {
      tim = 0; var ks = Object.keys(pend).slice(0, 20); if (!ks.length) return;
      ks.forEach(function (k) { delete pend[k]; });
      window.__tqFetch(ks).then(function (a) {
        if (!a || a.length !== ks.length) throw 0;
        ks.forEach(function (k, i) { if (typeof a[i] === 'string' && a[i]) DC[k] = a[i]; else fail[k] = 1; });
        try { localStorage.setItem(DK, JSON.stringify(DC)); } catch (e) {}
        seen = new WeakMap(); node(document.body);
      }).catch(function () { ks.forEach(function (k) { fail[k] = 1; }); });
      if (Object.keys(pend).length) tim = setTimeout(go, 1500);
    }
    function node(n) {
      if (n.nodeType === 3) {
        var p = n.parentNode;
        if (!p || /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/.test(p.nodeName) || (p.closest && p.closest('[data-nt]'))) return;
        var v = n.nodeValue; if (seen.get(n) === v) return;
        var r = T(v);
        if (r === v) r = dyn(v);
        if (r !== v) {
          if (p.nodeName === 'OPTION' && !p.hasAttribute('value')) p.setAttribute('value', norm(v));
          n.nodeValue = r;
        }
        seen.set(n, n.nodeValue);
      } else if (n.nodeType === 1) {
        if (/^(SCRIPT|STYLE)$/.test(n.nodeName) || n.hasAttribute('data-nt')) return;
        for (var i = 0; i < AT.length; i++) {
          var a = n.getAttribute(AT[i]);
          if (a && seen.get(n) !== 'a' + AT[i] + a) { var t = T(a); if (t !== a) n.setAttribute(AT[i], t); }
        }
        for (var c = n.firstChild; c; c = c.nextSibling) node(c);
      }
    }
    var q = new Set(), raf = 0;
    function flush() { raf = 0; q.forEach(function (n) { if (n.isConnected !== false) node(n); }); q.clear(); }
    function head() {
      document.title = T(document.title);
      document.querySelectorAll('meta[name=description],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]').forEach(function (m) { var c = m.getAttribute('content'); if (c) m.setAttribute('content', T(c)); });
    }
    var mo = new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        if (m.type === 'characterData') q.add(m.target);
        else if (m.type === 'attributes') q.add(m.target);
        else m.addedNodes.forEach(function (n) { q.add(n); });
      });
      if (!raf) raf = requestAnimationFrame(flush);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: AT });
    function all() { node(document.body); head(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', all); else all();
    var al = window.alert; window.alert = function (m) { al.call(window, T(String(m))); };
  };
  document.write('<script src="/i18n-' + L + '.js"><\/script>');
})();
