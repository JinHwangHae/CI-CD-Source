/* qeslint-disable */
// q@ts-nocheck

import { Cartesian2, Cartesian3, Matrix4 } from "cesium";

const scratchPlaneCenter = new Cartesian3();
const scratchPixelSize = new Cartesian2();
const scratchOldScale = new Cartesian3();
const scratchNetScale = new Cartesian3();

function getPixelSize(frameState: any, position: Cartesian3, pixelSize: Cartesian2) {
    const context = frameState.context;
    const cameraPositionWC = frameState.camera.positionWC;

    const distance = Cartesian3.distance(position, cameraPositionWC);
    const drawingBufferWidth = context.drawingBufferWidth;
    const drawingBufferHeight = context.drawingBufferHeight;

    return frameState.camera.frustum.getPixelDimensions(
        drawingBufferWidth,
        drawingBufferHeight,
        distance,
        frameState.pixelRatio,
        pixelSize
    );
}

function getNetScaleFactor(
    pixelSizeTermsOf2D: Cartesian2,
    maximumSizeInMeter: Cartesian2,
    pixelSizeTermsOf3D: Cartesian2,
    oldScale: Cartesian2,
    result: Cartesian3
) {
    let x = 1;
    let y = 1;
    let tmp;

    if (pixelSizeTermsOf2D.x > 0) {
        tmp = pixelSizeTermsOf2D.x * pixelSizeTermsOf3D.x;
        x = Math.min(tmp, maximumSizeInMeter.x) / oldScale.x;
    }

    if (pixelSizeTermsOf2D.y > 0) {
        tmp = pixelSizeTermsOf2D.y * pixelSizeTermsOf3D.y;
        y = Math.min(tmp, maximumSizeInMeter.y) / oldScale.y;
    }

    const z = (x + y) / 2;

    return Cartesian3.fromElements(x, y, z, result);
}

function getScreenSpaceScalingMatrix(
    pixelSize: Cartesian2,
    maximumSizeInMeter: Cartesian2,
    frameState: any,
    modelMatrix: Matrix4,
    modelMatrix1: Matrix4
) {
    const netScaleFactor = getNetScaleFactor(
        pixelSize,
        maximumSizeInMeter,
        getPixelSize(frameState, Matrix4.getTranslation(modelMatrix, scratchPlaneCenter), scratchPixelSize),
        Matrix4.getScale(modelMatrix, scratchOldScale),
        scratchNetScale
    );

    return Matrix4.multiplyByScale(modelMatrix, netScaleFactor, modelMatrix1);
}

export default getScreenSpaceScalingMatrix;
