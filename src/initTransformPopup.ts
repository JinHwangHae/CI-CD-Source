/* qeslint-disable */
// q@ts-nocheck

import { Event } from "cesium";
import { removeAssetFromGlobe, saveActiveEditor, submitAssetGlobeStatusDisplay } from "./construkted_ajax";

import { GlobeDisplayStatus } from "./global";
import AssetViewer from "./AssetViewer";
import { AssetGeoLocation, ConstruktedTransformEditors } from "./types/common";

let jqLatitudeLabel: any;
let jqLongitudeLabel: any;
let jqElevationLabel: any;

let jqVisualPositionEditorContainer: any;
let jqMultiGCPsEditorContainer: any;

let jqTransformContainer: any;
let jqGlobeStatusDisplayContainer: any;
let jqVisualGeolocationEditorCheckbox: any;
let jqPredefinedGeoreferenceCheckboxContainer: any;
let jqPredefinedGeoreferenceCheckbox: any;
let jqMultiGCPLocationEditorCheckbox: any;
let jqPredefinedGeoreferenceEditButton: any;
let jqVisualGeolocationEditorEditButton: any;
let jqMultiGCPLocationEditorEditButton: any;

let jqSubmitToGlobeButton: any;
let jqRemoveFromGlobeButton: any;
let jqAssetNotGeoreferencedDescription: any;
let jqAssetGeoreferencedDescription: any;
let jqAssetSubmittedDescription: any;
let jqAssetApprovedDescription: any;
let removeVisualPositionEditorDeactivatedRemove: Event.RemoveCallback | undefined;

function _initGlobeDisplayStatusFormGroup() {
    const hideAll = () => {
        jqSubmitToGlobeButton.hide();
        jqRemoveFromGlobeButton.hide();
        jqAssetNotGeoreferencedDescription.hide();
        jqAssetGeoreferencedDescription.hide();
        jqAssetSubmittedDescription.hide();
        jqAssetApprovedDescription.hide();
    };

    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

    jqSubmitToGlobeButton.click(() => {
        submitAssetGlobeStatusDisplay(() => {
            CONSTRUKTED_AJAX.globe_display_status = GlobeDisplayStatus.Submitted;

            hideAll();
            jqAssetSubmittedDescription.show();
            jqRemoveFromGlobeButton.show();
        }, undefined);
    });

    jqRemoveFromGlobeButton.click(() => {
        removeAssetFromGlobe(() => {
            CONSTRUKTED_AJAX.globe_display_status = GlobeDisplayStatus.Unknown;

            hideAll();

            if (CONSTRUKTED_AJAX.asset_geo_location) {
                jqAssetGeoreferencedDescription.show();
                jqSubmitToGlobeButton.show();
            } else {
                jqAssetNotGeoreferencedDescription.show();
            }
        }, undefined);
    });

    hideAll();

    const globeDisplayStatus = CONSTRUKTED_AJAX.globe_display_status;

    if (globeDisplayStatus === GlobeDisplayStatus.Unknown) {
        if (CONSTRUKTED_AJAX.asset_geo_location) {
            jqAssetGeoreferencedDescription.show();
            jqSubmitToGlobeButton.show();
        } else {
            jqAssetNotGeoreferencedDescription.show();
        }
    } else if (globeDisplayStatus === GlobeDisplayStatus.Submitted) {
        jqAssetSubmittedDescription.show();
        jqRemoveFromGlobeButton.show();
    } else if (globeDisplayStatus === GlobeDisplayStatus.Approved) {
        jqAssetApprovedDescription.show();
        jqRemoveFromGlobeButton.show();
    } else {
        throw new Error("should not be reached");
    }
}

const showFirstPage = () => {
    jqTransformContainer.show();
    jqGlobeStatusDisplayContainer.show();

    jqVisualPositionEditorContainer.removeClass("active");
    jqMultiGCPsEditorContainer.removeClass("active");
};

