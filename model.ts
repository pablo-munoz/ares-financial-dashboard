/**
 * Shared Quantitative Model (ALPHA V4.0)
 * Centralizes the Beta Distribution Fair Value and True Kelly logic
 * to ensure consistency between live signals and backtesting.
 */

export interface AlphaSignalInputs {
    executionPrice: number;
    longVwap: number;
    yesNotion: number;
    noNotion: number;
    sharpShift: number; // Insider/Sharp direction
    sectorBias: number; // Historical category calibration
    isSports: boolean;
}

export interface AlphaSignalOutputs {
    fairValue: number;
    edge: number;
    ev: number;
    kellyStake: number;
}

/**
 * Calculates Alpha Signal metrics using Beta Distribution and True Kelly.
 */
export function calculateAlphaSignal(inputs: AlphaSignalInputs): AlphaSignalOutputs {
    const {
        executionPrice,
        longVwap,
        yesNotion,
        noNotion,
        sharpShift,
        sectorBias,
        isSports
    } = inputs;

    // 1. Beta Distribution Fair Value Model
    // Prior weight (N=50) anchors the distribution to the historical VWAP
    const priorWeight = 50;
    const alphaPrior = priorWeight * (Number(longVwap) || executionPrice) + 1;
    const betaPrior = priorWeight * (1 - (Number(longVwap) || executionPrice)) + 1;

    // 2. Order Flow Imbalance (Beta Update)
    // Scale order flow to prevent single-whale bias (log scale)
    const alphaVotes = Math.log1p(Math.max(0, Number(yesNotion) || 0)) * 5;
    const betaVotes = Math.log1p(Math.max(0, Number(noNotion) || 0)) * 5;

    let baseFair = (alphaPrior + alphaVotes) / (alphaPrior + betaPrior + alphaVotes + betaVotes);

    // Fallback if NaN
    if (isNaN(baseFair)) baseFair = executionPrice;

    // 3. Assemble Fair Value with Gravity Constraint
    const rawFair = baseFair + (Number(sharpShift) || 0) + (Number(sectorBias) || 0);

    // Gravity Constraint: prevent extreme outlier predictions in efficient/volatile markets
    const maxDeviation = isSports ? 0.10 : 0.15;
    const gravityFair = Math.min(
        executionPrice + maxDeviation,
        Math.max(executionPrice - maxDeviation, rawFair)
    );

    let fairValue = Math.min(0.99, Math.max(0.01, gravityFair));
    if (isNaN(fairValue)) fairValue = executionPrice;

    // 4. True Kelly Criterion for Binary Options
    const edge = fairValue - executionPrice;
    const halfKelly = 0.5;
    let kellyStakeRaw = 0;

    if (edge > 0) {
        // YES Bet: f* = (p - price) / (1 - price)
        kellyStakeRaw = halfKelly * (edge / (1 - executionPrice));
    } else if (edge < 0) {
        // NO Bet (synthetic YES bet on NO outcome): f* = ( (1-p) - (1-price) ) / (1 - (1-price))
        // which simplifies to abs(edge) / price
        kellyStakeRaw = halfKelly * (Math.abs(edge) / executionPrice);
    }

    // Bound to 10% max portfolio risk
    const kellyStake = Math.max(0, Math.min(10, kellyStakeRaw * 100));
    const ev = Number((edge * 100).toFixed(1));

    return {
        fairValue,
        edge,
        ev,
        kellyStake
    };
}
