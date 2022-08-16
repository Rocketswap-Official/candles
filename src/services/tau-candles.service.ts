import { Injectable } from '@nestjs/common';

/**
 * This service contains methods for creating candledata from 
 */

@Injectable()
export class TauCandlesService {
    constructor() { }

    private syncHistoricalTauUsdPrice() {
        /**
         * Get historical TAU-USD price (from today going back 600 days)
         * https://api.coingecko.com/api/v3/coins/lamden/market_chart?vs_currency=usd&days=600&interval=daily
         * we may want to add some transformation to this, map each value to a date
         * go to the LUSD pair and figure out the first day of trading there
         * fill in the period of time between the start of LUSD and the start of rocketswap with the historical coingecko data.
         * etc and so on....
         */ 
    }

    private createHistoricalDataForTicker() {
        /**
         * 1. Find first trade for pair
         * 2. identify which candle this fits in on all supported timeframes 1h / 4h / etc 
         * NB - Start with one timeframe to begin with, then expand it.
         * 3. iterate through all trades up until present, for each subsequent trade check which candle it belongs to and backfill any previous candles.
         */
    }

    private finaliseCandle(timeframe: T_Timeframe) {
        /**
         * To be called at the end of a candle which finalises the close of the current candle and defines the open of a new candle.
         */
    }

    private updateCandleValue(contract_name:string, price: number, volume: number) {

    }

    private processTrade(contract_name:string, price: number, volume: number, type: T_TradeType) {
        /**
         * Takes a parsed trade from the blockservice and saves the trade locally.
         */
    }
}
