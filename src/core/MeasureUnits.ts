/* qeslint-disable */
// q@ts-nocheck

// @ts-ignore
import { Check, defaultValue, DeveloperError, Math as CesiumMath, RuntimeError } from "cesium";

import { AngleUnits, AreaUnits, DistanceUnits, VolumeUnits } from "./units";

function getDistanceUnitConversion(distanceUnits: DistanceUnits) {
    if (distanceUnits === DistanceUnits.METERS) {
        return 1.0;
    }

    if (distanceUnits === DistanceUnits.CENTIMETERS) {
        return 0.01;
    }

    if (distanceUnits === DistanceUnits.KILOMETERS) {
        return 1000.0;
    }

    if (distanceUnits === DistanceUnits.FEET) {
        return 0.3048;
    }

    if (distanceUnits === DistanceUnits.US_SURVEY_FEET) {
        return 1200.0 / 3937.0;
    }

    if (distanceUnits === DistanceUnits.INCHES) {
        return 0.0254;
    }

    if (distanceUnits === DistanceUnits.YARDS) {
        return 0.9144;
    }

    if (distanceUnits === DistanceUnits.MILES) {
        return 1609.344;
    }
    // >>includeStart('debug', pragmas.debug);
    throw new DeveloperError(`Invalid distance units: ${distanceUnits}`);
    // >>includeEnd('debug');
}

function getAreaUnitConversion(areaUnits: AreaUnits) {
    if (areaUnits === AreaUnits.SQUARE_METERS) {
        return 1.0;
    }

    if (areaUnits === AreaUnits.SQUARE_CENTIMETERS) {
        return 0.0001;
    }

    if (areaUnits === AreaUnits.SQUARE_KILOMETERS) {
        return 1000000.0;
    }

    if (areaUnits === AreaUnits.SQUARE_FEET) {
        return 0.3048 * 0.3048;
    }

    if (areaUnits === AreaUnits.SQUARE_INCHES) {
        return 0.0254 * 0.0254;
    }

    if (areaUnits === AreaUnits.SQUARE_YARDS) {
        return 0.9144 * 0.9144;
    }

    if (areaUnits === AreaUnits.SQUARE_MILES) {
        return 1609.344 * 1609.344;
    }

    if (areaUnits === AreaUnits.ACRES) {
        return 4046.85642232;
    }

    if (areaUnits === AreaUnits.HECTARES) {
        return 10000.0;
    }
    // >>includeStart('debug', pragmas.debug);
    throw new DeveloperError(`Invalid area units: ${areaUnits}`);
    // >>includeEnd('debug');
}

const degreesMinutesSecondsRegex = /(-?)(\d+)\s*°\s*(\d+)\s*'\s*([\d.,]+)"\s*([WENS]?)/i;

function convertAngleToRadians(value: number, angleUnits: AngleUnits) {
    if (angleUnits === AngleUnits.RADIANS) {
        return value;
    }

    if (angleUnits === AngleUnits.DEGREES) {
        return CesiumMath.toRadians(value);
    }

    if (angleUnits === AngleUnits.GRADE) {
        if (value === Number.POSITIVE_INFINITY) {
            return CesiumMath.PI_OVER_TWO;
        }
        return Math.atan(value / 100.0);
    }

    if (angleUnits === AngleUnits.RATIO) {
        // Converts to radians where value is rise/run
        return Math.atan(value);
    }

    if (angleUnits === AngleUnits.DEGREES_MINUTES_SECONDS) {
        const matches = degreesMinutesSecondsRegex.exec(value.toString());
        if (!matches) {
            throw new RuntimeError(`Could not convert angle to radians: ${value}`);
        }

        let sign = matches[1].length > 0 ? -1.0 : 1.0;
        const degrees = parseInt(matches[2], 10);
        const minutes = parseInt(matches[3], 10);
        const seconds = parseFloat(matches[4]);
        let cardinal = matches[5];

        if (cardinal.length === 1) {
            cardinal = cardinal.toUpperCase();
            if (cardinal === "W" || cardinal === "S") {
                sign *= -1.0;
            }
        }

        const degreesDecimal = sign * (degrees + minutes / 60.0 + seconds / 3600.0);

        return CesiumMath.toRadians(degreesDecimal);
    }

    // >>includeStart('debug', pragmas.debug);
    throw new DeveloperError(`Invalid angle units: ${angleUnits}`);
    // >>includeEnd('debug');
}

