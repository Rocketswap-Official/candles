import { Entity, Column, BaseEntity, PrimaryGeneratedColumn } from "typeorm";
import { I_Kvp } from "../types";
import { arrFromStr, getContractName } from "../utils/misc-utils";

/** These are tokens added by watching the submission contract / submit_contract fn */

@Entity()
export class TokenEntity extends BaseEntity {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ nullable: true })
	token_symbol: string;

	@Column({ nullable: true })
	token_name: string;

	@Column({ nullable: true })
	base_supply: string;

	@Column()
	contract_name: string;

	@Column({ nullable: true })
	developer: string;

	@Column({ nullable: true })
	operator: string;

	@Column({ nullable: true })
	has_market: boolean;

	@Column({ nullable: true })
	token_base64_svg: string;

	@Column({ nullable: true })
	token_base64_png: string;

	@Column({ nullable: true })
	token_logo_url: string;
}

export class AddTokenDto {
	token_symbol: string;
	token_name: string;
	base_supply: string;
	contract_name: string;
	token_seed_holder: string;
	developer: string;
	token_base64_svg?: string;
	token_base64_png?: string;
	token_logo_url?: string;
	operator?: string;
	custodian_addresses?: string[];
	burn_addresses?: string[];
}

export const saveToken = async (add_token_dto: AddTokenDto) => {
	const {
		token_symbol,
		token_name,
		base_supply,
		contract_name,
		developer,
		token_base64_svg,
		token_base64_png,
		token_logo_url,
		operator
	} = add_token_dto;
	if (!contract_name) {
		throw new Error("Field missing.");
	}

	const exists = await TokenEntity.findOne({ where: { contract_name } });
	if (exists) return;

	const entity = new TokenEntity();
	entity.base_supply = base_supply;
	entity.token_symbol = token_symbol ? await decideSymbol(token_symbol) : token_symbol;
	entity.token_name = token_name;
	entity.contract_name = contract_name;
	entity.developer = developer;
	entity.operator = operator;
	entity.token_base64_svg = token_base64_svg;
	entity.token_base64_png = token_base64_png;
	entity.token_logo_url = token_logo_url;
	return await entity.save();
};

async function decideSymbol(token_symbol: string): Promise<string> {
	const symbol_entity = await TokenEntity.findOne({ where: { token_symbol } });

	if (symbol_entity) {
		const parts = token_symbol.split("_");
		let idx = parts[1];
		let new_idx;
		if (idx) {
			if (parseInt(idx) > -1) {
				new_idx = parseInt(idx) + 1;
			}
		} else {
			new_idx = 1;
		}
		return await decideSymbol(`${parts[0]}_${new_idx}`);
	}
	return token_symbol;
}



export async function saveTokenUpdate(state: I_Kvp[]) {
	let contract_name = state[0].key.split(".")[0];
	const entity = await TokenEntity.findOne({ where: { contract_name } });
	state.forEach(async (change) => {
		if (entity) {
			if (change.key.includes(".metadata:token_logo_base64_svg")) entity.token_base64_svg = change.value;
			if (change.key.includes(".metadata:token_logo_base64_png")) entity.token_base64_png = change.value;
			if (change.key.includes(".metadata:token_logo_url")) entity.token_logo_url = change.value;
			if (change.key.includes(".metadata:token_symbol")) entity.token_symbol = change.value;
			if (change.key.includes(".metadata:token_name")) entity.token_name = change.value;
			try {
				await entity.save();
			} catch (err) {
				console.error(err);
			}
		}
	});
}

/** STUB */

export const getBaseSupply = () => {
	return "0";
};