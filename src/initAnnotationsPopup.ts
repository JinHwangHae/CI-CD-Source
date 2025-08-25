/* qeslint-disable */

export default function initAnnotaionsPopup() {
    const measurementTools = window.Construkted.measurementTools;

    $("#show-hide-all-measurement-checkbox").change(function () {
        // @ts-ignore
        const checked = this.checked;

        measurementTools.showHideAllMeasurements(checked);

        $("#annotation-list .form-check-input").each(function () {
            // @ts-ignore
            this.checked = checked;

            jQuery(this).trigger("change");
        });
    });
}
