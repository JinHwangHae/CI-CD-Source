/* qeslint-disable */
// q@ts-nocheck

import { deleteFinishCancelButtons, triggerShowingAnnontationsPopup } from "./project/common";
import { showAnnotationDetailAndFly } from "./project/showAnnotaionDetailAndFly";
import { AnnotationTreeView } from "./project/annotationTreeView";
import { removeActiveClassFromAllAnnotationToolButtons } from "./annotationTools/common";

function initSidebar() {
    jQuery(($) => {
        const sidebarToolButtonsIds = [
            "#construkted-popup-info-btn",
            "#construkted-popup-transform-btn",
            "#construkted-annontations-popup-btn",
            "#construkted-popup-asset-manager-btn",
            "#construkted-annotation-drawing-tools-btn",
            "#construkted-annotation-clipping-tools-btn",
            "#construkted-popup-team-btn",
            "#construkted-popup-view-btn",
            "#construkted-popup-settings-btn",
            "#sidebar-globe-filter-btn"
        ];

        const sideBarToolButtons = $(sidebarToolButtonsIds.join(","));
        const closeBtn = $(".popup-wrapper .close-btn");

        function hideAllPopup() {
            jQuery(".popup-wrapper").hide();
            jQuery(".popup-wrapper").removeClass("is-shown");
            jQuery(".transform-has-modal-next").next().addClass("hidden");
        }

        const construkted = window.Construkted;
        const project = construkted.project;

        sideBarToolButtons.on("click", function () {
            // Check if we're navigating away from annotations popup
            const treeContainer = document.querySelector("#annotation-tree-container");
            const treeView = treeContainer
                ? (treeContainer as unknown as { _treeView: AnnotationTreeView })._treeView
                : null;
            const isLeavingAnnotations = jQuery("#construkted-annontations-popup").is(":visible");

            if (isLeavingAnnotations && treeView && treeView.hasUnsavedChanges()) {
                if (!treeView.confirmDiscardChanges()) {
                    return;
                }
            }

            if (project.annotationModified()) {
                if (!project.tryCancelAnnotation()) {
                    return;
                }
            }

            if (project.georeferencingModified()) {
                if (!project.askIgnoreGeoreferencingModified()) {
                    construkted.assetViewer.visualPositionEditor?.ui.cancel();
                    return;
                }
            }

            hideAllPopup();
            deleteFinishCancelButtons();
            removeActiveClassFromAllAnnotationToolButtons();
            jQuery("#navbar-right li.nav-item").removeClass("active");

            if (!jQuery(this).parent().hasClass("active") && jQuery(this).attr("id")) {
                const itemDivID = jQuery(this).attr("id");
                const popupID = itemDivID!.replace("-btn", "");
                jQuery(`#${popupID}`).addClass("is-shown").show();
            }

            $(this).parent().toggleClass("active").siblings().not(this).removeClass("active");

            if (window.construktedAssetViewer) window.construktedAssetViewer.tryDeactivateVisualPositionEditor();
        });

        closeBtn.click(function () {
            if (project.annotationModified()) {
                if (!project.tryCancelAnnotation()) {
                    return;
                }
            }

            jQuery(this).parents(".popup-wrapper").removeClass("is-shown").hide();
            jQuery("#navbar-right li.nav-item").removeClass("active");
            jQuery(".transform-has-modal-next").next().addClass("hidden");

            const popupName = $(this).parents(".popup-wrapper").attr("id");

            // Open the sidebar if current sidebar is new annotation
            if (popupName === "sidebar-new-annotation") {
                triggerShowingAnnontationsPopup();
            }

            if (window.construktedAssetViewer) window.construktedAssetViewer.tryDeactivateVisualPositionEditor();
        });
    });

    jQuery("#scroll-down-btn").on("click", () => {
        const toScroll =
            // @ts-ignore
            jQuery(".post-meta").offset().top -
            // @ts-ignore
            jQuery(".featured-image").height() -
            // @ts-ignore
            jQuery("#header").height() +
            // @ts-ignore
            jQuery(".post-meta").height();

        $("html, body").animate({ scrollTop: toScroll }, 600);
    });

    jQuery(window).on("scroll", () => {
        // @ts-ignore
        if (jQuery(window).scrollTop() > 200) {
            jQuery("#scroll-down-btn").fadeOut(300);
        } else {
            jQuery("#scroll-down-btn").fadeIn(300);
        }
    });

    jQuery(".embed-code-link").on("click", () => {
        jQuery(".embed-content").toggleClass("in");

        return false;
    });

    jQuery(document).on("click", ".variation-action", function () {
        const currentItem = jQuery(this);
        const currentValue = jQuery(this).attr("data-value");
        // @ts-ignore
        jQuery(".variations #disk_space").val(currentValue).trigger("change");

        currentItem.parent().addClass("selected").siblings().removeClass("selected");
    });

    jQuery(document).ready(() => {
        if (jQuery("table.variations").length > 0) {
            const defaultValue = jQuery("#disk_space").val();

            jQuery(`.variation-action[data-value="${defaultValue}"]`).trigger("click");

            const currentSubValue = jQuery(".flex-row").data("current");

            if (currentSubValue > 0) {
                jQuery(`.variation-action[data-value="${currentSubValue}"]`).trigger("click");
            }
        }
    });

    jQuery(document).on(
        "click",
        ".annotation-line-item .annotation-title, .annotation-line-item .view-annotation",
        function () {
            const id = jQuery(this).parents(".annotation-line-item").attr("data-entity-id");

            if (id) {
                showAnnotationDetailAndFly(id);
            }
        }
    );
}

export { initSidebar };
