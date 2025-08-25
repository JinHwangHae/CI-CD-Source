import * as JQuery from "jquery";
import { Cartesian3, Cartographic, HeadingPitchRoll, Math as CesiumMath } from "cesium";
import { AssetGeoLocation, ConstruktedTransformEditors } from "../types/common";
import { VisualPositionEditor } from "./VisualPositionEditor";
import { saveGeolocation } from "../construkted_ajax";

interface VisualPositionEditorUIConstructorOptions {
    visualPositionEditor: VisualPositionEditor;
}

let jqLabel: any;
let jqLatitudeDiv: any;
let jqLongitudeDiv: any;
let jqAltitudeDiv: any;
let jqTilesetLatitudeInput: any;
let jqTilesetLatitudeLabel: any;
let jqTilesetLongitudeInput: any;
let jqTilesetLongitudeLabel: any;
let jqTilesetAltitude: any;

let jqPlaceAssetOnTerrain: any;
let jqGeoReferenceButton: any;

let jqEnableTerrainImagery: any;

let jqRotationXInput: any;
let jqRotationYInput: any;
let jqRotationZInput: any;
let jqCalculatedScaleInput: JQuery;
let jqResetScaleButton: JQuery;
let jqClearMeasurementPointsButton: JQuery;
let jqMeasuredDistanceInput: any;
let jqKnownDistanceInput: any;
let jqCalcNewScaleButton: any;
let jqReverseUpDirectionCheckbox: any;

let jqUndergroundCheckBox: any;
let jqSaveAndCloseButton: any;
let jqCancelButton: any;
let jqResetButton: any;

class VisualPositionEditorUI {
    private readonly _editor: VisualPositionEditor;
    private _predefinedGeolocation: boolean = false;

