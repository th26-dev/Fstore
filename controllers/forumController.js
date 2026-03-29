import { db, auth } from '../models/firebaseConfig.js';
import { collection, getDocs, addDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const unauthMessage = document.getElementById('unauthMessage');
    const questionForm = document.getElementById('questionForm');
    const currentUserEmail = document.getElementById('currentUserEmail');
    const postsList = document.getElementById('postsList');
    const questionInput = document.getElementById('questionInput');
    const btnSubmitQuestion = document.getElementById('btnSubmitQuestion');

    let currentUser = null;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            unauthMessage.style.display = 'none';
            questionForm.style.display = 'block';
            currentUserEmail.innerText = user.email;
        } else {
            currentUser = null;
            unauthMessage.style.display = 'block';
            questionForm.style.display = 'none';
        }
    });

    const formatDate = (isoString) => {
        if (!isoString) return 'Vừa xong';
        const date = new Date(isoString);
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const loadPosts = async () => {
        try {
            const q = query(collection(db, "forum_posts"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                postsList.innerHTML = '<p class="text-center" style="color: #86868b; margin-top: 40px;">Chưa có câu hỏi nào. Hãy là người đầu tiên đặt câu hỏi!</p>';
                return;
            }

            let html = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                
                let replyHtml = '';
                if (data.adminReply && data.adminReply.trim() !== '') {
                    replyHtml = `
                        <div class="admin-reply-box">
                            <div class="admin-badge"><i class="fa-solid fa-user-shield"></i> FStore Admin</div>
                            <p class="reply-content">${data.adminReply}</p>
                        </div>
                    `;
                }

                html += `
                    <div class="post-card">
                        <div class="post-header">
                            <div class="post-user"><i class="fa-regular fa-circle-user"></i> ${data.email}</div>
                            <div class="post-date">${formatDate(data.createdAt)}</div>
                        </div>
                        <div class="post-content">${data.question}</div>
                        ${replyHtml}
                    </div>
                `;
            });

            postsList.innerHTML = html;

        } catch (error) {
            console.error("Lỗi tải diễn đàn:", error);
            postsList.innerHTML = '<p class="text-center" style="color: red;">Không thể tải dữ liệu. Vui lòng thử lại sau.</p>';
        }
    };

    loadPosts();

    questionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = questionInput.value.trim();
        
        if (!text) return;
        if (!currentUser) return alert("Vui lòng đăng nhập!");

        btnSubmitQuestion.innerText = "Đang gửi...";
        btnSubmitQuestion.disabled = true;

        try {
            const newPost = {
                email: currentUser.email,
                userId: currentUser.uid,
                question: text,
                adminReply: "", 
                createdAt: new Date().toISOString() 
            };

            await addDoc(collection(db, "forum_posts"), newPost);
            
            questionInput.value = '';
            alert("Câu hỏi của bạn đã được gửi!");
            loadPosts();

        } catch (error) {
            console.error("Lỗi đăng bài:", error);
            alert("Lỗi khi gửi câu hỏi. Hãy thử lại!");
        } finally {
            btnSubmitQuestion.innerText = "Gửi câu hỏi";
            btnSubmitQuestion.disabled = false;
        }
    });
});