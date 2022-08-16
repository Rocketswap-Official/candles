import { PairEntity } from "./entities/pair.entity";

export type T_Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "3h" | "4h" | "1d" | "1w"
export type T_TradeType = "buy" | "sell"

export interface IKvp {
    key: string;
    value: any;
}

export interface ITxnRequest {
    metadata: any;
    payload: any;
}

export interface IProxyTxnReponse {
    payload: any;
    socket_id: string;
}

export interface ITrollBoxMessage {
    sender: string;
    message: string;
    timestamp: number;
}

export interface IUserYieldInfo {
    total_staked: number;
    current_yield: number;
    yield_per_sec: number;
    epoch_updated: number;
    time_updated: number;
    user_reward_rate?: number;
}


export interface ClientStakingUpdateType extends UpdateType {
    action: "client_staking_update";
    staking_contract: string;
}

export interface PriceUpdateType extends UpdateType {
    action: "price_update";
    contract_name: string;
    price: string;
    time: number;
}

export interface BalanceUpdateType extends UpdateType {
    action: "balance_update";
    payload: any;
}

export interface TauUsdPriceUpdateType extends UpdateType {
    action: "tau_usd_price";
    price: string;
}

export type UpdateType = {
    action:
    | "metrics_update"
    | "price_update"
    | "user_lp_update"
    | "balance_update"
    | "trade_update"
    | "staking_panel_update"
    | "user_staking_update"
    | "epoch_update"
    | "user_yield_update"
    | "client_staking_update"
    | "tau_usd_price"
    | "new_market_update";
};

export interface TradeUpdateType extends UpdateType {
    action: "trade_update";
    type: "buy" | "sell";
    amount: string;
    contract_name: string;
    token_symbol: string;
    price: string;
    time: number;
    hash: string;
}
