import { auth, db } from '../models/firebaseConfig.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// Bổ sung thêm getDocs để truy vấn kho hàng
import { collection, doc, setDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js"; 

document.addEventListener('DOMContentLoaded', () => {
    // === CẤU HÌNH API KEY (Dùng chung với Chatbot) ===
    const API_KEY = "AQ.Ab8RN" + "6I3Ik59qVY7M" + "lzVyukCL2UYQIFytQwUgLMNUfdXI-cLUQ";

    const cartItemsContainer = document.getElementById('cartItems');
    const totalPriceEl = document.getElementById('totalPrice');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const checkoutMsg = document.getElementById('checkoutMsg');
    
    const emptyCartView = document.getElementById('emptyCartView');
    const filledCartView = document.getElementById('filledCartView');

    let cartData = [];
    let userId = null;
    let currentCartSignature = ""; // Biến theo dõi sự thay đổi cấu trúc giỏ hàng

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
                            <p>${item.color || ''} ${item.storage ? '| ' + item.storage : ''}</p>
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

        // Kích hoạt tính năng Gợi ý AI khi giỏ hàng được load
        triggerAIRecommendations();

        // Xử lý Sự kiện thay đổi số lượng
        document.querySelectorAll('.qty-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const idx = e.target.dataset.index;
                cartData[idx].quantity = parseInt(e.target.value); 
                localStorage.setItem(`cart_${userId}`, JSON.stringify(cartData)); 
                window.dispatchEvent(new Event('cartUpdated')); 
                renderCart(); 
            });
        });

        // Xử lý Sự kiện xóa sản phẩm
        document.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.dataset.index;
                cartData.splice(idx, 1);
                localStorage.setItem(`cart_${userId}`, JSON.stringify(cartData));
                window.dispatchEvent(new Event('cartUpdated')); 
                if (cartData.length === 0) {
                    emptyCartView.style.display = 'block';
                    filledCartView.style.display = 'none';
                    currentCartSignature = ""; // Reset chữ ký giỏ hàng
                } else {
                    renderCart();
                }
            });
        });
    };

    // =========================================================================
    // HỆ THỐNG AI GỢI Ý MUA KÈM (AI CROSS-SELLING ENGINE)
    // =========================================================================
    
    // Kiểm tra xem cấu trúc giỏ hàng có thay đổi không (để tránh gọi API thừa thãi)
    const triggerAIRecommendations = () => {
        const newSignature = cartData.map(item => item.id).sort().join(',');
        if (newSignature !== currentCartSignature && newSignature !== "") {
            currentCartSignature = newSignature;
            generateAIRecommendations();
        }
    };

    const generateAIRecommendations = async () => {
        const recSection = document.getElementById('ai-recommendation-section');
        const recLoader = document.getElementById('ai-recommendation-loader');
        const recList = document.getElementById('ai-recommendation-list');

        if (!recSection || cartData.length === 0) return;

        recSection.style.display = 'block';
        recLoader.style.display = 'block';
        recList.innerHTML = '';

        try {
            // 1. Lấy toàn bộ kho hàng từ Firebase
            const productsSnapshot = await getDocs(collection(db, "products"));
            let allProducts = [];
            productsSnapshot.forEach(doc => {
                allProducts.push({ id: doc.id, ...doc.data() });
            });

            // 2. Lấy danh sách ID đã có trong giỏ hàng (Để AI không gợi ý trùng)
            const cartIds = cartData.map(item => item.id);
            const cartNames = cartData.map(item => item.name).join(", ");

            // 3. Chuẩn bị danh mục tồn kho (Đã lọc bỏ các món đang nằm trong giỏ)
            const availableProducts = allProducts.filter(p => !cartIds.includes(p.id));
            if (availableProducts.length === 0) {
                recSection.style.display = 'none';
                return;
            }
            const catalogString = availableProducts.map(p => `{"id": "${p.id}", "name": "${p.name}"}`).join(", ");

            // 4. Viết System Prompt "Ép" AI phải suy luận và trả về mảng JSON ID
            const targetModel = "gemini-1.5-flash";
            const cleanApiKey = API_KEY.trim();
            const URL = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${cleanApiKey}`;
            
            const prompt = `Bạn là hệ thống AI phân tích hành vi người tiêu dùng và gợi ý bán chéo (Cross-sell) cho FStore.
            Khách hàng đang chuẩn bị thanh toán các món sau trong giỏ: [${cartNames}].
            Kho hàng phụ kiện và sản phẩm khác đang có: [${catalogString}].
            
            Nhiệm vụ: Phân tích ngữ cảnh và chọn ra TỐI ĐA 3 sản phẩm phù hợp nhất để bán kèm. (Logic: Khách mua bia -> bán mồi nhậu, ly; Khách mua điện thoại -> bán sạc, ốp lưng, tai nghe).
            Yêu cầu BẮT BUỘC: CHỈ ĐƯỢC trả về một mảng JSON thuần túy chứa ID của các sản phẩm. KHÔNG ĐƯỢC CÓ BẤT KỲ VĂN BẢN HAY GIẢI THÍCH NÀO KHÁC. KHÔNG DÙNG MARKDOWN.
            Ví dụ định dạng trả về: ["id_1", "id_2"]`;

            // 5. Gửi request ẩn cho Gemini
            const response = await fetch(URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();
            
            if (data.candidates && data.candidates.length > 0) {
                let aiText = data.candidates[0].content.parts[0].text.trim();
                
                // Dọn dẹp markdown nếu AI lỡ chèn vào
                aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
                
                // Parse JSON
                const recommendedIds = JSON.parse(aiText);
                const recommendedProducts = availableProducts.filter(p => recommendedIds.includes(p.id));

                recLoader.style.display = 'none';

                if(recommendedProducts.length === 0) {
                    recSection.style.display = 'none';
                    return;
                }

                // 6. Render giao diện các món được chọn
                recommendedProducts.forEach(prod => {
                    const defaultVariant = (prod.variants && prod.variants.length > 0) ? prod.variants[0] : {};
                    const basePrice = defaultVariant.price || prod.price || prod.basePrice || 0;
                    const discountPrice = basePrice * 0.9; // Giảm 10% khi mua kèm Deal
                    const imgUrl = defaultVariant.images ? defaultVariant.images[0] : (prod.image || "https://via.placeholder.com/150");

                    recList.innerHTML += `
                        <div style="background: #fff; padding: 15px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: center; border: 1px solid #e2e8f0; display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <img src="${imgUrl}" alt="${prod.name}" style="height: 120px; width: 100%; object-fit: contain; margin-bottom: 12px;">
                                <h4 style="font-size: 14px; color: #1e293b; margin: 0 0 8px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 38px;">${prod.name}</h4>
                            </div>
                            <div>
                                <p style="color: #ef4444; font-weight: bold; margin: 0 0 12px 0; font-size: 16px;">
                                    ${formatPrice(discountPrice)} 
                                    <span style="display:block; text-decoration: line-through; color: #94a3b8; font-size: 12px; font-weight: normal; margin-top: 4px;">
                                        ${formatPrice(basePrice)}
                                    </span>
                                </p>
                                <button class="btn-add-cart-deal" data-id="${prod.id}" data-name="${prod.name}" data-price="${discountPrice}" data-img="${imgUrl}" style="width: 100%; padding: 10px; background: #0ea5e9; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; transition: background 0.2s;">
                                    <i class="fa-solid fa-plus" style="margin-right: 5px;"></i> Chọn Mua
                                </button>
                            </div>
                        </div>
                    `;
                });

                // 7. Gắn sự kiện thêm món gợi ý vào Giỏ hàng
                document.querySelectorAll('.btn-add-cart-deal').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const btnEl = e.currentTarget;
                        const newProduct = {
                            id: btnEl.dataset.id,
                            name: btnEl.dataset.name,
                            price: parseFloat(btnEl.dataset.price),
                            image: btnEl.dataset.img,
                            quantity: 1,
                            color: "Flash Deal", // Gắn nhãn để phân biệt
                            storage: "Giảm giá mua kèm"
                        };

                        // Check xem nếu ấn Mua rồi thì chỉ tăng số lượng
                        const existingIndex = cartData.findIndex(item => item.id === newProduct.id);
                        if (existingIndex > -1) {
                            cartData[existingIndex].quantity += 1;
                        } else {
                            cartData.push(newProduct);
                        }

                        // Lưu và re-render
                        localStorage.setItem(`cart_${userId}`, JSON.stringify(cartData));
                        window.dispatchEvent(new Event('cartUpdated')); 
                        renderCart(); 

                        alert("Đã thêm Deal mua kèm vào giỏ hàng thành công!");
                    });
                });

            } else {
                recSection.style.display = 'none';
            }
        } catch (error) {
            console.error("Lỗi Engine AI Recommendation:", error);
            recSection.style.display = 'none';
        }
    };

    // =========================================================================

    checkoutBtn.addEventListener('click', async () => {
        if (!finalAddress) {
            alert("Bạn chưa chọn địa chỉ giao hàng! Vui lòng chọn trên bản đồ.");
            return;
        }

        const selectedPayment = document.querySelector('input[name="payment"]:checked').value;
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
                paymentMethod: selectedPayment, 
                createdAt: new Date()
            };
            
            await setDoc(doc(db, "orders", orderId), newOrder);
            localStorage.removeItem(`cart_${userId}`);

            if (selectedPayment === 'momo') {
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

            } else if (selectedPayment === 'zalopay') {
                localStorage.setItem('pending_zalopay_order_id', orderId);
                const orderInfo = cartData.map(item => item.name).join(', ');
                
                const response = await fetch('/api/zalopay', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        amount: totalAmount, 
                        orderInfo: orderInfo, 
                        orderId: orderId 
                    })
                });

                const data = await response.json();

                if (data.order_url) {
                    window.location.href = data.order_url; 
                } else {
                    throw new Error(data.error || "Lỗi tạo giao dịch ZaloPay");
                }
                
            } else {
                alert(`Phương thức thanh toán ${selectedPayment.toUpperCase()} đang được bảo trì.`);
                checkoutBtn.disabled = false;
                checkoutBtn.innerText = "Thanh Toán";
            }

        } catch (error) {
            checkoutMsg.style.display = "block";
            checkoutMsg.innerText = error.message;
            checkoutBtn.disabled = false;
            checkoutBtn.innerText = "Thanh Toán";
        }
    });
});