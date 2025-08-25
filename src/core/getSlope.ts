/* qeslint-disable */
// q@ts-nocheck

import { Cartesian2, Cartesian3, Math as CesiumMath, Ellipsoid, Scene } from "cesium";

import { getWorldPosition } from "./getWorldPosition";

const positionScratch = new Cartesian3();
const normalScratch = new Cartesian3();
const surfaceNormalScratch = new Cartesian3();

const scratchCartesian2s = [new Cartesian2(), new Cartesian2(), new Cartesian2(), new Cartesian2()];
const scratchCartesian3s = [new Cartesian3(), new Cartesian3(), new Cartesian3(), new Cartesian3(), new Cartesian3()];

export function getSurfaceNormal(scene: Scene, worldPosition: Cartesian3, windowCoordinates: Cartesian2) {
    const distanceCameraToPositionThreshold = 10000.0;
    const pixelOffset = 2;
    const offsetDistanceRatioThreshold = 0.05;

    const cameraPosition = scene.camera.position;
    const distanceCameraToPosition = Cartesian3.distance(worldPosition, cameraPosition);

    if (distanceCameraToPosition > distanceCameraToPositionThreshold) {
        // don't compute slope if camera is more than 10km away from point
        return undefined;
    }

    const sc0 = scratchCartesian3s[0];
    const sc1 = scratchCartesian3s[1];
    const sc2 = scratchCartesian3s[2];
    const sc3 = scratchCartesian3s[3];

    const sampledWindowCoordinate0 = Cartesian2.clone(windowCoordinates, scratchCartesian2s[0]);
    sampledWindowCoordinate0.x -= pixelOffset;
    sampledWindowCoordinate0.y -= pixelOffset;

    const sampledWindowCoordinate1 = Cartesian2.clone(windowCoordinates, scratchCartesian2s[1]);
    sampledWindowCoordinate1.x -= pixelOffset;
    sampledWindowCoordinate1.y += pixelOffset;

    const sampledWindowCoordinate2 = Cartesian2.clone(windowCoordinates, scratchCartesian2s[2]);
    sampledWindowCoordinate2.x += pixelOffset;
    sampledWindowCoordinate2.y += pixelOffset;

    const sampledWindowCoordinate3 = Cartesian2.clone(windowCoordinates, scratchCartesian2s[3]);
    sampledWindowCoordinate3.x += pixelOffset;
    sampledWindowCoordinate3.y -= pixelOffset;

    const sPosition0 = getWorldPosition(scene, sampledWindowCoordinate0, sc0);
    const sPosition1 = getWorldPosition(scene, sampledWindowCoordinate1, sc1);
    const sPosition2 = getWorldPosition(scene, sampledWindowCoordinate2, sc2);
    const sPosition3 = getWorldPosition(scene, sampledWindowCoordinate3, sc3);

    let v0;
    let v1;
    let v2;
    let v3;

    if (sPosition0) {
        const line0 = Cartesian3.subtract(sPosition0, worldPosition, sc0);
        const d0 = Cartesian3.magnitude(line0);
        v0 =
            d0 / distanceCameraToPosition <= offsetDistanceRatioThreshold
                ? Cartesian3.normalize(line0, sc0)
                : undefined;
    }

    if (sPosition1) {
        const line1 = Cartesian3.subtract(sPosition1, worldPosition, sc1);
        const d1 = Cartesian3.magnitude(line1);
        v1 =
            d1 / distanceCameraToPosition <= offsetDistanceRatioThreshold
                ? Cartesian3.normalize(line1, sc1)
                : undefined;
    }

    if (sPosition2) {
        const line2 = Cartesian3.subtract(sPosition2, worldPosition, sc2);
        const d2 = Cartesian3.magnitude(line2);
        v2 =
            d2 / distanceCameraToPosition <= offsetDistanceRatioThreshold
                ? Cartesian3.normalize(line2, sc2)
                : undefined;
    }

    if (sPosition3) {
        const line3 = Cartesian3.subtract(sPosition3, worldPosition, sc3);
        const d3 = Cartesian3.magnitude(line3);
        v3 =
            d3 / distanceCameraToPosition <= offsetDistanceRatioThreshold
                ? Cartesian3.normalize(line3, sc3)
                : undefined;
    }

    let surfaceNormal = Cartesian3.clone(Cartesian3.ZERO, surfaceNormalScratch);
    let scratchNormal = scratchCartesian3s[4];

    if (v0 && v1) {
        scratchNormal = Cartesian3.normalize(Cartesian3.cross(v0, v1, scratchNormal), scratchNormal);
        surfaceNormal = Cartesian3.add(surfaceNormal, scratchNormal, surfaceNormal);
    }
    if (v1 && v2) {
        scratchNormal = Cartesian3.normalize(Cartesian3.cross(v1, v2, scratchNormal), scratchNormal);
        surfaceNormal = Cartesian3.add(surfaceNormal, scratchNormal, surfaceNormal);
    }
    if (v2 && v3) {
        scratchNormal = Cartesian3.normalize(Cartesian3.cross(v2, v3, scratchNormal), scratchNormal);
        surfaceNormal = Cartesian3.add(surfaceNormal, scratchNormal, surfaceNormal);
    }
    if (v3 && v0) {
        scratchNormal = Cartesian3.normalize(Cartesian3.cross(v3, v0, scratchNormal), scratchNormal);
        surfaceNormal = Cartesian3.add(surfaceNormal, scratchNormal, surfaceNormal);
    }

    if (surfaceNormal.equals(Cartesian3.ZERO)) {
        return 0;
    }

    surfaceNormal = Cartesian3.normalize(surfaceNormal, surfaceNormal);

    return surfaceNormal;
}

