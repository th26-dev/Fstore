
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const footerPlaceholder = document.getElementById("footer-placeholder");
        
        if (footerPlaceholder) {
            const response = await fetch("footer.html");
            const footerHTML = await response.text();
            
            footerPlaceholder.innerHTML = footerHTML;
        }
    } catch (error) {
        console.error("Lỗi khi tải Footer:", error);
    }
});