export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        const { amount } = body;

        // THÔNG SỐ TỪ DASHBOARD CỦA BẠN
        const partnerCode = "MOMOQFSH20250717_TEST";
        const accessKey = "m1rfCAFskm5T7ec6";
        const secretKey = "JSyZ4UGLYE5IEX1oZIOTJwVvTtVPz4G2";
        const endpoint = "https://test-payment.momo.vn/v2/gateway/api/create"; //

        const orderId = "APPLE_" + Date.now();
        const requestId = orderId;
        const orderInfo = "Thanh toán đơn hàng Apple Store";
        const redirectUrl = "https://your-domain.pages.dev/success.html";
        const ipnUrl = "https://your-domain.pages.dev/api/webhook";
        const requestType = "captureWallet";
        const extraData = ""; // Để chuỗi rỗng để khớp với thông báo lỗi của bạn

        // CHUỖI GỐC PHẢI SẮP XẾP THEO THỨ TỰ BẢNG CHỮ CÁI
        const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

        // TẠO CHỮ KÝ HMAC SHA256
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secretKey);
        const messageData = encoder.encode(rawSignature);
        
        const cryptoKey = await crypto.subtle.importKey(
            "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
        );
        const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
        const signature = Array.from(new Uint8Array(signatureBuffer))
            .map(b => b.toString(16).padStart(2, '0')).join('');

        // GỬI JSON (Dữ liệu phải khớp chính xác với rawSignature)
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                partnerCode, accessKey, requestId, amount, orderId, orderInfo,
                redirectUrl, ipnUrl, extraData, requestType, signature, lang: "vi"
            })
        });

        const result = await response.json();

        // Trả về JSON để Frontend không bị lỗi 'Unexpected end of JSON input'
        return new Response(JSON.stringify({ url: result.payUrl, error: result.message }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { "Content-Type": "application/json" }
        });
    }
}