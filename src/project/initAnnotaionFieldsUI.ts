/* qeslint-disable */
// q@ts-nocheck

import { Color, Math as CesiumMath, Cartographic } from "cesium";
import { ConstruktedAnnotationCategories, ConstruktedAnnotationTypes, generateAttachmentsHTML } from "./common";
import { Annotation } from "../types/common";
import { ImagePlane, PaintDrawing } from "../tools";
import { MeasureUnits } from "../core";

const toggleAnnotationViewButtons = (annotationSettings: any) => {
    const jQuery = window.jQuery;

    // Activate/deactivate the view buttons
    if (annotationSettings) {
        if (!annotationSettings.view || annotationSettings.view.length === 0) {
            jQuery("#annotation-reset-view").attr("disabled", "disabled");
            jQuery("#annotation-set-view").html('<i class="icon-plus"></i> Set view');
        } else {
            jQuery("#annotation-reset-view").removeAttr("disabled");
            jQuery("#annotation-set-view").html('<i class="icon-plus"></i> Change view');
        }
    }
};

const generateAnnotationAttachments = (annotation: Annotation) => {
    const jQuery = window.jQuery;

    if (annotation && annotation.attachments && annotation.attachments.length > 0) {
        const attachments = generateAttachmentsHTML(annotation, true);
        jQuery("#annotation-attachments-list").html(attachments);
    } else {
        jQuery("#annotation-attachments-list").html("");
    }
};

const generateAnnotationImage = (annotation: Annotation) => {
    const jQuery = window.jQuery;

    jQuery(".annotation-image-holder").remove();

    if (annotation && typeof annotation.image !== "boolean") {
        jQuery("#annotation-image")
            .parents(".line-value")
            .prepend(
                `<div class="annotation-image-holder"><img src="${annotation.image.url}" /><a href="#" class="delete-annotation-image">Delete</a></div>`
            );
    }
};

function generateAssetOptionList(assets: { post_id: string; post_title: string }[]) {
    const jQuery = window.jQuery;

    let options = "<option selected value=''>None</option>";

    assets.forEach((asset) => {
        options += `<option value="${asset.post_id}">${asset.post_title}</option>`;
    });

    jQuery("#annotation-asset").html(options);
}

