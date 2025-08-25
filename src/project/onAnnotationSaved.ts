import * as JQuery from "jquery";
import { clearAnnotationInputs, triggerShowingAnnontationsPopup } from "./common";

export default function onAnnotationSaved(form: JQuery) {
    const jQuery = window.jQuery;

    // Clear all the data
    clearAnnotationInputs();

    // Hide all the loading animations, sidebar
    jQuery("#sidebar-new-annotation").hide();

    jQuery("#annotation-reset-view").removeAttr("disabled");
    jQuery(form).parents(".ck-modal").addClass("hidden");

    jQuery(".ck-processing-loader").removeClass("shown");

    // Show the sidebar for drawing and measurements
    triggerShowingAnnontationsPopup();

    window.Construkted.project.setAnnotationModified(false);
}
