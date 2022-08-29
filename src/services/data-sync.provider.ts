import { Injectable } from "@nestjs/common";
import { config } from "../config";
import { getLastProcessedBlock, startTrimLastBlocksTask } from "../entities/last-block.entity";
import { savePair, savePairLp, saveReserves } from "../entities/pair.entity";
import { IKvp } from "../types";
import { getLatestSyncedBlock, syncTradeHistory, fillBlocksSinceSync, syncAmmCurrentState } from "../utils/blockservice-utils";
import { createHistoricalCandles } from "../utils/candle-utils";
import { log } from "../utils/logger";
import { initSocket, BlockDTO } from "./socket-client.provider";

@Injectable()
export class DataSyncProvider {
	private token_contract_list: string[] = []

	async onModuleInit() {
		const last_block_saved_db = await getLastProcessedBlock();
		const latest_synced_block_bs = await getLatestSyncedBlock();
		const start_sync_block = last_block_saved_db || latest_synced_block_bs;

		if (!last_block_saved_db) {
			await syncAmmCurrentState();
			await syncTradeHistory();
			await createHistoricalCandles()
			
		} else {
			log.log(`last block detected in local db.`);
			log.log(`starting block sync from block ${start_sync_block}`);
		}

		await fillBlocksSinceSync(start_sync_block, this.parseBlock);

		initSocket(this.parseBlock);

		startTrimLastBlocksTask();
		// await createHistoricalCandles()

	}


	/**
	 * ALL NEW BLOCKS ARE PASSED THROUGH THIS FUNCTION FOR PROCESSING
	 */

	public parseBlock = async (block: BlockDTO) => {
		const { state, fn, contract: contract_name, timestamp, hash } = block;

		try {
			/**
			 * Check if the state change object 
			 */
		} catch (err) {
			log.log({ err })
		}
	};

	processAmmBlock = async (args: { fn: string; state: IKvp[]; timestamp: number; hash: string }) => {
		const { fn, state, timestamp, hash } = args;
		try {
			await savePair({
				state,
			});
			await savePairLp(state);
			await saveReserves(
				fn,
				state,
				timestamp,
				hash,
				config.amm_native_token
			);
		} catch (err) {
			log.log({ err })
		}
	}
}