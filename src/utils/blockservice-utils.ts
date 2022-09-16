import { config } from "../config";
import { LpPointsEntity } from "../entities/lp-points.entity";
import { PairEntity } from "../entities/pair.entity";
import { parseTrades, saveTradesToDb } from "../entities/trade-history.entity";
import { BlockService } from "../services/block.service";
import { handleNewBlock, T_ParseBlockFn } from "../services/socket-client.provider";
import { I_LpPointsState, I_ReservesState } from "../types";
import { log } from "./logger";
import { getValue } from "./misc-utils";

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
	const endpoint = "current/all";
	const res = await axios.get(`http://${BlockService.get_block_service_url()}/${endpoint}/${contract_name}`);
	return res.data;
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
	for (let p of pairs) {
		await syncTokenTradeHistory("0", 3000, p.contract_name, p.token_symbol);
	}
}


export const syncTokenTradeHistory = async (starting_tx_id = "0", batch_size = 3000, contract_name: string, token_symbol: string) => {
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


export const syncAmmCurrentState = async () => {
	const current_state = await getContractState(config.amm_contract);
	const amm_state = current_state[config.amm_contract];

	if (amm_state) {
		const { discount, lp_points, reserves, staked_amount, state: amm_meta } = amm_state;
		await syncLpPointsEntities(lp_points);
		await syncPairEntities(reserves);
	}
	log.log("AMM_META state synced");
};


export const syncPairEntities = async (reserves_state: I_ReservesState) => {
	const lp_totals = await LpPointsEntity.findOne({ where: { vk: "__hash_self__" } });
	for (let contract of Object.keys(reserves_state)) {
		const reserves = reserves_state[contract];
		const ent = new PairEntity();
		ent.contract_name = contract;
		ent.lp = lp_totals.points[contract];
		ent.reserves = [getValue(reserves[0]), getValue(reserves[1])];
		ent.price = String(Number(ent.reserves[0]) / Number(ent.reserves[1]));
		await ent.save();
	}
};


export const syncLpPointsEntities = async (lp_points_state: I_LpPointsState) => {
	const contract_keys = Object.keys(lp_points_state);
	for (let contract of contract_keys) {
		const contract_obj = lp_points_state[contract];
		const address_keys = Object.keys(contract_obj);
		for (let vk of address_keys) {
			const lp_value = getValue(contract_obj[vk]);
			let lp_points_entity = await LpPointsEntity.findOne({ where: { vk } });
			if (!lp_points_entity) {
				lp_points_entity = new LpPointsEntity();
				lp_points_entity.vk = vk;
				lp_points_entity.points = {};
			}
			lp_points_entity.points[contract] = String(lp_value);
			await lp_points_entity.save();
		}
	}
};