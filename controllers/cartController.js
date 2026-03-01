import { auth } from '../models/firebaseConfig.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const cartItemsContainer = document.getElementById('cartItems');
    const totalPriceEl = document.getElementById('totalPrice');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const checkoutMsg = document.getElementById('checkoutMsg');

    let cartData = [];
    let userId = null;

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = 'auth.html';
        } else {
            userId = user.uid;
            const savedCart = localStorage.getItem(`cart_${userId}`);
            if (savedCart && JSON.parse(savedCart).length > 0) {
                cartData = JSON.parse(savedCart);
                renderCart();
            } else {
                cartItemsContainer.innerHTML = '<p style="text-align:center; padding:50px;">Giỏ hàng trống.</p>';
                checkoutBtn.disabled = true;
            }
        }
    });

    const renderCart = () => {
        let html = '';
        let total = 0;
        cartData.forEach((item, index) => {
            total += item.price;
            html += `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}">
                    <div class="item-info">
                        <h3>${item.name}</h3>
                        <p>${item.color} | ${item.storage}</p>
                        <button class="remove-item" data-index="${index}" style="color:#ff3b30; cursor:pointer; background:none; border:none; margin-top:10px;">Xóa</button>
                    </div>
                    <div class="item-price">${formatPrice(item.price)}</div>
                </div>`;
        });
        cartItemsContainer.innerHTML = html;
        totalPriceEl.innerText = formatPrice(total);

        document.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.dataset.index;
                cartData.splice(idx, 1);
                localStorage.setItem(`cart_${userId}`, JSON.stringify(cartData));
                location.reload();
            });
        });
    };

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
            checkoutBtn.innerText = "Tiến hành thanh toán";
        }
    });
});