    constructor(options: VisualPositionEditorUIConstructorOptions) {
        const editor = options.visualPositionEditor;
        this._editor = editor;
        const transformEditorViewModel: any = editor.transformEditor.viewModel;

        const jQuery = window.jQuery;

        jqLabel = jQuery("#visual-geolocation-editor-label");
        jqLatitudeDiv = jQuery("#latitude-div");
        jqLongitudeDiv = jQuery("#longitude-div");
        jqAltitudeDiv = jQuery("#altitude-div");
        jqTilesetLatitudeInput = jQuery("#tileset_latitude");
        jqTilesetLongitudeInput = jQuery("#tileset_longitude");
        jqTilesetLatitudeLabel = jQuery("#tileset_latitude_label");
        jqTilesetLongitudeLabel = jQuery("#tileset_longitude_label");
        jqTilesetAltitude = jQuery("#tileset_altitude");

        jqPlaceAssetOnTerrain = jQuery("#place-asset-on-terrain-button");
        jqGeoReferenceButton = jQuery("#elevation-reference-button");
        jqEnableTerrainImagery = jQuery("#enable-terrain-imagery-visual");

        const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

        jqEnableTerrainImagery.prop("checked", CONSTRUKTED_AJAX.terrain_imagery_enabled);

        jqRotationXInput = jQuery("#rotation-x");
        jqRotationYInput = jQuery("#rotation-y");
        jqRotationZInput = jQuery("#rotation-z");
        jqCalculatedScaleInput = jQuery("#calculated-scale");
        jqResetScaleButton = jQuery("#reset-scale");
        jqClearMeasurementPointsButton = jQuery("#clear-measurement-points");
        jqMeasuredDistanceInput = jQuery("#measured-distance");
        jqKnownDistanceInput = jQuery("#known-distance");
        jqCalcNewScaleButton = jQuery("#calc-new-scale-button");

        jqUndergroundCheckBox = jQuery("#is-underground-checkbox");

        jqSaveAndCloseButton = jQuery("#save_tileset_model_matrix_button");
        jqCancelButton = jQuery("#visual-geo-location-cancel-button");
        jqResetButton = jQuery("#geo-location-reset-button");

        this._showHideTerrainImageryRelativeControls(CONSTRUKTED_AJAX.terrain_imagery_enabled);

        jqTilesetLongitudeInput.change(() => {
            const longitude = parseFloat(jqTilesetLongitudeInput.val());

            if (Number.isNaN(longitude) || longitude > 180 || longitude < -180) {
                jqTilesetLongitudeInput.val("");
                alert(`invalid longitude: ${longitude}`);
                return;
            }

            const assetViewer = this._editor.assetViewer;
            const asset = assetViewer.masterAsset;

            asset.setOneOfBLH(longitude, undefined, undefined);

            assetViewer.groundPlane.longitude = longitude;
            window.Construkted.flyToAssetByFlag();
        });

        jqTilesetLatitudeInput.change(() => {
            const latitude = parseFloat(jqTilesetLatitudeInput.val());

            if (Number.isNaN(latitude) || latitude > 90 || latitude < -90) {
                jqTilesetLatitudeInput.val("");
                alert(`invalid latitude: ${latitude}`);
                return;
            }

            const assetViewer = this._editor.assetViewer;
            const asset = assetViewer.masterAsset;

            asset.setOneOfBLH(undefined, latitude, undefined);

            assetViewer.groundPlane.latitude = latitude;
            window.Construkted.flyToAssetByFlag();
        });

        jqTilesetAltitude.change(() => {
            let altitude = jqTilesetAltitude.val();
            altitude = parseFloat(altitude);

            if (Number.isNaN(altitude) || altitude > 15000 || altitude < -1000) {
                jqTilesetAltitude.val("");
                alert(`invalid altitude: ${altitude}`);
                return;
            }

            const assetViewer = this._editor.assetViewer;
            const asset = assetViewer.masterAsset;

            asset.setOneOfBLH(undefined, undefined, altitude);

            assetViewer.groundPlane.altitude = altitude;
            window.Construkted.flyToAssetByFlag();
        });

        const checkLongitudeLatitude = () => {
            let longitude = jqTilesetLongitudeInput.val();
            let latitude = jqTilesetLatitudeInput.val();

            longitude = parseFloat(longitude);
            latitude = parseFloat(latitude);

            if (longitude === 0 && latitude === 0) {
                alert("Please input valid Latitude and Longitude!");
                return false;
            }

            if (Number.isNaN(longitude)) {
                alert("Please input valid Longitude!");
                return false;
            }

            if (Number.isNaN(latitude)) {
                alert("Please input valid Latitude!");
                return false;
            }

            return true;
        };

        jqGeoReferenceButton.click(() => {
            const geolocationRefMouseHandler = this._editor.geolocationRefMouseHandler;

            if (!geolocationRefMouseHandler.activated) {
                geolocationRefMouseHandler.activate();
            }
        });

        jqPlaceAssetOnTerrain.click(() => {
            if (!checkLongitudeLatitude()) {
                return;
            }

            let longitude = jqTilesetLongitudeInput.val();
            let latitude = jqTilesetLatitudeInput.val();

            longitude = parseFloat(longitude);
            latitude = parseFloat(latitude);

            const globe = this._editor.assetViewer.cesiumViewer.scene.globe;
            const cartographic = new Cartographic(CesiumMath.toRadians(longitude), CesiumMath.toRadians(latitude));
            const terrainHeight = globe.getHeight(cartographic);

            if (!terrainHeight) {
                alert("failed to get height!");
                return;
            }

            const asset = this._editor.assetViewer.masterAsset;
            asset.placeOnTerrain(longitude, latitude, terrainHeight);
            window.Construkted.flyToAssetByFlag();

            if (asset.hasValidGeoRef()) {
                jqTilesetAltitude.val(`${terrainHeight?.toFixed(3)}`);
            } else {
                jqTilesetAltitude.val(`${asset.height().toFixed(3)}`);
            }
        });

        jqEnableTerrainImagery.change(() => {
            const assetViewer = this._editor.assetViewer;

            const enabled = jqEnableTerrainImagery.is(":checked");

            this._showHideTerrainImageryRelativeControls(enabled);
            assetViewer.showHideSceneBackground(enabled);

            this._editor.showHideTranslationControl(enabled);

            assetViewer.groundPlane.show = !enabled;
        });

        jqSaveAndCloseButton.click(async () => {
            const terrainImageryEnabled = jqEnableTerrainImagery.is(":checked");

            if (terrainImageryEnabled && !checkLongitudeLatitude()) {
                return;
            }

            let activeEditor = ConstruktedTransformEditors.VisualPositionEditor;

            if (this._predefinedGeolocation) {
                activeEditor = ConstruktedTransformEditors.PredefinedGeoreference;
            }

            const asset = this._editor.assetViewer.masterAsset!;

            const saveOptions = {
                activeEditor: activeEditor,
                asset: asset,
                GCPJSONString: undefined,
                isUnderground: jqUndergroundCheckBox.prop("checked") as boolean,
                terrainImageryEnabled: terrainImageryEnabled,
                jqControls: [jqSaveAndCloseButton]
            };

            window.Construkted.project.setGeoreferencingModified(false);

            await saveGeolocation(saveOptions, () => {
                const visualPositionEditor = this._editor;

                visualPositionEditor.deactivate({
                    geolocation: asset.calculateGeolocation(),
                    terrainImageryEnabled:
                        activeEditor === ConstruktedTransformEditors.PredefinedGeoreference
                            ? true
                            : terrainImageryEnabled
                });

                window.Construkted.layersPanel.update();
            });
        });

        jqCancelButton.click(() => {
            this.cancel();
        });

        jqResetButton.click(() => {
            const asset = this._editor.assetViewer.masterAsset;

            if (asset.originallyGeoreferencedAtECEF) {
                asset.georeference(asset.originalGeolocation());
                this._editor.assetViewer.cesiumViewer.camera.flyToBoundingSphere(asset.tileset.boundingSphere);
                this.displayGeolocation(asset.originalGeolocation());
            }

            this._editor.resetRotationAndScale();
        });

        const hpr = transformEditorViewModel.headingPitchRoll;

        const accuracy = 1;

        jqRotationXInput.val(CesiumMath.toDegrees(hpr.heading).toFixed(accuracy));
        jqRotationYInput.val(CesiumMath.toDegrees(hpr.pitch).toFixed(accuracy));
        jqRotationZInput.val(CesiumMath.toDegrees(hpr.roll).toFixed(accuracy));

        transformEditorViewModel.headingPitchRollChanged.addEventListener((headingPitchRoll: HeadingPitchRoll) => {
            jqRotationXInput.val(CesiumMath.toDegrees(headingPitchRoll.heading).toFixed(accuracy));
            jqRotationYInput.val(CesiumMath.toDegrees(headingPitchRoll.pitch).toFixed(accuracy));
            jqRotationZInput.val(CesiumMath.toDegrees(headingPitchRoll.roll).toFixed(accuracy));
        });

        jqCalculatedScaleInput.val(transformEditorViewModel.scale.x.toFixed(5));

        transformEditorViewModel.scaleChanged.addEventListener((scale: Cartesian3) => {
            jqCalculatedScaleInput.val(scale.x.toFixed(5));
        });

        jqClearMeasurementPointsButton.click(() => {
            editor.autoScaleMouseHandler.deactivate();
            editor.autoScaleMouseHandler.activate();
            jqMeasuredDistanceInput.val("");
            jqKnownDistanceInput.val("");
            jQuery("#scale-known-distance-message").removeClass("hidden");
            jqCalcNewScaleButton.removeClass("hidden");
            jqCalcNewScaleButton.attr("disabled", "disabled");
        });

        jqRotationXInput.on("change", this._onRotationXInputChanged.bind(this));
        jqRotationYInput.on("change", this._onRotationYInputChanged.bind(this));
        jqRotationZInput.on("change", this._onRotationZInputChanged.bind(this));

        jQuery("#start-auto-orientation").on("click", () => {
            editor.autoScaleMouseHandler.deactivate();
            editor.autoOrientationMouseHandler.activate();
        });

        jQuery(".transform-modal-back").on("click", (el: any) => {
            editor.autoScaleMouseHandler.deactivate();
            editor.autoOrientationMouseHandler.deactivate();
            const geolocationRefMouseHandler = this._editor.geolocationRefMouseHandler;
            if (geolocationRefMouseHandler.activated) {
                geolocationRefMouseHandler.deactivate();
            }

            const clicked = jQuery(el.target);
            clicked.parent().toggleClass("hidden");
        });

        jQuery(".transform-has-modal-next").on("click", (el: any) => {
            jQuery(el.target).next().toggleClass("hidden");

            const assetViewer = this._editor.assetViewer;
            const asset = assetViewer.masterAsset;

            jqCalculatedScaleInput.val(asset?.scale?.x.toFixed(5)).trigger("change");
            jqMeasuredDistanceInput.val("").trigger("change");
            jqKnownDistanceInput.val("").trigger("change");

            jqCalcNewScaleButton.removeClass("hidden");
        });

        jqCalculatedScaleInput.on("change", this._onCalculatedScaleInputChanged.bind(this));

        jqResetScaleButton.click(() => {
            jqCalculatedScaleInput.val("1.00000");
            jqKnownDistanceInput.val(jqMeasuredDistanceInput.val());
            this._onCalculatedScaleInputChanged();
        });

        jqKnownDistanceInput.on("change input", this._onKnownDistanceInputChanged.bind(this));
        jqCalcNewScaleButton.on("click", this._editor._onDoScaleMeasurement.bind(this._editor));

        jQuery("#start-auto-scale").click(() => {
            editor.autoOrientationMouseHandler.deactivate();
            editor.autoScaleMouseHandler.activate();
        });

        jqReverseUpDirectionCheckbox = jQuery("#reverse-up-direction");

        jqReverseUpDirectionCheckbox.click(this._onReverUpDirectionCheckboxClicked.bind(this));

        jqUndergroundCheckBox.prop("checked", CONSTRUKTED_AJAX.asset_is_underground);

        const assetViewer = this._editor.assetViewer;

        jQuery("#tileset-transparency-slider").on("input change", function (this: HTMLInputElement) {
            assetViewer.changeTransparancy(parseFloat(this.value));
        });

        jqUndergroundCheckBox.change(function (this: HTMLInputElement) {
            assetViewer.enableDisableUnderground(this.checked);
        });
    }

