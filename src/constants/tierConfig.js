
// src/constants/tierConfig.js
export const tierConfig = {
    bronze: {
        color: "#CD7F32",
        minPageRank: 0.0,
        maxPageRank: 0.3,
        label: "브론즈"
    },
    silver: {
        color: "#C0C0C0",
        minPageRank: 0.3,
        maxPageRank: 0.5,
        label: "실버"
    },
    gold: {
        color: "#FFD700",
        minPageRank: 0.5,
        maxPageRank: 0.7,
        label: "골드"
    },
    platinum: {
        color: "#E5E4E2",
        minPageRank: 0.7,
        maxPageRank: 0.8,
        label: "플래티넘"
    },
    diamond: {
        color: "#B9F2FF",
        minPageRank: 0.8,
        maxPageRank: 1.0,
        label: "다이아몬드"
    }
};

// Get tier based on pagerank
export const getTierFromPageRank = (pageRank) => {
    if (pageRank >= tierConfig.diamond.minPageRank) return "diamond";
    if (pageRank >= tierConfig.platinum.minPageRank) return "platinum";
    if (pageRank >= tierConfig.gold.minPageRank) return "gold";
    if (pageRank >= tierConfig.silver.minPageRank) return "silver";
    return "bronze";
};
