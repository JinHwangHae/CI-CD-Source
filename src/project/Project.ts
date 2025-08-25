/* qeslint-disable */
// q@ts-nocheck
import {
    BoundingSphere,
    Cartesian2,
    Cartesian3,
    Cartographic,
    defined,
    DeveloperError,
    Math as CesiumMath,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType
} from "cesium";
import {
    ConstruktedAnnotationCategories,
    ConstruktedAnnotationTypes,
    ConstruktedClippingTypes,
    ConstruktedDrawingTypes,
    ConstruktedMeasurementTypes,
    triggerShowingAnnontationsPopup
} from "./common";
import { Annotation } from "../types";
import loadAnnotations from "./loadAnnotations";
import { showAnnotationDetailAndFly } from "./showAnnotaionDetailAndFly";
import showAnnotationSettings from "./showAnnotationSettings";
import { VolumeMeasurement } from "../tools/annotation/measure/VolumeMeasurement";
import Construkted from "../Construkted1";
import { CreateAnnotaionAjaxResponse } from "./createAnnotation";
import { cancelAnnotation } from "./cancelAnnotaion";
import { init } from ".";
import { AnnotationTreeView, TreeNodeData } from "./annotationTreeView";
import { AutoCompleteCRSTextInput, CRSInfo, getCRSInfoFromEPSGInfoString } from "../core";
import deleteAnnotation from "./deleteAnnotation";

export class Project {
    private readonly _annotations: Annotation[] = [];
    private readonly _sseh: ScreenSpaceEventHandler;
    private readonly _construkted: Construkted;
    private _crsInfo: CRSInfo;
    private _crsInput: AutoCompleteCRSTextInput;
    private _annotationModified: boolean = false;
    private _georeferencingModified: boolean = false;

    constructor() {
        this._parseAnnotations();

        const construkted = window.Construkted;

        this._construkted = construkted;

        if (construkted.isProject()) {
            construkted.projectAssetGroup.readEvt.addEventListener(() => {
                loadAnnotations(this._annotations);
            });

            window.jQuery("#construkted-annontations-popup-info").hide();
        } else {
            loadAnnotations(this._annotations);
        }

        this._sseh = new ScreenSpaceEventHandler(construkted.scene.canvas);
        this._sseh.setInputAction(this._onLeftClick.bind(this), ScreenSpaceEventType.LEFT_CLICK);

        if (window.CONSTRUKTED_AJAX.epsg_info) {
            const crsInfo = getCRSInfoFromEPSGInfoString(window.CONSTRUKTED_AJAX.epsg_info);

            if (crsInfo) {
                this._crsInfo = crsInfo;
            } else {
                console.warn("invalid CRS detected!");
                this._crsInfo = construkted.crsManager.getCRSInfo("4326");
            }
        } else {
            this._crsInfo = construkted.crsManager.getCRSInfo("4326");
        }

        this._crsInput = new AutoCompleteCRSTextInput({
            inputId: "epsg-info-input"
        });

        this._crsInput.crsSelected.addEventListener((crsInfo) => {
            this._crsInfo = crsInfo;
            construkted.measurementTools.pointMeasurmentTool.crsInfo = crsInfo;
        });

        init();

        // Initialize the annotation tree view
        try {
            this.initializeAnnotationTreeView();
        } catch (error) {
            console.error("Initialize annotation tree view error!");
        }
    }

    get annotations() {
        return this._annotations;
    }

    get crsInfo() {
        return this._crsInfo;
    }

    addNewAnnotation(annotation: Annotation) {
        this._annotations.push(annotation);
    }

    updateAnnotation(postId: number, annotation: Annotation) {
        for (let i = 0; i < this.annotations.length; i++) {
            if (this._annotations[i].post_id === postId) {
                this._annotations[i] = annotation;
            }
        }
    }