    // eslint-disable-next-line class-methods-use-this
    displayBLH(longitude: number, latitude: number, height: number) {
        const digits = 8;

        jqTilesetLongitudeInput.val(longitude.toFixed(digits));
        jqTilesetLatitudeInput.val(latitude.toFixed(digits));
        jqTilesetAltitude.val(height.toFixed(3));
    }

    // eslint-disable-next-line class-methods-use-this
    displayGeolocation(assetGeoLocation: AssetGeoLocation) {
        const digits = 8;

        jqTilesetLatitudeInput.val(assetGeoLocation.latitude.toFixed(digits));
        jqTilesetLongitudeInput.val(assetGeoLocation.longitude.toFixed(digits));
        jqTilesetLatitudeLabel.text(assetGeoLocation.latitude.toFixed(digits));
        jqTilesetLongitudeLabel.text(assetGeoLocation.longitude.toFixed(digits));
        jqTilesetAltitude.val(assetGeoLocation.height.toFixed(3));

        const accuracy = 1;

        jqRotationXInput.val(assetGeoLocation.heading.toFixed(accuracy));
        jqRotationYInput.val(assetGeoLocation.pitch.toFixed(accuracy));
        jqRotationZInput.val(assetGeoLocation.roll.toFixed(accuracy));
    }

