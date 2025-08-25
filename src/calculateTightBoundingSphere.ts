/* qeslint-disable */
// q@ts-nocheck

import { BoundingSphere, Cesium3DTile, Cesium3DTileset, Matrix4 } from "cesium";

export function calculateTightBoundinSphere(tileset: Cesium3DTileset) {
    const root = tileset.root;

    const originalModelMatrix = Matrix4.clone(tileset.modelMatrix, new Matrix4());
    const needToUpdateTransform = !Matrix4.equals(originalModelMatrix, Matrix4.IDENTITY);

    tileset.modelMatrix = Matrix4.IDENTITY;

    function updateTransform(tile: Cesium3DTile) {
        const parent = tile.parent;

        const parentTransform = parent ? parent.computedTransform : tileset.modelMatrix;

        // @ts-ignore
        tile.updateTransform(parentTransform);
    }

    const leafTiles: Cesium3DTile[] = [];

    function iterateLeafTiles(tile: Cesium3DTile) {
        const children = tile.children;

        if (needToUpdateTransform) {
            updateTransform(tile);
        }

        if (children && children.length > 0) {
            children.forEach((child) => {
                if (needToUpdateTransform) {
                    updateTransform(tile);
                }

                iterateLeafTiles(child);
            });
        } else {
            leafTiles.push(tile);
        }
    }

    iterateLeafTiles(tileset.root);

    const boundingSpheres: BoundingSphere[] = [];

    leafTiles.forEach((tile) => {
        boundingSpheres.push(tile.boundingSphere);
    });

    const boundingSphere = BoundingSphere.fromBoundingSpheres(boundingSpheres);

    Matrix4.multiplyByPoint(originalModelMatrix, boundingSphere.center, boundingSphere.center);

    tileset.modelMatrix = originalModelMatrix;

    // revert
    iterateLeafTiles(root);

    if (tileset.boundingSphere.radius < boundingSphere.radius) {
        console.warn("Tight bounding sphere is larger than original bounding sphere");

        return tileset.boundingSphere;
    }

    return boundingSphere;
}
