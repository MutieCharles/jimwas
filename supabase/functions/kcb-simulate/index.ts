import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const body = await req.json();

    // body shape: { checkoutRequestId?, transactionReference?, phone?, amount?, simulateFor: 'till' | 'validation' }
    const now = new Date().toISOString();

    if (body.simulateFor === "validation") {
      // simulate a validation call to our validation endpoint (for local testing).
      const validationPayload = {
        requestId: body.requestId || `sim-${Date.now()}`,
        customerReference: body.customerReference || "SIM-INV-1",
        organizationReference: body.organizationReference || (Deno.env.get("DEFAULT_ORG_REF") ?? "777777"),
      };
      // invoke the function endpoint if deployed or persist a row to kcb_validations
      try {
        await supabase.from("kcb_validations").insert([{ request: validationPayload, response: { transactionID: `sim-${Date.now()}`, statusCode: "0", statusMessage: "Success", CustomerName: "Sim User", billAmount: (body.amount || "1.00"), currency: "KES", billType: "FIXED", creditAccountIdentifier: "SIMACC001" }, received_at: now }]);
      } catch (err) {
        console.debug("kcb_validations insert failed:", err?.message ?? err);
      }
      return new Response(JSON.stringify({ success: true, message: "Validation simulated" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const simulationPayload = {
      transactionReference: body.transactionReference || `FTSIM${Date.now()}`,
      requestId: body.requestId || `req-sim-${Date.now()}`,
      channelCode: body.channelCode || "202",
      timestamp: body.timestamp || now,
      transactionAmount: (body.amount || "100.00"),
      currency: body.currency || "KES",
      customerReference: body.customerReference || "SIM-INV-1",
      customerName: body.customerName || "Sim User",
      customerMobileNumber: body.customerMobileNumber || (body.phone || "254700000000"),
      balance: "1000.00",
      narration: body.narration || "Simulated payment",
      creditAccountIdentifier: body.creditAccountIdentifier || "SIMACC001",
      organizationShortCode: body.organizationShortCode || (Deno.env.get("DEFAULT_ORG_REF") ?? "777777"),
      tillNumber: body.tillNumber || "150150",
      simulated_at: now,
    };

    try {
      await supabase.from("kcb_notifications").insert([{ payload: simulationPayload, received_at: now }]);
    } catch (err) {
      console.debug("kcb_notifications insert failed:", err?.message ?? err);
    }

    // Optionally update a payment record (kcb_payments or mpesa_transactions) if checkoutRequestId given
    if (body.checkoutRequestId) {
      try {
        await supabase.from("kcb_payments").update({
          status: "paid",
          receipt: `SIMR${Date.now()}`,
          callback_received: true,
          updated_at: now
        }).eq("checkout_request_id", body.checkoutRequestId);
      } catch (err) {
        // ignore — table may not exist
        console.debug("kcb_payments update failed:", err?.message ?? err);
      }
    }

    return new Response(JSON.stringify({ success: true, payload: simulationPayload }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("kcb-simulate error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