    _parseAnnotations() {
        if (!window.annotations) {
            return;
        }

        window.annotations.forEach((annotation) => {
            // Skip annotations with empty or invalid entity_id
            if (!annotation.entity_id || !annotation.entity_id.trim()) {
                console.warn("Skipping annotation with empty entity_id:", annotation);
                return;
            }

            if (!defined(annotation.show_note_text)) {
                // old stlye does not contain the definition of show_note_text so make sure that it has default value
                annotation.show_note_text = "y";
            }

            if (!defined(annotation.show_note_leader)) {
                // old stlye does not contain the definition of show_note_text so make sure that it has default value
                annotation.show_note_leader = "y";
            }

            this._annotations.push(annotation);
        });
    }

    removeAnnotation(id: string, annotationCategory: ConstruktedAnnotationCategories) {
        const construkted = this._construkted;

        let removed = false;

        if (annotationCategory === ConstruktedAnnotationCategories.Drawing) {
            removed = construkted.drawingTools.removeDrawingById(id);
        } else if (annotationCategory === ConstruktedAnnotationCategories.Measurement) {
            removed = construkted.measurementTools.removeMeasurementById(id);
        } else if (annotationCategory === ConstruktedAnnotationCategories.Clipping) {
            removed = construkted.clippingTools.removeClipping(id);
        }

        const annotations = this._annotations;
        let annotationRemoved = false;

        for (let i = 0; i < annotations.length; i++) {
            if (annotations[i].entity_id === id) {
                this._annotations.splice(i, 1);
                annotationRemoved = true;
                break;
            }
        }

        if (!annotationRemoved) {
            console.error("Annotation not found in project annotations array");
        }

        return removed;
    }

    fetchAnnotationDetailsToUI(id: string, annotationType: ConstruktedAnnotationTypes) {
        const jQuery = window.jQuery;
        const construkted = this._construkted;
        const annotationCategory = this.getAnnotationCategoryFromAnnotationType(annotationType);

        if (annotationCategory === ConstruktedAnnotationCategories.Drawing) {
            const drawing = construkted.drawingTools.getDrawingById(id);

            if (drawing) {
                const details = drawing.getDetail();
                jQuery("#annotation-details").val(JSON.stringify(details)).trigger("change");
            }
        } else if (annotationCategory === ConstruktedAnnotationCategories.Measurement) {
            const measurement = construkted.measurementTools.getMeasurmentById(id);

            if (measurement) {
                const details = measurement.getDetail();
                jQuery("#annotation-details").val(JSON.stringify(details)).trigger("change");
            }

            if (annotationType === ConstruktedAnnotationTypes.MeasurementVolume) {
                const volumeMeasurement = measurement as VolumeMeasurement;

                jQuery("#annotation-volume-measurement-sampling-slider").val(volumeMeasurement.gridCellSize);
                jQuery("#annotation-volume-measurement-sampling-input").val(volumeMeasurement.gridCellSize);
            }
        } else if (annotationType === ConstruktedAnnotationTypes.ClippingBox) {
            const clippingBox = construkted.clippingTools.clippingBoxTool.getClippingBoxById(id);

            if (clippingBox) {
                const details = clippingBox.getParameters();

                jQuery("#activate-clipping-box-checkbox").prop("checked", clippingBox.activated);
                jQuery("#display-clipping-box-wall").prop("checked", clippingBox.showWall);
                jQuery("#annotation-details").val(JSON.stringify(details)).trigger("change");
            }
        } else if (annotationType === ConstruktedAnnotationTypes.ClippingPlane) {
            const clippingPlane = construkted.clippingTools.clippingPlaneTool.getClippingPlaneById(id);

            if (clippingPlane) {
                const details = clippingPlane.getParameters();

                jQuery("#activate-clipping-box-checkbox").prop("checked", clippingPlane.activated);
                jQuery("#display-clipping-box-wall").prop("checked", clippingPlane.showWall);
                jQuery("#annotation-details").val(JSON.stringify(details)).trigger("change");
            }
        }
    }

