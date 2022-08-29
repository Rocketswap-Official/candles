import { Injectable } from '@nestjs/common';
import { CandleMetaEntity } from './entities/candle-meta.entity';
import { CandleEntity } from './entities/candle.entity';

@Injectable()
export class AppService {
  async getChart(contract_name: string, resolution: string): Promise<{ candles: any, meta: any }> {
    return {
      candles: await CandleEntity.find({ where: { contract_name, resolution } }),
      meta: await CandleMetaEntity.findOne(contract_name)
    }
  }
}
