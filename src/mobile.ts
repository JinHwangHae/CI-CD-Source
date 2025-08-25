function mobileActions(jQuery: any) {
    jQuery(document).on("click", ".mobile-info-toggle", () => {
        jQuery("#construkted-popup-info-btn").trigger("click");
    });
    jQuery(document).on("click", ".mobile-settings-toggle", () => {
        jQuery("#construkted-popup-settings-btn").trigger("click");
    });

    jQuery(document).on("click", ".mobile-nav-buttons-toggle", () => {
        if (jQuery(".theme-gowatch .construkted-viewer-controlbarContainer").is(":visible")) {
            jQuery(".theme-gowatch .construkted-viewer-controlbarContainer").hide();

            // Switch the icon to the up icon
            jQuery(".mobile-nav-buttons-toggle i").attr("class", "icon-down");
        } else {
            jQuery(".theme-gowatch .construkted-viewer-controlbarContainer").show();
            // Switch the icon to the up icon
            jQuery(".mobile-nav-buttons-toggle i").attr("class", "icon-up");
        }
    });
}
export default mobileActions;
