/* qeslint-disable */
// qts-nocheck

import { Cesium3DTileset } from "cesium";
import { showHideTilesInspector } from "./construkted";

export default function initSettingsPopup() {
    const jQuery = window.jQuery;

    const viewer = window.Construkted.cesiumViewer;

    const scene = viewer!.scene;

    const jqMaximumScreenSpaceErrorSlider = jQuery("#maximum-screen-space-error-slider");
    const jqMaximumScreenSpaceErrorInput = jQuery("#maximum-screen-space-error-input");
    const jqFPVMovementSpeedSlider = jQuery("#fpv-movement-speed-slider");
    const jqFPVMovementSpeedInput = jQuery("#fpv-movement-speed-input");

    const cookieExpires = 31;
    const cookiePath = window.location.href;
    const cookieNameOfMaximumScreenSpaceErrorInput = "ck-rendering-performance";
    const cookieNameOfFPVMovement = "ck-fly-fpv-movement";
    const cookieNameOfAutoZoom = "ck-auto-zoom";

    const cookieValOfMaximumScreenSpaceError = jQuery.cookie(cookieNameOfMaximumScreenSpaceErrorInput);

    const setMaximumScreenSpaceError = (val: string) => {
        const maximumScreenSpaceError = parseFloat(val);

        for (let i = 0; i < scene.primitives.length; ++i) {
            const primitive = scene.primitives.get(i);

            if (primitive instanceof Cesium3DTileset) {
                primitive.maximumScreenSpaceError = 32 - maximumScreenSpaceError;
            }
        }
    };

    const setFPVMovementSpeed = (val: string) => {
        const cesiumFPVCameraController = window.Construkted.fpvController;
        const cesiumFLYCameraController = window.Construkted.flyController;

        const speed = parseFloat(val);

        cesiumFPVCameraController.setWorkingSpeed(speed);
        cesiumFLYCameraController.setMoveRateFactor(speed);
    };

    if (cookieValOfMaximumScreenSpaceError) {
        jqMaximumScreenSpaceErrorSlider.val(cookieValOfMaximumScreenSpaceError);
        jqMaximumScreenSpaceErrorInput.val(cookieValOfMaximumScreenSpaceError);

        setMaximumScreenSpaceError(cookieValOfMaximumScreenSpaceError);
    }

    const cookieValOfFPVSpeed = jQuery.cookie(cookieNameOfFPVMovement);

    if (cookieValOfFPVSpeed) {
        jqFPVMovementSpeedSlider.val(cookieValOfFPVSpeed);
        jqFPVMovementSpeedInput.val(cookieValOfFPVSpeed);

        setFPVMovementSpeed(cookieValOfFPVSpeed);
    }

    jqMaximumScreenSpaceErrorSlider.change(function (this: HTMLInputElement) {
        const maximumScreenSpaceError = this.value;

        setMaximumScreenSpaceError(maximumScreenSpaceError);

        // Set the value in the cookie for this page
        jQuery.cookie(cookieNameOfMaximumScreenSpaceErrorInput, maximumScreenSpaceError, {
            expires: cookieExpires,
            path: cookiePath
        });

        // Update the input value to match the slider
        jqMaximumScreenSpaceErrorInput.val(maximumScreenSpaceError);

        scene.requestRender();
    });

    jqMaximumScreenSpaceErrorInput.on("change input", function (this: HTMLInputElement) {
        jqMaximumScreenSpaceErrorSlider.val(this.value).trigger("change");
    });

    jqFPVMovementSpeedSlider.change(function (this: HTMLInputElement) {
        const speed = this.value;

        setFPVMovementSpeed(speed);

        // Set the value in the cookie for this page

        jQuery.cookie(cookieNameOfFPVMovement, speed, { expires: cookieExpires, path: cookiePath });

        // Update the input value to match the slider

        jqFPVMovementSpeedInput.val(speed);
    });

    jqFPVMovementSpeedInput.on("change input", function (this: HTMLInputElement) {
        jqFPVMovementSpeedSlider.val(this.value).trigger("change");
    });

    jQuery("#reset-maximum-screen-space-error").on("click", () => {
        jqMaximumScreenSpaceErrorSlider.val(16).trigger("change");
    });

    jQuery("#reset-fly-fpv-movement-speed").on("click", () => {
        jqFPVMovementSpeedSlider.val(0.4).trigger("change");
    });

    jQuery("#show-hide-tiles-inspector-checkbox").change(function (this: HTMLInputElement) {
        showHideTilesInspector(this.checked);
    });

    const jQFxaaEnableCheckBox = jQuery("#fxaa-enable-checkbox");

    // eslint-disable-next-line arrow-body-style
    jQFxaaEnableCheckBox.prop("checked", () => {
        return scene.postProcessStages.fxaa.enabled;
    });

    jQFxaaEnableCheckBox.change(function (this: HTMLInputElement) {
        scene.postProcessStages.fxaa.enabled = this.checked;
    });

    const jQCustomSnapOffsetSlider = jQuery("#custom-snap-offset-slider");
    const jQCustomSnapOffsetInput = jQuery("#custom-snap-offset-input");

    const screenSpaceEventController = scene.screenSpaceCameraController;

    // @ts-ignore
    jQCustomSnapOffsetSlider.val(screenSpaceEventController.snapOffset);
    // @ts-ignore
    jQCustomSnapOffsetInput.val(screenSpaceEventController.snapOffset);

    jQCustomSnapOffsetSlider.on("change", () => {
        const snapOffset = parseInt(jQCustomSnapOffsetSlider.val(), 10);

        // @ts-ignore
        screenSpaceEventController.snapOffset = snapOffset;

        jQCustomSnapOffsetInput.val(snapOffset);
    });

    jQCustomSnapOffsetInput.on("change", () => {
        const snapOffset = parseInt(jQCustomSnapOffsetInput.val(), 10);
        // @ts-ignore
        screenSpaceEventController.snapOffset = snapOffset;

        jQCustomSnapOffsetSlider.val(snapOffset);
    });

    const jQAutoZoomCheckBox = jQuery("#auto-zoom-checkbox");
    const cookieValOfAutoZoom = jQuery.cookie(cookieNameOfAutoZoom);

    if (cookieValOfAutoZoom) {
        window.Construkted.autoZoomToAsset = cookieValOfAutoZoom === "true";
    }

    // eslint-disable-next-line arrow-body-style
    jQAutoZoomCheckBox.prop("checked", () => {
        return window.Construkted.autoZoomToAsset;
    });

    jQAutoZoomCheckBox.change(function (this: HTMLInputElement) {
        jQuery.cookie(cookieNameOfAutoZoom, this.checked, { expires: cookieExpires, path: cookiePath });

        window.Construkted.autoZoomToAsset = this.checked;
    });

    const jqBackfaceCulling = jQuery("#backface-culling-checkbox");

    jqBackfaceCulling.prop("checked", true);

    jqBackfaceCulling.change(function (this: HTMLInputElement) {
        window.Construkted.setBackfaceCulling(this.checked);
    });

    const jqCollisionDetection = jQuery("#collision-dectection-checkbox");

    jqCollisionDetection.prop("checked", true);

    jqCollisionDetection.change(function (this: HTMLInputElement) {
        window.Construkted.setEnableCollisionDetection(this.checked);
    });

    jQuery("#camera-switcher").change(function (this: HTMLInputElement) {
        const cameraFieldOfViewContainer = jQuery("#camera-field-of-view-container");

        if (this.checked) {
            scene.camera.switchToOrthographicFrustum();
            cameraFieldOfViewContainer.hide();
        } else {
            scene.camera.switchToPerspectiveFrustum();
            cameraFieldOfViewContainer.show();
        }
    });

    let selectedServerUrl = jQuery.cookie("ck-storage-server");

    if (selectedServerUrl) {
        jQuery("#storage-server-select").val(selectedServerUrl);
    } else {
        jQuery("#storage-server-select").val(window.CONSTRUKTED_AJAX.assets_server);
    }

    jQuery(document).on("change", "#storage-server-select", (e: Event) => {
        e.preventDefault();
        // Change the storage server cookie ck-storage-server to the value

        selectedServerUrl = jQuery("#storage-server-select option:selected").val();

        jQuery.cookie("ck-storage-server", selectedServerUrl, { expires: cookieExpires, path: cookiePath });

        // Reload the page
        window.location.reload();
    });
}
