import { auth, db } from '../models/firebaseConfig.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // Các phần tử giao diện cơ bản
    const adminEmail = document.getElementById('adminEmail');
    const tabs = document.querySelectorAll('.nav-menu li[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');

    // Chuyển Tab
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.getAttribute('data-tab')}`).classList.add('active');
        });
    });

    // Định dạng tiền
    const formatPrice = (p) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

    // Biến toàn cục lưu danh mục để dùng lại
    let categoriesList = [];

    // --- XÁC THỰC QUYỀN ADMIN ---
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'auth.html';
            return;
        }
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
            adminEmail.innerText = `Xin chào, ${user.email}`;
            loadAdminData();
        } else {
            alert("Bạn không có quyền truy cập trang này!");
            window.location.href = 'index.html';
        }
    });

    // --- TẢI TOÀN BỘ DỮ LIỆU ---
    const loadAdminData = async () => {
        // 1. Tải Danh mục
        const catSnap = await getDocs(query(collection(db, "categories"), orderBy("order")));
        categoriesList = [];
        let catHtml = '';
        let parentOptionsHtml = '<option value="">-- Không có (Danh mục gốc) --</option>';
        let prodCatOptionsHtml = '';

        catSnap.forEach(doc => {
            const c = doc.data();
            categoriesList.push(c);
            const parentName = c.parentId ? categoriesList.find(x => x.id === c.parentId)?.name || c.parentId : "Gốc";
            catHtml += `<tr>
                <td>${c.id}</td>
                <td><strong>${c.name}</strong></td>
                <td>${parentName}</td>
                <td><button class="btn-action btn-del" onclick="deleteCategory('${c.id}')">Xóa</button></td>
            </tr>`;
            
            // Đổ vào Select Box
            if(!c.parentId) parentOptionsHtml += `<option value="${c.id}">${c.name}</option>`;
            if(c.parentId) prodCatOptionsHtml += `<option value="${c.id}">${c.name}</option>`;
        });
        document.getElementById('adminCategoryList').innerHTML = catHtml;
        document.getElementById('catParentId').innerHTML = parentOptionsHtml;
        document.getElementById('prodCategory').innerHTML = prodCatOptionsHtml;

        // 2. Tải Sản phẩm
        const prodSnap = await getDocs(collection(db, "products"));
        document.getElementById('statProducts').innerText = prodSnap.size;
        let prodHtml = '';
        prodSnap.forEach(doc => {
            const p = doc.data();
            // Lấy tên danh mục động từ categoriesList
            const catName = categoriesList.find(c => c.id === p.categoryId)?.name || "Chưa phân loại";
            prodHtml += `<tr>
                <td>${p.name}</td>
                <td>${catName}</td>
                <td>${p.variants && p.variants.length > 0 ? formatPrice(p.variants[0].price) : "0 đ"}</td>
                <td><button class="btn-action btn-del" onclick="deleteProduct('${doc.id}')">Xóa</button></td>
            </tr>`;
        });
        document.getElementById('adminProductList').innerHTML = prodHtml;

        // 3. Tải Đơn hàng & Forum (Tương tự code cũ)
        const orderSnap = await getDocs(collection(db, "orders"));
        document.getElementById('statOrders').innerText = orderSnap.size;
        let totalRev = 0, orderHtml = '';
        orderSnap.forEach(doc => {
            const o = doc.data();
            totalRev += o.totalAmount;
            orderHtml += `<tr><td>${o.orderId}</td><td>${o.userEmail || o.userId}</td><td>${formatPrice(o.totalAmount)}</td><td><span style="color:#34c759; font-weight:bold;">${o.status}</span></td></tr>`;
        });
        document.getElementById('statRevenue').innerText = formatPrice(totalRev);
        document.getElementById('adminOrderList').innerHTML = orderHtml || '<tr><td colspan="4">Chưa có đơn hàng</td></tr>';

        const forumSnap = await getDocs(query(collection(db, "forum_posts"), orderBy("createdAt", "desc")));
        let forumHtml = '';
        forumSnap.forEach(snap => {
            const f = snap.data();
            forumHtml += `<tr><td>${f.email}</td><td>${f.question}</td>
            <td><button class="btn-action btn-save" onclick="replyForum('${snap.id}')">Trả lời</button></td></tr>`;
        });
        document.getElementById('adminForumList').innerHTML = forumHtml || '<tr><td colspan="3">Không có câu hỏi mới</td></tr>';
    };

    // --- LOGIC MODAL DANH MỤC ---
    const catModal = document.getElementById('categoryModal');
    document.getElementById('btnAddCategory').onclick = () => { document.getElementById('categoryForm').reset(); catModal.style.display = "block"; }
    document.getElementById('closeCatModal').onclick = () => catModal.style.display = "none";

    document.getElementById('categoryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('catId').value.trim();
        const data = {
            id: id,
            name: document.getElementById('catName').value.trim(),
            parentId: document.getElementById('catParentId').value || null,
            order: categoriesList.length + 1
        };
        await setDoc(doc(db, "categories", id), data);
        alert("Lưu danh mục thành công!");
        catModal.style.display = "none";
        loadAdminData();
    });

    window.deleteCategory = async (id) => {
        if(confirm("Bạn có chắc muốn xóa danh mục này?")) {
            await deleteDoc(doc(db, "categories", id));
            loadAdminData();
        }
    };

    // --- LOGIC MODAL SẢN PHẨM ---
    const prodModal = document.getElementById('productModal');
    const variantsContainer = document.getElementById('variantsContainer');
    
    document.getElementById('btnAddProduct').onclick = () => { 
        document.getElementById('productForm').reset(); 
        variantsContainer.innerHTML = ''; // Xóa trắng biến thể
        addVariantRow(); // Thêm 1 dòng trống mặc định
        prodModal.style.display = "block"; 
    }
    document.getElementById('closeProdModal').onclick = () => prodModal.style.display = "none";

    // Hàm tạo dòng biến thể động
    const addVariantRow = () => {
        const row = document.createElement('div');
        row.className = 'variant-row';
        row.innerHTML = `
            <input type="text" placeholder="Màu sắc (VD: Đen)" class="v-color" required>
            <input type="text" placeholder="Dung lượng (VD: 256GB)" class="v-storage" required>
            <input type="number" placeholder="Giá tiền (VNĐ)" class="v-price" required>
            <input type="text" placeholder="Link ảnh (URL)" class="v-image" required>
            <button type="button" class="btn-action btn-del" onclick="this.parentElement.remove()">X</button>
        `;
        variantsContainer.appendChild(row);
    };
    document.getElementById('btnAddVariant').onclick = addVariantRow;

    // Lưu Sản Phẩm
    document.getElementById('productForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Thu thập mảng biến thể
        const variants = [];
        document.querySelectorAll('.variant-row').forEach((row, index) => {
            variants.push({
                variantId: `v${index + 1}`,
                color: row.querySelector('.v-color').value,
                storage: row.querySelector('.v-storage').value,
                price: Number(row.querySelector('.v-price').value),
                image: row.querySelector('.v-image').value,
                stock: 100 // Mặc định
            });
        });

        if (variants.length === 0) return alert("Vui lòng thêm ít nhất 1 biến thể!");

        const newId = "prod_" + Date.now();
        const data = {
            id: newId,
            name: document.getElementById('prodName').value.trim(),
            categoryId: document.getElementById('prodCategory').value,
            description: document.getElementById('prodDesc').value.trim(),
            techSpecs: { info: "Cập nhật sau" }, // Giữ đơn giản
            variants: variants
        };

        await setDoc(doc(db, "products", newId), data);
        alert("Đã thêm sản phẩm thành công!");
        prodModal.style.display = "none";
        loadAdminData();
    });

    window.deleteProduct = async (id) => {
        if(confirm("Xóa sản phẩm này vĩnh viễn?")) {
            await deleteDoc(doc(db, "products", id));
            loadAdminData();
        }
    };

    // --- LOGIC DIỄN ĐÀN (Cũ) ---
    window.replyForum = async (id) => {
        const reply = prompt("Nhập nội dung trả lời:");
        if (reply) {
            await updateDoc(doc(db, "forum_posts", id), { adminReply: reply });
            loadAdminData();
        }
    };
});