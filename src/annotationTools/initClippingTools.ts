import { ConstruktedAnnotationTypes, deleteFinishCancelButtons, onToolsEnd } from "../project";
import { ClippingPlaneCreateMode } from "../tools";
import { addCancelButton, hideAllPopup, removeActiveClassFromAllAnnotationToolButtons } from "./common";

export function initClippingTools() {
    const construkted = window.Construkted;
    const project = construkted.project;
    const clippingTools = construkted.clippingTools;
    const clippingBoxTool = clippingTools.clippingBoxTool;
    const clippingPlaneTool = clippingTools.clippingPlaneTool;

    clippingBoxTool.clippingBoxCreated.addEventListener((index: number) => {
        const type = ConstruktedAnnotationTypes.ClippingBox;
        const title = `ClippingBox ${index}`;
        const clippingBox = clippingBoxTool.clippingBoxes[index];

        construkted.deactivateCurrentMapTool();

        const data = {
            id: clippingBox.id,
            type: type,
            title: title,
            details: {}
        };

        onToolsEnd(data);
        removeActiveClassFromAllAnnotationToolButtons();
        deleteFinishCancelButtons();
    });

    clippingPlaneTool.clippingPlaneCreated.addEventListener((index: number) => {
        const type = ConstruktedAnnotationTypes.ClippingPlane;
        const title = `ClippingPlane ${index}`;
        const clippingPlane = clippingPlaneTool.clippingPlanes[index];

        construkted.deactivateCurrentMapTool();

        const data = {
            id: clippingPlane.id,
            type: type,
            title: title,
            details: {}
        };

        onToolsEnd(data);
        removeActiveClassFromAllAnnotationToolButtons();
        deleteFinishCancelButtons();
    });

    function onClickClippingToolButton(button: HTMLElement, cb: () => void) {
        if (button.classList.contains("active")) {
            return;
        }

        if (!project.checkAnnotationModified()) {
            return;
        }

        hideAllPopup();
        project.setAnnotationModified(false);
        deleteFinishCancelButtons();
        removeActiveClassFromAllAnnotationToolButtons();

        // Activate the parent clipping tools button in sidebar
        jQuery("#navbar-right li.nav-item").removeClass("active");
        jQuery("#construkted-annotation-clipping-tools-btn").parent().addClass("active");

        addCancelButton();
        button.classList.add("active");
        cb();
    }

    jQuery("#clipping-box-tool-button").click(function () {
        onClickClippingToolButton(this, () => {
            const activateOptions = { tilesetAssetGroup: construkted.tilesetAssetGroup };

            clippingTools.selectTool(clippingBoxTool, activateOptions);
        });
    });

    jQuery("#construkted-popup-create-clipping-plane-btn").click(function () {
        onClickClippingToolButton(this, () => {
            jQuery("#construkted-popup-create-clipping-plane").show();
        });
    });

    jQuery("#create-clipping-plane-three-points-button").click(() => {
        const activateOptions = {
            tilesetAssetGroup: construkted.tilesetAssetGroup,
            createMode: ClippingPlaneCreateMode.ThreePoint
        };

        clippingTools.selectTool(clippingPlaneTool, activateOptions);
        jQuery("#construkted-popup-create-clipping-plane").hide();
    });

    jQuery("#create-clipping-plane-single-points-button").click(() => {
        const activateOptions = {
            tilesetAssetGroup: construkted.tilesetAssetGroup,
            createMode: ClippingPlaneCreateMode.OnePoint
        };

        clippingTools.selectTool(clippingPlaneTool, activateOptions);
        jQuery("#construkted-popup-create-clipping-plane").hide();
    });
}
