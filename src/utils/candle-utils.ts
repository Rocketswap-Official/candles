import { Between } from "typeorm";
import { candle_resolutions, max_precision } from "../config";
import { CandleMetaEntity } from "../entities/candle-meta.entity";
import { CandleEntity } from "../entities/candle.entity";
import { PairEntity } from "../entities/pair.entity";
import { TradeHistoryEntity } from "../entities/trade-history.entity";
import { T_Resolution } from "../types";
import { log } from "./logger";

export async function createHistoricalCandles() {
    /**
     * 1. Get all pair contract names
     * 2. Cycle through each contract creating candle data for 
     */

    const pairs = await PairEntity.find()

    const contract_names = pairs.map(p => p.contract_name)

    for (let [i, c] of contract_names.entries()) {
        log.log(`filling candles for ${c}, ${i} of ${contract_names.length -1}`)
        await fillCandles(c)
    }
}

async function fillCandles(contract_name: string) {
    /**
     * 1. Get first trade
     * 2. Figure out it's starting Epoch
     * 3. Get the longest chosen Epoch (1w for example)
     * 4. Get all trades within that Epoch
     * 5. Process the Epoch and all the sub-epochs (1d down to 15m)
     * 6. Get all the trades in the next longest Epoch, Do the same until finished.
     */

    const first_trade = await getFirstTrade(contract_name)
    if (!first_trade) {
        log.log(`no first trade found for ${contract_name}`)
        return
    }
    const largest_resolution = candle_resolutions[candle_resolutions.length - 1]
    const largest_resolution_seconds = getSecondsResolution(largest_resolution)

    const starting_epoch_largest_res = Math.trunc(first_trade.time / largest_resolution_seconds)
    const largest_res_number_of_epochs = ((Date.now() / 1000) - first_trade.time) / largest_resolution_seconds

    let highest_precision = 0
    let last_price_in_greater_epoch = 0

    for (let i = 0; i <= largest_res_number_of_epochs; i++) {
        const current_epoch_largest_res = starting_epoch_largest_res + i

        const current_epoch_largest_res_start_time = current_epoch_largest_res * largest_resolution_seconds

        /**
         * 1. Query all trades within largest Epoch (1w)
         * 2. Process this epoch
         * 3. Process all child epochs (3d, 1d, 8h etc)
         */

        const all_trades_in_largest_res_epoch = await getTradesInEpoch(contract_name, current_epoch_largest_res, largest_resolution_seconds)

        /**
         * Iterate over timeframes and create candles in epoch
         */


        for (let r = 0; r < candle_resolutions.length; r++) {
            const resolution = candle_resolutions[r]
            let last_price_in_epoch: number = i === 0 ? 0 : last_price_in_greater_epoch

            const resolution_seconds = getSecondsResolution(resolution)

            const starting_epoch = Math.trunc(current_epoch_largest_res_start_time / resolution_seconds)
            const number_of_epochs = Math.trunc(largest_resolution_seconds / resolution_seconds)

            const candles: CandleEntity[] = []


            for (let e = 0; e < number_of_epochs; e++) {
                /**
                 * Create candle
                 */

                const current_epoch = starting_epoch + e

                const candle = new CandleEntity()

                const candle_start_time = current_epoch * resolution_seconds
                const candle_end_time = candle_start_time + resolution_seconds

                candle.time = candle_start_time
                candle.contract_name = contract_name
                candle.resolution = resolution
                candle.epoch = current_epoch
                candle.open = last_price_in_epoch

                const trades_in_epoch = all_trades_in_largest_res_epoch.filter((t) =>
                    t.time >= candle_start_time && t.time < candle_end_time
                )

                for (let x = 0; x < trades_in_epoch.length; x++) {
                    const t = trades_in_epoch[x]
                    // if (x === 0) candle.open = t.price
                    candle.volume += Number(t.amount)
                    candle.low = candle.low < t.price ? candle.low : t.price
                    candle.high = candle.high > t.price ? candle.high : t.price

                    /**
                     * Last trade in epoch
                     */
                    if (x === trades_in_epoch.length - 1) {
                        candle.close = t.price
                        last_price_in_epoch = t.price
                    }
                }

                if (!trades_in_epoch.length) {
                    candle.open = last_price_in_epoch
                    candle.close = last_price_in_epoch
                    candle.low = last_price_in_epoch
                    candle.high = last_price_in_epoch
                    candle.volume = 0
                }

                /**
                 * Candle Precision will tell the UI how many decimal places to display for the price.
                 * should double check this is necessary.
                 */

                let candle_precision = getCandlePrecision([candle.open, candle.close, candle.high, candle.low], max_precision)
                highest_precision = candle_precision > highest_precision ? candle_precision : highest_precision
                candles.push(candle)
            }
            await CandleEntity.insert(candles)
            if (r === candle_resolutions.length - 1) last_price_in_greater_epoch = last_price_in_epoch
        }
    }

    let candle_meta_entity = await CandleMetaEntity.findOne(contract_name)
    if (!candle_meta_entity) candle_meta_entity = new CandleMetaEntity()
    candle_meta_entity.contract_name = contract_name
    candle_meta_entity.precision = highest_precision
    await candle_meta_entity.save()
}

function getCandlePrecision(ohlc: number[], max_precision: number = 10) {
    // log.log({ohlc}, max_precision)
    let highest_precision = 0
    ohlc.forEach((price) => {
        const str = price.toFixed(max_precision)
        const parts = str.split(".")
        if (parts[1].length > highest_precision) highest_precision = parts[1].length
    })
    return highest_precision > max_precision ? max_precision : highest_precision
}

async function getTradesInEpoch(contract_name: string, epoch: number, resolution_seconds: number) {
    const start_time = epoch * resolution_seconds
    const end_time = start_time + resolution_seconds
    return await TradeHistoryEntity.find({ where: { contract_name, time: Between(start_time, end_time) } })
}

async function getFirstTrade(contract_name: string) {
    return await TradeHistoryEntity.findOne({ where: { contract_name } })
}

const getSecondsResolution = (resolution: T_Resolution) => {
    const suffix = resolution[resolution.length - 1]
    const prefix = Number(resolution.substring(0, resolution.length - 1))
    return prefix * seconds_map[suffix]
}

export const stringToFixed = (value, precision) => {
    if (!value) return "0.0"
    try {
        var values = value.split('.')
    } catch {
        var values = value.toString().split('.')
    }
    if (!values[1]) return value
    else {
        if (values[1].length < precision) precision = values[1].length
        let decValue = parseInt(values[1].substring(0, precision))
        if (decValue === 0) return `${values[0]}`
        else {
            let decimals = values[1].substring(0, precision)
            for (let i = precision - 1; i >= 0; i--) {
                if (decimals[i] === '0') precision -= 1
                else i = -1
            }
            return `${values[0]}.${values[1].substring(0, precision)}`
        }
    }
}

export const seconds_map = {
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800
}