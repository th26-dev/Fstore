import { auth, db } from '../models/firebaseConfig.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const adminEmail = document.getElementById('adminEmail');
    const tabs = document.querySelectorAll('.nav-menu li[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.getAttribute('data-tab')}`).classList.add('active');
        });
    });

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

    let categoriesList = [];
    let isEditCategory = false;

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

    const loadAdminData = async () => {
        // Tải Danh mục
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
                <td>
                    <button class="btn-action btn-save" onclick="editCategory('${c.id}')" style="margin-right: 5px; background: #f59e0b;">Sửa</button>
                    <button class="btn-action btn-del" onclick="deleteCategory('${c.id}')">Xóa</button>
                </td>
            </tr>`;
            
            if(!c.parentId) parentOptionsHtml += `<option value="${c.id}">${c.name}</option>`;
            if(c.parentId) prodCatOptionsHtml += `<option value="${c.id}">${c.name}</option>`;
        });
        document.getElementById('adminCategoryList').innerHTML = catHtml;
        document.getElementById('catParentId').innerHTML = parentOptionsHtml;
        document.getElementById('prodCategory').innerHTML = prodCatOptionsHtml;

        // Tải Sản phẩm
        const prodSnap = await getDocs(collection(db, "products"));
        document.getElementById('statProducts').innerText = prodSnap.size;
        let prodHtml = '';
        prodSnap.forEach(doc => {
            const p = doc.data();
            const catName = categoriesList.find(c => c.id === p.categoryId)?.name || "Chưa phân loại";
            prodHtml += `<tr>
                <td>${p.name}</td>
                <td>${catName}</td>
                <td>${p.variants && p.variants.length > 0 ? formatPrice(p.variants[0].price) : "0 đ"}</td>
                <td><button class="btn-action btn-del" onclick="deleteProduct('${doc.id}')">Xóa</button></td>
            </tr>`;
        });
        document.getElementById('adminProductList').innerHTML = prodHtml;

        // Tải Đơn hàng
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

        // Tải Diễn đàn
        const forumSnap = await getDocs(query(collection(db, "forum_posts"), orderBy("createdAt", "desc")));
        let forumHtml = '';
        forumSnap.forEach(snap => {
            const f = snap.data();
            forumHtml += `<tr><td>${f.email}</td><td>${f.question}</td>
            <td><button class="btn-action btn-save" onclick="replyForum('${snap.id}')">Trả lời</button></td></tr>`;
        });
        document.getElementById('adminForumList').innerHTML = forumHtml || '<tr><td colspan="3">Không có câu hỏi mới</td></tr>';
    };

    // --- LOGIC DANH MỤC ---
    const catModal = document.getElementById('categoryModal');
    
    document.getElementById('btnAddCategory').onclick = () => { 
        isEditCategory = false; 
        document.getElementById('categoryForm').reset(); 
        document.getElementById('catId').readOnly = false; 
        document.getElementById('catModalTitle').innerText = "Thêm Danh Mục Mới";
        catModal.style.display = "block"; 
    }
    
    document.getElementById('closeCatModal').onclick = () => catModal.style.display = "none";

    window.editCategory = (id) => {
        isEditCategory = true; 
        const cat = categoriesList.find(c => c.id === id);
        if (cat) {
            document.getElementById('catId').value = cat.id;
            document.getElementById('catId').readOnly = true; 
            document.getElementById('catName').value = cat.name;
            document.getElementById('catParentId').value = cat.parentId || "";
            document.getElementById('catModalTitle').innerText = "Sửa Danh Mục";
            catModal.style.display = "block";
        }
    };

    document.getElementById('categoryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('catId').value.trim();
        const parentId = document.getElementById('catParentId').value || null;

        if (isEditCategory && id === parentId) {
            alert("Lỗi: Một danh mục không thể làm danh mục cha của chính nó!");
            return;
        }

        const data = {
            id: id,
            name: document.getElementById('catName').value.trim(),
            parentId: parentId,
            order: isEditCategory ? categoriesList.find(c => c.id === id).order : categoriesList.length + 1
        };

        if (isEditCategory) {
            await updateDoc(doc(db, "categories", id), data);
            alert("Cập nhật danh mục thành công!");
        } else {
            await setDoc(doc(db, "categories", id), data);
            alert("Thêm danh mục thành công!");
        }
        
        catModal.style.display = "none";
        loadAdminData();
    });

    // Hàm Xóa Danh mục (Xóa dây chuyền: Cha -> Con -> Sản phẩm)
    window.deleteCategory = async (id) => {
        if(confirm("CẢNH BÁO: Bạn có chắc muốn xóa danh mục này?\n\nNẾU ĐÂY LÀ DANH MỤC CHA: Tất cả Danh mục con và Sản phẩm bên trong sẽ bị xóa sạch!\nNẾU ĐÂY LÀ DANH MỤC CON: Tất cả Sản phẩm thuộc danh mục này sẽ bị xóa!")) {
            try {
                const childCategories = categoriesList.filter(c => c.parentId === id);
                const childCategoryIds = childCategories.map(c => c.id);
                const allCategoryIdsToDelete = [id, ...childCategoryIds];

                const prodSnap = await getDocs(collection(db, "products"));
                const deletePromises = []; 

                prodSnap.forEach(docSnap => {
                    const prod = docSnap.data();
                    if (allCategoryIdsToDelete.includes(prod.categoryId)) {
                        deletePromises.push(deleteDoc(doc(db, "products", docSnap.id)));
                    }
                });

                childCategoryIds.forEach(childId => {
                    deletePromises.push(deleteDoc(doc(db, "categories", childId)));
                });

                deletePromises.push(deleteDoc(doc(db, "categories", id)));
                await Promise.all(deletePromises);

                alert("Đã quét sạch danh mục và toàn bộ dữ liệu liên quan!");
                loadAdminData(); 
            } catch (error) {
                console.error("Lỗi khi xóa dây chuyền:", error);
                alert("Có lỗi xảy ra khi xóa dữ liệu!");
            }
        }
    };

    // --- LOGIC MODAL SẢN PHẨM ---
    const prodModal = document.getElementById('productModal');
    const variantsContainer = document.getElementById('variantsContainer');
    const specsContainer = document.getElementById('specsContainer');
    
    document.getElementById('btnAddProduct').onclick = () => { 
        document.getElementById('productForm').reset(); 
        variantsContainer.innerHTML = ''; 
        specsContainer.innerHTML = ''; 
        addVariantRow(); 
        addSpecRow();
        prodModal.style.display = "block"; 
    }
    document.getElementById('closeProdModal').onclick = () => prodModal.style.display = "none";

    const addVariantRow = () => {
        const row = document.createElement('div');
        row.className = 'variant-row';
        row.innerHTML = `
            <input type="text" placeholder="Màu sắc (VD: Đen)" class="v-color" required>
            <input type="text" placeholder="Dung lượng (VD: 256GB)" class="v-storage" required>
            <input type="number" placeholder="Giá tiền (VNĐ)" class="v-price" required>
            <input type="text" placeholder="Link ảnh 1, Link ảnh 2..." class="v-image" required title="Cách nhau bởi dấu phẩy">
            <button type="button" class="btn-action btn-del" onclick="this.parentElement.remove()">X</button>
        `;
        variantsContainer.appendChild(row);
    };
    document.getElementById('btnAddVariant').onclick = addVariantRow;

    const addSpecRow = () => {
        const row = document.createElement('div');
        row.className = 'variant-row';
        row.innerHTML = `
            <input type="text" placeholder="Tên (VD: Màn hình)" class="s-key">
            <input type="text" placeholder="Giá trị (VD: 6.2 inches)" class="s-val" style="flex: 2;">
            <button type="button" class="btn-action btn-del" onclick="this.parentElement.remove()">X</button>
        `;
        specsContainer.appendChild(row);
    };
    document.getElementById('btnAddSpec').onclick = addSpecRow;

    document.getElementById('productForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Thu thập Biến thể và tách chuỗi ảnh bằng dấu phẩy
        const variants = [];
        document.querySelectorAll('#variantsContainer .variant-row').forEach((row, index) => {
            const rawImages = row.querySelector('.v-image').value;
            const imgArray = rawImages.split(',').map(img => img.trim()).filter(img => img !== '');

            variants.push({
                variantId: `v${index + 1}`,
                color: row.querySelector('.v-color').value,
                storage: row.querySelector('.v-storage').value,
                price: Number(row.querySelector('.v-price').value),
                images: imgArray.length > 0 ? imgArray : ["https://via.placeholder.com/400"],
                stock: 100 
            });
        });

        if (variants.length === 0) return alert("Vui lòng thêm ít nhất 1 biến thể!");

        // Thu thập Thông số kỹ thuật thành Object
        const techSpecs = {};
        document.querySelectorAll('#specsContainer .variant-row').forEach(row => {
            const key = row.querySelector('.s-key').value.trim();
            const val = row.querySelector('.s-val').value.trim();
            if(key && val) {
                techSpecs[key] = val;
            }
        });

        const newId = "prod_" + Date.now();
        const data = {
            id: newId,
            name: document.getElementById('prodName').value.trim(),
            categoryId: document.getElementById('prodCategory').value,
            description: document.getElementById('prodDesc').value.trim(),
            techSpecs: techSpecs, 
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

    window.replyForum = async (id) => {
        const reply = prompt("Nhập nội dung trả lời:");
        if (reply) {
            await updateDoc(doc(db, "forum_posts", id), { adminReply: reply });
            loadAdminData();
        }
    };
});