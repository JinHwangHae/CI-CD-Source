import { Annotation, AssetInfo, ParsedConstruktedAjax } from "./common";
import AssetViewer from "../AssetViewer";
import { AssetExplorerV2 } from "../AssetExplorerV2";
import Construkted from "../Construkted1";

declare global {
    interface Window {
        Construkted: Construkted;
        $: any;
        master_asset: AssetInfo | undefined; // meaningful for only old project
        project_assets: AssetInfo[]; // asset list of project
        assets: AssetInfo[]; // near asset in project
        annotations: Annotation[]; // meaningful for only project
        construktedAssetExplorer?: AssetExplorerV2;
        construktedAssetViewer?: AssetViewer;
        /**
         * it is initialized by WP at start
         * and updated whenever user clicks save button at any editor
         */
        CONSTRUKTED_AJAX: ParsedConstruktedAjax;
        CONSTRUKTEDXR: any;
        currentUser?: {
            ID: string; // "3"
            has_access: string; // "true" or false
            is_author: string; // "true" or false
            logged: string; // "true" or false
            name: string; //
            post_type: string; // "project"
        };
        filesToUpload: any[]; // meaningful for only project: string; // "project" or "video"
        gowatch: any;
        jQuery: any;
        opera: any;
        videoRecorderWidget: any;
        localConfig: any;
        tinymce: {
            get: (id: string) => {
                getContent: () => string;
            };
        };
    }
}

export default global;