    _onLeftClick(movement: { position: Cartesian2 }) {
        const construkted = this._construkted;
        const scene = construkted.scene;

        if (construkted.mapTool) {
            return;
        }

        // https://github.com/CesiumGS/cesium/issues/11410

        setTimeout(() => {
            const pickedObject = scene.pick(movement.position, 1, 1);

            if (!pickedObject) {
                return;
            }

            if (!pickedObject.primitive) {
                return;
            }

            const primitive = pickedObject.primitive;

            const drawing = construkted.drawingTools.getDrawingByPrimitive(primitive);

            if (drawing && this.getAnnotationById(drawing.id)) {
                showAnnotationDetailAndFly(drawing.id);
                triggerShowingAnnontationsPopup();
                return;
            }

            const measurement = construkted.measurementTools.getMeasurmentByPrimitive(primitive);

            if (measurement && this.getAnnotation(measurement.id)) {
                showAnnotationDetailAndFly(measurement.id);
                triggerShowingAnnontationsPopup();
            }
        }, 100);
    }

    // ex 981c76ef-fac0-4843-806a-2f81228a21c6
    getAnnotation(id: string) {
        for (let i = 0; i < this.annotations.length; i++) {
            if (this._annotations[i].entity_id === id) {
                return this._annotations[i];
            }
        }

        return undefined;
    }

    toggleAnnotationFields(construktedAnnotationType: ConstruktedAnnotationTypes) {
        console.assert(construktedAnnotationType, "invalid construktedAnnotationType");

        const jQuery = window.jQuery;

        // hide all
        jQuery(".add-annotation .ck-option-line").addClass("hidden");

        const fields = this._getAnnotationFields(construktedAnnotationType);

        fields.forEach((field: string) => {
            if (jQuery(`#annotation-${field}`).parents(".ck-option-line").length) {
                // show only this
                jQuery(`#annotation-${field}`).parents(".ck-option-line").removeClass("hidden");
            }
        });

        if (this._construkted.isTilesetAsset()) {
            jQuery("#annotation-asset").parents(".ck-option-line").addClass("hidden");
        }
    }

    // eslint-disable-next-line class-methods-use-this
    _getAnnotationFields(annotationType: ConstruktedAnnotationTypes) {
        if (annotationType === ConstruktedAnnotationTypes.DrawingPin) {
            return [
                "title",
                "asset",
                "color",
                "description",
                "attachments",
                "image",
                "show-note-pin",
                "show-note-text",
                "show-note-leader",
                "view-location"
            ];
        }

        if (annotationType === ConstruktedAnnotationTypes.DrawingPolyline) {
            return [
                "title",
                "asset",
                "color",
                "line-width",
                "drape-over-geometry",
                "description",
                "attachments",
                "image",
                "view-location"
            ];
        }

        if (annotationType === ConstruktedAnnotationTypes.DrawingPolygon) {
            return [
                "title",
                "asset",
                "color",
                "drape-over-geometry",
                "description",
                "attachments",
                "image",
                "view-location"
            ];
        }

        if (annotationType === ConstruktedAnnotationTypes.DrawingImagePlane) {
            return [
                "title",
                "description",
                "attachments",
                "image-plane-image",
                "image-plane-position-container",
                "image-plane-rotation-container",
                "image-plane-scale-container",
                "lock-scale-to-image-aspect-checkbox-container"
            ];
        }

        if (annotationType === ConstruktedAnnotationTypes.DrawingPaint) {
            return ["title", "asset", "color", "line-width", "description", "attachments", "image", "view-location"];
        }

        if (
            annotationType === ConstruktedAnnotationTypes.MeasurementPoint ||
            annotationType === ConstruktedAnnotationTypes.MeasurementDistance ||
            annotationType === ConstruktedAnnotationTypes.MeasurementPolyline ||
            annotationType === ConstruktedAnnotationTypes.MeasurementArea
        ) {
            return ["title", "asset", "measurement"];
        }

        if (annotationType === ConstruktedAnnotationTypes.MeasurementVolume) {
            return [
                "title",
                "asset",
                "volume-measurement-sampling-slider",
                "calculate-volume",
                "cancel-volume-calculation",
                "estimated-calculate-volume-time",
                "measurement"
            ];
        }

        if (annotationType === ConstruktedAnnotationTypes.ClippingBox) {
            return [
                "asset",
                "activate-clipping-box-container",
                "display-clipping-box-wall-container",
                "reset-clipping-box"
            ];
        }

        if (annotationType === ConstruktedAnnotationTypes.ClippingPlane) {
            return [
                "asset",
                "activate-clipping-box-container",
                "display-clipping-box-wall-container",
                "flip-clipping-plane-normal"
            ];
        }

        throw new Error("should not be reached");
    }