export function initAnnotaionFieldsUI(annotation: Annotation) {
    const annotationType = annotation.type as unknown as ConstruktedAnnotationTypes;
    const construkted = window.Construkted;
    const project = construkted.project;
    const annotationCategory = project.getAnnotationCategoryFromAnnotationType(annotationType);

    jQuery("#annotation-entity-id").val(annotation.entity_id).trigger("change");
    jQuery("#annotation-type").val(annotationType).trigger("change");
    jQuery("#annotation-title").val(annotation.title).trigger("change");
    jQuery("#annotation-details").val(annotation.details).trigger("change");

    // why? backend require color
    jQuery("#annotation-color").val("#fbc02d");

    if (annotationCategory === ConstruktedAnnotationCategories.Drawing) {
        const hexColor = Color.fromCssColorString(annotation.color).toCssHexString();

        // Extract opacity from hexColor if available (e.g., #RRGGBBAA)
        let hexOpacity = 1;
        if (hexColor.length === 9) {
            // #RRGGBBAA format
            const alphaHex = hexColor.slice(7, 9);
            hexOpacity = parseInt(alphaHex, 16) / 255;
        }

        jQuery(`.ck-color-option[data-value="${hexColor.slice(0, 7)}"]`)
            .addClass("selected")
            .siblings()
            .removeClass("selected");
        jQuery("#annotation-color").val(annotation.color).trigger("change");
        jQuery("#annotation-color-opacity")
            .val(hexOpacity * 100)
            .trigger("change");

        jQuery("#annotation-line-width").val(annotation.linewidth).trigger("change");
        jQuery("#annotation-drape-over-geometry").prop("checked", annotation.clamp_to_ground === "true");

        const drawing = construkted.drawingTools.getDrawingById(annotation.entity_id);

        if (!drawing) {
            return;
        }

        if (annotationType === ConstruktedAnnotationTypes.DrawingImagePlane) {
            const imagePlane = drawing as ImagePlane;
            const dimensions = imagePlane.planePrimitive.dimensions;

            jQuery("#image-plane-scale-x").val(dimensions.x.toFixed(3));
            jQuery("#image-plane-scale-y").val(dimensions.y.toFixed(3));

            const position = imagePlane.planePrimitive.position;
            const carto = Cartographic.fromCartesian(position);

            jQuery("#image-plane-position-longitude").val(CesiumMath.toDegrees(carto.longitude).toFixed(5));
            jQuery("#image-plane-position-latitude").val(CesiumMath.toDegrees(carto.latitude).toFixed(5));
            jQuery("#image-plane-position-height").val(carto.height.toFixed(1));

            const hpr = imagePlane.hpr;

            jQuery("#image-plane-rotation-heading").val(CesiumMath.toDegrees(hpr.heading).toFixed(2));
            jQuery("#image-plane-rotation-pitch").val(CesiumMath.toDegrees(hpr.pitch).toFixed(2));
            jQuery("#image-plane-rotation-roll").val(CesiumMath.toDegrees(hpr.roll).toFixed(2));

            jQuery(".distance-unit-label").text(
                MeasureUnits.getDistanceUnitSymbol(construkted.measurementTools.units.distanceUnits)
            );

            jQuery("#lock-scale-to-image-aspect-checkbox").prop("checked", imagePlane.planePrimitive.keepImageAspect);
        } else if (annotationType === ConstruktedAnnotationTypes.DrawingPaint) {
            const paintDrawing = drawing as PaintDrawing;

            jQuery("#annotation-line-width").val(paintDrawing.polylinePrimitive.width).trigger("change");
        }
    } else if (annotationCategory === ConstruktedAnnotationCategories.Clipping) {
        jQuery("#activate-clipping-box-checkbox").prop("checked", true);
        jQuery("#display-clipping-box-wall").prop("checked", true);
    } else if (
        annotationType === ConstruktedAnnotationTypes.MeasurementPoint ||
        annotationType === ConstruktedAnnotationTypes.MeasurementDistance ||
        annotationType === ConstruktedAnnotationTypes.MeasurementPolyline ||
        annotationType === ConstruktedAnnotationTypes.MeasurementArea
    ) {
        const measurement = construkted.measurementTools.getMeasurmentById(annotation.entity_id);

        if (measurement) {
            jQuery("#annotation-measurement").text(measurement.measurementString() as string);

            measurement.removeUpdatedListener = measurement.updated.addEventListener(() => {
                jQuery("#annotation-measurement").text(measurement.measurementString() as string);
            });
        }
    } else if (annotationType === ConstruktedAnnotationTypes.MeasurementVolume) {
        const detail = JSON.parse(annotation.details);

        jQuery("#annotation-volume-measurement-sampling-slider").val(detail.gridCellSize).trigger("change");
        jQuery("#annotation-volume-measurement-vertical-displacement-slider").val(detail.height).trigger("change");

        const info = `Total Calculated Volume: \n Fill Volume: \n Cut Volume:`;

        jQuery("#annotation-measurement").text(info);
    }

    if (annotation.view === false) {
        jQuery("#annotation-view-location").val("").trigger("change");
    } else {
        jQuery("#annotation-view-location").val(JSON.stringify(annotation.view)).trigger("change");
    }

    jQuery("#annotation-show-note-pin")
        .prop("checked", annotation.show_note_pin ? annotation.show_note_pin === "y" : false)
        .trigger("change");

    jQuery("#annotation-show-note-text")
        .prop("checked", annotation.show_note_text ? annotation.show_note_text === "y" : false)
        .trigger("change");

    jQuery("#annotation-show-note-leader")
        .prop("checked", annotation.show_note_leader ? annotation.show_note_leader === "y" : false)
        .trigger("change");

    jQuery("#annotation-description").val(annotation.description).trigger("change");

    project.toggleAnnotationFields(annotationType);
    generateAnnotationAttachments(annotation);
    generateAnnotationImage(annotation);
    toggleAnnotationViewButtons(annotation);

    if (construkted.isProject()) {
        generateAssetOptionList(window.project_assets);
    }

    // If asset is not selected, select it
    if (annotation.asset) {
        jQuery("#annotation-asset").val(annotation.asset).trigger("change");
    }
}
