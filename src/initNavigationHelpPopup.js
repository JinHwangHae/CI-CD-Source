/* eslint-disable */
// q@ts-nocheck

// Create the asset modal features
function initNavigationHelpPopup() {
    const jqFPVNavigationPopup = jQuery(".ck-asset-modal");

    // Check if we have a cookie with the modal box closed
    const ckAssetModal = jQuery.cookie("ck-asset-modal");
    if (ckAssetModal === "y") {
        jqFPVNavigationPopup.addClass("is-closed hidden");
    } else {
        jqFPVNavigationPopup.fadeIn(600);
    }

    jQuery(document).on("click", ".ck-asset-modal .icon-close, .ck-asset-modal-footer .gw3-button", function (e) {
        e.preventDefault();
        const modal = jQuery(this).parents(".ck-asset-modal");
        modal.addClass("hidden is-closed");

        // Check if the checkbox is checked to make sure we disable it for 31 days
        if (jQuery("#ck-asset-modal-close").is(":checked")) {
            jQuery.cookie("ck-asset-modal", "y", { expires: 31 });
        }
    });

    jQuery(document).on("click", ".ck-tabs-items li", function (e) {
        e.preventDefault();

        const clickedItem = jQuery(this);
        const index = clickedItem.index() + 1;
        const tabContainer = clickedItem.parents(".ck-tabs");

        clickedItem.addClass("active").siblings().removeClass("active");
        tabContainer
            .find(`.ck-tabs-container > div:nth-child(${index})`)
            .addClass("active")
            .siblings()
            .removeClass("active");
    });

    jQuery(document).on("click", ".ck-modal-toggler", (e) => {
        e.preventDefault();
        jqFPVNavigationPopup.removeClass("hidden is-closed");
        jqFPVNavigationPopup.fadeIn(300);
    });

    jQuery(".fpv-nav-btn").on("click", (e) => {
        e.preventDefault();
    });
}

export { initNavigationHelpPopup };