    canCreateAnnotation() {
        const construkted = this._construkted;

        if (construkted.isProject()) {
            const currentUser = window.currentUser;

            if (
                currentUser &&
                currentUser.logged === "true" &&
                currentUser.post_type === "project" &&
                currentUser.is_author === "true"
            ) {
                return true;
            }
        }

        if (construkted.isTilesetAsset()) {
            return true;
        }

        return false;
    }

    canEditAnnotation() {
        const construkted = this._construkted;

        if (this._construkted.isProject()) {
            if (window.currentUser && window.currentUser.has_access === "true") {
                return true;
            }
        }

        if (construkted.isTilesetAsset()) {
            return true;
        }

        return false;
    }

    // eslint-disable-next-line class-methods-use-this
    getAnnotationCategoryFromAnnotationType(annotationType: ConstruktedAnnotationTypes) {
        if (annotationType === undefined) {
            throw new Error("annotationType required");
        }

        if (
            annotationType === ConstruktedAnnotationTypes.DrawingPin ||
            annotationType === ConstruktedAnnotationTypes.DrawingPolyline ||
            annotationType === ConstruktedAnnotationTypes.DrawingPolygon ||
            annotationType === ConstruktedAnnotationTypes.DrawingImagePlane ||
            annotationType === ConstruktedAnnotationTypes.DrawingPaint
        )
            return ConstruktedAnnotationCategories.Drawing;

        if (
            annotationType === ConstruktedAnnotationTypes.MeasurementPoint ||
            annotationType === ConstruktedAnnotationTypes.MeasurementDistance ||
            annotationType === ConstruktedAnnotationTypes.MeasurementPolyline ||
            annotationType === ConstruktedAnnotationTypes.MeasurementArea ||
            annotationType === ConstruktedAnnotationTypes.MeasurementVolume
        ) {
            return ConstruktedAnnotationCategories.Measurement;
        }

        return ConstruktedAnnotationCategories.Clipping;
    }

    getAnnotationByPostId(postId: number) {
        const annotations = this._annotations.filter((annotation: Annotation) => annotation.post_id === postId);

        if (annotations.length > 0) {
            // Verify and prepare the data before sending
            const annotaiton = annotations[0];

            return annotaiton;
        }

        return undefined;
    }

    getAnnotationById(id: string) {
        if (!id) {
            // getAnnotationById called with empty or undefined id
            console.error("getAnnotationById called with empty or undefined id");
            return undefined;
        }
        const annotations = this._annotations.filter((annotaion: Annotation) => annotaion.entity_id === id);
        if (annotations.length > 0) {
            // Verify and prepare the data before sending
            const annotation = annotations[0];

            annotation.category = this.getAnnotationCategoryFromAnnotationType(
                annotation.type as unknown as ConstruktedAnnotationTypes
            );
            annotation.view =
                annotation.view && typeof annotation.view === "string" ? JSON.parse(annotation.view) : annotation.view;
            annotation.description = annotation.description ? annotation.description : "";

            return annotation;
        }
        // Annotation with id not found in project annotations array
        return undefined;
    }

    showHideAnnotation(id: string, annotationCategory: ConstruktedAnnotationCategories, show: boolean) {
        const construkted = this._construkted;

        if (annotationCategory === ConstruktedAnnotationCategories.Drawing) {
            construkted.drawingTools.showHideDrawingById(id, show);
        } else if (annotationCategory === ConstruktedAnnotationCategories.Measurement) {
            construkted.measurementTools.showHideMeasurementById(id, show);
        } else if (annotationCategory === ConstruktedAnnotationCategories.Clipping) {
            construkted.clippingTools.showHideClippingById(id, show);
        }
    }

