(function () {
  if (window.__shopcopyInjected) return;
  window.__shopcopyInjected = true;

  var TITLE_JUNK = /^(shopify|products?|home|admin|loading|untitled|new product|create product|search|dashboard|settings|online store)$/i;
  var SHOP_NAME_DEFAULTS = /^(マイストア|my store|development store|dev store|test store|your store)$/i;
  var WAIT_TITLE = "Loading product title…";

  function isTop() {
    try {
      return window === window.top;
    } catch (e) {
      return false;
    }
  }

  function inOverlay(el) {
    return !!(el && el.closest && el.closest("#shopcopy-root, #shopcopy-toggle"));
  }

  function visible(el) {
    if (!el || inOverlay(el)) return false;
    try {
      var r = el.getBoundingClientRect();
      if (r.width < 2 && r.height < 2) return false;
      var st = el.ownerDocument && el.ownerDocument.defaultView
        ? el.ownerDocument.defaultView.getComputedStyle(el)
        : null;
      if (st && (st.visibility === "hidden" || st.display === "none")) return false;
    } catch (e) {}
    return true;
  }

  function qsa(sel, root) {
    try {
      return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    } catch (e) {
      return [];
    }
  }

  function walkOpenShadows(root, visit, depth) {
    depth = depth || 0;
    if (!root || depth > 14) return;
    try {
      visit(root);
    } catch (e) {}
    var nodes;
    try {
      nodes = root.querySelectorAll("*");
    } catch (e2) {
      return;
    }
    for (var i = 0; i < nodes.length; i++) {
      try {
        if (nodes[i].shadowRoot) walkOpenShadows(nodes[i].shadowRoot, visit, depth + 1);
      } catch (e3) {}
    }
  }

  function qsaDeep(sel, root) {
    var out = [];
    walkOpenShadows(root || document, function (r) {
      var nodes;
      try {
        nodes = r.querySelectorAll(sel);
      } catch (e) {
        return;
      }
      for (var i = 0; i < nodes.length; i++) {
        if (out.indexOf(nodes[i]) === -1) out.push(nodes[i]);
      }
    }, 0);
    return out;
  }

  function shadowInputOf(el) {
    if (!el) return null;
    try {
      var sr = el.shadowRoot;
      if (sr) {
        var inp = sr.querySelector("input, textarea");
        if (inp) return inp;
        var kids = sr.querySelectorAll("*");
        for (var i = 0; i < kids.length; i++) {
          var nested = shadowInputOf(kids[i]);
          if (nested) return nested;
        }
      }
    } catch (e) {}
    return null;
  }

  function isPolarisTitleHost(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toLowerCase();
    var name = (el.getAttribute && (el.getAttribute("name") || "")) || "";
    var lab = (el.getAttribute && (el.getAttribute("label") || "")) || "";
    var ph = (el.getAttribute && (el.getAttribute("placeholder") || "")) || "";
    if (tag === "s-internal-text-field" || tag === "s-text-field") {
      if (name === "title" || lab === "タイトル" || ph === "半袖Tシャツ") return true;
      if (/^title$/i.test(name) || /^(タイトル|商品名|title)$/i.test(lab)) return true;
    }
    if (lab === "タイトル" && tag.indexOf("s-") === 0) return true;
    if (ph === "半袖Tシャツ") return true;
    return false;
  }

  function collectDocs(rootDoc, out, depth) {
    out = out || [];
    depth = depth || 0;
    if (!rootDoc || depth > 8) return out;
    out.push(rootDoc);
    var frames = [];
    try {
      frames = qsa("iframe", rootDoc);
    } catch (e) {
      return out;
    }
    for (var i = 0; i < frames.length; i++) {
      try {
        var d = frames[i].contentDocument;
        if (d && out.indexOf(d) === -1) collectDocs(d, out, depth + 1);
      } catch (e) {}
    }
    return out;
  }

  function allDocs() {
    return collectDocs(document, [], 0);
  }

  function textOf(el) {
    if (!el) return "";
    return String(el.innerText || el.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function inputValue(el) {
    if (!el) return "";
    var v = "";
    try {
      if (typeof el.value === "string") v = el.value;
    } catch (e) {}
    if (!v) {
      var sh = shadowInputOf(el);
      if (sh) {
        try {
          if (typeof sh.value === "string") v = sh.value;
        } catch (e2) {}
      }
    }
    if (!v && el.getAttribute) v = el.getAttribute("value") || "";
    if (!v && el.isContentEditable) v = textOf(el);
    if (!v && el.getAttribute && el.getAttribute("contenteditable") === "true") v = textOf(el);
    return String(v).trim();
  }

  function pageHref() {
    try {
      return String((window.top && window.top.location && window.top.location.href) || location.href || "");
    } catch (e) {
      return String(location.href || "");
    }
  }

  function onProductEditPage() {
    return /\/products\/[^/?#]+/i.test(pageHref());
  }

  function productIdFromUrl() {
    var m = pageHref().match(/\/products\/(\d+)/i);
    return m ? m[1] : "";
  }

  function inPageChrome(el) {
    if (!el || !el.closest) return true;
    return !!el.closest(
      [
        "nav",
        "header",
        "aside",
        "[role='navigation']",
        "[role='banner']",
        "[role='menubar']",
        "[role='menu']",
        "[role='dialog']",
        "[role='complementary']",
        "#AppFrameNav",
        "#AppFrameTopBar",
        "#AppFrameMainNav",
        "[data-save-bar]",
        "[class*='Nav_']",
        "[class*='TopBar']",
        "[class*='Navigation']",
        "[class*='StoreSwitcher']",
        "[class*='shop-switcher']",
        "[data-testid*='store-switcher' i]",
        "[data-testid*='top-bar' i]",
        "[data-testid*='nav' i]",
        "[aria-label*='store' i]",
        "[aria-label*='stores' i]"
      ].join(",")
    );
  }

  function inProductMain(el) {
    if (!el || !el.closest) return false;
    if (inPageChrome(el)) return false;
    if (el.closest("main, [role='main'], #AppFrameMain, [class*='Polaris-Page'], [class*='Polaris-Layout__Section']:not([class*='secondary'])")) {
      return true;
    }
    try {
      var r = el.getBoundingClientRect();
      if (r.width >= 280 && r.left > 140) return true;
    } catch (e) {}
    return false;
  }

  function nearbyLabelText(el) {
    if (!el) return "";
    var blob = "";
    var lab, id, i;
    try {
      id = el.id;
      if (id && el.ownerDocument) {
        var esc = (window.CSS && CSS.escape) ? CSS.escape(id) : id.replace(/"/g, '\"');
        lab = el.ownerDocument.querySelector('label[for="' + esc + '"]');
        if (lab) blob += " " + textOf(lab);
      }
    } catch (e) {}
    blob += " " + (el.getAttribute("aria-label") || "");
    var ids = (el.getAttribute("aria-labelledby") || "").split(/\s+/);
    for (i = 0; i < ids.length; i++) {
      if (!ids[i] || !el.ownerDocument) continue;
      var ref = el.ownerDocument.getElementById(ids[i]);
      if (ref) blob += " " + textOf(ref);
    }
    var wrap = el.parentElement;
    for (i = 0; i < 4 && wrap; i++) {
      var labels = qsa("label", wrap);
      for (var j = 0; j < labels.length; j++) blob += " " + textOf(labels[j]);
      wrap = wrap.parentElement;
    }
    return blob.replace(/\s+/g, " ").trim();
  }

  function collectShopNames(docs) {
    var names = {};
    function add(v) {
      v = String(v || "").replace(/\s+/g, " ").trim();
      if (!v || v.length < 2 || v.length > 80) return;
      if (/shopify/i.test(v)) return;
      names[v] = true;
      names[v.toLowerCase()] = true;
    }
    var href = pageHref();
    var store = href.match(/\/store\/([^/?#]+)/i);
    if (store) {
      add(store[1]);
      add(store[1].replace(/-/g, " "));
    }
    var dt = "";
    try {
      dt = (window.top && window.top.document && window.top.document.title) || document.title || "";
    } catch (e) {
      dt = document.title || "";
    }
    var parts = String(dt).split(/\s*[·|—–]\s*/);
    for (var p = 0; p < parts.length; p++) {
      var part = parts[p].trim();
      if (!part || /shopify/i.test(part)) continue;
      if (p === parts.length - 1 || (p > 0 && !/\/products\//.test(href))) add(part);
      if (SHOP_NAME_DEFAULTS.test(part)) add(part);
    }
    var i, j, nodes, t;
    for (i = 0; i < docs.length; i++) {
      nodes = qsa(
        "[data-testid*='store' i], [data-testid*='shop' i], [aria-label*='store' i], [class*='StoreSwitcher'], [class*='shop-switcher']",
        docs[i]
      );
      for (j = 0; j < nodes.length; j++) {
        if (inOverlay(nodes[j])) continue;
        t = textOf(nodes[j]);
        if (t && t.length < 80) add(t.split(/\s*[·|]/)[0]);
      }
      nodes = qsa("nav button, header button, [role='navigation'] button, [role='banner'] button", docs[i]);
      for (j = 0; j < Math.min(nodes.length, 12); j++) {
        t = textOf(nodes[j]);
        if (t && t.length >= 2 && t.length <= 40 && !/home|products|orders|settings|search/i.test(t)) add(t);
      }
    }
    return names;
  }

  function isShopName(v, shopNames) {
    if (!v) return false;
    var s = String(v).replace(/\s+/g, " ").trim();
    if (SHOP_NAME_DEFAULTS.test(s)) return true;
    if (shopNames[s] || shopNames[s.toLowerCase()]) return true;
    return false;
  }

  function looksLikeTitle(v) {
    if (!v) return "";
    v = String(v).replace(/\s+/g, " ").trim();
    if (v.length < 2 || v.length > 255) return "";
    if (TITLE_JUNK.test(v)) return "";
    if (/^https?:\/\//i.test(v)) return "";
    return v;
  }

  function labeledControls(doc, re) {
    var found = [];
    var labels = qsaDeep("label", doc);
    var i, j, lab, t, id, el, wrap, inputs;
    for (i = 0; i < labels.length; i++) {
      lab = labels[i];
      if (inOverlay(lab)) continue;
      t = textOf(lab);
      if (!re.test(t)) continue;
      id = lab.getAttribute("for");
      if (id) {
        try {
          el = doc.getElementById(id);
        } catch (e) {
          el = null;
        }
        if (el) found.push(el);
      }
      wrap = lab.parentElement;
      for (j = 0; j < 5 && wrap; j++) {
        inputs = qsaDeep("input, textarea, [contenteditable='true'], [role='textbox'], s-internal-text-field, s-text-field", wrap);
        for (var k = 0; k < inputs.length; k++) {
          if (!inOverlay(inputs[k])) found.push(inputs[k]);
        }
        wrap = wrap.parentElement;
      }
    }
    var labelled = qsaDeep("[aria-labelledby]", doc);
    for (i = 0; i < labelled.length; i++) {
      var ids = (labelled[i].getAttribute("aria-labelledby") || "").split(/\s+/);
      var blob = "";
      for (j = 0; j < ids.length; j++) {
        if (!ids[j]) continue;
        var ref = doc.getElementById(ids[j]);
        if (ref) blob += " " + textOf(ref);
      }
      if (re.test(blob.trim())) found.push(labelled[i]);
    }
    return found;
  }

  function scoreTitleInput(el, shopNames) {
    if (!el || inOverlay(el)) return -999;
    var tag = (el.tagName || "").toLowerCase();
    var polarisHost = isPolarisTitleHost(el);
    if (
      tag !== "input" &&
      tag !== "textarea" &&
      !el.isContentEditable &&
      el.getAttribute("role") !== "textbox" &&
      !polarisHost
    ) {
      return -999;
    }
    if (tag === "input") {
      var typ = (el.getAttribute("type") || "text").toLowerCase();
      if (typ && typ !== "text" && typ !== "search") return -999;
    }
    var val = looksLikeTitle(inputValue(el));
    var emptyOk = !inputValue(el);
    if (!val && !emptyOk) return -999;
    if (val && isShopName(val, shopNames)) return -800;
    if (inPageChrome(el)) return -700;

    var score = 0;
    var name = (el.getAttribute("name") || "").toLowerCase();
    var id = (el.getAttribute("id") || "").toLowerCase();
    var aria = (el.getAttribute("aria-label") || "").toLowerCase();
    var ph = (el.getAttribute("placeholder") || "");
    var hostLabel = el.getAttribute("label") || "";
    var lab = (nearbyLabelText(el) + " " + hostLabel).trim();
    var labExactTitle = /^(title|product title|product name|タイトル|商品名)$/i.test(lab) || /(^|\s)title$/i.test(lab.split("\n")[0] || lab);
    var shInp = shadowInputOf(el);
    if (shInp) {
      ph = ph || (shInp.getAttribute("placeholder") || "");
      name = name || (shInp.getAttribute("name") || "").toLowerCase();
    }

    if (polarisHost) score += 90;
    if (tag === "s-internal-text-field" && (name === "title" || hostLabel === "タイトル")) score += 80;
    if (hostLabel === "タイトル") score += 70;
    if (ph.indexOf("半袖Tシャツ") !== -1) score += 80;
    if (/product\[title\]|producttitle/.test(name) || id === "product-title") score += 80;
    if (name === "title") score += 25;
    if (el.hasAttribute("data-1p-ignore") || el.getAttribute("data-lpignore") === "true") score += 35;
    if (/^title$|^product title$|^product name$/i.test(aria) || /product title|product name/i.test(aria)) score += 40;
    if (/^title$/i.test(lab.trim()) || /^title$/i.test(textOf(el.labels && el.labels[0]))) score += 55;
    if (/^(title|product title|product name)$/i.test(lab.trim())) score += 20;
    if (labExactTitle) score += 15;
    if (/seo|search engine|page title|browser/i.test(lab + " " + aria + " " + name)) score -= 120;
    if (/store|shop name|store name/i.test(lab + " " + aria + " " + name + " " + id)) score -= 200;
    if (ph.indexOf("Short sleeve t-shirt") !== -1) score += 50;
    if (/title|product name/i.test(ph) && !/seo/i.test(ph)) score += 10;
    if (inProductMain(el)) score += 45;
    if (el.closest && el.closest("form")) {
      var form = el.closest("form");
      var formHtml = "";
      try {
        formHtml = (form.getAttribute("action") || "") + " " + (form.getAttribute("id") || "") + " " + (form.getAttribute("data-resource") || "");
      } catch (e2) {}
      if (/product/i.test(formHtml)) score += 40;
      if (form.querySelector && (form.querySelector('[name="body_html"], [name="product[body_html]"], textarea[aria-label*="description" i], [name="handle"]'))) {
        score += 50;
      }
    }
    try {
      var r = el.getBoundingClientRect();
      if (r.width >= 320) score += 20;
      if (r.width >= 480) score += 10;
      if (r.height >= 28 && r.height <= 64 && r.width >= 240) score += 8;
    } catch (e3) {}
    if (el.closest && el.closest("[class*='Polaris-Card'], [class*='Polaris-ShadowBevel'], [class*='Polaris-Box']")) score += 8;
    if (!onProductEditPage()) score -= 20;
    return score;
  }

  function gatherTitleInputs(doc) {
    var set = [];
    function add(el) {
      if (!el || set.indexOf(el) !== -1) return;
      set.push(el);
    }
    var sels = [
      's-internal-text-field[name="title"]',
      's-internal-text-field[label="タイトル"]',
      's-internal-text-field[placeholder="半袖Tシャツ"]',
      's-text-field[name="title"]',
      's-text-field[label="タイトル"]',
      '[label="タイトル"]',
      '[placeholder="半袖Tシャツ"]',
      'main input[name="title"]',
      'main textarea[name="title"]',
      '[role="main"] input[name="title"]',
      'form input[name="title"]',
      'input[name="product[title]"]',
      'input[id="product-title"]',
      'input[name="productTitle"]',
      'input[data-1p-ignore][name="title"]',
      'input[data-1p-ignore]',
      'input[aria-label="Title"]',
      'input[aria-label="Product title"]',
      'input[aria-label="Product name"]',
      'input[aria-label*="Product title" i]',
      'input[placeholder="Short sleeve t-shirt"]',
      'input[placeholder="半袖Tシャツ"]',
      '[data-testid="product-title"] input',
      '[data-testid*="product-title" i] input',
      'input[name="title"]',
      'textarea[name="title"]',
      '[name="title"]'
    ];
    var i, j, nodes;
    for (i = 0; i < sels.length; i++) {
      nodes = qsaDeep(sels[i], doc);
      for (j = 0; j < nodes.length; j++) add(nodes[j]);
    }
    var labeled = labeledControls(doc, /^(title|product title|product name|タイトル|商品名)$/i);
    for (i = 0; i < labeled.length; i++) add(labeled[i]);
    return set;
  }

  function readTitleFromDoc(doc, shopNames) {
    var nodes = gatherTitleInputs(doc);
    var bestEl = null;
    var bestScore = 40;
    var i, s, v;
    for (i = 0; i < nodes.length; i++) {
      s = scoreTitleInput(nodes[i], shopNames);
      v = inputValue(nodes[i]);
      if (v && isShopName(v, shopNames)) continue;
      if (s > bestScore) {
        bestScore = s;
        bestEl = nodes[i];
      }
    }
    if (!bestEl) return { found: false, title: "" };
    return { found: true, title: looksLikeTitle(inputValue(bestEl)) };
  }

  function readTitleFromJson(doc, shopNames) {
    var blobs = [];
    var scripts = qsa("script", doc);
    var i;
    for (i = 0; i < scripts.length; i++) {
      var type = (scripts[i].type || "").toLowerCase();
      var txt = scripts[i].textContent || "";
      if (!txt || txt.length < 20 || txt.length > 2e6) continue;
      if (
        type.indexOf("json") !== -1 ||
        /product/i.test(txt.slice(0, 400)) ||
        /"title"\s*:/.test(txt)
      ) {
        blobs.push(txt);
      }
    }

    function walk(obj, depth, acc) {
      if (!obj || depth > 12) return;
      if (Array.isArray(obj)) {
        for (var a = 0; a < obj.length && a < 80; a++) walk(obj[a], depth + 1, acc);
        return;
      }
      if (typeof obj !== "object") return;
      var gid = String(obj.gid || obj.id || obj.__typename || "");
      var typeName = String(obj.__typename || "");
      if (/Shop|ShopPolicy|OnlineStore/i.test(typeName) && !/Product/i.test(typeName)) {
        var keysSkip = Object.keys(obj);
        for (var ks = 0; ks < keysSkip.length && ks < 80; ks++) {
          if (obj[keysSkip[ks]] && typeof obj[keysSkip[ks]] === "object") walk(obj[keysSkip[ks]], depth + 1, acc);
        }
        return;
      }
      var pid = productIdFromUrl();
      var isProduct =
        /Product/i.test(typeName) ||
        /gid:\/\/shopify\/Product\//.test(gid) ||
        (obj.title && (obj.bodyHtml || obj.body_html || obj.descriptionHtml || obj.description_html) && !obj.myshopifyDomain);
      if (isProduct && obj.title) {
        var t = looksLikeTitle(obj.title);
        if (t && !isShopName(t, shopNames)) {
          var idStr = String(obj.id || obj.gid || "");
          var rank = 1;
          if (pid && idStr.indexOf(pid) !== -1) rank = 3;
          if (/Product/i.test(typeName) || /gid:\/\/shopify\/Product\//.test(gid)) rank += 1;
          acc.push({
            title: t,
            body: obj.bodyHtml || obj.body_html || obj.descriptionHtml || obj.description_html || obj.description || "",
            rank: rank
          });
        }
      }
      var keys = Object.keys(obj);
      for (var k = 0; k < keys.length && k < 80; k++) {
        var key = keys[k];
        var val = obj[key];
        if (key === "title" && typeof val === "string" && obj.handle && (obj.body_html || obj.bodyHtml || obj.variants || obj.product_type != null)) {
          var t2 = looksLikeTitle(val);
          if (t2 && !isShopName(t2, shopNames)) acc.push({ title: t2, body: obj.body_html || obj.bodyHtml || "", rank: 2 });
        }
        if (val && typeof val === "object") walk(val, depth + 1, acc);
      }
    }

    var acc = [];
    for (i = 0; i < blobs.length; i++) {
      var raw = blobs[i].trim();
      try {
        walk(JSON.parse(raw), 0, acc);
      } catch (e) {
        var m = raw.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            walk(JSON.parse(m[0]), 0, acc);
          } catch (e2) {}
        }
      }
    }
    acc.sort(function (a, b) { return b.rank - a.rank; });
    if (acc[0]) return acc[0];
    return null;
  }

  function readTitle() {
    var docs = allDocs();
    var shopNames = collectShopNames(docs);
    var i, got, js;
    var foundField = false;
    var fromField = "";
    for (i = 0; i < docs.length; i++) {
      got = readTitleFromDoc(docs[i], shopNames);
      if (got.found) {
        foundField = true;
        if (got.title) {
          fromField = got.title;
          break;
        }
      }
    }
    if (fromField) return fromField;
    if (foundField) return "";
    if (!onProductEditPage()) return "";
    for (i = 0; i < docs.length; i++) {
      js = readTitleFromJson(docs[i], shopNames);
      if (js && js.title && !isShopName(js.title, shopNames)) return js.title;
    }
    return "";
  }

  function descFromEditorEl(el) {
    if (!el || inOverlay(el)) return "";
    if (typeof el.value === "string" && el.value.trim()) return el.value;
    if (el.innerHTML && textOf(el).length > 2) return el.innerHTML;
    return textOf(el);
  }

  function readDescriptionFromDoc(doc) {
    var sels = [
      'textarea[name="descriptionHtml"]',
      'textarea[name="body_html"]',
      'textarea[name="product[body_html]"]',
      'textarea[name="bodyHtml"]',
      'textarea[id*="body" i]',
      'textarea[aria-label*="description" i]',
      'textarea[aria-label*="body" i]',
      '[data-testid*="description" i] textarea',
      '[data-testid*="rich-text" i] [contenteditable="true"]'
    ];
    var i, j, nodes, html;
    for (i = 0; i < sels.length; i++) {
      nodes = qsaDeep(sels[i], doc);
      for (j = 0; j < nodes.length; j++) {
        html = descFromEditorEl(nodes[j]);
        if (html && html.trim().length > 2) return html;
      }
    }

    html = readTinymceHtml(doc);
    if (html && html.trim().length > 2) return html;

    var labeled = labeledControls(doc, /^(description|body|product description|rich text|説明|商品の説明)$/i);
    for (i = 0; i < labeled.length; i++) {
      html = descFromEditorEl(labeled[i]);
      if (html && html.trim().length > 8) return html;
      var inner = qsa("textarea, [contenteditable='true'], [role='textbox']", labeled[i]);
      for (j = 0; j < inner.length; j++) {
        html = descFromEditorEl(inner[j]);
        if (html && html.trim().length > 8) return html;
      }
    }

    var ce = qsa("[contenteditable='true'], [role='textbox']", doc);
    for (i = 0; i < ce.length; i++) {
      if (inOverlay(ce[i]) || !visible(ce[i])) continue;
      var aria = (ce[i].getAttribute("aria-label") || "").toLowerCase();
      if (/title|search|tag/.test(aria)) continue;
      html = descFromEditorEl(ce[i]);
      if (html && textOf(ce[i]).length > 8) return html;
    }
    return "";
  }

  function readDescription() {
    var docs = allDocs();
    var i, d, js;
    for (i = 0; i < docs.length; i++) {
      d = readDescriptionFromDoc(docs[i]);
      if (d) return d;
    }
    for (i = 0; i < docs.length; i++) {
      js = readTitleFromJson(docs[i], collectShopNames(docs));
      if (js && js.body) return js.body;
    }
    return "";
  }

  function findDescriptionEditor() {
    var docs = allDocs();
    var i, j, nodes, labeled, inner;
    var sels = [
      'textarea[name="descriptionHtml"]',
      'textarea[name="body_html"]',
      'textarea[name="product[body_html]"]',
      'textarea[name="bodyHtml"]',
      'textarea[aria-label*="description" i]',
      'textarea[id*="body" i]',
      '[data-testid*="description" i] [contenteditable="true"]',
      '[data-testid*="rich-text" i] [contenteditable="true"]'
    ];
    for (i = 0; i < docs.length; i++) {
      for (j = 0; j < sels.length; j++) {
        nodes = qsaDeep(sels[j], docs[i]).filter(function (el) {
          return !inOverlay(el);
        });
        if (nodes[0]) {
          return nodes[0].tagName.toLowerCase() === "textarea"
            ? { type: "textarea", el: nodes[0] }
            : { type: "ce", el: nodes[0] };
        }
      }
      labeled = labeledControls(docs[i], /^(description|body|product description|説明|商品の説明)$/i);
      for (j = 0; j < labeled.length; j++) {
        if ((labeled[j].tagName || "").toLowerCase() === "textarea") return { type: "textarea", el: labeled[j] };
        if (labeled[j].isContentEditable || labeled[j].getAttribute("contenteditable") === "true") {
          return { type: "ce", el: labeled[j] };
        }
        inner = qsa("textarea, [contenteditable='true']", labeled[j]);
        if (inner[0]) {
          return inner[0].tagName.toLowerCase() === "textarea"
            ? { type: "textarea", el: inner[0] }
            : { type: "ce", el: inner[0] };
        }
      }
    }
    for (i = 0; i < docs.length; i++) {
      var ce = qsa("[contenteditable='true']", docs[i]).filter(function (el) {
        if (inOverlay(el) || !visible(el)) return false;
        var aria = (el.getAttribute("aria-label") || "").toLowerCase();
        if (/title|search|tag|seo/.test(aria)) return false;
        var r = el.getBoundingClientRect();
        return r.height > 40 && r.width > 120;
      });
      if (ce[0]) return { type: "ce", el: ce[0] };
    }
    return null;
  }

  function setNativeValue(el, value) {
    var proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, "value");
    el.focus();
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    try {
      el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertFromPaste", data: value }));
    } catch (e) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function insertIntoContentEditable(el, html) {
    var doc = el.ownerDocument || document;
    var win = doc.defaultView || window;
    el.focus();
    try {
      var sel = win.getSelection();
      var range = doc.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {}
    var ok = false;
    try {
      ok = doc.execCommand("insertHTML", false, html);
    } catch (e2) {
      ok = false;
    }
    if (!ok) {
      el.innerHTML = html;
    }
    try {
      el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertFromPaste" }));
    } catch (e3) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function readTinymceHtml(doc) {
    var frames = qsaDeep("iframe#product-description-ru_ifr, iframe[id$='_ifr'][id*='product-description'], iframe[id*='description'][id$='_ifr']", doc);
    var i, d, body, html;
    for (i = 0; i < frames.length; i++) {
      try {
        d = frames[i].contentDocument || (frames[i].contentWindow && frames[i].contentWindow.document);
        if (!d) continue;
        body = d.body;
        if (!body) continue;
        html = body.innerHTML || "";
        if (html && html.replace(/<[^>]+>/g, "").trim().length > 1) return html;
      } catch (e) {}
    }
    return "";
  }

  function writeTinymceHtml(html) {
    var docs = allDocs();
    var wrote = false;
    var i, j, frames, d, body;
    for (i = 0; i < docs.length; i++) {
      frames = qsaDeep("iframe#product-description-ru_ifr, iframe[id$='_ifr'][id*='product-description'], iframe[id*='description'][id$='_ifr']", docs[i]);
      for (j = 0; j < frames.length; j++) {
        try {
          d = frames[j].contentDocument || (frames[j].contentWindow && frames[j].contentWindow.document);
          if (!d || !d.body) continue;
          body = d.body;
          body.innerHTML = html;
          try {
            body.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertFromPaste" }));
          } catch (e) {
            body.dispatchEvent(new Event("input", { bubbles: true }));
          }
          body.dispatchEvent(new Event("change", { bubbles: true }));
          wrote = true;
        } catch (e2) {}
      }
    }
    return wrote;
  }

  function findDescriptionTextarea() {
    var docs = allDocs();
    var i, nodes;
    for (i = 0; i < docs.length; i++) {
      nodes = qsaDeep('textarea[name="descriptionHtml"]', docs[i]).filter(function (el) {
        return !inOverlay(el);
      });
      if (nodes[0]) return nodes[0];
    }
    return null;
  }

  function insertBody(html) {
    var ok = false;
    var ta = findDescriptionTextarea();
    if (ta) {
      setNativeValue(ta, html);
      ok = true;
    }
    if (writeTinymceHtml(html)) ok = true;
    if (ok) return true;
    var ed = findDescriptionEditor();
    if (!ed) return false;
    if (ed.type === "textarea") {
      setNativeValue(ed.el, html);
      return true;
    }
    return insertIntoContentEditable(ed.el, html);
  }

  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(t);
    }
    var ta = document.createElement("textarea");
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return Promise.resolve();
  }

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "text") n.textContent = attrs[k];
        else if (k === "html") n.innerHTML = attrs.html;
        else n.setAttribute(k, attrs[k]);
      });
    }
    (kids || []).forEach(function (c) {
      n.appendChild(c);
    });
    return n;
  }

  var lastResult = null;
  var panel = null;
  var toggle = null;
  var titleInput = null;
  var descInput = null;
  var waitEl = null;
  var pollTimer = null;
  var pageMo = null;
  var mainMo = null;
  var spaHooked = false;
  var lastProductHref = "";
  var TITLE_WAIT_MS = 400;

  function field(label, id, multiline) {
    var lab = el("label", { for: id, text: label });
    var input = multiline ? el("textarea", { id: id }) : el("input", { id: id, type: "text" });
    return { lab: lab, input: input };
  }

  function resultBlock(label, key) {
    var wrap = el("div");
    var count = el("span", { class: "sc-count", id: "sc-count-" + key });
    var lab = el("label");
    lab.appendChild(document.createTextNode(label + " "));
    lab.appendChild(count);
    var pre = el("div", { class: "sc-out", id: "sc-out-" + key });
    var btn = el("button", { class: "sc-copy", type: "button", text: "Copy" });
    btn.addEventListener("click", function () {
      if (!lastResult) return;
      copyText(lastResult[key]).then(function () {
        btn.textContent = "Copied";
        setTimeout(function () {
          btn.textContent = "Copy";
        }, 900);
      });
    });
    wrap.appendChild(lab);
    wrap.appendChild(pre);
    wrap.appendChild(btn);
    return wrap;
  }

  function showWait(on) {
    if (!waitEl) return;
    waitEl.textContent = on ? WAIT_TITLE : "";
    waitEl.style.display = on ? "flex" : "none";
  }

  function fillFromPage(force) {
    var t = readTitle();
    var d = readDescription();
    if (titleInput && (force || !(titleInput.value || "").trim()) && t) titleInput.value = t;
    if (descInput && (force || !(descInput.value || "").trim()) && d) descInput.value = ShopCopy.stripHtml(d);
    return t;
  }

  function rescanLiveDom() {
    var t = readTitle();
    var d = readDescription();
    if (titleInput && t) titleInput.value = t;
    if (descInput && d) descInput.value = ShopCopy.stripHtml(d);
    return t;
  }

  function doGenerate() {
    if (!titleInput) return false;
    rescanLiveDom();
    var title = (titleInput.value || "").trim();
    if (!title) {
      title = readTitle() || "";
      if (title) titleInput.value = title;
    }
    title = (titleInput.value || "").trim();
    if (!title) {
      showWait(true);
      lastResult = null;
      return false;
    }
    showWait(false);
    var bullets = descInput.value
      .split("\n")
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    lastResult = ShopCopy.generate({
      title: title,
      description: descInput.value,
      bullets: bullets
    });
    document.getElementById("sc-out-seoTitle").textContent = lastResult.seoTitle;
    document.getElementById("sc-count-seoTitle").textContent = lastResult.seoTitleCount + "/70";
    document.getElementById("sc-out-metaDescription").textContent = lastResult.metaDescription;
    document.getElementById("sc-count-metaDescription").textContent = lastResult.metaCount + " chars";
    document.getElementById("sc-out-bodyHtml").textContent = lastResult.bodyHtml;
    document.getElementById("sc-out-tagsLine").textContent = lastResult.tagsLine;
    return true;
  }

  function stopWatch() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startWatch() {
    stopWatch();
    var started = Date.now();
    function tick() {
      var t = fillFromPage(false);
      if (t && titleInput && (titleInput.value || "").trim()) {
        showWait(false);
        if (!lastResult) doGenerate();
        if (Date.now() - started > 3200) stopWatch();
        return;
      }
      showWait(true);
    }
    pollTimer = setInterval(tick, TITLE_WAIT_MS);
    tick();
    if (!pageMo) {
      try {
        pageMo = new MutationObserver(function () {
          fillFromPage(false);
        });
        pageMo.observe(document.documentElement, { childList: true, subtree: true });
      } catch (e) {}
    }
  }

  function onSpaOrRerender() {
    var href = pageHref();
    var product = /\/products\/[^/?#]+/i.test(href);
    if (isTop() && product && !document.getElementById("shopcopy-root")) {
      renderPanel();
      return;
    }
    if (href !== lastProductHref) {
      lastProductHref = href;
      lastResult = null;
      if (titleInput) titleInput.value = "";
      if (descInput) descInput.value = "";
      showWait(true);
      if (product) startWatch();
      return;
    }
    if (!product) return;
    var live = readTitle();
    if (live) {
      fillFromPage(false);
      return;
    }
    if (titleInput && !(titleInput.value || "").trim()) startWatch();
  }

  function observeMain() {
    if (mainMo) {
      try { mainMo.disconnect(); } catch (e) {}
    }
    try {
      mainMo = new MutationObserver(function () {
        onSpaOrRerender();
      });
      var root = document.querySelector("main, #AppFrameMain, [role='main']") || document.documentElement;
      mainMo.observe(root, { childList: true, subtree: true });
    } catch (e2) {}
  }

  function hookSpa() {
    if (spaHooked) return;
    spaHooked = true;
    lastProductHref = pageHref();
    function wrap(fn) {
      return function () {
        var r = fn.apply(this, arguments);
        setTimeout(onSpaOrRerender, 50);
        setTimeout(observeMain, 80);
        return r;
      };
    }
    try {
      history.pushState = wrap(history.pushState.bind(history));
      history.replaceState = wrap(history.replaceState.bind(history));
    } catch (e) {}
    window.addEventListener("popstate", function () {
      setTimeout(onSpaOrRerender, 50);
      setTimeout(observeMain, 80);
    });
    observeMain();
  }

  function renderPanel() {
    if (!isTop()) return;
    if (document.getElementById("shopcopy-root")) return;
    panel = el("div", { id: "shopcopy-root" });
    var header = el("header");
    header.appendChild(el("h1", { html: 'ShopCopy <span class="sc-accent">on page</span>' }));
    var x = el("button", { class: "sc-x", type: "button", text: "hide" });
    x.addEventListener("click", function () {
      panel.style.display = "none";
      toggle.style.display = "block";
    });
    header.appendChild(x);

    var body = el("div", { class: "sc-body" });
    var t = field("Product title", "sc-title");
    var d = field("Description / bullets (one per line)", "sc-desc", true);
    titleInput = t.input;
    descInput = d.input;
    waitEl = el("p", { class: "sc-wait", id: "sc-wait" });
    waitEl.style.display = "none";
    fillFromPage(true);

    var go = el("button", { class: "sc-go", type: "button", text: "Generate" });
    var ins = el("button", { class: "sc-copy", type: "button", text: "Insert body" });

    body.appendChild(t.lab);
    body.appendChild(t.input);
    body.appendChild(d.lab);
    body.appendChild(d.input);
    body.appendChild(waitEl);
    var row = el("div", { class: "sc-row" });
    row.appendChild(go);
    row.appendChild(ins);
    body.appendChild(row);
    body.appendChild(resultBlock("SEO title", "seoTitle"));
    body.appendChild(resultBlock("Meta description", "metaDescription"));
    body.appendChild(resultBlock("Body HTML", "bodyHtml"));
    body.appendChild(resultBlock("13 tags", "tagsLine"));

    go.addEventListener("click", function () {
      doGenerate();
    });

    ins.addEventListener("click", function () {
      if (!lastResult) {
        if (!doGenerate()) return;
      }
      var ok = insertBody(lastResult.bodyHtml);
      ins.textContent = ok ? "Inserted" : "Copy only — editor not found";
      if (!ok) copyText(lastResult.bodyHtml);
    });

    panel.appendChild(header);
    panel.appendChild(body);
    document.documentElement.appendChild(panel);

    toggle = el("button", { id: "shopcopy-toggle", type: "button", text: "ShopCopy" });
    toggle.style.display = "none";
    toggle.addEventListener("click", function () {
      panel.style.display = "block";
      toggle.style.display = "none";
      fillFromPage(false);
    });
    document.documentElement.appendChild(toggle);

    if ((titleInput.value || "").trim()) doGenerate();
    startWatch();
    hookSpa();
  }

  if (!isTop()) return;

  chrome.runtime.onMessage.addListener(function (msg, _s, sendResponse) {
    if (msg && msg.type === "shopcopy-read") {
      sendResponse({
        title: readTitle(),
        description: ShopCopy.stripHtml(readDescription()),
        href: location.href
      });
      return true;
    }
    if (msg && msg.type === "shopcopy-insert") {
      sendResponse({ ok: insertBody(msg.html || "") });
      return true;
    }
    if (msg && msg.type === "shopcopy-show") {
      renderPanel();
      sendResponse({ ok: true });
      return true;
    }
  });

  if (isTop()) {
    hookSpa();
    if (/\/products\//.test(location.pathname)) setTimeout(renderPanel, 400);
  }
})();
