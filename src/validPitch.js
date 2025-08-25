/* eslint-disable */
// q@ts-nocheck

const MAX_PITCH_IN_DEGREE = 88;

function validPitch(pitch) {
    if (pitch > MAX_PITCH_IN_DEGREE * 2 && pitch < 360 - MAX_PITCH_IN_DEGREE) {
        return 360 - MAX_PITCH_IN_DEGREE;
    }

    if (pitch > MAX_PITCH_IN_DEGREE && pitch < 360 - MAX_PITCH_IN_DEGREE) {
        return MAX_PITCH_IN_DEGREE;
    }

    return pitch;
}

export { validPitch };