const _updateEditorsCheckbox = () => {
    const activeEditor = window.CONSTRUKTED_AJAX.active_editor;

    if (activeEditor === ConstruktedTransformEditors.PredefinedGeoreference) {
        jqPredefinedGeoreferenceCheckbox.prop("checked", true);
        jqVisualGeolocationEditorCheckbox.prop("checked", false);
        jqMultiGCPLocationEditorCheckbox.prop("checked", false);
    } else if (activeEditor === ConstruktedTransformEditors.VisualPositionEditor) {
        jqPredefinedGeoreferenceCheckbox.prop("checked", false);
        jqVisualGeolocationEditorCheckbox.prop("checked", true);
        jqMultiGCPLocationEditorCheckbox.prop("checked", false);
    } else if (activeEditor === ConstruktedTransformEditors.MultiGCPsEditor) {
        jqPredefinedGeoreferenceCheckbox.prop("checked", false);
        jqVisualGeolocationEditorCheckbox.prop("checked", false);
        jqMultiGCPLocationEditorCheckbox.prop("checked", true);
    }
};

function _updateGeolocationLabels() {
    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

    let assetGeoLocationData: any;

    if (
        CONSTRUKTED_AJAX.asset_geo_location &&
        CONSTRUKTED_AJAX.active_editor === ConstruktedTransformEditors.VisualPositionEditor
    ) {
        assetGeoLocationData = CONSTRUKTED_AJAX.asset_geo_location;
    }

    if (
        CONSTRUKTED_AJAX.asset_geo_location_by_gcps &&
        CONSTRUKTED_AJAX.active_editor === ConstruktedTransformEditors.MultiGCPsEditor
    ) {
        assetGeoLocationData = CONSTRUKTED_AJAX.asset_geo_location_by_gcps;
    }

    if (
        CONSTRUKTED_AJAX.asset_geo_location_by_pre &&
        CONSTRUKTED_AJAX.active_editor === ConstruktedTransformEditors.PredefinedGeoreference
    ) {
        assetGeoLocationData = CONSTRUKTED_AJAX.asset_geo_location_by_pre;
    }

    if (!assetGeoLocationData) {
        const assetViewer = window.Construkted.assetViewer;
        const masterAsset = assetViewer.masterAsset;

        if (masterAsset?.originallyGeoreferencedAtECEF) {
            // master asset may have predefined geo location.
            assetGeoLocationData = masterAsset.originalGeolocation();
        } else {
            assetGeoLocationData = {
                longitude: 0,
                latitude: 0,
                height: 0,
                heading: 0,
                pitch: 0,
                roll: 0,
                scale: {
                    x: 1,
                    y: 1,
                    z: 1
                }
            };
        }
    }

    if (
        Number.isNaN(assetGeoLocationData.longitude) ||
        Number.isNaN(assetGeoLocationData.latitude) ||
        Number.isNaN(assetGeoLocationData.height)
    ) {
        console.warn("invalid asset geo location!");
        console.warn(CONSTRUKTED_AJAX.asset_geo_location);
    } else {
        jqLatitudeLabel.text(assetGeoLocationData.latitude.toFixed(8));
        jqLongitudeLabel.text(assetGeoLocationData.longitude.toFixed(8));
        jqElevationLabel.text(assetGeoLocationData.height.toFixed(3));
    }
}

function setVisibilityGeolocation() {
    const jqGeolocationContainer = window.jQuery("#geolocation-container");

    if (window.CONSTRUKTED_AJAX.active_editor === ConstruktedTransformEditors.VisualPositionEditor) {
        if (window.CONSTRUKTED_AJAX.terrain_imagery_enabled) {
            jqGeolocationContainer.show();
        } else {
            jqGeolocationContainer.hide();
        }
    } else {
        jqGeolocationContainer.show();
    }
}

function updateTransformPopup() {
    _updateGeolocationLabels();
    _updateEditorsCheckbox();

    setVisibilityGeolocation();
}

