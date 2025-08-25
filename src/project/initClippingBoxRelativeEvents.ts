export function initClippingBoxRelativeEvents() {
    function getClipping() {
        const annotationId = jQuery("#annotation-entity-id").val() as string;

        if (!annotationId) {
            console.error("invalid annotation id");
            return undefined;
        }

        return window.Construkted.clippingTools.getClipping(annotationId);
    }

    jQuery(document).on("change", "#activate-clipping-box-checkbox", function (this: HTMLInputElement) {
        const annotationId = jQuery("#annotation-entity-id").val() as string;

        if (!annotationId) {
            console.error("invalid annotation id");
            return;
        }

        const construkted = window.Construkted;

        const clippingBoxTool = construkted.clippingTools.clippingBoxTool;
        const clippingBox = clippingBoxTool.getClippingBoxById(annotationId);

        if (clippingBox) {
            if (this.checked) {
                clippingBoxTool.activateClippingBox(annotationId);
            } else {
                clippingBox.deactivate();
            }
        }

        const clippingPlaneTool = construkted.clippingTools.clippingPlaneTool;

        const clippingPlane = clippingPlaneTool.getClippingPlaneById(annotationId);

        if (clippingPlane) {
            if (this.checked) {
                clippingPlaneTool.activateClippingPlane(annotationId);
            } else {
                clippingPlane.deactivate();
            }
        }
    });

    jQuery(document).on("change", "#display-clipping-box-wall", function (this: HTMLInputElement) {
        const clipping = getClipping();

        if (clipping) {
            clipping.showWall = this.checked;
        }
    });

    jQuery(document).on("click", "#annotation-reset-clipping-box", () => {
        const clipping = getClipping();

        if (clipping) {
            clipping.reset();
            jQuery("#activate-clipping-box-checkbox").prop("checked", true);
            jQuery("#display-clipping-box-wall").prop("checked", true);
        }
    });

    jQuery(document).on("click", "#annotation-flip-clipping-plane-normal", () => {
        const annotationId = jQuery("#annotation-entity-id").val() as string;

        if (!annotationId) {
            console.error("invalid annotation id");
            return;
        }

        const clippingPlane = window.Construkted.clippingTools.clippingPlaneTool.getClippingPlaneById(annotationId);

        if (clippingPlane) {
            clippingPlane.flipNormal();
        }
    });
}
