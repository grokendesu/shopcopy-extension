(function () {
  if (window.__shopcopyInjected) return;
  window.__shopcopyInjected = true;

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function readTitle() {
    var sels = [
      'input[name="title"]',
      'input[id*="title" i]',
      'input[aria-label="Title"]',
      'input[aria-label*="Product title" i]',
      'input[placeholder="Short sleeve t-shirt"]',
      '[data-product-title] input',
      'h1 input',
      '.Polaris-TextField input'
    ];
    for (var i = 0; i < sels.length; i++) {
      var nodes = qsa(sels[i]).filter(visible);
      for (var j = 0; j < nodes.length; j++) {
        var v = (nodes[j].value || "").trim();
        if (v) return v;
      }
    }
    var heading = document.querySelector("h1");
    if (heading && heading.innerText && heading.innerText.length < 120) {
      return heading.innerText.trim();
    }
    return "";
  }

  function readDescription() {
    var areas = qsa("textarea").filter(visible);
    for (var i = 0; i < areas.length; i++) {
      var lab = ((areas[i].getAttribute("aria-label") || "") + " " + (areas[i].name || "")).toLowerCase();
      if (/desc|body|html/.test(lab) && areas[i].value) return areas[i].value;
    }
    var iframes = qsa("iframe");
    for (var k = 0; k < iframes.length; k++) {
      try {
        var doc = iframes[k].contentDocument;
        if (!doc) continue;
        var body = doc.body;
        if (body && body.innerText && body.innerText.trim().length > 8) {
          return body.innerHTML || body.innerText;
        }
      } catch (e) {}
    }
    var ce = qsa("[contenteditable='true']").filter(visible);
    for (var n = 0; n < ce.length; n++) {
      var t = ce[n].innerText || "";
      if (t.trim().length > 8) return ce[n].innerHTML || t;
    }
    return "";
  }

  function findDescriptionEditor() {
    var areas = qsa("textarea").filter(visible);
    for (var i = 0; i < areas.length; i++) {
      var lab = ((areas[i].getAttribute("aria-label") || "") + " " + (areas[i].name || "")).toLowerCase();
      if (/desc|body|html/.test(lab)) return { type: "textarea", el: areas[i] };
    }
    var ce = qsa("[contenteditable='true']").filter(visible);
    if (ce[0]) return { type: "ce", el: ce[0] };
    var iframes = qsa("iframe");
    for (var k = 0; k < iframes.length; k++) {
      try {
        var doc = iframes[k].contentDocument;
        if (doc && doc.body && doc.body.isContentEditable) {
          return { type: "iframe", el: doc.body };
        }
      } catch (e) {}
    }
    return null;
  }

  function setValue(el, value) {
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function insertBody(html) {
    var ed = findDescriptionEditor();
    if (!ed) return false;
    if (ed.type === "textarea") {
      setValue(ed.el, html);
      return true;
    }
    ed.el.focus();
    ed.el.innerHTML = html;
    ed.el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
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

  function field(label, id, multiline) {
    var lab = el("label", { for: id, text: label });
    var input = multiline
      ? el("textarea", { id: id })
      : el("input", { id: id, type: "text" });
    return { lab: lab, input: input };
  }

  function resultBlock(label, key, isHtml) {
    var wrap = el("div");
    var count = el("span", { class: "sc-count", id: "sc-count-" + key });
    var lab = el("label");
    lab.appendChild(document.createTextNode(label + " "));
    lab.appendChild(count);
    var pre = el("div", { class: "sc-out", id: "sc-out-" + key });
    var btn = el("button", { class: "sc-copy", type: "button", text: "Copy" });
    btn.addEventListener("click", function () {
      if (!lastResult) return;
      var val = lastResult[key];
      copyText(val).then(function () {
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

  function renderPanel() {
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
    t.input.value = readTitle();
    d.input.value = ShopCopy.stripHtml(readDescription());

    var go = el("button", { class: "sc-go", type: "button", text: "Generate" });
    var ins = el("button", { class: "sc-copy", type: "button", text: "Insert body" });

    var seo = resultBlock("SEO title", "seoTitle");
    var meta = resultBlock("Meta description", "metaDescription");
    var html = resultBlock("Body HTML", "bodyHtml");
    var tags = resultBlock("13 tags", "tagsLine");

    go.addEventListener("click", function () {
      var bullets = d.input.value
        .split("\n")
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
      lastResult = ShopCopy.generate({
        title: t.input.value,
        description: d.input.value,
        bullets: bullets
      });
      document.getElementById("sc-out-seoTitle").textContent = lastResult.seoTitle;
      document.getElementById("sc-count-seoTitle").textContent = lastResult.seoTitleCount + "/70";
      document.getElementById("sc-out-metaDescription").textContent = lastResult.metaDescription;
      document.getElementById("sc-count-metaDescription").textContent = lastResult.metaCount + " chars";
      document.getElementById("sc-out-bodyHtml").textContent = lastResult.bodyHtml;
      document.getElementById("sc-out-tagsLine").textContent = lastResult.tagsLine;
    });

    t.input.addEventListener("input", function () {
      var draft = ShopCopy.generate({ title: t.input.value, description: d.input.value });
      document.getElementById("sc-count-seoTitle").textContent = draft.seoTitleCount + "/70";
    });

    ins.addEventListener("click", function () {
      if (!lastResult) go.click();
      var ok = insertBody(lastResult.bodyHtml);
      ins.textContent = ok ? "Inserted" : "Copy only — editor not found";
      if (!ok) copyText(lastResult.bodyHtml);
    });

    body.appendChild(t.lab);
    body.appendChild(t.input);
    body.appendChild(d.lab);
    body.appendChild(d.input);
    var row = el("div", { class: "sc-row" });
    row.appendChild(go);
    row.appendChild(ins);
    body.appendChild(row);
    body.appendChild(seo);
    body.appendChild(meta);
    body.appendChild(html);
    body.appendChild(tags);

    panel.appendChild(header);
    panel.appendChild(body);
    document.documentElement.appendChild(panel);

    toggle = el("button", { id: "shopcopy-toggle", type: "button", text: "ShopCopy" });
    toggle.style.display = "none";
    toggle.addEventListener("click", function () {
      panel.style.display = "block";
      toggle.style.display = "none";
      t.input.value = t.input.value || readTitle();
    });
    document.documentElement.appendChild(toggle);

    go.click();
  }

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

  if (/\/products\//.test(location.pathname)) {
    setTimeout(renderPanel, 800);
  }
})();
