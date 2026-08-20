// Creates a Stripe Checkout Session for a multi-item cart.
//
// Security model:
//  - The browser sends only { items: [{ id, quantity }] } — never prices.
//  - Every price is looked up here, server-side, from products.json.
//  - The Stripe secret key lives only in the STRIPE_SECRET_KEY env var,
//    never in the repo or the browser.
//
// No npm dependencies: this calls Stripe's REST API directly with fetch.

import catalog from "../../products.json";

const STRIPE_API = "https://api.stripe.com/v1/checkout/sessions";

// Flatten a nested object into Stripe's bracketed form-encoding, e.g.
// { line_items: [{ quantity: 2 }] } -> line_items[0][quantity]=2
function encodePairs(obj, prefix, pairs) {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val === null || val === undefined) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(val)) {
      val.forEach((v, i) => {
        if (v !== null && typeof v === "object") encodePairs(v, `${name}[${i}]`, pairs);
        else pairs.push([`${name}[${i}]`, v]);
      });
    } else if (typeof val === "object") {
      encodePairs(val, name, pairs);
    } else {
      pairs.push([name, val]);
    }
  }
  return pairs;
}

function toForm(obj) {
  return encodePairs(obj, "", [])
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json({ error: "Checkout is not configured yet." }, 500);

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const requested = Array.isArray(payload?.items) ? payload.items : [];
  if (!requested.length) return json({ error: "Your cart is empty." }, 400);

  const activeById = new Map(
    catalog.products.filter((p) => p.active).map((p) => [p.id, p])
  );

  const origin =
    req.headers.get("origin") ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.URL ||
    "https://elysehartnett.com";

  // Build line items from the catalog — the browser's prices are ignored.
  const lineItems = [];
  let subtotalCents = 0;
  for (const item of requested) {
    const product = activeById.get(item?.id);
    if (!product) continue; // unknown or inactive id — skip

    let qty = parseInt(item?.quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    const maxQty = Math.max(1, Math.min(product.stock ?? 25, 25));
    if (qty > maxQty) qty = maxQty;

    subtotalCents += product.priceCents * qty;

    const priceData = {
      currency: catalog.currency,
      unit_amount: product.priceCents,
      product_data: {
        name: product.name,
        images:
          product.images && product.images[0]
            ? [`${origin}/${product.images[0]}`]
            : undefined,
      },
    };
    if (catalog.tax?.enabled) priceData.tax_behavior = "exclusive";

    lineItems.push({ price_data: priceData, quantity: qty });
  }

  if (!lineItems.length) return json({ error: "No valid items in cart." }, 400);

  // Shipping: flat rate, free at/above the threshold, charged once per order.
  const freeShip = subtotalCents >= catalog.shipping.freeThresholdCents;
  const shipAmount = freeShip ? 0 : catalog.shipping.flatCents;
  const shipName = freeShip ? catalog.shipping.freeLabel : catalog.shipping.label;

  const params = {
    mode: "payment",
    success_url: `${origin}/shop.html?checkout=success`,
    cancel_url: `${origin}/shop.html?checkout=cancel`,
    billing_address_collection: "auto",
    shipping_address_collection: { allowed_countries: catalog.shipping.countries },
    line_items: lineItems,
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: shipName,
          fixed_amount: { amount: shipAmount, currency: catalog.currency },
        },
      },
    ],
  };

  // PHASE 8 — sales tax. Stays off until products.json tax.enabled = true AND
  // Stripe Tax is activated in the dashboard with the CDTFA permit. Stripe then
  // applies CA rates to CA shipping addresses automatically; no nexus elsewhere.
  if (catalog.tax?.enabled) {
    params.automatic_tax = { enabled: true };
    params.shipping_options[0].shipping_rate_data.tax_behavior = "exclusive";
  }

  let res, session;
  try {
    res = await fetch(STRIPE_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: toForm(params),
    });
    session = await res.json();
  } catch {
    return json({ error: "Could not reach the payment processor. Please try again." }, 502);
  }

  if (!res.ok || !session.url) {
    console.error("Stripe error:", session?.error);
    return json({ error: "Checkout could not be created. Please try again." }, 502);
  }

  return json({ url: session.url });
};
