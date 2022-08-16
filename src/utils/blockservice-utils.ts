import { config } from "../config";
import { PairEntity } from "../entities/pair.entity";
import { getTokenData, saveToken } from "../entities/token.entity";
import { parseTrades, saveTradesToDb } from "../entities/trade-history.entity";
import { BlockService } from "../services/block.service";
import { handleNewBlock, T_ParseBlockFn } from "../services/socket-client.provider";
import { log } from "./logger";
import { getValue, validateTokenContract } from "./misc-utils";

const axiosDefaultConfig = {
	proxy: false
};

const axios = require("axios").create(axiosDefaultConfig);

export const getVariableChanges = async (contractName: string, variableName: string, last_tx_uid: string | number, limit: number = 10) => {
	let endpoint = "variable_history";
	let query = [`contract=${contractName}`, `variable=${variableName}`, `last_tx_uid=${last_tx_uid}`, `limit=${limit}`].join("&");
	let res = await axios.get(`http://${BlockService.get_block_service_url()}/${endpoint}?${query}`);
	return res.data;
};

export const getCurrentKeyValue = async (contractName: string, variableName: string, key: string) => {
	try {
		let endpoint = "current/one";
		let res = await axios(`http://${BlockService.get_block_service_url()}/${endpoint}/${contractName}/${variableName}/${key}`);
		return res.data;
	} catch (e) {
		return e;
	}
};

export const getContractChanges = async (contractName: string, last_tx_uid: string, limit: number = 10) => {
	let endpoint = "contract_history";
	let query = [`contract=${contractName}`, `last_tx_uid=${last_tx_uid}`, `limit=${limit}`].join("&");
	let res = await axios(`http://${BlockService.get_block_service_url()}/${endpoint}?${query}`);
	return res.data;
};

export const getContractState = async (contractName: string) => {
	try {
		let endpoint = "current/all";
		// current/all/con_mint
		const url = `http://${BlockService.get_block_service_url()}/${endpoint}/${contractName}`;
		let res = await axios(url);
		return res.data;
	} catch (err) {
		log.warn(err);
	}
};

export const getRootKeyChanges = async (args: {
	contractName: string;
	variableName: string;
	root_key: string;
	last_tx_uid: number | string;
	limit: number;
}) => {
	try {
		const { contractName, variableName, root_key, last_tx_uid, limit } = args;
		let endpoint = "rootkey_history";
		let query = [
			`contract=${contractName}`,
			`variable=${variableName}`,
			`root_key=${root_key}`,
			`last_tx_uid=${last_tx_uid}`,
			`limit=${limit}`
		].join("&");
		let res = await axios.get(`http://${BlockService.get_block_service_url()}/${endpoint}?${query}`);
		return res.data;
	} catch (err) {
		log.warn(err);
	}
};

export async function getCurrentSyncedBlock() {
	const res = await axios.get(`http://${BlockService.get_block_service_url()}/latest_synced_block`);
	return res.latest_synced_block;
}

export const getNumberFromFixed = (value: any) => (value.__fixed__ ? Number(value.__fixed__) : Number(value));

export const getAllContracts = async () => {
	const res = await axios.get(`http://${BlockService.get_block_service_url()}/contracts`);
	return res.data;
};

export const getContractSource = async (contract_name: string) => {
	// http://165.227.181.34:3535/current/one/con_bdt_lst001/__code__
	const endpoint = "current/one";
	const res = await axios.get(`http://${BlockService.get_block_service_url()}/${endpoint}/${contract_name}/__code__`);
	return res.data;
};

export const getContractMeta = async (contract_name: string) => {
	// http://165.227.181.34:3535/current/one/con_bdt_lst001/__code__
	const endpoint = "current/all";
	const res = await axios.get(`http://${BlockService.get_block_service_url()}/${endpoint}/${contract_name}`);
	return res.data;
};

export const prepareAndAddToken = async (contract_name: string) => {
	const state = await getContractState(contract_name);
	const token_data = getTokenData(state[contract_name], contract_name);
	const { token, balances } = token_data;
	/** Save the TokenEntity */
	if (contract_name !== "currency") {
		await saveToken(token);
	}
	/** Update Balances */
	if (balances) {
		await saveBalances(contract_name, balances);
		log.log(`Saved balances for ${contract_name}`);
	}
};

/** This method syncs all Tokens and Staking data */

