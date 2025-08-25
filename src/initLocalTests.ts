import annotations from "./testAnnotations";
import { ClippingPlaneCreateMode } from "./tools";

export function initLocalTests() {
    window.currentUser = {
        ID: "3",
        has_access: "true",
        is_author: "true",
        logged: "true",
        name: "wugis1219",
        post_type: "project"
    };

    jQuery("#activate-clipping-plane").click(() => {
        const construkted = window.Construkted;

        construkted.deactivateCurrentMapTool();
        const clippingTools = construkted.clippingTools;

        construkted.setMapTool(clippingTools.clippingPlaneTool, {
            tilesetAssetGroup: construkted.tilesetAssetGroup,
            createMode: ClippingPlaneCreateMode.ThreePoint
        });
    });

    window.annotations = annotations;
}
