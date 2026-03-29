import { auth, db } from '../models/firebaseConfig.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

emailjs.init("s9Z0dNybGG51Q562b");

document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');
    
    let tempUserData = null;
    let generatedOtp = null;

    
    const mascot = document.getElementById('mascot');
    const pupils = document.querySelectorAll('.pupil');
    
    const textInputs = document.querySelectorAll('input[type="email"], input[type="text"]');
    const passInputs = document.querySelectorAll('input[type="password"]');

    textInputs.forEach(input => {
        input.addEventListener('focus', () => {
            mascot.classList.remove('hide-eyes'); 
        });

        input.addEventListener('input', (e) => {
            const textLength = e.target.value.length;
            const moveX = Math.min(Math.max((textLength * 0.6) - 6, -6), 6);
            
            pupils.forEach(pupil => {
                pupil.style.transform = `translate(${moveX}px, 4px)`; 
            });
        });

        input.addEventListener('blur', () => {
            pupils.forEach(pupil => {
                pupil.style.transform = `translate(0px, 0px)`; 
            });
        });
    });

    passInputs.forEach(input => {
        input.addEventListener('focus', () => {
            mascot.classList.add('hide-eyes'); 
            pupils.forEach(pupil => {
                pupil.style.transform = `translate(0px, -4px)`; 
            });
        });

        input.addEventListener('blur', () => {
            mascot.classList.remove('hide-eyes'); 
            pupils.forEach(pupil => {
                pupil.style.transform = `translate(0px, 0px)`; 
            });
        });
    });

    document.getElementById('toRegister').addEventListener('click', () => {
        loginSection.classList.remove('active');
        registerSection.classList.add('active');
        authTitle.innerText = "Tạo ID FStore";
        authSubtitle.innerText = "Một tài khoản cho mọi dịch vụ của chúng tôi.";
    });

    document.getElementById('toLogin').addEventListener('click', () => {
        registerSection.classList.remove('active');
        loginSection.classList.add('active');
        authTitle.innerText = "Đăng nhập FStore";
        authSubtitle.innerText = "Sử dụng tài khoản của bạn để tiếp tục.";

        document.getElementById('registerForm').style.display = 'block';
        document.getElementById('otpSection').style.display = 'none';
        document.getElementById('switchLoginWrap').style.display = 'block';
    });

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const pass = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');
        const btnSubmit = document.getElementById('btnLoginSubmit');

        btnSubmit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang đăng nhập...';
        btnSubmit.disabled = true;

        try {
            await signInWithEmailAndPassword(auth, email, pass);
            window.location.href = 'index.html';
        } catch (error) {
            errorEl.innerText = "Email hoặc mật khẩu không chính xác.";
            btnSubmit.innerHTML = 'Đăng nhập <i class="fa-solid fa-arrow-right"></i>';
            btnSubmit.disabled = false;
        }
    });

    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnRegSubmit = document.getElementById('btnRegSubmit');
        
        btnRegSubmit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang gửi mã...';
        btnRegSubmit.disabled = true;

        generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const expireTime = new Date(Date.now() + 15 * 60000).toLocaleTimeString('vi-VN');
        
        tempUserData = {
            name: document.getElementById('regName').value,
            email: document.getElementById('regEmail').value,
            password: document.getElementById('regPassword').value
        };

        try {
            await emailjs.send("service_dkp3tpq", "template_wi8uecg", {
                email: tempUserData.email,
                passcode: generatedOtp,
                time: expireTime
            });
            document.getElementById('registerForm').style.display = 'none';
            document.getElementById('switchLoginWrap').style.display = 'none';
            document.getElementById('otpSection').style.display = 'block';
            authTitle.innerText = "Nhập mã bảo mật";
            authSubtitle.innerText = `Chúng tôi đã gửi mã đến ${tempUserData.email}`;
        } catch (error) {
            document.getElementById('regError').innerText = "Lỗi gửi mail: Kiểm tra lại EmailJS ID.";
            btnRegSubmit.innerHTML = 'Đăng ký tài khoản';
            btnRegSubmit.disabled = false;
        }
    });

    document.getElementById('btnVerifyOtp').addEventListener('click', async () => {
        const btnVerify = document.getElementById('btnVerifyOtp');
        const errorEl = document.getElementById('regError');

        if (document.getElementById('otpInput').value === generatedOtp) {
            btnVerify.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang tạo tài khoản...';
            btnVerify.disabled = true;
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
                errorEl.innerText = error.message;
                btnVerify.innerHTML = 'Xác nhận';
                btnVerify.disabled = false;
            }
        } else {
            errorEl.innerText = "Mã OTP không đúng. Vui lòng thử lại!";
        }
    });
});