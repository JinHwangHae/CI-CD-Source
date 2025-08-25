/* qeslint-disable */
// q@ts-nocheck

import { Color, HeadingPitchRoll } from "cesium";
import { Annotation } from "../types/common";
import {
    ConstruktedAnnotationTypes,
    ConstruktedDrawingTypes,
    ConstruktedMeasurementTypes,
    ConstruktedAnnotationCategories
} from "./common";

import { newCartesian2FromObject, newCartesian3FromObject } from "../tools/annotation/util";

function loadDrawing(annotation: Annotation) {
    const annotationType = annotation.type;

    let details;

    try {
        details = JSON.parse(annotation.details);
    } catch {
        console.error("invalid annotation", annotation);
        return;
    }

    const id = annotation.entity_id;

    if (!id) {
        console.error("invalid id");
        return; // Skip this annotation if it has no ID
    }

    const clampToGround = annotation.clamp_to_ground === "true";
    const color = Color.fromCssColorString(annotation.color);
    const drawingTools = window.Construkted.drawingTools;
    const text = annotation.title;

    if (annotationType === ConstruktedDrawingTypes.Note) {
        const showBillboard = annotation.show_note_pin === "y";
        const showLabel = annotation.show_note_text === "y";
        const showLeader = annotation.show_note_leader === "y";

        if (
            details.position &&
            details.heading !== undefined &&
            details.pitch !== undefined &&
            details.distance !== undefined
        ) {
            drawingTools.noteDrawingTool.loadData(
                {
                    ...details,
                    color: color,
                    text: text,
                    showBillboard: showBillboard,
                    showLabel: showLabel,
                    showLeader: showLeader
                },
                id
            );
        } else {
            // old style

            annotation.show_note_pin = "n";
            annotation.show_note_text = "y";
            annotation.show_note_leader = "n";

            drawingTools.noteDrawingTool.loadData(
                {
                    position: details,
                    color: color,
                    text: text,
                    showBillboard: false,
                    showLabel: true,
                    showLeader: false
                },
                id
            );
        }
    } else if (annotationType === ConstruktedDrawingTypes.Polyline) {
        // details is array of {x: number, y: number, z: number }

        drawingTools.polylineDrawingTool.loadData(
            {
                positions: details,
                color: color,
                width: parseInt(annotation.linewidth, 10),
                clampToGround: clampToGround
            },
            id
        );
    } else if (annotationType === ConstruktedDrawingTypes.Polygon) {
        // details is array of {x: number, y: number, z: number }

        drawingTools.polygonDrawingTool.loadData(
            {
                positions: details,
                color: color,
                width: parseInt(annotation.linewidth, 10),
                clampToGround: clampToGround
            },
            id
        );
    } else if (annotationType === ConstruktedDrawingTypes.ImagePlane) {
        const position = newCartesian3FromObject(details.position);
        const normal = newCartesian3FromObject(details.normal);
        const dimensions = newCartesian2FromObject(details.dimensions);
        const hpr = details.hpr;
        const headingPitchRoll = new HeadingPitchRoll(hpr.heading, hpr.pitch, hpr.roll);
        const keepImageAspect = details.keepImageAspect;

        drawingTools.imagePlaneTool.loadData(
            {
                position: position,
                normal: normal,
                distance: details.distance,
                dimensions: dimensions,
                url: annotation.image_plane_image,
                hpr: headingPitchRoll,
                keepImageAspect: keepImageAspect
            },
            id
        );
    } else if (annotationType === ConstruktedDrawingTypes.Paint) {
        drawingTools.paintTool.loadData(
            {
                positions: details.positions,
                color: color,
                width: parseInt(annotation.linewidth, 10)
            },
            id
        );
    }

    window.Construkted.project.createAnnotationLineItem(annotation);

    window.jQuery(`[id=${id}]`).change(function (this: HTMLInputElement) {
        drawingTools.showHideDrawingById(id, this.checked);
    });
}