    flyToAnnotation(annotation: Annotation) {
        const detail = JSON.parse(annotation.details);

        const viewer = this._construkted.cesiumViewer;
        const scene = viewer!.scene;
        const camera = viewer!.camera;

        let tileset;

        if (this._construkted.isProject()) {
            tileset = this._construkted.projectViewer.projectAssetGroup?.firstTileset!;
        } else {
            tileset = this._construkted.assetViewer.tileset();
        }

        const type = annotation.type;

        if (type === ConstruktedMeasurementTypes.Point || type === ConstruktedDrawingTypes.Note) {
            let position;

            if (detail.position) {
                position = new Cartesian3(detail.position.x, detail.position.y, detail.position.z);
            } else {
                // old style
                position = new Cartesian3(detail.x, detail.y, detail.z);
            }

            const cartographic = Cartographic.fromCartesian(position);

            cartographic.height += tileset.boundingSphere.radius;

            camera.flyTo({
                destination: scene.globe.ellipsoid.cartographicToCartesian(cartographic)
            });
        } else if (type === ConstruktedMeasurementTypes.Distance) {
            const startPointPosition = detail.startPointPosition;
            const endPointPosition = detail.endPointPosition;

            const start = new Cartesian3(startPointPosition.x, startPointPosition.y, startPointPosition.z);
            const end = new Cartesian3(endPointPosition.x, endPointPosition.y, endPointPosition.z);

            const boundingSphere = BoundingSphere.fromPoints([start, end]);

            camera.flyToBoundingSphere(boundingSphere);
        } else if (
            type === ConstruktedMeasurementTypes.Polyline ||
            type === ConstruktedMeasurementTypes.Area ||
            type === ConstruktedDrawingTypes.Polyline
        ) {
            const positions: Cartesian3[] = [];

            detail.forEach((positionData: any) => {
                const position = new Cartesian3(positionData.x, positionData.y, positionData.z);

                positions.push(position);
            });

            const boundingSphere = BoundingSphere.fromPoints(positions);

            camera.flyToBoundingSphere(boundingSphere);
        } else if (type === ConstruktedDrawingTypes.Polygon) {
            const drawing = this._construkted.drawingTools.getDrawingById(annotation.entity_id);

            if (!drawing) {
                throw new Error("error");
            }

            camera.flyToBoundingSphere(drawing.boundingSphere);
        } else if (type === ConstruktedMeasurementTypes.Volume) {
            const polygonPositions = Cartesian3.unpackArray(detail.polygonPositions);

            const boundingSphere = BoundingSphere.fromPoints(polygonPositions);

            camera.flyToBoundingSphere(boundingSphere);
        } else if (type === ConstruktedClippingTypes.ClippingBox) {
            const boundingSphere = new BoundingSphere(detail.center, detail.height);

            camera.flyToBoundingSphere(boundingSphere);
        } else if (type === ConstruktedClippingTypes.ClippingPlane) {
            const dimensions = detail.dimensions;
            const radis = Math.sqrt(dimensions.x * dimensions.x + dimensions.y * dimensions.y) / 2;
            const boundingSphere = new BoundingSphere(detail.position, radis);

            camera.flyToBoundingSphere(boundingSphere);
        } else if (type === ConstruktedDrawingTypes.ImagePlane) {
            const dimensions = detail.dimensions;
            const radis = Math.sqrt(dimensions.x * dimensions.x + dimensions.y * dimensions.y) / 2;
            const boundingSphere = new BoundingSphere(detail.position, radis);

            camera.flyToBoundingSphere(boundingSphere);
        } else if (type === ConstruktedDrawingTypes.Paint) {
            const positions: Cartesian3[] = [];

            detail.positions.forEach((positionData: any) => {
                const position = new Cartesian3(positionData.x, positionData.y, positionData.z);

                positions.push(position);
            });

            const boundingSphere = BoundingSphere.fromPoints(positions);
            camera.flyToBoundingSphere(boundingSphere);
        } else {
            throw new Error("should not be reached");
        }
    }

    goToSavedAnnotationView(annotation: Annotation) {
        const annotationView = annotation.view;

        if (!annotationView) {
            throw new DeveloperError("annotation view is required!");
        }

        if (typeof annotationView === "boolean") {
            throw new DeveloperError("annotation view is required!");
        }

        const offset = new Cartesian3(annotationView.offsetX, annotationView.offsetY, annotationView.offsetZ);

        const destination = Cartesian3.add(
            this._construkted.projectViewer.projectAssetGroup?.boundingSphere!.center!,
            offset,
            new Cartesian3()
        );

        this._construkted.cesiumViewer.camera.flyTo({
            destination: destination,
            orientation: {
                heading: CesiumMath.toRadians(annotationView.heading),
                pitch: CesiumMath.toRadians(annotationView.pitch),
                roll: CesiumMath.toRadians(annotationView.roll)
            }
        });
    }

