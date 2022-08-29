import { PairEntity } from "./entities/pair.entity";

export type T_Resolution = "1m" | "5m" | "15m" | "30m" | "1h" | "3h" | "4h" | "8h" | "1d" | "3d" | "1w"
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

export interface I_UserYieldInfo {
    total_staked: number;
    current_yield: number;
    yield_per_sec: number;
    epoch_updated: number;
    time_updated: number;
    user_reward_rate?: number;
}


export interface T_ClientStakingUpdate extends T_Update {
    action: "client_staking_update";
    staking_contract: string;
}

export interface T_PriceUpdate extends T_Update {
    action: "price_update";
    contract_name: string;
    price: string;
    time: number;
}

export interface T_BalanceUpdate extends T_Update {
    action: "balance_update";
    payload: any;
}

export interface T_TauUsdPriceUpdate extends T_Update {
    action: "tau_usd_price";
    price: string;
}

export type T_Update = {
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

export interface T_TradeUpdate extends T_Update {
    action: "trade_update";
    type: "buy" | "sell";
    amount: string;
    contract_name: string;
    token_symbol: string;
    price: string;
    time: number;
    hash: string;
}

export interface I_LpPointsState {
    [key: string]: {
        [key: string]: string | { __fixed__: string };
    };
}

export interface I_ReservesState {
    [key: string]: [{ __fixed__: string }, { __fixed__: string }];
}

export interface I_OhlcData {
    open: number
    close: number
    high: number
    low: number
    time: number
}