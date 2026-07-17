import { db, auth } from '../models/firebaseConfig.js';
import { collection, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const productGrid = document.getElementById('productGrid');
    const sectionTitle = document.getElementById('sectionTitle');
    const searchInput = document.getElementById('searchInput');
    const searchBarContainer = document.getElementById('searchBarContainer');
    const pageOverlay = document.getElementById('pageOverlay');
    const megaMenu = document.getElementById('megaMenu');
    
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

    const ambilightWrappers = document.querySelectorAll('.ambilight-wrapper');
    ambilightWrappers.forEach(wrapper => {
        const glowVideo = wrapper.querySelector('.ambilight-glow');
        const mainVideo = wrapper.querySelector('.landing-media');

        if (glowVideo && mainVideo) {
            mainVideo.addEventListener('playing', () => {
                glowVideo.currentTime = mainVideo.currentTime;
                glowVideo.play().catch(() => {});
            });

            mainVideo.addEventListener('pause', () => glowVideo.pause());
            mainVideo.addEventListener('waiting', () => glowVideo.pause());

            setInterval(() => {
                if (!mainVideo.paused && Math.abs(glowVideo.currentTime - mainVideo.currentTime) > 0.3) {
                    glowVideo.currentTime = mainVideo.currentTime;
                }
            }, 2000); 
        }
    });

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
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
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
                currentProduct.id = docSnap.id;
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

                if (typeof window.loadReviews === 'function') {
                    window.loadReviews(currentProduct.id);
                }

                if (productPopover) productPopover.classList.add('active');
            }
        } catch (error) {}
    };

    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('sub-category-item')) {
            const categoryId = e.target.getAttribute('data-id');
            const categoryName = e.target.innerText;

            if(megaMenu) megaMenu.classList.remove('show');
            if(pageOverlay) pageOverlay.classList.remove('show');
            const header = document.querySelector('.liquid-header');
            if(header) header.classList.remove('menu-open');

            const q = query(collection(db, "products"), where("categoryId", "==", categoryId));
            const snapshot = await getDocs(q);
            const products = [];
            snapshot.forEach(doc => {
                products.push({ id: doc.id, ...doc.data() });
            });

            renderProducts(products, categoryName);
        }

        const productCard = e.target.closest('.product-card');
        if (productCard) {
            if (e.target.closest('a')) e.preventDefault();
            const productId = productCard.getAttribute('data-id');
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
                
                setTimeout(() => {
                    toast.classList.remove('show');
                }, 3000);
            }

            clearInterval(slideInterval); 
            productPopover.classList.remove('active');
        });
    }

    const saveItemBtn = document.getElementById('saveItemBtn');
    
    const checkSavedStatus = () => {
        if (!saveItemBtn || !auth.currentUser || !currentProduct) return;
        const savedKey = `saved_${auth.currentUser.uid}`;
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

    if (saveItemBtn) {
        saveItemBtn.addEventListener('click', () => {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                window.location.href = 'auth.html';
                return;
            }

            const savedKey = `saved_${currentUser.uid}`;
            let savedItems = JSON.parse(localStorage.getItem(savedKey)) || [];
            const itemIndex = savedItems.findIndex(item => item.id === currentProduct.id);
            
            const toast = document.getElementById('toastNotification');
            const toastMsg = document.getElementById('toastMessage');

            if (itemIndex > -1) {
                savedItems.splice(itemIndex, 1);
                saveItemBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
                saveItemBtn.style.borderColor = '#d2d2d7';
                if(toastMsg) toastMsg.innerText = `Đã bỏ lưu ${currentProduct.name}!`;
            } else {
                savedItems.push({
                    id: currentProduct.id,
                    name: currentProduct.name,
                    price: selectedVariant.price,
                    image: selectedVariant.images ? selectedVariant.images[0] : selectedVariant.image
                });
                saveItemBtn.innerHTML = '<i class="fa-solid fa-heart" style="color: #ff3b30;"></i>';
                saveItemBtn.style.borderColor = '#ff3b30';
                if(toastMsg) toastMsg.innerText = `Đã lưu ${currentProduct.name} vào danh sách!`;
            }
            
            localStorage.setItem(savedKey, JSON.stringify(savedItems));

            if (toast) {
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 3000);
            }
        });
    }

    const removeAccents = (str) => {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    };

    const fuzzyMatch = (pattern, str) => {
        let patternIdx = 0; let strIdx = 0;
        while (patternIdx < pattern.length && strIdx < str.length) {
            if (pattern[patternIdx] === str[strIdx]) { patternIdx++; }
            strIdx++;
        }
        return patternIdx === pattern.length;
    };

    if (searchInput && searchBarContainer) {
        const suggestionBox = document.createElement('div');
        suggestionBox.className = 'search-suggestions';
        searchBarContainer.appendChild(suggestionBox);

        let allProductsForSearch = [];
        const loadProductsForSearch = async () => {
            try {
                const snapshot = await getDocs(collection(db, "products"));
                snapshot.forEach(doc => {
                    allProductsForSearch.push({ id: doc.id, ...doc.data() });
                });
            } catch (error) {}
        };
        loadProductsForSearch();

        searchInput.addEventListener('input', (e) => {
            const rawKeyword = e.target.value.trim();
            if (!rawKeyword) {
                suggestionBox.classList.remove('show');
                return;
            }
            const searchKeyword = removeAccents(rawKeyword.toLowerCase());
            
            const filteredProducts = allProductsForSearch.filter(p => {
                const normalizedProductName = removeAccents(p.name.toLowerCase());
                return normalizedProductName.includes(searchKeyword) || fuzzyMatch(searchKeyword, normalizedProductName);
            });

            if (filteredProducts.length === 0) {
                suggestionBox.innerHTML = '<div class="suggest-empty">Không tìm thấy sản phẩm nào phù hợp...</div>';
            } else {
                const top5Products = filteredProducts.slice(0, 5);
                suggestionBox.innerHTML = top5Products.map(p => {
                    const defaultVariant = (p.variants && p.variants.length > 0) ? p.variants[0] : {};
                    const imgUrl = defaultVariant.images ? defaultVariant.images[0] : (defaultVariant.image || "https://via.placeholder.com/45");
                    const price = defaultVariant.price || p.basePrice || 0;
                    
                    return `
                        <div class="suggest-item" data-id="${p.id}">
                            <img src="${imgUrl}" alt="${p.name}">
                            <div class="suggest-info">
                                <h4>${p.name}</h4>
                                <p>${formatPrice(price)}</p>
                            </div>
                        </div>
                    `;
                }).join('');
            }
            suggestionBox.classList.add('show');
        });

        suggestionBox.addEventListener('click', (e) => {
            const clickedItem = e.target.closest('.suggest-item');
            if (clickedItem) {
                const productId = clickedItem.getAttribute('data-id');
                const path = window.location.pathname.toLowerCase();
                const isHomePage = path.includes('index.html') || path === '/' || path.endsWith('/fstore/');
                
                searchBarContainer.classList.remove('active');
                if(pageOverlay) pageOverlay.classList.remove('show');
                suggestionBox.classList.remove('show');
                searchInput.value = '';

                if (isHomePage) {
                    openPopover(productId);
                } else {
                    localStorage.setItem('pendingProductOpen', productId);
                    window.location.href = 'index.html';
                }
            }
        });

        searchInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const rawKeyword = searchInput.value.trim();
                if (!rawKeyword) return;

                if (searchBarContainer) searchBarContainer.classList.remove('active');
                if (pageOverlay) pageOverlay.classList.remove('show');
                suggestionBox.classList.remove('show');
                searchInput.value = '';

                const searchKeyword = removeAccents(rawKeyword.toLowerCase());
                const products = allProductsForSearch.filter(p => {
                    const normalizedProductName = removeAccents(p.name.toLowerCase());
                    return fuzzyMatch(searchKeyword, normalizedProductName) || normalizedProductName.includes(searchKeyword);
                });
                
                renderProducts(products, `Kết quả tìm kiếm cho: "${rawKeyword}"`);
            }
        });
    }

    setTimeout(async () => {
        const pendingCategory = localStorage.getItem('pendingCategoryLoad');
        const pendingSearch = localStorage.getItem('pendingSearchKeyword');
        const pendingProductOpen = localStorage.getItem('pendingProductOpen');
        
        if (pendingProductOpen) {
            localStorage.removeItem('pendingProductOpen');
            openPopover(pendingProductOpen);
        } else if (pendingCategory) {
            try {
                const { id, name } = JSON.parse(pendingCategory);
                localStorage.removeItem('pendingCategoryLoad'); 
                
                if (megaMenu) megaMenu.classList.remove('show');
                if (pageOverlay) pageOverlay.classList.remove('show');
                const header = document.querySelector('.liquid-header');
                if (header) header.classList.remove('menu-open');

                const q = query(collection(db, "products"), where("categoryId", "==", id));
                const snapshot = await getDocs(q);
                const products = [];
                snapshot.forEach(doc => {
                    products.push({ id: doc.id, ...doc.data() });
                });
                
                renderProducts(products, name);
            } catch (error) {}
        } 
        else if (pendingSearch) {
            try {
                localStorage.removeItem('pendingSearchKeyword'); 

                if (searchBarContainer) searchBarContainer.classList.remove('active');
                if (pageOverlay) pageOverlay.classList.remove('show');
                if (searchInput) searchInput.value = '';

                const searchKeyword = removeAccents(pendingSearch.toLowerCase());
                const snapshot = await getDocs(collection(db, "products"));
                const products = [];
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const normalizedProductName = removeAccents(data.name.toLowerCase());
                    if (fuzzyMatch(searchKeyword, normalizedProductName) || normalizedProductName.includes(searchKeyword)) {
                        products.push({ id: doc.id, ...data });
                    }
                });

                renderProducts(products, `Kết quả tìm kiếm cho: "${pendingSearch}"`);
            } catch (error) {}
        }
    }, 300);

});