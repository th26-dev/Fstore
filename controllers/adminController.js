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
    
    const formatDate = (timestamp) => {
        if (!timestamp) return "Không rõ thời gian";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' });
    };

    let categoriesList = [];
    let productsList = [];
    let ordersList = [];
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
        const catSnap = await getDocs(query(collection(db, "categories"), orderBy("order")));
        categoriesList = [];
        let catHtml = '';
        let parentOptionsHtml = '<option value="">-- Không có (Danh mục gốc) --</option>';
        let prodCatOptionsHtml = '';
        let filterCatOptionsHtml = '<option value="all">Tất cả danh mục</option>';

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
            
            prodCatOptionsHtml += `<option value="${c.id}">${c.name}</option>`;
            filterCatOptionsHtml += `<option value="${c.id}">${c.name}</option>`;
        });
        
        document.getElementById('adminCategoryList').innerHTML = catHtml;
        document.getElementById('catParentId').innerHTML = parentOptionsHtml;
        document.getElementById('prodCategory').innerHTML = prodCatOptionsHtml;
        
        const filterSelect = document.getElementById('filterProductCategory');
        if (filterSelect) {
            const currentFilter = filterSelect.value;
            filterSelect.innerHTML = filterCatOptionsHtml;
            filterSelect.value = currentFilter || "all";
            
            filterSelect.onchange = (e) => {
                renderProductsTable(e.target.value);
            };
        }

        const prodSnap = await getDocs(collection(db, "products"));
        productsList = [];
        prodSnap.forEach(doc => {
            productsList.push(doc.data());
        });
        
        renderProductsTable(filterSelect ? filterSelect.value : "all");

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
        if (sortOrderSelect) {
            sortOrderSelect.addEventListener('change', renderOrdersTable);
        }

        const forumSnap = await getDocs(query(collection(db, "forum_posts"), orderBy("createdAt", "desc")));
        let forumHtml = '';
        forumSnap.forEach(snap => {
            const f = snap.data();
            forumHtml += `<tr>
                <td>${f.email}</td>
                <td>${f.question}</td>
                <td>
                    <button class="btn-action btn-save" onclick="replyForum('${snap.id}')" style="margin-right: 5px;">Trả lời</button>
                    <button class="btn-action btn-del" onclick="deleteForum('${snap.id}')">Xóa</button>
                </td>
            </tr>`;
        });
        document.getElementById('adminForumList').innerHTML = forumHtml || '<tr><td colspan="3">Không có câu hỏi mới</td></tr>';

        const timeFilter = document.getElementById('timeFilter');
        if (timeFilter) {
            renderRealCharts(timeFilter.value);
            timeFilter.addEventListener('change', (e) => renderRealCharts(e.target.value));
        }
    };

    
    const renderOrdersTable = () => {
        const sortVal = document.getElementById('sortOrderSelect')?.value || 'newest';
        
        let sortedOrders = [...ordersList];
        
        sortedOrders.sort((a, b) => {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (new Date(a.createdAt).getTime() || 0);
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (new Date(b.createdAt).getTime() || 0);
            
            if (sortVal === 'newest') return timeB - timeA; 
            return timeA - timeB; 
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

    const renderProductsTable = (filterCatId) => {
        let prodHtml = '';
        
        const filteredProducts = (filterCatId === "all") 
            ? productsList 
            : productsList.filter(p => p.categoryId === filterCatId);
            
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
        
        document.getElementById('adminProductList').innerHTML = prodHtml || '<tr><td colspan="4" style="text-align: center; padding: 20px;">Không có sản phẩm nào trong danh mục này</td></tr>';
    };

    let revenueChartInstance = null;
    let orderPieChartInstance = null;

    const renderRealCharts = (filterValue) => {
        const ctxBar = document.getElementById('revenueBarChart');
        const ctxPie = document.getElementById('orderPieChart');
        if (!ctxBar || !ctxPie) return;

        if (revenueChartInstance) revenueChartInstance.destroy();
        if (orderPieChartInstance) orderPieChartInstance.destroy();

        const now = new Date();
        const filteredOrders = ordersList.filter(o => {
            if (!o.createdAt) return true; 
            const orderDate = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
            
            if (filterValue === 'today') {
                return orderDate.toDateString() === now.toDateString();
            } else if (filterValue === 'week') {
                const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 1));
                return orderDate >= firstDayOfWeek;
            } else if (filterValue === 'month') {
                return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
            } else if (filterValue === 'year') {
                return orderDate.getFullYear() === now.getFullYear();
            }
            return true; 
        });

        const productToCategoryName = {};
        productsList.forEach(p => {
            const cat = categoriesList.find(c => c.id === p.categoryId);
            productToCategoryName[p.id] = cat ? cat.name : 'Khác';
        });

        const revenueByCategory = {};
        
        filteredOrders.forEach(o => {
            if (o.items && Array.isArray(o.items)) {
                o.items.forEach(item => {
                    const catName = productToCategoryName[item.id] || 'Khác';
                    const itemTotal = (item.price || 0) * (item.quantity || 1);
                    revenueByCategory[catName] = (revenueByCategory[catName] || 0) + itemTotal;
                });
            } else {
                const total = o.totalAmount || o.totalPrice || 0;
                revenueByCategory['Chưa phân loại'] = (revenueByCategory['Chưa phân loại'] || 0) + total;
            }
        });

        const chartLabels = Object.keys(revenueByCategory);
        const chartData = Object.values(revenueByCategory);

        if(chartLabels.length === 0) {
            chartLabels.push("Không có dữ liệu");
            chartData.push(0);
        }

        revenueChartInstance = new Chart(ctxBar.getContext('2d'), {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Doanh thu (VNĐ)',
                    data: chartData,
                    backgroundColor: 'rgba(0, 113, 227, 0.8)',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { 
                        beginAtZero: true,
                        ticks: { callback: function(value) { return value.toLocaleString('vi-VN') + ' đ'; } }
                    } 
                }
            }
        });

        const pieColors = ['#007aff', '#ff9500', '#34c759', '#ff3b30', '#af52de', '#5856d6'];
        const dynamicColors = chartLabels.map((_, i) => pieColors[i % pieColors.length]);

        orderPieChartInstance = new Chart(ctxPie.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: chartLabels, 
                datasets: [{
                    data: chartData, 
                    backgroundColor: dynamicColors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                cutout: '60%',
                plugins: { 
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) label += ': ';
                                if (context.parsed !== null) {
                                    label += context.parsed.toLocaleString('vi-VN') + ' đ';
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    };

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

    const prodModal = document.getElementById('productModal');
    const variantsContainer = document.getElementById('variantsContainer');
    const specsContainer = document.getElementById('specsContainer');
    
    window.addVariantRow = (color = '', storage = '', price = '', images = '') => {
        const row = document.createElement('div');
        row.className = 'variant-row';
        row.innerHTML = `
            <input type="text" placeholder="Màu (VD: Đen)" class="v-color" value="${color}" required>
            <input type="text" placeholder="Dung lượng" class="v-storage" value="${storage}" required>
            <input type="number" placeholder="Giá tiền" class="v-price" value="${price}" required>
            <input type="text" placeholder="Link ảnh..." class="v-image" value="${images}" required title="Cách nhau bởi dấu phẩy">
            <button type="button" class="btn-action btn-del" onclick="this.parentElement.remove()">X</button>
        `;
        variantsContainer.appendChild(row);
    };

    window.addSpecRow = (key = '', val = '') => {
        const row = document.createElement('div');
        row.className = 'variant-row';
        row.innerHTML = `
            <input type="text" placeholder="Tên (VD: Màn hình)" class="s-key" value="${key}">
            <input type="text" placeholder="Giá trị (VD: 6.2 in)" class="s-val" value="${val}" style="flex: 2;">
            <button type="button" class="btn-action btn-del" onclick="this.parentElement.remove()">X</button>
        `;
        specsContainer.appendChild(row);
    };

    document.getElementById('btnAddProduct').onclick = () => { 
        document.getElementById('productForm').reset(); 
        document.getElementById('prodDocId').value = ""; 
        document.getElementById('prodModalTitle').innerText = "Thêm Sản Phẩm Mới";
        variantsContainer.innerHTML = ''; 
        specsContainer.innerHTML = ''; 
        window.addVariantRow(); 
        window.addSpecRow();
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
                const imgStr = v.images ? v.images.join(', ') : (v.image || "");
                window.addVariantRow(v.color, v.storage, v.price, imgStr);
            });
        } else {
            window.addVariantRow();
        }

        specsContainer.innerHTML = '';
        if (p.techSpecs && Object.keys(p.techSpecs).length > 0) {
            for (const [key, value] of Object.entries(p.techSpecs)) {
                window.addSpecRow(key, value);
            }
        } else {
            window.addSpecRow();
        }

        prodModal.style.display = "block";
    };

    document.getElementById('productForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
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

        const techSpecs = {};
        document.querySelectorAll('#specsContainer .variant-row').forEach(row => {
            const key = row.querySelector('.s-key').value.trim();
            const val = row.querySelector('.s-val').value.trim();
            if(key && val) {
                techSpecs[key] = val;
            }
        });

        const existingDocId = document.getElementById('prodDocId').value;
        const isEdit = !!existingDocId; 
        const finalId = isEdit ? existingDocId : "prod_" + Date.now();

        const data = {
            id: finalId,
            name: document.getElementById('prodName').value.trim(),
            categoryId: document.getElementById('prodCategory').value,
            description: document.getElementById('prodDesc').value.trim(),
            techSpecs: techSpecs, 
            variants: variants
        };

        if (isEdit) {
            await updateDoc(doc(db, "products", finalId), data);
            alert("Đã cập nhật sản phẩm thành công!");
        } else {
            await setDoc(doc(db, "products", finalId), data);
            alert("Đã thêm sản phẩm thành công!");
        }
        
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

    window.deleteForum = async (id) => {
        if(confirm("Bạn có chắc chắn muốn xóa vĩnh viễn câu hỏi này khỏi diễn đàn không?")) {
            try {
                await deleteDoc(doc(db, "forum_posts", id));
                alert("Đã xóa câu hỏi thành công!");
                loadAdminData();
            } catch (error) {
                console.error("Lỗi khi xóa câu hỏi:", error);
                alert("Có lỗi xảy ra, không thể xóa câu hỏi!");
            }
        }
    };
});