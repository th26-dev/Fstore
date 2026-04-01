import { db, auth } from '../models/firebaseConfig.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const savedGrid = document.getElementById('savedGrid');
    const formatPrice = (price) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);

    const productPopover = document.getElementById('productPopover');
    const closePopoverBtn = document.getElementById('closePopoverBtn');
    const popoverImg = document.getElementById('popoverImg');
    const popoverName = document.getElementById('popoverName');
    const popoverDesc = document.getElementById('popoverDesc');
    const popoverSpecs = document.getElementById('popoverSpecs');
    const popoverPrice = document.getElementById('popoverPrice');
    const popoverVariants = document.getElementById('popoverVariants');
    const addToCartBtn = document.getElementById('addToCartBtn');
    const saveItemBtn = document.getElementById('saveItemBtn');

    let currentProduct = null;
    let selectedVariant = null;
    let currentImageIndex = 0;
    let slideInterval;

    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = 'auth.html';
            return;
        }

        const renderSavedItems = () => {
            const savedKey = `saved_${user.uid}`;
            const savedItems = JSON.parse(localStorage.getItem(savedKey)) || [];

            if (savedItems.length === 0) {
                savedGrid.innerHTML = `
                    <div class="empty-saved">
                        <i class="fa-solid fa-heart-crack"></i>
                        <h3>Mục đã lưu của bạn đang trống</h3>
                        <p style="color: #86868b; margin-bottom: 20px;">Hãy thả tim những sản phẩm bạn yêu thích để xem lại sau nhé.</p>
                        <a href="index.html">Khám phá sản phẩm &rarr;</a>
                    </div>
                `;
                return;
            }

            let html = '';
            savedItems.reverse().forEach(item => {
                html += `
                    <div class="saved-card" data-id="${item.id}" style="cursor: pointer;">
                        <button class="btn-remove-saved" data-id="${item.id}" title="Xóa khỏi mục đã lưu">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                        <img src="${item.image}" alt="${item.name}" class="saved-img">
                        <h3 class="saved-name">${item.name}</h3>
                        <p class="saved-price">${formatPrice(item.price)}</p>
                    </div>
                `;
            });
            savedGrid.innerHTML = html;

            document.querySelectorAll('.btn-remove-saved').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    const idToRemove = e.currentTarget.getAttribute('data-id');
                    const newSaved = savedItems.filter(i => i.id !== idToRemove);
                    localStorage.setItem(savedKey, JSON.stringify(newSaved));
                    
                    renderSavedItems();
                    
                    const toast = document.getElementById('toastNotification');
                    const toastMsg = document.getElementById('toastMessage');
                    if (toast && toastMsg) {
                        toastMsg.innerText = "Đã xóa khỏi mục đã lưu!";
                        toast.classList.add('show');
                        setTimeout(() => toast.classList.remove('show'), 3000);
                    }
                });
            });
        };

        renderSavedItems(); 

        const checkSavedStatus = () => {
            if (!saveItemBtn || !currentProduct) return;
            const savedKey = `saved_${user.uid}`;
            const savedItems = JSON.parse(localStorage.getItem(savedKey)) || [];
            const isSaved = savedItems.some(item => item.id === currentProduct.id);
            
            if (isSaved) {
                saveItemBtn.innerHTML = '<i class="fa-solid fa-heart" style="color: #ff3b30;"></i>';
                saveItemBtn.style.borderColor = '#ff3b30';
            } else {
                saveItemBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
                saveItemBtn.style.borderColor = '#d2d2d7';
            }
        };

        const updatePopoverVariantUI = () => {
            const imageList = selectedVariant.images || [selectedVariant.image || "https://via.placeholder.com/400"];
            if (currentImageIndex >= imageList.length) currentImageIndex = 0;
            if (popoverImg) popoverImg.src = imageList[currentImageIndex];
            if (popoverPrice) popoverPrice.innerText = formatPrice(selectedVariant.price);

            const dotsContainer = document.getElementById('imageDots');
            if (dotsContainer) {
                let dotsHtml = '';
                if (imageList.length > 1) {
                    imageList.forEach((_, idx) => {
                        dotsHtml += `<div class="dot ${idx === currentImageIndex ? 'active' : ''}" data-index="${idx}"></div>`;
                    });
                }
                dotsContainer.innerHTML = dotsHtml;
            }

            clearInterval(slideInterval); 
            if (imageList.length > 1) {
                slideInterval = setInterval(() => {
                    currentImageIndex = (currentImageIndex + 1) % imageList.length;
                    updatePopoverVariantUI();
                }, 3000); 
            }
        };

        const openPopover = async (productId) => {
            try {
                const docRef = doc(db, "products", productId);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    currentProduct = docSnap.data();
                    if (!currentProduct.variants || currentProduct.variants.length === 0) return;

                    selectedVariant = currentProduct.variants[0];
                    currentImageIndex = 0; 

                    if (popoverName) popoverName.innerText = currentProduct.name;
                    if (popoverDesc) popoverDesc.innerText = currentProduct.description;
                    
                    let specsHtml = '';
                    if(currentProduct.techSpecs && Object.keys(currentProduct.techSpecs).length > 0) {
                        for (const [key, value] of Object.entries(currentProduct.techSpecs)) {
                            specsHtml += `<div class="spec-line"><div class="spec-name">${key}</div><div class="spec-value">${value}</div></div>`;
                        }
                    } else {
                        specsHtml = '<p>Đang cập nhật thông số...</p>';
                    }
                    if (popoverSpecs) popoverSpecs.innerHTML = specsHtml;

                    updatePopoverVariantUI();
                    checkSavedStatus(); 

                    let variantsHtml = '';
                    currentProduct.variants.forEach((v, index) => {
                        variantsHtml += `<button class="variant-btn ${index === 0 ? 'active' : ''}" data-index="${index}">${v.color} - ${v.storage}</button>`;
                    });
                    if (popoverVariants) popoverVariants.innerHTML = variantsHtml;

                    if (productPopover) productPopover.classList.add('active');
                }
            } catch (error) {
                console.error("Lỗi khi mở sản phẩm:", error);
            }
        };

        document.addEventListener('click', (e) => {
            const savedCard = e.target.closest('.saved-card');
            if (savedCard && !e.target.closest('.btn-remove-saved')) {
                const productId = savedCard.getAttribute('data-id');
                openPopover(productId);
                return;
            }

            if (e.target.classList.contains('variant-btn')) {
                e.preventDefault();
                document.querySelectorAll('.variant-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                const variantIndex = e.target.getAttribute('data-index');
                selectedVariant = currentProduct.variants[variantIndex];
                currentImageIndex = 0; 
                updatePopoverVariantUI();
            }

            if (e.target.classList.contains('dot')) {
                e.preventDefault();
                currentImageIndex = parseInt(e.target.getAttribute('data-index'));
                updatePopoverVariantUI(); 
            }

            if (e.target.id === 'popoverImg') {
                e.preventDefault();
                const imageList = selectedVariant.images || [selectedVariant.image || ""];
                if (imageList.length > 1) {
                    currentImageIndex = (currentImageIndex + 1) % imageList.length;
                    updatePopoverVariantUI();
                }
            }
        });

        if (closePopoverBtn) {
            closePopoverBtn.addEventListener('click', () => {
                clearInterval(slideInterval); 
                productPopover.classList.remove('active');
            });
        }

        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', () => {
                const productToSave = {
                    id: currentProduct.id,
                    name: currentProduct.name,
                    price: selectedVariant.price,
                    image: selectedVariant.images ? selectedVariant.images[0] : selectedVariant.image,
                    color: selectedVariant.color,
                    storage: selectedVariant.storage
                };

                const cartKey = `cart_${user.uid}`;
                const currentCart = JSON.parse(localStorage.getItem(cartKey)) || [];
                currentCart.push(productToSave);
                localStorage.setItem(cartKey, JSON.stringify(currentCart));
                
                window.dispatchEvent(new Event('cartUpdated'));

                const cartIcon = document.getElementById('cartBtn'); 
                const sourceImage = document.getElementById('popoverImg'); 
                if (cartIcon && sourceImage) {
                    const imgRect = sourceImage.getBoundingClientRect();
                    const cartRect = cartIcon.getBoundingClientRect();
                    const flyingImg = sourceImage.cloneNode();
                    flyingImg.classList.add('flying-img');
                    flyingImg.style.left = `${imgRect.left}px`;
                    flyingImg.style.top = `${imgRect.top}px`;
                    flyingImg.style.width = `${imgRect.width}px`;
                    flyingImg.style.height = `${imgRect.height}px`;
                    document.body.appendChild(flyingImg);
                    flyingImg.offsetWidth; 
                    flyingImg.style.left = `${cartRect.left + cartRect.width / 2 - 10}px`;
                    flyingImg.style.top = `${cartRect.top + cartRect.height / 2 - 10}px`;
                    flyingImg.style.width = '20px';
                    flyingImg.style.height = '20px';
                    flyingImg.style.opacity = '0.2'; 
                    setTimeout(() => {
                        flyingImg.remove();
                        cartIcon.classList.add('cart-bounce');
                        setTimeout(() => cartIcon.classList.remove('cart-bounce'), 400); 
                    }, 800);
                }

                const toast = document.getElementById('toastNotification');
                const toastMsg = document.getElementById('toastMessage');
                if (toast && toastMsg) {
                    toastMsg.innerText = `Đã thêm ${currentProduct.name} vào giỏ hàng!`;
                    toast.classList.add('show');
                    setTimeout(() => toast.classList.remove('show'), 3000);
                }

                clearInterval(slideInterval); 
                productPopover.classList.remove('active');
            });
        }

        if (saveItemBtn) {
            saveItemBtn.addEventListener('click', () => {
                const savedKey = `saved_${user.uid}`;
                let savedItems = JSON.parse(localStorage.getItem(savedKey)) || [];
                const itemIndex = savedItems.findIndex(item => item.id === currentProduct.id);
                
                const toast = document.getElementById('toastNotification');
                const toastMsg = document.getElementById('toastMessage');

                if (itemIndex > -1) {
                    savedItems.splice(itemIndex, 1);
                    if(toastMsg) toastMsg.innerText = `Đã bỏ lưu ${currentProduct.name}!`;
                } else {
                    savedItems.push({
                        id: currentProduct.id,
                        name: currentProduct.name,
                        price: selectedVariant.price,
                        image: selectedVariant.images ? selectedVariant.images[0] : selectedVariant.image
                    });
                    if(toastMsg) toastMsg.innerText = `Đã lưu ${currentProduct.name} vào danh sách!`;
                }
                
                localStorage.setItem(savedKey, JSON.stringify(savedItems));
                checkSavedStatus(); 
                renderSavedItems(); 

                if (toast) {
                    toast.classList.add('show');
                    setTimeout(() => toast.classList.remove('show'), 3000);
                }
            });
        }
    });
});


