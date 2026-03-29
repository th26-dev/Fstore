import { auth } from '../models/firebaseConfig.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const cartItemsContainer = document.getElementById('cartItems');
    const totalPriceEl = document.getElementById('totalPrice');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const checkoutMsg = document.getElementById('checkoutMsg');
    
    const emptyCartView = document.getElementById('emptyCartView');
    const filledCartView = document.getElementById('filledCartView');

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
                emptyCartView.style.display = 'block';
                filledCartView.style.display = 'none';
            }
        }
    });

    const renderCart = () => {
        emptyCartView.style.display = 'none';
        filledCartView.style.display = 'block';

        let html = '';
        let total = 0;
        
        cartData.forEach((item, index) => {
            if (!item.quantity) item.quantity = 1;
            
            const itemTotalPrice = item.price * item.quantity;
            total += itemTotalPrice;

            html += `
                <div class="cart-item" style="display: flex; border-bottom: 1px solid #d2d2d7; padding: 30px 0;">
                    <img src="${item.image}" alt="${item.name}" class="cart-item-img" style="width: 120px; height: 120px; object-fit: contain; margin-right: 30px;">
                    <div class="cart-item-details" style="flex: 1; display: flex; justify-content: space-between;">
                        
                        <div class="cart-item-info">
                            <h3 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 600; color: #1d1d1f;">${item.name}</h3>
                            <p style="margin: 0; color: #86868b; font-size: 15px;">${item.color || ''} | ${item.storage || ''}</p>
                        </div>
                        
                        <div class="cart-item-actions" style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                            <div style="font-size: 22px; font-weight: 600; color: #1d1d1f; margin-bottom: 15px;">${formatPrice(item.price)}</div>
                            
                            <div class="qty-select-wrapper">
                                <select class="qty-select" data-index="${index}">
                                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option value="${n}" ${item.quantity === n ? 'selected' : ''}>${n}</option>`).join('')}
                                </select>
                            </div>

                            <button class="btn-remove remove-item" data-index="${index}" style="background: none; border: none; color: #0071e3; cursor: pointer; font-size: 15px; padding: 0; margin-top: 10px;">Xóa</button>
                        </div>

                    </div>
                </div>`;
        });
        
        cartItemsContainer.innerHTML = html;
        totalPriceEl.innerText = formatPrice(total);

        document.querySelectorAll('.qty-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const idx = e.target.dataset.index;
                const newQty = parseInt(e.target.value);
                
                cartData[idx].quantity = newQty; 
                localStorage.setItem(`cart_${userId}`, JSON.stringify(cartData)); 
                
                window.dispatchEvent(new Event('cartUpdated')); 
                
                renderCart(); 
            });
        });

        document.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.dataset.index;
                cartData.splice(idx, 1);
                localStorage.setItem(`cart_${userId}`, JSON.stringify(cartData));
                
                window.dispatchEvent(new Event('cartUpdated')); 
                
                if (cartData.length === 0) {
                    emptyCartView.style.display = 'block';
                    filledCartView.style.display = 'none';
                } else {
                    renderCart();
                }
            });
        });
    };

    checkoutBtn.addEventListener('click', async () => {
        const totalAmount = Math.round(cartData.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0));
        
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