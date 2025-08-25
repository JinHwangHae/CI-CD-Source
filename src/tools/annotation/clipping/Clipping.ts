import { createGuid } from "cesium";
import { TilesetAssetGroup } from "../../../core";
import { TilesetAssetClipping } from "./TilesetAssetClipping";

interface ConstructorOptions {
    assetGroup: TilesetAssetGroup;
}

export abstract class Clipping {
    private _id: string;
    private readonly _assetGroup: TilesetAssetGroup;
    private _assetClippings: TilesetAssetClipping[];
    private _activated: boolean;

    constructor(options: ConstructorOptions) {
        this._id = createGuid();
        const assetGroup = options.assetGroup;

        this._assetGroup = assetGroup;
        this._assetClippings = [];
        this._activated = true;
    }

    get id() {
        return this._id;
    }

    set id(val) {
        this._id = val;
    }

    abstract get showWall();
    abstract set showWall(val: boolean);

    activate() {
        if (this._activated) {
            return;
        }

        this._assetClippings.forEach((clipping) => {
            clipping.activate();
        });

        this._activated = true;
    }

    deactivate() {
        if (!this._activated) {
            return;
        }

        this._assetClippings.forEach((clipping) => {
            clipping.deactivate();
        });

        this._activated = false;
    }

    setTargetAsset(postId: string | undefined) {
        if (postId === undefined) {
            for (let i = 0; i < this._assetClippings.length; i++) {
                this._assetClippings[i].enable();
            }
        } else {
            for (let i = 0; i < this._assetClippings.length; i++) {
                if (this._assetClippings[i].asset.postId === postId) {
                    this._assetClippings[i].enable();
                } else {
                    this._assetClippings[i].disable();
                }
            }
        }
    }

    abstract getStatus(): any;
}
