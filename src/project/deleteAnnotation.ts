/* qeslint-disable */
// q@ts-nocheck
import * as JQuery from "jquery";
import { AjaxResponse } from "../types/common";
import { ConstruktedAnnotationCategories, ConstruktedAnnotationTypes, animateAnnotationDetailWindow } from "./common";
import { AnnotationTreeView } from "./annotationTreeView";

export default function deleteAnnotation(clickedItem: JQuery) {
    const removeConfirmation = window.confirm("Are you sure you want to delete this?");

    if (removeConfirmation === false) {
        return;
    }

    const jQuery = window.jQuery;
    jQuery(".ck-processing-loader").addClass("shown");
    animateAnnotationDetailWindow("");

    const entityId = (clickedItem.attr("data-entity-id") || clickedItem.attr("data-id")) as string;

    // Get the annotation data from Project to ensure we have the correct post_id
    const annotation = window.Construkted.project.getAnnotationById(entityId);
    if (!annotation) {
        jQuery(".ck-processing-loader").removeClass("shown");
        return;
    }

    const postId = annotation.post_id;
    const nonce = jQuery('[name="ck_annotation_nonce"]').val();

    const data = {
        action: "delete_annotation",
        nonce: nonce,
        entity: entityId,
        annotation_id: postId
    };

    jQuery.post(window.gowatch.ajaxurl, data, (res: AjaxResponse) => {
        // Hide loader first
        jQuery(".ck-processing-loader").removeClass("shown");

        if (res.status === 200) {
            const construkted = window.Construkted;

            // Get the correct category from the annotation type
            const annotationType = annotation.type as unknown as ConstruktedAnnotationTypes;
            const category = construkted.project.getAnnotationCategoryFromAnnotationType(annotationType);

            // First remove from viewer based on category
            if (category === ConstruktedAnnotationCategories.Drawing) {
                construkted.drawingTools.removeDrawingById(entityId);
            } else if (category === ConstruktedAnnotationCategories.Measurement) {
                construkted.measurementTools.removeMeasurementById(entityId);
            } else if (category === ConstruktedAnnotationCategories.Clipping) {
                construkted.clippingTools.removeClipping(entityId);
            }

            // Then remove from UI and project
            clickedItem.remove();
            jQuery(`.annotation-line-item[data-entity-id="${entityId}"]`).remove();
            construkted.project.removeAnnotation(entityId, category);

            // Remove from tree view properly
            const treeContainer = document.querySelector("#annotation-tree-container");
            if (treeContainer && (treeContainer as any)._treeView instanceof AnnotationTreeView) {
                const treeView = (treeContainer as any)._treeView as AnnotationTreeView;
                // Removing node from tree view
                const nodeRemoved = treeView.removeNode(entityId);
                if (nodeRemoved) {
                    // Successfully removed node from tree view
                    if (treeView.validateTreeState && !treeView.validateTreeState()) {
                        // Tree view state inconsistent after node removal, attempting repair...
                        if (treeView.repairTreeState) {
                            treeView.repairTreeState();
                        }
                    }
                    treeView.saveTree().catch((error) => {
                        console.error("Failed to save tree structure after node removal:", error);
                    });
                }
            }
        } else {
            alert(res.msg);
        }
    });
}
