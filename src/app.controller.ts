import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
  @Public()
  @ApiOperation({ summary: 'Health check' })
  @Get()
  getHealth() {
    return {
      data: {
        service: 'klcn-management-be',
        status: 'ok',
      },
      message: 'KLCN backend is running',
    };
  }
}
