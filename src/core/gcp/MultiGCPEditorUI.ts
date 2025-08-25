import * as JQuery from "jquery";
import { ConstruktedTransformEditors } from "../../types/common";
import { GCPManager } from "./GCPManager";
import { saveGeolocation } from "../../construkted_ajax";
import { showFirstPage, updateTransformPopup } from "../../initTransformPopup";

let jqAddGCPButton: JQuery;
let jqUpdateAssetLocationButton: JQuery;
let jqUndergroundCheckBox: JQuery<HTMLInputElement>;
let jqSaveAndCloseButton: JQuery;
let jqCancelButton: JQuery;
let jqResetButton: JQuery;

interface MultiGCPEditorUIConstructorOptions {
    editor: GCPManager;
}

class MultiGCPEditorUI {
    private _editor: GCPManager;

    constructor(options: MultiGCPEditorUIConstructorOptions) {
        this._editor = options.editor;

        const jQuery = window.jQuery;

        jqAddGCPButton = jQuery("#add_gcp_button");
        jqUpdateAssetLocationButton = jQuery("#update_asset_location_button");
        jqUndergroundCheckBox = jQuery("#multiple-gcp-is-underground-checkbox");
        jqSaveAndCloseButton = jQuery("#multi-gcp-editor-save-close-button");
        jqCancelButton = jQuery("#multi-gcp-editor-cancel-button");
        jqResetButton = jQuery("#multi-gcp-editor-reset-button");

        const assetViewer = window.Construkted.assetViewer;

        jqAddGCPButton.click(() => {
            this._editor._newGCPInterface();
        });

        jqUpdateAssetLocationButton.click(() => {
            if (!this._editor._checkGCP()) return;

            this._editor._updateAssetLocation();
        });

        jqSaveAndCloseButton.click(async () => {
            if (!this._editor.calculated) {
                alert("Please update asset location!");
                return;
            }

            let GCPJSONString;

            if (this._editor.calculated) {
                GCPJSONString = this._editor.workingResultAsJson();
            }

            const saveOptions = {
                activeEditor: ConstruktedTransformEditors.MultiGCPsEditor,
                asset: assetViewer.masterAsset,
                GCPJSONString: GCPJSONString,
                isUnderground: jqUndergroundCheckBox.prop("checked") as boolean,
                terrainImageryEnabled: window.CONSTRUKTED_AJAX.terrain_imagery_enabled,
                jqControls: [jqSaveAndCloseButton]
            };

            const res = await saveGeolocation(saveOptions, () => {
                this._editor.hideAllGCPs();
                showFirstPage();
                updateTransformPopup();
            });

            if (res) {
                this._editor.ignoreWorkingResult();
            }
        });

        jqCancelButton.click(() => {
            if (this._editor.calculated) {
                const ignore = window.confirm("Are you sure you want to close? You will lose all changes");

                if (!ignore) {
                    return;
                }
            }

            const enabled = window.CONSTRUKTED_AJAX.terrain_imagery_enabled;

            assetViewer.showHideSceneBackground(enabled);

            this._editor.cancel();
            showFirstPage();
        });

        jqResetButton.click(() => {
            this._editor.reset();
        });

        jqUndergroundCheckBox.prop("checked", window.CONSTRUKTED_AJAX.asset_is_underground);

        jqUndergroundCheckBox.change(function () {
            assetViewer.enableDisableUnderground(this.checked);
        });
    }
}

export { MultiGCPEditorUI };
