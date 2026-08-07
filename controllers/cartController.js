import { auth, db } from '../models/firebaseConfig.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, doc, setDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js"; 

document.addEventListener('DOMContentLoaded', () => {
    const API_KEY = "AQ.Ab8RN6IqPCRc4fNYVX4TUfA_-hngxuQP4M6fzTDEDCtB1AETwQ";

    const cartItemsContainer = document.getElementById('cartItems');
    const totalPriceEl = document.getElementById('totalPrice');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const checkoutMsg = document.getElementById('checkoutMsg');
    
    const emptyCartView = document.getElementById('emptyCartView');
    const filledCartView = document.getElementById('filledCartView');

    let cartData = [];
    let userId = null;
    let userEmail = ""; 
    let userName = "";  
    let currentCartSignature = ""; 

    let recommendedProductData = null; 
    const chkBuyUpsell = document.getElementById('chkBuyUpsell');

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
            userEmail = user.email; 
            userName = user.displayName || "Quý khách"; 

            const savedCart = localStorage.getItem(`cart_${userId}`);
            
            if (savedCart && JSON.parse(savedCart).length > 0) {
                cartData = JSON.parse(savedCart);
                renderCart(); 
            } else {
                emptyCartView.style.display = 'block';
                filledCartView.style.display = 'none';
                document.getElementById('aiUpsellBox').style.display = 'none';
            }
        }
    });

    const updateTotalPriceDisplay = () => {
        let total = cartData.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
        if (chkBuyUpsell && chkBuyUpsell.checked && recommendedProductData) {
            total += recommendedProductData.discountPrice;
        }
        totalPriceEl.innerText = formatPrice(total);
    };

    if (chkBuyUpsell) {
        chkBuyUpsell.addEventListener('change', updateTotalPriceDisplay);
    }

    const renderCart = () => {
        emptyCartView.style.display = 'none';
        filledCartView.style.display = 'block';

        let html = '';
        cartData.forEach((item, index) => {
            if (!item.quantity) item.quantity = 1;
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
        if (chkBuyUpsell) chkBuyUpsell.checked = false; 
        updateTotalPriceDisplay();
        triggerAIRecommendations();

        document.querySelectorAll('.qty-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const idx = e.target.dataset.index;
                cartData[idx].quantity = parseInt(e.target.value); 
                localStorage.setItem(`cart_${userId}`, JSON.stringify(cartData)); 
                updateTotalPriceDisplay(); 
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
                    document.getElementById('aiUpsellBox').style.display = 'none';
                    currentCartSignature = ""; 
                } else {
                    renderCart();
                }
            });
        });
    };

    const triggerAIRecommendations = () => {
        const newSignature = cartData.map(item => item.id).sort().join(',');
        if (newSignature !== currentCartSignature && newSignature !== "") {
            currentCartSignature = newSignature;
            generateAIRecommendations();
        }
    };

    const generateAIRecommendations = async () => {
        const upsellBox = document.getElementById('aiUpsellBox');
        if (!upsellBox || cartData.length === 0) return;
        upsellBox.style.display = 'none';

        try {
            const productsSnapshot = await getDocs(collection(db, "products"));
            let allProducts = [];
            productsSnapshot.forEach(doc => { allProducts.push({ id: doc.id, ...doc.data() }); });

            const cartIds = cartData.map(item => item.id);
            const cartNames = cartData.map(item => item.name).join(", ");
            const availableProducts = allProducts.filter(p => !cartIds.includes(p.id));
            if (availableProducts.length === 0) return;

            const catalogString = availableProducts.map(p => `{"id": "${p.id}", "name": "${p.name}"}`).join(", ");
            const crossSellKeywords = ['thùng đá', 'thùng', 'ly', 'khô mực', 'snack', 'đá'];
            let fallbackCandidates = availableProducts.filter(p => crossSellKeywords.some(kw => p.name.toLowerCase().includes(kw)));

            if (fallbackCandidates.length === 0) fallbackCandidates = availableProducts;

            const randomFallbackProduct = fallbackCandidates[Math.floor(Math.random() * fallbackCandidates.length)];
            let aiResultId = randomFallbackProduct.id;
            const fakeAiReasons = [
                "Trí tuệ nhân tạo gợi ý: Thêm món phụ kiện này sẽ làm cho trải nghiệm đồ uống của bạn tuyệt hảo hơn!",
                "Phân tích giỏ hàng: Sản phẩm này cực kỳ phù hợp để dùng kèm với các món bạn vừa chọn.",
                "Gợi ý thông minh: Hầu hết khách hàng mua đồ uống đều mua kèm sản phẩm này để cuộc vui trọn vẹn."
            ];
            let aiReason = fakeAiReasons[Math.floor(Math.random() * fakeAiReasons.length)];
            
            try {
                const targetModel = "gemini-1.5-flash";
                const URL = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${API_KEY.trim()}`;
                const prompt = `Bạn là hệ thống tư vấn bán chéo (Cross-sell) thông minh. Giỏ hàng của khách: [${cartNames}]. Danh sách Kho hàng: [${catalogString}]. QUY TẮC BẮT BUỘC: 1. Khách đang mua Bia/Rượu -> TUYỆT ĐỐI KHÔNG gợi ý thêm Bia/Rượu. 2. Ưu tiên tìm các sản phẩm có từ khóa "Thùng", "Thùng đá", "Đá", "Ly", "Mực", "Snack" trong Danh sách Kho hàng để gợi ý. Hãy chọn ra ĐÚNG 1 ID sản phẩm trong Danh sách Kho hàng phù hợp nhất để bán kèm. Viết 1 lý do (ngắn gọn khoảng 15 chữ) giải thích vì sao nên mua kèm món này. CHỈ ĐƯỢC trả về JSON theo định dạng sau: {"id": "mã_sản_phẩm_được_chọn", "reason": "Lý do mua kèm..."}`;

                const response = await fetch(URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.candidates && data.candidates.length > 0) {
                        let aiText = data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
                        const aiResult = JSON.parse(aiText);
                        if(availableProducts.some(p => p.id === aiResult.id)) {
                            aiResultId = aiResult.id;
                            aiReason = aiResult.reason;
                        }
                    }
                }
            } catch (err) {
                console.warn("API Gemini lỗi, tự động dùng sản phẩm Smart Fallback.");
            }

            const recommendedProd = availableProducts.find(p => p.id === aiResultId) || randomFallbackProduct;
            const defaultVariant = (recommendedProd.variants && recommendedProd.variants.length > 0) ? recommendedProd.variants[0] : {};
            const basePrice = defaultVariant.price || recommendedProd.price || recommendedProd.basePrice || 0;
            const discountPrice = basePrice * 0.8; 
            const imgUrl = defaultVariant.images ? defaultVariant.images[0] : (recommendedProd.image || "https://via.placeholder.com/150");

            recommendedProductData = {
                id: recommendedProd.id,
                name: recommendedProd.name,
                image: imgUrl,
                basePrice: basePrice,
                discountPrice: discountPrice,
                reason: aiReason
            };

            document.getElementById('upsellImg').src = recommendedProductData.image;
            document.getElementById('upsellName').innerText = recommendedProductData.name;
            document.getElementById('upsellReason').innerText = `"${recommendedProductData.reason}"`;
            document.getElementById('upsellPriceNew').innerText = formatPrice(recommendedProductData.discountPrice);
            document.getElementById('upsellPriceOld').innerText = formatPrice(recommendedProductData.basePrice);

            upsellBox.style.display = 'block';
        } catch (error) {
            console.error("Lỗi hệ thống Suggestion:", error);
            document.getElementById('aiUpsellBox').style.display = 'none';
        }
    };

    checkoutBtn.addEventListener('click', async () => {
        if (!finalAddress) {
            alert("Bạn chưa chọn địa chỉ giao hàng! Vui lòng chọn trên bản đồ.");
            return;
        }

        const selectedPayment = document.querySelector('input[name="payment"]:checked').value;
        let finalOrderItems = [...cartData];
        let totalAmount = Math.round(cartData.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0));

        if (chkBuyUpsell && chkBuyUpsell.checked && recommendedProductData) {
            finalOrderItems.push({
                id: recommendedProductData.id,
                name: recommendedProductData.name,
                price: recommendedProductData.discountPrice,
                image: recommendedProductData.image,
                quantity: 1,
                color: "Mua kèm",
                storage: "Ưu đãi AI (-20%)"
            });
            totalAmount += recommendedProductData.discountPrice;
        }

        checkoutBtn.innerText = "Đang chuyển sang cổng thanh toán...";
        checkoutBtn.disabled = true;

        try {
            const orderId = "FSTORE_" + Date.now();

            const newOrder = {
                userId: userId,
                items: finalOrderItems, 
                totalAmount: totalAmount, 
                deliveryAddress: finalAddress, 
                status: "Chờ thanh toán",
                paymentMethod: selectedPayment, 
                createdAt: new Date()
            };
            
            // 1. LƯU ĐƠN HÀNG LÊN FIREBASE
            await setDoc(doc(db, "orders", orderId), newOrder);
            localStorage.removeItem(`cart_${userId}`);

            // 2. LƯU TẠM DỮ LIỆU ĐỂ GỬI EMAIL (CHƯA GỬI NGAY LÚC NÀY)
            const emailParams = {
                to_email: userEmail,
                customer_name: userName,
                order_id: orderId,
                total_amount: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalAmount),
                payment_method: selectedPayment.toUpperCase(),
                delivery_address: finalAddress
            };
            // Gói dữ liệu này giấu vào LocalStorage
            localStorage.setItem('fstore_pending_email', JSON.stringify(emailParams));

            // 3. GỌI API THANH TOÁN (Trở lại với file Cloudflare Functions của bạn)
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
                const orderInfo = finalOrderItems.map(item => item.name).join(', ');
                
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