export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        const amount = body.amount.toString();
        
        const partnerCode = context.env.MOMO_PARTNER_CODE;
        const accessKey = context.env.MOMO_ACCESS_KEY;
        const secretKey = context.env.MOMO_SECRET_KEY;
        const endpoint = "https://test-payment.momo.vn/v2/gateway/api/create";
        const domain = "https://friendshipstore.pages.dev";

        const orderId = "APPLE_" + Date.now();
        const requestId = orderId;
        const orderInfo = "Thanh toan don hang Apple Store";
        const redirectUrl = `${domain}/success.html`;
        const ipnUrl = `${domain}/api/webhook`;
        const requestType = "captureWallet";
        const extraData = "";

        const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

        const encoder = new TextEncoder();
        const keyData = encoder.encode(secretKey);
        const messageData = encoder.encode(rawSignature);
        const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
        const signature = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                partnerCode, accessKey, requestId, amount, orderId, orderInfo,
                redirectUrl, ipnUrl, extraData, requestType, signature, lang: "vi"
            })
        });

        const result = await response.json();
        return new Response(JSON.stringify({ url: result.payUrl, error: result.message }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { "Content-Type": "application/json" }
        });
    }
}