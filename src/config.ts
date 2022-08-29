import { T_Resolution } from "./types";

export const config_prod = {
    app_name: "Rocketswap",
    amm_contract: "con_rocketswap_official_v1_1",
    amm_native_token: "con_rswp_lst001",
    network_type: "mainnet",
    block_service_urls: process.env.block_service_urls?.split(",") || ["0.0.0.0:3535"]
};

/**
 * The candle resolutions we want to create
 */

export const candle_resolutions: T_Resolution[] = ["15m", "30m", "1h", "3h", "4h", "8h", "1d", "1w"]

export const getConfig = () => config_prod

export let config = getConfig();

export const max_precision = 10