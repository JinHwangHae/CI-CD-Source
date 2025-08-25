/* qeslint-disable */
// q@ts-nocheck
import { Cartesian2, Cartesian3, VerticalOrigin, Viewer } from "cesium";

export class DragRotateMarker {
    private _viewer: Viewer;
    private _billboard: any;

    constructor(options: { viewer: Viewer }) {
        this._viewer = options.viewer;
        this._billboard = this._viewer.entities.add({
            position: new Cartesian3(),
            billboard: {
                image: `${window.Construkted.imageRootUrl()}/pin.png`,
                verticalOrigin: VerticalOrigin.BOTTOM,
                scale: 0.7,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                pixelOffset: new Cartesian2(0, -12)
            }
        });
    }

    setPosition(position: Cartesian3) {
        this._billboard.position = position;
    }

    get show() {
        return this._billboard.show;
    }

    set show(b: boolean) {
        this._billboard.show = b;
    }
}
