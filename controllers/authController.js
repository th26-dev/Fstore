import { auth, db } from '../models/firebaseConfig.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

emailjs.init("s9Z0dNybGG51Q562b");

document.addEventListener('DOMContentLoaded', () => {
    const loginBox = document.getElementById('loginBox');
    const registerBox = document.getElementById('registerBox');
    const toRegister = document.getElementById('toRegister');
    const toLogin = document.getElementById('toLogin');

    let tempUserData = null;
    let generatedOtp = null;

    toRegister.addEventListener('click', () => {
        loginBox.style.display = 'none';
        registerBox.style.display = 'block';
    });

    toLogin.addEventListener('click', () => {
        registerBox.style.display = 'none';
        loginBox.style.display = 'block';
    });

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const pass = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');

        try {
            await signInWithEmailAndPassword(auth, email, pass);
            window.location.href = 'index.html';
        } catch (error) {
            errorEl.innerText = "Email hoặc mật khẩu không chính xác.";
        }
    });

    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const expireTime = new Date(Date.now() + 15 * 60000).toLocaleTimeString('vi-VN');
        
        tempUserData = {
            name: document.getElementById('regName').value,
            email: document.getElementById('regEmail').value,
            password: document.getElementById('regPassword').value
        };

        try {
            await emailjs.send("service_dkp3tpq", "template_YOUR_ID", {
                email: tempUserData.email,
                passcode: generatedOtp,
                time: expireTime
            });
            document.getElementById('registerForm').style.display = 'none';
            document.getElementById('otpSection').style.display = 'block';
        } catch (error) {
            document.getElementById('regError').innerText = "Lỗi gửi mail: " + error.text;
        }
    });

    document.getElementById('btnVerifyOtp').addEventListener('click', async () => {
        if (document.getElementById('otpInput').value === generatedOtp) {
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, tempUserData.email, tempUserData.password);
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    uid: userCredential.user.uid,
                    fullName: tempUserData.name,
                    email: tempUserData.email,
                    role: "customer",
                    createdAt: new Date()
                });
                window.location.href = 'index.html';
            } catch (error) {
                document.getElementById('regError').innerText = error.message;
            }
        } else {
            document.getElementById('regError').innerText = "Mã OTP không đúng!";
        }
    });
});