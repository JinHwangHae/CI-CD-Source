/* qeslint-disable */
import "../css/ProgressBar.css";

import { MeasureUnits } from "../core";
import { VolumeMeasurement } from "../tools";

export function initVolumeMeasurementTool() {
    const jQuery = window.jQuery;
    const volumeMeasurementTool = window.Construkted.measurementTools.volumeMeasurementTool;

    const jqVerticalDisplacementSlider = jQuery("#annotation-volume-measurement-vertical-displacement-slider");
    const jqVerticalDisplacementInput = jQuery("#annotation-volume-measurement-vertical-displacement-input");

    jqVerticalDisplacementSlider.on("change", () => {
        if (volumeMeasurementTool.currentGridMesh) {
            volumeMeasurementTool.currentGridMesh.extrude(parseFloat(jqVerticalDisplacementSlider.val()));
        }

        jqVerticalDisplacementInput.val(jqVerticalDisplacementSlider.val());
    });

    jqVerticalDisplacementInput.on("change", () => {
        if (volumeMeasurementTool.currentGridMesh) {
            volumeMeasurementTool.currentGridMesh.extrude(parseFloat(jqVerticalDisplacementInput.val()));
        }

        jqVerticalDisplacementSlider.val(jqVerticalDisplacementInput.val());
    });

    const jqSamplingSlider = jQuery("#annotation-volume-measurement-sampling-slider");
    const jqSamplingInput = jQuery("#annotation-volume-measurement-sampling-input");

    jqSamplingSlider.on("change", () => {
        jqSamplingInput.val(jqSamplingSlider.val());

        if (volumeMeasurementTool.currentGridMesh) {
            const estimatedCalcTime = volumeMeasurementTool.guessCalculationTime();

            jQuery("#annotation-estimated-calculate-volume-time").text(`${estimatedCalcTime.toFixed(1)} seconds`);
        }

        volumeMeasurementTool.gridCellSize = parseFloat(jqSamplingSlider.val());
    });

    jqSamplingInput.on("change", () => {
        jqSamplingSlider.val(jqSamplingInput.val());
        volumeMeasurementTool.gridCellSize = parseFloat(jqSamplingInput.val());
    });

    const jqProgressContainer = jQuery("#annotation-volume-measurement-calc-progress-container");
    const jqProgressBar = jQuery("#annotation-volume-measurement-calc-progress");

    volumeMeasurementTool.calculationProgress.addEventListener((progress) => {
        jqProgressBar.css("width", `${Math.ceil(progress * 100)}%`);
    });

    function onVolumeCalculationStarted(promise: Promise<{ total: number; cut: number; fill: number }>) {
        jqProgressContainer.show();

        jqVerticalDisplacementSlider.val(0).trigger("change");

        jqSamplingSlider.css("pointer-events", "none");
        jqVerticalDisplacementSlider.css("pointer-events", "none");

        jQuery("#annotation-calculate-volume").prop("disabled", true);

        const cleanup = () => {
            jqProgressContainer.hide();
            jqSamplingSlider.css("pointer-events", "all");
            jqVerticalDisplacementSlider.css("pointer-events", "all");

            jQuery("#annotation-calculate-volume").prop("disabled", false);
        };

        const gridCellSize = volumeMeasurementTool.gridCellSize;

        const startTime = new Date();

        promise
            .then(
                (result: { total: number; cut: number; fill: number }) => {
                    const volumeUnit = volumeMeasurementTool.selectedUnits.volumeUnits;
                    const fraction = 2;

                    const info = `Total Calculated Volume: ${MeasureUnits.volumeToString(
                        result.total,
                        volumeUnit,
                        undefined,
                        fraction
                    )} \n Fill Volume: ${MeasureUnits.volumeToString(
                        result.fill,
                        volumeUnit,
                        undefined,
                        fraction
                    )} \n Cut Volume: ${MeasureUnits.volumeToString(result.cut, volumeUnit, undefined, fraction)}`;

                    jQuery("#annotation-measurement").text(info);

                    const elapsedTime = new Date().getSeconds() - startTime.getSeconds();

                    volumeMeasurementTool._updateCalculationTimeFactor(
                        elapsedTime,
                        volumeMeasurementTool.currentGridMesh!,
                        gridCellSize
                    );

                    const estimatedCalcTime = volumeMeasurementTool.guessCalculationTime();

                    jQuery("#annotation-estimated-calculate-volume-time").text(
                        `${estimatedCalcTime.toFixed(1)} seconds`
                    );

                    // Show the Volume Vertical Displacement
                    jQuery("#annotation-volume-measurement-vertical-displacement-input")
                        .parents(".ck-option-line")
                        .removeClass("hidden");

                    cleanup();
                },
                (e: any) => {
                    cleanup();

                    if (e instanceof Error) {
                        if (e.message === "canceled") {
                            return;
                        }

                        alert(e.message);

                        return;
                    }

                    alert("Something went wrong!");
                }
            )
            .catch((e: any) => {
                console.error(e);
            });

        jQuery("#annotation-cancel-volume-calculation").click(() => {
            volumeMeasurementTool.currentGridMesh?.cancel();
        });
    }

    volumeMeasurementTool.drawingFinished.addEventListener((measurementIndex: number) => {
        const measurement = volumeMeasurementTool.measurements[measurementIndex];
        const volumeMeasurment = measurement as VolumeMeasurement;

        jqSamplingSlider.val(volumeMeasurment.gridCellSize);
        jqVerticalDisplacementSlider.val(0);
    });

    const jqCalculationVolume = jQuery("#annotation-calculate-volume");

    jqCalculationVolume.click(() => {
        const promise = volumeMeasurementTool.calculate();
        onVolumeCalculationStarted(promise);
    });

    const jqClampGridCheckbox = jQuery("#clamp-grid-checkbox");

    jqClampGridCheckbox.change(function (this: HTMLInputElement) {
        const volumeMeasurement = volumeMeasurementTool.currentMeasurement;

        if (!volumeMeasurement) {
            return;
        }

        volumeMeasurement.clampToGround = this.checked;
    });
}
