import { db, auth } from '../models/firebaseConfig.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// =========================================
// HIỆU ỨNG DYNAMIC ISLAND HEADER
// =========================================
const header = document.querySelector('.liquid-header');

window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        // Khi cuộn xuống quá 50px -> Biến thành viên thuốc
        header.classList.add('scrolled');
    } else {
        // Khi trở về trên cùng -> Dãn ra tràn viền như cũ
        header.classList.remove('scrolled');
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    const mainNavList = document.getElementById('mainNavList');
    const megaMenu = document.getElementById('megaMenu');
    const dropdownContent = document.getElementById('dropdownContent');
    const pageOverlay = document.getElementById('pageOverlay');

    let currentUser = null;

    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        const cartBtnIcon = document.getElementById('cartBtn');
        if (cartBtnIcon) {
            if (user) {
                cartBtnIcon.innerHTML = `<i class="fa-solid fa-bag-shopping" style="color: #0071e3;"></i>`;
            } else {
                cartBtnIcon.innerHTML = `<i class="fa-solid fa-bag-shopping"></i>`;
            }
        }
    });

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
            <li class="nav-item"><a href="cart.html" class="nav-link" id="cartBtn"><i class="fa-solid fa-bag-shopping"></i></a></li>
        `;
        
        mainNavList.innerHTML = navHTML;

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
                    header.classList.add('menu-open');
                    pageOverlay.classList.add('show');
                }
            });
        });

        header.addEventListener('mouseleave', () => {
            megaMenu.classList.remove('show');
            header.classList.remove('menu-open');
            pageOverlay.classList.remove('show');
        });

        const searchBtn = document.getElementById('searchBtn');
        const searchBarContainer = document.getElementById('searchBarContainer');
        const closeSearchBtn = document.getElementById('closeSearchBtn');
        const searchInput = document.getElementById('searchInput');

        searchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            searchBarContainer.classList.add('active');
            pageOverlay.classList.add('show');
            searchInput.focus();
        });

        closeSearchBtn.addEventListener('click', () => {
            searchBarContainer.classList.remove('active');
            pageOverlay.classList.remove('show');
        });

        document.getElementById('cartBtn').addEventListener('click', (e) => {
            e.preventDefault();
            if (!currentUser) {
                window.location.href = 'auth.html';
            } else {
                window.location.href = 'cart.html';
            }
        });

    } catch (error) {
        console.error(error);
    }
});


// =========================================
// XỬ LÝ CLICK DANH MỤC KHI ĐANG Ở TRANG KHÁC (V2 - CHỐNG TRƯỢT)
// =========================================
document.addEventListener('click', (e) => {
    // Dùng closest() để đảm bảo dù click vào chữ hay viền thì vẫn bắt trúng khối danh mục
    const categoryItem = e.target.closest('.sub-category-item');
    
    if (categoryItem) {
        const categoryId = categoryItem.getAttribute('data-id');
        const categoryName = categoryItem.innerText;

        // Quét URL xem có đang ở trang chủ không (dùng includes cho chắc chắn)
        const path = window.location.pathname.toLowerCase();
        const isHomePage = path.includes('index.html') || path === '/' || path.endsWith('/fstore/');

        if (!isHomePage) {
            e.preventDefault(); // Ngăn chặn các hành vi nhảy trang lộn xộn
            localStorage.setItem('pendingCategoryLoad', JSON.stringify({ id: categoryId, name: categoryName }));
            window.location.href = 'index.html'; // Điều hướng về trang chủ
        }
    }
});


// =========================================
// XỬ LÝ TÌM KIẾM KHI ĐANG Ở TRANG KHÁC (GIỎ HÀNG, PROFILE...)
// =========================================
const searchInputEl = document.getElementById('searchInput');
if (searchInputEl) {
    searchInputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const keyword = searchInputEl.value.trim();
            if (!keyword) return;

            // Kiểm tra xem có đang ở trang chủ không
            const path = window.location.pathname.toLowerCase();
            const isHomePage = path.includes('index.html') || path === '/' || path.endsWith('/fstore/');

            // Nếu KHÔNG phải trang chủ -> Lưu từ khóa và chuyển hướng
            if (!isHomePage) {
                e.preventDefault();
                localStorage.setItem('pendingSearchKeyword', keyword);
                window.location.href = 'index.html';
            }
        }
    });
}