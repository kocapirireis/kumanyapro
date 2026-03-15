/**
 * Product Alias Matching Logic (Client side fallback)
 */
const Alias = {
    // Matching logic for product names during scanning
    match: (scannedName, masterList) => {
        // Simple fuzzy match simulation
        return masterList.find(p => 
            p.ad.toLowerCase().includes(scannedName.toLowerCase()) ||
            scannedName.toLowerCase().includes(p.ad.toLowerCase())
        );
    }
};