    // eslint-disable-next-line class-methods-use-this
    displayHeight(height: number) {
        jqTilesetAltitude.val(height.toFixed(3));
    }

    // eslint-disable-next-line class-methods-use-this
    setPredefinedGeoLocationMode(val: boolean) {
        this._predefinedGeolocation = val;

        const jQuery = window.jQuery;

        const jqRotationContainer = jQuery("#rotation-container");
        const jqWizardContainer = jQuery("#wizard-container");

        if (val) {
            jqLabel.text("Pre-Defined Geo-Reference Editor");
            jqGeoReferenceButton.text("Elevation Reference");
            jqTilesetLatitudeInput.hide();
            jqTilesetLongitudeInput.hide();
            jqTilesetLatitudeLabel.show();
            jqTilesetLongitudeLabel.show();
            jqRotationContainer.hide();
            jqWizardContainer.hide();
            jqEnableTerrainImagery.closest(".annotation-line-item").hide();
            jQuery("#geo-location-reference-description").text(
                "Select a point on the 3D model which will act as the reference for the model's Elevation."
            );
            jQuery("#geo-location-reference-type").text("Elevation Reference");
        } else {
            jqLabel.text("Visual Geo-Location Editor");
            jqGeoReferenceButton.text("Geo-Location Reference");
            jqTilesetLatitudeInput.show();
            jqTilesetLongitudeInput.show();
            jqTilesetLatitudeLabel.hide();
            jqTilesetLongitudeLabel.hide();
            jqRotationContainer.show();
            jqWizardContainer.show();
            jqEnableTerrainImagery.closest(".annotation-line-item").show();
            jQuery("#geo-location-reference-description").text(
                "Select a point on the 3D model which will act as the reference for the model's Latitute, Longitude, and Elevation."
            );
            jQuery("#geo-location-reference-type").text("Geo-Location Reference");
        }
    }

