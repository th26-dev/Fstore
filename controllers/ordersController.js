import { db, auth } from '../models/firebaseConfig.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'auth.html'; 
            return;
        }

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
                let statusText = order.status || "Chờ duyệt";
                
                if (statusText === "Đang giao" || statusText === "Shipped") statusClass = "status-shipping";
                if (statusText === "Hoàn thành" || statusText === "Completed") statusClass = "status-completed";
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

                html += `
                    <div class="order-card">
                        <div class="order-header">
                            <div class="order-info">
                                <h3>Mã đơn: #${order.orderId || order.docId.substring(0,8).toUpperCase()}</h3>
                                <p>Ngày đặt: ${formatDate(order.createdAt)}</p>
                            </div>
                            <div class="order-status ${statusClass}">${statusText}</div>
                        </div>
                        
                        <div class="order-items">
                            ${itemsHtml}
                        </div>
                        
                        <div class="order-footer">
                            <span style="color: #86868b; font-size: 14px;">Tổng thanh toán:</span>
                            <span class="order-total-price">${formatPrice(order.totalAmount || 0)}</span>
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