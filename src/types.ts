import { PairEntity } from "./entities/pair.entity";

export type T_Resolution = "1m" | "5m" | "15m" | "30m" | "1h" | "3h" | "4h" | "8h" | "1d" | "3d" | "1w"
export type T_TradeType = "buy" | "sell"

export interface I_Kvp {
    key: string;
    value: any;
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