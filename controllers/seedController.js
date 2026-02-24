// Import cấu hình DB đã làm ở Phần 1
import { db } from '../models/firebaseConfig.js';
// Import các hàm của Firestore
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. CHUẨN BỊ MẢNG DỮ LIỆU DANH MỤC (Cha & Con)
const categoriesData = [
    // --- DANH MỤC CHA (parentId: null) ---
    { id: "cat_mac", name: "Mac", parentId: null, order: 1 },
    { id: "cat_ipad", name: "iPad", parentId: null, order: 2 },
    { id: "cat_iphone", name: "iPhone", parentId: null, order: 3 },
    { id: "cat_watch", name: "Watch", parentId: null, order: 4 },

    // --- DANH MỤC CON ---
    { id: "cat_ip15", name: "iPhone 15 Series", parentId: "cat_iphone", order: 1 },
    { id: "cat_ip16", name: "iPhone 16 Series", parentId: "cat_iphone", order: 2 },
    { id: "cat_macpro", name: "MacBook Pro", parentId: "cat_mac", order: 1 },
    { id: "cat_macair", name: "MacBook Air", parentId: "cat_mac", order: 2 }
];

// 2. CHUẨN BỊ MẢNG DỮ LIỆU SẢN PHẨM (Kèm biến thể)
const productsData = [
    {
        id: "prod_ip15pro",
        categoryId: "cat_ip15", // Liên kết với danh mục con iPhone 15
        name: "iPhone 15 Pro",
        description: "Thiết kế Titanium đẳng cấp, chip A17 Pro mạnh mẽ.",
        techSpecs: { screen: "6.1 inch Super Retina XDR", chip: "A17 Pro", camera: "48MP" },
        variants: [
            { variantId: "v1", color: "Titan Tự nhiên", storage: "256GB", price: 28990000, stock: 50, image: "https://shopdunk.com/images/thumbs/0022265_iphone-15-pro-128gb_240.png" },
            { variantId: "v2", color: "Titan Đen", storage: "512GB", price: 34990000, stock: 15, image: "https://shopdunk.com/images/thumbs/0022262_iphone-15-pro-128gb_240.png" }
        ]
    },
    {
        id: "prod_macpro_m3",
        categoryId: "cat_macpro", // Liên kết với danh mục con MacBook Pro
        name: "MacBook Pro 14 M3",
        description: "Laptop việt dã cho dân chuyên nghiệp.",
        techSpecs: { screen: "14.2 inch Liquid Retina XDR", chip: "Apple M3", ram: "16GB" },
        variants: [
            { variantId: "v1", color: "Space Black", storage: "512GB", price: 39990000, stock: 20, image: "https://shopdunk.com/images/thumbs/0022384_macbook-pro-14-inch-m3-pro-2023-18-core-gpu-18gb-512gb_240.png" },
            { variantId: "v2", color: "Silver", storage: "1TB", price: 44990000, stock: 10, image: "https://shopdunk.com/images/thumbs/0022382_macbook-pro-14-inch-m3-pro-2023-18-core-gpu-18gb-512gb_240.png" }
        ]
    }
];

// 3. LOGIC BƠM DỮ LIỆU KHI BẤM NÚT
document.getElementById('btnSeed').addEventListener('click', async () => {
    const statusText = document.getElementById('status');
    statusText.style.color = "blue";
    statusText.innerText = "⏳ Đang kết nối Firebase và bơm dữ liệu... Vui lòng đợi...";

    try {
        // Bơm mảng Categories
        for (const cat of categoriesData) {
            // setDoc(doc(database, "tên_bảng", "id_của_document"), dữ_liệu)
            await setDoc(doc(db, "categories", cat.id), cat);
        }

        // Bơm mảng Products
        for (const prod of productsData) {
            await setDoc(doc(db, "products", prod.id), prod);
        }

        statusText.style.color = "green";
        statusText.innerText = "✅ THÀNH CÔNG! Đã bơm toàn bộ Danh mục và Sản phẩm vào Firestore!";
        console.log("Seed data finished!");

    } catch (error) {
        console.error("Lỗi khi bơm dữ liệu: ", error);
        statusText.style.color = "red";
        statusText.innerText = "❌ CÓ LỖI XẢY RA: " + error.message + " (F12 để xem chi tiết Console)";
    }
});