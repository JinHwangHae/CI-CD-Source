/* eslint-disable */
// q@ts-nocheck

function initFPVNavigation(cesiumFPVCameraController) {
    const jqMoveLeftButton = jQuery(".fpv-left");
    const jqMoveRightButton = jQuery(".fpv-right");
    const jqMoveFrontButton = jQuery(".fpv-up");
    const jqMoveBackButton = jQuery(".fpv-down");

    jqMoveLeftButton.on("mousedown", () => {
        cesiumFPVCameraController.setDirectionLeft();
    });

    jqMoveLeftButton.on("mouseup", () => {
        cesiumFPVCameraController.setDirectionNone();
    });

    jqMoveRightButton.on("mousedown", () => {
        cesiumFPVCameraController.setDirectionRight();
    });

    jqMoveRightButton.on("mouseup", () => {
        cesiumFPVCameraController.setDirectionNone();
    });

    jqMoveFrontButton.on("mousedown", () => {
        cesiumFPVCameraController.setDirectionForward();
    });

    jqMoveFrontButton.on("mouseup", () => {
        cesiumFPVCameraController.setDirectionNone();
    });

    jqMoveBackButton.on("mousedown", () => {
        cesiumFPVCameraController.setDirectionBackward();
    });

    jqMoveBackButton.on("mouseup", () => {
        cesiumFPVCameraController.setDirectionNone();
    });

    jqMoveLeftButton.on("touchstart", () => {
        cesiumFPVCameraController.setDirectionLeft();
    });

    jqMoveLeftButton.on("touchend", () => {
        cesiumFPVCameraController.setDirectionNone();
    });

    jqMoveRightButton.on("touchstart", () => {
        cesiumFPVCameraController.setDirectionRight();
    });

    jqMoveRightButton.on("touchend", () => {
        cesiumFPVCameraController.setDirectionNone();
    });

    jqMoveFrontButton.on("touchstart", () => {
        cesiumFPVCameraController.setDirectionForward();
    });

    jqMoveFrontButton.on("touchend", () => {
        cesiumFPVCameraController.setDirectionNone();
    });

    jqMoveBackButton.on("touchstart", () => {
        cesiumFPVCameraController.setDirectionBackward();
    });

    jqMoveBackButton.on("touchend", () => {
        cesiumFPVCameraController.setDirectionNone();
    });
}

export { initFPVNavigation };
