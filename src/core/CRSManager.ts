import { Cartographic, Math as CesiumMath } from "cesium";
import proj4 from "proj4";

import EPSGList from "./EPSGs";

export enum SRSType {
    Projected = "Projected",
    Geographic2d = "Geographic2d",
    Geographic3d = "Geographic3d",
    Geocentric = "Geocentric",
    Compound = "Compound"
}

export interface CRSInfo {
    srid: number;
    auth_id: string;
    description: string;
    parameters: string;
    srs_type: string;
}

export class CRSManager {
    private _crsInfoList: CRSInfo[];

    constructor() {
        this._crsInfoList = EPSGList;
    }

    getWGS84() {
        return this.getCRSInfo("4326");
    }

    getCRSInfo(authId: string) {
        for (let i = 0; i < this._crsInfoList.length; i++) {
            if (this._crsInfoList[i].auth_id === authId) {
                return this._crsInfoList[i];
            }
        }

        throw new Error(`unexpected srid: ${authId}`);
    }

    getProj4String(srid: number) {
        for (let i = 0; i < this._crsInfoList.length; i++) {
            if (this._crsInfoList[i].srid === srid) {
                return this._crsInfoList[i].parameters;
            }
        }

        // WGS84
        return "+proj=longlat +datum=WGS84 +no_defs";
    }

    // eslint-disable-next-line class-methods-use-this
    getCoordinate(carto: Cartographic, crsInfo: CRSInfo) {
        const wgs84 = "EPSG:4326";

        const longitudeDegree = CesiumMath.toDegrees(carto.longitude);
        const latitudeDegree = CesiumMath.toDegrees(carto.latitude);
        // const height = carto.height;

        const coords = proj4(wgs84, crsInfo.parameters, [longitudeDegree, latitudeDegree]);

        return coords;
    }

    isValidEpsgDescription(desc: string) {
        for (let i = 0; i < this._crsInfoList.length; i++) {
            if (this._crsInfoList[i].description === desc) {
                return true;
            }
        }

        return false;
    }
}
