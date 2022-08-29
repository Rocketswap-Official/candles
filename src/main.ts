import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // app.use((req, res, next) => {
	// 	res.header("Access-Control-Allow-Origin", "rocketswap.exchange"); // update to match the domain you will make the request from
	// 	res.header("Access-Control-Allow-Origin", "localhost:2001"); // update to match the domain you will make the request from
	// 	res.header("Access-Control-Allow-Origin", "0.0.0.0:2001"); // update to match the domain you will make the request from
	// 	res.header("Access-Control-Allow-Origin", "rswp.io"); // update to match the domain you will make the request from
	// 	res.header("Access-Control-Allow-Origin", "lamden.io"); // update to match the domain you will make the request from
	// 	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	// 	next();
	// });
  app.enableCors()

  await app.listen(2001);
}
bootstrap();
