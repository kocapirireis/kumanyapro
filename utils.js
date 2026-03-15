/**
 * Utility functions for image processing and general helpers
 */

/**
 * Resizes an image file and returns base64 string
 */
async function resizeImage(file, maxWidth = 1200) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Low quality for faster upload
                resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
            };
        };
        reader.onerror = error => reject(error);
    });
}

/**
 * Global UI Helpers
 */
window.updateUI = () => {
    if (window.globalUrunler) {
        renderInventoryList(window.globalUrunler);
    }
};
