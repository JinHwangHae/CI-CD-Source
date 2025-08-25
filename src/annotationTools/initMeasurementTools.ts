/* qeslint-disable */

import { Measurement, MeasurementTool, MeasurementType } from "../tools";
import { ConstruktedAnnotationTypes, deleteFinishCancelButtons, onToolsEnd } from "../project";

import {
    addCancelButton,
    addFinishButton,
    hideAllPopup,
    removeActiveClassFromAllAnnotationToolButtons
} from "./common";

export function initMeasurementTools() {
    const construkted = window.Construkted;
    const project = construkted.project;

    function onDrawingFinished(index: number, measurement: Measurement) {
        let type;
        let title;
        const details = measurement.getDetail();

        if (measurement.type === MeasurementType.Point) {
            type = ConstruktedAnnotationTypes.MeasurementPoint;
            title = `Point measurement ${index}`;
        } else if (measurement.type === MeasurementType.Distance) {
            type = ConstruktedAnnotationTypes.MeasurementDistance;
            title = `Distance measurement ${index}`;
        } else if (measurement.type === MeasurementType.Polyline) {
            type = ConstruktedAnnotationTypes.MeasurementPolyline;
            title = `Polyline measurement ${index}`;
        } else if (measurement.type === MeasurementType.Area) {
            type = ConstruktedAnnotationTypes.MeasurementArea;
            title = `Area measurement ${index}`;
        } else if (measurement.type === MeasurementType.Volume) {
            type = ConstruktedAnnotationTypes.MeasurementVolume;
            title = `Volume measurement ${index}`;
        } else {
            throw new Error("should not be reached!");
        }

        construkted.deactivateCurrentMapTool();

        const data = {
            id: measurement.id,
            type: type,
            title: title,
            details: details
        };

        onToolsEnd(data);
        removeActiveClassFromAllAnnotationToolButtons();
        deleteFinishCancelButtons();
    }

    const measurementTools = construkted.measurementTools;
    const pointMeasurementTool = measurementTools.pointMeasurmentTool;
    const distanceMeasurementTool = measurementTools.distanceMeasurmentTool;
    const polylineMeasurementTool = measurementTools.polylineMeasurmentTool;
    const areaMeasurementTool = measurementTools.areaMeasurmentTool;
    const volumeMeasurementTool = measurementTools.volumeMeasurementTool;

    pointMeasurementTool.drawingStarted.addEventListener(() => {
        project.setAnnotationModified(true);
    });

    pointMeasurementTool.drawingFinished.addEventListener((measurementIndex: number) => {
        const measurement = pointMeasurementTool.measurements[measurementIndex];

        onDrawingFinished(measurementIndex, measurement);
    });

    distanceMeasurementTool.drawingFinished.addEventListener((measurementIndex: number) => {
        const measurement = distanceMeasurementTool.measurements[measurementIndex];

        onDrawingFinished(measurementIndex, measurement);
    });

    polylineMeasurementTool.drawingFinished.addEventListener((measurementIndex: number) => {
        const measurement = polylineMeasurementTool.measurements[measurementIndex];

        onDrawingFinished(measurementIndex, measurement);
    });

    function onDrawingStarted(measurementTool: MeasurementTool) {
        project.setAnnotationModified(true);

        addFinishButton(() => {
            measurementTool.finishDrawing();
        });
        addCancelButton();
    }

    distanceMeasurementTool.drawingStarted.addEventListener(() => {
        onDrawingStarted(distanceMeasurementTool);
    });

    polylineMeasurementTool.drawingStarted.addEventListener(() => {
        onDrawingStarted(polylineMeasurementTool);
    });

    areaMeasurementTool.drawingStarted.addEventListener(() => {
        onDrawingStarted(areaMeasurementTool);
    });

    areaMeasurementTool.drawingFinished.addEventListener((measurementIndex: number) => {
        const measurement = areaMeasurementTool.measurements[measurementIndex];

        onDrawingFinished(measurementIndex, measurement);
    });

    volumeMeasurementTool.drawingStarted.addEventListener(() => {
        onDrawingStarted(volumeMeasurementTool);
    });

    volumeMeasurementTool.drawingFinished.addEventListener((measurementIndex: number) => {
        const measurement = volumeMeasurementTool.measurements[measurementIndex];

        onDrawingFinished(measurementIndex, measurement);
    });

    function onClickMeasurementToolButton(button: HTMLElement, measurementTool: MeasurementTool) {
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
        button.classList.add("active");
        measurementTools.selectTool(measurementTool);
    }

    jQuery("#measurement-tool-button-component-distance").click(function () {
        onClickMeasurementToolButton(this, distanceMeasurementTool);
    });

    jQuery("#measurement-tool-button-polyline").click(function () {
        onClickMeasurementToolButton(this, polylineMeasurementTool);
    });

    jQuery("#measurement-tool-button-area").click(function () {
        onClickMeasurementToolButton(this, areaMeasurementTool);
    });

    jQuery("#measurement-tool-button-point").click(function () {
        onClickMeasurementToolButton(this, pointMeasurementTool);
    });

    jQuery("#measurement-tool-button-volume").click(function () {
        onClickMeasurementToolButton(this, volumeMeasurementTool);
    });
}
