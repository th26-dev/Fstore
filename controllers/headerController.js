import { db, auth } from '../models/firebaseConfig.js';
import { collection, getDocs, query, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const checkMoMoPaymentResultGlobal = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const pendingOrderId = localStorage.getItem('pending_momo_order_id');
    
    if (pendingOrderId && urlParams.has('resultCode')) {
        const resultCode = urlParams.get('resultCode');
        const orderRef = doc(db, "orders", pendingOrderId);
        
        try {
            if (resultCode === '0') {
                await updateDoc(orderRef, { status: "Đã thanh toán" });
                alert("Thanh toán MoMo thành công! Đơn hàng đang được chờ duyệt.");
            } else {
                await updateDoc(orderRef, { status: "Đã hủy" });
                alert("Thanh toán bị hủy hoặc thất bại.");
            }
        } catch (error) {
            console.error(error);
        }
        
        localStorage.removeItem('pending_momo_order_id');
        window.history.replaceState({}, document.title, window.location.pathname);
        
        if (!window.location.pathname.includes('orders.html')) {
            window.location.href = 'orders.html';
        }
    }
};

const header = document.querySelector('.liquid-header');
let isScrolled = false;

window.addEventListener('scroll', () => {
    if (window.scrollY > 50 && !isScrolled) {
        if(header) header.classList.add('scrolled');
        isScrolled = true;
    } else if (window.scrollY <= 50 && isScrolled) {
        if(header) header.classList.remove('scrolled');
        isScrolled = false;
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    await checkMoMoPaymentResultGlobal();

    const mainNavList = document.getElementById('mainNavList');
    const megaMenu = document.getElementById('megaMenu');
    const dropdownContent = document.getElementById('dropdownContent');
    const pageOverlay = document.getElementById('pageOverlay');

    let currentUser = null;

    const updateCartDropdown = () => {
        const dropdown = document.getElementById('cartDropdown');
        if (!dropdown) return;

        if (!currentUser) {
            dropdown.innerHTML = `
                <div class="cart-dropdown-empty">Giỏ hàng của bạn đang trống.</div>
                <a href="auth.html" class="btn-view-cart" style="background: #f5f5f7; color: #1d1d1f !important;">Đăng nhập</a>
                <ul class="cart-dropdown-links">
                    <div class="cart-profile-title">Hồ Sơ Của Tôi</div>
                    <li><a href="orders.html"><i class="fa-solid fa-box"></i> Đơn hàng</a></li>
                    <li><a href="saved.html"><i class="fa-regular fa-bookmark"></i> Mục Đã Lưu</a></li>
                </ul>
            `;
            return;
        }

        const cartKey = `cart_${currentUser.uid}`;
        const currentCart = JSON.parse(localStorage.getItem(cartKey)) || [];
        let html = '';
        
        if (currentCart.length === 0) {
            html += `<div class="cart-dropdown-empty">Giỏ hàng của bạn đang trống.</div>`;
        } else {
            html += `<div class="cart-items-list">`;
            [...currentCart].reverse().forEach(item => {
                const price = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.price);
                html += `
                    <div class="cart-dropdown-item">
                        <img src="${item.image}" alt="${item.name}">
                        <div class="cart-dropdown-info">
                            <h4>${item.name}</h4>
                            <p>${item.color} - ${item.storage}</p>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
            html += `<a href="cart.html" class="btn-view-cart">Xem Giỏ Hàng</a>`;
        }

        html += `
            <ul class="cart-dropdown-links">
                <div class="cart-profile-title">Hồ Sơ Của Tôi</div>
                <li><a href="orders.html"><i class="fa-solid fa-box"></i> Đơn hàng</a></li>
                <li><a href="saved.html"><i class="fa-regular fa-bookmark"></i> Mục Đã Lưu</a></li>
                <li><a href="#" id="btnLogout"><i class="fa-solid fa-arrow-right-from-bracket"></i> Đăng xuất ${currentUser.email.split('@')[0]}</a></li>
            </ul>
        `;

        dropdown.innerHTML = html;

        const btnLogout = document.getElementById('btnLogout');
        if (btnLogout) {
            btnLogout.addEventListener('click', async (e) => {
                e.preventDefault();
                await signOut(auth);
                window.location.reload(); 
            });
        }
    };

    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        const cartBtnIcon = document.getElementById('cartBtn');
        if (cartBtnIcon) {
            if (user) cartBtnIcon.innerHTML = `<i class="fa-solid fa-bag-shopping" style="color: #0071e3;"></i>`;
            else cartBtnIcon.innerHTML = `<i class="fa-solid fa-bag-shopping"></i>`;
        }
        updateCartDropdown(); 
    });

    window.addEventListener('cartUpdated', updateCartDropdown);

    try {
        const categoriesRef = collection(db, "categories");
        const snapshot = await getDocs(query(categoriesRef, orderBy("order")));
        const allCategories = [];
        snapshot.forEach(doc => allCategories.push(doc.data()));

        const parentCategories = allCategories.filter(cat => cat.parentId === null);
        const childCategories = allCategories.filter(cat => cat.parentId !== null);

        let navHTML = `<li class="nav-item"><a href="index.html" class="nav-link"><i class="fa-solid fa-store" style="font-size: 1.2rem;"></i></a></li>`;
        parentCategories.forEach(parent => {
            navHTML += `<li class="nav-item has-dropdown" data-id="${parent.id}"><a href="#" class="nav-link">${parent.name}</a></li>`;
        });

        navHTML += `
            <li class="nav-item"><a href="#" class="nav-link" id="searchBtn"><i class="fa-solid fa-magnifying-glass"></i></a></li>
            <li class="nav-item"><a href="forum.html" class="nav-link" id="forumBtn"><i class="fa-solid fa-comments"></i></a></li>
            <li class="nav-item cart-item">
                <a href="cart.html" class="nav-link" id="cartBtn"><i class="fa-solid fa-bag-shopping"></i></a>
                <div class="cart-dropdown" id="cartDropdown"></div>
            </li>
        `;
        
        if (mainNavList) {
            mainNavList.innerHTML = navHTML;
            updateCartDropdown();

            const navItems = document.querySelectorAll('.has-dropdown');
            navItems.forEach(item => {
                item.addEventListener('mouseenter', function() {
                    const parentId = this.getAttribute('data-id');
                    const parentName = this.querySelector('a').innerText;
                    const children = childCategories.filter(child => child.parentId === parentId);

                    if (children.length > 0) {
                        let childHTML = `
                            <div>
                                <div class="sub-category-title">Khám phá ${parentName}</div>
                                <ul class="sub-category-list">
                                    ${children.map(c => `<li class="sub-category-item" data-id="${c.id}">${c.name}</li>`).join('')}
                                </ul>
                            </div>
                        `;
                        dropdownContent.innerHTML = childHTML;
                        megaMenu.classList.add('show');
                        if(header) header.classList.add('menu-open');
                        if(pageOverlay) pageOverlay.classList.add('show');
                    }
                });
            });
            
            if (header) {
                header.addEventListener('mouseleave', () => {
                    if(megaMenu) megaMenu.classList.remove('show');
                    header.classList.remove('menu-open');
                    if(pageOverlay) pageOverlay.classList.remove('show');
                });
            }
        }

        const searchBtn = document.getElementById('searchBtn');
        const searchBarContainer = document.getElementById('searchBarContainer');
        const closeSearchBtn = document.getElementById('closeSearchBtn');
        const searchInput = document.getElementById('searchInput');

        if (searchBtn && searchBarContainer && closeSearchBtn && searchInput) {
            const suggestionBox = document.createElement('div');
            suggestionBox.className = 'search-suggestions';
            searchBarContainer.appendChild(suggestionBox);

            let allProductsForSearch = [];
            const loadProductsForSearch = async () => {
                try {
                    const prodRef = collection(db, "products");
                    const snapshot = await getDocs(prodRef);
                    snapshot.forEach(doc => {
                        allProductsForSearch.push({ id: doc.id, ...doc.data() });
                    });
                } catch (error) {
                    console.error(error);
                }
            };
            loadProductsForSearch();

            searchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                searchBarContainer.classList.add('active');
                if(pageOverlay) pageOverlay.classList.add('show');
                searchInput.focus();
            });

            closeSearchBtn.addEventListener('click', () => {
                searchBarContainer.classList.remove('active');
                if(pageOverlay) pageOverlay.classList.remove('show');
                suggestionBox.classList.remove('show');
                searchInput.value = '';
            });

            searchInput.addEventListener('input', (e) => {
                const keyword = e.target.value.trim().toLowerCase();
                
                if (!keyword) {
                    suggestionBox.classList.remove('show');
                    return;
                }

                const filteredProducts = allProductsForSearch.filter(p => 
                    p.name.toLowerCase().includes(keyword)
                );

                if (filteredProducts.length === 0) {
                    suggestionBox.innerHTML = '<div class="suggest-empty">Không tìm thấy sản phẩm nào phù hợp...</div>';
                } else {
                    const top5Products = filteredProducts.slice(0, 5);
                    suggestionBox.innerHTML = top5Products.map(p => {
                        let imgUrl = "https://via.placeholder.com/45";
                        if (p.variants && p.variants.length > 0) {
                            const firstVariant = p.variants[0];
                            if (firstVariant.images && firstVariant.images.length > 0) imgUrl = firstVariant.images[0];
                            else if (firstVariant.image) imgUrl = firstVariant.image;
                        }
                        if (imgUrl === "https://via.placeholder.com/45") {
                            if (p.images && p.images.length > 0) imgUrl = p.images[0];
                            else if (p.image) imgUrl = p.image;
                        }

                        let price = 0;
                        if (p.variants && p.variants.length > 0 && p.variants[0].price) {
                            price = p.variants[0].price;
                        } else if (p.price) {
                            price = p.price;
                        } else if (p.basePrice) {
                            price = p.basePrice;
                        }

                        const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
                        
                        return `
                            <div class="suggest-item" data-id="${p.id}">
                                <img src="${imgUrl}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/45'">
                                <div class="suggest-info">
                                    <h4>${p.name}</h4>
                                    <p>${formattedPrice}</p>
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
                    localStorage.setItem('pendingProductOpen', productId);
                    window.location.href = 'index.html'; 
                }
            });

            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const keyword = searchInput.value.trim();
                    if (!keyword) return;
                    
                    const path = window.location.pathname.toLowerCase();
                    const isHomePage = path.includes('index.html') || path === '/' || path.endsWith('/fstore/');
                    
                    if (!isHomePage) {
                        e.preventDefault();
                        localStorage.setItem('pendingSearchKeyword', keyword);
                        window.location.href = 'index.html';
                    } else {
                        suggestionBox.classList.remove('show');
                    }
                }
            });
        }

    } catch (error) {
        console.error(error);
    }
});

document.addEventListener('click', (e) => {
    const categoryItem = e.target.closest('.sub-category-item');
    if (categoryItem) {
        const categoryId = categoryItem.getAttribute('data-id');
        const categoryName = categoryItem.innerText;
        const path = window.location.pathname.toLowerCase();
        const isHomePage = path.includes('index.html') || path === '/' || path.endsWith('/fstore/');
        
        if (!isHomePage) {
            e.preventDefault(); 
            localStorage.setItem('pendingCategoryLoad', JSON.stringify({ id: categoryId, name: categoryName }));
            window.location.href = 'index.html'; 
        }
    }
});c