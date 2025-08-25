import { Viewer } from "cesium";
import { CanvasEventHandlerParent, MapTools } from "../../../core";
import { ClippingBoxTool } from "./ClippingBoxTool";
import { ClippingPlaneTool } from "./ClippingPlaneTool";

export class ClippingTools extends MapTools {
    constructor(options: { parent: CanvasEventHandlerParent; viewer: Viewer }) {
        super(options);

        this.addTool(
            new ClippingBoxTool({
                name: "ClippingBoxTool",
                viewer: options.viewer
            })
        );

        this.addTool(
            new ClippingPlaneTool({
                name: "ClippingPlaneTool",
                viewer: options.viewer
            })
        );
    }

    get clippingBoxTool() {
        return this.tools[0] as ClippingBoxTool;
    }

    get clippingPlaneTool() {
        return this.tools[1] as ClippingPlaneTool;
    }

    removeClipping(id: string) {
        let removed = false;

        removed = this.clippingBoxTool.removeClippingBoxById(id);

        if (removed) {
            return removed;
        }

        return this.clippingPlaneTool.removeClippingPlaneById(id);
    }

    showHideClippingById(id: string, show: boolean) {
        const clippingBox = this.clippingBoxTool.getClippingBoxById(id);

        if (clippingBox) {
            clippingBox.showWall = show;
        }
    }

    getClipping(id: string) {
        const clippingBox = this.clippingBoxTool.getClippingBoxById(id);

        if (clippingBox) {
            return clippingBox;
        }

        return this.clippingPlaneTool.getClippingPlaneById(id);
    }
}