function convertAngleFromRadians(value: number, angleUnits: AngleUnits) {
    if (angleUnits === AngleUnits.RADIANS) {
        return value;
    }

    if (angleUnits === AngleUnits.DEGREES) {
        return CesiumMath.toDegrees(value);
    }

    if (angleUnits === AngleUnits.GRADE) {
        // eslint-disable-next-line no-param-reassign
        value = CesiumMath.clamp(value, 0.0, CesiumMath.PI_OVER_TWO);

        if (value === CesiumMath.PI_OVER_TWO) {
            return Number.POSITIVE_INFINITY;
        }

        return 100.0 * Math.tan(value);
    }

    if (angleUnits === AngleUnits.RATIO) {
        const rise = Math.sin(value);
        const run = Math.cos(value);
        return rise / run;
    }

    // >>includeStart('debug', pragmas.debug);
    throw new DeveloperError(`Invalid angle units: ${angleUnits}`);
    // >>includeEnd('debug');
}

const negativeZero = -0.0;
const positiveZero = 0.0;

function numberToFormattedString(
    number: number,
    selectedLocale?: Intl.LocalesArgument,
    maximumFractionDigits?: number,
    minimumFractionDigits?: number
) {
    // eslint-disable-next-line no-param-reassign
    maximumFractionDigits = defaultValue(maximumFractionDigits, 2);
    // eslint-disable-next-line no-param-reassign
    minimumFractionDigits = defaultValue(minimumFractionDigits, maximumFractionDigits);

    const localeStringOptions = {
        minimumFractionDigits: minimumFractionDigits,
        maximumFractionDigits: maximumFractionDigits
    };

    // If locale is undefined, the runtime's default locale is used.
    const numberString = number.toLocaleString(selectedLocale, localeStringOptions);
    const negativeZeroString = negativeZero.toLocaleString(selectedLocale, localeStringOptions);

    if (numberString === negativeZeroString) {
        return positiveZero.toLocaleString(selectedLocale, localeStringOptions);
    }

    return numberString;
}

function getVolumeUnitConversion(volumeUnits: VolumeUnits) {
    if (volumeUnits === VolumeUnits.CUBIC_METERS) {
        return 1.0;
    }

    if (volumeUnits === VolumeUnits.CUBIC_CENTIMETERS) {
        return 0.000001;
    }

    if (volumeUnits === VolumeUnits.CUBIC_KILOMETERS) {
        return 1000000000.0;
    }

    if (volumeUnits === VolumeUnits.CUBIC_FEET) {
        return 0.3048 * 0.3048 * 0.3048;
    }

    if (volumeUnits === VolumeUnits.CUBIC_INCHES) {
        return 0.0254 * 0.0254 * 0.0254;
    }

    if (volumeUnits === VolumeUnits.CUBIC_YARDS) {
        return 0.9144 * 0.9144 * 0.9144;
    }

    if (volumeUnits === VolumeUnits.CUBIC_MILES) {
        return 1609.344 * 1609.344 * 1609.344;
    }
    // >>includeStart('debug', pragmas.debug);
    throw new DeveloperError(`Invalid volume units: ${volumeUnits}`);
    // >>includeEnd('debug');
}

export class MeasureUnits {
    distanceUnits: DistanceUnits;
    areaUnits: AreaUnits;
    volumeUnits: VolumeUnits;
    angleUnits: AngleUnits;
    slopeUnits: AngleUnits;

