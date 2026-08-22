(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ShopCopy = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  var STOP = {
    a: 1, an: 1, the: 1, and: 1, or: 1, of: 1, for: 1, to: 1, in: 1, on: 1,
    with: 1, from: 1, by: 1, at: 1, is: 1, are: 1, this: 1, that: 1, it: 1,
    as: 1, be: 1, your: 1, you: 1, we: 1, our: 1, new: 1
  };

  function stripHtml(html) {
    return String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function words(text) {
    return stripHtml(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter(function (w) {
        return w.length > 1 && !STOP[w];
      });
  }

  function unique(arr) {
    var seen = {};
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var k = arr[i];
      if (!k || seen[k]) continue;
      seen[k] = 1;
      out.push(k);
    }
    return out;
  }

  function titleCase(s) {
    return String(s)
      .split(/\s+/)
      .map(function (w) {
        if (!w) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(" ");
  }

  function clip(s, n) {
    s = String(s || "").replace(/\s+/g, " ").trim();
    if (s.length <= n) return s;
    var cut = s.slice(0, n);
    var sp = cut.lastIndexOf(" ");
    if (sp > Math.floor(n * 0.6)) cut = cut.slice(0, sp);
    return cut.replace(/[,\.;:\-]+$/, "").trim();
  }

  function firstSentence(text) {
    var t = stripHtml(text);
    if (!t) return "";
    var m = t.match(/^.{20,220}?[.!?](\s|$)/);
    return m ? m[0].trim() : clip(t, 180);
  }

  function bulletsFrom(title, desc) {
    var t = stripHtml(desc);
    var bits = [];
    t.split(/[\n•·]|<(?:li|p|br)[^>]*>/i).forEach(function (line) {
      var s = stripHtml(line);
      if (s.length >= 12 && s.length <= 140) bits.push(s.replace(/^[-\*\d.\s]+/, ""));
    });
    var keys = unique(words(title + " " + desc)).slice(0, 6);
    var extras = [
      "Built for daily use, not a one-off unboxing",
      "Clear specs so buyers know what they are getting",
      "Pairs with a simple care routine",
      "Ships as a complete unit — no hidden extras required",
      "Sized for real rooms, not just a studio shot",
      "Straightforward returns if it is not the right fit"
    ];
    if (keys[0]) extras.unshift("Named for what it is: " + titleCase(keys.slice(0, 3).join(" ")));
    bits = unique(bits.concat(extras));
    return bits.slice(0, 5);
  }

  function seoTitle(title, extra) {
    var base = stripHtml(title) || "Product";
    var extras = extra || " | Shop";
    var out = clip(base, 70);
    if (out.length < 40 && (base + extras).length <= 70) out = clip(base + extras, 70);
    return out;
  }

  function metaDescription(title, desc) {
    var lead = firstSentence(desc);
    if (!lead) lead = "Shop " + stripHtml(title) + ". Specs, care, and who it is for — written for the product page.";
    var tail = " Free to scan in search. Order when it fits.";
    var out = lead;
    if (out.length < 120) out = clip(out + tail, 158);
    return clip(out, 158);
  }

  function bodyHtml(title, desc, extraBullets) {
    var name = stripHtml(title) || "This product";
    var intro = firstSentence(desc) || name + " is listed with the facts a buyer needs before they add to cart.";
    var bullets = extraBullets && extraBullets.length
      ? extraBullets.filter(Boolean).slice(0, 8)
      : bulletsFrom(name, desc);
    while (bullets.length < 4) bullets.push("See the title and specs — this listing stays specific.");
    var lis = bullets
      .map(function (b) {
        return "<li>" + escapeHtml(b) + "</li>";
      })
      .join("");
    return (
      "<h2>" +
      escapeHtml(name) +
      "</h2>" +
      "<p>" +
      escapeHtml(intro) +
      "</p>" +
      "<h3>What you get</h3>" +
      "<ul>" +
      lis +
      "</ul>" +
      "<p>Read the tags and meta if you need a search-facing summary. This body is for the product page, not a chatbot.</p>"
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var TAG_POOL = [
    "shopify",
    "product",
    "seo",
    "gift",
    "home",
    "daily",
    "durable",
    "minimal",
    "in-stock",
    "bestseller",
    "limited",
    "care-easy",
    "unisex",
    "small-space",
    "made-to-last"
  ];

  function tags(title, desc) {
    var raw = unique(words(title + " " + desc));
    var out = [];
    for (var i = 0; i < raw.length && out.length < 13; i++) {
      var w = raw[i].slice(0, 30);
      if (w.length < 2) continue;
      out.push(w);
    }
    var j = 0;
    while (out.length < 13) {
      var t = TAG_POOL[j % TAG_POOL.length];
      j++;
      if (out.indexOf(t) === -1) out.push(t);
    }
    return out.slice(0, 13);
  }

  function generate(input) {
    var title = (input && input.title) || "";
    var description = (input && input.description) || "";
    var extraBullets = (input && input.bullets) || [];
    var st = seoTitle(title);
    var md = metaDescription(title, description);
    var body = bodyHtml(title, description, extraBullets);
    var tg = tags(title, description);
    return {
      seoTitle: st,
      seoTitleCount: st.length,
      metaDescription: md,
      metaCount: md.length,
      bodyHtml: body,
      tags: tg,
      tagsLine: tg.join(", ")
    };
  }

  return { generate: generate, clip: clip, stripHtml: stripHtml };
});
