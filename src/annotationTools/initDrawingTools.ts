import { DrawingTool, DrawingType, NoteDrawing, PolylineDrawing, PolygonDrawing } from "../tools";
import { ConstruktedAnnotationTypes, deleteFinishCancelButtons, onToolsEnd } from "../project";
import {
    addCancelButton,
    addFinishButton,
    hideAllPopup,
    removeActiveClassFromAllAnnotationToolButtons
} from "./common";
import { PaintDrawing } from "../tools/annotation/drawing/PaintDrawing";

export function initDrawingTools() {
    const construkted = window.Construkted;
    const drawingTools = construkted.drawingTools;
    const project = construkted.project;

    function onDrawingStarted(drawingTool: DrawingTool) {
        construkted.project.setAnnotationModified(true);

        addFinishButton(() => {
            drawingTool.finishDrawing();
        });
        addCancelButton();
    }

    function onDrawingFinished(index: number, drawing: NoteDrawing | PolylineDrawing | PolygonDrawing | PaintDrawing) {
        let type;
        let title;
        const details = drawing.getDetail();

        if (drawing.type === DrawingType.Note) {
            type = ConstruktedAnnotationTypes.DrawingPin;
            title = `Note ${index}`;
        } else if (drawing.type === DrawingType.Polyline) {
            type = ConstruktedAnnotationTypes.DrawingPolyline;
            title = `Polyline ${index}`;
        } else if (drawing.type === DrawingType.Polygon) {
            type = ConstruktedAnnotationTypes.DrawingPolygon;
            title = `Polygon ${index}`;
        } else if (drawing.type === DrawingType.Paint) {
            type = ConstruktedAnnotationTypes.DrawingPaint;
            title = `Paint ${index}`;
        } else {
            throw new Error("should not be reached!");
        }

        construkted.deactivateCurrentMapTool();

        const data = {
            id: drawing.id,
            type: type,
            title: title,
            details: details
        };

        onToolsEnd(data);

        removeActiveClassFromAllAnnotationToolButtons();
        deleteFinishCancelButtons();
    }

    drawingTools.noteDrawingTool.drawingFinished.addEventListener((index: number) => {
        onDrawingFinished(index, drawingTools.noteDrawingTool.drawings[index] as NoteDrawing);
    });

    drawingTools.polylineDrawingTool.drawingFinished.addEventListener((index: number) => {
        onDrawingFinished(index, drawingTools.polylineDrawingTool.drawings[index] as PolylineDrawing);
    });

    drawingTools.polylineDrawingTool.drawingStarted.addEventListener(() => {
        onDrawingStarted(drawingTools.polylineDrawingTool);
    });

    drawingTools.polygonDrawingTool.drawingFinished.addEventListener((index: number) => {
        onDrawingFinished(index, drawingTools.polygonDrawingTool.drawings[index] as PolygonDrawing);
    });

    drawingTools.polygonDrawingTool.drawingStarted.addEventListener(() => {
        onDrawingStarted(drawingTools.polygonDrawingTool);
    });

    drawingTools.paintTool.drawingFinished.addEventListener((index: number) => {
        onDrawingFinished(index, drawingTools.paintTool.drawings[index] as PaintDrawing);
    });

    function onClickedDrawingToolButton(button: HTMLElement, cb: () => void) {
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
        cb();
    }

    jQuery("#drawing-tool-button-add-label").click(function () {
        onClickedDrawingToolButton(this, () => {
            drawingTools.activateNoteDrawingTool();
        });
    });

    jQuery("#drawing-tool-button-add-line").click(function () {
        onClickedDrawingToolButton(this, () => {
            drawingTools.activatePolylineDrawingTool();
        });
    });

    jQuery("#drawing-tool-button-add-polygon").click(function () {
        onClickedDrawingToolButton(this, () => {
            drawingTools.activatePolygonDrawingTool();
        });
    });

    jQuery("#drawing-tool-button-add-paint").click(function () {
        onClickedDrawingToolButton(this, () => {
            drawingTools.activatePaintTool();
        });
    });
}