    static getIconFromAnnotationType(annotationType: ConstruktedAnnotationTypes) {
        if (annotationType === ConstruktedAnnotationTypes.DrawingPin) {
            return "gwicon-note";
        }

        if (annotationType === ConstruktedAnnotationTypes.DrawingPolyline) {
            return "gwicon-polyline";
        }
        if (annotationType === ConstruktedAnnotationTypes.DrawingPolygon) {
            return "gwicon-polygon";
        }
        if (annotationType === ConstruktedAnnotationTypes.DrawingImagePlane) {
            return "gwicon-imagePlane";
        }
        if (annotationType === ConstruktedAnnotationTypes.DrawingPaint) {
            return "gwicon-paint";
        }
        if (annotationType === ConstruktedAnnotationTypes.MeasurementPoint) {
            return "gwicon-pin";
        }
        if (annotationType === ConstruktedAnnotationTypes.MeasurementDistance) {
            return "gwicon-distance";
        }
        if (annotationType === ConstruktedAnnotationTypes.MeasurementPolyline) {
            return "gwicon-line";
        }
        if (annotationType === ConstruktedAnnotationTypes.MeasurementArea) {
            return "gwicon-area";
        }
        if (annotationType === ConstruktedAnnotationTypes.MeasurementVolume) {
            return "gwicon-vol";
        }
        if (annotationType === ConstruktedAnnotationTypes.ClippingBox) {
            return "gwicon-clipping_box";
        }
        if (annotationType === ConstruktedAnnotationTypes.ClippingPlane) {
            return "gwicon-clipping";
        }

        throw new Error("unexpected annotationType");
    }

    _getAnnotationDetailString(annotaion: Annotation) {
        const id = annotaion.entity_id;
        const construkted = this._construkted;
        const annotationType = annotaion.type as unknown as ConstruktedAnnotationTypes;
        const annotationCategory = this.getAnnotationCategoryFromAnnotationType(annotationType);

        let details: any;

        if (annotationCategory === ConstruktedAnnotationCategories.Drawing) {
            const drawing = construkted.drawingTools.getDrawingById(id);

            if (drawing) {
                details = drawing.getDetail();
            }
        } else if (annotationCategory === ConstruktedAnnotationCategories.Measurement) {
            const measurement = construkted.measurementTools.getMeasurmentById(id);

            if (measurement) {
                details = measurement.getDetail();
            }
        } else if (annotationType === ConstruktedAnnotationTypes.ClippingBox) {
            const clippingBox = construkted.clippingTools.clippingBoxTool.getClippingBoxById(id);

            if (clippingBox) {
                details = clippingBox.getParameters();
            }
        } else if (annotationType === ConstruktedAnnotationTypes.ClippingPlane) {
            const clippingPlane = construkted.clippingTools.clippingPlaneTool.getClippingPlaneById(id);

            if (clippingPlane) {
                details = clippingPlane.getParameters();
            }
        }

        if (details) {
            return JSON.stringify(details);
        }

        return "";
    }

    _getAnnotationFormData(annotaion: Annotation) {
        const formData = new FormData();

        const image = (<HTMLInputElement>jQuery("#annotation-image")[0]).files![0];

        formData.append("image", image);
        formData.append("action", "add_annotation");

        const nonce = jQuery('[name="ck_create_annotation_nonce"]').val() as string;

        formData.append("nonce", nonce);
        formData.append("title", annotaion.title);
        formData.append("asset", annotaion.asset);
        formData.append("type", annotaion.type);
        formData.append("color", annotaion.color);
        formData.append("line_width", annotaion.linewidth);
        formData.append("clamp_to_ground", annotaion.clamp_to_ground);
        formData.append("project_id", window.CONSTRUKTED_AJAX.post_id);

        const detail = this._getAnnotationDetailString(annotaion);

        formData.append("details", detail);
        formData.append("entity", annotaion.entity_id);
        formData.append("annotation_id", annotaion.post_id.toString());
        formData.append("show_note_pin", annotaion.show_note_pin);
        formData.append("show_note_text", annotaion.show_note_text);
        formData.append("show_note_leader", annotaion.show_note_leader);
        formData.append("description", annotaion.description);

        let view = "";

        if (annotaion.view !== false) {
            view = JSON.stringify(annotaion.view);
        }

        formData.append("view", view);
        formData.append("capture", annotaion.capture);

        const fileList = window.filesToUpload;

        if (fileList && fileList.length > 0) {
            jQuery.each(fileList, (j: any, file: any) => {
                formData.append(`attachments[${j}]`, file.file);
            });
        }

        return formData;
    }

