// q@ts-ignore
import { Event, SplitDirection } from "cesium";
import { ConstruktedAssetType } from "../types/common";

interface AssetConstructorOptions {
    type: ConstruktedAssetType;
    postId: string;
}

export abstract class Asset {
    protected _type: ConstruktedAssetType;
    protected _ready: boolean = false;
    protected readonly _readyEvt: Event = new Event();
    private _postId: string;

    constructor(options: AssetConstructorOptions) {
        this._type = options.type;
        this._postId = options.postId;
    }

    get ready() {
        return this._ready;
    }

    get readyEvt() {
        return this._readyEvt;
    }

    get postId() {
        return this._postId;
    }

    isTileset() {
        return (
            this._type === ConstruktedAssetType.PolygonMesh ||
            this._type === ConstruktedAssetType.ThreeDTiles ||
            this._type === ConstruktedAssetType.PointCloud
        );
    }

    isTMSTiles() {
        return this._type === ConstruktedAssetType.Orthomosaic;
    }

    abstract setSplitDirection(leftChecked: boolean, rightChecked: boolean): void;
    abstract toggle(): void;
    abstract setShowSplitDirection(show: boolean, splitDirection: SplitDirection): void;
    abstract resetShowSplitDirection(): void;
}
