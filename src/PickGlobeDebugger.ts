import { Cartesian3, VerticalOrigin, Viewer } from "cesium";

export default class PickGlobeDegugger {
    private _viewer: Viewer;
    private _billboards: any[] = [];

    constructor(viewer: Viewer) {
        this._viewer = viewer;

        for (let i = 0; i < 9; i++) {
            this._billboards.push(this._createBillboard(new Cartesian3()));
        }
    }

    setPosition(index: number, position: Cartesian3) {
        this._billboards[index].position = position;
    }

    setOneShow(index: number, show: boolean) {
        this._billboards[index].show = show;
    }

    setShow(show: boolean) {
        for (let i = 0; i < 9; i++) {
            this._billboards[i].show = show;
        }
    }

    _createBillboard(position: Cartesian3) {
        return this._viewer.entities.add({
            position: position,
            billboard: {
                image: `${window.Construkted.imageRootUrl()}/pin.png`,
                verticalOrigin: VerticalOrigin.BOTTOM,
                scale: 0.2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
    }
}
