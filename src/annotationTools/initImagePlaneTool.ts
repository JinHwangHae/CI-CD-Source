/* qeslint-disable @typescript-eslint/no-unused-vars */
import { ConstruktedAnnotationTypes, deleteFinishCancelButtons, onToolsEnd } from "../project";
import { ImagePlaneCreateMode } from "../tools";
import { addCancelButton, hideAllPopup, removeActiveClassFromAllAnnotationToolButtons } from "./common";

export function initImagePlaneTool() {
    const construkted = window.Construkted;
    const project = construkted.project;

    const drawingTools = construkted.drawingTools;
    const imagePlaneTool = drawingTools.imagePlaneTool;

    imagePlaneTool.imagePlaneCreated.addEventListener((index: number) => {
        const type = ConstruktedAnnotationTypes.DrawingImagePlane;
        const title = `ImagePlane ${index}`;
        const imagePlane = imagePlaneTool.imagePlanes[index];

        construkted.deactivateCurrentMapTool();

        const data = {
            id: imagePlane.id,
            type: type,
            title: title,
            details: imagePlane.getDetail()
        };

        onToolsEnd(data);
        removeActiveClassFromAllAnnotationToolButtons();
        deleteFinishCancelButtons();
    });

    const imagePlaneCreatePopupId = "construkted-popup-create-image-plane";

    const jqCreateImagePlaneButton = jQuery("#construkted-popup-create-image-plane-btn");

    jqCreateImagePlaneButton.click(function () {
        if (this.classList.contains("active")) {
            return;
        }

        if (!project.checkAnnotationModified()) {
            return;
        }

        construkted.deactivateCurrentMapTool();
        deleteFinishCancelButtons();
        removeActiveClassFromAllAnnotationToolButtons();
        this.classList.add("active");
        jQuery(`#${imagePlaneCreatePopupId}`).show();
    });

    function onClickImagePlaneToolButton(cb: () => void) {
        if (!project.checkAnnotationModified()) {
            return;
        }

        hideAllPopup();
        project.setAnnotationModified(false);
        deleteFinishCancelButtons();
        removeActiveClassFromAllAnnotationToolButtons();
        addCancelButton();
        cb();
    }

    jQuery("#create-image-plane-three-points-button").click(() => {
        onClickImagePlaneToolButton(() => {
            const activateOptions = {
                tilesetAssetGroup: construkted.tilesetAssetGroup,
                createMode: ImagePlaneCreateMode.ThreePoint
            };

            drawingTools.selectTool(imagePlaneTool, activateOptions);
            jQuery(`#${imagePlaneCreatePopupId}`).hide();
        });
    });

    jQuery("#create-image-plane-single-points-button").click(() => {
        onClickImagePlaneToolButton(() => {
            const activateOptions = {
                tilesetAssetGroup: construkted.tilesetAssetGroup,
                createMode: ImagePlaneCreateMode.OnePoint
            };

            drawingTools.selectTool(imagePlaneTool, activateOptions);
            jQuery(`#${imagePlaneCreatePopupId}`).hide();
        });
    });

    jQuery("#construkted-popup-create-image-plane-close").click(() => {
        removeActiveClassFromAllAnnotationToolButtons();
        jQuery(`#${imagePlaneCreatePopupId}`).hide();
    });
}
