/* qeslint-disable */
// q@ts-nocheck

import { Cartesian2, Cartesian3, defined, Ray, Cesium3DTileset } from "cesium";

const pickGlobeScratchRay = new Ray();
const scratchDepthIntersection = new Cartesian3();
const scratchRayIntersection = new Cartesian3();

// ScreenSpaceCameraController.js
function originalPickGlobe(controller: any, mousePosition: Cartesian2, result: Cartesian3) {
    const scene = controller._scene;
    const globe = controller._globe;
    const camera = scene.camera;

    if (!defined(globe)) {
        return undefined;
    }

    const cullBackFaces = !controller._cameraUnderground;

    let depthIntersection;
    if (scene.pickPositionSupported) {
        depthIntersection = scene.pickPositionWorldCoordinates(mousePosition, scratchDepthIntersection);
    }

    const ray = camera.getPickRay(mousePosition, pickGlobeScratchRay);
    const rayIntersection = globe.pickWorldCoordinates(ray, scene, cullBackFaces, scratchRayIntersection);

    const pickDistance = defined(depthIntersection)
        ? Cartesian3.distance(depthIntersection, camera.positionWC)
        : Number.POSITIVE_INFINITY;
    const rayDistance = defined(rayIntersection)
        ? Cartesian3.distance(rayIntersection, camera.positionWC)
        : Number.POSITIVE_INFINITY;

    const pickedObject = scene.pick(mousePosition, 1, 1);

    if (pickedObject && pickedObject.primitive instanceof Cesium3DTileset) {
        // depthIntersection is alwayse on 3D Tiles.
        return Cartesian3.clone(depthIntersection, result);
    }

    // original logic
    if (pickDistance < rayDistance) {
        return Cartesian3.clone(depthIntersection, result);
    }

    return Cartesian3.clone(rayIntersection, result);
}

const scratchCartesian3Four = new Cartesian3();
const scratchCartesian2 = new Cartesian2();

// pick the nearest position in snapping area
export default function pickGlobe(controller: any, mousePosition: Cartesian2, result: Cartesian3) {
    if (!controller.enableSnap) {
        return originalPickGlobe(controller, mousePosition, result);
    }

    const scene = controller._scene;
    const globe = controller._globe;
    const camera = scene.camera;

    if (!defined(globe)) {
        return undefined;
    }

    const canvas = scene.canvas;

    const snapOffset = controller.snapOffset;

    const x = mousePosition.x;
    const y = mousePosition.y;
    const points = [];

    points.push(new Cartesian2(x, y)); // center

    points.push(new Cartesian2(x - snapOffset, y - snapOffset)); // left top
    points.push(new Cartesian2(x, y - snapOffset)); // center top
    points.push(new Cartesian2(x + snapOffset, y - snapOffset)); // right top

    points.push(new Cartesian2(x + snapOffset, y)); // right center
    points.push(new Cartesian2(x + snapOffset, y + snapOffset)); // right bottom

    points.push(new Cartesian2(x, y + snapOffset)); // center bottom
    points.push(new Cartesian2(x - snapOffset, y + snapOffset)); // left bottom

    points.push(new Cartesian2(x - snapOffset, y)); // left center

    let minDistance = Number.POSITIVE_INFINITY;
    let found = false;

    const pickeGlobeDebugger = window.Construkted.pickGlobeDebugger!;
    // pickeGlobeDebugger.setShow(true);
    pickeGlobeDebugger.setShow(false);

    for (let i = 0; i < points.length; i++) {
        const point = points[i];

        if (point.x < 0 || point.x >= canvas.width - 1) {
            pickeGlobeDebugger.setOneShow(i, false);
            continue;
        }

        if (point.y < 0 || point.y >= canvas.height - 1) {
            pickeGlobeDebugger.setOneShow(i, false);
            continue;
        }

        scratchCartesian2.x = point.x;
        scratchCartesian2.y = point.y;

        const picked = originalPickGlobe(controller, scratchCartesian2, scratchCartesian3Four);

        if (!picked) {
            pickeGlobeDebugger.setOneShow(i, false);
            continue;
        }

        const distance = Cartesian3.distance(picked, camera.positionWC);

        if (distance < minDistance) {
            minDistance = distance;
            Cartesian3.clone(picked, result);

            found = true;
        }

        pickeGlobeDebugger.setPosition(i, picked);
    }

    if (found) {
        return result;
    }

    return undefined;
}
