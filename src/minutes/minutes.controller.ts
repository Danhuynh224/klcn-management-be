import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UpdateMinuteDto } from './dto/update-minute.dto';
import { MinutesService } from './minutes.service';

@ApiTags('Minutes')
@ApiBearerAuth()
@Controller('minutes')
export class MinutesController {
  constructor(private readonly minutesService: MinutesService) {}

  @ApiOperation({ summary: 'Get minute by registration id' })
  @ApiParam({ name: 'registrationId' })
  @Get('registration/:registrationId')
  getByRegistration(
    @Param('registrationId') registrationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.minutesService.getByRegistration(registrationId, user);
  }

  @ApiOperation({ summary: 'Generate minute for a registration' })
  @ApiParam({ name: 'registrationId' })
  @Post('registration/:registrationId/generate')
  generate(
    @Param('registrationId') registrationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.minutesService.generate(registrationId, user);
  }

  @ApiOperation({ summary: 'Update minute content' })
  @ApiParam({ name: 'registrationId' })
  @Patch(':registrationId')
  update(
    @Param('registrationId') registrationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: UpdateMinuteDto,
  ) {
    return this.minutesService.update(registrationId, user, payload);
  }
}
