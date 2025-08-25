/* qeslint-disable */

// eslint-disable-next-line camelcase
import { block_keys } from "./construkted";
import { CesiumFPVCameraController } from "./CesiumFPVCameraController";
import { toggleXrItems } from "./ConstruktedXR";
import { initFPVNavigation } from "./initFPVNavigation";

function createFPVController(options: any) {
    /*
    let options = {
        cesiumViewer: viewer,
        defaultCameraPositionOrientationJson: CONSTRUKTED_AJAX.default_camera_position_direction,
        isMobile: isMobile(),
        ignoreCollisionDetection: false,
        immersiveArEnabled: this._xrButton.enabled
    };
     */

    const fpvController = new CesiumFPVCameraController(options);

    fpvController.FPVStarted().addEventListener(() => {
        jQuery("body").addClass("fpv-mode-on");
        jQuery(".fpv-navigation").show();

        toggleXrItems();
        window.addEventListener("keydown", block_keys, false);
    });

    fpvController.FPVFinished().addEventListener(() => {
        jQuery("body").removeClass("fpv-mode-on");
        jQuery(".fpv-navigation").hide();

        toggleXrItems();

        window.removeEventListener("keydown", block_keys, false);
    });

    initFPVNavigation(fpvController);

    return fpvController;
}

export { createFPVController };