function loadMeasurement(annotation: Annotation) {
    if (annotation.details === "") {
        console.warn("invalid element detected", annotation);
        return;
    }

    const construkted = window.Construkted;
    const measurementTools = construkted.measurementTools;
    const measurementResult = JSON.parse(annotation.details);
    const id = annotation.entity_id;
    const annotationType = annotation.type;

    if (annotationType === ConstruktedMeasurementTypes.Point) {
        measurementTools.pointMeasurmentTool.loadData(measurementResult, id);
    } else if (annotationType === ConstruktedMeasurementTypes.Distance) {
        measurementTools.distanceMeasurmentTool.loadData(measurementResult, id);
    } else if (annotationType === ConstruktedMeasurementTypes.Polyline) {
        measurementTools.polylineMeasurmentTool.loadData(measurementResult, id);
    } else if (annotationType === ConstruktedMeasurementTypes.Area) {
        measurementTools.areaMeasurmentTool.loadData(measurementResult, id);
    } else if (annotationType === ConstruktedMeasurementTypes.Volume) {
        measurementTools.volumeMeasurementTool.loadData(measurementResult, id);
    } else {
        console.warn("invalid element detected", annotation);
    }

    window.Construkted.project.createAnnotationLineItem(annotation);

    measurementTools.showHideMeasurementById(annotation.entity_id, true);

    window.jQuery(`[id=${annotation.entity_id}]`).change(function (this: HTMLInputElement) {
        measurementTools.showHideMeasurementById(annotation.entity_id, this.checked);
    });
}

function loadClippingBox(annotation: Annotation) {
    const details = annotation.details;

    if (details === "") {
        console.warn(`unexpected clipping box detected ${annotation}`);
        return;
    }

    const clippingParameters = JSON.parse(details);

    if (clippingParameters.clippingBoxes) {
        if (
            clippingParameters.clippingBoxes[0] &&
            clippingParameters.clippingBoxes[0].storedClippingPlanesModelMatrix
        ) {
            console.warn("invalid clipping parameters", clippingParameters);
            return;
        }
    }

    if (annotation.asset) {
        clippingParameters.targetAssetId = annotation.asset;
    }

    const clippingBox = window.Construkted.clippingTools.clippingBoxTool.loadData(clippingParameters);

    clippingBox.id = annotation.entity_id;

    clippingBox.showEditControls(false);

    window.Construkted.project.createAnnotationLineItem(annotation);

    window.jQuery(`[id=${annotation.entity_id}]`).change(function (this: HTMLInputElement) {
        clippingBox.showWall = this.checked;
    });
}

function checkValidClippingPlaneParameter(annotation: Annotation) {
    const details = annotation.details;

    if (details === "") {
        console.warn(`unexpected clipping plane detected ${annotation}`);
        return false;
    }

    const clippingParameters = JSON.parse(details);

    if (!clippingParameters.position) {
        console.warn(`unexpected clipping plane detected ${annotation}`);
        return false;
    }

    return true;
}

function loadClippingPlane(annotation: Annotation) {
    if (!checkValidClippingPlaneParameter(annotation)) {
        return;
    }

    const clippingParameters = JSON.parse(annotation.details);

    const clippingPlane = window.Construkted.clippingTools.clippingPlaneTool.loadData(clippingParameters);

    clippingPlane.id = annotation.entity_id;

    window.Construkted.project.createAnnotationLineItem(annotation);
}

export default function loadAnnotations(annotations: Annotation[]) {
    /* Let's keep, we can use it later.
    // Create containers for each asset
    if (window.project_assets) {
        window.project_assets.forEach((asset: { post_id: string; post_title: string }) => {
            const assetId = asset.post_id;
            const assetContainer = jQuery(
                `<div id="asset-${assetId}" class="asset-container"><div class="asset-title">${asset.post_title}<em>-</em></div><div class="asset-container-inner"></div></div>`
            );
            jQuery("#annotation-list").append(assetContainer);
        });
    }

    jQuery("#annotation-list").append(
        `<div id="asset-null" class="asset-container"><div class="asset-title">Other assets<em>-</em></div><div class="asset-container-inner"></div></div>`
    ); */

    jQuery(".asset-title em").on("click", function (this: HTMLElement) {
        jQuery(this).parent().next().slideToggle();

        // Change the text to + or -
        if (jQuery(this).text() === "-") {
            jQuery(this).text("+");
        } else {
            jQuery(this).text("-");
        }
    });

    annotations.forEach((annotation: Annotation) => {
        const annotationType = annotation.type as unknown as ConstruktedAnnotationTypes;
        const annotationCategory = window.Construkted.project.getAnnotationCategoryFromAnnotationType(annotationType);

        if (annotationCategory === ConstruktedAnnotationCategories.Drawing) {
            loadDrawing(annotation);
        } else if (annotationCategory === ConstruktedAnnotationCategories.Measurement) {
            loadMeasurement(annotation);
        } else if (annotationType === ConstruktedAnnotationTypes.ClippingBox) {
            loadClippingBox(annotation);
        } else if (annotationType === ConstruktedAnnotationTypes.ClippingPlane) {
            loadClippingPlane(annotation);
        } else {
            throw new Error("error");
        }
    });

    jQuery("#sidebar-new-annotation").hide();
}
