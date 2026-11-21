import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseOptions, DemoDatabase } from './demo-database.service.js';

@Module({
  exports: [DemoDatabase],
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...databaseOptions(config.get<string>('DATABASE_URL')),
        manualInitialization: true,
      }),
    }),
  ],
  providers: [DemoDatabase],
})
export class PersistenceModule {}
