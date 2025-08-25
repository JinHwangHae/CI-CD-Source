import { BoundingSphere, Cartesian3, Cesium3DTileset, Event, Rectangle, Viewer } from "cesium";
import { AssetInfo, ConstruktedAssetType, ConstruktedTransformEditors } from "../types/common";
import { Asset } from "./Asset";
import { TilesetAsset } from "./TilesetAsset";
import { TMSTilesAsset } from "./TMSTilesAsset";
import { getTiesetURL } from "../construkted";
import { calculateTightBoundinSphere } from "../calculateTightBoundingSphere";

interface AssetGroupConstructorOptions {
    viewer: Viewer;
    assetInfos: AssetInfo[];
}

export class AssetGroup {
    private _ready: boolean = false;
    private _assets: Asset[] = [];
    private _readyEvt: Event = new Event();

    constructor(options: AssetGroupConstructorOptions) {
        const scene = options.viewer.scene;
        const assetInfos = options.assetInfos;

        assetInfos.forEach((assetInfo) => {
            const assetType = assetInfo.asset_type;

            if (
                assetType === ConstruktedAssetType.PolygonMesh ||
                assetType === ConstruktedAssetType.ThreeDTiles ||
                assetType === ConstruktedAssetType.PointCloud
            ) {
                let assetLocation;

                const activeEditorOfAsset = assetInfo.active_editor;

                if (activeEditorOfAsset === ConstruktedTransformEditors.MultiGCPsEditor) {
                    assetLocation = assetInfo.asset_geo_location_by_gcps;
                } else if (activeEditorOfAsset === ConstruktedTransformEditors.PredefinedGeoreference) {
                    assetLocation = assetInfo.asset_geo_location_by_pre;
                } else {
                    assetLocation = assetInfo.asset_geo_location;
                }

                const tilesetURL = getTiesetURL(assetInfo.asset_server, assetInfo.post_slug, assetInfo.new_style_url);

                const asset = new TilesetAsset({
                    type: assetType,
                    postId: assetInfo.post_id,
                    scene: scene,
                    assetGeolocation: assetLocation,
                    ignore_original_transform: false,
                    tilesetUrl: tilesetURL,
                    ignoreRootTransform: false
                });

                this._assets.push(asset);

                asset.readyEvt.addEventListener(() => {
                    let allReady = true;

                    for (let i = 0; i < this._assets.length; i++) {
                        if (!this._assets[i].ready) {
                            allReady = false;
                            break;
                        }
                    }

                    if (allReady) {
                        this._ready = true;
                        this._readyEvt.raiseEvent();
                    }
                });
            } else if (assetType === ConstruktedAssetType.Orthomosaic) {
                const asset = new TMSTilesAsset({
                    type: assetType,
                    postId: assetInfo.post_id,
                    viewer: options.viewer,
                    assetServer: assetInfo.asset_server,
                    postSlug: assetInfo.post_slug
                });

                this._assets.push(asset);

                asset.readyEvt.addEventListener(() => {
                    let allReady = true;

                    for (let i = 0; i < this._assets.length; i++) {
                        if (!this._assets[i].ready) {
                            allReady = false;
                            break;
                        }
                    }

                    if (allReady) {
                        this._ready = true;
                        this._readyEvt.raiseEvent();
                    }
                });
            }
        });
    }

    get readEvt() {
        return this._readyEvt;
    }

    get ready() {
        return this._ready;
    }

    tilesetsArray() {
        console.assert(this._ready, "true");

        const ret: Cesium3DTileset[] = [];

        this._assets.forEach((asset) => {
            if (asset.isTileset()) {
                const tilesetAsset = asset as TilesetAsset;

                ret.push(tilesetAsset.tileset);
            }
        });

        return ret;
    }

    get firstAsset() {
        return this._assets[0] as TilesetAsset;
    }

