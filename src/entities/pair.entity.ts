import { Entity, Column, PrimaryColumn, BaseEntity, PrimaryGeneratedColumn } from "typeorm";
import { TokenEntity } from "./token.entity";
import { saveTradeUpdate } from "./trade-history.entity";
import { log } from "../utils/logger";
import { I_Kvp } from "../types";
import { getReservesFromKvp, getVal, isLamdenKey } from "../utils/misc-utils";

/** This entity is created when a new market is detected on the AMM contract. */

@Entity()
export class PairEntity extends BaseEntity {
	@PrimaryColumn()
	contract_name: string;

	@Column({ nullable: true })
	lp: string;

	@Column()
	time: string = Date.now().toString();

	@Column({ nullable: true })
	price: string;

	@Column({ nullable: true })
	token_symbol: string;

	@Column({ nullable: true, type: "simple-json" })
	reserves: [string, string];
}

export async function saveReserves(
	fn: string,
	state: I_Kvp[],
	timestamp: number,
	hash: string,
	rswp_token_contract: string
) {
	const reserve_kvps = state.filter((kvp) => kvp.key.includes("reserves"));
	const rswp_reserves = reserve_kvps.find((kvp) => kvp.key.includes(rswp_token_contract));
	const pair_reserves = reserve_kvps.find((kvp) => !kvp.key.includes(rswp_token_contract));

	const prices_kvps = state.filter((kvp) => kvp.key.includes("prices"));
	const rswp_price_kvp = prices_kvps.find((kvp) => kvp.key.includes(rswp_token_contract));
	const pair_price_kvp = prices_kvps.find((kvp) => !kvp.key.includes(rswp_token_contract));

	const lp_kvp = state.find((kvp) => kvp.key.includes("lp_points") && kvp.key.split(":").length === 2);
	if (rswp_reserves && pair_reserves) {
		let rswp_reserves_entity = await PairEntity.findOne({ where: { contract_name: rswp_token_contract } });
		if (!rswp_reserves_entity) rswp_reserves_entity = new PairEntity();
		rswp_reserves_entity.contract_name = rswp_token_contract;
		rswp_reserves_entity.reserves = [rswp_reserves.value[0].__fixed__, rswp_reserves.value[1].__fixed__];
		await rswp_reserves_entity.save();
	}
	if (pair_reserves) {
		await updateReserves({
			update_reserves: pair_reserves,
			price_kvp: pair_price_kvp,
			lp_kvp,
			state,
			fn,
			hash,
			timestamp
		});
	}
	if (rswp_reserves && !pair_reserves) {
		await updateReserves({
			update_reserves: rswp_reserves,
			price_kvp: rswp_price_kvp,
			lp_kvp,
			state,
			fn,
			hash,
			timestamp
		});
	}
}

async function updateReserves(args: {
	update_reserves: I_Kvp;
	price_kvp: I_Kvp;
	lp_kvp: I_Kvp;
	state: I_Kvp[];
	fn: string;
	hash: string;
	timestamp: number;
}) {
	const { update_reserves, price_kvp, lp_kvp, state, fn, hash, timestamp } = args;
	let contract_name = update_reserves.key.split(":")[1];
	let vk_kvp = state.find((kvp) => {
		return kvp.key.includes(`${contract_name}.balances`) && isLamdenKey(kvp.key.split(":")[1]);
	});
	let vk = vk_kvp.key?.split(":")[1];
	let old_token_reserve: string;
	let reserves: [string, string] = [update_reserves.value[0].__fixed__, update_reserves.value[1].__fixed__];
	let price = getVal(price_kvp);
	let lp = getVal(lp_kvp);

	let entity = await PairEntity.findOne({ where: { contract_name } });

	if (!entity) {
		entity = new PairEntity();
		entity.contract_name = contract_name;
		entity.reserves = reserves;
	} else {
		if (entity.reserves) {
			old_token_reserve = entity.reserves[1];
		}

		if (fn === "buy" || fn === "sell") {
			let amount_exchanged = getAmountExchanged(fn, old_token_reserve, reserves);

			updateTradeFeed({
				contract_name,
				token_symbol: entity.token_symbol,
				type: fn,
				amount: amount_exchanged,
				price,
				time: timestamp,
				hash
			});
			saveTradeUpdate({
				contract_name,
				type: fn,
				amount: amount_exchanged,
				price,
				time: timestamp,
			});
		}
	}

	if (price_kvp) entity.price = price;
	if (lp_kvp) entity.lp = lp;
	if (reserves) entity.reserves = reserves;

	entity.time = Date.now().toString();
	await entity.save();
}

const getAmountExchanged = (fn: string, old_token_reserve: any, reserves: [any, any]) => {
	// console.log(old_token_reserve, reserves);
	return fn === "buy"
		? (parseFloat(old_token_reserve) - parseFloat(reserves[1])).toString()
		: (parseFloat(reserves[1]) - parseFloat(old_token_reserve)).toString();
};

function updateTradeFeed(args: {
	contract_name: string;
	token_symbol: string;
	type: "buy" | "sell";
	amount: string;
	price: string;
	time: number;
	hash: string;
}) {
	const { type, amount, contract_name, token_symbol, price, time, hash } = args;
}

export async function savePair(args: { state: I_Kvp[]; }) {
	const { state } = args;
	let new_token = false;

	const pair_kvp = state.find((kvp) => kvp.key.split(".")[1].split(":")[0] === "pairs");
	if (!pair_kvp) return;

	const contract_name = pair_kvp.key.split(".")[1].split(":")[1];

	let pair_entity = await PairEntity.findOne(contract_name)
	if (pair_entity) return

	pair_entity = new PairEntity()
	pair_entity.contract_name = contract_name;

	await pair_entity.save();
}

export async function savePairLp(state: I_Kvp[]) {
	const lp_kvp = state.find((kvp) => kvp.key.includes("lp_points") && kvp.key.split(":").length === 2);
	if (lp_kvp) {
		const parts = lp_kvp.key.split(".")[1].split(":");
		if (parts.length === 2) {
			const contract_name = parts[1];
			let entity = await PairEntity.findOne({ where: { contract_name } });
			if (!entity) entity = new PairEntity();
			entity.contract_name = contract_name;
			entity.lp = getVal(lp_kvp);
			await entity.save();
		}
	}
}

export const updatePairs = async () => {
	try {
		const pairs = await PairEntity.find();
		for (let p of pairs) {
			const { contract_name } = p;
			const token_entity = await TokenEntity.findOne({ where: { contract_name } });
			p.token_symbol = token_entity.token_symbol || "";
			token_entity.has_market = true;
			await token_entity.save()
			await p.save()
		}
		log.log(`${pairs.length} pairs updated with token symbol.`);
	} catch (err) {
		log.warn(err);
	}
};

export async function getTokenList(): Promise<string[]> {
	const tokens = await PairEntity.find();
	return tokens.map((token) => token.contract_name);
}

export async function updatePairReserves(state: I_Kvp[]) {
	// const is_trade = state.filter(s => s.key.includes("prices")).length > 0
	// if (is_trade) return

	const reserves_updates = state.filter(s => s.key.includes('reserves'))
	if (!reserves_updates.length) return

	log.log({ reserves_updates })

	const reserves_to_update = reserves_updates.map(r => {
		return {
			contract_name: r.key.split(":")[1],
			reserves: getReservesFromKvp(r, "string")
		}
	})

	for (let r of reserves_to_update) {
		const pair_entity = await PairEntity.findOne(r.contract_name)
		pair_entity.reserves = r.reserves as [string, string]
		await pair_entity.save()
	}
}