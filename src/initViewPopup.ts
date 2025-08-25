/* qeslint-disable */
// q@ts-nocheck

import * as JQuery from "jquery";
import { Math as CesiumMath } from "cesium";
import { captureThumbnail, removeThumbnail, resetCameraView } from "./construkted_ajax";
import CameraViewpoints from "./CameraViewpoints";

function initViewPopup() {
    const jQuery = window.jQuery;
    const viewer = window.Construkted.cesiumViewer;
    const carmeraViewpoints = new CameraViewpoints(viewer);

    // Check if user is logged in
    const isLoggedIn =
        window.CONSTRUKTED_AJAX?.current_user?.logged === "true" || window.currentUser?.logged === "true";

    if (!isLoggedIn) {
        // Hide reset button
        const resetButton = jQuery("#reset_camera_view");
        if (resetButton.length) {
            resetButton.hide();
        }

        // Hide capture camera viewpoint button
        const captureButton = jQuery(".capture-camera-viewpoint");
        if (captureButton.length) {
            captureButton.hide();
        }
    }

    // Initialize the CameraViewpoints instance to bind event handlers
    carmeraViewpoints.init();

    // Load camera viewpoints list when view settings popup is opened
    jQuery(document).on("click", "#construkted-popup-view-btn", () => {
        // Small delay to ensure popup is visible before loading viewpoints
        setTimeout(() => {
            carmeraViewpoints.refreshViewpointsList();
        }, 100);
    });
    jQuery(document).on("click", ".capture-view", function (this: JQuery) {
        const button = jQuery(this);
        captureThumbnail(viewer, button);
    });
    jQuery(document).on("click", ".capture-camera-viewpoint", () => {
        carmeraViewpoints.handleQuickAddViewpoint(new Event("click"));
    });

    jQuery(document).on("click", ".remove-capture", function (this: JQuery, e: any) {
        e.preventDefault();
        const button = jQuery(this);
        removeThumbnail(button);
    });

    jQuery("#reset_camera_view").click(() => {
        resetCameraView();
        viewer.camera.flyHome();
    });

    jQuery("#enable-video-recorder").parent().parent().hide();

    jQuery("#enable-video-recorder").change(function (this: HTMLInputElement) {
        if (this.checked) {
            window.videoRecorderWidget.show();
        } else {
            window.videoRecorderWidget.hide();
        }
    });

    const camera = window.Construkted.cesiumViewer.camera;

    // @ts-ignore
    const defaultFOV = camera.frustum.fov; // in radians
    const defaultFOVInDegrees = Math.round(CesiumMath.toDegrees(defaultFOV));
    const jqCameraFieldOfViewInputRange = jQuery("#camera-field-of-view-range-input");
    const jqCameraFieldOfViewInput = jQuery("#camera-field-of-view-input");

    jqCameraFieldOfViewInputRange.val(defaultFOVInDegrees);
    jqCameraFieldOfViewInput.val(defaultFOVInDegrees);

    jqCameraFieldOfViewInputRange.on("change", () => {
        const fovInDegree = jqCameraFieldOfViewInputRange.val();

        // @ts-ignore
        camera.frustum.fov = CesiumMath.toRadians(fovInDegree);
        jqCameraFieldOfViewInput.val(fovInDegree);
    });

    jqCameraFieldOfViewInput.on("change", () => {
        const fovInDegree = jqCameraFieldOfViewInput.val();

        // @ts-ignore
        camera.frustum.fov = CesiumMath.toRadians(fovInDegree);
        jqCameraFieldOfViewInputRange.val(fovInDegree);
    });

    jQuery("#reset-camera-field-of-view").click(() => {
        // @ts-ignore
        camera.frustum.fov = defaultFOV;
        jqCameraFieldOfViewInputRange.val(defaultFOVInDegrees);
        jqCameraFieldOfViewInput.val(defaultFOVInDegrees);
    });

    const construkted = window.Construkted;
    const jqThreeDViewModeRadio = jQuery("#threed-view-mode-radio");

    jqThreeDViewModeRadio.prop("checked", true);

    jqThreeDViewModeRadio.click(() => {
        construkted.set3DViewMode();
    });

    jQuery("#twod-view-mode-radio").click(() => {
        construkted.set2DViewMode();
    });

    jQuery("#twod-view-mode-north-up-radio").click(() => {
        construkted.set2DViewNorthUpMode();
    });

    jQuery("#wireframe-shading-radio").click(() => {
        construkted.setWireframeShadingMode();
    });

    jQuery("#solid-shading-radio").click(() => {
        construkted.setSolidShadingMode();
    });

    jQuery("#texture-shading-radio").prop("checked", true);

    jQuery("#texture-shading-radio").click(() => {
        construkted.setTextureShadingMode();
    });
}

export default initViewPopup;