    constructor(options: {
        distanceUnits?: DistanceUnits;
        areaUnits?: AreaUnits;
        volumeUnits?: VolumeUnits;
        angleUnits?: AngleUnits;
        slopeUnits?: AngleUnits;
    }) {
        this.distanceUnits = defaultValue(options.distanceUnits, DistanceUnits.METERS);
        this.areaUnits = defaultValue(options.areaUnits, AreaUnits.SQUARE_METERS);
        this.volumeUnits = defaultValue(options.volumeUnits, VolumeUnits.CUBIC_METERS);
        this.angleUnits = defaultValue(options.angleUnits, AngleUnits.DEGREES);
        this.slopeUnits = defaultValue(options.slopeUnits, AngleUnits.DEGREES);
    }

    static convertDistance(distance: number, from: DistanceUnits, to: DistanceUnits) {
        if (from === to) {
            return distance;
        }

        const toMeters = getDistanceUnitConversion(from);
        const fromMeters = 1.0 / getDistanceUnitConversion(to);
        return distance * toMeters * fromMeters;
    }

    static convertArea(area: number, from: AreaUnits, to: AreaUnits) {
        if (from === to) {
            return area;
        }

        const toMeters = getAreaUnitConversion(from);
        const fromMeters = 1.0 / getAreaUnitConversion(to);
        return area * toMeters * fromMeters;
    }

    static convertVolume(volume: number, from: VolumeUnits, to: VolumeUnits) {
        if (from === to) {
            return volume;
        }
        const toMeters = getVolumeUnitConversion(from);
        const fromMeters = 1.0 / getVolumeUnitConversion(to);
        return volume * toMeters * fromMeters;
    }

    static convertAngle(angle: number, from: AngleUnits, to: AngleUnits) {
        if (from === to) {
            return angle;
        }
        const radians = convertAngleToRadians(angle, from);
        return convertAngleFromRadians(radians, to);
    }

    static numberToString(
        number: number,
        selectedLocale?: Intl.LocalesArgument,
        maximumFractionDigits?: number,
        minimumFractionDigits?: number
    ) {
        return numberToFormattedString(number, selectedLocale, maximumFractionDigits, minimumFractionDigits);
    }

    static distanceToString(
        meters: number,
        distanceUnits: DistanceUnits,
        selectedLocale?: Intl.LocalesArgument,
        maximumFractionDigits?: number,
        minimumFractionDigits?: number
    ) {
        const distance = MeasureUnits.convertDistance(meters, DistanceUnits.METERS, distanceUnits);

        return (
            numberToFormattedString(distance, selectedLocale, maximumFractionDigits, minimumFractionDigits) +
            MeasureUnits.getDistanceUnitSpacing(distanceUnits) +
            MeasureUnits.getDistanceUnitSymbol(distanceUnits)
        );
    }

    static areaToString(
        metersSquared: number,
        areaUnits: AreaUnits,
        selectedLocale?: Intl.LocalesArgument,
        maximumFractionDigits?: number,
        minimumFractionDigits?: number
    ) {
        const area = MeasureUnits.convertArea(metersSquared, AreaUnits.SQUARE_METERS, areaUnits);
        return (
            numberToFormattedString(area, selectedLocale, maximumFractionDigits, minimumFractionDigits) +
            MeasureUnits.getAreaUnitSpacing(areaUnits) +
            MeasureUnits.getAreaUnitSymbol(areaUnits)
        );
    }

    static volumeToString(
        metersCubed: number,
        volumeUnits: VolumeUnits,
        selectedLocale?: Intl.LocalesArgument,
        maximumFractionDigits?: number,
        minimumFractionDigits?: number
    ) {
        const volume = MeasureUnits.convertVolume(metersCubed, VolumeUnits.CUBIC_METERS, volumeUnits);
        return (
            numberToFormattedString(volume, selectedLocale, maximumFractionDigits, minimumFractionDigits) +
            MeasureUnits.getVolumeUnitSpacing(volumeUnits) +
            MeasureUnits.getVolumeUnitSymbol(volumeUnits)
        );
    }

