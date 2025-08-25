/* qeslint-disable */
// q@ts-nocheck

import * as JQuery from "jquery";
import { Annotation } from "../types/common";
import { ImagePlane as ImagePlaneDrawing } from "../tools";

enum ConstruktedDrawingTypes {
    Note = "pin",
    Polyline = "line",
    Polygon = "area",
    ImagePlane = "imagePlane",
    Paint = "paint"
}

enum ConstruktedMeasurementTypes {
    Point = "measurement_point",
    Distance = "measurement_distance",
    Polyline = "measurement_polyline",
    Area = "measurement_area",
    Volume = "measurement_volume"
}

enum ConstruktedClippingTypes {
    ClippingBox = "clipping_box",
    ClippingPlane = "clipping_plane"
}

enum ConstruktedAnnotationCategories {
    Drawing = "drawing",
    Measurement = "measurement",
    Clipping = "clipping"
}

enum ConstruktedAnnotationTypes {
    DrawingPin = ConstruktedDrawingTypes.Note,
    DrawingPolyline = ConstruktedDrawingTypes.Polyline,
    DrawingPolygon = ConstruktedDrawingTypes.Polygon,
    DrawingImagePlane = ConstruktedDrawingTypes.ImagePlane,
    DrawingPaint = ConstruktedDrawingTypes.Paint,
    MeasurementPoint = ConstruktedMeasurementTypes.Point,
    MeasurementDistance = ConstruktedMeasurementTypes.Distance,
    MeasurementPolyline = ConstruktedMeasurementTypes.Polyline,
    MeasurementArea = ConstruktedMeasurementTypes.Area,
    MeasurementVolume = ConstruktedMeasurementTypes.Volume,
    ClippingBox = ConstruktedClippingTypes.ClippingBox,
    ClippingPlane = ConstruktedClippingTypes.ClippingPlane
}

export type AnnotationData = {
    id: string;
    type: ConstruktedAnnotationTypes;
    title: string;
    details: any; // object
};

export function clearAnnotationInputs() {
    const jQuery = window.jQuery;

    const form = jQuery("#sidebar-new-annotation");
    form.find("#annotation-show-note-pin").prop("checked", false);
    form.find("#annotation-show-note-text").prop("checked", false);
    form.find("#annotation-show-note-leader").prop("checked", false);
    form.find("#annotation_id").val("").remove();

    [
        "title",
        "type",
        "color",
        "description",
        "attachments",
        "image",
        "show-note-pin",
        "view-location",
        "line-width",
        "view-location",
        "entity-id",
        "details",
        "capture"
    ].forEach((field) => {
        jQuery(`[name="annotation-${field}"]`).val("");
    });
}

export const toggleAnnotationDetailsWindowPosition = (position: string) => {
    const jQuery = window.jQuery;

    // Check if ck-note-details has class floating
    if (position === "floating") {
        jQuery(".ck-note-details").addClass("floating");

        // Predefine some position and size
        const left = 100;
        const top = 100;
        const width = jQuery(window).width() / 2;
        const height = jQuery(window).height() / 1.7;

        // Set the position and size
        jQuery(".ck-note-details").css("left", left).css("top", top).css("width", width).css("height", height);

        // Initialize the draggable and resizable
        jQuery(".ck-note-details").draggable({
            containment: ".project-figure-content",
            handle: ".dragger"
        });

        jQuery(".ck-note-details").resizable({
            containment: ".project-figure-content"
        });
    } else {
        // jQuery(".ck-note-modal").css("left", 0).css("top", 60);
        // Delete all inline styles
        jQuery(".ck-note-details").removeAttr("style");

        // Remove draggable and resizable
        if (jQuery(".ck-note-details").hasClass("ui-draggable")) {
            jQuery(".ck-note-details").draggable("destroy");
        }
        if (jQuery(".ck-note-details").hasClass("ui-resizable")) {
            jQuery(".ck-note-details").resizable("destroy");
        }
        // Remove the floating class
        jQuery(".ck-note-details").removeClass("floating");
    }
};

export const animateAnnotationDetailWindow = (html: string) => {
    let timeout = 10;

    const jQuery = window.jQuery;

    if (jQuery(".ck-note-details").length > 0) {
        timeout = 500;
    }

    jQuery(".ck-note-details").removeClass("shown");
    setTimeout(() => {
        jQuery(".ck-note-details").remove();
        jQuery(".project-figure-content ").append(html);
    }, timeout);

    setTimeout(() => {
        jQuery(".ck-note-details").addClass("shown");
        jQuery(".ck-note-details .icon-close.close-note").on("click", function (this: JQuery) {
            const clicked = jQuery(this);
            clicked.parents(".ck-note-details").removeClass("shown");
            setTimeout(() => {
                clicked.parents(".ck-note-details").remove();
            }, 500);
        });

        const position = jQuery.cookie("ck-modal-position");

        toggleAnnotationDetailsWindowPosition(position);
    }, 600);
};

export function triggerShowingAnnontationsPopup() {
    const jQuery = window.jQuery;

    setTimeout(() => {
        jQuery("#construkted-annontations-popup-btn").trigger("click");
    }, 100);
}

export function generateAttachmentsHTML(annotation: Annotation, withRemove = true) {
    if (annotation && annotation.attachments.length > 0) {
        const output: string[] = [];

        annotation.attachments.forEach((attachment: any, index: number) => {
            output.push(
                `<div class="ck-attachment-line-item make-flex ${
                    withRemove === true ? "attachment-remove" : ""
                }" data-annotation="${
                    attachment.id
                }" data-index="${index}"><a target="_blank" rel="noopener noreferrer" href="${
                    attachment.url
                }"><i class="icon-attach"></i> ${attachment.name}</a>${
                    withRemove === true ? '<i class="icon-close"></i>' : ""
                }</div>`
            );
        });

        return output.join("");
    }

    return "";
}

export function createCancelButton() {
    // Check if already exists
    const existingButton = document.getElementById("cancel-annotation-add");

    if (existingButton) {
        return existingButton;
    }

    const button = document.createElement("button");
    button.className = `cancel-annotation-add annotation-create-action`;
    button.id = "cancel-annotation-add";
    button.innerHTML = '<i class="icon-cancel"></i> Cancel';
    return button;
}

export function createFinishButton() {
    // Check if already exists
    const existingButton = document.getElementById("finish-annotation");

    if (existingButton) {
        return existingButton;
    }

    const button = document.createElement("button");
    button.className = `finish-annotation annotation-create-action`;
    button.id = "finish-annotation";
    button.innerHTML = '<i class="icon-tick"></i> Finish';
    return button;
}

export function deleteFinishCancelButtons() {
    const cancelButton = document.getElementById("cancel-annotation-add");
    if (cancelButton) cancelButton.remove();

    const finishButton = document.getElementById("finish-annotation");
    if (finishButton) finishButton.remove();
}

export {
    ConstruktedAnnotationCategories,
    ConstruktedAnnotationTypes,
    ConstruktedDrawingTypes,
    ConstruktedMeasurementTypes,
    ConstruktedClippingTypes
};

export function getDrawing() {
    const annotationId = jQuery("#annotation-entity-id").val() as string;

    if (!annotationId) {
        return undefined;
    }

    return window.Construkted.drawingTools.getDrawingById(annotationId);
}

export function getImagePlane() {
    const drawing = getDrawing();

    if (!drawing) {
        return undefined;
    }

    if (drawing instanceof ImagePlaneDrawing) {
        return drawing as ImagePlaneDrawing;
    }

    return undefined;
}
