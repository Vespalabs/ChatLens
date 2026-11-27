
const cors = {
  "Access-Control-Allow-Origin":
    "https://vespalabs.github.io",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return reply({ error: "Method not allowed" }, 405);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

    const key = Deno.env.get("RAZORPAY_KEY_ID");
    const secret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!url || !anon || !service || !key || !secret) {
      return reply({
        error: "Server configuration incomplete"
      }, 500);
    }

    if (!key.startsWith("rzp_test_")) {
      return reply({
        error: "Only test payments are enabled"
      }, 503);
    }

    const auth = req.headers.get("Authorization");

    if (!auth?.startsWith("Bearer ")) {
      return reply({ error: "Login required" }, 401);
    }

    const userResponse = await fetch(
      `${url}/auth/v1/user`,
      {
        headers: {
          apikey: anon,
          Authorization: auth,
        },
      }
    );

    if (!userResponse.ok) {
      return reply({ error: "Invalid session" }, 401);
    }

    const user = await userResponse.json();

    if (!user.id) {
      return reply({ error: "Login required" }, 401);
    }

    const dbHeaders = {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
    };

    const since = new Date(
      Date.now() - 3600000
    ).toISOString();

    const recent = await fetch(
      `${url}/rest/v1/chatlens_payments?` +
      `user_id=eq.${encodeURIComponent(user.id)}` +
      `&created_at=gte.${encodeURIComponent(since)}` +
      `&select=id&limit=10`,
      { headers: dbHeaders }
    );

    if (!recent.ok) {
      return reply({
        error: "Payment service unavailable"
      }, 503);
    }

    const orders = await recent.json();

    if (orders.length >= 10) {
      return reply({
        error: "Too many orders. Try again later."
      }, 429);
    }

    const amount = 50000;
    const currency = "INR";
    const plan = "detailed_analysis";

    const orderResponse = await fetch(
      "https://api.razorpay.com/v1/orders",
      {
        method: "POST",
        headers: {
          Authorization:
            `Basic ${btoa(`${key}:${secret}`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          currency,
          receipt: crypto.randomUUID(),
          notes: {
            user_id: user.id,
            product: plan,
          },
        }),
      }
    );

    if (!orderResponse.ok) {
      return reply({
        error: "Unable to create payment order"
      }, 502);
    }

    const order = await orderResponse.json();

    if (
      !order.id ||
      order.amount !== amount ||
      order.currency !== currency
    ) {
      return reply({
        error: "Unexpected payment order"
      }, 502);
    }

    const save = await fetch(
      `${url}/rest/v1/chatlens_payments`,
      {
        method: "POST",
        headers: {
          ...dbHeaders,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          user_id: user.id,
          razorpay_order_id: order.id,
          amount,
          currency,
          plan,
          status: "created",
          test_mode: true,
        }),
      }
    );

    if (!save.ok) {
      return reply({
        error: "Unable to record payment order"
      }, 500);
    }

    return reply({
      success: true,
      order_id: order.id,
      amount,
      currency,
      key_id: key,
      plan,
      test_mode: true,
    });

  } catch {
    return reply({
      error: "Payment service temporarily unavailable"
    }, 500);
  }
});
