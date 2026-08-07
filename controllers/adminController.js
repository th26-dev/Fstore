import { auth, db } from '../models/firebaseConfig.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const adminEmail = document.getElementById('adminEmail');
    const tabs = document.querySelectorAll('.nav-menu li[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');

    // ==========================================
    // ĐỘNG CƠ CUSTOM POPUP (Thay thế alert, confirm, prompt)
    // ==========================================
    const FStoreDialog = {
        show: function(title, message, type = 'info', callback = null) {
            const overlay = document.getElementById('fstorePopup');
            document.getElementById('popupTitle').innerText = title;
            
            const msgEl = document.getElementById('popupMessage');
            if(type === 'prompt') {
                msgEl.innerHTML = `${message}<br><br><input type="text" id="popupInput" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; outline:none;">`;
            } else {
                msgEl.innerText = message;
            }
            
            const actionsDiv = document.getElementById('popupActions');
            actionsDiv.innerHTML = ''; 

            const btnStyle = "padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;";
            
            if (type === 'confirm' || type === 'prompt') {
                actionsDiv.innerHTML = `
                    <button id="btnCancel" style="${btnStyle} background: #e5e5ea; color: #333;">Hủy</button>
                    <button id="btnConfirm" style="${btnStyle} background: #007aff; color: white;">Đồng ý</button>
                `;
                document.getElementById('btnCancel').onclick = () => this.close();
                document.getElementById('btnConfirm').onclick = () => {
                    let val = type === 'prompt' ? document.getElementById('popupInput').value : true;
                    this.close();
                    if(callback) callback(val);
                };
            } else { 
                actionsDiv.innerHTML = `<button id="btnOk" style="${btnStyle} background: #007aff; color: white;">Đóng</button>`;
                document.getElementById('btnOk').onclick = () => {
                    this.close();
                    if(callback) callback();
                };
            }
            overlay.style.display = 'flex';
        },
        close: function() {
            document.getElementById('fstorePopup').style.display = 'none';
        }
    };

    // ==========================================
    // THUẬT TOÁN NÉN ẢNH (CANVAS HTML5) 
    // ==========================================
    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 500; 
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > MAX_WIDTH) {
                        height = Math.round((height * MAX_WIDTH) / width);
                        width = MAX_WIDTH;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(compressedBase64);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.getAttribute('data-tab')}`).classList.add('active');
        });
    });

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);
    const formatDate = (timestamp) => {
        if (!timestamp) return "Không rõ thời gian";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' });
    };

    let categoriesList = [];
    let productsList = [];
    let ordersList = [];
    let isEditCategory = false;
    
    // BIẾN TRẠNG THÁI CHO GIAO DIỆN 2 CỘT
    let activeParentCatId = null; 
    let selectedCatIds = new Set(); // Chứa ID các danh mục được tick Checkbox

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
            FStoreDialog.show("Cảnh báo", "Bạn không có quyền truy cập trang này!", "info", () => {
                window.location.href = 'index.html';
            });
        }
    });

    const loadAdminData = async () => {
        // TẢI DANH MỤC
        const catSnap = await getDocs(query(collection(db, "categories"), orderBy("order")));
        categoriesList = [];
        let parentOptionsHtml = '<option value="">-- Không có (Danh mục gốc) --</option>';
        let prodCatOptionsHtml = '';
        let filterCatOptionsHtml = '<option value="all">Tất cả danh mục</option>';

        catSnap.forEach(doc => {
            const c = doc.data();
            categoriesList.push(c);
            if(!c.parentId) parentOptionsHtml += `<option value="${c.id}">${c.name}</option>`;
            prodCatOptionsHtml += `<option value="${c.id}">${c.name}</option>`;
            filterCatOptionsHtml += `<option value="${c.id}">${c.name}</option>`;
        });
        
        document.getElementById('catParentId').innerHTML = parentOptionsHtml;
        document.getElementById('prodCategory').innerHTML = prodCatOptionsHtml;
        
        const filterSelect = document.getElementById('filterProductCategory');
        if (filterSelect) {
            const currentFilter = filterSelect.value;
            filterSelect.innerHTML = filterCatOptionsHtml;
            filterSelect.value = currentFilter || "all";
            filterSelect.onchange = (e) => renderProductsTable(e.target.value);
        }

        // GỌI HÀM RENDER 2 CỘT MỚI
        renderParentCategories();

        // TẢI SẢN PHẨM
        const prodSnap = await getDocs(collection(db, "products"));
        productsList = [];
        prodSnap.forEach(doc => productsList.push(doc.data()));
        renderProductsTable(filterSelect ? filterSelect.value : "all");

        // TẢI ĐƠN HÀNG
        const orderSnap = await getDocs(collection(db, "orders"));
        ordersList = [];
        let totalRev = 0;
        orderSnap.forEach(doc => {
            const o = doc.data();
            o.id = doc.id; 
            ordersList.push(o);
            totalRev += (o.totalAmount || o.totalPrice || 0);
        });
        document.getElementById('statOrders').innerText = ordersList.length;
        document.getElementById('statRevenue').innerText = formatPrice(totalRev);
        renderOrdersTable();

        const sortOrderSelect = document.getElementById('sortOrderSelect');
        if (sortOrderSelect) sortOrderSelect.addEventListener('change', renderOrdersTable);

        // TẢI DIỄN ĐÀN
        const forumSnap = await getDocs(query(collection(db, "forum_posts"), orderBy("createdAt", "desc")));
        let forumHtml = '';
        forumSnap.forEach(snap => {
            const f = snap.data();
            forumHtml += `<tr>
                <td>${f.email}</td><td>${f.question}</td>
                <td>
                    <button class="btn-action btn-save" onclick="replyForum('${snap.id}')" style="margin-right: 5px;">Trả lời</button>
                    <button class="btn-action btn-del" onclick="deleteForum('${snap.id}')">Xóa</button>
                </td>
            </tr>`;
        });
        document.getElementById('adminForumList').innerHTML = forumHtml || '<tr><td colspan="3">Không có câu hỏi mới</td></tr>';
    };

    // =====================================
    // LOGIC RENDER DANH MỤC 2 CỘT VÀ CHECKBOX
    // =====================================
    const renderParentCategories = () => {
        const parentListDiv = document.getElementById('parentCategoryList');
        let html = '';
        const parents = categoriesList.filter(c => !c.parentId);

        parents.forEach(c => {
            const isActive = c.id === activeParentCatId ? 'active' : '';
            const isChecked = selectedCatIds.has(c.id) ? 'checked' : '';
            
            html += `
            <div class="cat-item ${isActive}" onclick="selectParentCategory('${c.id}')">
                <div class="cat-item-left">
                    <input type="checkbox" class="cat-checkbox" value="${c.id}" ${isChecked} onclick="event.stopPropagation(); toggleCatSelection('${c.id}')">
                    <span>${c.name}</span>
                </div>
                <div class="cat-item-right">
                    <button class="btn-action btn-save" style="padding: 6px 10px;" onclick="event.stopPropagation(); editCategory('${c.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-action btn-del" style="padding: 6px 10px;" onclick="event.stopPropagation(); deleteCategory('${c.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
        });
        parentListDiv.innerHTML = html || '<p class="empty-msg">Chưa có danh mục gốc nào.</p>';
        toggleBulkDeleteBtn();

        if (activeParentCatId) {
            renderChildCategories(activeParentCatId);
        } else {
            document.getElementById('childCategoryList').innerHTML = '<p class="empty-msg">Vui lòng chọn một Danh mục gốc bên trái để xem chi tiết.</p>';
            document.getElementById('btnAddChildCategory').style.display = 'none';
            document.getElementById('childColTitle').innerText = 'Danh mục Con';
        }
    };

    window.selectParentCategory = (id) => {
        activeParentCatId = id;
        renderParentCategories();
    };

    const renderChildCategories = (parentId) => {
        const parent = categoriesList.find(c => c.id === parentId);
        document.getElementById('childColTitle').innerText = `Thuộc: ${parent ? parent.name : ''}`;
        document.getElementById('btnAddChildCategory').style.display = 'inline-block';

        const childListDiv = document.getElementById('childCategoryList');
        let html = '';
        const children = categoriesList.filter(c => c.parentId === parentId);

        children.forEach(c => {
            const isChecked = selectedCatIds.has(c.id) ? 'checked' : '';
            html += `
            <div class="cat-item">
                <div class="cat-item-left">
                    <input type="checkbox" class="cat-checkbox" value="${c.id}" ${isChecked} onclick="event.stopPropagation(); toggleCatSelection('${c.id}')">
                    <span>${c.name}</span>
                </div>
                <div class="cat-item-right">
                    <button class="btn-action btn-save" style="padding: 6px 10px;" onclick="editCategory('${c.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-action btn-del" style="padding: 6px 10px;" onclick="deleteCategory('${c.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
        });
        childListDiv.innerHTML = html || '<p class="empty-msg">Chưa có danh mục con nào.</p>';
    };

    // LOGIC CHECKBOX & XÓA NHIỀU
    window.toggleCatSelection = (id) => {
        if (selectedCatIds.has(id)) selectedCatIds.delete(id);
        else selectedCatIds.add(id);
        toggleBulkDeleteBtn();
    };

    const toggleBulkDeleteBtn = () => {
        const btn = document.getElementById('btnDeleteMultipleCats');
        if (selectedCatIds.size > 0) {
            btn.style.display = 'inline-block';
            btn.innerText = `Thùng rác: Xóa ${selectedCatIds.size} mục đã chọn`;
        } else {
            btn.style.display = 'none';
        }
    };

    document.getElementById('btnDeleteMultipleCats').onclick = () => {
        FStoreDialog.show("Cảnh báo nguy hiểm", `Xóa vĩnh viễn ${selectedCatIds.size} danh mục đã chọn? (Bao gồm cả các danh mục con và TOÀN BỘ SẢN PHẨM bên trong)`, "confirm", async () => {
            const deletePromises = [];
            let idsToDelete = new Set([...selectedCatIds]);
            
            // Tìm tất cả danh mục con của các mục đang chọn
            selectedCatIds.forEach(id => {
                categoriesList.filter(c => c.parentId === id).forEach(child => idsToDelete.add(child.id));
            });

            // Lọc và xóa Sản phẩm thuộc các danh mục bị xóa
            const prodSnap = await getDocs(collection(db, "products"));
            prodSnap.forEach(docSnap => {
                const prod = docSnap.data();
                if (idsToDelete.has(prod.categoryId)) {
                    deletePromises.push(deleteDoc(doc(db, "products", docSnap.id)));
                }
            });

            // Xóa Danh mục
            idsToDelete.forEach(id => deletePromises.push(deleteDoc(doc(db, "categories", id))));

            await Promise.all(deletePromises);
            selectedCatIds.clear(); 
            activeParentCatId = null; 
            FStoreDialog.show("Thành công", "Đã xóa hàng loạt danh mục và sản phẩm liên quan!", "info");
            loadAdminData();
        });
    };

    // QUẢN LÝ DANH MỤC THÊM/SỬA/XÓA CÁ NHÂN
    const catModal = document.getElementById('categoryModal');
    
    document.getElementById('catImageFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            const base64Str = await compressImage(file);
            document.getElementById('catImage').value = base64Str;
            document.getElementById('catPreviewImage').src = base64Str;
            document.getElementById('catPreviewImage').style.display = 'block';
        }
    });

    document.getElementById('btnAddParentCategory').onclick = () => { 
        isEditCategory = false; 
        document.getElementById('categoryForm').reset(); 
        document.getElementById('catId').readOnly = false; 
        document.getElementById('catImage').value = ""; 
        document.getElementById('catPreviewImage').style.display = "none";
        document.getElementById('catParentId').value = ""; 
        document.getElementById('catParentId').disabled = true; // Khóa dropdown
        document.getElementById('catModalTitle').innerText = "Thêm Danh Mục Gốc";
        catModal.style.display = "block"; 
    };

    document.getElementById('btnAddChildCategory').onclick = () => { 
        isEditCategory = false; 
        document.getElementById('categoryForm').reset(); 
        document.getElementById('catId').readOnly = false; 
        document.getElementById('catImage').value = ""; 
        document.getElementById('catPreviewImage').style.display = "none";
        document.getElementById('catParentId').value = activeParentCatId; 
        document.getElementById('catParentId').disabled = true; // Khóa dropdown
        document.getElementById('catModalTitle').innerText = "Thêm Danh Mục Con";
        catModal.style.display = "block"; 
    };
    
    document.getElementById('closeCatModal').onclick = () => catModal.style.display = "none";

    window.editCategory = (id) => {
        isEditCategory = true; 
        const cat = categoriesList.find(c => c.id === id);
        if (cat) {
            document.getElementById('catId').value = cat.id;
            document.getElementById('catId').readOnly = true; 
            document.getElementById('catName').value = cat.name;
            document.getElementById('catParentId').value = cat.parentId || "";
            document.getElementById('catParentId').disabled = false; // Cho phép đổi cha
            document.getElementById('catImage').value = cat.imageUrl || ""; 
            
            const preview = document.getElementById('catPreviewImage');
            if(cat.imageUrl) { preview.src = cat.imageUrl; preview.style.display = 'block'; } 
            else { preview.style.display = 'none'; }

            document.getElementById('catModalTitle').innerText = "Sửa Danh Mục";
            catModal.style.display = "block";
        }
    };

    document.getElementById('categoryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('catId').value.trim();
        const parentId = document.getElementById('catParentId').value || null;

        if (isEditCategory && id === parentId) {
            FStoreDialog.show("Lỗi", "Một danh mục không thể làm danh mục cha của chính nó!", "info");
            return;
        }

        const data = {
            id: id, name: document.getElementById('catName').value.trim(),
            parentId: parentId, imageUrl: document.getElementById('catImage').value.trim(), 
            order: isEditCategory ? categoriesList.find(c => c.id === id).order : categoriesList.length + 1
        };

        if (isEditCategory) {
            await updateDoc(doc(db, "categories", id), data);
            FStoreDialog.show("Thành công", "Cập nhật danh mục thành công!", "info");
        } else {
            await setDoc(doc(db, "categories", id), data);
            FStoreDialog.show("Thành công", "Thêm danh mục thành công!", "info");
        }
        
        catModal.style.display = "none";
        loadAdminData();
    });

    window.deleteCategory = (id) => {
        FStoreDialog.show("Cảnh báo nguy hiểm", "Bạn có chắc muốn xóa danh mục này?\n\n- Nếu là Gốc: Xóa toàn bộ con & sản phẩm.\n- Nếu là Con: Xóa toàn bộ sản phẩm bên trong.", "confirm", async () => {
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
                childCategoryIds.forEach(childId => deletePromises.push(deleteDoc(doc(db, "categories", childId))));
                deletePromises.push(deleteDoc(doc(db, "categories", id)));
                await Promise.all(deletePromises);

                if (id === activeParentCatId) activeParentCatId = null;
                selectedCatIds.delete(id);

                FStoreDialog.show("Thành công", "Đã xóa danh mục và dữ liệu liên quan!", "info");
                loadAdminData(); 
            } catch (error) {
                console.error(error);
                FStoreDialog.show("Lỗi", "Có lỗi xảy ra khi xóa dữ liệu!", "info");
            }
        });
    };

    // =====================================
    // RENDER SẢN PHẨM & BẢNG SẢN PHẨM
    // =====================================
    const renderProductsTable = (filterCatId) => {
        let prodHtml = '';
        const filteredProducts = (filterCatId === "all") ? productsList : productsList.filter(p => p.categoryId === filterCatId);
        document.getElementById('statProducts').innerText = filteredProducts.length;

        filteredProducts.forEach(p => {
            const catName = categoriesList.find(c => c.id === p.categoryId)?.name || "Chưa phân loại";
            prodHtml += `<tr>
                <td>${p.name}</td>
                <td>${catName}</td>
                <td>${p.variants && p.variants.length > 0 ? formatPrice(p.variants[0].price) : "0 đ"}</td>
                <td>
                    <button class="btn-action btn-save" onclick="editProduct('${p.id}')" style="margin-right: 5px; background: #f59e0b;">Sửa</button>
                    <button class="btn-action btn-del" onclick="deleteProduct('${p.id}')">Xóa</button>
                </td>
            </tr>`;
        });
        document.getElementById('adminProductList').innerHTML = prodHtml || '<tr><td colspan="4" style="text-align: center; padding: 20px;">Không có sản phẩm nào</td></tr>';
    };

    const renderOrdersTable = () => {
        const sortVal = document.getElementById('sortOrderSelect')?.value || 'newest';
        let sortedOrders = [...ordersList];
        sortedOrders.sort((a, b) => {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (new Date(a.createdAt).getTime() || 0);
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (new Date(b.createdAt).getTime() || 0);
            return sortVal === 'newest' ? timeB - timeA : timeA - timeB; 
        });

        let orderHtml = '';
        sortedOrders.forEach(o => {
            let statusColor = "#f59e0b";
            if (o.status === "Đang giao" || o.status === "Shipped") statusColor = "#007aff";
            if (o.status === "Hoàn thành" || o.status === "Completed") statusColor = "#34c759";
            if (o.status === "Đã thanh toán" || o.status === "Chờ duyệt") statusColor = "#34c759"; 
            if (o.status === "Đã hủy" || o.status === "Cancelled") statusColor = "#ff3b30";

            orderHtml += `<tr>
                <td>${o.orderId || o.id}</td>
                <td>${o.userEmail || o.userId || 'Khách vãng lai'}</td>
                <td>${formatDate(o.createdAt)}</td> <td><strong>${formatPrice(o.totalAmount || o.totalPrice || 0)}</strong></td>
                <td><span style="color:${statusColor}; font-weight:bold;">${o.status || 'Chờ thanh toán'}</span></td>
            </tr>`;
        });
        document.getElementById('adminOrderList').innerHTML = orderHtml || '<tr><td colspan="5" style="text-align: center; padding: 20px;">Chưa có đơn hàng</td></tr>';
    };

    // =====================================
    // QUẢN LÝ THÔNG SỐ, BIẾN THỂ SẢN PHẨM & LƯU
    // =====================================
    const prodModal = document.getElementById('productModal');
    const variantsContainer = document.getElementById('variantsContainer');
    const specsContainer = document.getElementById('specsContainer');
    
    window.addVariantRow = (color = '', storage = '', price = '', images = '') => {
        const row = document.createElement('div');
        row.className = 'variant-row';
        row.innerHTML = `
            <input type="text" placeholder="Quy cách (VD: Thùng 24 lon)" class="v-color" value="${color}" required>
            <input type="text" placeholder="Thể tích (VD: 330ml)" class="v-storage" value="${storage}" required>
            <input type="number" placeholder="Giá tiền" class="v-price" value="${price}" required>
            <div style="display: flex; flex-direction: column; gap: 5px; flex: 2;">
                <input type="file" accept="image/png, image/jpeg, image/webp" multiple class="v-image-file" style="font-size:12px;">
                <input type="text" placeholder="Hoặc link ảnh thủ công..." class="v-image" value="${images}" required title="Cách nhau bởi dấu CHẤM PHẨY (;)">
            </div>
            <button type="button" class="btn-action btn-del" onclick="this.parentElement.remove()">X</button>
        `;
        const fileInput = row.querySelector('.v-image-file');
        const textInput = row.querySelector('.v-image');
        fileInput.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                let base64Array = [];
                for (let i = 0; i < files.length; i++) {
                    const b64 = await compressImage(files[i]);
                    base64Array.push(b64);
                }
                textInput.value = base64Array.join('|');
            }
        });
        variantsContainer.appendChild(row);
    };

    window.addSpecRow = (key = '', val = '') => {
        const row = document.createElement('div');
        row.className = 'variant-row';
        row.innerHTML = `
            <input type="text" placeholder="Tên (VD: Nồng độ cồn)" class="s-key" value="${key}">
            <input type="text" placeholder="Giá trị (VD: 5%)" class="s-val" value="${val}" style="flex: 2;">
            <button type="button" class="btn-action btn-del" onclick="this.parentElement.remove()">X</button>
        `;
        specsContainer.appendChild(row);
    };

    document.getElementById('btnAddProduct').onclick = () => { 
        document.getElementById('productForm').reset(); 
        document.getElementById('prodDocId').value = ""; 
        document.getElementById('prodModalTitle').innerText = "Thêm Sản Phẩm Mới";
        variantsContainer.innerHTML = ''; specsContainer.innerHTML = ''; 
        window.addVariantRow(); window.addSpecRow();
        prodModal.style.display = "block"; 
    }

    document.getElementById('closeProdModal').onclick = () => prodModal.style.display = "none";
    document.getElementById('btnAddVariant').onclick = () => window.addVariantRow();
    document.getElementById('btnAddSpec').onclick = () => window.addSpecRow();

    window.editProduct = (id) => {
        const p = productsList.find(x => x.id === id);
        if (!p) return;
        document.getElementById('prodModalTitle').innerText = "Sửa Sản Phẩm";
        document.getElementById('prodDocId').value = p.id; 
        document.getElementById('prodName').value = p.name;
        document.getElementById('prodCategory').value = p.categoryId;
        document.getElementById('prodDesc').value = p.description || "";

        variantsContainer.innerHTML = '';
        if (p.variants && p.variants.length > 0) {
            p.variants.forEach(v => {
                const imgStr = v.images ? v.images.join('|') : (v.image || "");
                window.addVariantRow(v.color, v.storage, v.price, imgStr);
            });
        } else { window.addVariantRow(); }

        specsContainer.innerHTML = '';
        if (p.techSpecs && Object.keys(p.techSpecs).length > 0) {
            for (const [key, value] of Object.entries(p.techSpecs)) {
                window.addSpecRow(key, value);
            }
        } else { window.addSpecRow(); }

        prodModal.style.display = "block";
    };

    document.getElementById('productForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const variants = [];
        document.querySelectorAll('#variantsContainer .variant-row').forEach((row, index) => {
            const rawImages = row.querySelector('.v-image').value;
            const imgArray = rawImages.split('|').map(img => img.trim()).filter(img => img !== '');
            variants.push({
                variantId: `v${index + 1}`,
                color: row.querySelector('.v-color').value,
                storage: row.querySelector('.v-storage').value,
                price: Number(row.querySelector('.v-price').value),
                images: imgArray.length > 0 ? imgArray : ["https://via.placeholder.com/400"],
                stock: 100 
            });
        });

        if (variants.length === 0) {
            FStoreDialog.show("Lỗi", "Vui lòng thêm ít nhất 1 biến thể!", "info");
            return;
        }

        const techSpecs = {};
        document.querySelectorAll('#specsContainer .variant-row').forEach(row => {
            const key = row.querySelector('.s-key').value.trim();
            const val = row.querySelector('.s-val').value.trim();
            if(key && val) techSpecs[key] = val;
        });

        const existingDocId = document.getElementById('prodDocId').value;
        const isEdit = !!existingDocId; 
        const finalId = isEdit ? existingDocId : "prod_" + Date.now();

        const data = {
            id: finalId, name: document.getElementById('prodName').value.trim(),
            categoryId: document.getElementById('prodCategory').value,
            description: document.getElementById('prodDesc').value.trim(),
            techSpecs: techSpecs, variants: variants
        };

        if (isEdit) {
            await updateDoc(doc(db, "products", finalId), data);
        } else {
            await setDoc(doc(db, "products", finalId), data);
        }
        
        try {
            // await fetch('https://localhost:5001/api/PriceHistory/Record', ... );
        } catch(err) {}
        
        FStoreDialog.show("Thành công", isEdit ? "Đã cập nhật sản phẩm!" : "Đã thêm sản phẩm!", "info");
        prodModal.style.display = "none";
        loadAdminData(); 
    });

    window.deleteProduct = (id) => {
        FStoreDialog.show("Xác nhận", "Bạn có chắc muốn xóa sản phẩm này vĩnh viễn?", "confirm", async () => {
            await deleteDoc(doc(db, "products", id));
            loadAdminData();
            FStoreDialog.show("Thành công", "Đã xóa sản phẩm thành công", "info");
        });
    };

    // =====================================
    // QUẢN LÝ DIỄN ĐÀN (Forum)
    // =====================================
    window.replyForum = (id) => {
        FStoreDialog.show("Trả lời khách hàng", "Nhập nội dung trả lời:", "prompt", async (reply) => {
            if (reply && reply.trim() !== "") {
                await updateDoc(doc(db, "forum_posts", id), { adminReply: reply });
                loadAdminData();
                FStoreDialog.show("Thành công", "Đã gửi câu trả lời!", "info");
            }
        });
    };

    window.deleteForum = (id) => {
        FStoreDialog.show("Cảnh báo", "Bạn có chắc chắn muốn xóa vĩnh viễn câu hỏi này khỏi diễn đàn không?", "confirm", async () => {
            try {
                await deleteDoc(doc(db, "forum_posts", id));
                loadAdminData();
                FStoreDialog.show("Thành công", "Đã xóa câu hỏi thành công!", "info");
            } catch (error) {
                FStoreDialog.show("Lỗi", "Có lỗi xảy ra, không thể xóa câu hỏi!", "info");
            }
        });
    };
});