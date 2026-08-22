(function () {
  if (window.__shopcopyInjected) return;
  window.__shopcopyInjected = true;

  var TITLE_JUNK = /^(shopify|products?|home|admin|loading|untitled|new product|create product|search|dashboard)$/i;
  var ERR_NO_TITLE = "Cannot find product title. Open a product edit page (admin.shopify.com …/products/…) and wait for the Title field to load.";

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
    if (typeof el.value === "string") v = el.value;
    if (!v && el.getAttribute) v = el.getAttribute("value") || "";
    if (!v && el.isContentEditable) v = textOf(el);
    if (!v && el.getAttribute && el.getAttribute("contenteditable") === "true") v = textOf(el);
    return String(v).trim();
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
    var labels = qsa("label", doc);
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
        inputs = qsa("input, textarea, [contenteditable='true'], [role='textbox']", wrap);
        for (var k = 0; k < inputs.length; k++) {
          if (!inOverlay(inputs[k])) found.push(inputs[k]);
        }
        wrap = wrap.parentElement;
      }
    }
    var labelled = qsa("[aria-labelledby]", doc);
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

  function readTitleFromDoc(doc) {
    var sels = [
      'input[name="title"]',
      'textarea[name="title"]',
      'input[name="product[title]"]',
      'input[id="title"]',
      'input[id="product-title"]',
      'input[name="productTitle"]',
      'input[autocomplete="off"][name="title"]',
      'input[aria-label="Title"]',
      'input[aria-label="Product title"]',
      'input[aria-label="Product name"]',
      'input[aria-label*="Product title" i]',
      'input[aria-label*="product name" i]',
      'textarea[aria-label="Title"]',
      '[data-testid="product-title"] input',
      '[data-testid*="Title" i] input',
      '[data-testid*="product-title" i]',
      '[name="title"]',
      'input[placeholder="Short sleeve t-shirt"]',
      'input[placeholder*="title" i]',
      'input[placeholder*="product name" i]'
    ];
    var i, j, nodes, v;
    for (i = 0; i < sels.length; i++) {
      nodes = qsa(sels[i], doc);
      for (j = 0; j < nodes.length; j++) {
        if (!visible(nodes[j]) && inputValue(nodes[j]) === "") continue;
        if (inOverlay(nodes[j])) continue;
        v = looksLikeTitle(inputValue(nodes[j]));
        if (v) return v;
      }
    }

    var labeled = labeledControls(doc, /^(title|product title|product name|name)$/i);
    for (i = 0; i < labeled.length; i++) {
      var tag = (labeled[i].tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || labeled[i].isContentEditable || labeled[i].getAttribute("role") === "textbox") {
        v = looksLikeTitle(inputValue(labeled[i]));
        if (v) return v;
      }
      var inner = qsa("input, textarea, [contenteditable='true']", labeled[i]);
      for (j = 0; j < inner.length; j++) {
        v = looksLikeTitle(inputValue(inner[j]));
        if (v) return v;
      }
    }

    var textboxes = qsa('[role="textbox"], [contenteditable="true"]', doc);
    for (i = 0; i < textboxes.length; i++) {
      if (inOverlay(textboxes[i])) continue;
      var aria = (textboxes[i].getAttribute("aria-label") || "") + " " + (textboxes[i].getAttribute("name") || "");
      if (/title|product name/i.test(aria)) {
        v = looksLikeTitle(inputValue(textboxes[i]) || textOf(textboxes[i]));
        if (v && v.length < 200) return v;
      }
    }

    return "";
  }

  function readTitleFromJson(doc) {
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
      var isProduct =
        /Product/i.test(String(obj.__typename || "")) ||
        /gid:\/\/shopify\/Product\//.test(gid) ||
        (obj.title && (obj.bodyHtml || obj.body_html || obj.descriptionHtml || obj.description_html));
      if (isProduct && obj.title) {
        var t = looksLikeTitle(obj.title);
        if (t) acc.push({ title: t, body: obj.bodyHtml || obj.body_html || obj.descriptionHtml || obj.description_html || obj.description || "" });
      }
      var keys = Object.keys(obj);
      for (var k = 0; k < keys.length && k < 80; k++) {
        var key = keys[k];
        if (key === "title" && typeof obj[key] === "string" && obj.handle) {
          var t2 = looksLikeTitle(obj[key]);
          if (t2) acc.push({ title: t2, body: obj.body_html || obj.bodyHtml || "" });
        }
        var val = obj[key];
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
    if (acc[0]) return acc[0];
    return null;
  }

  function readTitleFromDocumentTitle(doc) {
    var dt = "";
    try {
      dt = (doc.defaultView && doc.defaultView.top && doc.defaultView.top.document
        ? doc.defaultView.top.document.title
        : doc.title) || doc.title || "";
    } catch (e) {
      dt = doc.title || "";
    }
    var parts = String(dt).split(/\s*[·|—–-]\s*/);
    for (var i = 0; i < parts.length; i++) {
      var v = looksLikeTitle(parts[i]);
      if (v && !/shopify/i.test(v)) return v;
    }
    return "";
  }

  function readTitle() {
    var docs = allDocs();
    var i, t, js;
    for (i = 0; i < docs.length; i++) {
      t = readTitleFromDoc(docs[i]);
      if (t) return t;
    }
    for (i = 0; i < docs.length; i++) {
      js = readTitleFromJson(docs[i]);
      if (js && js.title) return js.title;
    }
    try {
      t = readTitleFromDocumentTitle(document);
      if (t) return t;
    } catch (e) {}
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
      nodes = qsa(sels[i], doc);
      for (j = 0; j < nodes.length; j++) {
        html = descFromEditorEl(nodes[j]);
        if (html && html.trim().length > 2) return html;
      }
    }

    var labeled = labeledControls(doc, /^(description|body|product description|rich text)$/i);
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
      js = readTitleFromJson(docs[i]);
      if (js && js.body) return js.body;
    }
    return "";
  }

  function findDescriptionEditor() {
    var docs = allDocs();
    var i, j, nodes, labeled, inner;
    var sels = [
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
        nodes = qsa(sels[j], docs[i]).filter(function (el) {
          return !inOverlay(el);
        });
        if (nodes[0]) {
          return nodes[0].tagName.toLowerCase() === "textarea"
            ? { type: "textarea", el: nodes[0] }
            : { type: "ce", el: nodes[0] };
        }
      }
      labeled = labeledControls(docs[i], /^(description|body|product description)$/i);
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

  function insertBody(html) {
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
  var errEl = null;
  var pollTimer = null;

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

  function showError(msg) {
    if (!errEl) return;
    errEl.textContent = msg || "";
    errEl.style.display = msg ? "block" : "none";
  }

  function fillFromPage(force) {
    var t = readTitle();
    var d = readDescription();
    if (titleInput && (force || !titleInput.value) && t) titleInput.value = t;
    if (descInput && (force || !descInput.value) && d) descInput.value = ShopCopy.stripHtml(d);
    return t;
  }

  function doGenerate() {
    if (!titleInput) return false;
    var title = (titleInput.value || "").trim();
    if (!title) {
      title = fillFromPage(false) || "";
      if (title) titleInput.value = title;
    }
    title = (titleInput.value || "").trim();
    if (!title) {
      showError(ERR_NO_TITLE);
      lastResult = null;
      return false;
    }
    showError("");
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

  function startWatch() {
    if (pollTimer) return;
    var tries = 0;
    pollTimer = setInterval(function () {
      tries++;
      var t = fillFromPage(false);
      if (t && titleInput && titleInput.value) {
        showError("");
        if (!lastResult) doGenerate();
        if (tries > 8) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      }
      if (tries > 40) {
        clearInterval(pollTimer);
        pollTimer = null;
        if (!titleInput.value) showError(ERR_NO_TITLE);
      }
    }, 400);
    try {
      var mo = new MutationObserver(function () {
        fillFromPage(false);
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
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
    errEl = el("p", { class: "sc-err", id: "sc-err" });
    errEl.style.display = "none";
    fillFromPage(true);

    var go = el("button", { class: "sc-go", type: "button", text: "Generate" });
    var ins = el("button", { class: "sc-copy", type: "button", text: "Insert body" });

    body.appendChild(t.lab);
    body.appendChild(t.input);
    body.appendChild(d.lab);
    body.appendChild(d.input);
    body.appendChild(errEl);
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
    else showError(ERR_NO_TITLE);
    startWatch();
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

  if (isTop() && /\/products\//.test(location.pathname)) {
    setTimeout(renderPanel, 400);
  }
})();