export const syncContracts = async (starting_tx_id = "0", batch_size = 1000, contractName: string = "submission") => {
	log.log("Beginning sync of token contracts");
	const res = await getContractChanges(contractName, starting_tx_id, batch_size);
	const length = res.history.length;

	/**
	 * 1. Get all contracts
	 */

	const all_contracts_titles = await getAllContracts();
	log.log(`Retrieved ${all_contracts_titles.length} contract titles`);
	const contract_titles_parsed = all_contracts_titles.map((contract_title) => contract_title.contractName);
	/**
	 * 2. Get each contract's source code & check if it's a token / staking contract
	 */
	const valid_tokens = [];
	const staking_contracts_to_process = [];

	//

	for (let contract_name of contract_titles_parsed) {
		const contract_source = await getContractSource(contract_name);

		if (contract_source.value) {
			const is_valid_token = validateTokenContract(contract_source.value);

			if (is_valid_token) {
				valid_tokens.push(contract_name);
				await prepareAndAddToken(contract_name);
				// return;
			}
		}
	}
	log.log(`${valid_tokens.length} tokens added to DB`);
	await prepareAndAddToken("currency");

	if (length === batch_size) {
		const tx_uid = res.history[length - 1].tx_uid;
		console.log("getting more blocks from tx_uid : " + tx_uid);
		return await syncContracts(tx_uid, batch_size);
	}
};

export const examineTxState = (history: any[]) => {
	const price_affected = history.filter((hist) => hist.state_changes_obj?.con_rocketswap_official_v1_1?.prices);
	const methods = {};
	price_affected.forEach((hist) => {
		const tx_type = hist.txInfo.transaction.payload.function;
		if (!methods[tx_type]) {
			methods[tx_type] = 1;
		} else methods[tx_type]++;
	});
	const last_tx = price_affected[price_affected.length - 1];
	const last_tx_time = new Date(last_tx.txInfo.transaction.metadata.timestamp * 1000);
};

export const getCurrentEpoch = (state: any) => {
	const index = state.CurrentEpochIndex;
	const current_epoch = state.Epochs[index];
	return parseEpoch(current_epoch, index);
};

export const parseEpoch = (epoch, index) => {
	return {
		index: index,
		time: epoch?.time,
		amt_per_hr: getValue(epoch?.amt_per_hr),
		staked: getValue(epoch?.staked)
	};
};


export async function getLatestSyncedBlock(): Promise<number> {
	const res = await axios(`http://${BlockService.get_block_service_url()}/latest_synced_block`);
	return res.data?.latest_synced_block;
}

export async function getBlock(num: number): Promise<any> {
	const res = await axios(`http://${BlockService.get_block_service_url()}/blocks/${num}`);
	return res.data;
}

export async function fillBlocksSinceSync(block_to_sync_from: number, parseBlock: T_ParseBlockFn): Promise<void> {
	try {
		let current_block = await getLatestSyncedBlock();
		if (block_to_sync_from === current_block) {
			log.log("Finished syncing historical blocks");
			return;
		}
		let next_block_to_sync = block_to_sync_from + 1;
		const block = await getBlock(next_block_to_sync);
		await handleNewBlock(block, parseBlock);
		if (next_block_to_sync <= current_block) return await fillBlocksSinceSync(next_block_to_sync, parseBlock);
	} catch (err) {
		log.warn({ err });
	}
}

export async function syncTradeHistory() {
	const pairs = await PairEntity.find();
	log.log(`syncing history for ${pairs.length} pairs`);
	for (let p of pairs) {
		await syncTokenTradeHistory("0", 1000, p.contract_name, p.token_symbol);
	}
}

export const syncTokenTradeHistory = async (starting_tx_id = "0", batch_size = 1000, contract_name: string, token_symbol: string) => {
	log.log(`${contract_name} retrieving more trades from ${starting_tx_id}`);
	const res = await getRootKeyChanges({
		contractName: contract_name,
		variableName: "balances",
		root_key: config.amm_contract,
		last_tx_uid: starting_tx_id,
		limit: batch_size
	});
	const history = res.history;
	const length = history.length;

	const trades = await parseTrades(history, contract_name, token_symbol);
	await saveTradesToDb(trades);

	if (length === batch_size) {
		const tx_uid = history[history.length - 1].tx_uid;
		return await syncTokenTradeHistory(tx_uid, batch_size, contract_name, token_symbol);
	}
};


function saveBalances(contract_name: string, balances: any) {
	throw new Error("Function not implemented.");
}