    // eslint-disable-next-line class-methods-use-this
    get jqCalculatedScaleInput() {
        return jqCalculatedScaleInput;
    }

    // eslint-disable-next-line class-methods-use-this
    get jqKnownDistanceInput() {
        return jqKnownDistanceInput;
    }

    // eslint-disable-next-line class-methods-use-this
    get jqMeasuredDistanceInput() {
        return jqMeasuredDistanceInput;
    }

    // eslint-disable-next-line class-methods-use-this
    get jqScaleWizardApplyButton() {
        return jqCalcNewScaleButton;
    }

    // eslint-disable-next-line class-methods-use-this
    get jqReverseUpDirectionCheckbox() {
        return jqReverseUpDirectionCheckbox;
    }

    _onRotationXInputChanged() {
        const rotationX = parseFloat(jqRotationXInput.val());

        if (Number.isNaN(rotationX)) {
            alert("invalid heading");
            return;
        }

        this._editor.heading = rotationX;
    }

    _onRotationYInputChanged() {
        const rotationY = parseFloat(jqRotationYInput.val());

        if (Number.isNaN(rotationY)) {
            alert("invalid pitch");
            return;
        }

        this._editor.pitch = rotationY;
    }

    _onRotationZInputChanged() {
        const rotationZ = parseFloat(jqRotationZInput.val());

        if (Number.isNaN(rotationZ)) {
            alert("invalid roll");
            return;
        }

        this._editor.roll = rotationZ;
    }

    _onCalculatedScaleInputChanged() {
        const scale = parseFloat(jqCalculatedScaleInput.val() as string);

        const viewModel = this._editor.transformEditor.viewModel;

        if (Number.isNaN(scale)) {
            jqCalculatedScaleInput.val(viewModel.scale.x);

            setTimeout(() => {
                alert("invalid scale");
            }, 100);
            return;
        }

        if (scale < 0.00001) {
            jqCalculatedScaleInput.val(viewModel.scale.x);

            setTimeout(() => {
                alert("too small input");
            }, 100);
            return;
        }

        const measuredDistance = parseFloat(jqMeasuredDistanceInput.val());

        if (!Number.isNaN(measuredDistance)) {
            jqKnownDistanceInput.val((measuredDistance * scale).toFixed(5));
        }

        viewModel.scale = new Cartesian3(scale, scale, scale);
    }

