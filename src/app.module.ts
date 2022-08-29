import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CandleMetaEntity } from './entities/candle-meta.entity';
import { CandleEntity } from './entities/candle.entity';
import { LastBlockEntity } from './entities/last-block.entity';
import { LpPointsEntity } from './entities/lp-points.entity';
import { PairEntity } from './entities/pair.entity';
import { TokenEntity } from './entities/token.entity';
import { TradeHistoryEntity } from './entities/trade-history.entity';
import { BlockService } from './services/block.service';
import { DataSyncProvider } from './services/data-sync.provider';
import { TauCandlesService } from './services/tau-candles.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'db.sqlite',
      entities: [LastBlockEntity, PairEntity, TradeHistoryEntity, LpPointsEntity, CandleEntity, CandleMetaEntity],
      synchronize: true,
      autoLoadEntities: true
    }),
  ], controllers: [AppController],
  providers: [AppService, TauCandlesService, DataSyncProvider, BlockService],
})
export class AppModule { }
 