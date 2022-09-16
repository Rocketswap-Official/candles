import { Injectable } from "@nestjs/common";
import { candle_resolutions, getConfig } from "../config";
import { getLastProcessedBlock, startTrimLastBlocksTask } from "../entities/last-block.entity";
import { getTokenList, PairEntity, savePair, updatePairReserves } from "../entities/pair.entity";
import { saveTradeUpdate } from "../entities/trade-history.entity";
import { I_Kvp } from "../types";
import { getLatestSyncedBlock, syncTradeHistory, fillBlocksSinceSync, syncAmmCurrentState } from "../utils/blockservice-utils";
import { createHistoricalCandles, fillCandlesSinceBlockCatchup, removeCandleEntity, saveCandleUpdate } from "../utils/candle-utils";
import { log } from "../utils/logger";
import { checkCandlesExistForAllPairs, countPairsWithHistoricalTrade, getVal, getValue } from "../utils/misc-utils";
import { initSocket, BlockDTO } from "./socket-client.provider";

@Injectable()
export class DataSyncProvider {
	private static token_contract_list: string[] = []

	public static get token_list() {
		return DataSyncProvider.token_contract_list
	}

	public static updateTokenList = async (): Promise<void> => {
		const token_list_update = await getTokenList();
		DataSyncProvider.token_contract_list = token_list_update;
	};


	async onModuleInit() {
		// await removeCandleEntity()

		const last_block_saved_db = await getLastProcessedBlock();
		const latest_synced_block_bs = await getLatestSyncedBlock();
		const start_sync_block = last_block_saved_db || latest_synced_block_bs;

		if (!last_block_saved_db) {
			await syncAmmCurrentState();
			await DataSyncProvider.updateTokenList()
			await syncTradeHistory();
			await createHistoricalCandles()
			// const count = await countPairsWithHistoricalTrade()
			// const candles_exist_for_pairs = await checkCandlesExistForAllPairs()
			// log.log({ count })
			// log.log(candles_exist_for_pairs)
			// log.log(Object.keys(candles_exist_for_pairs).length)
		} else {
			log.log(`last block detected in local db.`);
			log.log(`starting block sync from block ${start_sync_block}`);
		}

		await DataSyncProvider.updateTokenList()
		// await createHistoricalCandles()

		await fillBlocksSinceSync(start_sync_block, this.parseHistoricalBlock);
		// await fillCandlesSinceBlockCatchup()

		initSocket(this.parseBlock);
		startTrimLastBlocksTask();
		// const count = await countPairsWithHistoricalTrade()
		// log.log({ count })
		// const candles_exist_for_pairs = await checkCandlesExistForAllPairs()
		// log.log(candles_exist_for_pairs)
		// log.log(Object.keys(candles_exist_for_pairs).length)
	}


	/**
	 * ALL NEW BLOCKS ARE PASSED THROUGH THIS FUNCTION FOR PROCESSING
	 */

	public parseBlock = async (block: BlockDTO) => {
		const { state, fn, timestamp, hash } = block;
		try {
			/**
			 * Transactions we're interested in :
			 * 1. New pairs being added
			 * 2. Trades
			 * 3. Changes to the reserves of a pair
			 */
			const amm_state_changes = state.filter((s) => s.key.split(".")[0] === getConfig().amm_contract)
			if (!amm_state_changes.length) return

			await this.processAmmBlock({
				state: amm_state_changes
			});
		} catch (err) {
			log.log({ err })
		}
	};


	public parseHistoricalBlock = async (block: BlockDTO) => {
		/** 
		 * This method is to process the catchup blocks without processing the trades into candles
		 * Trades are organised into candles from these transactions afterwards.
		 */
		const { state } = block;

		const amm_state_changes = state.filter((s) => s.key.split(".")[0] === getConfig().amm_contract)
		if (!amm_state_changes.length) return

		try {
			await savePair({
				state,
			});
			await saveTrade(state, false)
			await updatePairReserves(state)
		} catch (err) {
			log.log({ err })
		}
	}


	processAmmBlock = async (args: { state: I_Kvp[] }) => {
		const { state } = args;
		try {
			/**
			 * TO-DO :
			 * if a new pair is created, we must create a genesis candle for it as well.
			 */
			await savePair({
				state,
			});
			await DataSyncProvider.updateTokenList()
			await saveTrade(state, true)
			await updatePairReserves(state)
		} catch (err) {
			log.log({ err })
		}
	}
}

const saveTrade = async (state: I_Kvp[], save_candle: boolean = true) => {
	const traded_tokens = state.filter(s => s.key.includes("prices"))
	if (!traded_tokens.length) return
	for (let token of traded_tokens) {
		const contract_name = token.key.split(":")[1]
		const price = getVal(traded_tokens.find(s => s.key.includes(contract_name)))
		const reserves = state.find(s => s.key.includes('reserves') && s.key.includes(contract_name)).value
		await processTrade(contract_name, reserves, price, save_candle)
	}
}

const processTrade = async (contract_name: string, reserves: any[], price: string, save_candle: boolean) => {
	const pair = await PairEntity.findOne(contract_name)
	const pair_reserves_old = [Number(pair.reserves[0]), Number(pair.reserves[1])]
	const pair_reserves_new = [Number(getValue(reserves[0])), Number(getValue(reserves[1]))]

	// log.log({ pair_reserves_old, pair_reserves_new })

	// determine if buy or sell
	const type: "buy" | "sell" = pair_reserves_old[0] < pair_reserves_new[0] ? "buy" : "sell"

	// get volume
	const dif = pair_reserves_old[1] - pair_reserves_new[1]
	const volume = dif > 0 ? dif : dif * -1
	// log.log({ volume })
	// save trade
	await saveTradeUpdate({ contract_name, price, amount: String(volume), type, time: Date.now() })
	if (save_candle) {
		await saveCandleUpdate({ contract_name, type, volume, price: Number(price) }, candle_resolutions)
	}
}