    // eslint-disable-next-line class-methods-use-this
    _onKnownDistanceInputChanged() {
        const distance = parseFloat(jqKnownDistanceInput.val());

        if (distance > 0) {
            jqCalcNewScaleButton.removeAttr("disabled");
            jqCalcNewScaleButton.removeClass("hidden");
            jQuery("#scale-known-distance-message").addClass("hidden");
        } else {
            jqCalcNewScaleButton.attr("disabled", "disabled");
            jqCalcNewScaleButton.addClass("hidden");
            jQuery("#scale-known-distance-message").removeClass("hidden");
        }
    }

    _onReverUpDirectionCheckboxClicked() {
        const viewModel = this._editor.transformEditor.viewModel;

        const headingPitchRoll = viewModel.headingPitchRoll;

        const newHeadingPitchRoll = new HeadingPitchRoll();

        let newPitch = headingPitchRoll.pitch + CesiumMath.PI;

        if (newPitch > CesiumMath.TWO_PI) {
            newPitch -= CesiumMath.TWO_PI;
        }

        newHeadingPitchRoll.heading = headingPitchRoll.heading;
        newHeadingPitchRoll.pitch = newPitch;
        newHeadingPitchRoll.roll = headingPitchRoll.roll;

        viewModel.headingPitchRoll = newHeadingPitchRoll;
    }

    // eslint-disable-next-line class-methods-use-this
    _showHideTerrainImageryRelativeControls(enabled: boolean) {
        if (enabled) {
            jqLongitudeDiv.show();
            jqLatitudeDiv.show();
            jqAltitudeDiv.show();
            jqPlaceAssetOnTerrain.show();
            jqGeoReferenceButton.show();
        } else {
            jqLongitudeDiv.hide();
            jqLatitudeDiv.hide();
            jqAltitudeDiv.hide();
            jqPlaceAssetOnTerrain.hide();
            jqGeoReferenceButton.hide();
        }
    }

    update() {
        const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

        jqEnableTerrainImagery.prop("checked", CONSTRUKTED_AJAX.terrain_imagery_enabled);
        this._showHideTerrainImageryRelativeControls(CONSTRUKTED_AJAX.terrain_imagery_enabled);
    }

    cancel() {
        const construkted = window.Construkted;
        const project = construkted.project;

        if (project.georeferencingModified()) {
            const ignore = project.askIgnoreGeoreferencingModified();

            if (!ignore) {
                return;
            }

            project.setGeoreferencingModified(false);
        }

        let geolocation: AssetGeoLocation | undefined;

        const asset = window.Construkted.assetViewer.masterAsset;
        const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

        if (CONSTRUKTED_AJAX.active_editor === ConstruktedTransformEditors.VisualPositionEditor) {
            if (CONSTRUKTED_AJAX.asset_geo_location) {
                geolocation = CONSTRUKTED_AJAX.asset_geo_location;
            }
        }

        if (CONSTRUKTED_AJAX.active_editor === ConstruktedTransformEditors.PredefinedGeoreference) {
            if (CONSTRUKTED_AJAX.asset_geo_location_by_pre) {
                geolocation = CONSTRUKTED_AJAX.asset_geo_location_by_pre;
            } else {
                geolocation = asset.originalGeolocation();
            }
        }

        let terrainImageryEnabled = true;

        if (CONSTRUKTED_AJAX.active_editor === ConstruktedTransformEditors.VisualPositionEditor) {
            terrainImageryEnabled = window.CONSTRUKTED_AJAX.terrain_imagery_enabled;
        }

        this._editor.deactivate({
            geolocation: geolocation,
            terrainImageryEnabled: terrainImageryEnabled
        });

        this._showHideTerrainImageryRelativeControls(terrainImageryEnabled);

        jqEnableTerrainImagery.prop("checked", window.CONSTRUKTED_AJAX.terrain_imagery_enabled);
    }
}

export { VisualPositionEditorUI };
