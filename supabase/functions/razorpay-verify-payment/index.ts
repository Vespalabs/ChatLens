
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

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
    const service = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );
    const key = Deno.env.get("RAZORPAY_KEY_ID");
    const secret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!url || !service || !key || !secret) {
      return reply({
        error: "Server configuration incomplete"
      }, 500);
    }

    if (!key.startsWith("rzp_test_")) {
      return reply({
        error: "Only test payments are enabled"
      }, 503);
    }

    const db = createClient(url, service, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const auth = req.headers.get("Authorization");

    if (!auth?.startsWith("Bearer ")) {
      return reply({ error: "Login required" }, 401);
    }

    const { data: { user }, error: authError } =
      await db.auth.getUser(auth.slice(7));

    if (authError || !user) {
      return reply({ error: "Invalid session" }, 401);
    }

    const body = await req.json();

    const orderId = body.razorpay_order_id;
    const paymentId = body.razorpay_payment_id;
    const signature = body.razorpay_signature;

    if (
      typeof orderId !== "string" ||
      typeof paymentId !== "string" ||
      typeof signature !== "string" ||
      !/^order_[a-zA-Z0-9]+$/.test(orderId) ||
      !/^pay_[a-zA-Z0-9]+$/.test(paymentId) ||
      !/^[a-fA-F0-9]{64}$/.test(signature)
    ) {
      return reply({
        error: "Invalid payment details"
      }, 400);
    }

    const { data: record, error: recordError } =
      await db.from("chatlens_payments")
        .select("*")
        .eq("razorpay_order_id", orderId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (recordError || !record) {
      return reply({ error: "Order not found" }, 404);
    }

    if (
      !record.test_mode ||
      record.amount !== 29900 ||
      record.currency !== "INR" ||
      record.plan !== "detailed_analysis" ||
      !["created", "paid"].includes(record.status)
    ) {
      return reply({ error: "Invalid order" }, 409);
    }

    const expected = createHmac("sha256", secret)
      .update(`${record.razorpay_order_id}|${paymentId}`)
      .digest("hex");

    if (!timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    )) {
      return reply({
        error: "Payment signature invalid"
      }, 400);
    }

    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization:
            `Basic ${btoa(`${key}:${secret}`)}`,
        },
      }
    );

    if (!response.ok) {
      return reply({
        error: "Unable to confirm payment"
      }, 502);
    }

    const payment = await response.json();

    if (
      payment.id !== paymentId ||
      payment.order_id !== orderId ||
      payment.amount !== record.amount ||
      payment.currency !== record.currency ||
      payment.status !== "captured" ||
      Number(payment.amount_refunded) !== 0
    ) {
      return reply({
        error: "Payment not captured or mismatched"
      }, 409);
    }

    if (
      record.razorpay_payment_id &&
      record.razorpay_payment_id !== paymentId
    ) {
      return reply({
        error: "Order already linked to another payment"
      }, 409);
    }

    if (record.status === "created") {
      const { data: updated, error: updateError } =
        await db.from("chatlens_payments")
          .update({
            razorpay_payment_id: paymentId,
            status: "paid",
            verified_at: new Date().toISOString(),
          })
          .eq("id", record.id)
          .eq("status", "created")
          .is("razorpay_payment_id", null)
          .select("id")
          .maybeSingle();

      if (updateError || !updated) {
        return reply({
          error: "Verification conflict. Please retry."
        }, 409);
      }
    }

    return reply({
      success: true,
      verified: true,
      test_mode: true,
      payment_id: paymentId,
      order_id: orderId,
      amount: record.amount,
      currency: record.currency,
      detailed_analysis_available: false,
      message: "Sandbox payment verified. A test payment does not unlock a report.",
    });

  } catch {
    return reply({
      error: "Payment verification unavailable"
    }, 500);
  }
});