    updateAnnotationEx(id: string) {
        const annotaion = this.getAnnotation(id);

        if (!annotaion) {
            return;
        }

        jQuery(".ck-processing-loader").addClass("shown");

        const formData = this._getAnnotationFormData(annotaion);

        const self = this;

        jQuery.ajax({
            url: window.gowatch.ajaxurl,
            type: "post",
            data: formData,
            contentType: false,
            processData: false,
            success: function (res: CreateAnnotaionAjaxResponse) {
                if (res.status === 200) {
                    self.updateAnnotation(parseInt(res.data.id, 10), res.data.changed);
                    jQuery(".ck-processing-loader").addClass("hidden");
                } else {
                    jQuery(".ck-processing-loader").addClass("hidden");
                    alert("There was an error");
                }
            }
        });
    }

    georeferencingModified() {
        return this._georeferencingModified;
    }

    askIgnoreGeoreferencingModified() {
        console.assert(this._georeferencingModified, "error");

        // Are you sure you want to close? You will lose all changes
        return window.confirm("Are you sure you want to close? You will lose all changes");
    }

    setGeoreferencingModified(val: boolean) {
        this._georeferencingModified = val;
    }

    annotationModified() {
        return this._annotationModified;
    }

    setAnnotationModified(val: boolean) {
        /**
         * when does this become true
         *
         * when user is about to create a annotation
         * when user start editing of a annotation
         *
         */
        this._annotationModified = val;
    }

    tryCancelAnnotation() {
        console.assert(this._annotationModified, "error");

        const igore = this.askIgnoreAnnotationModified();

        if (igore) {
            cancelAnnotation();
            jQuery("#sidebar-new-annotation").removeClass("is-shown").hide();

            return true;
        }

        return false;
    }

    askIgnoreAnnotationModified() {
        console.assert(this._annotationModified, "error");

        // Are you sure you want to close? You will lose all changes
        return window.confirm("Are you sure? You will lose the current annotation!");
    }

    checkAnnotationModified() {
        if (this.annotationModified()) {
            const ignore = this.askIgnoreAnnotationModified();

            if (!ignore) {
                return false;
            }
        }

        return true;
    }

    createAnnotationLineItem(annotation: Annotation) {
        if (!annotation || !annotation.entity_id) {
            console.error("createAnnotationLineItem called with invalid annotation");
            return;
        }
        this.setupAnnotationTreeNode(annotation);
    }

    private initializeAnnotationTreeView() {
        const treeContainer = document.querySelector("#annotation-tree-container");
        if (!treeContainer) {
            console.warn("Annotation tree container not found. Tree view will be created when container is available.");
            return;
        }

        let treeView = (treeContainer as any)._treeView as AnnotationTreeView;

        if (!treeView) {
            try {
                treeView = new AnnotationTreeView("#annotation-tree-container");
                this.setupTreeViewEventHandlers(treeView);
                (treeContainer as any)._treeView = treeView;
            } catch (error) {
                console.error("Failed to create AnnotationTreeView:", error);
                return;
            }
        }

        if (!treeView) {
            // Failed to initialize tree view
            return;
        }

        if (treeView.validateTreeState) {
            treeView.validateTreeState();
        }
    }

