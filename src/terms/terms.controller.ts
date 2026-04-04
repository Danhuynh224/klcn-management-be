import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole } from '../common/enums/system-role.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateTermDto } from './dto/create-term.dto';
import { UpdateTermDto } from './dto/update-term.dto';
import { TermsService } from './terms.service';

@ApiTags('Terms')
@ApiBearerAuth()
@Controller('terms')
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @ApiOperation({ summary: 'List terms/dots' })
  @ApiQuery({ name: 'loai', required: false })
  @ApiQuery({ name: 'major', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('loai') loai?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.termsService.findAll(loai, user.major, isActive);
  }

  @Roles(SystemRole.ADMIN, SystemRole.HEAD_OF_DEPARTMENT)
  @ApiOperation({ summary: 'Create a term/dot' })
  @Post()
  create(@Body() payload: CreateTermDto) {
    return this.termsService.create(payload);
  }

  @Roles(SystemRole.ADMIN, SystemRole.HEAD_OF_DEPARTMENT)
  @ApiOperation({ summary: 'Update a term/dot' })
  @ApiParam({ name: 'id' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() payload: UpdateTermDto) {
    return this.termsService.update(id, payload);
  }
}
