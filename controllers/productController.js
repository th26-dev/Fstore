import { db, auth } from '../models/firebaseConfig.js';
import { collection, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const productGrid = document.getElementById('productGrid');
    const sectionTitle = document.getElementById('sectionTitle');
    const searchInput = document.getElementById('searchInput');
    const searchBarContainer = document.getElementById('searchBarContainer');
    const pageOverlay = document.getElementById('pageOverlay');
    const megaMenu = document.getElementById('megaMenu');
    
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
    
    const formatPrice = (price) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    };

    const renderProducts = (products, title) => {
        sectionTitle.style.display = 'block';
        sectionTitle.innerText = title;
        
        if (products.length === 0) {
            productGrid.innerHTML = '<p style="grid-column: 1 / -1; font-size: 18px;">Không tìm thấy sản phẩm nào.</p>';
            return;
        }

        let html = '';
        products.forEach(prod => {
            const defaultVariant = prod.variants[0]; 
            html += `
                <div class="product-card" data-id="${prod.id}">
                    <img src="${defaultVariant.image}" alt="${prod.name}" class="product-img">
                    <h3 class="product-name">${prod.name}</h3>
                    <p class="product-price">${formatPrice(defaultVariant.price)}</p>
                    <a href="#" class="btn-view">Xem chi tiết</a>
                </div>
            `;
        });
        productGrid.innerHTML = html;
        window.scrollTo({ top: 300, behavior: 'smooth' });
    };

    const openPopover = async (productId) => {
        try {
            const docRef = doc(db, "products", productId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                currentProduct = docSnap.data();
                selectedVariant = currentProduct.variants[0];

                popoverName.innerText = currentProduct.name;
                popoverDesc.innerText = currentProduct.description;
                
                let specsHtml = '';
                for (const [key, value] of Object.entries(currentProduct.techSpecs)) {
                    specsHtml += `<strong>${key.toUpperCase()}:</strong> ${value}<br>`;
                }
                popoverSpecs.innerHTML = specsHtml;

                updatePopoverVariantUI();

                let variantsHtml = '';
                currentProduct.variants.forEach((v, index) => {
                    variantsHtml += `<button class="variant-btn ${index === 0 ? 'active' : ''}" data-index="${index}">${v.color} - ${v.storage}</button>`;
                });
                popoverVariants.innerHTML = variantsHtml;

                productPopover.classList.add('active');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const updatePopoverVariantUI = () => {
        popoverImg.src = selectedVariant.image;
        popoverPrice.innerText = formatPrice(selectedVariant.price);
    };

    document.addEventListener('click', async (e) => {
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

        const productCard = e.target.closest('.product-card');
        if (productCard) {
            const productId = productCard.getAttribute('data-id');
            openPopover(productId);
        }

        if (e.target.classList.contains('variant-btn')) {
            document.querySelectorAll('.variant-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            
            const variantIndex = e.target.getAttribute('data-index');
            selectedVariant = currentProduct.variants[variantIndex];
            updatePopoverVariantUI();
        }
    });

    closePopoverBtn.addEventListener('click', () => {
        productPopover.classList.remove('active');
    });

   addToCartBtn.addEventListener('click', () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        window.location.href = 'auth.html';
        return;
    }

    // Tạo đối tượng sản phẩm để lưu
    const productToSave = {
        id: currentProduct.id,
        name: currentProduct.name,
        price: selectedVariant.price,
        image: selectedVariant.image,
        color: selectedVariant.color,
        storage: selectedVariant.storage
    };

    // Lấy giỏ hàng cũ ra, thêm cái mới vào, rồi lưu lại
    const cartKey = `cart_${currentUser.uid}`;
    const currentCart = JSON.parse(localStorage.getItem(cartKey)) || [];
    currentCart.push(productToSave);
    localStorage.setItem(cartKey, JSON.stringify(currentCart));

    alert(`Đã thêm ${currentProduct.name} vào giỏ hàng!`);
    productPopover.classList.remove('active'); // Đóng popover sau khi thêm
});
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
});