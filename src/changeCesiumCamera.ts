/* qeslint-disable */
// q@ts-nocheck
const sensitivity = 1;

function changeCesiumCamera(
    translationX: number,
    translationY: number,
    translationZ: number,
    rotationX: number,
    rotationY: number,
    rotationZ: number
) {
    const cesiumFPVCameraController = window.construktedAssetViewer!.fpvController;

    if (!cesiumFPVCameraController) return;

    if (!cesiumFPVCameraController.started()) return;

    cesiumFPVCameraController.setView(
        translationX * sensitivity,
        translationY * sensitivity,
        translationZ * sensitivity,
        rotationX,
        rotationY,
        rotationZ
    );
}

export { changeCesiumCamera };
