export default function initFilterPopup() {
    jQuery(document).on("click", "#filter-globe-assets", () => {
        const assetExplorer = window.construktedAssetExplorer;

        assetExplorer!.filter();
    });
}
