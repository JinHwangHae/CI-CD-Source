/* qeslint-disable */
// q@ts-nocheck

export enum AngleUnits {
    DEGREES = "DEGREES",
    RADIANS = "RADIANS",
    DEGREES_MINUTES_SECONDS = "DEGREES_MINUTES_SECONDS",
    GRADE = "GRADE",
    RATIO = "RATIO"
}

export function getAngleFractionDigits(angleUnit: AngleUnits) {
    let angleFractionDigits = 0;

    if (angleUnit === AngleUnits.DEGREES) {
        angleFractionDigits = 8;
    } else if (angleUnit === AngleUnits.DEGREES_MINUTES_SECONDS) {
        angleFractionDigits = 5;
    }

    return angleFractionDigits;
}