    static angleToString(
        angleRadians: number,
        angleUnits: AngleUnits,
        selectedLocale?: Intl.LocalesArgument,
        maximumFractionDigits?: number,
        minimumFractionDigits?: number
    ) {
        if (angleUnits === AngleUnits.DEGREES || angleUnits === AngleUnits.RADIANS || angleUnits === AngleUnits.GRADE) {
            const angle = convertAngleFromRadians(angleRadians, angleUnits);
            return (
                numberToFormattedString(angle, selectedLocale, maximumFractionDigits, minimumFractionDigits) +
                MeasureUnits.getAngleUnitSpacing(angleUnits) +
                MeasureUnits.getAngleUnitSymbol(angleUnits)
            );
        }

        if (angleUnits === AngleUnits.DEGREES_MINUTES_SECONDS) {
            let deg = CesiumMath.toDegrees(angleRadians);
            const sign = deg < 0 ? "-" : "";
            deg = Math.abs(deg);
            const d = Math.floor(deg);
            const minfloat = (deg - d) * 60;
            const m = Math.floor(minfloat);
            const s = (minfloat - m) * 60;
            const s1 = numberToFormattedString(s, undefined, maximumFractionDigits, minimumFractionDigits); // The locale is undefined so that a period is used instead of a comma for the decimal

            return `${sign}${d}° ${m}' ${s1}"`;
        }

        if (angleUnits === AngleUnits.RATIO) {
            const riseOverRun = convertAngleFromRadians(angleRadians, angleUnits);
            const run = 1.0 / riseOverRun;

            return `1:${numberToFormattedString(run, selectedLocale, maximumFractionDigits, 0)}`;
        }

        throw new DeveloperError("Error");
    }

    static longitudeToString(
        longitude: number,
        angleUnits: AngleUnits,
        selectedLocale?: Intl.LocalesArgument,
        maximumFractionDigits?: number,
        minimumFractionDigits?: number
    ) {
        return `${MeasureUnits.angleToString(
            Math.abs(longitude),
            angleUnits,
            selectedLocale,
            maximumFractionDigits,
            minimumFractionDigits
        )} ${longitude < 0.0 ? "W" : "E"}`;
    }

    static latitudeToString(
        latitude: number,
        angleUnits: AngleUnits,
        selectedLocale?: Intl.LocalesArgument,
        maximumFractionDigits?: number,
        minimumFractionDigits?: number
    ) {
        return `${MeasureUnits.angleToString(
            Math.abs(latitude),
            angleUnits,
            selectedLocale,
            maximumFractionDigits,
            minimumFractionDigits
        )} ${latitude < 0.0 ? "S" : "N"}`;
    }

    static getDistanceUnitSymbol(distanceUnits: DistanceUnits) {
        // >>includeStart('debug', pragmas.debug);
        Check.typeOf.string("distanceUnits", distanceUnits);
        // >>includeEnd('debug');

        if (distanceUnits === DistanceUnits.METERS) {
            return "m";
        }
        if (distanceUnits === DistanceUnits.CENTIMETERS) {
            return "cm";
        }
        if (distanceUnits === DistanceUnits.KILOMETERS) {
            return "km";
        }
        if (distanceUnits === DistanceUnits.FEET) {
            return "ft";
        }
        if (distanceUnits === DistanceUnits.US_SURVEY_FEET) {
            return "sft";
        }
        if (distanceUnits === DistanceUnits.INCHES) {
            return "in";
        }
        if (distanceUnits === DistanceUnits.YARDS) {
            return "yd";
        }
        if (distanceUnits === DistanceUnits.MILES) {
            return "mi";
        }
        // >>includeStart('debug', pragmas.debug);
        throw new DeveloperError(`Invalid distance units: ${distanceUnits}`);
        // >>includeEnd('debug');
    }

    static getDistanceUnitSpacing(distanceUnits: DistanceUnits) {
        // >>includeStart('debug', pragmas.debug);
        Check.typeOf.string("distanceUnits", distanceUnits);
        // >>includeEnd('debug');

        return " ";
    }

