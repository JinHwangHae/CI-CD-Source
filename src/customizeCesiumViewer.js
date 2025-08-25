/* eslint-disable */
// q@ts-nocheck
import { CameraEventType, KeyboardEventModifier } from "cesium";

function customizeCesiumViewer(viewer) {
    /* Switch mouse buttons in Cesium viewer:
            - Left button to pan
            - Right button to rotate
            - Wheel to zoom
            - Middle button to zoom
        */

    viewer.scene.screenSpaceCameraController.rotateEventTypes = CameraEventType.LEFT_DRAG;
    viewer.scene.screenSpaceCameraController.zoomEventTypes = [
        CameraEventType.MIDDLE_DRAG,
        CameraEventType.WHEEL,
        CameraEventType.PINCH
    ];

    viewer.scene.screenSpaceCameraController.tiltEventTypes = [
        CameraEventType.RIGHT_DRAG,
        CameraEventType.PINCH,
        {
            eventType: CameraEventType.RIGHT_DRAG,
            modifier: KeyboardEventModifier.CTRL
        },
        {
            eventType: CameraEventType.LEFT_DRAG,
            modifier: KeyboardEventModifier.CTRL
        }
    ];

    // customize credit display

    // viewer.scene.preUpdate.addEventListener(function (scene, time) {
    //     const creditContainer = viewer.bottomContainer;

    //     $("a[href='https://cesium.com/']").attr('href', "https://cesium.com/cesiumjs/");
    //     const cesiumjsIcon = "https://gw3.construkted.com/wp-content/themes/gowatch-child/images/cesiumjs.png";

    //     $("img[title='Cesium ion']").attr('src', cesiumjsIcon);
    //     $(".cesium-credit-textContainer").hide();
    //     $(".cesium-credit-expand-link").html("Map data attribution");
    // });
}

export { customizeCesiumViewer };
