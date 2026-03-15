/**
 * Inventory specific data handling
 */
const Inventory = {
    getCategories: (data) => {
        const cats = new Set();
        data.forEach(item => cats.add(item.kategori || "Diğer"));
        return Array.from(cats).sort();
    },
    
    getCriticalItems: (data) => {
        return data.filter(item => item.takip && item.miktar <= (item.kritik || 0));
    }
};
