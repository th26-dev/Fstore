import { db, auth } from '../models/firebaseConfig.js';
import { collection, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const productGrid = document.getElementById('productGrid');
    const sectionTitle = document.getElementById('sectionTitle');
    const searchInput = document.getElementById('searchInput');
    const searchBarContainer = document.getElementById('searchBarContainer');
    const pageOverlay = document.getElementById('pageOverlay');
    const megaMenu = document.getElementById('megaMenu');
    
    // Các phần tử Landing Page và Main Content mới
    const landingPage = document.getElementById('landingPage');
    const mainContent = document.getElementById('mainContent');
    
    const productPopover = document.getElementById('productPopover');
    const closePopoverBtn = document.getElementById('closePopoverBtn');
    const popoverImg = document.getElementById('popoverImg');
    const popoverName = document.getElementById('popoverName');
    const popoverDesc = document.getElementById('popoverDesc');
    const popoverSpecs = document.getElementById('popoverSpecs');
    const popoverPrice = document.getElementById('popoverPrice');
    const popoverVariants = document.getElementById('popoverVariants');
    const addToCartBtn = document.getElementById('addToCartBtn');

    let currentProduct = null;
    let selectedVariant = null;
    let currentImageIndex = 0; 
    let slideInterval; 

    // === CÀI ĐẶT HIỆU ỨNG CUỘN (SCROLL ANIMATION) ===
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.scroll-anim').forEach(el => observer.observe(el));
    
    const formatPrice = (price) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    };

    const renderProducts = (products, title) => {
        // Chuyển đổi giao diện: Ẩn quảng cáo, hiện sản phẩm
        if (landingPage) landingPage.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';

        sectionTitle.style.display = 'block';
        sectionTitle.innerText = title;
        
        if (products.length === 0) {
            productGrid.innerHTML = '<p style="grid-column: 1 / -1; font-size: 18px; text-align: center;">Không tìm thấy sản phẩm nào.</p>';
            return;
        }

        let html = '';
        products.forEach(prod => {
            if(!prod.variants || prod.variants.length === 0) return; 
            const defaultVariant = prod.variants[0]; 
            const displayImg = defaultVariant.images ? defaultVariant.images[0] : (defaultVariant.image || "https://via.placeholder.com/400");
            
            html += `
                <div class="product-card" data-id="${prod.id}">
                    <img src="${displayImg}" alt="${prod.name}" class="product-img">
                    <h3 class="product-name">${prod.name}</h3>
                    <p class="product-price">${formatPrice(defaultVariant.price)}</p>
                    <a href="#" class="btn-view">Xem chi tiết</a>
                </div>
            `;
        });
        productGrid.innerHTML = html;
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Tự động cuộn lên khi load xong danh mục
    };

    const updatePopoverVariantUI = () => {
        const imageList = selectedVariant.images || [selectedVariant.image || "https://via.placeholder.com/400"];
        
        if (currentImageIndex >= imageList.length) {
            currentImageIndex = 0;
        }
        
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
                        specsHtml += `
                            <div class="spec-line">
                                <div class="spec-name">${key}</div>
                                <div class="spec-value">${value}</div>
                            </div>`;
                    }
                } else {
                    specsHtml = '<p>Đang cập nhật thông số...</p>';
                }
                if (popoverSpecs) popoverSpecs.innerHTML = specsHtml;

                updatePopoverVariantUI();

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

    document.addEventListener('click', async (e) => {
        // Menu Danh Mục
        if (e.target.classList.contains('sub-category-item')) {
            const categoryId = e.target.getAttribute('data-id');
            const categoryName = e.target.innerText;

            megaMenu.classList.remove('show');
            pageOverlay.classList.remove('show');
            document.querySelector('.liquid-header').classList.remove('menu-open');

            const q = query(collection(db, "products"), where("categoryId", "==", categoryId));
            const snapshot = await getDocs(q);
            const products = [];
            snapshot.forEach(doc => products.push(doc.data()));

            renderProducts(products, categoryName);
        }

        // Fix lỗi click thẻ sản phẩm
        const productCard = e.target.closest('.product-card');
        if (productCard) {
            // Ngăn thẻ <a> nhảy trang
            if (e.target.closest('a')) e.preventDefault();
            
            const productId = productCard.getAttribute('data-id');
            openPopover(productId);
            return;
        }

        // Đổi Biến Thể
        if (e.target.classList.contains('variant-btn')) {
            e.preventDefault();
            document.querySelectorAll('.variant-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            
            const variantIndex = e.target.getAttribute('data-index');
            selectedVariant = currentProduct.variants[variantIndex];
            currentImageIndex = 0; 
            updatePopoverVariantUI();
        }

        // Bấm Nút Dot
        if (e.target.classList.contains('dot')) {
            e.preventDefault();
            currentImageIndex = parseInt(e.target.getAttribute('data-index'));
            updatePopoverVariantUI(); 
        }

        // Bấm trực tiếp vào Ảnh
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
            const currentUser = auth.currentUser;
            if (!currentUser) {
                window.location.href = 'auth.html';
                return;
            }

            const productToSave = {
                id: currentProduct.id,
                name: currentProduct.name,
                price: selectedVariant.price,
                image: selectedVariant.images ? selectedVariant.images[0] : selectedVariant.image,
                color: selectedVariant.color,
                storage: selectedVariant.storage
            };

            const cartKey = `cart_${currentUser.uid}`;
            const currentCart = JSON.parse(localStorage.getItem(cartKey)) || [];
            currentCart.push(productToSave);
            localStorage.setItem(cartKey, JSON.stringify(currentCart));

            alert(`Đã thêm ${currentProduct.name} vào giỏ hàng!`);
            clearInterval(slideInterval); 
            productPopover.classList.remove('active');
        });
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const keyword = searchInput.value.toLowerCase().trim();
                if (!keyword) return;

                searchBarContainer.classList.remove('active');
                pageOverlay.classList.remove('show');
                searchInput.value = '';

                const snapshot = await getDocs(collection(db, "products"));
                const products = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.name.toLowerCase().includes(keyword)) {
                        products.push(data);
                    }
                });

                renderProducts(products, `Kết quả tìm kiếm cho: "${keyword}"`);
            }
        });
    }
});