    private setupAnnotationTreeNode(annotation: Annotation) {
        const treeContainer = document.querySelector("#annotation-tree-container");
        if (!treeContainer) {
            console.warn("Annotation tree container not found. Tree view will be created when container is available.");
            return;
        }

        const treeView = (treeContainer as any)._treeView as AnnotationTreeView;
        if (!treeView) {
            this.initializeAnnotationTreeView();
            if (!treeView) {
                console.error("Failed to initialize tree view");
                return;
            }
            return;
        }

        // Create node data for the tree structure
        const nodeData: TreeNodeData = {
            id: annotation.entity_id,
            title: annotation.title,
            icon: Project.getIconFromAnnotationType(annotation.type as unknown as ConstruktedAnnotationTypes),
            isVisible: true,
            children: [],
            data: {
                postId: annotation.post_id,
                entityType: annotation.type,
                asset: annotation.asset,
                type: this.getAnnotationCategoryFromAnnotationType(
                    annotation.type as unknown as ConstruktedAnnotationTypes
                )
            }
        };

        // Create and add node to the tree
        const node = treeView.createNode(nodeData);
        const defaultLayer = treeContainer.querySelector('[data-id="default-layer"]');
        if (defaultLayer) {
            const childrenContainer = defaultLayer.querySelector(".node-children");
            if (childrenContainer) {
                childrenContainer.appendChild(node);
                // Successfully added annotation to tree view
            } else {
                // Default layer children container not found
                console.error("Default layer children container not found");
            }
        } else {
            // Default layer not found in tree view
            console.error("Default layer not found in tree view");
        }
    }

    private setupTreeViewEventHandlers(treeView: AnnotationTreeView) {
        // Set up event handlers for menu actions
        treeView.setEventHandler("onMenuAction", (actionNodeId: string, menuAction: string) => {
            if (!actionNodeId) {
                // onMenuAction called with empty node
                console.error("onMenuAction called with empty node");
                return;
            }
            const targetAnnotation = this.getAnnotationById(actionNodeId);
            if (!targetAnnotation) {
                // Annotation not found for node ID
                console.error("Annotation not found for node ID");
                return;
            }
            // Processing menu action for annotation
            switch (menuAction) {
                case "edit": {
                    showAnnotationSettings(targetAnnotation);
                    this.setAnnotationModified(true);
                    break;
                }
                case "view": {
                    showAnnotationDetailAndFly(actionNodeId);
                    triggerShowingAnnontationsPopup();
                    break;
                }
                case "delete": {
                    if (actionNodeId && actionNodeId.trim()) {
                        const $clickedItem = window.jQuery(`[data-id="${actionNodeId}"]`);
                        if ($clickedItem.length) {
                            deleteAnnotation($clickedItem);
                        } else {
                            console.error(`Element with data-id="${actionNodeId}" not found`);
                        }
                    } else {
                        console.error("Cannot delete annotation: invalid actionNodeId");
                    }
                    break;
                }
                default: {
                    console.warn(`Unhandled menu action: ${menuAction}`);
                    break;
                }
            }
        });

        // Set up visibility change handler
        treeView.setEventHandler("onVisibilityChange", (nodeId: string, isVisible: boolean, nodeType: string) => {
            if (!nodeId) {
                // onVisibilityChange called with empty node ID
                console.error("onVisibilityChange called with empty node ID");
                return;
            }

            if (nodeType === "layer") {
                // For layers, visibility is handled by updateChildrenVisibility
                return;
            }

            const annotation = this.getAnnotationById(nodeId);
            if (!annotation) {
                // Annotation not found for visibility change
                console.error("Annotation not found for visibility change");
                return;
            }

            // Updating visibility for annotation
            const annotationCategory = this.getAnnotationCategoryFromAnnotationType(
                annotation.type as unknown as ConstruktedAnnotationTypes
            );

            // Update visibility in the viewer
            this.showHideAnnotation(nodeId, annotationCategory, isVisible);

            // Update checkbox in the original list if it exists
            if (nodeId && nodeId.trim()) {
                const checkbox = jQuery(`#form-check-${nodeId} input[type="checkbox"]`);
                if (checkbox.length) {
                    checkbox.prop("checked", isVisible);
                }
            }
        });

        // Validate tree view state after setup
        // Tree view event handlers set up successfully
        if (treeView.validateTreeState) {
            treeView.validateTreeState();
        }
    }
}
