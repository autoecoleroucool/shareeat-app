import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PushPayload {
  user_id: string;
  title: string;
  body: string;
  icon?: string;
  image?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

function base64UrlToUint8Array(base64UrlString: string): Uint8Array {
  const padding = "=".repeat((4 - (base64UrlString.length % 4)) % 4);
  const base64 = base64UrlString.replace(/-/g, "+").replace(/_/g, "/") + padding;
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
  return btoa(String.fromCharCode(...uint8Array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function generateVAPIDToken(audience: string, subject: string, publicKey: string, privateKeyB64: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 12 * 60 * 60;

  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify({ aud: new URL(audience).origin, exp, sub: subject })));
  const signingInput = `${headerB64}.${payloadB64}`;

  const privateKeyBytes = base64UrlToUint8Array(privateKeyB64);
  const privateKeyObj = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKeyObj,
    new TextEncoder().encode(signingInput)
  );

  const signatureB64 = uint8ArrayToBase64Url(new Uint8Array(signatureBuffer));
  return `${signingInput}.${signatureB64}`;
}

async function encryptPayload(
  payload: string,
  p256dh: string,
  authSecret: string
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const clientPublicKey = base64UrlToUint8Array(p256dh);
  const clientAuthSecret = base64UrlToUint8Array(authSecret);

  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeyPair.publicKey));

  const clientPublicKeyObj = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPublicKeyObj },
    serverKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const prk2 = await crypto.subtle.importKey("raw", sharedSecret, { name: "HKDF" }, false, ["deriveBits"]);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: clientAuthSecret, info: new TextEncoder().encode("Content-Encoding: auth\0") },
    prk2,
    256
  ));

  const ikmKey = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);

  const context = new Uint8Array([
    ...new TextEncoder().encode("P-256\0"),
    0, 65, ...clientPublicKey,
    0, 65, ...serverPublicKeyRaw,
  ]);

  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: new Uint8Array([...new TextEncoder().encode("Content-Encoding: aesgcm\0"), ...context]) },
    ikmKey,
    128
  );
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: new Uint8Array([...new TextEncoder().encode("Content-Encoding: nonce\0"), ...context]) },
    ikmKey,
    96
  );

  const cek = await crypto.subtle.importKey("raw", cekBits, { name: "AES-GCM" }, false, ["encrypt"]);
  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 2);
  paddedPayload.set(payloadBytes, 2);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonceBits },
    cek,
    paddedPayload
  );

  return { encrypted: new Uint8Array(encryptedBuffer), salt, serverPublicKey: serverPublicKeyRaw };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "BPBfUKbjVjqo-t3lmeG3L3HWnJL5gtZiAnBS1BVU-Nd47iK2xyteV2GLJaT1WfA4Md8w54zpyPErjkL8jNpiS0g";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgkFBXniFuLfKEfKSl0nnqg53Hk3IqOqGLT0YBe-lPE9-hRANCAATwX1Cm41Y6qPrd5Znhty9x1pyS-YLWYgJwUtQVVPjXeO4itscrXldhiyWk9VnwODHfMOeM6cjxK45C_IzaYktI";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const body = await req.json() as PushPayload;
    const { user_id, title, body: notifBody, icon, image, tag, data } = body;

    if (!user_id || !title || !notifBody) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pushPayload = JSON.stringify({
      title,
      body: notifBody,
      icon: icon || "/Logo_ShareEat_eco_et_alimentation.png",
      badge: "/Logo_ShareEat_eco_et_alimentation.png",
      image,
      tag: tag || "shareeat",
      data: data || {},
    });

    let sent = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions as { endpoint: string; p256dh: string; auth: string }[]) {
      try {
        const { encrypted, salt, serverPublicKey } = await encryptPayload(pushPayload, sub.p256dh, sub.auth);
        const token = await generateVAPIDToken(sub.endpoint, "mailto:shareeat@shareeat.app", vapidPublicKey, vapidPrivateKey);

        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            Authorization: `vapid t=${token}, k=${vapidPublicKey}`,
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aesgcm",
            Encryption: `salt=${uint8ArrayToBase64Url(salt)}`,
            "Crypto-Key": `dh=${uint8ArrayToBase64Url(serverPublicKey)}`,
            TTL: "86400",
          },
          body: encrypted,
        });

        if (response.ok || response.status === 201) {
          sent++;
        } else if (response.status === 404 || response.status === 410) {
          expiredEndpoints.push(sub.endpoint);
        }
      } catch {
        // ignore individual send failures
      }
    }

    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }

    return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
