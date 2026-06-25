import { auth, db } from '../models/firebaseConfig.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// Đã thay đổi import để dùng doc và setDoc
import { collection, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js"; 

document.addEventListener('DOMContentLoaded', () => {
    const cartItemsContainer = document.getElementById('cartItems');
    const totalPriceEl = document.getElementById('totalPrice');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const checkoutMsg = document.getElementById('checkoutMsg');
    
    const emptyCartView = document.getElementById('emptyCartView');
    const filledCartView = document.getElementById('filledCartView');

    let cartData = [];
    let userId = null;

    let map = null;
    let marker = null;
    let finalAddress = localStorage.getItem('fstore_delivery_address') || null;

    const currentAddressText = document.getElementById('currentAddressText');
    const detailAddressInput = document.getElementById('detailAddressInput');
    const mapModal = document.getElementById('mapModal');
    
    if (finalAddress) currentAddressText.innerText = finalAddress;

    async function getAddressFromCoords(lat, lng) {
        detailAddressInput.value = "Đang tìm địa chỉ...";
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
            const data = await response.json();
            if (data && data.display_name) {
                detailAddressInput.value = data.display_name;
            }
        } catch (error) {
            detailAddressInput.value = "Không thể định vị, vui lòng nhập tay.";
        }
    }

    document.getElementById('btnOpenMap').addEventListener('click', () => {
        mapModal.classList.add('active');
        setTimeout(() => {
            if (!map) {
                map = L.map('deliveryMap').setView([10.7769, 106.6951], 15);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors'
                }).addTo(map);

                marker = L.marker([10.7769, 106.6951], {draggable: true}).addTo(map);

                marker.on('dragend', function () {
                    const coords = marker.getLatLng();
                    getAddressFromCoords(coords.lat, coords.lng);
                });

                map.on('click', function(e) {
                    marker.setLatLng(e.latlng);
                    getAddressFromCoords(e.latlng.lat, e.latlng.lng);
                });
            } else {
                map.invalidateSize(); 
            }
        }, 300);
    });

    document.getElementById('closeMapModal').addEventListener('click', () => {
        mapModal.classList.remove('active');
    });

    document.getElementById('btnConfirmAddress').addEventListener('click', () => {
        const addr = detailAddressInput.value.trim();
        if (addr && addr !== "Đang tìm địa chỉ...") {
            finalAddress = addr;
            currentAddressText.innerText = finalAddress;
            localStorage.setItem('fstore_delivery_address', finalAddress);
            mapModal.classList.remove('active');
        } else {
            alert("Vui lòng nhập hoặc chọn một địa chỉ hợp lệ!");
        }
    });

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
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}" class="cart-item-img">
                    <div class="cart-item-details">
                        <div class="cart-item-info">
                            <h3>${item.name}</h3>
                            <p>${item.color || ''} | ${item.storage || ''}</p>
                        </div>
                        <div class="cart-item-actions" style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                            <div style="font-size: 22px; font-weight: 600; color: #1d1d1f; margin-bottom: 15px;">${formatPrice(item.price)}</div>
                            <div class="qty-select-wrapper">
                                <select class="qty-select" data-index="${index}">
                                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option value="${n}" ${item.quantity === n ? 'selected' : ''}>${n}</option>`).join('')}
                                </select>
                            </div>
                            <button class="btn-remove remove-item" data-index="${index}">Xóa</button>
                        </div>
                    </div>
                </div>`;
        });
        
        cartItemsContainer.innerHTML = html;
        totalPriceEl.innerText = formatPrice(total);

        document.querySelectorAll('.qty-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const idx = e.target.dataset.index;
                cartData[idx].quantity = parseInt(e.target.value); 
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
        if (!finalAddress) {
            alert("Bạn chưa chọn địa chỉ giao hàng! Vui lòng chọn trên bản đồ.");
            return;
        }

        const totalAmount = Math.round(cartData.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0));
        
        checkoutBtn.innerText = "Đang xử lý...";
        checkoutBtn.disabled = true;

        try {
            const orderId = "FSTORE_" + Date.now();

            const newOrder = {
                userId: userId,
                items: cartData,
                totalAmount: totalAmount, 
                deliveryAddress: finalAddress, 
                status: "Chờ thanh toán",
                createdAt: new Date()
            };
            
            await setDoc(doc(db, "orders", orderId), newOrder);

            localStorage.removeItem(`cart_${userId}`);

            const response = await fetch('/api/pay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: totalAmount, orderId: orderId })
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