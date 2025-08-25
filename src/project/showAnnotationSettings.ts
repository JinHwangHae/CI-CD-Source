/* qeslint-disable */

import { Annotation } from "../types";
import { ConstruktedAnnotationTypes } from "./common";
import { initAnnotaionFieldsUI } from "./initAnnotaionFieldsUI";

export default function showAnnotationSettings(annotation: Annotation) {
    window.filesToUpload = [];

    const jQuery = window.jQuery;

    jQuery(".ck-processing-loader").addClass("shown");
    jQuery(".ck-featimg-line-item").remove();
    jQuery("#annotation-image-holder").remove();

    const postId = annotation.post_id;

    if (postId) {
        jQuery("#annotation-project").after(
            `<input type="hidden" id="annotation_id" name="annotation_id" value="${postId}" />`
        );
        jQuery("#annotation-capture-image").removeClass("hidden");
        jQuery("#annotation-capture-image .capture-view").attr("data-post-id", postId);
    } else {
        jQuery("#annotation-capture-image .capture-view").attr("data-post-id", 0);
        jQuery("#annotation-capture-image").addClass("hidden");
    }

    jQuery("#sidebar-new-annotation").show().siblings(".popup-wrapper").hide();
    initAnnotaionFieldsUI(annotation);

    const construkted = window.Construkted;
    const project = construkted.project;

    project.fetchAnnotationDetailsToUI(annotation.entity_id, annotation.type as unknown as ConstruktedAnnotationTypes);

    jQuery("#add-annotation").text("Update annotation");
    jQuery(".cesium-viewer-infoBoxContainer").hide();
    jQuery(".ck-processing-loader").removeClass("shown");
    jQuery("#sidebar-new-annotation").addClass("edit-mode");

    if (annotation.view !== false) {
        project.goToSavedAnnotationView(annotation);
    } else {
        project.flyToAnnotation(annotation);
    }

    // https://github.com/Construkted-Reality/construkted_reality_v1.x/issues/985

    construkted.startEditingAnnotation(annotation.entity_id, "edit");
}
