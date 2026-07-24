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

    // Biến toàn cục lưu trữ toàn bộ sản phẩm từ Firebase để Lọc
    let allGlobalProducts = [];

    // ==========================================================
    // BIẾN CHO TÍNH NĂNG PHÂN TRANG (PAGINATION)
    // ==========================================================
    let currentFilteredProductsList = []; // Lưu mảng sản phẩm đang được lọc hiện tại
    let currentPage = 1;
    const productsPerPage = 8; // 2 hàng x 4 sản phẩm = 8 sản phẩm/trang

    // Tự động chèn CSS Ép lưới 4 cột và Giao diện Nút Phân trang
    const injectPaginationStyles = () => {
        if (!document.getElementById('paginationStyles')) {
            const style = document.createElement('style');
            style.id = 'paginationStyles';
            style.innerHTML = `
                .product-grid {
                    display: grid !important;
                    grid-template-columns: repeat(4, 1fr) !important;
                    gap: 20px !important;
                }
                .pagination-container {
                    display: flex; justify-content: center; align-items: center; gap: 8px; margin: 40px 0; width: 100%; grid-column: 1 / -1;
                }
                .page-btn {
                    padding: 8px 16px; border: 1px solid #0071e3; background: #fff; color: #0071e3;
                    border-radius: 8px; cursor: pointer; font-weight: 600; transition: 0.3s;
                }
                .page-btn:hover:not(:disabled) { background: #f0f8ff; }
                .page-btn.active { background: #0071e3; color: #fff; border-color: #0071e3; }
                .page-btn:disabled { border-color: #d2d2d7; color: #86868b; cursor: not-allowed; background: #f5f5f7; }
                
                /* Responsive cho màn hình nhỏ hơn */
                @media (max-width: 992px) { .product-grid { grid-template-columns: repeat(3, 1fr) !important; } }
                @media (max-width: 768px) { .product-grid { grid-template-columns: repeat(2, 1fr) !important; } }
                @media (max-width: 480px) { .product-grid { grid-template-columns: repeat(1, 1fr) !important; } }
            `;
            document.head.appendChild(style);
        }
    };
    injectPaginationStyles();

    // Tạo container chứa nút phân trang nếu chưa có
    let paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'paginationContainer';
        paginationContainer.className = 'pagination-container';
        // Chèn ngay sau thẻ productGrid
        productGrid.insertAdjacentElement('afterend', paginationContainer);

        // Bắt sự kiện Click chuyển trang
        paginationContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.page-btn');
            if (!btn || btn.disabled) return;
            const newPage = parseInt(btn.dataset.page);
            if (newPage && newPage !== currentPage) {
                currentPage = newPage;
                renderPageData(); // Render lại sản phẩm của trang mới
            }
        });
    }

    // ==========================================================
    // TẢI TOÀN BỘ SẢN PHẨM VÀ KHỞI TẠO BỘ LỌC
    // ==========================================================
    const initializeApp = async () => {
        try {
            const snapshot = await getDocs(collection(db, "products"));
            allGlobalProducts = [];
            snapshot.forEach(d => {
                allGlobalProducts.push({ id: d.id, ...d.data() });
            });
            initAdvancedFilter(); 
        } catch (error) {
            console.error("Lỗi khi tải dữ liệu sản phẩm ban đầu: ", error);
        }
    };

    initializeApp();

    // ==========================================================
    // LOGIC XỬ LÝ BỘ LỌC NÂNG CAO
    // ==========================================================
    const initAdvancedFilter = async () => {
        const modal = document.getElementById('advancedFilterModal');
        const btnOpen = document.getElementById('btnOpenAdvancedFilter');
        const btnClose = document.getElementById('closeAdvFilter');
        const btnReset = document.getElementById('btnResetFilter');
        const btnApply = document.getElementById('btnApplyFilter');

        if(btnOpen) btnOpen.addEventListener('click', () => modal.classList.add('active'));
        if(btnClose) btnClose.addEventListener('click', () => modal.classList.remove('active'));

        try {
            const catSnap = await getDocs(collection(db, "categories"));
            let logosHtml = '';
            catSnap.forEach(doc => {
                const data = doc.data();
                if(data.imageUrl && data.imageUrl.trim() !== "") {
                    logosHtml += `
                        <div class="brand-logo-btn" data-filter-type="brand" data-val="${data.id}" title="${data.name}">
                            <img src="${data.imageUrl}" alt="${data.name}">
                        </div>`;
                }
            });
            document.getElementById('quickBrandLogos').innerHTML = logosHtml;
            document.getElementById('modalBrandLogos').innerHTML = logosHtml;

            const quickLogos = document.querySelectorAll('#quickBrandLogos .brand-logo-btn');
            quickLogos.forEach(logo => {
                logo.addEventListener('click', () => {
                    quickLogos.forEach(l => l.classList.remove('active')); 
                    logo.classList.add('active'); 

                    document.querySelectorAll('#modalBrandLogos .brand-logo-btn').forEach(b => b.classList.remove('active'));
                    const targetModalLogo = document.querySelector(`#modalBrandLogos .brand-logo-btn[data-val="${logo.dataset.val}"]`);
                    if(targetModalLogo) targetModalLogo.classList.add('active');

                    applyFilters(); 
                });
            });

        } catch(e) { console.error("Lỗi load Categories Logo", e); }

        const allOptionBtns = document.querySelectorAll('#advancedFilterModal .opt-btn, #advancedFilterModal .brand-logo-btn');
        allOptionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if(btn.parentElement.id === 'filterSortOptions') {
                    document.querySelectorAll('#filterSortOptions .opt-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                } else {
                    btn.classList.toggle('active');
                }
                updateApplyButtonCount();
            });
        });

        if(btnReset) {
            btnReset.addEventListener('click', () => {
                allOptionBtns.forEach(b => b.classList.remove('active'));
                document.querySelectorAll('#quickBrandLogos .brand-logo-btn').forEach(b => b.classList.remove('active'));
                updateApplyButtonCount();
                renderProducts(allGlobalProducts, "Tất cả sản phẩm"); 
            });
        }

        if(btnApply) {
            btnApply.addEventListener('click', () => {
                applyFilters();
                modal.classList.remove('active');
            });
        }
    };

    const updateApplyButtonCount = () => {
        const filtered = getFilteredProductsArray();
        const btnApply = document.getElementById('btnApplyFilter');
        btnApply.innerText = `Áp dụng (${filtered.length} sản phẩm)`;
        if(filtered.length > 0) btnApply.classList.add('ready');
        else btnApply.classList.remove('ready');
    };

    const getFilteredProductsArray = () => {
        const activeSort = document.querySelector('#filterSortOptions .opt-btn.active')?.dataset.sort;
        const activeBrands = Array.from(document.querySelectorAll('#modalBrandLogos .brand-logo-btn.active')).map(b => b.dataset.val);
        const activePacks = Array.from(document.querySelectorAll('#filterPackageOptions .opt-btn.active')).map(b => b.dataset.pack);
        const activeVols = Array.from(document.querySelectorAll('#filterVolumeOptions .opt-btn.active')).map(b => parseInt(b.dataset.vol));

        let result = [...allGlobalProducts];

        if (activeBrands.length > 0) {
            result = result.filter(p => activeBrands.includes(p.categoryId));
        }

        if (activePacks.length > 0) {
            result = result.filter(p => {
                return activePacks.some(pack => p.name.toLowerCase().includes(pack.toLowerCase()));
            });
        }

        if (activeVols.length > 0) {
            result = result.filter(p => {
                const text = (p.name + " " + (p.description||"")).toLowerCase();
                if(activeVols.includes(330) && text.includes("330ml")) return true;
                if(activeVols.includes(250) && text.includes("250ml")) return true;
                if(activeVols.includes(500) && text.includes("500ml")) return true;
                return false;
            });
        }

        if (activeSort) {
            result.sort((a, b) => {
                const priceA = a.variants?.[0]?.price || a.price || 0;
                const priceB = b.variants?.[0]?.price || b.price || 0;
                
                if (activeSort === 'price-desc') return priceB - priceA;
                if (activeSort === 'price-asc') return priceA - priceB;
                return 0; 
            });
        }

        return result;
    };

    const applyFilters = () => {
        const result = getFilteredProductsArray();
        renderProducts(result, "Kết quả Lọc sản phẩm");
    };

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

    // ==========================================================
    // HÀM RENDER TỔNG (LƯU TRỮ VÀ GỌI PHÂN TRANG)
    // ==========================================================
    const renderProducts = (products, title) => {
        if (landingPage) landingPage.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';

        sectionTitle.style.display = 'block';
        sectionTitle.innerText = title;
        
        currentFilteredProductsList = products; // Lưu lại mảng
        currentPage = 1; // Luôn reset về trang 1 khi lọc hoặc chuyển danh mục

        renderPageData();
    };

    // ==========================================================
    // HÀM RENDER TỪNG TRANG VÀ VẼ NÚT BẤM (GIAO DIỆN BÁCH HÓA XANH)
    // ==========================================================
    const renderPageData = () => {
        if (currentFilteredProductsList.length === 0) {
            productGrid.innerHTML = '<p style="grid-column: 1 / -1; font-size: 18px; text-align: center; color: #ff3b30;">Không tìm thấy sản phẩm nào phù hợp với bộ lọc.</p>';
            paginationContainer.innerHTML = '';
            return;
        }

        const startIndex = (currentPage - 1) * productsPerPage;
        const endIndex = startIndex + productsPerPage;
        const productsToShow = currentFilteredProductsList.slice(startIndex, endIndex);

        let html = '';
        productsToShow.forEach(prod => {
            if(!prod.variants || prod.variants.length === 0) return; 
            const defaultVariant = prod.variants[0]; 
            const displayImg = defaultVariant.images ? defaultVariant.images[0] : (defaultVariant.image || "https://via.placeholder.com/400");
            
            // GIAO DIỆN MỚI: Bỏ padding mặc định, thiết kế tràn viền, text canh trái
            html += `
                <div class="product-card" data-id="${prod.id}" style="padding: 0; display: flex; flex-direction: column; overflow: hidden; border-radius: 8px; border: 1px solid #e5e5ea; background: #fff; text-align: left; box-shadow: 0 2px 8px rgba(0,0,0,0.04); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(0,0,0,0.1)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)';">
                    
                    <div style="padding: 15px; display: flex; justify-content: center; align-items: center; background: #fff;">
                        <img src="${displayImg}" alt="${prod.name}" class="product-img" style="height: 160px; width: auto; max-width: 100%; object-fit: contain;">
                    </div>
                    
                    <div style="padding: 12px 15px; flex-grow: 1; display: flex; flex-direction: column; justify-content: flex-start;">
                        <h3 class="product-name" style="font-size: 14px; font-weight: normal; color: #5f748d; margin: 0 0 6px 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${prod.name}</h3>
                        <p class="product-price" style="font-size: 17px; font-weight: bold; color: #000; margin: 0; margin-top: auto;">${formatPrice(defaultVariant.price)}</p>
                    </div>
                    
                    <button style="width: 100%; padding: 12px 0; background: #f0fdf4; color: #059669; font-size: 16px; font-weight: bold; border: none; border-top: 1px solid #dcfce7; cursor: pointer; transition: 0.2s; text-align: center;" 
                            onmouseover="this.style.background='#dcfce7'" 
                            onmouseout="this.style.background='#f0fdf4'">
                        MUA
                    </button>
                </div>
            `;
        });
        productGrid.innerHTML = html;

        const totalPages = Math.ceil(currentFilteredProductsList.length / productsPerPage);
        if (totalPages <= 1) {
            paginationContainer.innerHTML = ''; 
        } else {
            let paginationHtml = '';
            paginationHtml += `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>`;
            for (let i = 1; i <= totalPages; i++) {
                paginationHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
            paginationHtml += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>`;
            paginationContainer.innerHTML = paginationHtml;
        }

        if (mainContent) {
            window.scrollTo({ top: mainContent.offsetTop - 80, behavior: 'smooth' });
        }
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
            // Chặn sự kiện nhảy trang mặc định nếu click trúng thẻ a hoặc button
            if (e.target.closest('a') || e.target.closest('button')) e.preventDefault();
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
                const pendingData = JSON.parse(pendingCategory);
                localStorage.removeItem('pendingCategoryLoad'); 
                
                if (megaMenu) megaMenu.classList.remove('show');
                if (pageOverlay) pageOverlay.classList.remove('show');
                const header = document.querySelector('.liquid-header');
                if (header) header.classList.remove('menu-open');

                if(allGlobalProducts.length === 0){
                    const snap = await getDocs(collection(db, "products"));
                    snap.forEach(d => allGlobalProducts.push({ id: d.id, ...d.data() }));
                }

                let productsToRender = [];

                if (pendingData.isRoot && pendingData.childIds && pendingData.childIds.length > 0) {
                    productsToRender = allGlobalProducts.filter(p => pendingData.childIds.includes(p.categoryId));
                } else {
                    const q = query(collection(db, "products"), where("categoryId", "==", pendingData.id));
                    const snapshot = await getDocs(q);
                    snapshot.forEach(doc => productsToRender.push({ id: doc.id, ...doc.data() }));
                }
                
                renderProducts(productsToRender, pendingData.name);

            } catch (error) { console.error("Lỗi khi load danh mục:", error); }
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