    static getAreaUnitSymbol(areaUnits: AreaUnits) {
        // >>includeStart('debug', pragmas.debug);
        Check.typeOf.string("areaUnits", areaUnits);
        // >>includeEnd('debug');

        if (areaUnits === AreaUnits.SQUARE_METERS) {
            return "m²";
        }
        if (areaUnits === AreaUnits.SQUARE_CENTIMETERS) {
            return "cm²";
        }
        if (areaUnits === AreaUnits.SQUARE_KILOMETERS) {
            return "km²";
        }
        if (areaUnits === AreaUnits.SQUARE_FEET) {
            return "sq ft";
        }
        if (areaUnits === AreaUnits.SQUARE_INCHES) {
            return "sq in";
        }
        if (areaUnits === AreaUnits.SQUARE_YARDS) {
            return "sq yd";
        }
        if (areaUnits === AreaUnits.SQUARE_MILES) {
            return "sq mi";
        }
        if (areaUnits === AreaUnits.ACRES) {
            return "ac";
        }
        if (areaUnits === AreaUnits.HECTARES) {
            return "ha";
        }
        // >>includeStart('debug', pragmas.debug);
        throw new DeveloperError(`Invalid area units: ${areaUnits}`);
        // >>includeEnd('debug');
    }

    static getAreaUnitSpacing(areaUnits: AreaUnits) {
        // >>includeStart('debug', pragmas.debug);
        Check.typeOf.string("areaUnits", areaUnits);
        // >>includeEnd('debug');

        return " ";
    }

    static getVolumeUnitSymbol(volumeUnits: VolumeUnits) {
        // >>includeStart('debug', pragmas.debug);
        Check.typeOf.string("volumeUnits", volumeUnits);
        // >>includeEnd('debug');

        if (volumeUnits === VolumeUnits.CUBIC_METERS) {
            return "m³";
        }
        if (volumeUnits === VolumeUnits.CUBIC_CENTIMETERS) {
            return "cm³";
        }
        if (volumeUnits === VolumeUnits.CUBIC_KILOMETERS) {
            return "km³";
        }
        if (volumeUnits === VolumeUnits.CUBIC_FEET) {
            return "cu ft";
        }
        if (volumeUnits === VolumeUnits.CUBIC_INCHES) {
            return "cu in";
        }
        if (volumeUnits === VolumeUnits.CUBIC_YARDS) {
            return "cu yd";
        }
        if (volumeUnits === VolumeUnits.CUBIC_MILES) {
            return "cu mi";
        }
        // >>includeStart('debug', pragmas.debug);
        throw new DeveloperError(`Invalid volume units: ${volumeUnits}`);
        // >>includeEnd('debug');
    }

    static getVolumeUnitSpacing(volumeUnits: VolumeUnits) {
        // >>includeStart('debug', pragmas.debug);
        Check.typeOf.string("volumeUnits", volumeUnits);
        // >>includeEnd('debug');

        return " ";
    }

    static getAngleUnitSymbol(angleUnits: AngleUnits) {
        // >>includeStart('debug', pragmas.debug);
        Check.typeOf.string("angleUnits", angleUnits);
        // >>includeEnd('debug');

        if (angleUnits === AngleUnits.DEGREES) {
            return "°";
        }
        if (angleUnits === AngleUnits.RADIANS) {
            return "rad";
        }
        if (angleUnits === AngleUnits.GRADE) {
            return "%";
        }
        // >>includeStart('debug', pragmas.debug);
        throw new DeveloperError(`Invalid angle units: ${angleUnits}`);
        // >>includeEnd('debug');
    }

    static getAngleUnitSpacing(angleUnits: AngleUnits) {
        // >>includeStart('debug', pragmas.debug);
        Check.typeOf.string("angleUnits", angleUnits);
        // >>includeEnd('debug');

        if (angleUnits === AngleUnits.RADIANS) {
            return " ";
        }

        return "";
    }
}
