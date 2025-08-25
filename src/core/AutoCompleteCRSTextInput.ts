import { Event } from "cesium";

import EPSGList from "./EPSGs";

export function getCRSInfoFromEPSGInfoString(epsgInfoString: string) {
    /**
     * example "EPSG:9939: EBBWV14-IRF"
     */

    const crsManager = window.Construkted.crsManager;
    let authId = "";

    try {
        const temp = epsgInfoString.substring(5, epsgInfoString.length);

        if (!temp) {
            return undefined;
        }

        authId = temp.substring(0, temp.indexOf(":"));
        const description = temp.substring(temp.indexOf(":") + 1, temp.length).trim();

        if (!description) {
            return undefined;
        }

        if (!crsManager.isValidEpsgDescription(description)) {
            return undefined;
        }
    } catch (error) {
        console.error(error);

        return undefined;
    }

    return crsManager.getCRSInfo(authId);
}

export class AutoCompleteCRSTextInput {
    private _crsSelected = new Event();

    constructor(options: { inputId: string }) {
        function handleAutocomplete(term: string) {
            const filtered = EPSGList.filter((crsInfo) => {
                const infoString = `${crsInfo.auth_name}:${crsInfo.auth_id}: ${crsInfo.description}`;

                return infoString.includes(term);
            });

            const max = 100;
            let count = 0;

            const infosOfCRS: string[] = [];

            for (let i = 0; i < filtered.length; i++) {
                const crsInfo = filtered[i];

                if (count > max) {
                    break;
                }

                infosOfCRS.push(`${crsInfo.auth_name}:${crsInfo.auth_id}: ${crsInfo.description}`);
                count++;
            }

            return infosOfCRS;
        }

        const self = this;

        // @ts-ignore
        jQuery(`#${options.inputId}`).autocomplete({
            source: function (request: any, response: any) {
                const term = request.term;
                const data = handleAutocomplete(term);

                response(data);
            },
            // https://stackoverflow.com/questions/40782638/jquery-autocomplete-performance-going-down-with-each-search
            search: function (/* e, ui */) {
                $(this).data("ui-autocomplete").menu.bindings = $();
            },
            select: function (event: any, ui: any) {
                const crsInfo = getCRSInfoFromEPSGInfoString(ui.item.value);

                // @ts-ignore
                self._crsSelected.raiseEvent(crsInfo);
            }
        });
    }

    get crsSelected() {
        return this._crsSelected;
    }
}
