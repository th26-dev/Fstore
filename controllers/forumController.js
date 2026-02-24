import { db, auth } from '../models/firebaseConfig.js';
import { collection, addDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const forumList = document.getElementById('forumList');
    const forumInputGroup = document.getElementById('forumInputGroup');
    const forumAuthMsg = document.getElementById('forumAuthMsg');
    const btnPost = document.getElementById('btnPostQuestion');
    const questionInput = document.getElementById('forumQuestion');

    onAuthStateChanged(auth, (user) => {
        if (user) {
            forumInputGroup.style.display = 'flex';
            forumAuthMsg.style.display = 'none';
        }
    });

    const loadForum = () => {
        const q = query(collection(db, "forum_posts"), orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            let html = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                html += `
                    <div class="forum-item">
                        <span class="user-q">Hỏi: ${data.question}</span>
                        <div class="admin-a">
                            ${data.adminReply ? `<strong>Admin trả lời:</strong> ${data.adminReply}` : `<span class="no-reply">Đang chờ Admin trả lời...</span>`}
                        </div>
                    </div>
                `;
            });
            forumList.innerHTML = html;
        });
    };

    btnPost.addEventListener('click', async () => {
        const content = questionInput.value.trim();
        if (!content || !auth.currentUser) return;

        try {
            await addDoc(collection(db, "forum_posts"), {
                userId: auth.currentUser.uid,
                email: auth.currentUser.email,
                question: content,
                adminReply: null,
                createdAt: new Date()
            });
            questionInput.value = '';
        } catch (e) { console.error(e); }
    });

    loadForum();
});