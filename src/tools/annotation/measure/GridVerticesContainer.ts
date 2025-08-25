import { Cartesian3, Color } from "cesium";

export class GridVerticesContainer {
    private readonly _positions: Array<Cartesian3>;
    private readonly _colors: Array<Color>;
    private readonly _gridIndexToLocalIndexMap: Map<number, number>;
    constructor() {
        this._positions = [];
        this._colors = [];
        this._gridIndexToLocalIndexMap = new Map();
    }

    addNewVertex(gridIndex: number, position: Cartesian3, color: Color) {
        if (this._gridIndexToLocalIndexMap.has(gridIndex)) {
            return;
        }

        this._gridIndexToLocalIndexMap.set(gridIndex, this._positions.length);

        this._positions.push(position);
        this._colors.push(color);
    }

    getVertexLocalIndex(gridIndex: number) {
        return this._gridIndexToLocalIndexMap.get(gridIndex);
    }

    get positions() {
        return this._positions;
    }

    get colors() {
        return this._colors;
    }
}
