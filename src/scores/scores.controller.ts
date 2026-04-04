import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateScoreDto } from './dto/create-score.dto';
import { FinalizeScoreDto } from './dto/finalize-score.dto';
import { UpdateScoreDto } from './dto/update-score.dto';
import { ScoresService } from './scores.service';

@ApiTags('Scores')
@ApiBearerAuth()
@Controller('scores')
export class ScoresController {
  constructor(private readonly scoresService: ScoresService) {}

  @ApiOperation({ summary: 'Create a score record' })
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: CreateScoreDto,
  ) {
    return this.scoresService.create(user, payload);
  }

  @ApiOperation({ summary: 'Update a score record' })
  @ApiParam({ name: 'id' })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: UpdateScoreDto,
  ) {
    return this.scoresService.update(id, user, payload);
  }

  @ApiOperation({ summary: 'Get scores by registration id' })
  @ApiParam({ name: 'registrationId' })
  @Get('registration/:registrationId')
  getByRegistration(@Param('registrationId') registrationId: string) {
    return this.scoresService.getByRegistration(registrationId);
  }

  @ApiOperation({ summary: 'Finalize final score for a registration' })
  @ApiParam({ name: 'registrationId' })
  @Post('registration/:registrationId/finalize')
  finalize(
    @Param('registrationId') registrationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: FinalizeScoreDto,
  ) {
    return this.scoresService.finalize(registrationId, user, payload);
  }
}
