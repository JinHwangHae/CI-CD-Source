/* qeslint-disable */
// q@ts-nocheck

import * as JQuery from "jquery";

import deleteAnnotation from "./deleteAnnotation";
import getAnnotation from "./getAnnotaion";
import annotationComment from "./annotationComment";
import showAnnotationSettings from "./showAnnotationSettings";
import initAnnotationDialogEvents from "./initAnnotationDialogEvents";
import { initCancelAnnotation } from "./cancelAnnotaion";

export function init() {
    initAnnotationDialogEvents();
    initCancelAnnotation();

    jQuery(document).on("click", ".show-modal", function (this: JQuery, e: any) {
        e.preventDefault();

        const clicked = jQuery(this);
        const modal = jQuery(`.${clicked.attr("data-modal")}`);

        modal.removeClass("hidden");
        modal.find(".icon-close")[0].addEventListener(
            "click",
            () => {
                modal.addClass("hidden");
            },
            {
                once: true
            }
        );
    });

    // when user going to edit an annotation

    function getId(clickedItem: JQuery) {
        const annotationLineItem = clickedItem.parents(".annotation-line-item");

        return annotationLineItem.attr("data-entity-id") as string;
    }

    jQuery(document).on("click", ".annotation-line-item .annotation-edit", function (this: JQuery) {
        const currentUser = window.currentUser;

        if (currentUser && !(currentUser.has_access === "true" || currentUser.is_author === "true")) {
            return;
        }

        const id = getId(jQuery(this));

        const annotation = window.Construkted.project.getAnnotationById(id);

        if (!annotation) {
            console.error(`failed to find annotation: id: ${id}`);
            return;
        }

        showAnnotationSettings(annotation);

        window.Construkted.project.setAnnotationModified(true);
    });

    jQuery(document).on("click", ".delete-annotation", function (this: JQuery) {
        deleteAnnotation(jQuery(this));
    });

    jQuery(document).on("click", ".activate-clipping-box-button", function (this: JQuery) {
        const id = getId(jQuery(this));

        window.Construkted.clippingTools.clippingBoxTool.activateClippingBox(id);
        jQuery(this).parent().addClass("hidden"); // hide dropdown menu
    });

    jQuery(document).on("click", ".deactivate-clipping-box-button", function (this: JQuery) {
        const id = getId(jQuery(this));

        window.Construkted.clippingTools.clippingBoxTool.deactivateClippingBox(id);
        jQuery(this).parent().addClass("hidden"); // hide dropdown menu
    });

    jQuery(document).on("click", ".flip-clipping-plane-normal-button", function (this: JQuery) {
        const id = getId(jQuery(this));

        const clippingPlane = window.Construkted.clippingTools.clippingPlaneTool.getClippingPlaneById(id);

        if (clippingPlane) {
            clippingPlane.flipNormal();
            window.Construkted.project.updateAnnotationEx(id);
        }

        jQuery(this).parent().addClass("hidden"); // hide dropdown menu
    });

    jQuery(document).on("click", ".ck-annotation-details", function (this: JQuery, e: any) {
        e.preventDefault();

        getAnnotation(jQuery(this));

        return false;
    });

    $(document).on("submit", ".annotation-comments #commentform", function (this: JQuery, e: any) {
        jQuery(".ck-processing-loader").addClass("shown");

        e.preventDefault();

        annotationComment(jQuery(this));
        return false;
    });

    jQuery(document).on("click", ".annotation-options > i", function (this: JQuery, e: any) {
        e.preventDefault();

        const dotThreeElement = jQuery(this);

        jQuery(".annotation-options-list").addClass("hidden");
        dotThreeElement.siblings(".annotation-options-list").toggleClass("hidden");
        const id = dotThreeElement.siblings(".annotation-options-list").attr("id") as string;

        const dropDownMenu = document.getElementById(id);

        const clickHandler = function (event: any) {
            if (dotThreeElement[0] === event.target) {
                document.removeEventListener("click", clickHandler);
                return;
            }

            if (dropDownMenu && dropDownMenu !== event.target && !dropDownMenu.contains(event.target)) {
                if (dropDownMenu) {
                    dropDownMenu.classList.add("hidden");
                }

                document.removeEventListener("click", clickHandler);
            }
        };

        document.addEventListener("click", clickHandler);
    });
}

export * from "./common";
export * from "./onToolsEnd";
