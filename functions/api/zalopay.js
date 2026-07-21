import { db, auth } from '../models/firebaseConfig.js';
import { collection, getDocs, query, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const ordersListContainer = document.getElementById('ordersListContainer');

    const formatPrice = (price) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return "Không rõ thời gian";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' });
    };

    const checkMoMoPaymentResult = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const pendingOrderId = localStorage.getItem('pending_momo_order_id');
        
        if (pendingOrderId && urlParams.has('resultCode')) {
            const resultCode = urlParams.get('resultCode');
            const orderRef = doc(db, "orders", pendingOrderId);
            
            try {
                if (resultCode === '0') {
                    await updateDoc(orderRef, { status: "Đã thanh toán" });
                } else {
                    await updateDoc(orderRef, { status: "Đã hủy" });
                }
            } catch (error) {
                console.error("Lỗi cập nhật trạng thái đơn hàng từ MoMo: ", error);
            }
            
            localStorage.removeItem('pending_momo_order_id');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    };

    const checkZaloPayPaymentResult = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const pendingOrderId = localStorage.getItem('pending_zalopay_order_id');
        
        if (pendingOrderId && urlParams.has('status')) {
            const status = urlParams.get('status');
            const orderRef = doc(db, "orders", pendingOrderId);
            
            try {
                if (status === '1') {
                    await updateDoc(orderRef, { status: "Đã thanh toán" });
                } else {
                    await updateDoc(orderRef, { status: "Đã hủy" });
                }
            } catch (error) {
                console.error("Lỗi cập nhật trạng thái đơn hàng từ ZaloPay: ", error);
            }
            
            localStorage.removeItem('pending_zalopay_order_id');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    };

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'auth.html'; 
            return;
        }

        await checkMoMoPaymentResult();
        await checkZaloPayPaymentResult();

        try {
            const q = query(collection(db, "orders"), where("userId", "==", user.uid));
            const snapshot = await getDocs(q);
            
            let orders = [];
            snapshot.forEach(doc => {
                let data = doc.data();
                data.docId = doc.id;
                orders.push(data);
            });

            orders.sort((a, b) => {
                const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                return timeB - timeA;
            });

            if (orders.length === 0) {
                ordersListContainer.innerHTML = `
                    <div class="empty-orders">
                        <i class="fa-solid fa-box-open"></i>
                        <h3>Bạn chưa có đơn hàng nào</h3>
                        <p>Hãy dạo quanh cửa hàng và chọn cho mình sản phẩm ưng ý nhé.</p>
                        <a href="index.html">Tiếp tục mua sắm &rarr;</a>
                    </div>
                `;
                return;
            }

            let html = '';
            orders.forEach(order => {
                let statusClass = "status-pending";
                let statusText = order.status || "Chờ thanh toán";
                
                if (statusText === "Chờ duyệt" || statusText === "Chờ thanh toán") statusClass = "status-pending"; 
                if (statusText === "Đang giao" || statusText === "Shipped") statusClass = "status-shipping"; 
                if (statusText === "Đã thanh toán" || statusText === "Hoàn thành" || statusText === "Completed") statusClass = "status-completed"; 
                if (statusText === "Đã hủy" || statusText === "Cancelled") statusClass = "status-cancelled"; 

                let itemsHtml = '';
                if (order.items && order.items.length > 0) {
                    order.items.forEach(item => {
                        itemsHtml += `
                            <div class="order-item">
                                <img src="${item.image || 'https://via.placeholder.com/60'}" alt="${item.name}">
                                <div class="item-details">
                                    <h4>${item.name}</h4>
                                    <p>Phân loại: ${item.color} - ${item.storage} x${item.quantity || 1}</p>
                                </div>
                                <div class="item-price">${formatPrice((item.price || 0) * (item.quantity || 1))}</div>
                            </div>
                        `;
                    });
                }

                const addressHTML = order.deliveryAddress 
                    ? `<p style="margin-top: 8px; font-weight: 500; color: #1d1d1f;"><i class="fa-solid fa-location-dot" style="color: #0071e3; margin-right: 5px;"></i> ${order.deliveryAddress}</p>` 
                    : `<p style="margin-top: 8px; font-style: italic; color: #86868b;">Chưa cập nhật địa chỉ giao hàng</p>`;

                let paymentMethodName = "Không xác định";
                if (order.paymentMethod === "momo") paymentMethodName = "Ví MoMo";
                else if (order.paymentMethod === "zalopay") paymentMethodName = "ZaloPay";
                else if (order.paymentMethod === "vnpay") paymentMethodName = "VNPay";
                else if (order.paymentMethod === "cod") paymentMethodName = "Thanh toán khi nhận hàng (COD)";

                const paymentHTML = `<p style="margin-top: 4px; font-size: 14px; color: #86868b;"><i class="fa-solid fa-credit-card" style="margin-right: 5px;"></i> Phương thức thanh toán: <strong style="color: #1d1d1f;">${paymentMethodName}</strong></p>`;

                html += `
                    <div class="order-card">
                        <div class="order-header">
                            <div class="order-info" style="flex: 1; padding-right: 15px;">
                                <h3>Mã đơn: #${order.orderId || order.docId}</h3>
                                <p>Ngày đặt: ${formatDate(order.createdAt)}</p>
                                ${addressHTML}
                                ${paymentHTML}
                            </div>
                            <div class="order-status ${statusClass}">${statusText}</div>
                        </div>
                        
                        <div class="order-items">
                            ${itemsHtml}
                        </div>
                        
                        <div class="order-footer">
                            <span style="color: #86868b; font-size: 14px;">Tổng thanh toán:</span>
                            <span class="order-total-price">${formatPrice(order.totalAmount || order.totalPrice || 0)}</span>
                        </div>
                    </div>
                `;
            });

            ordersListContainer.innerHTML = html;

        } catch (error) {
            console.error("Lỗi khi tải đơn hàng:", error);
            ordersListContainer.innerHTML = `<div style="text-align: center; color: red;">Có lỗi xảy ra khi tải dữ liệu. Vui lòng thử lại sau.</div>`;
        }
    });
});

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
        
        // =========================================================================
        // SỬA LỖI Ở ĐÂY: Giới hạn độ dài và định dạng lại item
        // =========================================================================
        let safeOrderInfo = orderInfo || "Sản phẩm FStore";
        if (safeOrderInfo.length > 50) {
            safeOrderInfo = safeOrderInfo.substring(0, 47) + "..."; // Cắt bớt nếu quá dài
        }
        
        const item = JSON.stringify([{ itemname: safeOrderInfo, itemprice: amount, itemquantity: 1 }]);
        
        const embed_data = JSON.stringify({ 
            redirecturl: `${domain}/orders.html` 
        });

        // Xóa các ký tự có thể gây lỗi trong description
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
            description: safeDescription, // Sử dụng safeDescription
            bank_code: "", // Đổi thành chuỗi rỗng để tự động chọn cổng
            mac: mac
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