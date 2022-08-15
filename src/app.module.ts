import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TauCandlesService } from './services/tau-candles.service';
import { TauCandleEntity } from './entities/tau-candles.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'db.sqlite',
      entities: [TauCandleEntity],
      synchronize: true,
      // autoLoadEntities: true
    }),
  ], controllers: [AppController],
  providers: [AppService, TauCandlesService],
})
export class AppModule { }
