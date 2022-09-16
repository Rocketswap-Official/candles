import { BaseEntity, Between, MoreThan } from "typeorm";
import { candle_resolutions, max_precision } from "../config";
import { CandleMetaEntity } from "../entities/candle-meta.entity";
import { CandleEntity, constructCandleId } from "../entities/candle.entity";
import { TradeHistoryEntity } from "../entities/trade-history.entity";
import { DataSyncProvider } from "../services/data-sync.provider";
import { T_Resolution } from "../types";
import { log } from "./logger";

export async function createHistoricalCandles() {
    /**
     * 1. Get all pair contract names
     * 2. Cycle through each contract creating candle data for 
     */

    const contract_names = DataSyncProvider.token_list
    // const contract_names = ['con_lusd_lst001', 'con_rswp_lst001']

    log.log({ contract_names: contract_names.length })


    // await fillCandles("con_lusd_lst001")
    for (let [i, c] of contract_names.entries()) {
        log.log(`filling candles for ${c}, ${i} of ${contract_names.length - 1}`)
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
    const largest_resolution_seconds = calcSecondsInResolution(largest_resolution)

    const starting_epoch_largest_res = Math.ceil(first_trade.time / largest_resolution_seconds)
    const largest_res_number_of_epochs = Math.ceil((Date.now() / 1000) - first_trade.time) / largest_resolution_seconds

    let highest_precision = 0
    let last_price_in_greater_epoch = 0

    for (let i = 0; i < largest_res_number_of_epochs; i++) {
        const current_epoch_largest_res = starting_epoch_largest_res + i

        /**
         * We should add an offset here to start the week at 00:00 Monday
         */
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

            const resolution_seconds = calcSecondsInResolution(resolution)

            const starting_epoch = Math.ceil(current_epoch_largest_res_start_time / resolution_seconds)
            const number_of_epochs = Math.ceil(largest_resolution_seconds / resolution_seconds)

            const candles: CandleEntity[] = []


            for (let e = 0; e < number_of_epochs; e++) {
                /**
                 * Create candle if it commenced before now
                 */
                const current_epoch = starting_epoch + e
                const epoch_start_time = current_epoch * resolution_seconds

                if (Date.now() / 1000 > epoch_start_time) {
                    const candle = new CandleEntity()

                    const candle_start_time = current_epoch * resolution_seconds
                    const candle_end_time = candle_start_time + resolution_seconds

                    candle.id = constructCandleId(contract_name, resolution, current_epoch)
                    candle.time = candle_start_time
                    candle.contract_name = contract_name
                    candle.resolution = resolution
                    candle.epoch = current_epoch
                    candle.open = last_price_in_epoch
                    candle.last = last_price_in_epoch

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

async function getFirstTrade(contract_name: string): Promise<TradeHistoryEntity> {
    return await TradeHistoryEntity.findOne({ where: { contract_name }, order: { time: "ASC" } })
}

export const calcSecondsInResolution = (resolution: T_Resolution): number => {
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


export const saveCandleUpdate = async (args: { contract_name: string, type: "buy" | "sell", volume: number, price: number }, resolutions: T_Resolution[]) => {
    /**
     * Update the latest CandleEntity for each resolution with the latest trade info.
     */

    const { contract_name, volume, price } = args

    const queries = resolutions.map(r => CandleEntity.findOne({ where: { resolution: r, contract_name }, order: { epoch: "DESC" } }))
    const candle_entities = await Promise.all(queries)

    // log.log({ candle_entities })

    for (let c of candle_entities) {
        log.log(`updating candle with trade for ${c.contract_name} in ${c.resolution} timeframe`)
        if (price < c.low) c.low = price
        else if (price > c.high) c.high = price
        c.last = price
        c.close = price
        c.volume += volume
    }
    // log.log({ candle_entities })
    await CandleEntity.save(candle_entities)
}

export const fillCandlesSinceBlockCatchup = async () => {

    /**
     * 1. Get the newest by time, most precise resolution candle in the DB - this is the candle we must build from
     * 2. Figure out if this should be the active candle (epoch * resolution_seconds + resolution_seconds > Date.now())
     * 3. if yes, start method in the candle creation service.
     * 4. if not, we construct each candle epoch until we're up to date.
     */

    const timeframes_to_sync: { resolution: T_Resolution, epoch: number, resolution_seconds: number }[] = []

    for (let r of candle_resolutions) {
        const resolution_seconds = calcSecondsInResolution(r)
        /**
         * Line below assumes that all candles for timeframe are up to date on same epoch.
         * it's probably not a bad idea to check each candle is correct in a computationally expensive way ?
         */

        /**
         * Get the most epoch candle from any pair for this timeframe. This assumes that all pairs have an up to date candle.
         */

        let most_recent_res_candle = await CandleEntity.findOne({ where: { resolution: r }, order: { epoch: "DESC" } })
        // log.log({ most_recent_res_candle })
        const is_active_candle = (most_recent_res_candle.epoch * resolution_seconds) + resolution_seconds >= (Date.now() / 1000)
        log.log({ is_active_candle })
        if (is_active_candle) await fillThisTimeFrame(most_recent_res_candle)
        else timeframes_to_sync.push({ resolution: r, epoch: most_recent_res_candle.epoch, resolution_seconds })
    }

    if (!timeframes_to_sync.length) return

    const candles_to_create = []

    for (let t of timeframes_to_sync) {
        const last_candles = await getLatestCandlesInEpoch(t.resolution)
        log.log({ last_candles: last_candles.map(c => `${c.contract_name} ${c.epoch}`) })

        const resolution_seconds = t.resolution_seconds
        const any_candle = last_candles[0]
        const all_trades_in_timeframe = await TradeHistoryEntity.find({ where: { time: Between(any_candle.time, any_candle.time + resolution_seconds) } })

        log.log({ last_candles_length: last_candles.length })

        for (let c of last_candles) {
            const new_candle = new CandleEntity()

            const epoch = c.epoch + 1

            new_candle.id = constructCandleId(c.contract_name, t.resolution, epoch)

            new_candle.contract_name = c.contract_name
            new_candle.epoch = epoch
            new_candle.time = c.time + resolution_seconds

            new_candle.open = c.close
            new_candle.high = c.close
            new_candle.low = c.close
            new_candle.close = c.close
            new_candle.last = c.close
            new_candle.volume = 0

            const trades = all_trades_in_timeframe.filter(t => t.contract_name === c.contract_name)

            trades.forEach(t => {
                if (t.price > new_candle.high) new_candle.high = t.price
                else if (t.price < new_candle.low) new_candle.low = t.price

                new_candle.close = t.price
                new_candle.last = t.price
                new_candle.volume += Number(t.amount)
            })

            candles_to_create.push(new_candle.save())
        }
    }
    await CandleEntity.insert(candles_to_create)

    return await fillCandlesSinceBlockCatchup()
}


const fillThisTimeFrame = async (most_recent_candle: CandleEntity) => {
    /**
     * This function is probably where the misbehaving is occuring - we need to get a list of all the pairs and create a candle of this resultion for each of them.
     */
    log.log(`filling candle for most_recent_candle : ${most_recent_candle.contract_name}, ${most_recent_candle.resolution}, ${most_recent_candle.epoch}, ${new Date(most_recent_candle.epoch * calcSecondsInResolution(most_recent_candle.resolution) * 1000)}`)

    const candle_time = most_recent_candle.time
    const candle_resolution = most_recent_candle.resolution
    const trades_in_timeframe = await TradeHistoryEntity.find({ where: { time: MoreThan(candle_time) } })
    const candles = await getLatestCandlesInEpoch(candle_resolution)

    for (let c of candles) {
        trades_in_timeframe.filter(t => t.contract_name = c.contract_name).forEach(t => {
            if (t.price > c.high) c.high = t.price
            else if (t.price < c.low) c.low = t.price
            c.close = t.price
            c.last = t.price
            c.volume += Number(t.amount)
        })
        // log.log(`updated ${c.contract_name} for resolution ${c.resolution}`)
    }
    await CandleEntity.save(candles)
}

const getLatestCandlesInEpoch = async (resolution: T_Resolution): Promise<CandleEntity[]> => {
    log.log(`getting latest candles in epoch for ${resolution}`)
    const contract_names: string[] = DataSyncProvider.token_list
    const candles = await CandleEntity.find({ where: { resolution }, order: { epoch: "DESC" }, take: 1 })
    // log.log({
    //     candles: candles.reduce((accum, candle) => {
    //         accum[candle.contract_name] = accum[candle.contract_name] ? accum[candle.contract_name]++ : 1
    //         return accum
    //     }, {})
    // })
    log.log(candles)
    log.log({ [`candles_in_latest_${resolution}`]: Object.keys(candles).length })
    return candles
}

export const removeCandleEntity = async () => {
    log.log(`removing CandleEntity`)
    // await removeTable(CandleEntity)
    await CandleEntity.clear()
    log.log(`removed CandleEntity`)
}

export const seconds_map = {
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800
}

export const initCandleCreationTimer = async (resolutions: T_Resolution[]) => {
    /** 
     * Starts the ball rolling on periodic candle creation
     */

    for (let r of resolutions) {
        const last_candle_created_in_res = await CandleEntity.findOne({ where: { resolution: r }, order: { epoch: "DESC" } })
        createCandleTimerForEpoch(r, last_candle_created_in_res.epoch + 1)
    }
}

const createCandleTimerForEpoch = async (resolution: T_Resolution, next_epoch: number) => {
    /**
     * recursive timer to create more candles indefinitely
     */
    const execution_time_ms = (next_epoch * calcSecondsInResolution(resolution)) * 1000
    const ms_until_execution = execution_time_ms - Date.now()

    setTimeout(async () => {
        await createCandlesForResolution(resolution, next_epoch)
    }, ms_until_execution)
}

const createCandlesForResolution = async (resolution: T_Resolution, next_epoch: number) => {
    const contract_names = DataSyncProvider.token_list
    const candles_to_create: Promise<CandleEntity>[] = []
    const previous_candles = await CandleEntity.find({ where: { resolution }, order: { epoch: "DESC" }, take: contract_names.length })

    for (let last_candle of previous_candles) {
        const new_candle = new CandleEntity()

        new_candle.open = last_candle.close
        new_candle.low = last_candle.close
        new_candle.high = last_candle.close
        new_candle.close = last_candle.close
        new_candle.last = last_candle.close
        new_candle.epoch = next_epoch

        new_candle.volume = 0

        candles_to_create.push(new_candle.save())
    }

    await Promise.all(candles_to_create)

    return await createCandleTimerForEpoch(resolution, next_epoch + 1)
}
