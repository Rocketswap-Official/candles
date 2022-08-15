# Rocketswap Candles

A lightweight service for creating OHLC candle data from RSWP.

1. First thing we need to do is get all the candles for TAU from CMC / gecko. whichever has the longest history.
   * Identify if we're starting from scratch, if so sync call candles. 15 min candles should be fine.
   * Take schema and use it for Rocketswap Candles

2. Rocketswap candles.
  * Identify first trade, again check if we have candle history, if we don't sync it all, if we do, sync from the last candle
  * Candle resolution should go down to the x resolution ? what's the optimal here... 5min charts ?
  * candles should fit to UTC / UNIX time precisely, exact mechanism to do this TBA
