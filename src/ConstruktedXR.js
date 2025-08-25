/* eslint-disable */

import { isMobile } from "./construkted";
import { changeCesiumCamera } from "./changeCesiumCamera";

let gl = null;
let inlineViewerHelper;

const mobile = isMobile();
let xrImmersiveRefSpace = null;

function onXRFrame(t, frame) {
    const session = frame.session;
    const refSpace = session.isImmersive ? xrImmersiveRefSpace : inlineViewerHelper.referenceSpace;
    const pose = frame.getViewerPose(refSpace);

    if (pose) {
        const headEuler = CONSTRUKTEDXR.create$1();
        const or = pose.transform.orientation;
        CONSTRUKTEDXR.eulerFromQuaternionDegree(headEuler, [or.x, or.y, or.z, or.w], "YXZ");

        const event = new CustomEvent("viewerPoseUpdatedEvent", {
            detail: {
                posX: pose.transform.position.x,
                posY: pose.transform.position.y,
                posZ: pose.transform.position.z,
                rotX: -headEuler[1],
                rotY: headEuler[0],
                rotZ: headEuler[2]
            }
        });

        // customEventTarget.dispatchEvent(event);

        if (mobile)
            changeCesiumCamera(
                pose.transform.position.x,
                pose.transform.position.y,
                pose.transform.position.z,
                -headEuler[1],
                headEuler[0],
                headEuler[2]
            );
    }

    session.requestAnimationFrame(onXRFrame);

    // Assumed to be a XRWebGLLayer for now.
    const layer = session.renderState.baseLayer;

    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
}

function onSessionStarted(session) {
    session.addEventListener("end", onSessionEnded);

    const cesiumFPVCameraController = window.construktedAssetViewer.fpvController();

    if (session.isImmersive) {
        if (!cesiumFPVCameraController.started()) {
            if (cesiumFPVCameraController.startFPVPositionMobile() == null) {
                alert("Please tap on 3d tile to start FPV!");
                cesiumFPVCameraController.setAllowStartPositionTap(true);
                return;
            }
            cesiumFPVCameraController.startFPVMobile();

            jQuery(".ck-view-mobile-selector").hide();
        } else {
            jQuery(".ck-view-mobile-selector").hide();
        }
    }

    initGL();

    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });

    const refSpaceType = session.isImmersive ? "local" : "viewer";

    session.requestReferenceSpace(refSpaceType).then((refSpace) => {
        if (session.isImmersive) {
            xrImmersiveRefSpace = refSpace;
        } else {
            inlineViewerHelper = new CONSTRUKTEDXR.InlineViewerHelper(gl.canvas, refSpace);
        }
        session.requestAnimationFrame(onXRFrame);
    });

    jQuery("#overlay-content").addClass("full-overlay");
}

function onRequestSession() {
    // Requests an 'immersive-ar' session, which ensures that the users
    // environment will be visible either via video passthrough or a
    // transparent display. This may be presented either in a headset or
    // fullscreen on a mobile device.
    const uiElement = document.getElementById("overlay-content"); // ui

    const xrButton = window.construktedAssetViewer.xrButton();

    return navigator.xr
        .requestSession("immersive-ar", {
            optionalFeatures: ["dom-overlay", "dom-overlay-for-handheld-ar"],
            domOverlay: { root: uiElement }
        })
        .then((session) => {
            xrButton.setSession(session);
            session.isImmersive = true;
            onSessionStarted(session);
        });
}

function onEndSession(session) {
    session.end();

    jQuery(".ck-view-mobile-selector").show();
    jQuery("#overlay-content").removeClass("full-overlay");
}

function onSessionEnded(event) {
    const xrButton = window.construktedAssetViewer.xrButton();

    if (event.session.isImmersive) {
        xrButton.setSession(null);
        // Turn the background back on when we go back to the inlive view.
    }
}

function initGL() {
    gl = createWebGLContext({
        xrCompatible: true
    });
}

// Creates a WebGL context and initializes it with some common default state.
function createWebGLContext(glAttribs) {
    glAttribs = glAttribs || { alpha: false };

    const webglCanvas = document.getElementById("xr-canvas");
    const contextTypes = glAttribs.webgl2 ? ["webgl2"] : ["webgl", "experimental-webgl"];
    let context = null;

    for (const contextType of contextTypes) {
        context = webglCanvas.getContext(contextType, glAttribs);
        if (context) {
            break;
        }
    }

    if (!context) {
        const webglType = glAttribs.webgl2 ? "WebGL 2" : "WebGL";
        console.error(`This browser does not support ${webglType}.`);
        return null;
    }

    return context;
}

function toggleXrItems() {
    jQuery(".webvr-ui-button, #xr-canvas").toggle();
    jQuery("#overlay-content").toggleClass("full-overlay");
}

export { onEndSession, onRequestSession, onXRFrame, onSessionStarted, toggleXrItems };
