import { AxisAlignedBoundingBox, BoundingSphere, Cartesian3, DeveloperError, OrientedBoundingBox } from "cesium";

import { TilesetAsset } from "./TilesetAsset";

interface TilesetAssetGroupConstrutorOptions {
    assets: TilesetAsset[];
}

export class TilesetAssetGroup {
    private _assets: TilesetAsset[];

    constructor(options: TilesetAssetGroupConstrutorOptions) {
        this._assets = options.assets;
    }

    getBoundingSphere(result: BoundingSphere) {
        const boundingSpheres: BoundingSphere[] = [];

        this._assets.forEach((asset) => {
            boundingSpheres.push(asset.tileset.boundingSphere);
        });

        return BoundingSphere.fromBoundingSpheres(boundingSpheres, result);
    }

    getAABoundingBox(result: AxisAlignedBoundingBox) {
        const positions: Cartesian3[] = [];

        this._assets.forEach((asset) => {
            const tileset = asset.tileset;

            // @ts-ignore
            const boundingVolume = tileset?.root.boundingVolume.boundingVolume;

            if (boundingVolume instanceof OrientedBoundingBox) {
                // @ts-ignore
                const corners = OrientedBoundingBox.computeCorners(boundingVolume);

                corners.forEach((corner: Cartesian3) => {
                    positions.push(corner);
                });
            } else if (boundingVolume instanceof BoundingSphere) {
                positions.push(boundingVolume.center);
                const center = boundingVolume.center;
                const radius = boundingVolume.radius;

                const min = new Cartesian3(center.x - radius, center.y - radius, center.z - radius);
                const max = new Cartesian3(center.x + radius, center.y + radius, center.z + radius);

                positions.push(center);
                positions.push(min);
                positions.push(max);
            } else {
                throw new DeveloperError("unexpected boundingVolume");
            }
        });

        return AxisAlignedBoundingBox.fromPoints(positions, result);
    }

    get assets() {
        return this._assets;
    }

    get length() {
        return this._assets.length;
    }
}
