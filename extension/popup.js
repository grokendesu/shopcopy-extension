(function () {
  var last = null;
  var title = document.getElementById("title");
  var desc = document.getElementById("desc");
  var status = document.getElementById("status");

  function paint(r) {
    last = r;
    document.getElementById("out-seo").textContent = r.seoTitle;
    document.getElementById("c-seo").textContent = r.seoTitleCount + "/70";
    document.getElementById("out-meta").textContent = r.metaDescription;
    document.getElementById("c-meta").textContent = r.metaCount + " chars";
    document.getElementById("out-body").textContent = r.bodyHtml;
    document.getElementById("out-tags").textContent = r.tagsLine;
  }

  function generate() {
    var bullets = desc.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    paint(ShopCopy.generate({ title: title.value, description: desc.value, bullets: bullets }));
  }

  document.getElementById("gen").addEventListener("click", generate);
  title.addEventListener("input", generate);
  desc.addEventListener("input", generate);

  document.querySelectorAll(".copy").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!last) generate();
      var key = btn.getAttribute("data-key");
      navigator.clipboard.writeText(last[key]).then(function () {
        btn.textContent = "Copied";
        setTimeout(function () { btn.textContent = "Copy"; }, 900);
      });
    });
  });

  document.getElementById("insert").addEventListener("click", function () {
    if (!last) generate();
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs[0];
      if (!tab || !tab.id) return;
      chrome.tabs.sendMessage(tab.id, { type: "shopcopy-insert", html: last.bodyHtml }, function (res) {
        if (chrome.runtime.lastError) {
          status.textContent = "Open a Shopify product edit page.";
          return;
        }
        status.textContent = res && res.ok ? "Inserted into the description editor." : "Editor not found — body copied.";
        if (!res || !res.ok) navigator.clipboard.writeText(last.bodyHtml);
      });
    });
  });

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    if (!tab || !tab.id) {
      generate();
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: "shopcopy-read" }, function (res) {
      if (chrome.runtime.lastError || !res) {
        status.textContent = "Not on admin.shopify.com — fill fields by hand.";
        generate();
        return;
      }
      title.value = res.title || "";
      desc.value = res.description || "";
      status.textContent = /products/.test(res.href || "") ? "Read from this product." : "Shopify admin — open a product for a better read.";
      generate();
    });
  });
})();
