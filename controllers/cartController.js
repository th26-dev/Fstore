import { auth } from '../models/firebaseConfig.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const cartItemsContainer = document.getElementById('cartItems');
    const totalPriceEl = document.getElementById('totalPrice');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const checkoutMsg = document.getElementById('checkoutMsg');
    
    // Giao diện ẩn/hiện Apple Style
    const emptyCartView = document.getElementById('emptyCartView');
    const filledCartView = document.getElementById('filledCartView');

    let cartData = [];
    let userId = null;

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

    // Kích hoạt khi kiểm tra Auth thành công
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = 'auth.html';
        } else {
            userId = user.uid;
            const savedCart = localStorage.getItem(`cart_${userId}`);
            
            if (savedCart && JSON.parse(savedCart).length > 0) {
                cartData = JSON.parse(savedCart);
                renderCart(); // Có hàng -> Chạy hàm render
            } else {
                // Giỏ hàng trống -> Hiện Empty View
                emptyCartView.style.display = 'block';
                filledCartView.style.display = 'none';
            }
        }
    });

    const renderCart = () => {
        // Hiện giao diện có hàng
        emptyCartView.style.display = 'none';
        filledCartView.style.display = 'block';

        let html = '';
        let total = 0;
        
        cartData.forEach((item, index) => {
            total += item.price;
            html += `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}" class="cart-item-img">
                    <div class="cart-item-details">
                        <div class="cart-item-info">
                            <h3>${item.name}</h3>
                            <p>${item.color || ''} | ${item.storage || ''}</p>
                        </div>
                        <div class="cart-item-price-wrap">
                            <div class="cart-item-price">${formatPrice(item.price)}</div>
                            <button class="btn-remove remove-item" data-index="${index}">Xóa</button>
                        </div>
                    </div>
                </div>`;
        });
        
        cartItemsContainer.innerHTML = html;
        totalPriceEl.innerText = formatPrice(total);

        // Lắng nghe sự kiện Xóa sản phẩm
        document.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.dataset.index;
                cartData.splice(idx, 1);
                localStorage.setItem(`cart_${userId}`, JSON.stringify(cartData));
                location.reload(); // Load lại trang để cập nhật logic
            });
        });
    };

    // Logic thanh toán API (Giữ nguyên gốc)
    checkoutBtn.addEventListener('click', async () => {
        const totalAmount = Math.round(cartData.reduce((sum, item) => sum + item.price, 0));
        
        checkoutBtn.innerText = "Đang tạo mã QR MoMo...";
        checkoutBtn.disabled = true;

        try {
            const response = await fetch('/api/pay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: totalAmount })
            });

            const data = await response.json();

            if (data.url) {
                window.location.href = data.url; 
            } else {
                throw new Error(data.error || "Lỗi tạo giao dịch MoMo");
            }
        } catch (error) {
            checkoutMsg.style.display = "block";
            checkoutMsg.innerText = error.message;
            checkoutBtn.disabled = false;
            checkoutBtn.innerText = "Thanh Toán";
        }
    });
});