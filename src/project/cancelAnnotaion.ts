import { ConstruktedAnnotationTypes, clearAnnotationInputs } from "./common";

export function cancelAnnotation() {
    const construkted = window.Construkted;
    const project = construkted.project;

    console.assert(project.annotationModified(), "error");

    const id = jQuery("#sidebar-new-annotation").find("#annotation-entity-id").val() as string;

    construkted.deactivateCurrentMapTool();

    const sidebarMode = jQuery("#sidebar-new-annotation").hasClass("edit-mode") ? "edit" : "add";
    const annotationType = jQuery("#sidebar-new-annotation")
        .find("#annotation-type")
        .val() as unknown as ConstruktedAnnotationTypes;

    if (!annotationType) {
        throw new Error("annontationType error");
    }

    const annotationCategory = project.getAnnotationCategoryFromAnnotationType(
        annotationType as unknown as ConstruktedAnnotationTypes
    );

    const clippingBoxTool = construkted.clippingTools.clippingBoxTool;
    const clippingPlaneTool = construkted.clippingTools.clippingPlaneTool;

    if (sidebarMode === "add" && id) {
        const item = project.annotations.filter((e) => e.entity_id === id);

        console.assert(item.length === 0, "error");

        let removed = false;

        removed = project.removeAnnotation(id, annotationCategory);

        if (!removed) {
            console.error(`failed to remove id: ${id}`);
        }

        if (annotationType === ConstruktedAnnotationTypes.ClippingBox) {
            clippingBoxTool.restoreStatus();
        } else if (annotationType === ConstruktedAnnotationTypes.ClippingPlane) {
            clippingPlaneTool.restoreStatus();
        }
    } else if (sidebarMode === "edit") {
        if (annotationType === ConstruktedAnnotationTypes.ClippingBox) {
            clippingBoxTool.restoreStatus();

            const clippingBox = clippingBoxTool.getClippingBoxById(id);

            if (clippingBox) {
                clippingBox.showEditControls(false);
            }
        } else if (annotationType === ConstruktedAnnotationTypes.ClippingPlane) {
            clippingPlaneTool.restoreStatus();

            const clippingPlane = clippingPlaneTool.getClippingPlaneById(id);

            if (clippingPlane) {
                clippingPlane.editable = false;
            }
        }

        if (
            annotationType === ConstruktedAnnotationTypes.MeasurementPoint ||
            annotationType === ConstruktedAnnotationTypes.MeasurementDistance ||
            annotationType === ConstruktedAnnotationTypes.MeasurementPolyline ||
            annotationType === ConstruktedAnnotationTypes.MeasurementArea
        ) {
            const annotation = construkted.project.getAnnotation(id);

            const measurement = construkted.measurementTools.getMeasurmentById(annotation!.entity_id);

            if (measurement && measurement.removeUpdatedListener) {
                measurement.removeUpdatedListener();
                measurement.removeUpdatedListener = undefined;
            }
        }

        jQuery("#sidebar-new-annotation").removeClass("edit-mode");
    }

    // Clear all the input fields
    clearAnnotationInputs();

    project.setAnnotationModified(false);
}

const confirmationMessage = "You have unsaved changes. Are you sure you want to leave?";

export function initCancelAnnotation() {
    jQuery(document).ready(() => {
        // Catch navigating back
        window.onpopstate = function () {
            const project = window.Construkted.project;

            if (project.annotationModified()) {
                if (!project.askIgnoreAnnotationModified()) {
                    window.history.pushState(null, document.title, window.location.href);
                }
            }
        };

        // eslint-disable-next-line consistent-return
        function confirmExit(event: any) {
            const project = window.Construkted.project;

            if (project.annotationModified()) {
                (event || window.event).returnValue = confirmationMessage; // Gecko + IE
                return confirmationMessage; // Gecko + Webkit, Safari, Chrome etc.
            }
        }

        // Catch window close
        window.onbeforeunload = confirmExit;

        if (jQuery("body").hasClass("single-project")) {
            jQuery(window).on("load", () => {
                window.Construkted.projectViewer.entityOrPrimitivePicked.addEventListener((id) => {
                    if (id === -1) {
                        return;
                    }

                    const fakeClicker = jQuery(`input#${id}`).next();

                    if (fakeClicker.length === 0) {
                        console.error(`failed to find fakeClicker for id: ${id}`);
                    }

                    const annotation = window.Construkted.project.getAnnotationById(id);

                    if (!annotation) {
                        return;
                    }

                    if (annotation.post_id === 0) {
                        // eslint-disable-next-line no-useless-return
                        return;
                    }
                });
            });
        }
    });
}
