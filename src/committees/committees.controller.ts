import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole } from '../common/enums/system-role.enum';
import { AssignRegistrationDto } from './dto/assign-registration.dto';
import { CreateCommitteeDto } from './dto/create-committee.dto';
import { UpdateCommitteeDto } from './dto/update-committee.dto';
import { CommitteesService } from './committees.service';

@ApiTags('Committees')
@ApiBearerAuth()
@Controller('committees')
export class CommitteesController {
  constructor(private readonly committeesService: CommitteesService) {}

  @ApiOperation({ summary: 'List committees' })
  @ApiQuery({ name: 'dot', required: false })
  @Get()
  findAll(@Query('dot') dot?: string) {
    return this.committeesService.findAll(dot);
  }

  @ApiOperation({ summary: 'Get committee by id' })
  @ApiParam({ name: 'id' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.committeesService.findOne(id);
  }

  @Roles(SystemRole.ADMIN, SystemRole.HEAD_OF_DEPARTMENT)
  @ApiOperation({ summary: 'Create a committee' })
  @Post()
  create(@Body() payload: CreateCommitteeDto) {
    return this.committeesService.create(payload);
  }

  @Roles(SystemRole.ADMIN, SystemRole.HEAD_OF_DEPARTMENT)
  @ApiOperation({ summary: 'Update a committee' })
  @ApiParam({ name: 'id' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() payload: UpdateCommitteeDto) {
    return this.committeesService.update(id, payload);
  }

  @Roles(SystemRole.ADMIN, SystemRole.HEAD_OF_DEPARTMENT)
  @ApiOperation({ summary: 'Assign a registration to committee' })
  @ApiParam({ name: 'id' })
  @Post(':id/assign-registration')
  assignRegistration(
    @Param('id') id: string,
    @Body() payload: AssignRegistrationDto,
  ) {
    return this.committeesService.assignRegistration(id, payload);
  }
}
