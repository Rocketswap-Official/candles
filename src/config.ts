export const config_prod = {
    app_name: "Rocketswap",
    amm_contract: process.env.CONTRACT_NAME || "con_rocketswap_official_v1_1",
    network_type: process.env.NETWORK_TYPE || "mainnet",
    block_service_urls: process.env.block_service_urls?.split(",") || ["0.0.0.0:3535"]
};

export const getConfig = () => config_prod

export let config = getConfig();