function initGeoLocationPopup(assetViewer: AssetViewer) {
    const jQuery = window.jQuery;

    jqLatitudeLabel = jQuery("#geolocation-latitude-label");
    jqLongitudeLabel = jQuery("#geolocation-longitude-label");
    jqElevationLabel = jQuery("#geolocation-elevation-label");

    jqTransformContainer = jQuery("#transform-container");
    jqGlobeStatusDisplayContainer = jQuery("#globe-status-display");
    jqVisualPositionEditorContainer = jQuery("#visual");
    jqMultiGCPsEditorContainer = jQuery("#multi-gcps");

    jqPredefinedGeoreferenceCheckboxContainer = jQuery("#predefined-georeference-checkbox-container");
    jqPredefinedGeoreferenceCheckbox = jQuery("#predefined-georeference-checkbox");
    jqVisualGeolocationEditorCheckbox = jQuery("#visual-geolocation-editor-checkbox");
    jqMultiGCPLocationEditorCheckbox = jQuery("#multi-gcp-location-editor-checkbox");
    jqPredefinedGeoreferenceEditButton = jQuery("#predefined-georeference-edit");
    jqVisualGeolocationEditorEditButton = jQuery("#visual-geolocation-editor-edit");
    jqMultiGCPLocationEditorEditButton = jQuery("#multi-gcp-location-editor-edit");

    jqSubmitToGlobeButton = jQuery("#submit-to-globe-button");
    jqRemoveFromGlobeButton = jQuery("#remove-from-globe-button");
    jqAssetNotGeoreferencedDescription = jQuery("#asset-not-georeferenced-description");
    jqAssetGeoreferencedDescription = jQuery("#asset-georeferenced-description");
    jqAssetSubmittedDescription = jQuery("#asset-submitted-description");
    jqAssetApprovedDescription = jQuery("#asset-approved-description");

    if (!window.CONSTRUKTED_AJAX.originally_georeferenced) {
        jqPredefinedGeoreferenceCheckboxContainer.hide();
    }

    updateTransformPopup();

    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

    if (!CONSTRUKTED_AJAX.is_owner) {
        jqVisualGeolocationEditorEditButton.prop("disabled", true);
        jqMultiGCPLocationEditorEditButton.prop("disabled", true);
    }

    const hideFirstPage = () => {
        jqTransformContainer.hide();
        jqGlobeStatusDisplayContainer.hide();
    };

    const onChangeEditorCheckbox = async () => {
        let activeEditor = ConstruktedTransformEditors.VisualPositionEditor;

        if (jqMultiGCPLocationEditorCheckbox.prop("checked")) {
            activeEditor = ConstruktedTransformEditors.MultiGCPsEditor;
        } else if (jqPredefinedGeoreferenceCheckbox.prop("checked")) {
            activeEditor = ConstruktedTransformEditors.PredefinedGeoreference;
        }

        if (CONSTRUKTED_AJAX.active_editor === activeEditor) {
            return;
        }

        const asset = assetViewer.masterAsset;

        await saveActiveEditor(activeEditor, () => {
            CONSTRUKTED_AJAX.active_editor = activeEditor;

            _updateGeolocationLabels();

            let geolocation: AssetGeoLocation | undefined;

            if (
                activeEditor === ConstruktedTransformEditors.PredefinedGeoreference &&
                CONSTRUKTED_AJAX.asset_geo_location_by_pre
            ) {
                geolocation = CONSTRUKTED_AJAX.asset_geo_location_by_pre;
            }

            if (
                activeEditor === ConstruktedTransformEditors.VisualPositionEditor &&
                CONSTRUKTED_AJAX.asset_geo_location
            ) {
                geolocation = CONSTRUKTED_AJAX.asset_geo_location;
            }

            if (
                activeEditor === ConstruktedTransformEditors.MultiGCPsEditor &&
                CONSTRUKTED_AJAX.asset_geo_location_by_gcps
            ) {
                geolocation = CONSTRUKTED_AJAX.asset_geo_location_by_gcps;
            }

            if (geolocation) {
                asset.georeference(geolocation);
            } else {
                asset.removeGeoreference();
            }

            assetViewer.cesiumViewer.camera.flyToBoundingSphere(asset.tileset.boundingSphere);

            if (activeEditor === ConstruktedTransformEditors.VisualPositionEditor) {
                assetViewer.showHideSceneBackground(CONSTRUKTED_AJAX.terrain_imagery_enabled);
            } else {
                assetViewer.showHideSceneBackground(true);
            }

            setVisibilityGeolocation();
        });
    };

    jqPredefinedGeoreferenceCheckbox.change(async () => {
        onChangeEditorCheckbox();
    });

    jqVisualGeolocationEditorCheckbox.change(async () => {
        onChangeEditorCheckbox();
    });

    jqMultiGCPLocationEditorCheckbox.change(async () => {
        onChangeEditorCheckbox();
    });

    jqPredefinedGeoreferenceEditButton.click(() => {
        hideFirstPage();

        jqVisualPositionEditorContainer.addClass("active");
        jqMultiGCPsEditorContainer.removeClass("active");

        const visualPositionEditor = assetViewer.visualPositionEditor;

        if (!visualPositionEditor) {
            return;
        }

        const asset = window.Construkted.assetViewer.masterAsset;
        const visualPositionEditorUI = visualPositionEditor.ui;

        let geolocation;

        if (CONSTRUKTED_AJAX.asset_geo_location_by_pre) {
            geolocation = CONSTRUKTED_AJAX.asset_geo_location_by_pre;
        } else if (asset.originallyGeoreferencedAtECEF) {
            geolocation = asset.originalGeolocation();
        }

        visualPositionEditor.activate({
            activateTransformEditor: false,
            geolocation: geolocation,
            terrainImageryEnabled: true
        });

        visualPositionEditorUI.displayGeolocation(asset.calculateGeolocation());

        if (asset.hasValidGeoRef()) {
            visualPositionEditorUI.displayHeight(asset.heightOfGeoRef());
        }

        visualPositionEditorUI.setPredefinedGeoLocationMode(true);
        visualPositionEditorUI._showHideTerrainImageryRelativeControls(true);

        if (removeVisualPositionEditorDeactivatedRemove) {
            removeVisualPositionEditorDeactivatedRemove();
        }

        removeVisualPositionEditorDeactivatedRemove = visualPositionEditor.deactivated.addEventListener(() => {
            showFirstPage();
            updateTransformPopup();
        });

        window.Construkted.project.setGeoreferencingModified(true);
    });

    jqVisualGeolocationEditorEditButton.click(() => {
        hideFirstPage();

        jqVisualPositionEditorContainer.addClass("active");
        jqMultiGCPsEditorContainer.removeClass("active");

        const visualPositionEditor = assetViewer.visualPositionEditor;

        if (!visualPositionEditor) {
            return;
        }

        const visualPositionEditorUI = visualPositionEditor.ui;
        const asset = assetViewer.masterAsset;

        visualPositionEditor.activate({
            activateTransformEditor: true,
            geolocation: CONSTRUKTED_AJAX.asset_geo_location,
            terrainImageryEnabled: CONSTRUKTED_AJAX.terrain_imagery_enabled
        });

        visualPositionEditorUI.displayGeolocation(asset.calculateGeolocation());

        if (asset.hasValidGeoRef()) {
            visualPositionEditorUI.displayHeight(asset.heightOfGeoRef());
        }

        visualPositionEditorUI.setPredefinedGeoLocationMode(false);

        if (removeVisualPositionEditorDeactivatedRemove) {
            removeVisualPositionEditorDeactivatedRemove();
        }

        removeVisualPositionEditorDeactivatedRemove = visualPositionEditor.deactivated.addEventListener(() => {
            showFirstPage();
            updateTransformPopup();
        });

        window.Construkted.project.setGeoreferencingModified(true);
    });

    jqMultiGCPLocationEditorEditButton.click(() => {
        assetViewer.gcpManager?.activate();
        assetViewer.showHideSceneBackground(true);

        hideFirstPage();
        jqMultiGCPsEditorContainer.addClass("active");
        jqVisualPositionEditorContainer.removeClass("active");
    });

    _initGlobeDisplayStatusFormGroup();
}

export { initGeoLocationPopup, showFirstPage, updateTransformPopup };
