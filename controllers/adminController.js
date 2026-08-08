import { auth, db } from '../models/firebaseConfig.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // === CẤU HÌNH API KEY GROQCLOUD ===
    const API_KEY = "";

    const adminEmail = document.getElementById('adminEmail');
    const tabs = document.querySelectorAll('.nav-menu li[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');

    let currentUserEmail = ""; 
    let currentEditingProduct = null; 
    let revenueChartInstance = null;
    let pieChartInstance = null;

    // ==========================================
    // CUSTOM POPUP (FSTORE DIALOG)
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
    
    const formatDateTime = (timestamp) => {
        if (!timestamp) return "Không rõ thời gian";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return "Không rõ";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    let categoriesList = [];
    let productsList = [];
    let ordersList = [];
    let vouchersList = [];
    let isEditCategory = false;
    
    let activeParentCatId = null; 
    let selectedCatIds = new Set(); 

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'auth.html';
            return;
        }
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
            currentUserEmail = user.email; 
            adminEmail.innerText = `Xin chào, ${user.email}`;
            loadAdminData();
        } else {
            FStoreDialog.show("Cảnh báo", "Bạn không có quyền truy cập trang này!", "info", () => {
                window.location.href = 'index.html';
            });
        }
    });

    const loadAdminData = async () => {
        // 1. TẢI DANH MỤC VÀ ĐỔ VÀO CÁC DROPDOWN
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
        
        // Dropdown lọc ở tab Sản phẩm
        const filterSelect = document.getElementById('filterProductCategory');
        if (filterSelect) {
            const currentFilter = filterSelect.value;
            filterSelect.innerHTML = filterCatOptionsHtml;
            filterSelect.value = currentFilter || "all";
            filterSelect.onchange = (e) => renderProductsTable(e.target.value);
        }

        // Dropdown lọc ở tab Quản lý Giá (MỚI)
        const filterPricingSelect = document.getElementById('filterPricingCategory');
        if (filterPricingSelect) {
            const currentPricingFilter = filterPricingSelect.value;
            filterPricingSelect.innerHTML = filterCatOptionsHtml;
            filterPricingSelect.value = currentPricingFilter || "all";
            filterPricingSelect.onchange = (e) => renderPricingTable(e.target.value);
        }

        renderParentCategories();

        // 2. TẢI SẢN PHẨM
        const prodSnap = await getDocs(collection(db, "products"));
        productsList = [];
        let vProdHtml = '<option value="">-- Lựa chọn sản phẩm --</option>';
        prodSnap.forEach(doc => {
            const p = doc.data();
            productsList.push(p);
            vProdHtml += `<option value="${p.id}">${p.name}</option>`;
        });
        
        const vProductSelect = document.getElementById('vProduct');
        if (vProductSelect) vProductSelect.innerHTML = vProdHtml;

        renderProductsTable(filterSelect ? filterSelect.value : "all");
        renderPricingTable(filterPricingSelect ? filterPricingSelect.value : "all"); // Gắn biến lọc cho Bảng Giá

        // 3. TẢI ĐƠN HÀNG
        const orderSnap = await getDocs(collection(db, "orders"));
        ordersList = [];
        orderSnap.forEach(doc => {
            const o = doc.data();
            o.id = doc.id; 
            ordersList.push(o);
        });
        
        renderOrdersTable();
        const sortOrderSelect = document.getElementById('sortOrderSelect');
        if (sortOrderSelect) sortOrderSelect.addEventListener('change', renderOrdersTable);

        // 4. GỌI DASHBOARD (BIỂU ĐỒ & AI)
        updateDashboardStatsAndCharts();

        // 5. TẢI VOUCHER
        const voucherSnap = await getDocs(collection(db, "vouchers"));
        vouchersList = [];
        voucherSnap.forEach(doc => vouchersList.push({ id: doc.id, ...doc.data() }));
        renderVouchersTable();

        // 6. TẢI DIỄN ĐÀN
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
        document.getElementById('adminForumList').innerHTML = forumHtml || '<tr><td colspan="3" class="text-center">Không có câu hỏi mới</td></tr>';
    };


    // ============================================================================
    // VẼ BIỂU ĐỒ & AI PHÂN TÍCH (GROQCLOUD) DỰA TRÊN DỮ LIỆU ĐƠN HÀNG
    // ============================================================================
    const updateDashboardStatsAndCharts = async () => {
        let totalRev = 0;
        let validOrders = ordersList.filter(o => o.status !== "Đã hủy" && o.status !== "Cancelled");
        
        validOrders.forEach(o => totalRev += (o.totalAmount || o.totalPrice || 0));

        document.getElementById('statOrders').innerText = validOrders.length;
        document.getElementById('statRevenue').innerText = formatPrice(totalRev);
        document.getElementById('statProducts').innerText = productsList.length;

        if(validOrders.length === 0) {
            document.getElementById('aiAdviceContent').innerText = "Chưa có đủ dữ liệu bán hàng để AI phân tích.";
            return;
        }

        const revByDate = {};
        validOrders.forEach(o => {
            const dateStr = formatDate(o.createdAt);
            revByDate[dateStr] = (revByDate[dateStr] || 0) + (o.totalAmount || o.totalPrice || 0);
        });
        
        const labelsBar = Object.keys(revByDate).sort((a,b) => {
            const [d1, m1, y1] = a.split('/');
            const [d2, m2, y2] = b.split('/');
            return new Date(`${y1}-${m1}-${d1}`) - new Date(`${y2}-${m2}-${d2}`);
        });
        const dataBar = labelsBar.map(date => revByDate[date]);

        const revByProduct = {};
        validOrders.forEach(o => {
            if(o.items && Array.isArray(o.items)) {
                o.items.forEach(item => {
                    const itemName = item.name || "Sản phẩm khác";
                    const itemRev = (item.price * (item.quantity || 1));
                    revByProduct[itemName] = (revByProduct[itemName] || 0) + itemRev;
                });
            }
        });

        const sortedProducts = Object.entries(revByProduct).sort((a, b) => b[1] - a[1]);
        const top5Products = sortedProducts.slice(0, 5);
        const labelsPie = top5Products.map(p => p[0]);
        const dataPie = top5Products.map(p => p[1]);

        if (revenueChartInstance) revenueChartInstance.destroy();
        if (pieChartInstance) pieChartInstance.destroy();

        const ctxBar = document.getElementById('revenueBarChart').getContext('2d');
        revenueChartInstance = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: labelsBar,
                datasets: [{
                    label: 'Doanh thu (VNĐ)',
                    data: dataBar,
                    backgroundColor: '#007aff',
                    borderRadius: 6
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        const ctxPie = document.getElementById('orderPieChart').getContext('2d');
        pieChartInstance = new Chart(ctxPie, {
            type: 'doughnut',
            data: {
                labels: labelsPie,
                datasets: [{
                    data: dataPie,
                    backgroundColor: ['#ff3b30', '#ff9500', '#34c759', '#007aff', '#5856d6'],
                    borderWidth: 2
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        // ===============================================
        // GỌI AI GROQCLOUD BẰNG MÔ HÌNH LLAMA 3 SIÊU TỐC
        // ===============================================
        try {
            const topProductsStr = top5Products.map(p => `${p[0]} (${formatPrice(p[1])})`).join(', ');
            const bottomProductsList = sortedProducts.slice(-3); 
            const bottomProductsStr = bottomProductsList.map(p => p[0]).join(', ') || "Không có";

            const prompt = `Bạn là chuyên gia cố vấn chiến lược kinh doanh thương mại điện tử.
            Dữ liệu bán hàng thực tế:
            - Tổng doanh thu: ${formatPrice(totalRev)}
            - Số đơn: ${validOrders.length} đơn
            - Top bán chạy: ${topProductsStr}.
            - Bán chậm nhất: ${bottomProductsStr}.

            Dựa vào số liệu trên, hãy viết 3 Lời khuyên chiến lược kinh doanh ngắn gọn để tăng doanh thu.
            Định dạng trả về là HTML đơn giản (chỉ dùng <ul>, <li>, <strong>). KHÔNG viết mở bài kết bài.`;

            const URL = `https://api.groq.com/openai/v1/chat/completions`;
            const response = await fetch(URL, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_KEY}` 
                },
                body: JSON.stringify({ 
                    model: "llama-3.1-8b-instant", 
                    messages: [
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.7
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.choices && data.choices.length > 0) {
                    let aiHTML = data.choices[0].message.content;
                    aiHTML = aiHTML.replace(/```html/g, '').replace(/```/g, '').trim();
                    document.getElementById('aiAdviceContent').innerHTML = aiHTML;
                }
            } else {
                const errData = await response.json();
                console.error("Lỗi từ GroqCloud:", errData);
                throw new Error("Groq API Key lỗi hoặc bị giới hạn");
            }
        } catch (error) {
            console.error("Chi tiết lỗi AI:", error);
            
            document.getElementById('aiAdviceContent').innerHTML = `
                <p style="color: #ea580c; font-style: italic; margin-bottom: 15px; font-size: 13px;">
                    <i class="fa-solid fa-triangle-exclamation"></i> Máy chủ AI GroqCloud phản hồi chậm. Hệ thống tự động chuyển sang chế độ tư vấn dự phòng:
                </p>
                <ul style="margin-left: 20px;">
                    <li style="margin-bottom: 10px;"><strong>Đẩy mạnh sản phẩm chủ lực:</strong> Tập trung ngân sách quảng cáo và hiển thị vị trí đẹp cho các sản phẩm Top bán chạy để tối đa hóa biên lợi nhuận.</li>
                    <li style="margin-bottom: 10px;"><strong>Xử lý hàng tồn kho:</strong> Thiết lập các chương trình Giảm giá (Flash Sale) hoặc tạo mã Voucher cho các sản phẩm bán chậm để thu hồi vốn nhanh chóng.</li>
                    <li><strong>Chăm sóc khách hàng cũ:</strong> Phân tích dữ liệu đơn hàng và gửi Email chứa mã khuyến mãi riêng cho khách hàng đã từng mua sắm để kích thích tỷ lệ quay lại (Retention Rate).</li>
                </ul>
            `;
        }
    };

    document.getElementById('timeFilter').addEventListener('change', () => {
        updateDashboardStatsAndCharts();
    });


    // =====================================
    // QUẢN LÝ VOUCHER (FIREBASE)
    // =====================================
    const renderVouchersTable = () => {
        let html = '';
        const today = new Date();
        today.setHours(0,0,0,0);

        vouchersList.forEach(v => {
            const endDate = new Date(v.endDate);
            endDate.setHours(23,59,59,999);
            const isAlive = endDate >= today;
            
            const prodName = productsList.find(p => p.id === v.productId)?.name || `ID: ${v.productId}`;
            
            html += `<tr>
                <td><span class="voucher-code">${v.id}</span></td>
                <td style="color: #6c757d;">${prodName}</td>
                <td style="color:#ff3b30; font-weight:bold;">-${v.discountPercent}%</td>
                <td style="font-size:13px;">
                    Từ: ${formatDate(v.startDate)}<br>Đến: ${formatDate(v.endDate)}
                </td>
                <td>
                    ${isAlive 
                        ? '<span class="badge-status badge-active">🟢 Đang chạy</span>' 
                        : '<span class="badge-status badge-expired">🔴 Hết hạn</span>'}
                </td>
                <td style="text-align: center;">
                    <button class="btn-action btn-del" style="background: transparent; border: 1px solid #ff3b30; color: #ff3b30; padding: 6px 12px; border-radius: 8px;" onclick="deleteVoucher('${v.id}')">Xóa</button>
                </td>
            </tr>`;
        });
        document.getElementById('adminVoucherList').innerHTML = html || '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #86868b;">Chưa có Voucher nào được phát hành.</td></tr>';
    };

    const setDefaultVoucherDates = () => {
        const todayStr = new Date().toISOString().split('T')[0];
        document.getElementById('vStartDate').value = todayStr;
        
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        document.getElementById('vEndDate').value = nextWeek.toISOString().split('T')[0];
    };

    const tabVoucherEl = document.querySelector('li[data-tab="vouchers"]');
    if(tabVoucherEl) {
        tabVoucherEl.addEventListener('click', setDefaultVoucherDates);
    }

    if (document.getElementById('btnGenVoucher')) {
        document.getElementById('btnGenVoucher').onclick = () => {
            const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
            document.getElementById('vCode').value = `SS-${randomStr}`;
        };
    }

    if (document.getElementById('voucherForm')) {
        document.getElementById('voucherForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = document.getElementById('vCode').value.trim().toUpperCase();
            const discount = Number(document.getElementById('vDiscount').value);
            const productId = document.getElementById('vProduct').value;
            const startDate = document.getElementById('vStartDate').value;
            const endDate = document.getElementById('vEndDate').value;

            if (discount <= 0 || discount >= 100) {
                alert('Phần trăm giảm giá phải lớn hơn 0 và nhỏ hơn 100!'); return;
            }
            if (new Date(startDate) > new Date(endDate)) {
                alert('Ngày bắt đầu không được lớn hơn ngày kết thúc!'); return;
            }

            const data = {
                discountPercent: discount,
                productId: productId,
                startDate: startDate,
                endDate: endDate,
                createdAt: new Date().toISOString()
            };

            try {
                await setDoc(doc(db, "vouchers", code), data);
                alert("🎉 Phát hành mã giảm giá thành công!");
                document.getElementById('voucherForm').reset();
                setDefaultVoucherDates();
                loadAdminData();
            } catch(err) {
                alert("Có lỗi xảy ra khi lưu Voucher vào hệ thống!");
            }
        });
    }

    window.deleteVoucher = (code) => {
        if (!window.confirm(`Bạn có chắc chắn muốn thu hồi/xóa mã ${code} này?`)) return;
        deleteDoc(doc(db, "vouchers", code)).then(() => {
            alert('Đã xóa mã Voucher!');
            loadAdminData();
        }).catch(err => {
            alert('Lỗi kết nối khi xóa!');
        });
    };


    // =====================================
    // QUẢN LÝ DANH MỤC
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
            
            selectedCatIds.forEach(id => {
                categoriesList.filter(c => c.parentId === id).forEach(child => idsToDelete.add(child.id));
            });

            const prodSnap = await getDocs(collection(db, "products"));
            prodSnap.forEach(docSnap => {
                const prod = docSnap.data();
                if (idsToDelete.has(prod.categoryId)) {
                    deletePromises.push(deleteDoc(doc(db, "products", docSnap.id)));
                }
            });

            idsToDelete.forEach(id => deletePromises.push(deleteDoc(doc(db, "categories", id))));

            await Promise.all(deletePromises);
            selectedCatIds.clear(); 
            activeParentCatId = null; 
            FStoreDialog.show("Thành công", "Đã xóa hàng loạt danh mục và sản phẩm liên quan!", "info");
            loadAdminData();
        });
    };

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
        document.getElementById('catParentId').disabled = true; 
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
        document.getElementById('catParentId').disabled = true; 
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
            document.getElementById('catParentId').disabled = false; 
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
                FStoreDialog.show("Lỗi", "Có lỗi xảy ra khi xóa dữ liệu!", "info");
            }
        });
    };

    // =====================================
    // QUẢN LÝ SẢN PHẨM 
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

    const prodModal = document.getElementById('productModal');
    const variantsContainer = document.getElementById('variantsContainer');
    const specsContainer = document.getElementById('specsContainer');
    
    window.addVariantRow = (color = '', storage = '', price = '', images = '', variantId = '') => {
        const row = document.createElement('div');
        row.className = 'variant-row';
        row.innerHTML = `
            <input type="hidden" class="v-id" value="${variantId}">
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
        currentEditingProduct = null; 
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
        
        currentEditingProduct = p; 

        document.getElementById('prodModalTitle').innerText = "Sửa Sản Phẩm";
        document.getElementById('prodDocId').value = p.id; 
        document.getElementById('prodName').value = p.name;
        document.getElementById('prodCategory').value = p.categoryId;
        document.getElementById('prodDesc').value = p.description || "";

        variantsContainer.innerHTML = '';
        if (p.variants && p.variants.length > 0) {
            p.variants.forEach(v => {
                const imgStr = v.images ? v.images.join('|') : (v.image || "");
                window.addVariantRow(v.color, v.storage, v.price, imgStr, v.variantId || "");
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
            
            let varId = row.querySelector('.v-id').value;
            if (!varId) varId = `v_${Date.now()}_${index}`;

            variants.push({
                variantId: varId,
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

        // Ghi nhận lịch sử giá gốc
        let priceHistoryArray = (isEdit && currentEditingProduct && currentEditingProduct.priceHistory) 
                                ? currentEditingProduct.priceHistory 
                                : [];

        if (isEdit && currentEditingProduct) {
            variants.forEach(newVar => {
                const oldVar = currentEditingProduct.variants.find(v => v.variantId === newVar.variantId);
                if (oldVar && Number(oldVar.price) !== Number(newVar.price)) {
                    priceHistoryArray.push({
                        type: 'BASE_PRICE',
                        variantColor: newVar.color,
                        variantStorage: newVar.storage,
                        oldPrice: Number(oldVar.price),
                        newPrice: Number(newVar.price),
                        updatedAt: new Date().toISOString(), 
                        updatedBy: currentUserEmail 
                    });
                }
            });
        }

        const data = {
            id: finalId, 
            name: document.getElementById('prodName').value.trim(),
            categoryId: document.getElementById('prodCategory').value,
            description: document.getElementById('prodDesc').value.trim(),
            techSpecs: techSpecs, 
            variants: variants,
            priceHistory: priceHistoryArray 
        };

        if (isEdit) {
            await updateDoc(doc(db, "products", finalId), data);
        } else {
            await setDoc(doc(db, "products", finalId), data);
        }
        
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
    // QUẢN LÝ GIÁ (PROMOTION & HISTORY) ĐÃ NÂNG CẤP GIAO DIỆN
    // =====================================
    const renderPricingTable = (filterCatId = "all") => {
        let html = '';
        const today = new Date();
        today.setHours(0,0,0,0);

        // Lọc sản phẩm theo danh mục ở Tab Pricing
        const filteredProducts = (filterCatId === "all") ? productsList : productsList.filter(p => p.categoryId === filterCatId);

        filteredProducts.forEach(p => {
            const hasPromo = p.currentPromotion;
            let promoStatus = '';
            let promoDetails = '<span style="color:#86868b; font-style:italic; font-size: 13px;">Chưa có chương trình</span>';
            
            if (hasPromo) {
                const endDate = new Date(p.currentPromotion.endDate);
                endDate.setHours(23,59,59,999);
                const isAlive = endDate >= today;
                
                promoDetails = `
                    <div style="background: #fff0f0; border-left: 3px solid #ff3b30; padding: 8px 12px; border-radius: 4px;">
                        <strong style="color:#ff3b30; font-size: 15px;">${formatPrice(p.currentPromotion.promoPrice)}</strong><br>
                        <span style="font-size:12px; color: #666;"><i class="fa-regular fa-clock"></i> ${formatDate(p.currentPromotion.startDate)} - ${formatDate(p.currentPromotion.endDate)}</span>
                    </div>
                `;
                promoStatus = isAlive ? '<span class="badge-status badge-active">🟢 Đang chạy</span>' : '<span class="badge-status badge-expired">🔴 Hết hạn</span>';
            } else {
                promoStatus = '<span class="badge-status" style="background:#f2f2f7; color:#86868b;">Trống</span>';
            }

            // Tạo danh sách biến thể đẹp mắt
            let variantsHtml = '';
            if (p.variants && p.variants.length > 0) {
                p.variants.forEach(v => {
                    variantsHtml += `<div style="font-size:13px; color:#555; margin-bottom: 4px;">
                        &bull; ${v.color} ${v.storage ? '- ' + v.storage : ''}: 
                        <strong style="color: #1d1d1f;">${formatPrice(v.price)}</strong>
                    </div>`;
                });
            } else {
                variantsHtml = `<div style="font-size:13px; color:#86868b;">Chưa có phân loại</div>`;
            }

            html += `<tr style="transition: 0.2s; cursor: default;">
                <td style="padding: 15px 20px; border-bottom: 1px solid #e5e5ea;">
                    <strong style="color: #1d1d1f; font-size: 14px;">${p.name}</strong>
                </td>
                <td style="padding: 15px 20px; border-bottom: 1px solid #e5e5ea;">
                    ${variantsHtml}
                </td>
                <td style="padding: 15px 20px; border-bottom: 1px solid #e5e5ea;">${promoDetails}</td>
                <td style="padding: 15px 20px; border-bottom: 1px solid #e5e5ea; text-align: center;">${promoStatus}</td>
                <td style="padding: 15px 20px; border-bottom: 1px solid #e5e5ea; text-align: right;">
                    <div style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="btn-action" style="background:#007aff; color:#fff; padding: 6px 12px; font-size: 13px;" onclick="openPromoModal('${p.id}')">Thay đổi giá</button>
                        <button class="btn-action" style="background:#f5f5f7; color:#1d1d1f; border: 1px solid #d2d2d7; padding: 6px 12px; font-size: 13px;" onclick="viewPriceHistory('${p.id}')"><i class="fa-solid fa-clock-rotate-left"></i> Lịch sử</button>
                    </div>
                    ${hasPromo ? `<button class="btn-action" style="background:transparent; color:#ff3b30; border: none; padding: 6px 0; font-size: 13px; text-decoration: underline; margin-top: 5px;" onclick="removePromo('${p.id}')">Hủy khuyến mãi</button>` : ''}
                </td>
            </tr>`;
        });
        
        document.getElementById('adminPricingList').innerHTML = html || '<tr><td colspan="5" style="text-align: center; padding: 30px; color: #86868b;">Không có dữ liệu sản phẩm trong danh mục này.</td></tr>';
    };

    const promoPriceModal = document.getElementById('promoPriceModal');
    if (document.getElementById('closePromoModal')) {
        document.getElementById('closePromoModal').onclick = () => promoPriceModal.style.display = 'none';
    }



    
    window.openPromoModal = (productId) => {
        const p = productsList.find(x => x.id === productId);
        if (!p) return;

        document.getElementById('promoProductName').innerText = p.name;
        document.getElementById('promoProductId').value = p.id;
        
        const todayStr = new Date().toISOString().split('T')[0];
        document.getElementById('promoStart').value = todayStr;
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        document.getElementById('promoEnd').value = nextWeek.toISOString().split('T')[0];

        let variantOptions = '';
        if (p.variants && p.variants.length > 0) {
            p.variants.forEach(v => {
                const vName = `${v.color} ${v.storage ? '- ' + v.storage : ''} (Gốc: ${formatPrice(v.price)})`;
                variantOptions += `<option value="${v.variantId}">${vName}</option>`;
            });
        }
        document.getElementById('promoVariant').innerHTML = variantOptions;
        document.getElementById('promoPrice').value = '';
        
        promoPriceModal.style.display = 'block';
    };

    if (document.getElementById('promoForm')) {
        document.getElementById('promoForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const productId = document.getElementById('promoProductId').value;
            const variantId = document.getElementById('promoVariant').value;
            const newPrice = Number(document.getElementById('promoPrice').value);
            const startDate = document.getElementById('promoStart').value;
            const endDate = document.getElementById('promoEnd').value;

            if (new Date(startDate) > new Date(endDate)) {
                FStoreDialog.show("Lỗi", "Ngày bắt đầu không được lớn hơn ngày kết thúc!", "info");
                return;
            }

            const product = productsList.find(p => p.id === productId);
            if (!product) return;

            const variant = product.variants.find(v => v.variantId === variantId);
            const oldPrice = variant ? variant.price : 0;

            const promoData = {
                variantId: variantId,
                promoPrice: newPrice,
                startDate: startDate,
                endDate: endDate
            };

            const newHistoryEntry = {
                type: 'PROMOTION',
                variantColor: variant ? variant.color : '',
                variantStorage: variant ? variant.storage : '',
                oldPrice: oldPrice,
                newPrice: newPrice,
                startDate: startDate,
                endDate: endDate,
                updatedAt: new Date().toISOString(),
                updatedBy: currentUserEmail
            };

            let priceHistoryArray = product.priceHistory || [];
            priceHistoryArray.push(newHistoryEntry);

            try {
                await updateDoc(doc(db, "products", productId), {
                    currentPromotion: promoData,
                    priceHistory: priceHistoryArray
                });
                FStoreDialog.show("Thành công", "Đã thiết lập giá khuyến mãi mới!", "info");
                promoPriceModal.style.display = 'none';
                loadAdminData();
            } catch (err) {
                FStoreDialog.show("Lỗi", "Không thể lưu dữ liệu!", "info");
            }
        });
    }

    window.removePromo = (productId) => {
        FStoreDialog.show("Xác nhận", "Bạn có chắc chắn muốn HỦY chương trình giá khuyến mãi của sản phẩm này không?", "confirm", async () => {
            try {
                const productRef = doc(db, "products", productId);
                await updateDoc(productRef, { currentPromotion: null });
                FStoreDialog.show("Thành công", "Đã hủy giá khuyến mãi!", "info");
                loadAdminData();
            } catch (err) {
                FStoreDialog.show("Lỗi", "Có lỗi xảy ra khi hủy!", "info");
            }
        });
    };

    const priceHistoryModal = document.getElementById('priceHistoryModal');
    if (document.getElementById('closeHistoryModal')) {
        document.getElementById('closeHistoryModal').onclick = () => priceHistoryModal.style.display = 'none';
    }

    window.viewPriceHistory = (id) => {
        const p = productsList.find(x => x.id === id);
        if (!p) return;

        document.getElementById('historyProductName').innerText = p.name;
        const tbody = document.getElementById('historyTableBody');
        let html = '';

        if (!p.priceHistory || p.priceHistory.length === 0) {
            html = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#86868b;">Sản phẩm này chưa từng thay đổi giá.</td></tr>`;
        } else {
            const sortedHistory = [...p.priceHistory].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            
            sortedHistory.forEach(h => {
                const varName = `${h.variantColor || ''} ${h.variantStorage ? '- ' + h.variantStorage : ''}`;
                const note = h.type === 'PROMOTION' 
                    ? `<span style="color:#ff3b30; font-size:12px; font-weight:bold;">Khuyến mãi hẹn giờ:</span><br><span style="font-size:11px;">Từ ${formatDate(h.startDate)}<br>Đến ${formatDate(h.endDate)}</span>` 
                    : `<span style="color:#34c759; font-size:12px; font-weight:bold;">Sửa giá gốc</span>`;

                html += `
                    <tr>
                        <td style="font-size: 13px;">${formatDateTime(h.updatedAt)}</td>
                        <td>${varName}</td>
                        <td style="text-decoration: line-through; color: #86868b;">${formatPrice(h.oldPrice)}</td>
                        <td style="color: #ff3b30; font-weight: bold;">${formatPrice(h.newPrice)}</td>
                        <td>${note}</td>
                        <td style="font-size: 12px; color: #666;">${h.updatedBy || 'Không rõ'}</td>
                    </tr>
                `;
            });
        }
        tbody.innerHTML = html;
        priceHistoryModal.style.display = 'block';
    };

    // =====================================
    // QUẢN LÝ ĐƠN HÀNG (CHỨC NĂNG DỌN DẸP)
    // =====================================
    let selectedOrderIds = new Set(); // Bộ nhớ chứa các đơn đang được tick chọn

    const renderOrdersTable = () => {
        // Reset trạng thái mỗi khi render lại bảng
        selectedOrderIds.clear(); 
        updateBulkDeleteOrderBtn();
        const selectAllCheckbox = document.getElementById('selectAllOrders');
        if(selectAllCheckbox) selectAllCheckbox.checked = false;

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

            // Lấy Tên sản phẩm trong đơn để Chủ Shop biết là Điện thoại hay Bia
            let itemsPreview = "Không rõ";
            if (o.items && Array.isArray(o.items)) {
                itemsPreview = o.items.map(item => item.name).join(', ');
                if (itemsPreview.length > 50) itemsPreview = itemsPreview.substring(0, 50) + "...";
            }

            orderHtml += `<tr>
                <td style="text-align: center;">
                    <input type="checkbox" class="order-checkbox" value="${o.id}" onclick="toggleOrderSelection('${o.id}')" style="transform: scale(1.2); cursor: pointer;">
                </td>
                <td>${o.orderId || o.id}</td>
                <td>${o.userEmail || o.userId || 'Khách vãng lai'}</td>
                <td style="color: #666; font-size: 13px; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${o.items ? o.items.map(i=>i.name).join(', ') : ''}">
                    ${itemsPreview}
                </td>
                <td>${formatDate(o.createdAt)}</td> 
                <td><strong>${formatPrice(o.totalAmount || o.totalPrice || 0)}</strong></td>
                <td><span style="color:${statusColor}; font-weight:bold;">${o.status || 'Chờ thanh toán'}</span></td>
            </tr>`;
        });
        document.getElementById('adminOrderList').innerHTML = orderHtml || '<tr><td colspan="7" style="text-align: center; padding: 20px;">Chưa có đơn hàng</td></tr>';
    };

    // Hàm Xử lý tick chọn 1 đơn
    window.toggleOrderSelection = (id) => {
        if (selectedOrderIds.has(id)) selectedOrderIds.delete(id);
        else selectedOrderIds.add(id);
        
        updateBulkDeleteOrderBtn();
        
        // Kiểm tra xem đã tick hết chưa để auto tick ô "Chọn tất cả"
        const allCheckboxes = document.querySelectorAll('.order-checkbox');
        document.getElementById('selectAllOrders').checked = (selectedOrderIds.size === allCheckboxes.length && allCheckboxes.length > 0);
    };

    // Hàm Cập nhật UI Nút Xóa
    const updateBulkDeleteOrderBtn = () => {
        const btn = document.getElementById('btnDeleteMultipleOrders');
        const countSpan = document.getElementById('selectedOrderCount');
        if (btn && countSpan) {
            if (selectedOrderIds.size > 0) {
                btn.style.display = 'flex';
                countSpan.innerText = selectedOrderIds.size;
            } else {
                btn.style.display = 'none';
            }
        }
    };

    // Bắt sự kiện cho ô "Chọn tất cả"
    if (document.getElementById('selectAllOrders')) {
        document.getElementById('selectAllOrders').addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const checkboxes = document.querySelectorAll('.order-checkbox');
            selectedOrderIds.clear();
            
            checkboxes.forEach(cb => {
                cb.checked = isChecked;
                if (isChecked) selectedOrderIds.add(cb.value);
            });
            updateBulkDeleteOrderBtn();
        });
    }

    // Bắt sự kiện Xóa hàng loạt Firebase
    if (document.getElementById('btnDeleteMultipleOrders')) {
        document.getElementById('btnDeleteMultipleOrders').addEventListener('click', () => {
            FStoreDialog.show("Cảnh báo nguy hiểm", `Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedOrderIds.size} đơn hàng đã chọn không? Hành động này không thể khôi phục!`, "confirm", async () => {
                try {
                    const deletePromises = [];
                    selectedOrderIds.forEach(id => {
                        deletePromises.push(deleteDoc(doc(db, "orders", id)));
                    });
                    
                    await Promise.all(deletePromises);
                    
                    selectedOrderIds.clear();
                    FStoreDialog.show("Thành công", "Đã dọn dẹp sạch sẽ các đơn hàng cũ!", "info");
                    loadAdminData(); // Cập nhật lại biểu đồ và danh sách
                } catch (error) {
                    FStoreDialog.show("Lỗi", "Có lỗi xảy ra khi xóa đơn hàng!", "info");
                }
            });
        });
    }

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