export async function onRequest(context) {
    if (context.request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Chỉ chấp nhận phương thức POST" }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const appId = "2553";
        const key1 = "PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL";
        const endpoint = "https://sb-openapi.zalopay.vn/v2/create";

        const requestData = await context.request.json();
        const { amount, orderInfo, orderId } = requestData;

        const url = new URL(context.request.url);
        const domain = url.origin;

        const transID = Math.floor(Math.random() * 1000000);
        const date = new Date();
        const yymmdd = String(date.getFullYear()).slice(-2) + 
                       String(date.getMonth() + 1).padStart(2, '0') + 
                       String(date.getDate()).padStart(2, '0');

        const app_trans_id = `${yymmdd}_${transID}`;
        const app_time = Date.now();
        
        let safeOrderInfo = orderInfo || "Sản phẩm FStore";
        if (safeOrderInfo.length > 50) {
            safeOrderInfo = safeOrderInfo.substring(0, 47) + "..."; 
        }
        
        const item = JSON.stringify([{ itemname: safeOrderInfo, itemprice: amount, itemquantity: 1 }]);
        
        const embed_data = JSON.stringify({ 
            redirecturl: `${domain}/success.html` 
        });

        const safeDescription = `FStore - Thanh toan don hang #${orderId}`.replace(/[^\w\s-]/g, '');

        const dataString = `${appId}|${app_trans_id}|FStore_User|${amount}|${app_time}|${embed_data}|${item}`;

        const encoder = new TextEncoder();
        const keyData = encoder.encode(key1);
        const msgData = encoder.encode(dataString);
        
        const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
        
        const hashArray = Array.from(new Uint8Array(signatureBuffer));
        const mac = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const orderBody = {
            app_id: Number(appId),
            app_trans_id: app_trans_id,
            app_user: "FStore_User",
            app_time: app_time,
            item: item,
            embed_data: embed_data,
            amount: Number(amount),
            description: safeDescription, 
            bank_code: "", 
            mac: mac,
            callback_url: `${domain}/` // Mẹo: Trỏ về trang chủ để ZaloPay luôn nhận được mã 200 OK
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderBody)
        });

        const result = await response.json();

        return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}