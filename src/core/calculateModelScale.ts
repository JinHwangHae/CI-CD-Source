import { BoundingSphere, Cartesian3, Model, Scene } from "cesium";

const scratchPosition = new Cartesian3();

const scratchBoundingSphere = new BoundingSphere();

function scaleInPixels(positionWC: Cartesian3, radius: number, scene: Scene) {
    scratchBoundingSphere.center = positionWC;
    scratchBoundingSphere.radius = radius;

    return scene.camera.getPixelSize(
        scratchBoundingSphere,
        // @ts-ignore
        scene.context.drawingBufferWidth,
        // @ts-ignore
        scene.context.drawingBufferHeight
    );
}

export function calculateModelScale(scene: Scene, model: Model, desiredPixelSize: number) {
    // @ts-ignore
    const context = scene.context;

    const maxPixelSize = Math.max(context.drawingBufferWidth, context.drawingBufferHeight);
    const modelMatrix = model.modelMatrix;

    scratchPosition.x = modelMatrix[12];
    scratchPosition.y = modelMatrix[13];
    scratchPosition.z = modelMatrix[14];

    const boundingSphere = model.boundingSphere;

    const radius = boundingSphere.radius / model.scale;

    const metersPerPixel = scaleInPixels(scratchPosition, radius, scene);

    // metersPerPixel is always > 0.0
    const pixelsPerMeter = 1.0 / metersPerPixel;
    const diameterInPixels = Math.min(pixelsPerMeter * (2.0 * radius), maxPixelSize);

    return desiredPixelSize / diameterInPixels;
}
