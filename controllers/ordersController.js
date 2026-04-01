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

    // --- FIX 2: BẮT KẾT QUẢ TỪ MOMO TRẢ VỀ ---
    const checkMoMoPaymentResult = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const pendingOrderId = localStorage.getItem('pending_momo_order_id');
        
        // Nếu có ID đơn hàng đang chờ và URL có chứa resultCode của MoMo
        if (pendingOrderId && urlParams.has('resultCode')) {
            const resultCode = urlParams.get('resultCode');
            const orderRef = doc(db, "orders", pendingOrderId);
            
            try {
                if (resultCode === '0') {
                    // Thanh toán thành công -> Đổi trạng thái thành Chờ duyệt
                    await updateDoc(orderRef, { status: "Chờ duyệt" });
                } else {
                    // Thanh toán thất bại hoặc hủy -> Đổi trạng thái thành Đã hủy
                    await updateDoc(orderRef, { status: "Đã hủy" });
                }
            } catch (error) {
                console.error("Lỗi cập nhật trạng thái đơn hàng từ MoMo: ", error);
            }
            
            // Xóa biến tạm sau khi xử lý xong
            localStorage.removeItem('pending_momo_order_id');
            
            // Xóa các tham số MoMo trên URL cho sạch đẹp (tuỳ chọn)
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    };

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'auth.html'; 
            return;
        }

        // Gọi hàm kiểm tra MoMo trước khi load danh sách đơn hàng
        await checkMoMoPaymentResult();

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
                
                if (statusText === "Chờ duyệt") statusClass = "status-pending"; // Màu vàng
                if (statusText === "Đang giao" || statusText === "Shipped") statusClass = "status-shipping"; // Màu xanh dương
                if (statusText === "Hoàn thành" || statusText === "Completed") statusClass = "status-completed"; // Màu xanh lá
                if (statusText === "Đã hủy" || statusText === "Cancelled") statusClass = "status-cancelled"; // Màu đỏ

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

                html += `
                    <div class="order-card">
                        <div class="order-header">
                            <div class="order-info" style="flex: 1; padding-right: 15px;">
                                <h3>Mã đơn: #${order.orderId || order.docId.substring(0,8).toUpperCase()}</h3>
                                <p>Ngày đặt: ${formatDate(order.createdAt)}</p>
                                ${addressHTML} </div>
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