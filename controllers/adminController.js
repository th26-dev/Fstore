import { auth, db } from '../models/firebaseConfig.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const adminEmail = document.getElementById('adminEmail');
    const statProducts = document.getElementById('statProducts');
    const statOrders = document.getElementById('statOrders');
    const statRevenue = document.getElementById('statRevenue');
    
    const adminProductList = document.getElementById('adminProductList');
    const adminOrderList = document.getElementById('adminOrderList');
    const adminForumList = document.getElementById('adminForumList');
    
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

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'auth.html';
            return;
        }
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
            adminEmail.innerText = user.email;
            loadAdminData();
        } else {
            alert("Bạn không có quyền truy cập trang này!");
            window.location.href = 'index.html';
        }
    });

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

    const loadAdminData = async () => {
        const prodSnap = await getDocs(collection(db, "products"));
        statProducts.innerText = prodSnap.size;
        let prodHtml = '';
        prodSnap.forEach(doc => {
            const p = doc.data();
            prodHtml += `<tr><td>${doc.id}</td><td>${p.name}</td><td>${formatPrice(p.variants[0].price)}</td><td><button class="btn-edit">Sửa</button></td></tr>`;
        });
        adminProductList.innerHTML = prodHtml;

        const orderSnap = await getDocs(collection(db, "orders"));
        statOrders.innerText = orderSnap.size;
        let totalRev = 0;
        let orderHtml = '';
        orderSnap.forEach(doc => {
            const o = doc.data();
            totalRev += o.totalAmount;
            orderHtml += `<tr><td>${o.orderId}</td><td>${o.userId}</td><td>${formatPrice(o.totalAmount)}</td><td>${o.status}</td></tr>`;
        });
        statRevenue.innerText = formatPrice(totalRev);
        adminOrderList.innerHTML = orderHtml || '<tr><td colspan="4">Chưa có đơn hàng</td></tr>';

        const forumSnap = await getDocs(query(collection(db, "forum_posts"), orderBy("createdAt", "desc")));
        let forumHtml = '';
        forumSnap.forEach(snap => {
            const f = snap.data();
            forumHtml += `
                <tr>
                    <td>${f.email}</td>
                    <td>${f.question}</td>
                    <td><button class="btn-edit" onclick="replyForum('${snap.id}')">Trả lời</button></td>
                </tr>`;
        });
        adminForumList.innerHTML = forumHtml || '<tr><td colspan="3">Không có câu hỏi mới</td></tr>';
    };

    window.replyForum = async (id) => {
        const reply = prompt("Nhập nội dung trả lời:");
        if (reply) {
            await updateDoc(doc(db, "forum_posts", id), { adminReply: reply });
            alert("Đã gửi trả lời!");
            location.reload();
        }
    };
});