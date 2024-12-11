import { Controller, Get, Param, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { FastifyReply } from "fastify";
import { join } from 'path';
import * as fs from 'node:fs';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/share/:id')
  getShare(@Res({ passthrough: false}) res: FastifyReply, @Param() params: any): string {
    const clientDistPath = join(
      __dirname,
      '..',
      '..',
      'client/dist',
    );

    if (fs.existsSync(clientDistPath)) {
      console.log('exists')
      const indexFilePath = join(clientDistPath, 'index.html');
      const stream = fs.createReadStream(indexFilePath);

      console.log(params.id)
      res.type('text/html').send(stream);
      console.log('found');
      return;
    }
    console.log('end')
    return this.appService.getHello();
  }
}