/**
 * Computes the slope at a point defined by window coordinates.
 *
 * @returns {Number} The slope at the point relative to the ground between [0, PI/2].
 */
export function getSlope(scene: Scene, windowCoordinates: Cartesian2) {
    const worldPosition = getWorldPosition(scene, windowCoordinates, positionScratch);
    if (!worldPosition) {
        return 0;
    }

    // @ts-ignore
    let normal = scene.frameState.mapProjection.ellipsoid.geodeticSurfaceNormal(worldPosition, normalScratch);
    normal = Cartesian3.negate(normal, normal);

    const surfaceNormal = getSurfaceNormal(scene, worldPosition, windowCoordinates);

    if (!surfaceNormal) {
        return 0;
    }

    return CesiumMath.asinClamped(Math.abs(Math.sin(Cartesian3.angleBetween(surfaceNormal, normal)))); // Always between 0 and PI/2.
}

const northPoleZ = Ellipsoid.WGS84.radii.z;
const northPolePositionMC = new Cartesian3(0.0, 0.0, northPoleZ);

const temp1Scratch = new Cartesian3();
const temp2Scratch = new Cartesian3();
const normalProjectedScratch = new Cartesian3();
const normalRejectedScratch = new Cartesian3();
const aspectVectorScratch = new Cartesian3();

export function getSlopeAndAspect(scene: Scene, windowCoordinates: Cartesian2) {
    const worldPosition = getWorldPosition(scene, windowCoordinates, positionScratch);
    if (!worldPosition) {
        return undefined;
    }

    // @ts-ignore
    let normal = scene.frameState.mapProjection.ellipsoid.geodeticSurfaceNormal(worldPosition, normalScratch);
    normal = Cartesian3.negate(normal, normal);

    const surfaceNormal = getSurfaceNormal(scene, worldPosition, windowCoordinates);

    if (!surfaceNormal) {
        return undefined;
    }

    // from GlobeVS.glsl

    const temp1 = Cartesian3.subtract(northPolePositionMC, worldPosition, temp1Scratch);

    const vectorEastMC = Cartesian3.cross(temp1, normal, temp1);

    Cartesian3.normalize(vectorEastMC, vectorEastMC);

    const dotProj = Math.abs(Cartesian3.dot(normal, surfaceNormal));
    const normalRejected = Cartesian3.multiplyByScalar(normal, dotProj, normalRejectedScratch);
    const normalProjected = Cartesian3.subtract(surfaceNormal, normalRejected, normalProjectedScratch);
    const aspectVector = Cartesian3.normalize(normalProjected, aspectVectorScratch);
    let aspect = Math.acos(Cartesian3.dot(aspectVector, vectorEastMC));
    const temp2 = Cartesian3.cross(vectorEastMC, aspectVector, temp2Scratch);
    const determ = Cartesian3.dot(temp2, normal);

    if (determ < 0.0) {
        aspect = 2 * Math.PI - aspect;
    }

    const slope = CesiumMath.asinClamped(Math.abs(Math.sin(Cartesian3.angleBetween(surfaceNormal, normal)))); // Always between 0 and PI/2.

    return {
        slope: slope,
        aspect: aspect
    };
}