    get firstTileset() {
        for (let i = 0; i < this._assets.length; i++) {
            if (this._assets[i].isTileset()) {
                const tilesetAsset = this._assets[i] as TilesetAsset;

                return tilesetAsset.tileset;
            }
        }

        return undefined;
    }

    get boundingSphere() {
        const boundingSpheres: BoundingSphere[] = [];

        this._assets.forEach((asset) => {
            if (asset.isTileset()) {
                const tilesetAsset = asset as TilesetAsset;

                boundingSpheres.push(calculateTightBoundinSphere(tilesetAsset.tileset));
            }
        });

        this._assets.forEach((asset) => {
            if (asset.isTMSTiles()) {
                const tmsAsset = asset as TMSTilesAsset;
                const rectangle = tmsAsset.rectangle;

                const points = [];

                let carto = Rectangle.northwest(rectangle);

                points.push(Cartesian3.fromRadians(carto.longitude, carto.latitude));

                carto = Rectangle.northeast(rectangle);

                points.push(Cartesian3.fromRadians(carto.longitude, carto.latitude));

                carto = Rectangle.southwest(rectangle);

                points.push(Cartesian3.fromRadians(carto.longitude, carto.latitude));

                carto = Rectangle.southeast(rectangle);

                points.push(Cartesian3.fromRadians(carto.longitude, carto.latitude));

                boundingSpheres.push(BoundingSphere.fromPoints(points));
            }
        });

        return BoundingSphere.fromBoundingSpheres(boundingSpheres);
    }

    get assets() {
        return this._assets;
    }

    get tilesetAssets() {
        const ret: TilesetAsset[] = [];

        for (let i = 0; i < this._assets.length; i++) {
            if (this._assets[i].isTileset()) {
                ret.push(this._assets[i] as TilesetAsset);
            }
        }

        return ret;
    }

    get tmsTilesAssets() {
        const ret: TMSTilesAsset[] = [];

        this._assets.forEach((asset) => {
            if (asset.isTMSTiles()) {
                ret.push(asset as TMSTilesAsset);
            }
        });

        return ret;
    }

    containsGeoreferencedAsset(): boolean {
        for (let i = 0; i < this._assets.length; i++) {
            if (this._assets[i].isTMSTiles()) {
                return true;
            }

            if (this._assets[i].isTileset()) {
                const tilesetAsset = this._assets[i] as TilesetAsset;

                if (tilesetAsset.georeferenced) {
                    return true;
                }

                if (tilesetAsset.originallyGeoreferencedAtECEF) {
                    return true;
                }
            }
        }

        return false;
    }

    percentOfLoadedTiles() {
        let numberOfTilesTotal = 0;
        let numberOfLoadedTilesTotal = 0;

        this._assets.forEach((asset) => {
            if (asset.isTileset()) {
                const tilesetAsset = asset as TilesetAsset;
                // @ts-ignore
                const statistics = tilesetAsset.tileset.statistics;

                numberOfTilesTotal += statistics.numberOfTilesTotal;
                numberOfLoadedTilesTotal += statistics.numberOfLoadedTilesTotal;
            }
        });

        return (numberOfLoadedTilesTotal / numberOfTilesTotal) * 100;
    }

    percentOfLoadingProgress() {
        let total = 0;

        this._assets.forEach((asset) => {
            if (asset.isTileset()) {
                const tilesetAsset = asset as TilesetAsset;

                total += tilesetAsset.percentOfLoadingProgress;
            }
        });

        return total / this._assets.length;
    }

    getAsset(postId: string) {
        for (let i = 0; i < this._assets.length; i++) {
            if (this._assets[i].postId === postId) {
                return this._assets[i];
            }
        }

        return undefined;
    }

    getTilesetAsset(postId: string) {
        for (let i = 0; i < this._assets.length; i++) {
            if (this._assets[i].postId === postId && this._assets[i].isTileset()) {
                return this._assets[i] as TilesetAsset;
            }
        }

        return undefined;
    }
}
