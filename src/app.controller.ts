import { Controller, Get, Param, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { log } from './utils/logger';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get("get_chart_data")
  async getChart(@Query() params: any): Promise<any> {
    const { contract_name, resolution } = params
    if (!contract_name || !resolution) return {}
    return await this.appService.getChart(contract_name, resolution);
  }
}
