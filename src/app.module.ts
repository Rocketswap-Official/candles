import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LastBlockEntity } from './entities/last-block.entity';
import { PairEntity } from './entities/pair.entity';
import { TokenEntity } from './entities/token.entity';
import { TradeHistoryEntity } from './entities/trade-history.entity';
import { TauCandlesService } from './services/tau-candles.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'db.sqlite',
      entities: [LastBlockEntity, PairEntity, TokenEntity, TradeHistoryEntity],
      synchronize: true,
      autoLoadEntities: true
    }),
  ], controllers: [AppController],
  providers: [AppService, TauCandlesService],
})
export class AppModule { }
 