export async function onRequestPost(context) {
    try {
        if (!context.env.MOMO_PARTNER_CODE || !context.env.MOMO_SECRET_KEY) {
            throw new Error("Lỗi Server: Cloudflare chưa nạp được Biến môi trường. Vui lòng kiểm tra lại Settings!");
        }

        const body = await context.request.json();
        const amountNum = Number(body.amount); 
        const amountStr = amountNum.toString(); 
        
        const partnerCode = context.env.MOMO_PARTNER_CODE.trim();
        const accessKey = context.env.MOMO_ACCESS_KEY.trim();
        const secretKey = context.env.MOMO_SECRET_KEY.trim();
        const endpoint = "https://test-payment.momo.vn/v2/gateway/api/create";
        
        const url = new URL(context.request.url);
        const domain = url.origin;

        const orderId = "FSTORE_" + Date.now();
        const requestId = orderId;
        const orderInfo = "Thanh toan don hang FStore";
        const redirectUrl = `${domain}/success.html`;
        const ipnUrl = `${domain}/api/webhook`;
        const requestType = "captureWallet";
        const extraData = "";

        const rawSignature = `accessKey=${accessKey}&amount=${amountStr}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

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
                partnerCode, accessKey, requestId, amount: amountNum, orderId, orderInfo,
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