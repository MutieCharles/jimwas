import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const body = await req.json();

    console.log('KCB IPN (TILL) received:', JSON.stringify(body));

    // Expected fields (from spec): transactionReference, requestId, channelCode, timestamp,
    // transactionAmount, currency, customerReference, customerName, customerMobileNumber,
    // balance, narration, creditAccountIdentifier, organizationShortCode, tillNumber

    const required = [
      'transactionReference', 'requestId', 'transactionAmount', 'currency', 'customerReference'
    ];

    for (const f of required) {
      if (!body[f]) {
        console.warn(`Missing field ${f} in KCB IPN (TILL)`);
      }
    }

    // Try to persist notification to kcb_notifications (best-effort). If table doesn't exist, ignore.
    try {
      await supabase.from('kcb_notifications').insert([{ ...body, received_at: new Date().toISOString() }]);
    } catch (err) {
      console.debug('Could not insert into kcb_notifications (table may not exist):', err?.message ?? err);
    }

    // Respond with acknowledgement expected by KCB
    const response = {
      transactionID: String(Date.now()),
      statusCode: 0,
      statusMessage: 'Notification received',
    };

    return new Response(JSON.stringify(response), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error('KCB IPN (TILL) handler error:', error);
    return new Response(
      JSON.stringify({ ResultCode: 1, ResultDesc: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
