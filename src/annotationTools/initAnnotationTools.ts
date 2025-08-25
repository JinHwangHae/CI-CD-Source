/* qeslint-disable */

import { initClippingTools } from "./initClippingTools";
import { initDrawingTools } from "./initDrawingTools";
import { initImagePlaneTool } from "./initImagePlaneTool";
import { initMeasurementTools } from "./initMeasurementTools";
import { initVolumeMeasurementTool } from "./initVolumeMeasurementTool";

function initAnnotationTools() {
    initMeasurementTools();
    initDrawingTools();
    initVolumeMeasurementTool();
    initClippingTools();
    initImagePlaneTool();
}

export { initAnnotationTools };
