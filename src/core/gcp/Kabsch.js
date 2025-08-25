/* qeslint-disable */
// q@ts-nocheck

// https://en.m.wikipedia.org/wiki/Kabsch_algorithm

import SVD from "./svd";

function getCentroid(positions) {
    let centerX = 0;
    let centerY = 0;
    let centerZ = 0;

    for (let i = 0; i < positions.length; i++) {
        const x = positions[i][0];
        const y = positions[i][1];
        const z = positions[i][2];

        centerX += x;
        centerY += y;
        centerZ += z;
    }

    centerX /= positions.length;
    centerY /= positions.length;
    centerZ /= positions.length;

    return [centerX, centerY, centerZ];
}

function getTranslatedPositions(positions, translation) {
    const ret = [];

    for (let i = 0; i < positions.length; i++) {
        const x = positions[i][0];
        const y = positions[i][1];
        const z = positions[i][2];

        const offsetX = translation[0];
        const offsetY = translation[1];
        const offsetZ = translation[2];

        ret.push([x + offsetX, y + offsetY, z + offsetZ]);
    }

    return ret;
}

function multiply(a, b) {
    const aNumRows = a.length;
    const aNumCols = a[0].length;
    const bNumCols = b[0].length;
    const m = new Array(aNumRows); // initialize array of rows

    for (let r = 0; r < aNumRows; ++r) {
        m[r] = new Array(bNumCols); // initialize the current row

        for (let c = 0; c < bNumCols; ++c) {
            m[r][c] = 0; // initialize the current cell
            for (let i = 0; i < aNumCols; ++i) {
                m[r][c] += a[r][i] * b[i][c];
            }
        }
    }

    return m;
}

function transpose(matrix) {
    return matrix[0].map((col, i) => matrix.map((row) => row[i]));
}

// calculate the optimal rotation matrix that turns P(centered at origin)
// as close as possible to Q(centered at origin) in terms of some metric

function calcRotationMatrix(P, Q) {
    // compute of the covariance matrix
    const H = multiply(transpose(Q), P);

    // calc the Singular Value Decomposition of H
    const svdH = SVD(H);

    return multiply(svdH.v, transpose(svdH.u));
}

export { calcRotationMatrix, getCentroid, getTranslatedPositions, multiply };
